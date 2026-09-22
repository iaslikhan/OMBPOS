/**
 * Product & Inventory Management Service
 *
 * Implements strict inventory and stock movement rules from master specification:
 * - Products maintain openingStock, currentStock, and minimumStock.
 * - Every stock change MUST create an immutable StockMovement entry.
 * - StockMovement records: productId, productName, date, type, quantityChange, previousStock, newStock, referenceDocumentNumber, notes.
 * - Stock movement types:
 *     - PURCHASE (+qty)
 *     - SALE (-qty)
 *     - SALES_RETURN (+qty)
 *     - PURCHASE_RETURN (-qty)
 *     - DAMAGE (-qty)
 *     - MANUAL_ADJUSTMENT (+ or - qty)
 * - Quick Bill free-text items (where productId is undefined or isPermanentProduct is false) MUST NOT affect inventory.
 */

import { Product, StockMovement, StockMovementType, BillItem } from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { securityService } from './securityService';
import { auditService } from './auditService';

export interface ApplyStockMovementParams {
  productId: string;
  type: StockMovementType;
  quantity: number; // positive number representing the volume of items involved
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  notes?: string;
  date?: number;
}

/**
 * Pure calculation function for stock transitions.
 * Returns the quantityChange (+ or -) and the calculated new stock.
 */
export function calculateStockTransition(
  currentStock: number,
  type: StockMovementType,
  quantity: number
): { quantityChange: number; newStock: number } {
  const absQty = Math.abs(quantity);
  let quantityChange = 0;

  switch (type) {
    case 'PURCHASE':
    case 'SALES_RETURN':
      quantityChange = absQty;
      break;
    case 'SALE':
    case 'PURCHASE_RETURN':
    case 'DAMAGE':
      quantityChange = -absQty;
      break;
    case 'MANUAL_ADJUSTMENT':
      // For manual adjustment, caller may pass signed quantity
      quantityChange = quantity;
      break;
    default:
      quantityChange = 0;
  }

  const newStock = Math.max(0, currentStock + quantityChange);
  return { quantityChange, newStock };
}

/**
 * Applies a stock movement to a product in the database:
 * 1. Checks product existence
 * 2. Computes previousStock and newStock
 * 3. Updates Product.currentStock
 * 4. Inserts an immutable StockMovement record
 */
export async function recordStockMovement(params: ApplyStockMovementParams): Promise<{
  product: Product;
  movement: StockMovement;
}> {
  // If manual adjustment or damage is initiated, verify staff permission
  if (params.type === 'MANUAL_ADJUSTMENT' || params.type === 'DAMAGE') {
    securityService.assertPermission('canEditProduct', `Apply stock ${params.type}`);
  }

  const product = await roomDb.get<Product>('products', params.productId);
  if (!product) {
    throw new Error(`Product with ID "${params.productId}" not found.`);
  }

  const previousStock = product.currentStock;
  const { quantityChange, newStock } = calculateStockTransition(previousStock, params.type, params.quantity);

  const now = params.date || Date.now();
  const movementId = `move-${now}-${Math.random().toString(36).substr(2, 6)}`;

  const movement: StockMovement = {
    id: movementId,
    businessId: product.businessId || 'biz-original-modi-bags',
    productId: product.id,
    productName: product.name,
    date: now,
    type: params.type,
    quantityChange,
    previousStock,
    newStock,
    referenceDocumentId: params.referenceDocumentId,
    referenceDocumentNumber: params.referenceDocumentNumber,
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };

  // 1. Record the StockMovement
  await roomDb.put('stock_movements', movement);

  // 2. Update Product currentStock
  const updatedProduct: Product = {
    ...product,
    currentStock: newStock,
    updatedAt: now
  };
  await roomDb.put('products', updatedProduct);

  // 3. Audit Log
  const activeStaff = securityService.getActiveStaff();
  await auditService.log({
    user: activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Inventory System',
    staffId: activeStaff?.id,
    role: activeStaff?.role,
    action: `STOCK_${params.type}`,
    timestamp: now,
    recordType: 'STOCK_MOVEMENT',
    recordId: movement.id,
    severity: params.type === 'DAMAGE' ? 'WARNING' : 'INFO',
    description: `${params.type} of ${Math.abs(quantityChange)} pcs for ${product.name}. Stock changed: ${previousStock} -> ${newStock}`,
    newData: {
      productId: product.id,
      productName: product.name,
      previousStock,
      newStock,
      quantityChange
    }
  });

  return { product: updatedProduct, movement };
}

/**
 * Processes Bill items during sale finalization.
 * CRITICAL RULE: Quick Bill free-text items (where !item.productId or item.productId is empty)
 * MUST NOT automatically affect inventory. Only permanent catalog products affect inventory.
 */
export async function processBillItemsInventory(
  items: BillItem[],
  billId: string,
  billNumber: string
): Promise<StockMovement[]> {
  const movements: StockMovement[] = [];

  for (const item of items) {
    // Quick Bill free-text items must not automatically affect inventory
    if (!item.productId || !item.isPermanentProduct) {
      continue;
    }

    try {
      const { movement } = await recordStockMovement({
        productId: item.productId,
        type: 'SALE',
        quantity: item.quantity,
        referenceDocumentId: billId,
        referenceDocumentNumber: billNumber,
        notes: `Sale Bill #${billNumber} (${item.details || 'Wholesale Bag'})`
      });
      movements.push(movement);
    } catch (err) {
      console.warn(`Could not deduct stock for item ${item.details}:`, err);
    }
  }

  return movements;
}
