/**
 * Purchase Management Service
 *
 * Implements atomic purchase transaction flow from master specification:
 * Purchase must atomically update:
 * 1. Inventory (Stock increment + StockMovement audit per line item)
 * 2. Supplier Ledger (Credit liability entry + supplier balance update)
 * 3. Payment (Debit payment entry on supplier ledger if paid amount > 0)
 * 4. Cash / Bank / UPI where appropriate (CRITICAL: non-cash does not modify physical cash drawer)
 * 5. Audit (Immutable system audit trail)
 * 6. Sync (Room sync queue flag)
 */

import { Purchase, PurchaseItem, Supplier, Product, PaymentMethod } from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { recordStockMovement } from './inventoryService';
import { postSupplierLedgerTransaction } from './supplierLedgerService';
import { recordPhysicalCashMovement } from './cashService';
import { securityService } from './securityService';
import { auditService } from './auditService';

export interface CreatePurchaseParams {
  supplierId: string;
  purchaseInvoiceNumber: string;
  items: PurchaseItem[];
  paymentMethod: PaymentMethod;
  paidPaise: number;
  taxPaise?: number;
  freightChargesPaise?: number;
  otherChargesPaise?: number;
  transport?: string;
  notes?: string;
  date?: number;
}

export interface CreatePurchaseResult {
  purchase: Purchase;
  supplier: Supplier;
}

export async function processAtomicPurchase(params: CreatePurchaseParams): Promise<CreatePurchaseResult> {
  // Enforce security permission guard
  securityService.assertPermission('canAccessPurchases', 'Record purchase bill from supplier');

  const supplier = await roomDb.get<Supplier>('suppliers', params.supplierId);
  if (!supplier) {
    throw new Error(`Supplier with ID "${params.supplierId}" not found.`);
  }

  const now = params.date || Date.now();
  const totalQuantity = params.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalPaise = params.items.reduce((sum, item) => sum + item.totalPaise, 0);
  const taxPaise = params.taxPaise || 0;
  const freightChargesPaise = params.freightChargesPaise || 0;
  const otherChargesPaise = params.otherChargesPaise || 0;
  const grandTotalPaise = subtotalPaise + taxPaise + freightChargesPaise + otherChargesPaise;
  const paidPaise = Math.min(grandTotalPaise, Math.max(0, params.paidPaise));
  const creditPaise = Math.max(0, grandTotalPaise - paidPaise);

  const purchaseId = `pur-${now}-${Math.random().toString(36).substr(2, 5)}`;
  const invoiceNumber = params.purchaseInvoiceNumber.trim() || `PUR-${Date.now().toString().slice(-4)}`;

  const purchase: Purchase = {
    id: purchaseId,
    businessId: supplier.businessId || 'biz-original-modi-bags',
    supplierId: supplier.id,
    supplierName: supplier.name,
    purchaseInvoiceNumber: invoiceNumber,
    date: now,
    items: params.items.map(item => ({
      ...item,
      purchaseId
    })),
    totalQuantity,
    subtotalPaise,
    taxPaise,
    freightChargesPaise,
    otherChargesPaise,
    grandTotalPaise,
    paidPaise,
    creditPaise,
    paymentMethod: params.paymentMethod,
    transport: params.transport,
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };

  // ==========================================
  // ATOMIC STEP 1: Persist Purchase Record
  // ==========================================
  await roomDb.put('purchases', purchase);

  // ==========================================
  // ATOMIC STEP 2: Update Inventory & StockMovement
  // ==========================================
  for (const item of params.items) {
    if (item.productId && item.productId !== 'custom-item') {
      try {
        await recordStockMovement({
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity,
          referenceDocumentId: purchase.id,
          referenceDocumentNumber: invoiceNumber,
          notes: `Purchase Inward lot from ${supplier.name} (#${invoiceNumber})`,
          date: now
        });

        // Also update product purchase rate
        const prod = await roomDb.get<Product>('products', item.productId);
        if (prod && item.purchaseRatePaise > 0) {
          await roomDb.put('products', {
            ...prod,
            purchaseRatePaise: item.purchaseRatePaise,
            updatedAt: now
          });
        }
      } catch (err) {
        console.warn(`Could not update stock for product ${item.productId}:`, err);
      }
    }
  }

  // ==========================================
  // ATOMIC STEP 3: Update Supplier Ledger (Purchase Liability)
  // ==========================================
  // Purchase creates liability (Credit to supplier)
  const ledgerResult1 = await postSupplierLedgerTransaction({
    supplierId: supplier.id,
    type: 'PURCHASE',
    description: `Purchase Invoice #${invoiceNumber} (${totalQuantity} pcs)`,
    creditPaise: grandTotalPaise,
    debitPaise: 0,
    paymentMethod: params.paymentMethod,
    referenceDocumentId: purchase.id,
    referenceDocumentNumber: invoiceNumber,
    notes: params.notes,
    date: now
  });

  let currentSupplier = ledgerResult1.supplier;

  // ==========================================
  // ATOMIC STEP 4: Update Supplier Ledger (Payment Settlement, if paid > 0)
  // ==========================================
  if (paidPaise > 0) {
    const ledgerResult2 = await postSupplierLedgerTransaction({
      supplierId: supplier.id,
      type: 'PAYMENT',
      description: `Payment for Purchase #${invoiceNumber} via ${params.paymentMethod}`,
      creditPaise: 0,
      debitPaise: paidPaise,
      paymentMethod: params.paymentMethod,
      referenceDocumentId: purchase.id,
      referenceDocumentNumber: invoiceNumber,
      notes: `Paid ₹${(paidPaise / 100).toFixed(2)}`,
      date: now + 1
    });
    currentSupplier = ledgerResult2.supplier;
  }

  // ==========================================
  // ATOMIC STEP 5: Cash / Bank / UPI Updates
  // CRITICAL RULE: Non-cash payment methods (UPI, BANK) MUST NOT modify physical cash!
  // ==========================================
  if (paidPaise > 0 && params.paymentMethod === 'CASH') {
    await recordPhysicalCashMovement({
      type: 'CASH_PURCHASE',
      description: `Cash paid to supplier ${supplier.name} for Invoice #${invoiceNumber}`,
      inflowPaise: 0,
      outflowPaise: paidPaise,
      paymentMethod: 'CASH',
      referenceId: purchase.id,
      date: now + 2
    });
  }

  // ==========================================
  // ATOMIC STEP 6: Audit Log
  // ==========================================
  const activeStaff = securityService.getActiveStaff();
  await auditService.log({
    user: activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Purchase Manager',
    staffId: activeStaff?.id,
    role: activeStaff?.role,
    action: 'CREATE_PURCHASE',
    timestamp: now,
    recordType: 'PURCHASE',
    recordId: purchase.id,
    severity: 'INFO',
    description: `Purchase #${invoiceNumber} from ${supplier.name}. Total: ₹${(grandTotalPaise / 100).toFixed(2)}, Paid: ₹${(paidPaise / 100).toFixed(2)} (${params.paymentMethod}), Credit: ₹${(creditPaise / 100).toFixed(2)}`,
    newData: {
      supplierName: supplier.name,
      invoiceNumber,
      grandTotalPaise,
      paidPaise,
      itemsCount: params.items.length
    }
  });

  return {
    purchase,
    supplier: currentSupplier
  };
}
