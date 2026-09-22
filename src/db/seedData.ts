import { 
  BusinessProfile, 
  Product, 
  Customer, 
  SalesLabelSettings, 
  PurchaseLabelSettings,
  DocumentSequenceSettings,
  Supplier,
  Bill,
  Purchase,
  CustomerLedgerTransaction,
  Expense,
  CashTransaction,
  TransportRecord,
  CRMFollowUp,
  MasterPrintSettings,
  PrinterDevice
} from '../types';
import { rupeesToPaise } from '../services/currency';

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  id: 'biz-original-modi-bags',
  businessId: 'biz-original-modi-bags',
  name: 'ORIGINAL MODI BAGS',
  tagline: 'Leading Wholesale Bag Manufacturers & Distributors',
  address: '3, AMARTALLA LANE',
  city: 'KOLKATA',
  state: 'WEST BENGAL',
  pincode: '700001',
  phone: '8240584877',
  currency: 'INR',
  currencySymbol: '₹',
  upiId: '8240584877@upi',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  syncStatus: 'LOCAL',
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-hypora',
    businessId: 'biz-original-modi-bags',
    productCode: 'BAG-HYP-01',
    name: 'HYPORA',
    category: 'Backpack',
    subcategory: 'Waterproof',
    size: 'Standard',
    colour: 'Black/Grey',
    purchaseRatePaise: rupeesToPaise(100),
    wholesaleRatePaise: rupeesToPaise(120),
    saleRatePaise: rupeesToPaise(120),
    mrpPaise: rupeesToPaise(250),
    gstPercentage: 0,
    hsn: '4202',
    openingStock: 100,
    currentStock: 100,
    minimumStock: 25,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  },
  {
    id: 'prod-club',
    businessId: 'biz-original-modi-bags',
    productCode: 'BAG-CLB-02',
    name: 'CLUB',
    category: 'Side Bag',
    subcategory: 'Canvas',
    size: 'Medium',
    colour: 'Navy Blue',
    purchaseRatePaise: rupeesToPaise(60),
    wholesaleRatePaise: rupeesToPaise(75),
    saleRatePaise: rupeesToPaise(75),
    mrpPaise: rupeesToPaise(150),
    gstPercentage: 0,
    hsn: '4202',
    openingStock: 80,
    currentStock: 80,
    minimumStock: 20,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  },
  {
    id: 'prod-schoolboy',
    businessId: 'biz-original-modi-bags',
    productCode: 'BAG-SCH-03',
    name: 'SCHOOLBOY',
    category: 'School Bag',
    subcategory: 'Heavy Duty',
    size: 'Large',
    colour: 'Royal Blue',
    purchaseRatePaise: rupeesToPaise(115),
    wholesaleRatePaise: rupeesToPaise(145),
    saleRatePaise: rupeesToPaise(145),
    mrpPaise: rupeesToPaise(300),
    gstPercentage: 0,
    hsn: '4202',
    openingStock: 150,
    currentStock: 150,
    minimumStock: 30,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-burrabazar-traders',
    businessId: 'biz-original-modi-bags',
    customerId: 'CUST-001',
    name: 'Burrabazar Traders',
    businessName: 'Burrabazar Bag House',
    mobile: '9830112233',
    whatsapp: '9830112233',
    address: '42, Canning Street',
    city: 'Kolkata',
    state: 'West Bengal',
    openingBalancePaise: rupeesToPaise(10000), // ₹10,000 opening credit
    currentOutstandingPaise: rupeesToPaise(10000),
    creditLimitPaise: rupeesToPaise(50000),
    preferredTransport: 'Kolkata Central Cargo',
    totalSalesPaise: 0,
    totalPaymentsPaise: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  }
];

export const DEFAULT_SALES_LABEL_SETTINGS: SalesLabelSettings = {
  id: 'sales-label-settings-default',
  businessId: 'biz-original-modi-bags',
  prefix: '6',
  paperSize: '50x30 mm',
  barcodeType: 'CODE128',
  showBusinessName: true,
  showItemCode: true,
  showBarcode: true,
  labelQuantityRule: 'CEIL_QTY_DIV_6',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  syncStatus: 'LOCAL',
};

export const DEFAULT_PURCHASE_LABEL_SETTINGS: PurchaseLabelSettings = {
  id: 'purchase-label-settings-default',
  businessId: 'biz-original-modi-bags',
  enabled: true,
  prefix: '786',
  paperSize: '50x30 mm',
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
  createdAt: Date.now(),
  updatedAt: Date.now(),
  syncStatus: 'LOCAL',
};

export const DEFAULT_SEQUENCES: DocumentSequenceSettings[] = [
  {
    id: 'seq-estimate',
    businessId: 'biz-original-modi-bags',
    documentType: 'ESTIMATE',
    prefix: 'EST-',
    suffix: '',
    currentSequence: 1001,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  },
  {
    id: 'seq-bill',
    businessId: 'biz-original-modi-bags',
    documentType: 'CASH_MEMO',
    prefix: 'BILL-',
    suffix: '',
    currentSequence: 2001,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  },
  {
    id: 'seq-invoice',
    businessId: 'biz-original-modi-bags',
    documentType: 'INVOICE',
    prefix: 'INV-',
    suffix: '',
    currentSequence: 3001,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-bengal-fabric',
    businessId: 'biz-original-modi-bags',
    supplierId: 'SUPP-001',
    name: 'Bengal Fabrics & Accessories',
    businessName: 'Bengal Bag Materials Pvt Ltd',
    mobile: '9831005544',
    whatsapp: '9831005544',
    address: '12, Raja Katra, Kolkata-700007',
    gstin: '19AABCB1234D1Z2',
    openingBalancePaise: rupeesToPaise(15000), // ₹15,000 payable
    currentOutstandingPaise: rupeesToPaise(15000),
    creditLimitPaise: rupeesToPaise(100000),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_PURCHASES: Purchase[] = [
  {
    id: 'purch-01',
    businessId: 'biz-original-modi-bags',
    supplierId: 'supp-bengal-fabric',
    supplierName: 'Bengal Fabrics & Accessories',
    purchaseInvoiceNumber: 'BFA/2026/089',
    date: Date.now() - 3600000 * 24 * 2, // 2 days ago
    items: [
      {
        id: 'pi-1',
        purchaseId: 'purch-01',
        productId: 'prod-hypora',
        productName: 'HYPORA',
        quantity: 100,
        purchaseRatePaise: rupeesToPaise(100),
        totalPaise: rupeesToPaise(10000)
      },
      {
        id: 'pi-2',
        purchaseId: 'purch-01',
        productId: 'prod-schoolboy',
        productName: 'SCHOOLBOY',
        quantity: 50,
        purchaseRatePaise: rupeesToPaise(115),
        totalPaise: rupeesToPaise(5750)
      }
    ],
    totalQuantity: 150,
    subtotalPaise: rupeesToPaise(15750),
    discountPaise: 0,
    taxPaise: 0,
    freightPaise: rupeesToPaise(250),
    grandTotalPaise: rupeesToPaise(16000),
    paidPaise: rupeesToPaise(1000),
    creditPaise: rupeesToPaise(15000),
    paymentMethod: 'CASH',
    transport: 'Local Van Cartage',
    notes: 'Direct from Bengal Fabrics Katra warehouse',
    isCancelled: false,
    createdAt: Date.now() - 3600000 * 24 * 2,
    updatedAt: Date.now() - 3600000 * 24 * 2,
    syncStatus: 'LOCAL'
  }
];

export const INITIAL_CUSTOMER_LEDGER: CustomerLedgerTransaction[] = [
  {
    id: 'cl-tx-01',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-burrabazar-traders',
    date: Date.now() - 3600000 * 48,
    type: 'OPENING_BALANCE',
    description: 'Opening balance brought forward',
    debitPaise: rupeesToPaise(10000),
    creditPaise: 0,
    runningBalancePaise: rupeesToPaise(10000),
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 48,
    syncStatus: 'LOCAL'
  },
  {
    id: 'cl-tx-02',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-burrabazar-traders',
    date: Date.now() - 3600000 * 2,
    type: 'CREDIT_SALE',
    referenceDocumentId: 'bill-sample-01',
    referenceDocumentNumber: 'BILL-2001',
    description: 'Sale against Bill #BILL-2001 (Net balance due)',
    debitPaise: rupeesToPaise(2065),
    creditPaise: 0,
    runningBalancePaise: rupeesToPaise(12065),
    paymentMethod: 'CREDIT',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    syncStatus: 'LOCAL'
  }
];

export const INITIAL_BILLS: Bill[] = [
  {
    id: 'bill-sample-01',
    businessId: 'biz-original-modi-bags',
    documentType: 'CASH_MEMO',
    billNumber: 'BILL-2001',
    date: Date.now() - 3600000 * 2, // 2 hours ago
    customerId: 'cust-burrabazar-traders',
    customerName: 'Burrabazar Traders',
    customerMobile: '9830112233',
    items: [
      {
        id: 'item-1',
        sNo: 1,
        productId: 'prod-hypora',
        isPermanentProduct: true,
        details: 'HYPORA',
        quantity: 12,
        ratePaise: rupeesToPaise(120),
        totalPaise: rupeesToPaise(1440),
      },
      {
        id: 'item-2',
        sNo: 2,
        productId: 'prod-club',
        isPermanentProduct: true,
        details: 'CLUB',
        quantity: 6,
        ratePaise: rupeesToPaise(75),
        totalPaise: rupeesToPaise(450),
      },
      {
        id: 'item-3',
        sNo: 3,
        productId: 'prod-schoolboy',
        isPermanentProduct: true,
        details: 'SCHOOLBOY',
        quantity: 15,
        ratePaise: rupeesToPaise(145),
        totalPaise: rupeesToPaise(2175),
      }
    ],
    totalQuantity: 33,
    subtotalPaise: rupeesToPaise(4065),
    discountPaise: 0,
    gstPaise: 0,
    roundOffPaise: 0,
    grandTotalPaise: rupeesToPaise(4065),
    paidPaise: rupeesToPaise(2000), // Paid ₹2000 cash
    balancePaise: rupeesToPaise(2065), // Credit balance ₹2065
    previousDuePaise: rupeesToPaise(10000),
    newBalancePaise: rupeesToPaise(12065),
    paymentMethod: 'CASH',
    notes: 'Dispatched via Kolkata Central Cargo',
    isCancelled: false,
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-01',
    businessId: 'biz-original-modi-bags',
    date: Date.now() - 3600000 * 4,
    category: 'Packaging',
    description: 'Heavy duty packaging tape and roll cartons',
    amountPaise: rupeesToPaise(350),
    paymentMethod: 'CASH',
    createdAt: Date.now() - 3600000 * 4,
    updatedAt: Date.now() - 3600000 * 4,
    syncStatus: 'LOCAL',
  },
  {
    id: 'exp-02',
    businessId: 'biz-original-modi-bags',
    date: Date.now() - 3600000 * 6,
    category: 'Transport',
    description: 'Local cartage van from workshop to Amartalla lane',
    amountPaise: rupeesToPaise(500),
    paymentMethod: 'CASH',
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now() - 3600000 * 6,
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_CASH_TRANSACTIONS: CashTransaction[] = [
  {
    id: 'cash-open-01',
    businessId: 'biz-original-modi-bags',
    date: Date.now() - 3600000 * 8,
    type: 'OPENING_CASH',
    description: 'Morning Cash Drawer Opening Balance',
    inflowPaise: rupeesToPaise(5000),
    outflowPaise: 0,
    runningCashBalancePaise: rupeesToPaise(5000),
    createdAt: Date.now() - 3600000 * 8,
    updatedAt: Date.now() - 3600000 * 8,
    syncStatus: 'LOCAL',
  },
  {
    id: 'cash-sale-01',
    businessId: 'biz-original-modi-bags',
    date: Date.now() - 3600000 * 2,
    type: 'CASH_SALE',
    description: 'Cash received for Bill #BILL-2001',
    inflowPaise: rupeesToPaise(2000),
    outflowPaise: 0,
    runningCashBalancePaise: rupeesToPaise(7000),
    referenceId: 'bill-sample-01',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    syncStatus: 'LOCAL',
  },
  {
    id: 'cash-exp-01',
    businessId: 'biz-original-modi-bags',
    date: Date.now() - 3600000 * 4,
    type: 'CASH_EXPENSE',
    description: 'Cash payment for Packaging',
    inflowPaise: 0,
    outflowPaise: rupeesToPaise(350),
    runningCashBalancePaise: rupeesToPaise(6650),
    createdAt: Date.now() - 3600000 * 4,
    updatedAt: Date.now() - 3600000 * 4,
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_TRANSPORTS: TransportRecord[] = [
  {
    id: 'trans-01',
    businessId: 'biz-original-modi-bags',
    name: 'Kolkata Central Cargo Service',
    destination: 'Siliguri / North Bengal',
    branch: 'Burrabazar Branch, Canning St',
    contactPerson: 'Manoj Sharma',
    phone: '9830556677',
    alternatePhone: '033-22345678',
    address: '15, Pollock Street, Kolkata-700001',
    isFavorite: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  },
  {
    id: 'trans-02',
    businessId: 'biz-original-modi-bags',
    name: 'Maa Tara Roadways',
    destination: 'Asansol / Durgapur / Dhanbad',
    branch: 'Posta Hub',
    contactPerson: 'Alok Roy',
    phone: '9831998877',
    address: 'Posta Bazaar, Kolkata-700007',
    isFavorite: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  }
];

export const INITIAL_CRM_FOLLOWUPS: CRMFollowUp[] = [
  {
    id: 'crm-01',
    businessId: 'biz-original-modi-bags',
    customerId: 'cust-burrabazar-traders',
    customerName: 'Burrabazar Traders',
    customerMobile: '9830112233',
    type: 'PAYMENT',
    date: Date.now(),
    scheduledDate: Date.now(), // Scheduled for today
    nextDate: Date.now() + 86400000 * 2, // 2 days from now
    notes: 'Collect remaining balance of ₹2,065 against Bill #BILL-2001',
    status: 'PENDING',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL',
  }
];

export const DEFAULT_MASTER_PRINT_SETTINGS: MasterPrintSettings = {
  id: 'print-settings-default',
  businessId: 'biz-original-modi-bags',
  defaultPaperSize: '80MM',
  defaultCopies: 1,

  // Header Settings
  showBusinessName: true,
  businessName: 'ORIGINAL MODI BAGS',
  showSubtitle: true,
  subtitle: 'WHOLESALE BAG MANUFACTURER & TRADERS',
  showAddress: true,
  address: '3, AMARTALLA LANE, KOLKATA - 700001',
  showPhone: true,
  phone: '8240584877',
  showGSTIN: true,
  gstin: '19ABCDE1234F1Z5',
  showState: true,
  stateName: 'WEST BENGAL',
  stateCode: '19',

  // Customer & Transport Settings
  showCustomerMobile: true,
  showCustomerGSTIN: true,
  showTransportInfo: true,
  showMarka: true,
  showDeliveryStation: true,

  // Items Table Settings
  showItemCode: true,
  showHsnCode: true,
  showRate: true,
  showDiscountColumn: true,
  showGstColumn: true,

  // Financial & Ledger Breakdown
  showSubtotal: true,
  showTaxBreakup: true,
  showRoundOff: true,
  showAmountPaid: true,
  showPaymentMethod: true,
  showBillBalance: true,
  showPreviousDue: true,
  showNewTotalBalance: true,

  // Digital & Interactive (UPI QR)
  enableUpiQrCode: true,
  upiVpa: '8240584877@upi',
  upiPayeeName: 'ORIGINAL MODI BAGS',
  showBillBarcode: true,

  // Hardware Controls (ESC/POS)
  autoCutPaper: true,
  openCashDrawer: false,
  feedLines: 3,
  fontSize: 'NORMAL',

  // Legal & Footer
  footerTerms1: 'Goods once sold will not be taken back without bill.',
  footerTerms2: 'Subject to Kolkata Jurisdiction only.',
  showSignatureBox: true,
  signatoryTitle: 'For ORIGINAL MODI BAGS',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  syncStatus: 'LOCAL'
};

export const INITIAL_PRINTERS: PrinterDevice[] = [
  {
    id: 'printer-bt-01',
    businessId: 'biz-original-modi-bags',
    name: 'TVS RP-3160 Gold 80mm BT',
    type: 'BLUETOOTH',
    status: 'CONNECTED',
    address: '00:11:22:33:44:55',
    paperWidth: '80MM',
    isDefault: true,
    batteryLevel: 95,
    model: 'RP-3160 Gold Thermal',
    lastConnectedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  },
  {
    id: 'printer-bt-02',
    businessId: 'biz-original-modi-bags',
    name: 'Everycom EC-58 Portable BT',
    type: 'BLUETOOTH',
    status: 'DISCONNECTED',
    address: '88:25:83:F1:4D:21',
    paperWidth: '58MM',
    isDefault: false,
    batteryLevel: 80,
    model: 'EC-58 Mini POS',
    lastConnectedAt: Date.now() - 3600000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  },
  {
    id: 'printer-usb-01',
    businessId: 'biz-original-modi-bags',
    name: 'Epson TM-T82X USB POS',
    type: 'USB',
    status: 'DISCONNECTED',
    address: 'VID_04B8&PID_0E15',
    paperWidth: '80MM',
    isDefault: false,
    model: 'TM-T82X Heavy Duty',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  },
  {
    id: 'printer-lan-01',
    businessId: 'biz-original-modi-bags',
    name: 'Posta Godown Network Printer',
    type: 'WIFI_LAN',
    status: 'DISCONNECTED',
    address: '192.168.1.150:9100',
    paperWidth: 'A4',
    isDefault: false,
    model: 'HP LaserJet M1005 (Raw 9100)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  }
];


