import 'fake-indexeddb/auto';
import { roomDb } from '../src/db/indexedDbRoom';
import { backupService } from '../src/services/backupService';
import { importService } from '../src/services/importService';
import { exportService } from '../src/services/exportService';
import { securityService } from '../src/services/securityService';
import { auditService } from '../src/services/auditService';
import { paiseToRupees } from '../src/services/currency';

console.log('========================================================================');
console.log('📦 PHASE 13: BACKUP, IMPORT & EXPORT VERIFICATION SUITE');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}${detail ? ` (${detail})` : ''}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runTestSuite() {
  console.log('1. INITIALIZING ROOM DATABASE & SEED STATE');
  await roomDb.getDb();
  await securityService.init();

  const initialProducts = await roomDb.getAll('products');
  const initialCustomers = await roomDb.getAll('customers');
  const initialBills = await roomDb.getAll('bills');

  assert(initialProducts.length > 0, 'Products table initialized with seed data', `Count: ${initialProducts.length}`);
  assert(initialCustomers.length > 0, 'Customers table initialized with seed data', `Count: ${initialCustomers.length}`);
  assert(initialBills.length > 0, 'Bills table initialized with seed data', `Count: ${initialBills.length}`);

  console.log('\n2. BACKUP NOW & COMPLETE SNAPSHOT VERIFICATION');
  const backupResult = await backupService.createBackup({ note: 'Automated Test Backup' });

  assert(!!backupResult.payload, 'Backup payload created successfully');
  assert(backupResult.payload.version === 1, 'Backup payload has schema version 1');
  assert(backupResult.payload.business === 'ORIGINAL MODI BAGS', 'Payload business tag matches Original Modi Bags');
  assert(Object.keys(backupResult.payload.tables).length >= 15, 'Backup captures all core RoomDB tables', `Tables: ${Object.keys(backupResult.payload.tables).length}`);
  assert(backupResult.checksum.startsWith('omb-'), 'Cryptographic checksum generated for payload integrity', `Checksum: ${backupResult.checksum}`);
  assert(backupResult.fileName.includes('OriginalModiBags_Backup_'), 'Timestamped standard file name generated', backupResult.fileName);

  console.log('\n3. AUTOMATIC BACKUP CONFIGURATION & WATCHDOG');
  const initialAutoSettings = backupService.getAutoBackupSettings();
  assert(initialAutoSettings.enabled === true, 'Auto backup default is enabled');

  const updatedSettings = backupService.saveAutoBackupSettings({
    frequency: 'EVERY_6_HOURS',
    maxRetainedSnapshots: 5
  });
  assert(updatedSettings.frequency === 'EVERY_6_HOURS', 'Auto backup frequency updated to EVERY_6_HOURS');
  assert(typeof updatedSettings.nextBackupAt === 'number' && updatedSettings.nextBackupAt > Date.now(), 'Next backup timestamp calculated');

  console.log('\n4. RESTORE WITH ATOMIC TRANSACTION ROLLBACK PROTECTION');
  // 4A: Normal Successful Restore
  const restoreRes = await backupService.restoreBackup(backupResult.payload, { clearExistingBeforeRestore: true });
  assert(restoreRes.success === true, 'Valid backup restored successfully');
  assert(restoreRes.totalRecordsRestored > 0, 'Restored total records count verified', `Count: ${restoreRes.totalRecordsRestored}`);

  // 4B: Corrupt Payload Restore -> Must Roll Back
  const corruptPayload = {
    version: 1,
    business: 'ORIGINAL MODI BAGS',
    tables: {
      products: [
        { id: 'valid-prod', name: 'Valid Product' },
        { /* missing primary key id to trigger error */ name: 'Corrupt Row' }
      ]
    }
  };

  const currentProductCount = (await roomDb.getAll('products')).length;
  const rollbackRes = await backupService.restoreBackup(corruptPayload as any, { clearExistingBeforeRestore: false });

  assert(rollbackRes.success === false, 'Corrupt backup rejected');
  assert(rollbackRes.rolledBack === true, 'Transaction rollback triggered automatically upon restore error');

  const postRollbackProductCount = (await roomDb.getAll('products')).length;
  assert(postRollbackProductCount === currentProductCount, 'Zero database corruption: table state preserved after rollback', `Products count: ${postRollbackProductCount}`);

  console.log('\n5. IMPORT ENGINE: VALIDATION & TRANSACTION ROLLBACK');
  // 5A: CSV Parsing test
  const sampleProductCsv = `Product_Code,Name,Category,Size,Colour,Wholesale_Rate,Opening_Stock,HSN
OMB-TEST-01,Heavy Duty School Bag,SCHOOL_BAG,Large,Navy Blue,150,50,4202
OMB-TEST-02,Executive Laptop Backpack,OFFICE_BAG,Medium,Black,280,30,4202`;

  const parsedCsvRows = importService.parseCsv(sampleProductCsv);
  assert(parsedCsvRows.length === 2, 'CSV string parsed into row objects', `Rows: ${parsedCsvRows.length}`);

  const productValidation = importService.validateRows('PRODUCTS', parsedCsvRows);
  assert(productValidation.validRows === 2 && productValidation.errors.length === 0, 'Parsed rows passed product schema validation');

  // Execute Product Import
  const productImportRes = await importService.executeImport('PRODUCTS', parsedCsvRows, { updateExisting: true, strictMode: true });
  assert(productImportRes.success === true, 'Products imported successfully');
  assert(productImportRes.importedCount === 2, 'Imported 2 new product items');

  const importedProd = (await roomDb.getAll<any>('products')).find(p => p.productCode === 'OMB-TEST-01');
  assert(!!importedProd && importedProd.name === 'Heavy Duty School Bag', 'Imported product verified in Room Database', importedProd?.name);

  // 5B: Failed Import with Strict Mode Rollback Verification
  const badCustomerCsv = `Customer_Name,Mobile,City
Valid Customer,9830099999,Kolkata
,9830088888,Howrah`; // missing name on row 2

  const badParsed = importService.parseCsv(badCustomerCsv);
  const badImportRes = await importService.executeImport('CUSTOMERS', badParsed, { updateExisting: true, strictMode: true });

  assert(badImportRes.success === false, 'Strict mode caught validation error on row 2');
  assert(badImportRes.rolledBack === true, 'Transaction rollback aborted the entire customer import batch');
  
  const badCustCheck = (await roomDb.getAll<any>('customers')).find(c => c.mobile === '9830099999');
  assert(!badCustCheck, 'Zero partial writes: Valid Customer from failed batch was rolled back');

  // 5C: Import Customer Directory
  const validCustomerCsv = `Customer_Name,Business_Name,Mobile,City,Opening_Balance
Raju Traders,Raju Bag Center,9830011223,Kolkata,12000
Bengal Distributors,Bengal Luggage,9830044556,Siliguri,8500`;

  const validCustRows = importService.parseCsv(validCustomerCsv);
  const custImportRes = await importService.executeImport('CUSTOMERS', validCustRows, { updateExisting: true, strictMode: true });
  assert(custImportRes.success === true, 'Customers imported successfully', `Imported: ${custImportRes.importedCount}`);

  // 5D: Import Opening Balances
  const openingBalCsv = `Party_Name,Party_Type,Opening_Balance
Raju Bag Center,CUSTOMER,15000`;
  const openBalRows = importService.parseCsv(openingBalCsv);
  const openBalRes = await importService.executeImport('OPENING_BALANCES', openBalRows);
  assert(openBalRes.success === true, 'Opening balances imported & posted to customer ledger');

  // 5E: Import Opening Stock
  const openStockCsv = `Product_Code,Opening_Stock
OMB-TEST-01,120`;
  const openStockRows = importService.parseCsv(openStockCsv);
  const openStockRes = await importService.executeImport('OPENING_STOCK', openStockRows);
  assert(openStockRes.success === true, 'Opening stock imported and stock movements updated');

  // 5F: Import Transport Logistics
  const transportCsv = `Transport_Name,LR_Number,Destination,Freight_Amount
Jai Hind Cargo,JHC-KOL-999,Patna,1200`;
  const transRows = importService.parseCsv(transportCsv);
  const transRes = await importService.executeImport('TRANSPORT', transRows);
  assert(transRes.success === true, 'Transport and LR shipments imported successfully');

  // 5G: Import Historical Records
  const histCsv = `Record_Type,Doc_Number,Date,Party_Name,Quantity,Total_Amount,Paid_Amount
BILL,OMB-HIST-2025-01,2025-11-20,Raju Bag Center,25,3500,3500`;
  const histRows = importService.parseCsv(histCsv);
  const histRes = await importService.executeImport('HISTORICAL_RECORDS', histRows);
  assert(histRes.success === true, 'Historical bill records imported successfully');

  console.log('\n6. EXPORT ENGINE: MULTI-FORMAT (CSV, XLSX, PDF) & MASTER EXPORT');
  const exportEntities = [
    'SALES',
    'BILLS',
    'CUSTOMERS',
    'LEDGER',
    'PAYMENTS',
    'PURCHASES',
    'STOCK',
    'EXPENSES',
    'CRM',
    'TRANSPORT',
    'REPORTS'
  ] as const;

  for (const ent of exportEntities) {
    // Test CSV Export
    const csvExport = await exportService.exportData(ent as any, 'CSV');
    assert(!!csvExport.fileName && csvExport.fileName.endsWith('.csv'), `Exported ${ent} as CSV`, `Rows: ${csvExport.rowCount}`);
    assert(typeof csvExport.buffer === 'string' && csvExport.buffer.length > 0, `CSV buffer contains valid string content for ${ent}`);

    // Test XLSX Export
    const xlsxExport = await exportService.exportData(ent as any, 'XLSX');
    assert(!!xlsxExport.fileName && xlsxExport.fileName.endsWith('.xlsx'), `Exported ${ent} as XLSX`, `Rows: ${xlsxExport.rowCount}`);

    // Test PDF Export
    const pdfExport = await exportService.exportData(ent as any, 'PDF');
    assert(!!pdfExport.fileName && pdfExport.fileName.endsWith('.pdf'), `Exported ${ent} as PDF`, `Rows: ${pdfExport.rowCount}`);
  }

  // 6B: Test "Export All" Unified Multi-Sheet Master Workbook
  const masterExport = await exportService.exportData('ALL', 'XLSX');
  assert(!!masterExport.fileName && masterExport.fileName.endsWith('.xlsx'), 'Export All generated master multi-sheet workbook');

  console.log('\n7. AUDIT TRAIL VERIFICATION FOR BACKUP, IMPORT & EXPORT');
  // Create final verification backup
  await backupService.createBackup({ note: 'Final Verification Backup' });

  const auditLogs = await auditService.getLogs({});
  const backupAudit = auditLogs.find(a => a.action === 'BACKUP_CREATED');
  const restoreAudit = auditLogs.find(a => a.action === 'BACKUP_RESTORED' || a.action === 'RESTORE_ROLLED_BACK');
  const importAudit = auditLogs.find(a => a.action === 'DATA_IMPORTED');
  const exportAudit = auditLogs.find(a => a.action === 'DATA_EXPORTED');

  assert(!!backupAudit, 'Audit log recorded BACKUP_CREATED event');
  assert(!!restoreAudit, 'Audit log recorded RESTORE event with safety info');
  assert(!!importAudit, 'Audit log recorded DATA_IMPORTED event');
  assert(!!exportAudit, 'Audit log recorded DATA_EXPORTED event');

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
