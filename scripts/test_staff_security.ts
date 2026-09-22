import 'fake-indexeddb/auto';
import { roomDb } from '../src/db/indexedDbRoom';
import { securityService, SecurityPermissionError } from '../src/services/securityService';
import { auditService } from '../src/services/auditService';
import { processAtomicPurchase } from '../src/services/purchaseService';
import { recordStockMovement } from '../src/services/inventoryService';
import { RoleType, StaffPermissions, RoleDefinition } from '../src/types';

console.log('========================================================================');
console.log('🛡️ PHASE 12: STAFF, RBAC, PIN SECURITY, AUDIT & BYPASS VERIFICATION SUITE');
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
  console.log('1. INITIALIZATION & SEEDING OF ROLES AND STAFF');
  await roomDb.getDb();
  await securityService.init();

  const roles = await securityService.getAllRoles();
  assert(roles.length >= 4, 'Standard system roles seeded (Admin, Manager, Billing, Inventory)', `Found: ${roles.length}`);
  
  const adminRole = roles.find(r => r.roleType === 'ADMIN');
  const managerRole = roles.find(r => r.roleType === 'MANAGER');
  const billingRole = roles.find(r => r.roleType === 'BILLING');
  const inventoryRole = roles.find(r => r.roleType === 'INVENTORY');

  assert(!!adminRole && !!managerRole && !!billingRole && !!inventoryRole, 'All 4 standard roles exist');
  assert(adminRole?.permissions.canAccessSecurity === true, 'Admin has full security permissions');
  assert(adminRole?.permissions.canAccessReports === true, 'Admin has report permissions');
  assert(billingRole?.permissions.canAccessReports === false, 'Billing staff forbidden from accessing reports');
  assert(billingRole?.permissions.canAccessSecurity === false, 'Billing staff forbidden from accessing security');
  assert(billingRole?.permissions.canAccessPurchases === false, 'Billing staff forbidden from purchasing');
  assert(billingRole?.permissions.canCancelBill === false, 'Billing staff forbidden from cancelling bills');
  assert(inventoryRole?.permissions.canAccessBilling === false, 'Inventory staff forbidden from billing counter');
  assert(inventoryRole?.permissions.canAccessInventory === true, 'Inventory staff allowed to access inventory');

  console.log('\n2. CUSTOM ROLE CREATION & PERMISSION CUSTOMIZATION');
  const customPermissions: StaffPermissions = {
    canAccessBilling: false,
    canAccessCustomers: false,
    canAccessInventory: false,
    canAccessPurchases: false,
    canAccessSuppliers: false,
    canAccessExpenses: false,
    canAccessCash: false,
    canAccessReports: true,
    canAccessProfitLoss: true,
    canAccessTransport: false,
    canAccessCRM: false,
    canAccessPrinting: true,
    canAccessLabels: false,
    canAccessStaff: false,
    canAccessSecurity: false,
    canAccessAuditLog: true,
    canAccessBackup: true,
    canAccessSettings: false,
    canDiscountBill: false,
    canCancelBill: false,
    canViewCostPrice: true,
    canEditProduct: false,
    canDeleteRecord: false,
    canExportData: true,
    canWipeData: false,
    canManageRoles: false
  };

  const customRole: RoleDefinition = {
    id: 'role-audit-checker',
    businessId: 'biz-original-modi-bags',
    roleType: 'CUSTOM' as RoleType,
    name: 'Auditor / Chartered Accountant',
    description: 'Read-only access to reports and audit logs for statutory tax filing',
    isSystemRole: false,
    permissions: customPermissions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  };

  await securityService.saveRole(customRole);
  const fetchedCustomRole = (await securityService.getAllRoles()).find(r => r.id === 'role-audit-checker');

  assert(!!fetchedCustomRole, 'Created Custom Role: Auditor / Chartered Accountant');
  assert(fetchedCustomRole?.permissions.canAccessReports === true && fetchedCustomRole?.permissions.canAccessBilling === false, 'Custom role has distinct permission matrix');

  console.log('\n3. STAFF ACCOUNTS, PIN & BIOMETRIC AUTHENTICATION');
  const allStaff = await securityService.getAllStaff();
  assert(allStaff.length >= 4, 'Default staff accounts created', `Count: ${allStaff.length}`);

  const adminStaff = allStaff.find(s => s.role === 'ADMIN' || s.roleType === 'ADMIN');
  const billingStaff = allStaff.find(s => s.role === 'BILLING' || s.roleType === 'BILLING' || s.role === 'SALES');
  const inventoryStaff = allStaff.find(s => s.role === 'INVENTORY_STAFF' || (s.role as string) === 'INVENTORY' || s.roleType === 'INVENTORY');

  assert(!!adminStaff && adminStaff.name === 'Mukesh Modi', 'Admin staff is Mukesh Modi');
  assert(!!billingStaff && billingStaff.name.includes('Ramu'), 'Billing staff is Ramu');

  // Test PIN authentication
  const wrongPinResult = await securityService.unlockWithPin('0000', adminStaff!.id);
  assert(wrongPinResult.success === false, 'Incorrect PIN rejected with error message');

  const correctPinResult = await securityService.unlockWithPin('1234', adminStaff!.id);
  assert(correctPinResult.success === true, 'Correct PIN (1234) unlocks terminal');
  assert(securityService.getActiveStaff()?.id === adminStaff!.id, 'Active staff is now Admin (Mukesh Modi)');
  assert(securityService.isSessionLocked() === false, 'Terminal session is unlocked');

  // Test Biometric Unlock
  await securityService.lockSession('Testing Lock');
  assert(securityService.isSessionLocked() === true, 'Terminal lock active');
  const bioResult = await securityService.unlockWithBiometric(billingStaff!.id);
  assert(bioResult.success === true, 'Biometric fingerprint unlock successful');
  assert(securityService.getActiveStaff()?.id === billingStaff!.id, 'Switched active cashier to Ramu (Billing)');

  console.log('\n4. DIRECT NAVIGATION GUARDS (UI RESTRICTION VERIFICATION)');
  // Ramu (Billing Staff) is currently logged in!
  const billingAllowedBill = securityService.canAccessRoute('BILLING');
  assert(billingAllowedBill.allowed === true, 'Billing staff can navigate to BILLING route');

  const billingAllowedCust = securityService.canAccessRoute('CUSTOMERS');
  assert(billingAllowedCust.allowed === true, 'Billing staff can navigate to CUSTOMERS route');

  const billingBlockedReports = securityService.canAccessRoute('REPORTS');
  assert(billingBlockedReports.allowed === false, 'Billing staff BLOCKED from REPORTS direct navigation', billingBlockedReports.reason);

  const billingBlockedSecurity = securityService.canAccessRoute('SECURITY');
  assert(billingBlockedSecurity.allowed === false, 'Billing staff BLOCKED from SECURITY direct navigation', billingBlockedSecurity.reason);

  const billingBlockedPurchase = securityService.canAccessRoute('PURCHASE');
  assert(billingBlockedPurchase.allowed === false, 'Billing staff BLOCKED from PURCHASE direct navigation', billingBlockedPurchase.reason);

  const billingBlockedAudit = securityService.canAccessRoute('AUDIT_LOG');
  assert(billingBlockedAudit.allowed === false, 'Billing staff BLOCKED from AUDIT_LOG direct navigation', billingBlockedAudit.reason);

  const billingBlockedStaff = securityService.canAccessRoute('STAFF');
  assert(billingBlockedStaff.allowed === false, 'Billing staff BLOCKED from STAFF direct navigation', billingBlockedStaff.reason);

  // Switch to Gopal (Inventory Staff)
  await securityService.setActiveStaff(inventoryStaff!.id);
  const invBlockedBilling = securityService.canAccessRoute('BILLING');
  assert(invBlockedBilling.allowed === false, 'Inventory staff BLOCKED from BILLING direct navigation');

  const invAllowedInventory = securityService.canAccessRoute('INVENTORY');
  assert(invAllowedInventory.allowed === true, 'Inventory staff allowed on INVENTORY route');

  console.log('\n5. BUSINESS LOGIC BYPASS PREVENTION VERIFICATION');
  // Attempt 1: Restricted staff (Gopal) trying to assert billing access
  let bypass1Failed = false;
  try {
    securityService.assertPermission('canAccessBilling', 'Execute unauthorized sale');
  } catch (err: any) {
    if (err instanceof SecurityPermissionError) {
      bypass1Failed = true;
    }
  }
  assert(bypass1Failed, 'Direct assertPermission blocked unauthorized execution with SecurityPermissionError');

  // Attempt 2: Switch to Ramu (Billing) and attempt to execute processAtomicPurchase directly
  await securityService.setActiveStaff(billingStaff!.id);
  const suppliers = await roomDb.getAll('suppliers');
  assert(suppliers.length > 0, 'Found test supplier');

  let purchaseBypassBlocked = false;
  try {
    await processAtomicPurchase({
      supplierId: suppliers[0].id,
      purchaseInvoiceNumber: 'HACK-PUR-999',
      items: [
        {
          id: 'item-hack-1',
          productName: 'HYPORA',
          quantity: 100,
          purchaseRatePaise: 9000,
          totalPaise: 900000
        }
      ],
      paymentMethod: 'CASH',
      paidPaise: 0
    });
  } catch (err: any) {
    if (err instanceof SecurityPermissionError) {
      purchaseBypassBlocked = true;
    }
  }
  assert(purchaseBypassBlocked, 'Restricted Billing Staff blocked from processAtomicPurchase business logic');

  // Verify that NO bogus purchase was written to the database!
  const hackedPurchases = (await roomDb.getAll<any>('purchases')).filter(p => p.purchaseInvoiceNumber === 'HACK-PUR-999');
  assert(hackedPurchases.length === 0, 'Zero state corruption: database contains NO unauthorized purchase record');

  // Attempt 3: Ramu (Billing) trying to apply manual stock adjustment (requires canEditProduct)
  let stockAdjustBypassBlocked = false;
  try {
    await recordStockMovement({
      productId: 'prod-hypora',
      type: 'MANUAL_ADJUSTMENT',
      quantity: 50,
      notes: 'Unauthorized stock change'
    });
  } catch (err: any) {
    if (err instanceof SecurityPermissionError) {
      stockAdjustBypassBlocked = true;
    }
  }
  assert(stockAdjustBypassBlocked, 'Restricted Billing Staff blocked from manual inventory adjustment');

  console.log('\n6. SUPERVISOR & ADMIN OVERRIDE VERIFICATION');
  // Ramu needs supervisor override for an emergency task
  const overrideWithWrongPin = await securityService.verifyAdminOverride('9999', 'Emergency override');
  assert(overrideWithWrongPin === false, 'Wrong supervisor PIN rejected for override');

  const overrideWithAdminPin = await securityService.verifyAdminOverride('1234', 'Authorized manager override');
  assert(overrideWithAdminPin === true, 'Admin Master PIN (1234) successfully authorizes override');

  console.log('\n7. AUDIT LOG INTEGRITY & QUERYING');
  // Verify that all unauthorized attempts, overrides, and security events were logged
  const auditLogs = await auditService.getLogs({ limit: 50 });
  assert(auditLogs.length > 0, 'Audit log entries generated', `Total: ${auditLogs.length}`);

  const hasUnauthorizedAttempt = auditLogs.some(l => 
    l.action === 'UNAUTHORIZED_ACCESS_ATTEMPT' || l.severity === 'ALERT'
  );
  assert(hasUnauthorizedAttempt, 'Blocked unauthorized actions registered in Audit Log with ALERT severity');

  const hasAdminOverride = auditLogs.some(l => l.action === 'ADMIN_OVERRIDE');
  assert(hasAdminOverride, 'Admin supervisor override logged with details');

  const hasAuthSuccess = auditLogs.some(l => l.action === 'UNLOCK_SUCCESS' || l.action === 'BIOMETRIC_AUTH');
  assert(hasAuthSuccess, 'Staff PIN and Biometric logins recorded in Audit Log');

  // Test CSV export
  const csvData = auditService.exportLogsToCsv(auditLogs);
  assert(csvData.includes('Timestamp,Date,User,Role,Action,RecordType,RecordId,Severity,Description'), 'Audit CSV export contains formatted headers and rows');

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
