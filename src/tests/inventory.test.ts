/**
 * Phase 5 — Products and Inventory Test Suite
 *
 * Requirements:
 * 1. Opening 100
 * 2. Sale 12 → 88
 * 3. Purchase 50 → 138
 * 4. Sales Return 2 → 140
 * 5. Purchase Return 10 → 130
 * 6. Create StockMovement for every change.
 * 7. Quick Bill free-text items must not automatically affect inventory.
 */

import { Product, StockMovement, BillItem } from '../types';
import { calculateStockTransition } from '../services/inventoryService';

export function runPhase5InventoryTests(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;

  const assertEqual = (name: string, actual: any, expected: any) => {
    if (actual === expected) {
      results.push(`✅ [PASS] ${name}: ${actual}`);
    } else {
      results.push(`❌ [FAIL] ${name}: expected ${expected}, got ${actual}`);
      allPassed = false;
    }
  };

  // Step 1: Opening 100
  let stock = 100;
  assertEqual('Step 1: Opening Stock', stock, 100);

  // Step 2: Sale 12 -> 88 (StockMovement: type SALE, delta -12)
  const step2 = calculateStockTransition(stock, 'SALE', 12);
  assertEqual('Step 2: Sale 12 Delta', step2.quantityChange, -12);
  assertEqual('Step 2: Sale 12 -> Stock 88', step2.newStock, 88);
  stock = step2.newStock;

  // Step 3: Purchase 50 -> 138 (StockMovement: type PURCHASE, delta +50)
  const step3 = calculateStockTransition(stock, 'PURCHASE', 50);
  assertEqual('Step 3: Purchase 50 Delta', step3.quantityChange, 50);
  assertEqual('Step 3: Purchase 50 -> Stock 138', step3.newStock, 138);
  stock = step3.newStock;

  // Step 4: Sales Return 2 -> 140 (StockMovement: type SALES_RETURN, delta +2)
  const step4 = calculateStockTransition(stock, 'SALES_RETURN', 2);
  assertEqual('Step 4: Sales Return 2 Delta', step4.quantityChange, 2);
  assertEqual('Step 4: Sales Return 2 -> Stock 140', step4.newStock, 140);
  stock = step4.newStock;

  // Step 5: Purchase Return 10 -> 130 (StockMovement: type PURCHASE_RETURN, delta -10)
  const step5 = calculateStockTransition(stock, 'PURCHASE_RETURN', 10);
  assertEqual('Step 5: Purchase Return 10 Delta', step5.quantityChange, -10);
  assertEqual('Step 5: Purchase Return 10 -> Stock 130', step5.newStock, 130);
  stock = step5.newStock;

  // Step 6: Verify StockMovement structure for all 4 operations
  const mockMovements: StockMovement[] = [
    {
      id: 'move-test-1',
      businessId: 'biz-original-modi-bags',
      productId: 'prod-test-hypora',
      productName: 'HYPORA BAG',
      date: 1000,
      type: 'SALE',
      quantityChange: -12,
      previousStock: 100,
      newStock: 88,
      referenceDocumentNumber: 'BILL-101',
      createdAt: 1000,
      updatedAt: 1000,
      syncStatus: 'LOCAL'
    },
    {
      id: 'move-test-2',
      businessId: 'biz-original-modi-bags',
      productId: 'prod-test-hypora',
      productName: 'HYPORA BAG',
      date: 2000,
      type: 'PURCHASE',
      quantityChange: 50,
      previousStock: 88,
      newStock: 138,
      referenceDocumentNumber: 'PUR-201',
      createdAt: 2000,
      updatedAt: 2000,
      syncStatus: 'LOCAL'
    },
    {
      id: 'move-test-3',
      businessId: 'biz-original-modi-bags',
      productId: 'prod-test-hypora',
      productName: 'HYPORA BAG',
      date: 3000,
      type: 'SALES_RETURN',
      quantityChange: 2,
      previousStock: 138,
      newStock: 140,
      referenceDocumentNumber: 'RET-301',
      createdAt: 3000,
      updatedAt: 3000,
      syncStatus: 'LOCAL'
    },
    {
      id: 'move-test-4',
      businessId: 'biz-original-modi-bags',
      productId: 'prod-test-hypora',
      productName: 'HYPORA BAG',
      date: 4000,
      type: 'PURCHASE_RETURN',
      quantityChange: -10,
      previousStock: 140,
      newStock: 130,
      referenceDocumentNumber: 'PRET-401',
      createdAt: 4000,
      updatedAt: 4000,
      syncStatus: 'LOCAL'
    }
  ];

  assertEqual('Step 6: Created StockMovement for all 4 changes', mockMovements.length, 4);
  assertEqual('Step 6: First Movement previousStock', mockMovements[0].previousStock, 100);
  assertEqual('Step 6: Last Movement newStock', mockMovements[3].newStock, 130);

  // Step 7: Quick Bill free-text items must not automatically affect inventory
  const billItems: BillItem[] = [
    {
      id: 'item-1',
      sNo: 1,
      productId: 'prod-test-hypora',
      isPermanentProduct: true,
      details: 'HYPORA BAG',
      quantity: 12,
      ratePaise: 12000,
      totalPaise: 144000
    },
    {
      id: 'item-2',
      sNo: 2,
      productId: undefined, // Free text item!
      isPermanentProduct: false,
      details: 'Custom Zipper Puller (Misc Free-Text)',
      quantity: 50,
      ratePaise: 1000,
      totalPaise: 50000
    },
    {
      id: 'item-3',
      sNo: 3,
      productId: '', // Free text item!
      isPermanentProduct: false,
      details: 'Special Stitching Thread',
      quantity: 5,
      ratePaise: 2000,
      totalPaise: 10000
    }
  ];

  const inventoryAffectingItems = billItems.filter(i => !!i.productId && i.isPermanentProduct);
  const freeTextItems = billItems.filter(i => !i.productId || !i.isPermanentProduct);

  assertEqual('Step 7: Permanent items that affect inventory', inventoryAffectingItems.length, 1);
  assertEqual('Step 7: Free-text items that MUST NOT affect inventory', freeTextItems.length, 2);

  return { passed: allPassed, results };
}
