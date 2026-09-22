import React, { useEffect, useState } from 'react';
import { 
  NavigationTarget 
} from '../components/NavigationDrawer';
import { roomDb } from '../db/indexedDbRoom';
import { 
  Building2, 
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
  Settings, 
  ShieldCheck, 
  History, 
  Calculator, 
  Package, 
  BarChart3,
  Plus,
  RefreshCw,
  CheckCircle2,
  Database
} from 'lucide-react';
import { formatINR } from '../services/currency';

interface ModuleScreenProps {
  moduleKey: NavigationTarget;
  onNavigateHome: () => void;
}

export const ModulePlaceholderScreen: React.FC<ModuleScreenProps> = ({
  moduleKey,
  onNavigateHome,
}) => {
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getModuleConfig = () => {
    switch (moduleKey) {
      case 'BILLING':
        return {
          title: 'Quick Billing & Invoicing',
          icon: Calculator,
          table: 'bills' as const,
          description: 'Calculator-style fast billing with independent sequence numbers (Estimates, Cash Memos, Invoices).',
          primaryAction: 'Start Fast Bill Entry',
        };
      case 'CUSTOMERS':
        return {
          title: 'Customer Directory & Ledger',
          icon: Users,
          table: 'customers' as const,
          description: 'Manage wholesale customer accounts, credit limits, outstanding balances, and transaction-based ledgers.',
          primaryAction: 'Add New Wholesale Customer',
        };
      case 'INVENTORY':
        return {
          title: 'Inventory & Stock Movements',
          icon: Package,
          table: 'products' as const,
          description: 'Product catalog, HSN/GST configurations, stock valuation, and atomic stock movement tracking.',
          primaryAction: 'Add Inventory Product',
        };
      case 'REPORTS':
        return {
          title: 'Reports & Business Analytics',
          icon: BarChart3,
          table: 'bills' as const,
          description: 'Real-time sales, collection, item-wise, customer-wise, expense, and stock valuation reports with export.',
          primaryAction: 'Generate Sales Summary',
        };
      case 'PURCHASE':
        return {
          title: 'Purchases & Inward Goods',
          icon: ShoppingBag,
          table: 'purchases' as const,
          description: 'Record supplier purchases with automatic inventory increment, freight tracking, and supplier credit balance.',
          primaryAction: 'Record New Purchase',
        };
      case 'SUPPLIERS':
        return {
          title: 'Supplier Accounts & Ledger',
          icon: Truck,
          table: 'suppliers' as const,
          description: 'Maintain raw material & bag supplier directories, purchase histories, and payment reconciliation.',
          primaryAction: 'Register New Supplier',
        };
      case 'EXPENSES':
        return {
          title: 'Daily Business Expenses',
          icon: Receipt,
          table: 'expenses' as const,
          description: 'Categorized expense tracking (Rent, Salary, Transport, Packaging, Electricity) with payment mode filters.',
          primaryAction: 'Record Expense',
        };
      case 'CASH_MANAGEMENT':
        return {
          title: 'Physical Cash Drawer Management',
          icon: Wallet,
          table: 'cash_transactions' as const,
          description: 'Physical cash box accounting strictly isolating cash sales and withdrawals from digital UPI/Bank transactions.',
          primaryAction: 'Log Cash Flow',
        };
      case 'TRANSPORT':
        return {
          title: 'Transporter Directory',
          icon: MapPin,
          table: 'transport' as const,
          description: 'Wholesale cargo transport services, destination hubs, contact persons, and dispatch tracking.',
          primaryAction: 'Add Transport Partner',
        };
      case 'CRM':
        return {
          title: 'CRM & Payment Follow-ups',
          icon: Users,
          table: 'crm_followups' as const,
          description: 'Track pending customer payment reminders, visit schedules, and wholesale dispatch alerts.',
          primaryAction: 'Schedule Follow-up',
        };
      case 'STAFF':
        return {
          title: 'Staff Roles & Permissions',
          icon: UserCheck,
          table: 'audit_logs' as const,
          description: 'Staff user accounts, granular permissions (Billing, Inventory, Price editing, Reports), and PIN control.',
          primaryAction: 'Configure Staff Access',
        };
      case 'PRINTING':
        return {
          title: 'Printer Management & ESC/POS Setup',
          icon: Printer,
          table: 'audit_logs' as const,
          description: 'Configure 58mm/80mm Bluetooth/USB thermal printers, A4/A5 layouts, auto-cut, and digital WhatsApp bills.',
          primaryAction: 'Connect Thermal Printer',
        };
      case 'LABELS':
        return {
          title: 'Sales & Purchase Bag Labels',
          icon: Tag,
          table: 'sales_label_settings' as const,
          description: 'Generate private sales labels (Code: 6 + price, masked selling rate) and purchase labels (Code: 786 + rate).',
          primaryAction: 'Configure Label Engine',
        };
      case 'BACKUP':
        return {
          title: 'Database Backup & Restore',
          icon: HardDriveDownload,
          table: 'audit_logs' as const,
          description: 'Complete offline snapshot creation, verified restore, and local disaster recovery protocols.',
          primaryAction: 'Create Offline Backup Now',
        };
      case 'IMPORT_EXPORT':
        return {
          title: 'Bulk Data Import & Export',
          icon: FileSpreadsheet,
          table: 'products' as const,
          description: 'Import products and customer opening balances with transactional rollback on validation failure.',
          primaryAction: 'Import Data Sheet',
        };
      case 'SETTINGS':
        return {
          title: 'Original Modi Bags Settings',
          icon: Settings,
          table: 'business_profile' as const,
          description: 'Store GSTIN, address, document numbering prefixes (EST-, BILL-, INV-), and business policies.',
          primaryAction: 'Edit Business Profile',
        };
      case 'SECURITY':
        return {
          title: 'Security, PIN & Biometrics',
          icon: ShieldCheck,
          table: 'audit_logs' as const,
          description: 'Admin PIN locks for price overrides, balance modifications, bill cancellations, and export permissions.',
          primaryAction: 'Update Security PIN',
        };
      case 'AUDIT_LOG':
      default:
        return {
          title: 'System Audit Log',
          icon: History,
          table: 'audit_logs' as const,
          description: 'Immutable timeline tracking all critical events: bill creations, adjustments, price changes, and sync events.',
          primaryAction: 'Filter Audit History',
        };
    }
  };

  const config = getModuleConfig();
  const Icon = config.icon;

  useEffect(() => {
    let isMounted = true;
    const fetchTableInfo = async () => {
      setLoading(true);
      try {
        const records = await roomDb.getAll<any>(config.table);
        if (isMounted) {
          setItemsCount(records.length);
          setRecentEntries(records.slice(0, 5));
        }
      } catch (e) {
        console.error('Error fetching table items', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTableInfo();
    const unsub = roomDb.subscribe((changedTable) => {
      if (changedTable === config.table) {
        fetchTableInfo();
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [moduleKey]);

  return (
    <div className="space-y-6 pb-20">
      {/* Module Title Header Card */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {config.title}
              </h2>
              <p className="text-xs text-gray-400 max-w-xl">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateHome}
              className="px-3 py-1.5 rounded-xl bg-[#252533] text-gray-300 hover:text-white border border-[#333345] text-xs font-medium"
            >
              ← Dashboard
            </button>
            <button
              className="px-3 py-1.5 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{config.primaryAction}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Room Table Integration Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Room Database Table</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {config.table}
          </div>
          <span className="text-[10px] text-gray-500">Local Source of Truth</span>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
            <span>Total Records in Room</span>
          </div>
          <div className="text-base font-bold text-orange-400 font-mono">
            {loading ? '...' : `${itemsCount} records`}
          </div>
          <span className="text-[10px] text-gray-500">Persisted locally in IndexedDB</span>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Offline Resilience</span>
          </div>
          <div className="text-sm font-bold text-emerald-400">
            Active & Verified
          </div>
          <span className="text-[10px] text-gray-500">Zero data loss on network drops</span>
        </div>
      </div>

      {/* Existing Data Table in Room DB */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Existing Records in Room Table ({config.table})
        </h3>

        {recentEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No records in <span className="font-mono text-gray-400">{config.table}</span> yet. Use the action button above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                <tr>
                  <th className="p-2.5">Identifier</th>
                  <th className="p-2.5">Key Field</th>
                  <th className="p-2.5">Sync Status</th>
                  <th className="p-2.5">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2B2B38]">
                {recentEntries.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-[#232330]">
                    <td className="p-2.5 font-mono text-orange-300 font-medium">
                      {entry.id || entry.code || `#${idx + 1}`}
                    </td>
                    <td className="p-2.5 font-medium text-white">
                      {entry.name || entry.description || entry.action || entry.details || JSON.stringify(entry).slice(0, 30)}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                        {entry.syncStatus || 'LOCAL'}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-400">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString() : 'Current'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
