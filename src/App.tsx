/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { NavigationDrawer, NavigationTarget } from './components/NavigationDrawer';
import { BottomNavBar } from './components/BottomNavBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LoadingState, ErrorState } from './components/CommonStates';
import { HomeScreen } from './screens/HomeScreen';
import { BillingScreen } from './screens/BillingScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { PurchaseScreen } from './screens/PurchaseScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { CashManagementScreen } from './screens/CashManagementScreen';
import { TransportScreen } from './screens/TransportScreen';
import { CRMScreen } from './screens/CRMScreen';
import { StaffScreen } from './screens/StaffScreen';
import { PrintingScreen } from './screens/PrintingScreen';
import { LabelsScreen } from './screens/LabelsScreen';
import { BackupScreen } from './screens/BackupScreen';
import { ImportExportScreen } from './screens/ImportExportScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SecurityScreen } from './screens/SecurityScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { roomDb } from './db/indexedDbRoom';
import { networkMonitor } from './services/networkMonitor';
import { firebaseFoundation, SyncState } from './services/firebaseFoundation';
import { securityService } from './services/securityService';
import { auditService } from './services/auditService';
import { LockScreenModal } from './components/LockScreenModal';
import { AccessDeniedView } from './components/AccessDeniedView';
import { Staff } from './types';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<NavigationTarget>('HOME');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [accessDeniedTarget, setAccessDeniedTarget] = useState<{ target: NavigationTarget; permission?: string } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(firebaseFoundation.getState());

  // Initialize Room Database, Security and system observers
  useEffect(() => {
    let mounted = true;

    async function initSystem() {
      try {
        await roomDb.getDb();
        await securityService.init();
        if (mounted) {
          setIsDbReady(true);
          setDbError(null);
          setActiveStaff(securityService.getActiveStaff());
          setIsLocked(securityService.isSessionLocked());
        }
      } catch (err: any) {
        console.error('Fatal: Failed to initialize Room database & Security', err);
        if (mounted) {
          setDbError(err?.message || 'Failed to initialize local Room database storage.');
        }
      }
    }

    initSystem();

    const unsubNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    const unsubSync = firebaseFoundation.subscribe((s) => {
      setSyncState(s);
    });

    const unsubSecurity = securityService.subscribeSession(() => {
      if (mounted) {
        setActiveStaff(securityService.getActiveStaff());
        setIsLocked(securityService.isSessionLocked());
      }
    });

    return () => {
      mounted = false;
      unsubNetwork();
      unsubSync();
      unsubSecurity();
    };
  }, []);

  const handleUserActivity = () => {
    securityService.recordActivity();
  };

  const handleSelectRoute = (target: NavigationTarget) => {
    securityService.recordActivity();
    const check = securityService.canAccessRoute(target);
    if (!check.allowed) {
      auditService.log({
        user: activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Unknown Staff',
        staffId: activeStaff?.id,
        role: activeStaff?.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        recordType: 'NAVIGATION_GUARD',
        recordId: target,
        severity: 'ALERT',
        description: `Blocked navigation to ${target}: ${check.reason}`
      });
      setAccessDeniedTarget({ target, permission: check.requiredPermission });
    } else {
      setAccessDeniedTarget(null);
      setCurrentRoute(target);
    }
  };

  const handleSimulateNetworkToggle = () => {
    networkMonitor.simulateToggle();
  };

  const handleTriggerSync = () => {
    firebaseFoundation.triggerSync();
  };

  if (dbError) {
    return (
      <div className="min-h-screen bg-[#121214] text-white flex items-center justify-center p-4">
        <ErrorState
          title="Room Database Initialization Failed"
          message={dbError}
          onRetry={() => {
            setDbError(null);
            setIsDbReady(false);
            roomDb.getDb().then(() => setIsDbReady(true)).catch((e) => setDbError(e.message));
          }}
        />
      </div>
    );
  }

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-[#121214] text-white flex items-center justify-center p-4">
        <LoadingState message="Booting Original Modi Bags Room Database Engine..." />
      </div>
    );
  }

  return (
    <div 
      onMouseMove={handleUserActivity}
      onKeyDown={handleUserActivity}
      onClick={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="min-h-screen bg-[#121214] text-gray-100 flex flex-col font-sans antialiased selection:bg-orange-500 selection:text-black"
    >
      {/* Top Application Bar */}
      <TopBar
        onToggleDrawer={() => setIsDrawerOpen(true)}
        isOnline={isOnline}
        syncState={syncState}
        onSimulateNetworkToggle={handleSimulateNetworkToggle}
        onTriggerSync={handleTriggerSync}
        activeStaff={activeStaff}
        onLockTerminal={() => securityService.lockSession('POS terminal locked from top bar')}
        onSwitchStaff={() => setIsLocked(true)}
      />

      {/* Offline Mode Alert Banner */}
      <OfflineIndicator
        isOnline={isOnline}
        onSimulateToggle={handleSimulateNetworkToggle}
      />

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentRoute={currentRoute}
        onSelectRoute={handleSelectRoute}
      />

      {/* Main Content Viewport with Permission Guard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {accessDeniedTarget ? (
          <AccessDeniedView
            screenName={accessDeniedTarget.target}
            requiredPermission={accessDeniedTarget.permission as any}
            onBack={() => {
              setAccessDeniedTarget(null);
              setCurrentRoute('HOME');
            }}
            onOverrideSuccess={() => {
              const dest = accessDeniedTarget.target;
              setAccessDeniedTarget(null);
              setCurrentRoute(dest);
            }}
          />
        ) : !securityService.canAccessRoute(currentRoute).allowed ? (
          <AccessDeniedView
            screenName={currentRoute}
            requiredPermission={securityService.canAccessRoute(currentRoute).requiredPermission}
            onBack={() => {
              setAccessDeniedTarget(null);
              setCurrentRoute('HOME');
            }}
            onOverrideSuccess={() => {
              setAccessDeniedTarget(null);
            }}
          />
        ) : (
          <>
            {currentRoute === 'HOME' && (
              <HomeScreen
                onNavigate={handleSelectRoute}
                isOnline={isOnline}
              />
            )}
            {currentRoute === 'BILLING' && (
              <BillingScreen 
                onBack={() => handleSelectRoute('HOME')} 
                onNavigateLabels={() => handleSelectRoute('LABELS')}
              />
            )}
            {currentRoute === 'CUSTOMERS' && (
              <CustomersScreen 
                onBack={() => handleSelectRoute('HOME')} 
                onNavigateBilling={() => handleSelectRoute('BILLING')} 
              />
            )}
            {currentRoute === 'INVENTORY' && (
              <InventoryScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'REPORTS' && (
              <ReportsScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'PURCHASE' && (
              <PurchaseScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'SUPPLIERS' && (
              <SuppliersScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'EXPENSES' && (
              <ExpensesScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'CASH_MANAGEMENT' && (
              <CashManagementScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'TRANSPORT' && (
              <TransportScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'CRM' && (
              <CRMScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'STAFF' && (
              <StaffScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'PRINTING' && (
              <PrintingScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'LABELS' && (
              <LabelsScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'BACKUP' && (
              <BackupScreen 
                onBack={() => handleSelectRoute('HOME')} 
                onNavigateImportExport={() => handleSelectRoute('IMPORT_EXPORT')}
              />
            )}
            {currentRoute === 'IMPORT_EXPORT' && (
              <ImportExportScreen 
                onBack={() => handleSelectRoute('HOME')} 
                onNavigateBackup={() => handleSelectRoute('BACKUP')}
              />
            )}
            {currentRoute === 'SETTINGS' && (
              <SettingsScreen 
                onBack={() => handleSelectRoute('HOME')} 
                onNavigatePrinting={() => handleSelectRoute('PRINTING')}
              />
            )}
            {currentRoute === 'SECURITY' && (
              <SecurityScreen onBack={() => handleSelectRoute('HOME')} />
            )}
            {currentRoute === 'AUDIT_LOG' && (
              <AuditLogScreen onBack={() => handleSelectRoute('HOME')} />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar for Mobile and Fast POS Access */}
      <BottomNavBar
        currentRoute={currentRoute}
        onSelectRoute={handleSelectRoute}
      />

      {/* Full-Screen POS Lock Screen Modal */}
      <LockScreenModal
        isOpen={isLocked}
        onUnlocked={() => setIsLocked(false)}
      />
    </div>
  );
}

