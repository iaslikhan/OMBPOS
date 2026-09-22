import React from 'react';
import { 
  X, 
  ShoppingBag, 
  Truck, 
  Receipt, 
  Wallet, 
  MapPin, 
  Users, 
  UserCheck, 
  Printer, 
  Tag, 
  HardDriveDownload, 
  FileSpreadsheet, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  History,
  Store,
  Phone,
  Lock
} from 'lucide-react';
import { securityService } from '../services/securityService';

export type NavigationTarget =
  | 'HOME'
  | 'BILLING'
  | 'CUSTOMERS'
  | 'INVENTORY'
  | 'REPORTS'
  | 'PURCHASE'
  | 'SUPPLIERS'
  | 'EXPENSES'
  | 'CASH_MANAGEMENT'
  | 'TRANSPORT'
  | 'CRM'
  | 'STAFF'
  | 'PRINTING'
  | 'LABELS'
  | 'BACKUP'
  | 'IMPORT_EXPORT'
  | 'SETTINGS'
  | 'SECURITY'
  | 'AUDIT_LOG';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: NavigationTarget;
  onSelectRoute: (target: NavigationTarget) => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentRoute,
  onSelectRoute,
}) => {
  if (!isOpen) return null;

  const drawerItems = [
    { target: 'PURCHASE' as NavigationTarget, label: 'Purchase', icon: ShoppingBag },
    { target: 'SUPPLIERS' as NavigationTarget, label: 'Suppliers', icon: Truck },
    { target: 'EXPENSES' as NavigationTarget, label: 'Expenses / Daily Expenses', icon: Receipt },
    { target: 'CASH_MANAGEMENT' as NavigationTarget, label: 'Cash Management', icon: Wallet },
    { target: 'TRANSPORT' as NavigationTarget, label: 'Transport Directory', icon: MapPin },
    { target: 'CRM' as NavigationTarget, label: 'CRM & Follow-ups', icon: Users },
    { target: 'STAFF' as NavigationTarget, label: 'Staff Management', icon: UserCheck },
    { target: 'PRINTING' as NavigationTarget, label: 'Printing Setup (Thermal/A4)', icon: Printer },
    { target: 'LABELS' as NavigationTarget, label: 'Sales & Purchase Labels', icon: Tag },
    { target: 'BACKUP' as NavigationTarget, label: 'Local Backup & Restore', icon: HardDriveDownload },
    { target: 'IMPORT_EXPORT' as NavigationTarget, label: 'Import / Export', icon: FileSpreadsheet },
    { target: 'SETTINGS' as NavigationTarget, label: 'Business Settings', icon: SettingsIcon },
    { target: 'SECURITY' as NavigationTarget, label: 'Security & PIN', icon: ShieldCheck },
    { target: 'AUDIT_LOG' as NavigationTarget, label: 'Audit Log', icon: History },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Surface */}
      <aside 
        id="navigation-drawer"
        className="relative flex flex-col w-80 max-w-[85vw] h-full bg-[#18181F] border-r border-[#2C2C38] text-white shadow-2xl z-10 animate-in slide-in-from-left duration-200"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#2C2C38] bg-[#141419]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold tracking-wide uppercase text-white">
                Original Modi Bags
              </h2>
            </div>
            <button
              id="btn-close-drawer"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252530]"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xs text-gray-400 space-y-0.5 pl-1">
            <p>3, Amartalla Lane, Kolkata-700001</p>
            <p className="flex items-center gap-1 text-gray-300 font-medium">
              <Phone className="w-3 h-3 text-orange-400" /> +91 8240584877
            </p>
          </div>
        </div>

        {/* Drawer Nav Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Management Modules
          </div>

          {drawerItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentRoute === item.target;
            const accessCheck = securityService.canAccessRoute(item.target);
            const isRestricted = !accessCheck.allowed;

            return (
              <button
                key={item.target}
                id={`drawer-link-${item.target.toLowerCase()}`}
                onClick={() => {
                  onSelectRoute(item.target);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                  isSelected
                    ? 'bg-orange-500 text-black font-bold shadow-md shadow-orange-500/20'
                    : isRestricted
                    ? 'text-gray-400 hover:bg-[#252532] hover:text-gray-200'
                    : 'text-gray-300 hover:bg-[#252532] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-black' : isRestricted ? 'text-gray-500' : 'text-orange-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isRestricted && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-[#252533] px-1.5 py-0.5 rounded border border-[#353545]">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Locked</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-[#2A2A38] bg-[#141419] text-[11px] text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>Room DB Active</span>
          </div>
          <span className="font-mono text-gray-500">v1.0.0-PROD</span>
        </div>
      </aside>
    </div>
  );
};
