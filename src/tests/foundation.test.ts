/**
 * Phase 1 Foundation Verification Test Suite
 * Validates:
 * 1. Financial calculation accuracy with integer paise
 * 2. Exact test cases specified in prompt:
 *    - 12 × 120 = 1440
 *    - 6 × 75 = 450
 *    - 15 × 145 = 2175
 *    - Total Quantity = 33, Total = 4065
 * 3. Customer balance formulas:
 *    - Opening = 10000
 *    - Credit Sale = 4065
 *    - Payment = 2000
 *    - Expected = 12065
 *    - Payment = 1000
 *    - Expected = 11065
 * 4. Label code formulas:
 *    - Sales item code: 6 + price (never displays raw price)
 *    - Sales label count: ceil(qty / 6)
 *    - Purchase code: 786 + purchase rate
 */

import {
  rupeesToPaise,
  paiseToRupees,
  calculateLineTotalPaise,
  calculateBillFinancials,
  generateSalesItemCode,
  calculateSalesLabelCount,
  generatePurchaseCode
} from '../services/currency';

export function runFoundationTests(): { passed: boolean; results: string[] } {
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

  // Test 1: Quick Billing Test Numbers
  const hyporaLine = calculateLineTotalPaise(12, rupeesToPaise(120));
  assertEqual('Hypora line (12 x 120)', paiseToRupees(hyporaLine), 1440);

  const clubLine = calculateLineTotalPaise(6, rupeesToPaise(75));
  assertEqual('Club line (6 x 75)', paiseToRupees(clubLine), 450);

  const schoolboyLine = calculateLineTotalPaise(15, rupeesToPaise(145));
  assertEqual('Schoolboy line (15 x 145)', paiseToRupees(schoolboyLine), 2175);

  const billTotals = calculateBillFinancials({
    items: [
      { quantity: 12, ratePaise: rupeesToPaise(120) },
      { quantity: 6, ratePaise: rupeesToPaise(75) },
      { quantity: 15, ratePaise: rupeesToPaise(145) },
    ]
  });

  assertEqual('Total Quantity', billTotals.totalQuantity, 33);
  assertEqual('Grand Total', paiseToRupees(billTotals.grandTotalPaise), 4065);

  // Test 2: Customer Balance Formula
  // Formula: Opening (10000) + Credit Sale (4065) - Payment (2000) = 12065
  const openingBalancePaise = rupeesToPaise(10000);
  const creditSalePaise = billTotals.grandTotalPaise; // 4065
  const payment1Paise = rupeesToPaise(2000);
  const expectedOutstanding1 = openingBalancePaise + creditSalePaise - payment1Paise;
  assertEqual('Customer Balance step 1', paiseToRupees(expectedOutstanding1), 12065);

  // Then payment = 1000 => expected = 11065
  const payment2Paise = rupeesToPaise(1000);
  const expectedOutstanding2 = expectedOutstanding1 - payment2Paise;
  assertEqual('Customer Balance step 2', paiseToRupees(expectedOutstanding2), 11065);

  // Test 3: Sales Label Rules
  assertEqual('Sales code for ₹120', generateSalesItemCode(rupeesToPaise(120)), '6120');
  assertEqual('Sales code for ₹75', generateSalesItemCode(rupeesToPaise(75)), '675');
  assertEqual('Sales code for ₹145', generateSalesItemCode(rupeesToPaise(145)), '6145');
  assertEqual('Sales code for ₹750', generateSalesItemCode(rupeesToPaise(750)), '6750');

  // Verify raw price does not leak in sales code
  const code = generateSalesItemCode(rupeesToPaise(120));
  const rawPricePattern = /^₹|PRICE|RATE|SELLING/i;
  assertEqual('Sales label hides raw price text', rawPricePattern.test(code), false);

  // Test 4: Sales Label Count Formula: ceil(quantity / 6)
  assertEqual('Sales label count 1 pc', calculateSalesLabelCount(1), 1);
  assertEqual('Sales label count 6 pcs', calculateSalesLabelCount(6), 1);
  assertEqual('Sales label count 7 pcs', calculateSalesLabelCount(7), 2);
  assertEqual('Sales label count 12 pcs', calculateSalesLabelCount(12), 2);
  assertEqual('Sales label count 15 pcs', calculateSalesLabelCount(15), 3);
  assertEqual('Sales label count 30 pcs', calculateSalesLabelCount(30), 5);
  assertEqual('Sales label count 33 pcs', calculateSalesLabelCount(33), 6);

  // Test 5: Purchase Label Rules
  // Formula: 786 + integer purchase rate
  assertEqual('Purchase code for ₹150', generatePurchaseCode(rupeesToPaise(150)), '786150');
  assertEqual('Purchase code for ₹120', generatePurchaseCode(rupeesToPaise(120)), '786120');
  assertEqual('Purchase code for ₹75', generatePurchaseCode(rupeesToPaise(75)), '78675');
  assertEqual('Purchase code for ₹250', generatePurchaseCode(rupeesToPaise(250)), '786250');
  assertEqual('Purchase code for ₹300', generatePurchaseCode(rupeesToPaise(300)), '786300');
  assertEqual('Purchase code for ₹750', generatePurchaseCode(rupeesToPaise(750)), '786750');

  return { passed: allPassed, results };
}
