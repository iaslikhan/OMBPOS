import 'fake-indexeddb/auto';
import { roomDb } from '../src/db/indexedDbRoom';
import { reportsService } from '../src/services/reportsService';
import { paiseToRupees, formatINR } from '../src/services/currency';

console.log('====================================================');
console.log('📊 PHASE 11: REPORTS AND EXPORT ENGINE AUDIT SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string, expected?: any, actual?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${desc} | Expected: ${expected}, Got: ${actual}`);
    failCount++;
  }
}

async function runTests() {
  console.log('1. Database Initialization & Data Layer Verification');
  await roomDb.getDb();
  const bills = await roomDb.getAll('bills');
  const purchases = await roomDb.getAll('purchases');
  const customers = await roomDb.getAll('customers');
  const suppliers = await roomDb.getAll('suppliers');
  const expenses = await roomDb.getAll('expenses');
  const cash = await roomDb.getAll('cash_transactions');
  const products = await roomDb.getAll('products');

  assert(bills.length > 0, 'Seed bills loaded from IndexedDB', '> 0', bills.length);
  assert(purchases.length > 0, 'Seed purchases loaded from IndexedDB', '> 0', purchases.length);
  assert(customers.length > 0, 'Seed customers loaded from IndexedDB', '> 0', customers.length);
  assert(suppliers.length > 0, 'Seed suppliers loaded from IndexedDB', '> 0', suppliers.length);
  assert(expenses.length > 0, 'Seed expenses loaded from IndexedDB', '> 0', expenses.length);
  assert(cash.length > 0, 'Seed cash transactions loaded from IndexedDB', '> 0', cash.length);
  assert(products.length > 0, 'Seed products loaded from IndexedDB', '> 0', products.length);

  console.log('\n2. Sales Report Verification');
  const salesReport = await reportsService.getSalesReport();
  assert(salesReport.totalBills > 0, 'Sales report contains active invoices', '> 0', salesReport.totalBills);
  assert(salesReport.totalPcsSold > 0, 'Sales report total pcs sold is positive', '> 0', salesReport.totalPcsSold);
  assert(salesReport.netSalesPaise > 0, 'Net sales revenue is calculated correctly in paise', '> 0', salesReport.netSalesPaise);
  assert(salesReport.itemBreakdown.length > 0, 'Sales report contains product-wise breakdown', '> 0', salesReport.itemBreakdown.length);
  console.log(`     -> Total Sales: ${formatINR(salesReport.netSalesPaise)} | Pcs: ${salesReport.totalPcsSold}`);

  console.log('\n3. Purchase Report Verification');
  const purchaseReport = await reportsService.getPurchaseReport();
  assert(purchaseReport.totalPurchasesCount > 0, 'Purchase report contains invoices', '> 0', purchaseReport.totalPurchasesCount);
  assert(purchaseReport.totalPcsPurchased > 0, 'Pieces inwarded is positive', '> 0', purchaseReport.totalPcsPurchased);
  assert(purchaseReport.grandTotalPaise > 0, 'Purchase grand total is positive', '> 0', purchaseReport.grandTotalPaise);
  assert(purchaseReport.creditDuePaise >= 0, 'Supplier credit due is calculated', '>= 0', purchaseReport.creditDuePaise);
  console.log(`     -> Total Purchases: ${formatINR(purchaseReport.grandTotalPaise)} | Pcs Inwarded: ${purchaseReport.totalPcsPurchased}`);

  console.log('\n4. Collection Report Verification');
  const collectionReport = await reportsService.getCollectionReport();
  assert(collectionReport.totalCollectedPaise > 0, 'Collections total is positive', '> 0', collectionReport.totalCollectedPaise);
  assert(collectionReport.collections.length > 0, 'Collection individual entries present', '> 0', collectionReport.collections.length);
  console.log(`     -> Total Collections: ${formatINR(collectionReport.totalCollectedPaise)}`);

  console.log('\n5. Outstanding (Receivables & Payables) Report Verification');
  const outstandingReport = await reportsService.getOutstandingReport();
  assert(outstandingReport.totalReceivablesPaise > 0, 'Customer receivables balance is calculated', '> 0', outstandingReport.totalReceivablesPaise);
  assert(outstandingReport.totalPayablesPaise > 0, 'Supplier payables balance is calculated', '> 0', outstandingReport.totalPayablesPaise);
  assert(outstandingReport.customers.length > 0, 'Customer accounts listed with aging', '> 0', outstandingReport.customers.length);
  assert(outstandingReport.suppliers.length > 0, 'Supplier accounts listed', '> 0', outstandingReport.suppliers.length);
  console.log(`     -> Receivables: ${formatINR(outstandingReport.totalReceivablesPaise)} | Payables: ${formatINR(outstandingReport.totalPayablesPaise)}`);

  console.log('\n6. Expenses Report Verification');
  const expensesReport = await reportsService.getExpensesReport();
  assert(expensesReport.totalExpensesCount > 0, 'Expenses count is positive', '> 0', expensesReport.totalExpensesCount);
  assert(expensesReport.totalExpensesPaise > 0, 'Total expenses amount is positive', '> 0', expensesReport.totalExpensesPaise);
  assert(expensesReport.categoryBreakdown.length > 0, 'Category breakdown present', '> 0', expensesReport.categoryBreakdown.length);
  console.log(`     -> Total Expenses: ${formatINR(expensesReport.totalExpensesPaise)} across ${expensesReport.totalExpensesCount} items`);

  console.log('\n7. Cash Report Verification');
  const cashReport = await reportsService.getCashReport();
  assert(cashReport.openingCashPaise > 0, 'Opening cash drawer balance positive', '> 0', cashReport.openingCashPaise);
  assert(cashReport.totalCashInflowPaise >= 0, 'Cash inflows recorded', '>= 0', cashReport.totalCashInflowPaise);
  assert(cashReport.totalCashOutflowPaise >= 0, 'Cash outflows recorded', '>= 0', cashReport.totalCashOutflowPaise);
  assert(cashReport.closingCashPaise === cashReport.openingCashPaise + cashReport.totalCashInflowPaise - cashReport.totalCashOutflowPaise, 'Cash equation holds: Closing = Opening + Inflow - Outflow');
  console.log(`     -> Opening Cash: ${formatINR(cashReport.openingCashPaise)} | Closing Cash: ${formatINR(cashReport.closingCashPaise)}`);

  console.log('\n8. Inventory (Stock & Valuation) Report Verification');
  const inventoryReport = await reportsService.getInventoryReport();
  assert(inventoryReport.totalProductsCount > 0, 'Inventory products count positive', '> 0', inventoryReport.totalProductsCount);
  assert(inventoryReport.totalQuantityPcs > 0, 'Physical inventory stock pcs positive', '> 0', inventoryReport.totalQuantityPcs);
  assert(inventoryReport.totalValuationAtPurchasePaise > 0, 'Cost valuation positive', '> 0', inventoryReport.totalValuationAtPurchasePaise);
  assert(inventoryReport.totalValuationAtWholesalePaise > inventoryReport.totalValuationAtPurchasePaise, 'Wholesale valuation exceeds cost valuation');
  console.log(`     -> Stock: ${inventoryReport.totalQuantityPcs} PCS | Cost Valuation: ${formatINR(inventoryReport.totalValuationAtPurchasePaise)} | Wholesale: ${formatINR(inventoryReport.totalValuationAtWholesalePaise)}`);

  console.log('\n9. Profit & Loss Report Verification');
  const profitReport = await reportsService.getProfitLossReport();
  assert(profitReport.netSalesRevenuePaise > 0, 'Revenue is recorded', '> 0', profitReport.netSalesRevenuePaise);
  assert(profitReport.costOfGoodsSoldPaise > 0, 'COGS is calculated', '> 0', profitReport.costOfGoodsSoldPaise);
  assert(profitReport.grossProfitPaise === profitReport.netSalesRevenuePaise - profitReport.costOfGoodsSoldPaise, 'Gross Profit equals Net Sales - COGS');
  assert(profitReport.netProfitPaise === profitReport.grossProfitPaise - profitReport.operatingExpensesPaise, 'Net Profit equals Gross Profit - Operating Expenses');
  console.log(`     -> Revenue: ${formatINR(profitReport.netSalesRevenuePaise)} | COGS: ${formatINR(profitReport.costOfGoodsSoldPaise)} | Gross: ${formatINR(profitReport.grossProfitPaise)} | Net: ${formatINR(profitReport.netProfitPaise)}`);

  console.log('\n10. Mathematical Invariant Consistency Audit Against DB Records');
  const audit = await reportsService.verifyConsistency();
  assert(audit.allPassed, 'All mathematical consistency checks passed 100%', true, audit.allPassed);
  assert(audit.failedTests === 0, 'Zero failed consistency tests', 0, audit.failedTests);
  for (const check of audit.checks) {
    assert(check.passed, `[${check.report}] ${check.invariant}`);
  }

  console.log('\n11. Share Text Generation');
  const shareText = reportsService.generateShareableReportText('SALES', salesReport);
  assert(shareText.includes('ORIGINAL MODI BAGS'), 'Share text contains company name');
  assert(shareText.includes('SALES STATEMENT'), 'Share text contains report title');
  assert(shareText.includes('Total Invoices'), 'Share text contains total invoices metric');

  console.log('\n====================================================');
  console.log(`Audit Summary: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
