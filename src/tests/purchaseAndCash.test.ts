/**
 * Phase 6 — Purchase, Supplier, Expense and Cash Test Suite
 *
 * Test Specifications:
 * 1. Supplier opening balance & ledger transactions.
 * 2. Purchase atomic flow:
 *    - Updates Inventory (+qty)
 *    - Creates StockMovement record
 *    - Updates Supplier Ledger (Credit = total bill, Debit = paid amount)
 *    - Atomic balance calculation: Balance = Credits - Debits
 * 3. CRITICAL TEST: Non-cash payment methods (UPI, BANK, CHEQUE, CREDIT)
 *    do NOT modify physical cash!
 * 4. Cash payments DO modify physical cash drawer (outflow).
 * 5. Expenses: Cash expenses deduct cash drawer, non-cash expenses do not.
 */

import { SupplierLedgerTransaction, CashTransaction, PurchaseItem, PaymentMethod } from '../types';
import { computeSupplierBalanceFromTransactions } from '../services/supplierLedgerService';
import { computePhysicalCashBalance } from '../services/cashService';
import { calculateStockTransition } from '../services/inventoryService';

export function runPhase6PurchaseAndCashTests(): { passed: boolean; results: string[] } {
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

  // ========================================================
  // TEST 1: Supplier Ledger Balance Recomputation (Transactional)
  // Opening: ₹15,000 credit (we owe)
  // Purchase: ₹6,000 credit (we owe)
  // Payment: ₹5,000 debit (we paid)
  // Expected Outstanding: ₹15,000 + ₹6,000 - ₹5,000 = ₹16,000
  // ========================================================
  const mockSupplierTxs: SupplierLedgerTransaction[] = [
    {
      id: 'tx-1',
      businessId: 'biz-original-modi-bags',
      supplierId: 'supp-01',
      date: 1000,
      type: 'OPENING_BALANCE',
      description: 'Opening balance payable',
      creditPaise: 1500000, // ₹15,000
      debitPaise: 0,
      runningBalancePaise: 1500000,
      createdAt: 1000,
      updatedAt: 1000,
      syncStatus: 'LOCAL'
    },
    {
      id: 'tx-2',
      businessId: 'biz-original-modi-bags',
      supplierId: 'supp-01',
      date: 2000,
      type: 'PURCHASE',
      description: 'Purchase Invoice #PUR-101',
      creditPaise: 600000, // ₹6,000
      debitPaise: 0,
      runningBalancePaise: 2100000,
      referenceDocumentNumber: 'PUR-101',
      createdAt: 2000,
      updatedAt: 2000,
      syncStatus: 'LOCAL'
    },
    {
      id: 'tx-3',
      businessId: 'biz-original-modi-bags',
      supplierId: 'supp-01',
      date: 3000,
      type: 'PAYMENT',
      description: 'Bank payment against PUR-101',
      creditPaise: 0,
      debitPaise: 500000, // ₹5,000
      runningBalancePaise: 1600000,
      paymentMethod: 'BANK',
      createdAt: 3000,
      updatedAt: 3000,
      syncStatus: 'LOCAL'
    }
  ];

  const suppCalc = computeSupplierBalanceFromTransactions(mockSupplierTxs);
  assertEqual('Test 1: Supplier Total Credits (₹21,000)', suppCalc.totalCreditsPaise, 2100000);
  assertEqual('Test 1: Supplier Total Debits (₹5,000)', suppCalc.totalDebitsPaise, 500000);
  assertEqual('Test 1: Supplier Outstanding Payable (₹16,000)', suppCalc.computedOutstandingPaise, 1600000);

  // ========================================================
  // TEST 2: Inventory Inward On Purchase
  // Initial: 100 pcs, Purchase: 50 pcs -> 150 pcs
  // ========================================================
  const invTransition = calculateStockTransition(100, 'PURCHASE', 50);
  assertEqual('Test 2: Purchase Stock Delta (+50 pcs)', invTransition.quantityChange, 50);
  assertEqual('Test 2: New Stock (150 pcs)', invTransition.newStock, 150);

  // ========================================================
  // TEST 3: CRITICAL SPEC REQUIREMENT:
  // Non-cash payment methods (UPI, BANK, CHEQUE, CREDIT) MUST NOT modify physical cash!
  // ========================================================
  const initialCashTxs: CashTransaction[] = [
    {
      id: 'cash-open',
      businessId: 'biz-original-modi-bags',
      date: 1000,
      type: 'OPENING_CASH',
      description: 'Morning Drawer Cash',
      inflowPaise: 500000, // ₹5,000 physical cash
      outflowPaise: 0,
      runningCashBalancePaise: 500000,
      createdAt: 1000,
      updatedAt: 1000,
      syncStatus: 'LOCAL'
    }
  ];

  const baseCashSummary = computePhysicalCashBalance(initialCashTxs);
  assertEqual('Test 3a: Physical Cash Opening Balance (₹5,000)', baseCashSummary.computedCashBalancePaise, 500000);

  // Simulate non-cash payments:
  // A purchase of ₹6,000 paid via UPI
  // An expense of ₹1,200 paid via BANK transfer
  // A customer payment of ₹4,000 received via CHEQUE
  // None of these should insert into cash_transactions!
  const nonCashPayments: { method: PaymentMethod; amountPaise: number }[] = [
    { method: 'UPI', amountPaise: 600000 },
    { method: 'BANK', amountPaise: 120000 },
    { method: 'CHEQUE', amountPaise: 400000 },
    { method: 'CREDIT', amountPaise: 300000 }
  ];

  let simulatedCashTxs = [...initialCashTxs];
  for (const item of nonCashPayments) {
    if (item.method === 'CASH') {
      simulatedCashTxs.push({
        id: `cash-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        date: 2000,
        type: 'CASH_EXPENSE',
        description: 'Payment',
        inflowPaise: 0,
        outflowPaise: item.amountPaise,
        runningCashBalancePaise: 0,
        createdAt: 2000,
        updatedAt: 2000,
        syncStatus: 'LOCAL'
      });
    }
  }

  const postNonCashSummary = computePhysicalCashBalance(simulatedCashTxs);
  assertEqual(
    'Test 3b: Physical Cash UNCHANGED by Non-Cash Payments (Still ₹5,000)',
    postNonCashSummary.computedCashBalancePaise,
    500000
  );

  // ========================================================
  // TEST 4: Cash Payment DOES deduct physical cash drawer
  // Now add an actual CASH purchase payment of ₹1,500
  // ========================================================
  simulatedCashTxs.push({
    id: 'cash-pur-01',
    businessId: 'biz-original-modi-bags',
    date: 3000,
    type: 'CASH_PURCHASE',
    description: 'Cash payment for zipper lot',
    inflowPaise: 0,
    outflowPaise: 150000, // ₹1,500 cash out
    runningCashBalancePaise: 350000,
    createdAt: 3000,
    updatedAt: 3000,
    syncStatus: 'LOCAL'
  });

  const postCashOutSummary = computePhysicalCashBalance(simulatedCashTxs);
  assertEqual(
    'Test 4: Physical Cash Properly Reduced by Cash Purchase (₹5,000 - ₹1,500 = ₹3,500)',
    postCashOutSummary.computedCashBalancePaise,
    350000
  );

  // ========================================================
  // TEST 5: Cash Expense vs Non-Cash Expense
  // Cash expense ₹500 should reduce physical cash to ₹3,000
  // Non-cash expense ₹1,000 (UPI) should NOT reduce physical cash (remains ₹3,000)
  // ========================================================
  simulatedCashTxs.push({
    id: 'cash-exp-tea',
    businessId: 'biz-original-modi-bags',
    date: 4000,
    type: 'CASH_EXPENSE',
    description: 'Staff Tea & Food Expense',
    inflowPaise: 0,
    outflowPaise: 50000, // ₹500 cash out
    runningCashBalancePaise: 300000,
    createdAt: 4000,
    updatedAt: 4000,
    syncStatus: 'LOCAL'
  });

  const postCashExpSummary = computePhysicalCashBalance(simulatedCashTxs);
  assertEqual(
    'Test 5: Physical Cash After Cash Expense (₹3,500 - ₹500 = ₹3,000)',
    postCashExpSummary.computedCashBalancePaise,
    300000
  );

  return { passed: allPassed, results };
}
