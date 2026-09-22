/**
 * Phase 3 Quick Bill Verification Test Suite
 * Tests:
 * 1. HYPORA 12 × ₹120 = ₹1440
 * 2. CLUB 6 × ₹75 = ₹450
 * 3. SCHOOLBOY 15 × ₹145 = ₹2175
 * Total Quantity = 33
 * Grand Total = ₹4065
 * 
 * Tests Financials:
 * - Free-text line items & catalog line items
 * - Discount (e.g. ₹65 discount => ₹4000)
 * - GST (e.g. 5%, 12%, 18%)
 * - Round off to nearest rupee
 * - Paid vs Balance calculation
 * - Customer Previous Due + Balance = New Balance
 * - Label generation integration: ceil(33/6) = 6 labels
 */

import {
  rupeesToPaise,
  paiseToRupees,
  calculateLineTotalPaise,
  calculateBillFinancials,
  calculateSalesLabelCount,
  generateSalesItemCode
} from '../services/currency';

export function runPhase3QuickBillTests(): { passed: boolean; results: string[] } {
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

  // 1. Line Item Math
  const hypora = calculateLineTotalPaise(12, rupeesToPaise(120));
  assertEqual('HYPORA 12 × ₹120', paiseToRupees(hypora), 1440);

  const club = calculateLineTotalPaise(6, rupeesToPaise(75));
  assertEqual('CLUB 6 × ₹75', paiseToRupees(club), 450);

  const schoolboy = calculateLineTotalPaise(15, rupeesToPaise(145));
  assertEqual('SCHOOLBOY 15 × ₹145', paiseToRupees(schoolboy), 2175);

  // 2. Base Bill: Total Quantity 33, Grand Total ₹4065
  const items = [
    { quantity: 12, ratePaise: rupeesToPaise(120) },
    { quantity: 6, ratePaise: rupeesToPaise(75) },
    { quantity: 15, ratePaise: rupeesToPaise(145) }
  ];

  const baseBill = calculateBillFinancials({ items });
  assertEqual('Total Quantity', baseBill.totalQuantity, 33);
  assertEqual('Subtotal', paiseToRupees(baseBill.subtotalPaise), 4065);
  assertEqual('Grand Total', paiseToRupees(baseBill.grandTotalPaise), 4065);

  // 3. Discount Test: ₹65 off => ₹4000
  const discountBill = calculateBillFinancials({
    items,
    discountPaise: rupeesToPaise(65)
  });
  assertEqual('Bill with ₹65 discount', paiseToRupees(discountBill.grandTotalPaise), 4000);

  // 4. GST & Round Off Test:
  // Base 4065, GST 5% = 203.25 => Raw 4268.25 => Rounded 4268.00 (Round Off = -0.25)
  const gstPaise = Math.round((baseBill.subtotalPaise * 5) / 100);
  const gstBill = calculateBillFinancials({
    items,
    gstPaise
  });
  assertEqual('GST 5% amount', paiseToRupees(gstPaise), 203.25);
  assertEqual('Grand Total with GST rounded to whole rupee', paiseToRupees(gstBill.grandTotalPaise), 4268);
  assertEqual('Round Off paise', gstBill.roundOffPaise, -25);

  // 5. Paid vs Balance & Previous Due
  // Total 4065, Paid 2000 => Balance 2065
  // Previous Due 10000 => New Total Balance 12065
  const paidBill = calculateBillFinancials({
    items,
    paidPaise: rupeesToPaise(2000),
    previousDuePaise: rupeesToPaise(10000)
  });
  assertEqual('Paid amount', paiseToRupees(paidBill.paidPaise), 2000);
  assertEqual('Bill Balance Due', paiseToRupees(paidBill.balancePaise), 2065);
  assertEqual('Previous Due', paiseToRupees(paidBill.previousDuePaise), 10000);
  assertEqual('New Balance', paiseToRupees(paidBill.newBalancePaise), 12065);

  // 6. Label Generation Test for 33 bags
  assertEqual('Labels for 33 bags', calculateSalesLabelCount(33), 6);
  assertEqual('Private Marka Code for Hypora ₹120', generateSalesItemCode(rupeesToPaise(120)), '6120');

  return { passed: allPassed, results };
}
