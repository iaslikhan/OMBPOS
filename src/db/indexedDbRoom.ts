/**
 * Original Modi Bags Business Manager - Local-First Room Database Engine
 * Implements Room's source-of-truth architecture using transactional IndexedDB.
 * Survives application restarts and functions 100% offline.
 */

import {
  BusinessProfile,
  Customer,
  CustomerLedgerTransaction,
  Product,
  StockMovement,
  Bill,
  Supplier,
  SupplierLedgerTransaction,
  Purchase,
  Expense,
  CashTransaction,
  TransportRecord,
  TransportCompany,
  Staff,
  CRMFollowUp,
  AuditLogItem,
  DocumentSequenceSettings,
  SalesLabelSettings,
  PurchaseLabelSettings,
  SystemStats,
  BaseEntity,
  MasterPrintSettings,
  PrinterDevice
} from '../types';
import {
  DEFAULT_BUSINESS_PROFILE,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEFAULT_SALES_LABEL_SETTINGS,
  DEFAULT_PURCHASE_LABEL_SETTINGS,
  DEFAULT_SEQUENCES,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
  INITIAL_CUSTOMER_LEDGER,
  INITIAL_BILLS,
  INITIAL_EXPENSES,
  INITIAL_CASH_TRANSACTIONS,
  INITIAL_TRANSPORTS,
  INITIAL_CRM_FOLLOWUPS,
  DEFAULT_MASTER_PRINT_SETTINGS,
  INITIAL_PRINTERS
} from './seedData';

const DB_NAME = 'OriginalModiBagsRoomDB';
const DB_VERSION = 13;

export const REQUIRED_TABLES = [
  'business_profile',
  'customers',
  'customer_ledger',
  'products',
  'stock_movements',
  'bills',
  'suppliers',
  'supplier_ledger',
  'purchases',
  'expenses',
  'cash_transactions',
  'transport',
  'transports',
  'staff',
  'roles',
  'security_settings',
  'crm_followups',
  'audit_logs',
  'doc_sequences',
  'sales_label_settings',
  'purchase_label_settings',
  'printers',
  'print_settings',
  'print_jobs',
  'sync_queue'
] as const;

export type TableName = (typeof REQUIRED_TABLES)[number];

class IndexedDbRoomDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;
  private changeListeners: Set<(table: TableName) => void> = new Set();

  public subscribe(listener: (table: TableName) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notify(table: TableName) {
    this.changeListeners.forEach(fn => fn(table));
  }

  /**
   * Automatically ensures all required stores exist in the database,
   * performing an on-the-fly version upgrade if any store is missing.
   */
  public async ensureStores(tables: TableName[]): Promise<IDBDatabase> {
    const db = await this.getDb();
    const missing = tables.filter(t => !db.objectStoreNames.contains(t));
    if (missing.length === 0) {
      return db;
    }

    // Auto-heal: upgrade version to create missing stores
    db.close();
    this.db = null;
    this.initPromise = null;

    const nextVersion = Math.max(db.version + 1, DB_VERSION);
    return new Promise<IDBDatabase>((resolve, reject) => {
      const upgradeReq = indexedDB.open(DB_NAME, nextVersion);

      upgradeReq.onupgradeneeded = (event) => {
        const uDb = (event.target as IDBOpenDBRequest).result;
        for (const name of REQUIRED_TABLES) {
          if (!uDb.objectStoreNames.contains(name)) {
            uDb.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };

      upgradeReq.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      upgradeReq.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  public async getDb(): Promise<IDBDatabase> {
    if (this.db) {
      const allPresent = REQUIRED_TABLES.every(t => this.db!.objectStoreNames.contains(t));
      if (allPresent) return this.db;
      try { this.db.close(); } catch {}
      this.db = null;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const name of REQUIRED_TABLES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Handle other tabs requesting version upgrades
        db.onversionchange = () => {
          db.close();
          this.db = null;
        };

        // Auto-heal check: if any table is missing from an older cached version
        const missing = REQUIRED_TABLES.filter(t => !db.objectStoreNames.contains(t));
        if (missing.length > 0) {
          db.close();
          const nextVersion = db.version + 1;
          const upgradeReq = indexedDB.open(DB_NAME, nextVersion);
          upgradeReq.onupgradeneeded = (ue) => {
            const uDb = (ue.target as IDBOpenDBRequest).result;
            for (const name of REQUIRED_TABLES) {
              if (!uDb.objectStoreNames.contains(name)) {
                uDb.createObjectStore(name, { keyPath: 'id' });
              }
            }
          };
          upgradeReq.onsuccess = async (ue) => {
            this.db = (ue.target as IDBOpenDBRequest).result;
            this.db.onversionchange = () => {
              this.db?.close();
              this.db = null;
            };
            await this.ensureInitialSeed();
            resolve(this.db);
          };
          upgradeReq.onblocked = () => {
            console.warn('[RoomDB] Database upgrade blocked by another connection');
          };
          upgradeReq.onerror = (ue) => {
            reject((ue.target as IDBOpenDBRequest).error);
          };
          return;
        }

        this.db = db;
        await this.ensureInitialSeed();
        resolve(this.db);
      };

      request.onerror = (event) => {
        this.initPromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.initPromise;
  }

  private async ensureInitialSeed() {
    if (!this.db) return;
    try {
      const biz = await this.get<BusinessProfile>('business_profile', DEFAULT_BUSINESS_PROFILE.id);
      if (!biz) {
        await this.put('business_profile', DEFAULT_BUSINESS_PROFILE, false);
        
        for (const prod of INITIAL_PRODUCTS) {
          await this.put('products', prod, false);
        }
        for (const cust of INITIAL_CUSTOMERS) {
          await this.put('customers', cust, false);
        }
        for (const seq of DEFAULT_SEQUENCES) {
          await this.put('doc_sequences', seq, false);
        }
        await this.put('sales_label_settings', DEFAULT_SALES_LABEL_SETTINGS, false);
        await this.put('purchase_label_settings', DEFAULT_PURCHASE_LABEL_SETTINGS, false);

        // Log initial seed in audit
        await this.put('audit_logs', {
          id: `audit-${Date.now()}`,
          businessId: DEFAULT_BUSINESS_PROFILE.id,
          user: 'System Admin',
          action: 'INITIALIZE_ROOM_DATABASE',
          timestamp: Date.now(),
          recordType: 'SYSTEM',
          recordId: 'DATABASE_SEED',
          notes: 'Room database initialized with Original Modi Bags default business profiles.',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        }, false);
      }

      // Seed suppliers if empty
      const existingSuppliers = await this.getAll<Supplier>('suppliers');
      if (existingSuppliers.length === 0) {
        for (const supp of INITIAL_SUPPLIERS) {
          await this.put('suppliers', supp, false);
        }
      }

      // Seed bills if empty
      const existingBills = await this.getAll<Bill>('bills');
      if (existingBills.length === 0) {
        for (const bill of INITIAL_BILLS) {
          await this.put('bills', bill, false);
        }
      }

      // Seed purchases if empty
      const existingPurchases = await this.getAll<Purchase>('purchases');
      if (existingPurchases.length === 0) {
        for (const purch of INITIAL_PURCHASES) {
          await this.put('purchases', purch, false);
        }
      }

      // Seed customer_ledger if empty
      const existingCustLedger = await this.getAll<CustomerLedgerTransaction>('customer_ledger');
      if (existingCustLedger.length === 0) {
        for (const tx of INITIAL_CUSTOMER_LEDGER) {
          await this.put('customer_ledger', tx, false);
        }
      }

      // Seed expenses if empty
      const existingExpenses = await this.getAll<Expense>('expenses');
      if (existingExpenses.length === 0) {
        for (const exp of INITIAL_EXPENSES) {
          await this.put('expenses', exp, false);
        }
      }

      // Seed cash transactions if empty
      const existingCash = await this.getAll<CashTransaction>('cash_transactions');
      if (existingCash.length === 0) {
        for (const cash of INITIAL_CASH_TRANSACTIONS) {
          await this.put('cash_transactions', cash, false);
        }
      }

      // Seed transport if empty
      const existingTransports = await this.getAll<TransportRecord>('transport');
      if (existingTransports.length === 0) {
        for (const trans of INITIAL_TRANSPORTS) {
          await this.put('transport', trans, false);
        }
      }

      // Seed transports (companies) if empty
      const existingTransportCompanies = await this.getAll<TransportCompany>('transports');
      if (existingTransportCompanies.length === 0) {
        const defaultCompanies: TransportCompany[] = [
          {
            id: 'trans-c1',
            businessId: DEFAULT_BUSINESS_PROFILE.id,
            name: 'KOLKATA CENTRAL CARGO SERVICE',
            contactPerson: 'Manoj Sharma',
            phone: '9830556677',
            godownAddress: '15, Pollock Street, Canning St, Kolkata-700001',
            destinationRoutes: ['Siliguri', 'North Bengal', 'Guwahati', 'Malda'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          },
          {
            id: 'trans-c2',
            businessId: DEFAULT_BUSINESS_PROFILE.id,
            name: 'MAA TARA ROADWAYS & TRANSPORT',
            contactPerson: 'Alok Roy',
            phone: '9831998877',
            godownAddress: 'Posta Transport Hub, Kolkata-700007',
            destinationRoutes: ['Asansol', 'Durgapur', 'Dhanbad', 'Ranchi', 'Patna'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          },
          {
            id: 'trans-c3',
            businessId: DEFAULT_BUSINESS_PROFILE.id,
            name: 'BENGAL ODISHA FAST CARGO',
            contactPerson: 'Bikash Mahapatra',
            phone: '9433112244',
            godownAddress: 'Central Avenue Godown, Kolkata-700012',
            destinationRoutes: ['Bhubaneswar', 'Cuttack', 'Balasore', 'Rourkela'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          }
        ];
        for (const c of defaultCompanies) {
          await this.put('transports', c, false);
        }
      }

      // Seed staff if empty
      const existingStaff = await this.getAll<Staff>('staff');
      if (existingStaff.length === 0) {
        const initStaff: Staff[] = [
          {
            id: 'staff-1',
            businessId: DEFAULT_BUSINESS_PROFILE.id,
            name: 'Mukesh Modi',
            role: 'ADMIN',
            roleType: 'ADMIN',
            roleId: 'role-admin',
            pin: '1234',
            phone: '8240584877',
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          },
          {
            id: 'staff-2',
            businessId: DEFAULT_BUSINESS_PROFILE.id,
            name: 'Ramu (Counter Sales)',
            role: 'SALES',
            roleType: 'BILLING',
            roleId: 'role-billing',
            pin: '2222',
            phone: '9830112233',
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          }
        ];
        for (const s of initStaff) {
          await this.put('staff', s, false);
        }
      }

      // Seed CRM follow-ups if empty
      const existingCRM = await this.getAll<CRMFollowUp>('crm_followups');
      if (existingCRM.length === 0) {
        for (const crm of INITIAL_CRM_FOLLOWUPS) {
          await this.put('crm_followups', crm, false);
        }
      }

      // Seed Print Settings if empty
      const existingSettings = await this.get<MasterPrintSettings>('print_settings', DEFAULT_MASTER_PRINT_SETTINGS.id);
      if (!existingSettings) {
        await this.put('print_settings', DEFAULT_MASTER_PRINT_SETTINGS, false);
      }

      // Seed Printers if empty
      const existingPrinters = await this.getAll<PrinterDevice>('printers');
      if (existingPrinters.length === 0) {
        for (const p of INITIAL_PRINTERS) {
          await this.put('printers', p, false);
        }
      }
    } catch (err) {
      console.warn('[RoomDB] Seed error (non-fatal):', err);
    }
  }

  // Generic DAO methods
  public async get<T extends BaseEntity>(table: TableName, id: string): Promise<T | null> {
    try {
      const db = await this.ensureStores([table]);
      if (!db.objectStoreNames.contains(table)) return null;
      return new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(table, 'readonly');
        const store = tx.objectStore(table);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[RoomDB] get failed for table ${table}:`, err);
      return null;
    }
  }

  public async getAll<T extends BaseEntity>(table: TableName): Promise<T[]> {
    try {
      const db = await this.ensureStores([table]);
      if (!db.objectStoreNames.contains(table)) return [];
      return new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(table, 'readonly');
        const store = tx.objectStore(table);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[RoomDB] getAll failed for table ${table}:`, err);
      return [];
    }
  }

  public async put<T extends BaseEntity>(table: TableName, item: T, notify = true): Promise<T> {
    const db = await this.ensureStores([table, 'sync_queue']);
    return new Promise<T>((resolve, reject) => {
      const txStores = [table];
      if (table !== 'sync_queue' && db.objectStoreNames.contains('sync_queue')) {
        txStores.push('sync_queue');
      }

      const tx = db.transaction(txStores, 'readwrite');
      const store = tx.objectStore(table);

      const updatedItem = {
        ...item,
        updatedAt: Date.now(),
      };

      store.put(updatedItem);

      // Add to offline sync queue if it's a business entity
      const skipSyncQueueTables: string[] = ['sync_queue', 'audit_logs', 'backup_history'];
      if (notify && !skipSyncQueueTables.includes(table) && db.objectStoreNames.contains('sync_queue')) {
        const syncStore = tx.objectStore('sync_queue');
        syncStore.put({
          id: `sync-${table}-${item.id}`,
          table,
          entityId: item.id,
          action: 'UPSERT',
          data: updatedItem,
          timestamp: Date.now(),
          status: 'PENDING'
        });
      }

      tx.oncomplete = () => {
        if (notify) this.notify(table);
        resolve(updatedItem);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public async delete(table: TableName, id: string): Promise<void> {
    const db = await this.ensureStores([table, 'sync_queue']);
    return new Promise<void>((resolve, reject) => {
      const txStores = [table];
      if (table !== 'sync_queue' && db.objectStoreNames.contains('sync_queue')) {
        txStores.push('sync_queue');
      }

      const tx = db.transaction(txStores, 'readwrite');
      const store = tx.objectStore(table);

      store.delete(id);

      const skipSyncQueueTables: string[] = ['sync_queue', 'audit_logs', 'backup_history'];
      if (!skipSyncQueueTables.includes(table) && db.objectStoreNames.contains('sync_queue')) {
        const syncStore = tx.objectStore('sync_queue');
        syncStore.put({
          id: `sync-del-${table}-${id}`,
          table,
          entityId: id,
          action: 'DELETE',
          timestamp: Date.now(),
          status: 'PENDING'
        });
      }

      tx.oncomplete = () => {
        this.notify(table);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public async clear(table: TableName): Promise<void> {
    const db = await this.ensureStores([table]);
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      const req = store.clear();
      req.onsuccess = () => {
        this.notify(table);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Room DAO Aggregator: Computes live dashboard metrics strictly from real transactions.
   */
  public async getSystemStats(): Promise<SystemStats> {
    const bills = await this.getAll<Bill>('bills');
    const customers = await this.getAll<Customer>('customers');
    const products = await this.getAll<Product>('products');
    const expenses = await this.getAll<Expense>('expenses');
    const suppliers = await this.getAll<Supplier>('suppliers');
    const crmFollowUps = await this.getAll<CRMFollowUp>('crm_followups');
    const cashTxs = await this.getAll<CashTransaction>('cash_transactions');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    // Today's Sales
    const todaySalesPaise = bills
      .filter(b => !b.isCancelled && b.date >= startOfTodayMs)
      .reduce((sum, b) => sum + (b.grandTotalPaise || 0), 0);

    // Today's Collection (payments collected today across bills & receipts)
    const todayCollectionPaise = bills
      .filter(b => !b.isCancelled && b.date >= startOfTodayMs)
      .reduce((sum, b) => sum + (b.paidPaise || 0), 0);

    // Today's Expenses
    const todayExpensesPaise = expenses
      .filter(e => e.date >= startOfTodayMs)
      .reduce((sum, e) => sum + (e.amountPaise || 0), 0);

    // Outstanding Receivables (sum of all customer outstanding)
    const outstandingReceivablesPaise = customers
      .reduce((sum, c) => sum + (c.currentOutstandingPaise || 0), 0);

    // Outstanding Payables (sum of all supplier outstanding)
    const outstandingPayablesPaise = suppliers
      .reduce((sum, s) => sum + (s.currentOutstandingPaise || 0), 0);

    // Current Stock Value = sum of (currentStock * purchaseRate)
    const currentStockValuePaise = products
      .reduce((sum, p) => sum + Math.max(0, p.currentStock) * (p.purchaseRatePaise || 0), 0);

    // Low stock count
    const lowStockCount = products
      .filter(p => p.currentStock <= p.minimumStock).length;

    // Pending CRM followups
    const pendingFollowUpsCount = crmFollowUps
      .filter(f => f.status === 'PENDING').length;

    // Physical Cash Balance from cash transactions
    let physicalCashBalancePaise = 0;
    for (const tx of cashTxs) {
      physicalCashBalancePaise += (tx.inflowPaise || 0) - (tx.outflowPaise || 0);
    }

    return {
      todaySalesPaise,
      todayCollectionPaise,
      todayExpensesPaise,
      outstandingReceivablesPaise,
      outstandingPayablesPaise,
      currentStockValuePaise,
      lowStockCount,
      pendingFollowUpsCount,
      totalBillsCount: bills.length,
      totalCustomersCount: customers.length,
      totalProductsCount: products.length,
      physicalCashBalancePaise
    };
  }

  public async exportCompleteDatabase(): Promise<Record<string, any>> {
    const dump: Record<string, any> = {
      version: 1,
      exportedAt: Date.now(),
      business: 'ORIGINAL MODI BAGS'
    };

    const tables: TableName[] = [
      'business_profile',
      'customers',
      'customer_ledger',
      'products',
      'stock_movements',
      'bills',
      'suppliers',
      'purchases',
      'expenses',
      'cash_transactions',
      'transport',
      'transports',
      'staff',
      'crm_followups',
      'audit_logs'
    ];

    for (const t of tables) {
      try {
        dump[t] = await this.getAll(t);
      } catch {
        dump[t] = [];
      }
    }

    return dump;
  }
}

export const roomDb = new IndexedDbRoomDatabase();
