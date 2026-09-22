/**
 * Phase 4 — Customer Ledger, Credit, and Payments Test Suite
 *
 * Requirements:
 * 1. Transaction-based ledger.
 * 2. Opening ₹10,000
 * 3. Credit ₹4,065
 * 4. Payment ₹2,000
 * 5. Expected ₹12,065.
 * 6. Then payment ₹1,000.
 * 7. Expected ₹11,065.
 * 8. Balances are derived from transactions and never directly overwritten.
 * 9. Credit limits check.
 * 10. Sales returns impact on ledger.
 */

import { Customer, CustomerLedgerTransaction } from '../types';
import { rupeesToPaise, paiseToRupees } from '../services/currency';
import { computeCustomerBalanceFromTransactions } from '../services/customerLedgerService';

export function runPhase4CustomerLedgerTests(): { passed: boolean; results: string[] } {
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

  // Step 1: Initial opening balance ₹10000
  const openingTx: CustomerLedgerTransaction = {
    id: 'tx-1-op',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-spec-test',
    date: 1000,
    type: 'OPENING_BALANCE',
    description: 'Opening Credit Balance Carried Forward',
    debitPaise: rupeesToPaise(10000),
    creditPaise: 0,
    runningBalancePaise: rupeesToPaise(10000),
    createdAt: 1000,
    updatedAt: 1000,
    syncStatus: 'LOCAL'
  };

  const step1 = computeCustomerBalanceFromTransactions([openingTx]);
  assertEqual('Step 1: Opening ₹10000 Balance', paiseToRupees(step1.computedBalancePaise), 10000);

  // Step 2: Credit sale ₹4065 (Master spec 33 pcs: Hypora 12x120 + Club 6x75 + Schoolboy 15x145)
  const creditSaleTx: CustomerLedgerTransaction = {
    id: 'tx-2-sale',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-spec-test',
    date: 2000,
    type: 'CREDIT_SALE',
    description: 'Sale Bill #BILL-2001 (33 pcs: Hypora, Club, Schoolboy)',
    debitPaise: rupeesToPaise(4065),
    creditPaise: 0,
    runningBalancePaise: 0, // will be computed
    createdAt: 2000,
    updatedAt: 2000,
    syncStatus: 'LOCAL'
  };

  const step2 = computeCustomerBalanceFromTransactions([openingTx, creditSaleTx]);
  assertEqual('Step 2: Balance after Credit ₹4065', paiseToRupees(step2.computedBalancePaise), 14065);

  // Step 3: Payment ₹2000
  // Opening ₹10000 + Credit ₹4065 - Payment ₹2000 = Expected ₹12065
  const payment1Tx: CustomerLedgerTransaction = {
    id: 'tx-3-pay',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-spec-test',
    date: 3000,
    type: 'PAYMENT',
    description: 'Payment Received via CASH',
    debitPaise: 0,
    creditPaise: rupeesToPaise(2000),
    paymentMethod: 'CASH',
    runningBalancePaise: 0,
    createdAt: 3000,
    updatedAt: 3000,
    syncStatus: 'LOCAL'
  };

  const step3 = computeCustomerBalanceFromTransactions([openingTx, creditSaleTx, payment1Tx]);
  assertEqual('Step 3: Opening ₹10000 + Credit ₹4065 - Payment ₹2000 => Expected ₹12065', paiseToRupees(step3.computedBalancePaise), 12065);

  // Step 4: Then payment ₹1000
  // Previous ₹12065 - Payment ₹1000 = Expected ₹11065
  const payment2Tx: CustomerLedgerTransaction = {
    id: 'tx-4-pay',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-spec-test',
    date: 4000,
    type: 'PAYMENT',
    description: 'Payment Received via UPI',
    debitPaise: 0,
    creditPaise: rupeesToPaise(1000),
    paymentMethod: 'UPI',
    runningBalancePaise: 0,
    createdAt: 4000,
    updatedAt: 4000,
    syncStatus: 'LOCAL'
  };

  const step4 = computeCustomerBalanceFromTransactions([openingTx, creditSaleTx, payment1Tx, payment2Tx]);
  assertEqual('Step 4: Then payment ₹1000 => Expected ₹11065', paiseToRupees(step4.computedBalancePaise), 11065);

  // Step 5: Verify Running Balance Snapshot Consistency
  assertEqual('Tx 1 Running Balance', paiseToRupees(step4.orderedTransactions[0].runningBalancePaise), 10000);
  assertEqual('Tx 2 Running Balance', paiseToRupees(step4.orderedTransactions[1].runningBalancePaise), 14065);
  assertEqual('Tx 3 Running Balance', paiseToRupees(step4.orderedTransactions[2].runningBalancePaise), 12065);
  assertEqual('Tx 4 Running Balance', paiseToRupees(step4.orderedTransactions[3].runningBalancePaise), 11065);

  // Step 6: Test Sales Return (credit note / returned bags)
  // Customer returns 1 Club bag @ ₹75 => credit ₹75 => balance becomes 11065 - 75 = 10990
  const returnTx: CustomerLedgerTransaction = {
    id: 'tx-5-return',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-spec-test',
    date: 5000,
    type: 'SALES_RETURN',
    description: 'Sales Return: 1 pc CLUB bag',
    debitPaise: 0,
    creditPaise: rupeesToPaise(75),
    runningBalancePaise: 0,
    createdAt: 5000,
    updatedAt: 5000,
    syncStatus: 'LOCAL'
  };

  const step6 = computeCustomerBalanceFromTransactions([openingTx, creditSaleTx, payment1Tx, payment2Tx, returnTx]);
  assertEqual('Step 6: Return ₹75 => Expected ₹10990', paiseToRupees(step6.computedBalancePaise), 10990);

  // Step 7: Credit Limit Check: If limit is ₹50,000, balance ₹10,990 is well within limit
  const creditLimitPaise = rupeesToPaise(50000);
  const isWithinLimit = step6.computedBalancePaise <= creditLimitPaise;
  assertEqual('Step 7: Balance ₹10,990 within Credit Limit ₹50,000', isWithinLimit, true);

  return { passed: allPassed, results };
}
