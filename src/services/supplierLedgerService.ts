/**
 * Supplier Ledger & Transaction Accounting Service
 *
 * Implements strict transaction-based accounting rules for wholesale suppliers:
 * - Balances are NEVER directly overwritten.
 * - Every balance change MUST be derived from an immutable SupplierLedgerTransaction.
 * - Purchases create a liability (Credit to supplier: we owe the supplier).
 * - Payments or Purchase Returns reduce liability (Debit to supplier).
 * - Supplier balance (what we owe) = sum(credits) - sum(debits).
 * - Running balance on each ledger entry represents the exact snapshot at that transaction point.
 */

import { Supplier, SupplierLedgerTransaction, SupplierLedgerTxType, PaymentMethod } from '../types';
import { roomDb } from '../db/indexedDbRoom';

export interface SupplierLedgerCalculationResult {
  totalCreditsPaise: number;
  totalDebitsPaise: number;
  computedOutstandingPaise: number;
  orderedTransactions: SupplierLedgerTransaction[];
}

/**
 * Pure calculation function for recomputing supplier ledger balance:
 * Balance = Total Credits (Purchases) - Total Debits (Payments/Returns)
 */
export function computeSupplierBalanceFromTransactions(
  transactions: SupplierLedgerTransaction[]
): SupplierLedgerCalculationResult {
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  let runningBalance = 0;
  let totalCreditsPaise = 0;
  let totalDebitsPaise = 0;

  const orderedTransactions: SupplierLedgerTransaction[] = [];

  for (const tx of sorted) {
    totalCreditsPaise += tx.creditPaise || 0;
    totalDebitsPaise += tx.debitPaise || 0;
    runningBalance = runningBalance + (tx.creditPaise || 0) - (tx.debitPaise || 0);

    orderedTransactions.push({
      ...tx,
      runningBalancePaise: runningBalance
    });
  }

  return {
    totalCreditsPaise,
    totalDebitsPaise,
    computedOutstandingPaise: runningBalance,
    orderedTransactions
  };
}

/**
 * Appends a new immutable ledger transaction for a supplier and updates the supplier
 * summary fields purely as an indexed snapshot of the transactional ledger.
 */
export async function postSupplierLedgerTransaction(params: {
  supplierId: string;
  type: SupplierLedgerTxType;
  description: string;
  creditPaise: number; // Purchase/Inward liability
  debitPaise: number;  // Payment/Return
  paymentMethod?: PaymentMethod;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  notes?: string;
  date?: number;
}): Promise<{ supplier: Supplier; transaction: SupplierLedgerTransaction }> {
  const supplier = await roomDb.get<Supplier>('suppliers', params.supplierId);
  if (!supplier) {
    throw new Error(`Supplier with ID "${params.supplierId}" not found.`);
  }

  // Fetch all existing ledger transactions for this supplier
  const allLedger = await roomDb.getAll<SupplierLedgerTransaction>('supplier_ledger');
  const supplierTxs = allLedger.filter(tx => tx.supplierId === params.supplierId);

  // Compute current balance strictly from transactional ledger
  const currentCalc = computeSupplierBalanceFromTransactions(supplierTxs);
  const newOutstanding = currentCalc.computedOutstandingPaise + params.creditPaise - params.debitPaise;

  const now = params.date || Date.now();
  const txId = `suppledg-${now}-${Math.random().toString(36).substr(2, 5)}`;

  const newTx: SupplierLedgerTransaction = {
    id: txId,
    businessId: supplier.businessId || 'biz-original-modi-bags',
    supplierId: supplier.id,
    date: now,
    type: params.type,
    description: params.description,
    creditPaise: params.creditPaise,
    debitPaise: params.debitPaise,
    runningBalancePaise: newOutstanding,
    paymentMethod: params.paymentMethod,
    referenceDocumentId: params.referenceDocumentId,
    referenceDocumentNumber: params.referenceDocumentNumber,
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };

  // 1. Record immutable ledger transaction
  await roomDb.put('supplier_ledger', newTx);

  // 2. Update cached snapshot on supplier record
  const updatedSupplier: Supplier = {
    ...supplier,
    currentOutstandingPaise: newOutstanding,
    totalPurchasesPaise: (supplier.totalPurchasesPaise || 0) + (params.type === 'PURCHASE' ? params.creditPaise : 0),
    totalPaymentsPaise: (supplier.totalPaymentsPaise || 0) + (params.type === 'PAYMENT' ? params.debitPaise : 0),
    updatedAt: now
  };
  await roomDb.put('suppliers', updatedSupplier);

  // 3. Audit trail
  await roomDb.put('audit_logs', {
    id: `audit-${now}`,
    businessId: supplier.businessId || 'biz-original-modi-bags',
    user: 'Supplier Ledger System',
    action: `SUPPLIER_${params.type}`,
    timestamp: now,
    recordType: 'SUPPLIER_LEDGER',
    recordId: newTx.id,
    notes: `${params.description} for ${supplier.name}. Running balance: ₹${(newOutstanding / 100).toFixed(2)}`,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  });

  return { supplier: updatedSupplier, transaction: newTx };
}
