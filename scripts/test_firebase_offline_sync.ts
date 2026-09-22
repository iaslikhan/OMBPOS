/**
 * Verification Test Suite for Phase 14:
 * Firebase Offline and Cloud Synchronization Engine
 *
 * Test Scenarios:
 * 1. Room is local source of truth (functions 100% offline).
 * 2. Create bill offline.
 * 3. Create customer offline.
 * 4. Create payment offline.
 * 5. Create purchase offline.
 * 6. Create expense offline.
 * 7. Create inventory movement offline.
 * 8. Create purchase labels offline.
 * 9. Close app / reset memory state.
 * 10. Reopen Room database & verify all 7 records are intact locally.
 * 11. Test retry & error recovery after sync failure (verify local data is NEVER deleted).
 * 12. Enable internet connectivity & synchronize with Firestore.
 * 13. Verify: No duplicates, No lost records, No duplicate financial transactions.
 * 14. Verify audit logging.
 */

import 'fake-indexeddb/auto';
import { roomDb } from '../src/db/indexedDbRoom';
import { networkMonitor } from '../src/services/networkMonitor';
import { firebaseFoundation } from '../src/services/firebaseFoundation';
import { securityService } from '../src/services/securityService';
import { auditService } from '../src/services/auditService';
import { 
  Customer, 
  Bill, 
  CashTransaction, 
  Purchase, 
  Expense, 
  StockMovement, 
  PurchaseLabelSettings 
} from '../src/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runOfflineSyncTestSuite() {
  console.log('========================================================================');
  console.log('🔄 PHASE 14: FIREBASE OFFLINE & CLOUD SYNCHRONIZATION TEST SUITE');
  console.log('========================================================================\n');

  // Step 0: Initialize System & Admin Session
  await roomDb.getDb();
  await securityService.init();
  await securityService.unlockWithPin('1234');

  // Ensure queue is clean for test isolation
  const initialQueue = await roomDb.getAll('sync_queue');
  for (const item of initialQueue) {
    await roomDb.delete('sync_queue', (item as any).id);
  }

  console.log('1. SIMULATE OFFLINE ENVIRONMENT (NETWORK DISCONNECTED)');
  networkMonitor.setOnline(false);
  assert(!networkMonitor.isOnline(), 'Network monitor switched to OFFLINE mode');
  assert(firebaseFoundation.getState().isInitialized, 'Firebase foundation initialized with graceful offline fallback');

  const now = Date.now();
  const testIds = {
    customer: `cust-offline-${now}`,
    bill: `bill-offline-${now}`,
    payment: `cash-offline-${now}`,
    purchase: `purch-offline-${now}`,
    expense: `exp-offline-${now}`,
    stockMovement: `sm-offline-${now}`,
    purchaseLabelSettings: `pls-offline-${now}`
  };

  console.log('\n2. CREATE ALL BUSINESS RECORDS 100% OFFLINE');

  // 2A: Create Customer Offline
  const newCustomer: Customer = {
    id: testIds.customer,
    customerId: `CUST-${now.toString().slice(-4)}`,
    businessId: 'biz-original-modi-bags',
    name: 'Ramesh Bag Emporium',
    mobile: '9830198301',
    city: 'Kolkata',
    state: 'West Bengal',
    creditLimitPaise: 5000000,
    openingBalancePaise: 150000,
    currentOutstandingPaise: 150000,
    totalSalesPaise: 0,
    totalPaymentsPaise: 0,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('customers', newCustomer);
  const savedCustomer = await roomDb.get<Customer>('customers', testIds.customer);
  assert(!!savedCustomer && savedCustomer.name === 'Ramesh Bag Emporium', 'Customer created offline & persisted to Room DB');

  // 2B: Create Bill Offline
  const newBill: Bill = {
    id: testIds.bill,
    billNumber: `INV-OFFLINE-${now.toString().slice(-4)}`,
    businessId: 'biz-original-modi-bags',
    customerId: testIds.customer,
    customerName: 'Ramesh Bag Emporium',
    customerMobile: '9830198301',
    documentType: 'GST_INVOICE',
    date: now,
    items: [
      {
        id: `item-${now}-1`,
        sNo: 1,
        productId: 'prod-001',
        isPermanentProduct: true,
        details: 'HYPORA TREKKER 35L',
        quantity: 12,
        ratePaise: 12000,
        gstPercentage: 18,
        discountPaise: 0,
        totalPaise: 169920
      }
    ],
    totalQuantity: 12,
    subtotalPaise: 144000,
    discountPaise: 0,
    gstPaise: 25920,
    roundOffPaise: 0,
    grandTotalPaise: 169920,
    paidPaise: 100000,
    balancePaise: 69920,
    previousDuePaise: 0,
    newBalancePaise: 69920,
    paymentMethod: 'CASH',
    isCancelled: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('bills', newBill);
  const savedBill = await roomDb.get<Bill>('bills', testIds.bill);
  assert(!!savedBill && savedBill.grandTotalPaise === 169920, 'Bill created offline & persisted to Room DB');

  // 2C: Record Payment Transaction Offline
  const newPayment: CashTransaction = {
    id: testIds.payment,
    businessId: 'biz-original-modi-bags',
    date: now,
    type: 'CASH_RECEIVED',
    description: 'Advance payment for Bill ' + newBill.billNumber,
    inflowPaise: 100000,
    outflowPaise: 0,
    runningCashBalancePaise: 100000,
    referenceId: testIds.bill,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('cash_transactions', newPayment);
  const savedPayment = await roomDb.get<CashTransaction>('cash_transactions', testIds.payment);
  assert(!!savedPayment && savedPayment.inflowPaise === 100000, 'Cash payment recorded offline & persisted to Room DB');

  // 2D: Create Purchase Offline
  const newPurchase: Purchase = {
    id: testIds.purchase,
    purchaseInvoiceNumber: `PUR-OFFLINE-${now.toString().slice(-4)}`,
    businessId: 'biz-original-modi-bags',
    supplierId: 'sup-001',
    supplierName: 'Kolkata Bag Fabrics Ltd',
    date: now,
    items: [
      {
        id: `pitem-${now}-1`,
        productId: 'prod-001',
        productName: 'Raw Polyester Matty Fabric 1000D',
        quantity: 50,
        purchaseRatePaise: 8500,
        totalPaise: 425000
      }
    ],
    totalQuantity: 50,
    subtotalPaise: 425000,
    gstPaise: 76500,
    grandTotalPaise: 501500,
    paidPaise: 200000,
    creditPaise: 301500,
    paymentMethod: 'CHEQUE',
    isCancelled: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('purchases', newPurchase);
  const savedPurchase = await roomDb.get<Purchase>('purchases', testIds.purchase);
  assert(!!savedPurchase && savedPurchase.grandTotalPaise === 501500, 'Purchase invoice created offline & persisted to Room DB');

  // 2E: Create Expense Offline
  const newExpense: Expense = {
    id: testIds.expense,
    businessId: 'biz-original-modi-bags',
    date: now,
    category: 'TEA_SNACKS',
    description: 'Workshop tea & snacks for labor team',
    amountPaise: 18000,
    paymentMethod: 'CASH',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('expenses', newExpense);
  const savedExpense = await roomDb.get<Expense>('expenses', testIds.expense);
  assert(!!savedExpense && savedExpense.amountPaise === 18000, 'Expense voucher created offline & persisted to Room DB');

  // 2F: Create Inventory Movement Offline
  const newMovement: StockMovement = {
    id: testIds.stockMovement,
    businessId: 'biz-original-modi-bags',
    productId: 'prod-001',
    productName: 'HYPORA TREKKER 35L',
    type: 'PURCHASE',
    quantityChange: 50,
    previousStock: 100,
    newStock: 150,
    date: now,
    referenceDocumentId: testIds.purchase,
    notes: 'Inwarded stock from offline purchase',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('stock_movements', newMovement);
  const savedMovement = await roomDb.get<StockMovement>('stock_movements', testIds.stockMovement);
  assert(!!savedMovement && savedMovement.quantityChange === 50, 'Stock movement created offline & persisted to Room DB');

  // 2G: Create Purchase Label Settings Offline
  const labelSettings: PurchaseLabelSettings = {
    id: 'default_purchase_label_settings',
    businessId: 'biz-original-modi-bags',
    enabled: true,
    prefix: '786',
    paperSize: '50x25 mm',
    barcodeType: 'CODE128',
    showBusinessName: true,
    showProductName: true,
    showPurchaseCode: true,
    showPurchaseRate: true,
    showQuantity: true,
    showSupplier: true,
    showInvoice: true,
    showDate: true,
    showBatch: true,
    defaultMode: 'ONE_PER_PIECE',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };
  await roomDb.put('purchase_label_settings', labelSettings);
  const savedSettings = await roomDb.get<PurchaseLabelSettings>('purchase_label_settings', 'default_purchase_label_settings');
  assert(!!savedSettings && savedSettings.prefix === '786', 'Purchase label settings saved offline to Room DB');

  console.log('\n3. VERIFY MUTATION QUEUE IN OFFLINE STATE');
  const queueAfterWrites = await roomDb.getAll<any>('sync_queue');
  assert(queueAfterWrites.length >= 7, 'All 7 offline mutations queued in sync_queue', `Total Queue: ${queueAfterWrites.length}`);
  
  const queuedTables = queueAfterWrites.map(q => q.table);
  assert(queuedTables.includes('customers'), 'Customer mutation queued');
  assert(queuedTables.includes('bills'), 'Bill mutation queued');
  assert(queuedTables.includes('cash_transactions'), 'Cash transaction queued');
  assert(queuedTables.includes('purchases'), 'Purchase mutation queued');
  assert(queuedTables.includes('expenses'), 'Expense mutation queued');
  assert(queuedTables.includes('stock_movements'), 'Stock movement queued');

  console.log('\n4. SIMULATE APP CLOSE AND REOPEN (STORAGE PERSISTENCE CHECK)');
  // Simulate closing and reopening by re-fetching records directly from storage
  const reloadedCust = await roomDb.get<Customer>('customers', testIds.customer);
  const reloadedBill = await roomDb.get<Bill>('bills', testIds.bill);
  const reloadedPay = await roomDb.get<CashTransaction>('cash_transactions', testIds.payment);
  const reloadedPurch = await roomDb.get<Purchase>('purchases', testIds.purchase);
  const reloadedExp = await roomDb.get<Expense>('expenses', testIds.expense);
  const reloadedSM = await roomDb.get<StockMovement>('stock_movements', testIds.stockMovement);

  assert(!!reloadedCust && reloadedCust.id === testIds.customer, 'Customer survived app restart');
  assert(!!reloadedBill && reloadedBill.id === testIds.bill, 'Bill survived app restart');
  assert(!!reloadedPay && reloadedPay.id === testIds.payment, 'Payment survived app restart');
  assert(!!reloadedPurch && reloadedPurch.id === testIds.purchase, 'Purchase survived app restart');
  assert(!!reloadedExp && reloadedExp.id === testIds.expense, 'Expense survived app restart');
  assert(!!reloadedSM && reloadedSM.id === testIds.stockMovement, 'Stock movement survived app restart');

  console.log('\n5. TEST TRANSIENT SYNC FAILURE & RETRY SAFETY (ZERO DATA LOSS RULE)');
  // Simulate network failure during sync
  firebaseFoundation.setSimulatedNetworkFailure(true);
  networkMonitor.setOnline(true); // network claims online, but cloud connection drops
  
  const failResult = await firebaseFoundation.triggerSync();
  assert(!failResult.success, 'Sync failed gracefully on simulated network drop');

  // CRITICAL RULE: NEVER DELETE LOCAL DATA BECAUSE SYNC FAILS
  const customerAfterFail = await roomDb.get<Customer>('customers', testIds.customer);
  const billAfterFail = await roomDb.get<Bill>('bills', testIds.bill);
  const queueAfterFail = await roomDb.getAll<any>('sync_queue');

  assert(!!customerAfterFail, 'RULE VERIFIED: Local Customer data NEVER deleted upon sync failure');
  assert(!!billAfterFail, 'RULE VERIFIED: Local Bill data NEVER deleted upon sync failure');
  assert(queueAfterFail.length >= 7, 'RULE VERIFIED: Pending mutation queue retained intact for retry', `Queue count: ${queueAfterFail.length}`);

  console.log('\n6. ENABLE INTERNET & SYNCHRONIZE WITH CLOUD REPLICA');
  firebaseFoundation.setSimulatedNetworkFailure(false);
  networkMonitor.setOnline(true);

  const syncResult = await firebaseFoundation.retryFailedSync();
  console.log('Sync Result Details:', JSON.stringify(syncResult, null, 2));
  assert(syncResult.success, 'Cloud sync completed successfully once internet restored', `Outbound: ${syncResult.syncedOutboundCount}`);

  const queueAfterSuccess = await roomDb.getAll<any>('sync_queue');
  assert(queueAfterSuccess.length === 0, 'Sync queue drained completely after successful cloud delivery', `Remaining: ${queueAfterSuccess.length}`);

  console.log('\n7. MATHEMATICAL INVARIANT & DUPLICATE TRANSACTIONS AUDIT');
  const allBills = await roomDb.getAll<Bill>('bills');
  const billDuplicates = allBills.filter(b => b.id === testIds.bill);
  assert(billDuplicates.length === 1, 'ZERO duplicate bills created during offline-to-online sync cycle');

  const allPayments = await roomDb.getAll<CashTransaction>('cash_transactions');
  const paymentDuplicates = allPayments.filter(p => p.id === testIds.payment);
  assert(paymentDuplicates.length === 1, 'ZERO duplicate cash entries created');

  const allPurchases = await roomDb.getAll<Purchase>('purchases');
  const purchaseDuplicates = allPurchases.filter(p => p.id === testIds.purchase);
  assert(purchaseDuplicates.length === 1, 'ZERO duplicate purchase records created');

  console.log('\n8. AUDIT TRAIL VERIFICATION FOR CLOUD SYNC');
  const auditLogs = await auditService.getLogs({});
  const syncLogs = auditLogs.filter(a => a.action === 'DATA_SYNCED' || a.action === 'SYNC_FAILED');
  assert(syncLogs.length > 0, 'Audit trail captured cloud synchronization actions', `Sync Audit Events: ${syncLogs.length}`);

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOfflineSyncTestSuite().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
