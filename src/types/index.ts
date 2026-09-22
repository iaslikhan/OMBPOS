/**
 * Original Modi Bags Business Manager - Core Types & Room Entity Models
 * Business: 3, Amartalla Lane, Kolkata-700001 | Phone: 8240584877
 */

export type SyncStatus = 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK' | 'CARD' | 'CHEQUE' | 'CREDIT' | 'OTHER';

export type DocumentType = 
  | 'ESTIMATE' 
  | 'CASH_MEMO' 
  | 'INVOICE' 
  | 'GST_INVOICE' 
  | 'PAYMENT_RECEIPT' 
  | 'QUOTATION' 
  | 'DELIVERY_CHALLAN';

export interface BaseEntity {
  id: string;
  businessId: string;
  createdAt: number; // Unix timestamp ms
  updatedAt: number;
  userId?: string;
  staffId?: string;
  syncStatus: SyncStatus;
}

export interface BusinessProfile extends BaseEntity {
  name: string;
  tagline?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  gstin?: string;
  currency: string;
  currencySymbol: string;
  upiId?: string;
  defaultHsn?: string;
}

export interface Customer extends BaseEntity {
  customerId: string;
  name: string;
  businessName?: string;
  mobile: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  openingBalancePaise: number; // in paise
  currentOutstandingPaise: number; // in paise
  creditLimitPaise?: number; // in paise
  preferredTransport?: string;
  notes?: string;
  totalSalesPaise: number;
  totalPaymentsPaise: number;
}

export type CustomerLedgerTxType = 
  | 'OPENING_BALANCE' 
  | 'CREDIT_SALE' 
  | 'PAYMENT' 
  | 'SALES_RETURN' 
  | 'ADJUSTMENT';

export interface CustomerLedgerTransaction extends BaseEntity {
  customerId: string;
  date: number;
  type: CustomerLedgerTxType;
  referenceDocumentId?: string; // Bill ID, Receipt ID
  referenceDocumentNumber?: string;
  description: string;
  debitPaise: number; // Increases customer outstanding
  creditPaise: number; // Decreases customer outstanding
  runningBalancePaise: number;
  paymentMethod?: PaymentMethod;
}

export interface Product extends BaseEntity {
  productCode: string;
  name: string;
  category: string;
  subcategory?: string;
  size?: string;
  colour?: string;
  purchaseRatePaise: number;
  wholesaleRatePaise: number;
  saleRatePaise: number;
  mrpPaise: number;
  gstPercentage: number;
  hsn?: string;
  openingStock: number;
  currentStock: number;
  minimumStock: number;
  supplierId?: string;
  supplierName?: string;
  barcode?: string;
  notes?: string;
}

export type StockMovementType = 
  | 'PURCHASE' 
  | 'SALE' 
  | 'SALES_RETURN' 
  | 'PURCHASE_RETURN' 
  | 'DAMAGE' 
  | 'MANUAL_ADJUSTMENT'
  | 'OPENING_STOCK';

export interface StockMovement extends BaseEntity {
  productId: string;
  productName: string;
  date: number;
  type: StockMovementType;
  quantityChange: number; // Positive or negative
  previousStock: number;
  newStock: number;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  notes?: string;
}

export interface BillItem {
  id: string;
  sNo: number;
  productId?: string; // Optional if free-text item
  isPermanentProduct: boolean;
  details: string; // Product name or description
  quantity: number;
  ratePaise: number; // Rate per piece in paise
  totalPaise: number; // Qty * Rate in paise
  discountPaise?: number;
  gstPercentage?: number;
}

export interface Bill extends BaseEntity {
  documentType: DocumentType;
  billNumber: string;
  date: number;
  customerId?: string;
  customerName: string;
  customerMobile?: string;
  items: BillItem[];
  totalQuantity: number;
  subtotalPaise: number;
  discountPaise: number;
  gstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  balancePaise: number;
  previousDuePaise: number;
  newBalancePaise: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  isCancelled: boolean;
}

export interface Supplier extends BaseEntity {
  supplierId: string;
  supplierCode?: string;
  name: string;
  businessName?: string;
  mobile: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  gstin?: string;
  openingBalancePaise: number;
  currentOutstandingPaise: number;
  creditLimitPaise?: number;
  notes?: string;
  totalPurchasesPaise?: number;
  totalPaymentsPaise?: number;
}

export type SupplierLedgerTxType = 
  | 'OPENING_BALANCE' 
  | 'PURCHASE' 
  | 'PAYMENT' 
  | 'PURCHASE_RETURN' 
  | 'ADJUSTMENT';

export interface SupplierLedgerTransaction extends BaseEntity {
  supplierId: string;
  date: number;
  type: SupplierLedgerTxType;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  description: string;
  creditPaise: number; // Purchase creates liability / credit (we owe supplier)
  debitPaise: number;  // Payment or return reduces liability / debit
  runningBalancePaise: number; // Current amount we owe to supplier
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  purchaseRatePaise: number;
  totalPaise: number;
}

export interface Purchase extends BaseEntity {
  supplierId: string;
  supplierName: string;
  purchaseInvoiceNumber: string;
  date: number;
  items: PurchaseItem[];
  totalQuantity: number;
  subtotalPaise: number;
  discountPaise?: number;
  gstPaise?: number;
  taxPaise?: number;
  freightPaise?: number;
  freightChargesPaise?: number;
  otherChargesPaise?: number;
  grandTotalPaise: number;
  paidPaise: number;
  creditPaise: number;
  paymentMethod?: PaymentMethod;
  transport?: string;
  notes?: string;
  isCancelled?: boolean;
}

export interface Expense extends BaseEntity {
  date: number;
  category: string;
  description: string;
  amountPaise: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type CashTransactionType = 
  | 'OPENING_CASH' 
  | 'CASH_SALE' 
  | 'CASH_RECEIVED' 
  | 'CASH_PURCHASE' 
  | 'CASH_EXPENSE' 
  | 'CASH_WITHDRAWAL' 
  | 'CASH_DEPOSIT'
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'EXPENSE';

export interface CashTransaction extends BaseEntity {
  date: number;
  type: CashTransactionType;
  description: string;
  inflowPaise: number;
  outflowPaise: number;
  runningCashBalancePaise: number;
  referenceId?: string;
}

export interface TransportRecord extends BaseEntity {
  name: string;
  destination: string;
  branch?: string;
  contactPerson?: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
  godownAddress?: string;
  destinationRoutes?: string[];
  notes?: string;
  isFavorite?: boolean;
}

export interface TransportCompany extends BaseEntity {
  name: string;
  contactPerson?: string;
  phone: string;
  godownAddress: string;
  destinationRoutes: string[];
}

export type CRMType = 'PAYMENT' | 'SALES' | 'ORDER' | 'CUSTOMER_VISIT' | 'OTHER';
export type CRMStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type CRMViewFilter = 'TODAY' | 'OVERDUE' | 'UPCOMING';

export interface CRMFollowUp extends BaseEntity {
  customerId: string;
  customerName: string;
  customerMobile?: string;
  type: CRMType;
  purpose?: string;
  date?: number;
  scheduledDate: number; // Scheduled follow up timestamp
  nextDate?: number;
  notes: string;
  status: CRMStatus;
  completedAt?: number;
}

export type RoleType = 'ADMIN' | 'MANAGER' | 'BILLING' | 'INVENTORY' | 'SALES' | 'CUSTOM';

export interface StaffPermissions {
  // Navigation & Screen Access
  canAccessBilling: boolean;
  canAccessCustomers: boolean;
  canAccessInventory: boolean;
  canAccessPurchases: boolean;
  canAccessSuppliers: boolean;
  canAccessExpenses: boolean;
  canAccessCash: boolean;
  canAccessReports: boolean;
  canAccessProfitLoss: boolean;
  canAccessTransport: boolean;
  canAccessCRM: boolean;
  canAccessPrinting: boolean;
  canAccessLabels: boolean;
  canAccessStaff: boolean;
  canAccessSecurity: boolean;
  canAccessAuditLog: boolean;
  canAccessBackup: boolean;
  canAccessSettings: boolean;

  // Actions & Business Logic
  canDiscountBill: boolean;
  canCancelBill: boolean;
  canViewCostPrice: boolean;
  canEditProduct: boolean;
  canDeleteRecord: boolean;
  canExportData: boolean;
  canWipeData: boolean;
  canManageRoles: boolean;
}

export interface RoleDefinition extends BaseEntity {
  name: string;
  roleType: RoleType;
  description: string;
  isSystemRole: boolean;
  permissions: StaffPermissions;
}

export interface Staff extends BaseEntity {
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'INVENTORY_STAFF' | 'BILLING' | 'CUSTOM';
  roleId?: string;
  roleType?: RoleType;
  roleName?: string;
  phone: string;
  pin: string; // 4-6 digit numeric PIN
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  active: boolean;
  email?: string;
  notes?: string;
  lastLoginAt?: number;
  avatarColor?: string;
}

export interface SecuritySettings extends BaseEntity {
  masterPin: string;
  requirePinOnAppLaunch: boolean;
  autoLockTimeoutMinutes: number; // 0 = never, 1, 5, 10, 15, 30
  allowBiometrics: boolean;
  lockOnInactivity: boolean;
  maxFailedPinAttempts: number;
  lockoutDurationMinutes: number;
}

export type AuditSeverity = 'INFO' | 'WARNING' | 'ALERT' | 'SECURITY';

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOCK_SCREEN'
  | 'UNLOCK_SCREEN'
  | 'FAILED_PIN_ATTEMPT'
  | 'BIOMETRIC_AUTH'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'ADMIN_OVERRIDE'
  | 'STAFF_SWITCH'
  | 'STAFF_CREATED'
  | 'STAFF_UPDATED'
  | 'STAFF_DELETED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'SECURITY_SETTINGS_UPDATED'
  | 'PIN_CHANGED'
  | 'BILL_CREATED'
  | 'BILL_CANCELLED'
  | 'DISCOUNT_APPLIED'
  | 'PURCHASE_INWARDED'
  | 'EXPENSE_RECORDED'
  | 'CASH_TRANSACTION'
  | 'STOCK_ADJUSTMENT'
  | 'REPORT_EXPORTED'
  | 'DATABASE_BACKUP'
  | 'DATABASE_RESTORE'
  | 'DATABASE_WIPED'
  | 'SYSTEM_INITIALIZATION';

export interface AuditLogItem extends BaseEntity {
  user: string;
  staffId?: string;
  role?: string;
  action: string;
  timestamp: number;
  recordType: string;
  recordId: string;
  severity?: AuditSeverity;
  description?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  notes?: string;
}

export type AuditLog = AuditLogItem;

export interface DocumentSequenceSettings extends BaseEntity {
  documentType: DocumentType;
  prefix: string;
  suffix: string;
  currentSequence: number;
}

export interface SalesLabelSettings extends BaseEntity {
  prefix: string; // Default "6"
  paperSize: string; // "50x30 mm", "40x30 mm", etc.
  barcodeType: 'CODE128' | 'QR';
  showBusinessName: boolean;
  showItemCode: boolean;
  showBarcode: boolean;
  labelQuantityRule: 'CEIL_QTY_DIV_6' | 'ONE_PER_PIECE' | 'MANUAL';
}

export interface PurchaseLabelSettings extends BaseEntity {
  enabled: boolean;
  prefix: string; // Default "786"
  paperSize: string;
  barcodeType: 'CODE128' | 'QR';
  showBusinessName: boolean;
  showProductName: boolean;
  showPurchaseCode: boolean;
  showPurchaseRate: boolean;
  showQuantity: boolean;
  showSupplier: boolean;
  showInvoice: boolean;
  showDate: boolean;
  showBatch: boolean;
  defaultMode: 'ONE_PER_PIECE' | 'ONE_PER_BUNDLE' | 'MANUAL';
}

export interface SystemStats {
  todaySalesPaise: number;
  todayCollectionPaise: number;
  todayExpensesPaise: number;
  outstandingReceivablesPaise: number;
  outstandingPayablesPaise: number;
  currentStockValuePaise: number;
  lowStockCount: number;
  pendingFollowUpsCount: number;
  totalBillsCount: number;
  totalCustomersCount: number;
  totalProductsCount: number;
  physicalCashBalancePaise: number;
}

export type PrintPaperSize = '58MM' | '80MM' | 'A5' | 'A4';
export type PrinterConnectionType = 'BLUETOOTH' | 'USB' | 'WIFI_LAN' | 'SYSTEM';
export type PrinterConnectionStatus = 'DISCONNECTED' | 'PAIRING' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface PrinterDevice extends BaseEntity {
  name: string;
  type: PrinterConnectionType;
  status: PrinterConnectionStatus;
  address?: string; // MAC address, USB VID/PID, or IP:Port
  paperWidth: '58MM' | '80MM' | 'A5' | 'A4';
  isDefault: boolean;
  batteryLevel?: number;
  lastConnectedAt?: number;
  model?: string;
}

export interface MasterPrintSettings extends BaseEntity {
  defaultPaperSize: PrintPaperSize;
  defaultCopies: number; // 1, 2, 3
  
  // Header Settings
  showBusinessName: boolean;
  businessName: string;
  showSubtitle: boolean;
  subtitle: string;
  showAddress: boolean;
  address: string;
  showPhone: boolean;
  phone: string;
  showGSTIN: boolean;
  gstin: string;
  showState: boolean;
  stateName: string;
  stateCode: string;

  // Customer & Transport Settings
  showCustomerMobile: boolean;
  showCustomerGSTIN: boolean;
  showTransportInfo: boolean;
  showMarka: boolean;
  showDeliveryStation: boolean;

  // Items Table Settings
  showItemCode: boolean;
  showHsnCode: boolean;
  showRate: boolean;
  showDiscountColumn: boolean;
  showGstColumn: boolean;

  // Financial & Ledger Breakdown
  showSubtotal: boolean;
  showTaxBreakup: boolean;
  showRoundOff: boolean;
  showAmountPaid: boolean;
  showPaymentMethod: boolean;
  showBillBalance: boolean;
  showPreviousDue: boolean;
  showNewTotalBalance: boolean;

  // Digital & Interactive (UPI QR)
  enableUpiQrCode: boolean;
  upiVpa: string;
  upiPayeeName: string;
  showBillBarcode: boolean;

  // Hardware Controls (ESC/POS)
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  feedLines: number;
  fontSize: 'COMPACT' | 'NORMAL' | 'LARGE';

  // Legal & Footer
  footerTerms1: string;
  footerTerms2: string;
  showSignatureBox: boolean;
  signatoryTitle: string;
}

export interface PrintJobLog extends BaseEntity {
  billId?: string;
  billNumber?: string;
  printerId: string;
  printerName: string;
  format: PrintPaperSize;
  isReprint: boolean;
  status: 'SUCCESS' | 'FAILED';
  timestamp: number;
}

// ==========================================
// BACKUP, IMPORT & EXPORT TYPES (PHASE 13)
// ==========================================

export interface DatabaseBackupPayload {
  version: number;
  exportedAt: number;
  exportedDate: string;
  business: string;
  businessId: string;
  source: string;
  checksum?: string;
  note?: string;
  tables: Record<string, any[]>;
}

export type AutoBackupFrequency = 'OFF' | 'EVERY_6_HOURS' | 'EVERY_12_HOURS' | 'DAILY' | 'WEEKLY';

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: AutoBackupFrequency;
  lastBackupAt?: number;
  nextBackupAt?: number;
  maxRetainedSnapshots: number;
  downloadLocalCopyOnAutoBackup: boolean;
}

export interface BackupHistoryEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  note: string;
  type: 'MANUAL' | 'AUTOMATIC';
  recordCounts: Record<string, number>;
  sizeBytes: number;
  checksum: string;
  payload: DatabaseBackupPayload;
}

export interface RestoreResult {
  success: boolean;
  restoredAt: number;
  tablesRestored: string[];
  totalRecordsRestored: number;
  error?: string;
  rolledBack?: boolean;
}

export type ImportEntityType = 
  | 'PRODUCTS' 
  | 'CUSTOMERS' 
  | 'SUPPLIERS' 
  | 'OPENING_BALANCES' 
  | 'OPENING_STOCK' 
  | 'TRANSPORT' 
  | 'HISTORICAL_RECORDS';

export type ImportFormat = 'CSV' | 'XLSX' | 'JSON';

export interface ImportErrorDetail {
  row: number;
  column?: string;
  value?: any;
  message: string;
}

export interface ImportValidationSummary {
  validRows: number;
  invalidRows: number;
  errors: ImportErrorDetail[];
  warnings: string[];
  sampleParsedRows: any[];
}

export interface ImportExecutionResult {
  success: boolean;
  entityType: ImportEntityType;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: ImportErrorDetail[];
  warnings: string[];
  rolledBack: boolean;
  timestamp: number;
}

export type ExportEntityType = 
  | 'SALES' 
  | 'BILLS' 
  | 'CUSTOMERS' 
  | 'LEDGER'
  | 'CUSTOMER_LEDGER'
  | 'SUPPLIER_LEDGER' 
  | 'PAYMENTS' 
  | 'PURCHASES' 
  | 'STOCK' 
  | 'EXPENSES' 
  | 'CRM' 
  | 'TRANSPORT' 
  | 'REPORTS'
  | 'ALL';

export type ExportFileFormat = 'XLSX' | 'CSV' | 'PDF';

export interface SyncQueueItem extends BaseEntity {
  table: string;
  entityId: string;
  action: 'UPSERT' | 'DELETE';
  data?: any;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount?: number;
  lastError?: string;
}

export interface CloudSyncSummary {
  success: boolean;
  syncedOutboundCount: number;
  syncedInboundCount: number;
  failedCount: number;
  timestamp: number;
  durationMs: number;
  errorMessage?: string;
}

