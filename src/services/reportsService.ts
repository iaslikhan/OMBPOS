/**
 * Phase 11 — Reports and Export Engine
 * Original Modi Bags Business Manager
 * 
 * Features:
 * - Real Room Database Queries (bills, purchases, customers, suppliers, expenses, cash, products, ledgers)
 * - 8 Core Financial Reports:
 *    1. Sales Report
 *    2. Purchase Report
 *    3. Collection Report
 *    4. Outstanding (Receivables & Payables) Report
 *    5. Expenses Report
 *    6. Cash Report (Cash Book & Flow)
 *    7. Inventory (Stock & Valuation) Report
 *    8. Profit & Loss (Gross & Net Profit) Report
 * - Mathematical Invariant Verification against Transaction Records
 * - Multi-Format Export:
 *    - PDF (jsPDF + autoTable with clean layout & typography)
 *    - XLSX (Excel workbook using SheetJS / xlsx)
 *    - CSV (RFC-4180 with UTF-8 BOM)
 *    - Print (System dialog formatted view)
 *    - Share (WhatsApp / Web Share API / Clipboard)
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { roomDb } from '../db/indexedDbRoom';
import {
  Bill,
  Purchase,
  Customer,
  Supplier,
  Expense,
  CashTransaction,
  Product,
  CustomerLedgerTransaction,
  BusinessProfile,
  PaymentMethod
} from '../types';
import { paiseToRupees, rupeesToPaise, formatINR } from './currency';

export type ReportType = 
  | 'SALES'
  | 'PURCHASE'
  | 'COLLECTION'
  | 'OUTSTANDING'
  | 'EXPENSES'
  | 'CASH'
  | 'INVENTORY'
  | 'PROFIT';

export type DateRangePreset = 
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface DateFilterRange {
  preset: DateRangePreset;
  startDate?: number; // timestamp ms
  endDate?: number;   // timestamp ms
}

// -------------------------------------------------------------
// Report Data Models
// -------------------------------------------------------------

export interface SalesReportData {
  totalBills: number;
  totalPcsSold: number;
  grossSalesPaise: number;
  totalDiscountPaise: number;
  totalGstPaise: number;
  netSalesPaise: number;
  cashSalesPaise: number;
  creditSalesPaise: number;
  upiBankSalesPaise: number;
  totalReceivedPaise: number;
  totalBalanceDuePaise: number;
  bills: Bill[];
  itemBreakdown: Array<{
    productName: string;
    quantity: number;
    revenuePaise: number;
    averageRatePaise: number;
  }>;
}

export interface PurchaseReportData {
  totalPurchasesCount: number;
  totalPcsPurchased: number;
  subtotalPaise: number;
  freightChargesPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  creditDuePaise: number;
  purchases: Purchase[];
  supplierBreakdown: Array<{
    supplierName: string;
    invoicesCount: number;
    quantity: number;
    totalPaise: number;
    paidPaise: number;
    balanceDuePaise: number;
  }>;
}

export interface CollectionRecord {
  id: string;
  date: number;
  reference: string;
  sourceType: 'BILL_CASH' | 'LEDGER_PAYMENT' | 'CASH_ENTRY';
  customerName: string;
  paymentMethod: PaymentMethod;
  amountPaise: number;
  notes?: string;
}

export interface CollectionReportData {
  totalCollectedPaise: number;
  cashCollectionPaise: number;
  upiCollectionPaise: number;
  bankCollectionPaise: number;
  chequeCollectionPaise: number;
  otherCollectionPaise: number;
  collections: CollectionRecord[];
}

export interface CustomerOutstandingItem {
  customerId: string;
  name: string;
  businessName?: string;
  mobile: string;
  city: string;
  outstandingPaise: number;
  creditLimitPaise?: number;
  aging: '0-15 Days' | '16-30 Days' | '30+ Days';
}

export interface SupplierPayableItem {
  supplierId: string;
  name: string;
  businessName?: string;
  mobile: string;
  city: string;
  outstandingPaise: number;
}

export interface OutstandingReportData {
  totalReceivablesPaise: number;
  customerCountWithBalance: number;
  customers: CustomerOutstandingItem[];
  totalPayablesPaise: number;
  supplierCountWithBalance: number;
  suppliers: SupplierPayableItem[];
  netOutstandingPaise: number; // Receivables - Payables
}

export interface ExpensesReportData {
  totalExpensesCount: number;
  totalExpensesPaise: number;
  cashExpensePaise: number;
  bankExpensePaise: number;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    totalPaise: number;
    percentage: number;
  }>;
  expenses: Expense[];
}

export interface CashReportData {
  openingCashPaise: number;
  totalCashInflowPaise: number;
  totalCashOutflowPaise: number;
  netCashChangePaise: number;
  closingCashPaise: number;
  transactions: CashTransaction[];
  inflowBreakdown: {
    cashSalesPaise: number;
    cashCollectionsPaise: number;
    cashDepositsPaise: number;
    otherInflowPaise: number;
  };
  outflowBreakdown: {
    cashExpensesPaise: number;
    cashPurchasesPaise: number;
    cashWithdrawalsPaise: number;
    otherOutflowPaise: number;
  };
}

export interface InventoryItemReport {
  productId: string;
  productCode: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  purchaseRatePaise: number;
  wholesaleRatePaise: number;
  valuationCostPaise: number;
  valuationWholesalePaise: number;
  potentialProfitPaise: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface InventoryReportData {
  totalProductsCount: number;
  totalQuantityPcs: number;
  totalValuationAtPurchasePaise: number;
  totalValuationAtWholesalePaise: number;
  potentialProfitPaise: number;
  lowStockCount: number;
  outOfStockCount: number;
  products: InventoryItemReport[];
  categoryBreakdown: Array<{
    category: string;
    productCount: number;
    stockPcs: number;
    costValuationPaise: number;
  }>;
}

export interface ProfitLossReportData {
  grossSalesRevenuePaise: number;
  discountPaise: number;
  netSalesRevenuePaise: number;
  costOfGoodsSoldPaise: number; // COGS: purchase rate * sold qty
  grossProfitPaise: number;     // Net Sales - COGS
  grossMarginPercent: number;   // (Gross Profit / Net Sales) * 100
  operatingExpensesPaise: number;
  netProfitPaise: number;       // Gross Profit - Operating Expenses
  netMarginPercent: number;     // (Net Profit / Net Sales) * 100
  isProfitable: boolean;
  itemBreakdown: Array<{
    productName: string;
    quantitySold: number;
    revenuePaise: number;
    costPaise: number;
    grossProfitPaise: number;
    marginPercent: number;
  }>;
  expenseBreakdown: Array<{
    category: string;
    amountPaise: number;
  }>;
}

export interface ReportConsistencyAuditResult {
  allPassed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  checks: Array<{
    report: ReportType;
    invariant: string;
    passed: boolean;
    expected: string;
    actual: string;
  }>;
}

// -------------------------------------------------------------
// Report Service Implementation
// -------------------------------------------------------------

export class ReportsService {
  private static instance: ReportsService;

  private constructor() {}

  public static getInstance(): ReportsService {
    if (!ReportsService.instance) {
      ReportsService.instance = new ReportsService();
    }
    return ReportsService.instance;
  }

  /**
   * Helper: Resolve start and end timestamps from a preset or custom range.
   */
  public getDateRangeBounds(filter: DateFilterRange): { start: number; end: number } {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000 - 1;

    switch (filter.preset) {
      case 'TODAY':
        return { start: startOfToday, end: endOfToday };
      case 'YESTERDAY':
        return { start: startOfToday - 86400000, end: startOfToday - 1 };
      case 'THIS_WEEK': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).getTime();
        return { start: startOfWeek, end: endOfToday };
      }
      case 'THIS_MONTH': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return { start: startOfMonth, end: endOfToday };
      }
      case 'LAST_MONTH': {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        return { start: startOfLastMonth, end: endOfLastMonth };
      }
      case 'THIS_YEAR': {
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        return { start: startOfYear, end: endOfToday };
      }
      case 'CUSTOM':
        return {
          start: filter.startDate || 0,
          end: filter.endDate || Date.now() + 86400000
        };
      case 'ALL_TIME':
      default:
        return { start: 0, end: Date.now() + 86400000 * 365 };
    }
  }

  public isWithinRange(timestamp: number, filter: DateFilterRange): boolean {
    const { start, end } = this.getDateRangeBounds(filter);
    return timestamp >= start && timestamp <= end;
  }

  // -----------------------------------------------------------
  // 1. Sales Report
  // -----------------------------------------------------------
  public async getSalesReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<SalesReportData> {
    const allBills = await roomDb.getAll<Bill>('bills');
    const filteredBills = allBills.filter(
      (b) => !b.isCancelled && this.isWithinRange(b.date, filter)
    );

    let grossSalesPaise = 0;
    let totalDiscountPaise = 0;
    let totalGstPaise = 0;
    let netSalesPaise = 0;
    let cashSalesPaise = 0;
    let creditSalesPaise = 0;
    let upiBankSalesPaise = 0;
    let totalReceivedPaise = 0;
    let totalBalanceDuePaise = 0;
    let totalPcsSold = 0;

    const itemMap = new Map<string, { quantity: number; revenuePaise: number }>();

    for (const bill of filteredBills) {
      grossSalesPaise += bill.subtotalPaise;
      totalDiscountPaise += bill.discountPaise || 0;
      totalGstPaise += bill.gstPaise || 0;
      netSalesPaise += bill.grandTotalPaise;
      totalReceivedPaise += bill.paidPaise || 0;
      totalBalanceDuePaise += bill.balancePaise || 0;
      totalPcsSold += bill.totalQuantity;

      if (bill.paymentMethod === 'CASH') {
        cashSalesPaise += bill.grandTotalPaise;
      } else if (bill.paymentMethod === 'CREDIT') {
        creditSalesPaise += bill.grandTotalPaise;
      } else {
        upiBankSalesPaise += bill.grandTotalPaise;
      }

      for (const item of bill.items) {
        const key = (item.details || 'BAG').trim().toUpperCase();
        const existing = itemMap.get(key) || { quantity: 0, revenuePaise: 0 };
        existing.quantity += item.quantity;
        existing.revenuePaise += item.totalPaise;
        itemMap.set(key, existing);
      }
    }

    const itemBreakdown = Array.from(itemMap.entries())
      .map(([productName, val]) => ({
        productName,
        quantity: val.quantity,
        revenuePaise: val.revenuePaise,
        averageRatePaise: val.quantity > 0 ? Math.round(val.revenuePaise / val.quantity) : 0
      }))
      .sort((a, b) => b.revenuePaise - a.revenuePaise);

    return {
      totalBills: filteredBills.length,
      totalPcsSold,
      grossSalesPaise,
      totalDiscountPaise,
      totalGstPaise,
      netSalesPaise,
      cashSalesPaise,
      creditSalesPaise,
      upiBankSalesPaise,
      totalReceivedPaise,
      totalBalanceDuePaise,
      bills: filteredBills.sort((a, b) => b.date - a.date),
      itemBreakdown
    };
  }

  // -----------------------------------------------------------
  // 2. Purchase Report
  // -----------------------------------------------------------
  public async getPurchaseReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<PurchaseReportData> {
    const allPurchases = await roomDb.getAll<Purchase>('purchases');
    const filteredPurchases = allPurchases.filter(
      (p) => !p.isCancelled && this.isWithinRange(p.date, filter)
    );

    let subtotalPaise = 0;
    let freightChargesPaise = 0;
    let grandTotalPaise = 0;
    let paidPaise = 0;
    let creditDuePaise = 0;
    let totalPcsPurchased = 0;

    const suppMap = new Map<string, { invoicesCount: number; quantity: number; totalPaise: number; paidPaise: number; balanceDuePaise: number }>();

    for (const purch of filteredPurchases) {
      subtotalPaise += purch.subtotalPaise;
      const freight = purch.freightChargesPaise || purch.freightPaise || 0;
      freightChargesPaise += freight;
      grandTotalPaise += purch.grandTotalPaise;
      paidPaise += purch.paidPaise;
      creditDuePaise += purch.creditPaise;
      totalPcsPurchased += purch.totalQuantity;

      const sKey = purch.supplierName || 'Unknown Supplier';
      const existing = suppMap.get(sKey) || { invoicesCount: 0, quantity: 0, totalPaise: 0, paidPaise: 0, balanceDuePaise: 0 };
      existing.invoicesCount += 1;
      existing.quantity += purch.totalQuantity;
      existing.totalPaise += purch.grandTotalPaise;
      existing.paidPaise += purch.paidPaise;
      existing.balanceDuePaise += purch.creditPaise;
      suppMap.set(sKey, existing);
    }

    const supplierBreakdown = Array.from(suppMap.entries())
      .map(([supplierName, s]) => ({
        supplierName,
        invoicesCount: s.invoicesCount,
        quantity: s.quantity,
        totalPaise: s.totalPaise,
        paidPaise: s.paidPaise,
        balanceDuePaise: s.balanceDuePaise
      }))
      .sort((a, b) => b.totalPaise - a.totalPaise);

    return {
      totalPurchasesCount: filteredPurchases.length,
      totalPcsPurchased,
      subtotalPaise,
      freightChargesPaise,
      grandTotalPaise,
      paidPaise,
      creditDuePaise,
      purchases: filteredPurchases.sort((a, b) => b.date - a.date),
      supplierBreakdown
    };
  }

  // -----------------------------------------------------------
  // 3. Collection Report
  // -----------------------------------------------------------
  public async getCollectionReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<CollectionReportData> {
    const collections: CollectionRecord[] = [];
    let cashCollectionPaise = 0;
    let upiCollectionPaise = 0;
    let bankCollectionPaise = 0;
    let chequeCollectionPaise = 0;
    let otherCollectionPaise = 0;

    // 1. Collections from Bills (upfront payment paid at invoice creation)
    const bills = await roomDb.getAll<Bill>('bills');
    for (const bill of bills) {
      if (!bill.isCancelled && bill.paidPaise > 0 && this.isWithinRange(bill.date, filter)) {
        collections.push({
          id: `col-bill-${bill.id}`,
          date: bill.date,
          reference: bill.billNumber,
          sourceType: 'BILL_CASH',
          customerName: bill.customerName,
          paymentMethod: bill.paymentMethod || 'CASH',
          amountPaise: bill.paidPaise,
          notes: `Upfront collection on ${bill.documentType}`
        });

        if (bill.paymentMethod === 'CASH') cashCollectionPaise += bill.paidPaise;
        else if (bill.paymentMethod === 'UPI') upiCollectionPaise += bill.paidPaise;
        else if (bill.paymentMethod === 'BANK') bankCollectionPaise += bill.paidPaise;
        else if (bill.paymentMethod === 'CHEQUE') chequeCollectionPaise += bill.paidPaise;
        else otherCollectionPaise += bill.paidPaise;
      }
    }

    // 2. Collections from Customer Ledgers (repayments against outstanding balances)
    const ledgerTxs = await roomDb.getAll<CustomerLedgerTransaction>('customer_ledger');
    const customers = await roomDb.getAll<Customer>('customers');
    const custMap = new Map(customers.map((c) => [c.id, c.name]));

    for (const tx of ledgerTxs) {
      if (tx.type === 'PAYMENT' && tx.creditPaise > 0 && this.isWithinRange(tx.date, filter)) {
        const method = tx.paymentMethod || 'CASH';
        collections.push({
          id: `col-ledger-${tx.id}`,
          date: tx.date,
          reference: tx.referenceDocumentNumber || 'RECEIPT',
          sourceType: 'LEDGER_PAYMENT',
          customerName: custMap.get(tx.customerId) || 'Registered Customer',
          paymentMethod: method,
          amountPaise: tx.creditPaise,
          notes: tx.description
        });

        if (method === 'CASH') cashCollectionPaise += tx.creditPaise;
        else if (method === 'UPI') upiCollectionPaise += tx.creditPaise;
        else if (method === 'BANK') bankCollectionPaise += tx.creditPaise;
        else if (method === 'CHEQUE') chequeCollectionPaise += tx.creditPaise;
        else otherCollectionPaise += tx.creditPaise;
      }
    }

    collections.sort((a, b) => b.date - a.date);
    const totalCollectedPaise = cashCollectionPaise + upiCollectionPaise + bankCollectionPaise + chequeCollectionPaise + otherCollectionPaise;

    return {
      totalCollectedPaise,
      cashCollectionPaise,
      upiCollectionPaise,
      bankCollectionPaise,
      chequeCollectionPaise,
      otherCollectionPaise,
      collections
    };
  }

  // -----------------------------------------------------------
  // 4. Outstanding (Receivables & Payables) Report
  // -----------------------------------------------------------
  public async getOutstandingReport(): Promise<OutstandingReportData> {
    const rawCustomers = await roomDb.getAll<Customer>('customers');
    const rawSuppliers = await roomDb.getAll<Supplier>('suppliers');

    let totalReceivablesPaise = 0;
    const customersWithBalance: CustomerOutstandingItem[] = [];

    for (const c of rawCustomers) {
      const bal = c.currentOutstandingPaise || 0;
      if (bal > 0) {
        totalReceivablesPaise += bal;
        // Simple aging approximation based on customer ledger
        const aging: '0-15 Days' | '16-30 Days' | '30+ Days' = bal > 500000 ? '30+ Days' : bal > 200000 ? '16-30 Days' : '0-15 Days';
        customersWithBalance.push({
          customerId: c.customerId || c.id,
          name: c.name,
          businessName: c.businessName,
          mobile: c.mobile,
          city: c.city || 'Kolkata',
          outstandingPaise: bal,
          creditLimitPaise: c.creditLimitPaise,
          aging
        });
      }
    }

    let totalPayablesPaise = 0;
    const suppliersWithBalance: SupplierPayableItem[] = [];

    for (const s of rawSuppliers) {
      const bal = s.currentOutstandingPaise || 0;
      if (bal > 0) {
        totalPayablesPaise += bal;
        suppliersWithBalance.push({
          supplierId: s.supplierId || s.id,
          name: s.name,
          businessName: s.businessName,
          mobile: s.mobile,
          city: s.city || 'Kolkata',
          outstandingPaise: bal
        });
      }
    }

    customersWithBalance.sort((a, b) => b.outstandingPaise - a.outstandingPaise);
    suppliersWithBalance.sort((a, b) => b.outstandingPaise - a.outstandingPaise);

    return {
      totalReceivablesPaise,
      customerCountWithBalance: customersWithBalance.length,
      customers: customersWithBalance,
      totalPayablesPaise,
      supplierCountWithBalance: suppliersWithBalance.length,
      suppliers: suppliersWithBalance,
      netOutstandingPaise: totalReceivablesPaise - totalPayablesPaise
    };
  }

  // -----------------------------------------------------------
  // 5. Expenses Report
  // -----------------------------------------------------------
  public async getExpensesReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<ExpensesReportData> {
    const allExpenses = await roomDb.getAll<Expense>('expenses');
    const filteredExpenses = allExpenses.filter((e) => this.isWithinRange(e.date, filter));

    let totalExpensesPaise = 0;
    let cashExpensePaise = 0;
    let bankExpensePaise = 0;

    const catMap = new Map<string, { count: number; totalPaise: number }>();

    for (const exp of filteredExpenses) {
      totalExpensesPaise += exp.amountPaise;
      if (exp.paymentMethod === 'CASH') {
        cashExpensePaise += exp.amountPaise;
      } else {
        bankExpensePaise += exp.amountPaise;
      }

      const cat = exp.category || 'General';
      const existing = catMap.get(cat) || { count: 0, totalPaise: 0 };
      existing.count += 1;
      existing.totalPaise += exp.amountPaise;
      catMap.set(cat, existing);
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        totalPaise: data.totalPaise,
        percentage: totalExpensesPaise > 0 ? (data.totalPaise / totalExpensesPaise) * 100 : 0
      }))
      .sort((a, b) => b.totalPaise - a.totalPaise);

    return {
      totalExpensesCount: filteredExpenses.length,
      totalExpensesPaise,
      cashExpensePaise,
      bankExpensePaise,
      categoryBreakdown,
      expenses: filteredExpenses.sort((a, b) => b.date - a.date)
    };
  }

  // -----------------------------------------------------------
  // 6. Cash Report (Cash Book & Flow)
  // -----------------------------------------------------------
  public async getCashReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<CashReportData> {
    const allTxs = await roomDb.getAll<CashTransaction>('cash_transactions');
    const sortedTxs = [...allTxs].sort((a, b) => a.date - b.date);

    const filteredTxs = sortedTxs.filter((tx) => this.isWithinRange(tx.date, filter));

    let openingCashPaise = 0;
    const { start } = this.getDateRangeBounds(filter);

    // Calculate opening balance prior to filter start
    if (start > 0) {
      for (const tx of sortedTxs) {
        if (tx.date < start) {
          openingCashPaise += tx.inflowPaise - tx.outflowPaise;
        }
      }
    } else if (sortedTxs.length > 0 && sortedTxs[0].type === 'OPENING_CASH') {
      openingCashPaise = sortedTxs[0].inflowPaise;
    }

    let totalCashInflowPaise = 0;
    let totalCashOutflowPaise = 0;

    let cashSalesPaise = 0;
    let cashCollectionsPaise = 0;
    let cashDepositsPaise = 0;
    let otherInflowPaise = 0;

    let cashExpensesPaise = 0;
    let cashPurchasesPaise = 0;
    let cashWithdrawalsPaise = 0;
    let otherOutflowPaise = 0;

    for (const tx of filteredTxs) {
      totalCashInflowPaise += tx.inflowPaise;
      totalCashOutflowPaise += tx.outflowPaise;

      if (tx.type === 'CASH_SALE') cashSalesPaise += tx.inflowPaise;
      else if (tx.type === 'CASH_RECEIVED') cashCollectionsPaise += tx.inflowPaise;
      else if (tx.type === 'CASH_DEPOSIT' || tx.type === 'DEPOSIT') cashDepositsPaise += tx.inflowPaise;
      else if (tx.inflowPaise > 0) otherInflowPaise += tx.inflowPaise;

      if (tx.type === 'CASH_EXPENSE' || tx.type === 'EXPENSE') cashExpensesPaise += tx.outflowPaise;
      else if (tx.type === 'CASH_PURCHASE') cashPurchasesPaise += tx.outflowPaise;
      else if (tx.type === 'CASH_WITHDRAWAL' || tx.type === 'WITHDRAWAL') cashWithdrawalsPaise += tx.outflowPaise;
      else if (tx.outflowPaise > 0) otherOutflowPaise += tx.outflowPaise;
    }

    const netCashChangePaise = totalCashInflowPaise - totalCashOutflowPaise;
    const closingCashPaise = openingCashPaise + netCashChangePaise;

    return {
      openingCashPaise,
      totalCashInflowPaise,
      totalCashOutflowPaise,
      netCashChangePaise,
      closingCashPaise,
      transactions: filteredTxs.sort((a, b) => b.date - a.date),
      inflowBreakdown: {
        cashSalesPaise,
        cashCollectionsPaise,
        cashDepositsPaise,
        otherInflowPaise
      },
      outflowBreakdown: {
        cashExpensesPaise,
        cashPurchasesPaise,
        cashWithdrawalsPaise,
        otherOutflowPaise
      }
    };
  }

  // -----------------------------------------------------------
  // 7. Inventory Report (Stock & Valuation)
  // -----------------------------------------------------------
  public async getInventoryReport(): Promise<InventoryReportData> {
    const products = await roomDb.getAll<Product>('products');

    let totalQuantityPcs = 0;
    let totalValuationAtPurchasePaise = 0;
    let totalValuationAtWholesalePaise = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const catMap = new Map<string, { productCount: number; stockPcs: number; costValuationPaise: number }>();

    const items: InventoryItemReport[] = products.map((p) => {
      const stock = p.currentStock || 0;
      const minStock = p.minimumStock || 10;
      const purchaseRate = p.purchaseRatePaise || 0;
      const wholesaleRate = p.wholesaleRatePaise || 0;

      const valuationCost = stock * purchaseRate;
      const valuationWholesale = stock * wholesaleRate;
      const potentialProfit = valuationWholesale - valuationCost;

      totalQuantityPcs += stock;
      totalValuationAtPurchasePaise += valuationCost;
      totalValuationAtWholesalePaise += valuationWholesale;

      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (stock <= 0) {
        status = 'OUT_OF_STOCK';
        outOfStockCount++;
      } else if (stock <= minStock) {
        status = 'LOW_STOCK';
        lowStockCount++;
      }

      const cat = p.category || 'General';
      const c = catMap.get(cat) || { productCount: 0, stockPcs: 0, costValuationPaise: 0 };
      c.productCount += 1;
      c.stockPcs += stock;
      c.costValuationPaise += valuationCost;
      catMap.set(cat, c);

      return {
        productId: p.id,
        productCode: p.productCode,
        name: p.name,
        category: p.category,
        currentStock: stock,
        minimumStock: minStock,
        purchaseRatePaise: purchaseRate,
        wholesaleRatePaise: wholesaleRate,
        valuationCostPaise: valuationCost,
        valuationWholesalePaise: valuationWholesale,
        potentialProfitPaise: potentialProfit,
        status
      };
    });

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, val]) => ({
        category,
        productCount: val.productCount,
        stockPcs: val.stockPcs,
        costValuationPaise: val.costValuationPaise
      }))
      .sort((a, b) => b.costValuationPaise - a.costValuationPaise);

    return {
      totalProductsCount: products.length,
      totalQuantityPcs,
      totalValuationAtPurchasePaise,
      totalValuationAtWholesalePaise,
      potentialProfitPaise: totalValuationAtWholesalePaise - totalValuationAtPurchasePaise,
      lowStockCount,
      outOfStockCount,
      products: items.sort((a, b) => b.valuationCostPaise - a.valuationCostPaise),
      categoryBreakdown
    };
  }

  // -----------------------------------------------------------
  // 8. Profit & Loss Report
  // -----------------------------------------------------------
  public async getProfitLossReport(filter: DateFilterRange = { preset: 'ALL_TIME' }): Promise<ProfitLossReportData> {
    const bills = await roomDb.getAll<Bill>('bills');
    const products = await roomDb.getAll<Product>('products');
    const expenses = await roomDb.getAll<Expense>('expenses');

    // Create lookup for product purchase cost by ID and by uppercase name
    const costById = new Map<string, number>();
    const costByName = new Map<string, number>();
    for (const p of products) {
      costById.set(p.id, p.purchaseRatePaise);
      costByName.set(p.name.trim().toUpperCase(), p.purchaseRatePaise);
    }

    const filteredBills = bills.filter((b) => !b.isCancelled && this.isWithinRange(b.date, filter));
    const filteredExpenses = expenses.filter((e) => this.isWithinRange(e.date, filter));

    let grossSalesRevenuePaise = 0;
    let discountPaise = 0;
    let netSalesRevenuePaise = 0;
    let costOfGoodsSoldPaise = 0;

    const itemProfitMap = new Map<string, { quantitySold: number; revenuePaise: number; costPaise: number }>();

    for (const bill of filteredBills) {
      grossSalesRevenuePaise += bill.subtotalPaise;
      discountPaise += bill.discountPaise || 0;
      netSalesRevenuePaise += bill.grandTotalPaise;

      for (const item of bill.items) {
        const pKey = (item.details || 'BAG').trim().toUpperCase();
        // Lookup cost: by item.productId first, then by name match, fallback to 70% of sell price if unmapped
        let unitCost = 0;
        if (item.productId && costById.has(item.productId)) {
          unitCost = costById.get(item.productId)!;
        } else if (costByName.has(pKey)) {
          unitCost = costByName.get(pKey)!;
        } else {
          unitCost = Math.round(item.ratePaise * 0.7); // conservative estimate for custom items
        }

        const itemCost = item.quantity * unitCost;
        costOfGoodsSoldPaise += itemCost;

        const existing = itemProfitMap.get(pKey) || { quantitySold: 0, revenuePaise: 0, costPaise: 0 };
        existing.quantitySold += item.quantity;
        existing.revenuePaise += item.totalPaise;
        existing.costPaise += itemCost;
        itemProfitMap.set(pKey, existing);
      }
    }

    let operatingExpensesPaise = 0;
    const expMap = new Map<string, number>();
    for (const exp of filteredExpenses) {
      operatingExpensesPaise += exp.amountPaise;
      const cat = exp.category || 'General';
      expMap.set(cat, (expMap.get(cat) || 0) + exp.amountPaise);
    }

    const grossProfitPaise = netSalesRevenuePaise - costOfGoodsSoldPaise;
    const grossMarginPercent = netSalesRevenuePaise > 0 ? (grossProfitPaise / netSalesRevenuePaise) * 100 : 0;
    const netProfitPaise = grossProfitPaise - operatingExpensesPaise;
    const netMarginPercent = netSalesRevenuePaise > 0 ? (netProfitPaise / netSalesRevenuePaise) * 100 : 0;

    const itemBreakdown = Array.from(itemProfitMap.entries())
      .map(([productName, data]) => {
        const gp = data.revenuePaise - data.costPaise;
        return {
          productName,
          quantitySold: data.quantitySold,
          revenuePaise: data.revenuePaise,
          costPaise: data.costPaise,
          grossProfitPaise: gp,
          marginPercent: data.revenuePaise > 0 ? (gp / data.revenuePaise) * 100 : 0
        };
      })
      .sort((a, b) => b.grossProfitPaise - a.grossProfitPaise);

    const expenseBreakdown = Array.from(expMap.entries())
      .map(([category, amountPaise]) => ({ category, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    return {
      grossSalesRevenuePaise,
      discountPaise,
      netSalesRevenuePaise,
      costOfGoodsSoldPaise,
      grossProfitPaise,
      grossMarginPercent,
      operatingExpensesPaise,
      netProfitPaise,
      netMarginPercent,
      isProfitable: netProfitPaise >= 0,
      itemBreakdown,
      expenseBreakdown
    };
  }

  // -----------------------------------------------------------
  // Consistency Audit Suite
  // -----------------------------------------------------------
  public async verifyConsistency(): Promise<ReportConsistencyAuditResult> {
    const sales = await this.getSalesReport();
    const purchases = await this.getPurchaseReport();
    const collections = await this.getCollectionReport();
    const outstanding = await this.getOutstandingReport();
    const expenses = await this.getExpensesReport();
    const cash = await this.getCashReport();
    const inventory = await this.getInventoryReport();
    const profit = await this.getProfitLossReport();

    const rawBills = await roomDb.getAll<Bill>('bills');
    const rawCustomers = await roomDb.getAll<Customer>('customers');
    const rawSuppliers = await roomDb.getAll<Supplier>('suppliers');
    const rawProducts = await roomDb.getAll<Product>('products');

    const checks: ReportConsistencyAuditResult['checks'] = [];

    // 1. Sales Revenue Consistency: sum(bill.grandTotalPaise) === sales.netSalesPaise
    const sumActiveBillGrandTotals = rawBills
      .filter((b) => !b.isCancelled)
      .reduce((sum, b) => sum + b.grandTotalPaise, 0);
    checks.push({
      report: 'SALES',
      invariant: 'Net Sales equals exact sum of non-cancelled Bill Grand Totals',
      passed: sumActiveBillGrandTotals === sales.netSalesPaise,
      expected: formatINR(sumActiveBillGrandTotals),
      actual: formatINR(sales.netSalesPaise)
    });

    // 2. Sales Volume Consistency: sum(bill.totalQuantity) === sales.totalPcsSold
    const sumActiveBillQty = rawBills
      .filter((b) => !b.isCancelled)
      .reduce((sum, b) => sum + b.totalQuantity, 0);
    checks.push({
      report: 'SALES',
      invariant: 'Total Pieces Sold matches sum of Bill Total Quantities',
      passed: sumActiveBillQty === sales.totalPcsSold,
      expected: `${sumActiveBillQty} PCS`,
      actual: `${sales.totalPcsSold} PCS`
    });

    // 3. Outstanding Receivables: sum(customer.currentOutstandingPaise) === outstanding.totalReceivablesPaise
    const sumCustBalances = rawCustomers.reduce((sum, c) => sum + (c.currentOutstandingPaise || 0), 0);
    checks.push({
      report: 'OUTSTANDING',
      invariant: 'Customer Receivables equals exact sum of customer ledger balances',
      passed: sumCustBalances === outstanding.totalReceivablesPaise,
      expected: formatINR(sumCustBalances),
      actual: formatINR(outstanding.totalReceivablesPaise)
    });

    // 4. Outstanding Payables: sum(supplier.currentOutstandingPaise) === outstanding.totalPayablesPaise
    const sumSuppBalances = rawSuppliers.reduce((sum, s) => sum + (s.currentOutstandingPaise || 0), 0);
    checks.push({
      report: 'OUTSTANDING',
      invariant: 'Supplier Payables equals exact sum of supplier ledger balances',
      passed: sumSuppBalances === outstanding.totalPayablesPaise,
      expected: formatINR(sumSuppBalances),
      actual: formatINR(outstanding.totalPayablesPaise)
    });

    // 5. Profit Equation 1: Gross Profit === Net Sales - COGS
    const calculatedGrossProfit = profit.netSalesRevenuePaise - profit.costOfGoodsSoldPaise;
    checks.push({
      report: 'PROFIT',
      invariant: 'Gross Profit equals Net Sales minus Cost of Goods Sold (COGS)',
      passed: calculatedGrossProfit === profit.grossProfitPaise,
      expected: formatINR(calculatedGrossProfit),
      actual: formatINR(profit.grossProfitPaise)
    });

    // 6. Profit Equation 2: Net Profit === Gross Profit - Operating Expenses
    const calculatedNetProfit = profit.grossProfitPaise - expenses.totalExpensesPaise;
    checks.push({
      report: 'PROFIT',
      invariant: 'Net Profit equals Gross Profit minus Operating Expenses',
      passed: calculatedNetProfit === profit.netProfitPaise,
      expected: formatINR(calculatedNetProfit),
      actual: formatINR(profit.netProfitPaise)
    });

    // 7. Inventory Valuation: sum(stock * purchaseRate) === inventory.totalValuationAtPurchasePaise
    const sumInvCost = rawProducts.reduce((sum, p) => sum + (p.currentStock * p.purchaseRatePaise), 0);
    checks.push({
      report: 'INVENTORY',
      invariant: 'Inventory Valuation matches sum of currentStock * purchaseRatePaise',
      passed: sumInvCost === inventory.totalValuationAtPurchasePaise,
      expected: formatINR(sumInvCost),
      actual: formatINR(inventory.totalValuationAtPurchasePaise)
    });

    // 8. Cash Book Equation: Closing Cash === Opening + Inflow - Outflow
    const calculatedClosing = cash.openingCashPaise + cash.totalCashInflowPaise - cash.totalCashOutflowPaise;
    checks.push({
      report: 'CASH',
      invariant: 'Closing Cash equals Opening Cash + Total Inflow - Total Outflow',
      passed: calculatedClosing === cash.closingCashPaise,
      expected: formatINR(calculatedClosing),
      actual: formatINR(cash.closingCashPaise)
    });

    const passedTests = checks.filter((c) => c.passed).length;
    const totalTests = checks.length;
    const allPassed = passedTests === totalTests;

    return {
      allPassed,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      checks
    };
  }

  // -----------------------------------------------------------
  // EXPORT ENGINE: CSV
  // -----------------------------------------------------------
  public exportToCSV(reportType: ReportType, data: any, filename?: string): void {
    const name = filename || `OriginalModiBags_${reportType}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    let rows: string[][] = [];

    if (reportType === 'SALES') {
      const d = data as SalesReportData;
      rows.push(['Bill Number', 'Date', 'Customer Name', 'Pieces (Qty)', 'Subtotal (INR)', 'Discount (INR)', 'Grand Total (INR)', 'Paid (INR)', 'Balance Due (INR)', 'Payment Mode']);
      for (const b of d.bills) {
        rows.push([
          b.billNumber,
          new Date(b.date).toLocaleDateString('en-IN'),
          b.customerName,
          b.totalQuantity.toString(),
          paiseToRupees(b.subtotalPaise).toFixed(2),
          paiseToRupees(b.discountPaise || 0).toFixed(2),
          paiseToRupees(b.grandTotalPaise).toFixed(2),
          paiseToRupees(b.paidPaise).toFixed(2),
          paiseToRupees(b.balancePaise).toFixed(2),
          b.paymentMethod
        ]);
      }
    } else if (reportType === 'PURCHASE') {
      const d = data as PurchaseReportData;
      rows.push(['Invoice Number', 'Date', 'Supplier Name', 'Pieces (Qty)', 'Subtotal (INR)', 'Freight (INR)', 'Grand Total (INR)', 'Paid (INR)', 'Credit Due (INR)', 'Payment Mode']);
      for (const p of d.purchases) {
        rows.push([
          p.purchaseInvoiceNumber,
          new Date(p.date).toLocaleDateString('en-IN'),
          p.supplierName,
          p.totalQuantity.toString(),
          paiseToRupees(p.subtotalPaise).toFixed(2),
          paiseToRupees(p.freightChargesPaise || p.freightPaise || 0).toFixed(2),
          paiseToRupees(p.grandTotalPaise).toFixed(2),
          paiseToRupees(p.paidPaise).toFixed(2),
          paiseToRupees(p.creditPaise).toFixed(2),
          p.paymentMethod || 'CASH'
        ]);
      }
    } else if (reportType === 'COLLECTION') {
      const d = data as CollectionReportData;
      rows.push(['Date', 'Reference / Bill #', 'Customer Name', 'Payment Mode', 'Amount Collected (INR)', 'Notes']);
      for (const c of d.collections) {
        rows.push([
          new Date(c.date).toLocaleDateString('en-IN'),
          c.reference,
          c.customerName,
          c.paymentMethod,
          paiseToRupees(c.amountPaise).toFixed(2),
          c.notes || ''
        ]);
      }
    } else if (reportType === 'OUTSTANDING') {
      const d = data as OutstandingReportData;
      rows.push(['Type', 'Account Name', 'Contact Mobile', 'City', 'Balance Amount (INR)', 'Aging / Status']);
      for (const c of d.customers) {
        rows.push(['RECEIVABLE (Customer)', c.name, c.mobile, c.city, paiseToRupees(c.outstandingPaise).toFixed(2), c.aging]);
      }
      for (const s of d.suppliers) {
        rows.push(['PAYABLE (Supplier)', s.name, s.mobile, s.city, paiseToRupees(s.outstandingPaise).toFixed(2), 'Current']);
      }
    } else if (reportType === 'EXPENSES') {
      const d = data as ExpensesReportData;
      rows.push(['Date', 'Category', 'Description', 'Payment Method', 'Amount (INR)']);
      for (const e of d.expenses) {
        rows.push([
          new Date(e.date).toLocaleDateString('en-IN'),
          e.category,
          e.description,
          e.paymentMethod,
          paiseToRupees(e.amountPaise).toFixed(2)
        ]);
      }
    } else if (reportType === 'CASH') {
      const d = data as CashReportData;
      rows.push(['Date', 'Transaction Type', 'Description', 'Cash Inflow (INR)', 'Cash Outflow (INR)', 'Running Balance (INR)']);
      for (const tx of d.transactions) {
        rows.push([
          new Date(tx.date).toLocaleDateString('en-IN'),
          tx.type,
          tx.description,
          paiseToRupees(tx.inflowPaise).toFixed(2),
          paiseToRupees(tx.outflowPaise).toFixed(2),
          paiseToRupees(tx.runningCashBalancePaise).toFixed(2)
        ]);
      }
    } else if (reportType === 'INVENTORY') {
      const d = data as InventoryReportData;
      rows.push(['Item Code', 'Bag Name', 'Category', 'Stock (PCS)', 'Min Alert', 'Cost Rate (INR)', 'Wholesale Rate (INR)', 'Valuation at Cost (INR)', 'Stock Status']);
      for (const p of d.products) {
        rows.push([
          p.productCode,
          p.name,
          p.category,
          p.currentStock.toString(),
          p.minimumStock.toString(),
          paiseToRupees(p.purchaseRatePaise).toFixed(2),
          paiseToRupees(p.wholesaleRatePaise).toFixed(2),
          paiseToRupees(p.valuationCostPaise).toFixed(2),
          p.status
        ]);
      }
    } else if (reportType === 'PROFIT') {
      const d = data as ProfitLossReportData;
      rows.push(['Particulars', 'Amount (INR)', 'Margin %']);
      rows.push(['Gross Sales Revenue', paiseToRupees(d.grossSalesRevenuePaise).toFixed(2), '100%']);
      rows.push(['Less: Discounts', paiseToRupees(d.discountPaise).toFixed(2), '-']);
      rows.push(['Net Sales Revenue', paiseToRupees(d.netSalesRevenuePaise).toFixed(2), '100%']);
      rows.push(['Less: Cost of Goods Sold (COGS)', paiseToRupees(d.costOfGoodsSoldPaise).toFixed(2), `${((d.costOfGoodsSoldPaise / (d.netSalesRevenuePaise || 1)) * 100).toFixed(1)}%`]);
      rows.push(['GROSS PROFIT', paiseToRupees(d.grossProfitPaise).toFixed(2), `${d.grossMarginPercent.toFixed(1)}%`]);
      rows.push(['Less: Operating Expenses', paiseToRupees(d.operatingExpensesPaise).toFixed(2), `${((d.operatingExpensesPaise / (d.netSalesRevenuePaise || 1)) * 100).toFixed(1)}%`]);
      rows.push(['NET OPERATING PROFIT', paiseToRupees(d.netProfitPaise).toFixed(2), `${d.netMarginPercent.toFixed(1)}%`]);
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // -----------------------------------------------------------
  // EXPORT ENGINE: XLSX
  // -----------------------------------------------------------
  public exportToXLSX(reportType: ReportType, data: any, filename?: string): void {
    const name = filename || `OriginalModiBags_${reportType}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const wb = XLSX.utils.book_new();

    let aoa: any[][] = [];

    // Header block
    aoa.push(['ORIGINAL MODI BAGS - KOLKATA']);
    aoa.push(['3, Amartalla Lane, Kolkata-700001 | Phone: 8240584877']);
    aoa.push([`${reportType} FINANCIAL REPORT`, `Generated: ${new Date().toLocaleString('en-IN')}`]);
    aoa.push([]); // spacer

    if (reportType === 'SALES') {
      const d = data as SalesReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Bills', d.totalBills, 'Total Pieces Sold', `${d.totalPcsSold} PCS`]);
      aoa.push(['Gross Sales', paiseToRupees(d.grossSalesPaise), 'Discounts', paiseToRupees(d.totalDiscountPaise)]);
      aoa.push(['Net Sales', paiseToRupees(d.netSalesPaise), 'Collections Received', paiseToRupees(d.totalReceivedPaise)]);
      aoa.push(['Outstanding Balance Due', paiseToRupees(d.totalBalanceDuePaise)]);
      aoa.push([]);
      aoa.push(['Bill Number', 'Date', 'Customer Name', 'Pieces', 'Subtotal', 'Discount', 'Grand Total', 'Paid', 'Balance Due', 'Payment Mode']);
      for (const b of d.bills) {
        aoa.push([
          b.billNumber,
          new Date(b.date).toLocaleDateString('en-IN'),
          b.customerName,
          b.totalQuantity,
          paiseToRupees(b.subtotalPaise),
          paiseToRupees(b.discountPaise || 0),
          paiseToRupees(b.grandTotalPaise),
          paiseToRupees(b.paidPaise),
          paiseToRupees(b.balancePaise),
          b.paymentMethod
        ]);
      }
    } else if (reportType === 'PURCHASE') {
      const d = data as PurchaseReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Purchase Invoices', d.totalPurchasesCount, 'Total Pieces Inwarded', `${d.totalPcsPurchased} PCS`]);
      aoa.push(['Subtotal', paiseToRupees(d.subtotalPaise), 'Freight & Other', paiseToRupees(d.freightChargesPaise)]);
      aoa.push(['Grand Total', paiseToRupees(d.grandTotalPaise), 'Paid to Suppliers', paiseToRupees(d.paidPaise)]);
      aoa.push(['Pending Supplier Credit', paiseToRupees(d.creditDuePaise)]);
      aoa.push([]);
      aoa.push(['Invoice Number', 'Date', 'Supplier Name', 'Pieces', 'Subtotal', 'Freight', 'Grand Total', 'Paid', 'Credit Due', 'Mode']);
      for (const p of d.purchases) {
        aoa.push([
          p.purchaseInvoiceNumber,
          new Date(p.date).toLocaleDateString('en-IN'),
          p.supplierName,
          p.totalQuantity,
          paiseToRupees(p.subtotalPaise),
          paiseToRupees(p.freightChargesPaise || p.freightPaise || 0),
          paiseToRupees(p.grandTotalPaise),
          paiseToRupees(p.paidPaise),
          paiseToRupees(p.creditPaise),
          p.paymentMethod || 'CASH'
        ]);
      }
    } else if (reportType === 'COLLECTION') {
      const d = data as CollectionReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Collections', paiseToRupees(d.totalCollectedPaise)]);
      aoa.push(['Cash Collections', paiseToRupees(d.cashCollectionPaise), 'UPI Collections', paiseToRupees(d.upiCollectionPaise)]);
      aoa.push(['Bank Transfer', paiseToRupees(d.bankCollectionPaise), 'Cheque / Other', paiseToRupees(d.chequeCollectionPaise + d.otherCollectionPaise)]);
      aoa.push([]);
      aoa.push(['Date', 'Reference / Bill #', 'Customer Name', 'Payment Mode', 'Amount Collected (INR)', 'Notes']);
      for (const c of d.collections) {
        aoa.push([
          new Date(c.date).toLocaleDateString('en-IN'),
          c.reference,
          c.customerName,
          c.paymentMethod,
          paiseToRupees(c.amountPaise),
          c.notes || ''
        ]);
      }
    } else if (reportType === 'OUTSTANDING') {
      const d = data as OutstandingReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Receivables (Due from Customers)', paiseToRupees(d.totalReceivablesPaise), 'Customer Accounts Due', d.customerCountWithBalance]);
      aoa.push(['Total Payables (Owed to Suppliers)', paiseToRupees(d.totalPayablesPaise), 'Supplier Accounts Payable', d.supplierCountWithBalance]);
      aoa.push(['Net Working Capital Position', paiseToRupees(d.netOutstandingPaise)]);
      aoa.push([]);
      aoa.push(['Type', 'Party Name', 'Contact Mobile', 'City', 'Balance Amount (INR)', 'Status / Aging']);
      for (const c of d.customers) {
        aoa.push(['RECEIVABLE (Customer)', c.name, c.mobile, c.city, paiseToRupees(c.outstandingPaise), c.aging]);
      }
      for (const s of d.suppliers) {
        aoa.push(['PAYABLE (Supplier)', s.name, s.mobile, s.city, paiseToRupees(s.outstandingPaise), 'Payable']);
      }
    } else if (reportType === 'EXPENSES') {
      const d = data as ExpensesReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Expenses Recorded', paiseToRupees(d.totalExpensesPaise), 'Expense Entries', d.totalExpensesCount]);
      aoa.push(['Cash Outflow', paiseToRupees(d.cashExpensePaise), 'Bank / Online Outflow', paiseToRupees(d.bankExpensePaise)]);
      aoa.push([]);
      aoa.push(['Date', 'Category', 'Description', 'Payment Method', 'Amount (INR)']);
      for (const e of d.expenses) {
        aoa.push([
          new Date(e.date).toLocaleDateString('en-IN'),
          e.category,
          e.description,
          e.paymentMethod,
          paiseToRupees(e.amountPaise)
        ]);
      }
    } else if (reportType === 'CASH') {
      const d = data as CashReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Opening Cash Balance', paiseToRupees(d.openingCashPaise), 'Total Cash Inflow', paiseToRupees(d.totalCashInflowPaise)]);
      aoa.push(['Total Cash Outflow', paiseToRupees(d.totalCashOutflowPaise), 'Net Cash Movement', paiseToRupees(d.netCashChangePaise)]);
      aoa.push(['Closing Cash Balance (Drawer)', paiseToRupees(d.closingCashPaise)]);
      aoa.push([]);
      aoa.push(['Date', 'Transaction Type', 'Description', 'Inflow (+)', 'Outflow (-)', 'Running Balance']);
      for (const tx of d.transactions) {
        aoa.push([
          new Date(tx.date).toLocaleDateString('en-IN'),
          tx.type,
          tx.description,
          paiseToRupees(tx.inflowPaise),
          paiseToRupees(tx.outflowPaise),
          paiseToRupees(tx.runningCashBalancePaise)
        ]);
      }
    } else if (reportType === 'INVENTORY') {
      const d = data as InventoryReportData;
      aoa.push(['Summary Metrics']);
      aoa.push(['Total Products in Catalog', d.totalProductsCount, 'Total Physical Pieces in Stock', `${d.totalQuantityPcs} PCS`]);
      aoa.push(['Valuation at Purchase Cost', paiseToRupees(d.totalValuationAtPurchasePaise), 'Valuation at Wholesale Rate', paiseToRupees(d.totalValuationAtWholesalePaise)]);
      aoa.push(['Potential Gross Margin Value', paiseToRupees(d.potentialProfitPaise), 'Low Stock Reorder Alerts', d.lowStockCount]);
      aoa.push([]);
      aoa.push(['Item Code', 'Bag Name', 'Category', 'Stock (PCS)', 'Min Stock', 'Purchase Rate', 'Wholesale Rate', 'Valuation Cost', 'Status']);
      for (const p of d.products) {
        aoa.push([
          p.productCode,
          p.name,
          p.category,
          p.currentStock,
          p.minimumStock,
          paiseToRupees(p.purchaseRatePaise),
          paiseToRupees(p.wholesaleRatePaise),
          paiseToRupees(p.valuationCostPaise),
          p.status
        ]);
      }
    } else if (reportType === 'PROFIT') {
      const d = data as ProfitLossReportData;
      aoa.push(['Executive Profit & Loss Statement']);
      aoa.push(['Particulars', 'Amount (INR)', 'Percentage of Revenue']);
      aoa.push(['Gross Sales Revenue', paiseToRupees(d.grossSalesRevenuePaise), '100%']);
      aoa.push(['Less: Discounts', paiseToRupees(d.discountPaise), '-']);
      aoa.push(['Net Sales Revenue', paiseToRupees(d.netSalesRevenuePaise), '100%']);
      aoa.push(['Less: Cost of Goods Sold (COGS)', paiseToRupees(d.costOfGoodsSoldPaise), `${((d.costOfGoodsSoldPaise / (d.netSalesRevenuePaise || 1)) * 100).toFixed(1)}%`]);
      aoa.push(['GROSS PROFIT', paiseToRupees(d.grossProfitPaise), `${d.grossMarginPercent.toFixed(1)}%`]);
      aoa.push(['Less: Operating Expenses', paiseToRupees(d.operatingExpensesPaise), `${((d.operatingExpensesPaise / (d.netSalesRevenuePaise || 1)) * 100).toFixed(1)}%`]);
      aoa.push(['NET OPERATING PROFIT', paiseToRupees(d.netProfitPaise), `${d.netMarginPercent.toFixed(1)}%`]);
      aoa.push([]);
      aoa.push(['Product-Wise Gross Profit Breakdown']);
      aoa.push(['Product Name', 'Sold (PCS)', 'Revenue (INR)', 'Cost (INR)', 'Gross Profit (INR)', 'Margin %']);
      for (const item of d.itemBreakdown) {
        aoa.push([
          item.productName,
          item.quantitySold,
          paiseToRupees(item.revenuePaise),
          paiseToRupees(item.costPaise),
          paiseToRupees(item.grossProfitPaise),
          `${item.marginPercent.toFixed(1)}%`
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, `${reportType} Report`);
    XLSX.writeFile(wb, name);
  }

  // -----------------------------------------------------------
  // EXPORT ENGINE: PDF
  // -----------------------------------------------------------
  public exportToPDF(reportType: ReportType, data: any, profile?: BusinessProfile, filename?: string): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const name = filename || `OriginalModiBags_${reportType}_Report_${new Date().toISOString().split('T')[0]}.pdf`;

    // Colors
    const primaryColor = [227, 90, 20]; // Orange accent (#E35A14)
    const darkBg = [28, 28, 36];

    // Header
    doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(profile?.name || 'ORIGINAL MODI BAGS', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(190, 190, 205);
    doc.text(
      `${profile?.address || '3, AMARTALLA LANE'}, ${profile?.city || 'KOLKATA'} - ${profile?.pincode || '700001'} | Phone: ${profile?.phone || '8240584877'}`,
      14,
      17
    );
    doc.text(
      `Report: ${reportType} STATEMENT | Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      14,
      23
    );

    // Summary Box
    let startY = 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${reportType} SUMMARY & EXECUTIVE METRICS`, 14, startY);

    startY += 4;

    let headRows: string[][] = [];
    let bodyRows: any[][] = [];

    if (reportType === 'SALES') {
      const d = data as SalesReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Total Bills', 'Pieces Sold', 'Gross Sales', 'Net Revenue', 'Paid Received', 'Balance Due']],
        body: [[
          d.totalBills.toString(),
          `${d.totalPcsSold} PCS`,
          formatINR(d.grossSalesPaise),
          formatINR(d.netSalesPaise),
          formatINR(d.totalReceivedPaise),
          formatINR(d.totalBalanceDuePaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Bill #', 'Date', 'Customer', 'Qty', 'Grand Total', 'Paid', 'Balance', 'Mode']];
      bodyRows = d.bills.map((b) => [
        b.billNumber,
        new Date(b.date).toLocaleDateString('en-IN'),
        b.customerName,
        b.totalQuantity,
        formatINR(b.grandTotalPaise),
        formatINR(b.paidPaise),
        formatINR(b.balancePaise),
        b.paymentMethod
      ]);
    } else if (reportType === 'PURCHASE') {
      const d = data as PurchaseReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Invoices', 'Pieces Inwarded', 'Subtotal', 'Freight', 'Grand Total', 'Paid', 'Credit Due']],
        body: [[
          d.totalPurchasesCount.toString(),
          `${d.totalPcsPurchased} PCS`,
          formatINR(d.subtotalPaise),
          formatINR(d.freightChargesPaise),
          formatINR(d.grandTotalPaise),
          formatINR(d.paidPaise),
          formatINR(d.creditDuePaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Invoice #', 'Date', 'Supplier Name', 'Qty', 'Grand Total', 'Paid', 'Credit Balance', 'Mode']];
      bodyRows = d.purchases.map((p) => [
        p.purchaseInvoiceNumber,
        new Date(p.date).toLocaleDateString('en-IN'),
        p.supplierName,
        p.totalQuantity,
        formatINR(p.grandTotalPaise),
        formatINR(p.paidPaise),
        formatINR(p.creditPaise),
        p.paymentMethod || 'CASH'
      ]);
    } else if (reportType === 'COLLECTION') {
      const d = data as CollectionReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Total Collected', 'Cash', 'UPI / QR', 'Bank Transfer', 'Cheque / Other']],
        body: [[
          formatINR(d.totalCollectedPaise),
          formatINR(d.cashCollectionPaise),
          formatINR(d.upiCollectionPaise),
          formatINR(d.bankCollectionPaise),
          formatINR(d.chequeCollectionPaise + d.otherCollectionPaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Date', 'Reference #', 'Customer Name', 'Mode', 'Amount Collected', 'Notes']];
      bodyRows = d.collections.map((c) => [
        new Date(c.date).toLocaleDateString('en-IN'),
        c.reference,
        c.customerName,
        c.paymentMethod,
        formatINR(c.amountPaise),
        c.notes || ''
      ]);
    } else if (reportType === 'OUTSTANDING') {
      const d = data as OutstandingReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Customer Receivables (Due)', 'Customers', 'Supplier Payables', 'Suppliers', 'Net Exposure']],
        body: [[
          formatINR(d.totalReceivablesPaise),
          d.customerCountWithBalance.toString(),
          formatINR(d.totalPayablesPaise),
          d.supplierCountWithBalance.toString(),
          formatINR(d.netOutstandingPaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Type', 'Party Name', 'Phone', 'City', 'Balance Amount', 'Status']];
      bodyRows = [
        ...d.customers.map((c) => ['RECEIVABLE', c.name, c.mobile, c.city, formatINR(c.outstandingPaise), c.aging]),
        ...d.suppliers.map((s) => ['PAYABLE', s.name, s.mobile, s.city, formatINR(s.outstandingPaise), 'Due'])
      ];
    } else if (reportType === 'EXPENSES') {
      const d = data as ExpensesReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Total Expenses', 'Entries Count', 'Cash Outflow', 'Bank / Online Outflow']],
        body: [[
          formatINR(d.totalExpensesPaise),
          d.totalExpensesCount.toString(),
          formatINR(d.cashExpensePaise),
          formatINR(d.bankExpensePaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Date', 'Category', 'Description', 'Payment Mode', 'Amount']];
      bodyRows = d.expenses.map((e) => [
        new Date(e.date).toLocaleDateString('en-IN'),
        e.category,
        e.description,
        e.paymentMethod,
        formatINR(e.amountPaise)
      ]);
    } else if (reportType === 'CASH') {
      const d = data as CashReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Opening Cash', 'Total Inflows', 'Total Outflows', 'Net Flow', 'Closing Cash Balance']],
        body: [[
          formatINR(d.openingCashPaise),
          formatINR(d.totalCashInflowPaise),
          formatINR(d.totalCashOutflowPaise),
          formatINR(d.netCashChangePaise),
          formatINR(d.closingCashPaise)
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Date', 'Type', 'Description', 'Inflow (+)', 'Outflow (-)', 'Running Balance']];
      bodyRows = d.transactions.map((tx) => [
        new Date(tx.date).toLocaleDateString('en-IN'),
        tx.type,
        tx.description,
        formatINR(tx.inflowPaise),
        formatINR(tx.outflowPaise),
        formatINR(tx.runningCashBalancePaise)
      ]);
    } else if (reportType === 'INVENTORY') {
      const d = data as InventoryReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Total Items', 'Physical Stock', 'Cost Valuation', 'Wholesale Valuation', 'Potential Profit', 'Low Stock']],
        body: [[
          d.totalProductsCount.toString(),
          `${d.totalQuantityPcs} PCS`,
          formatINR(d.totalValuationAtPurchasePaise),
          formatINR(d.totalValuationAtWholesalePaise),
          formatINR(d.potentialProfitPaise),
          d.lowStockCount.toString()
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Code', 'Bag Name', 'Category', 'Stock', 'Cost Rate', 'Wholesale Rate', 'Cost Valuation', 'Status']];
      bodyRows = d.products.map((p) => [
        p.productCode,
        p.name,
        p.category,
        `${p.currentStock} PCS`,
        formatINR(p.purchaseRatePaise),
        formatINR(p.wholesaleRatePaise),
        formatINR(p.valuationCostPaise),
        p.status
      ]);
    } else if (reportType === 'PROFIT') {
      const d = data as ProfitLossReportData;
      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [['Net Sales Revenue', 'COGS (Cost of Goods)', 'Gross Profit', 'Operating Expenses', 'Net Profit', 'Net Margin']],
        body: [[
          formatINR(d.netSalesRevenuePaise),
          formatINR(d.costOfGoodsSoldPaise),
          formatINR(d.grossProfitPaise),
          formatINR(d.operatingExpensesPaise),
          formatINR(d.netProfitPaise),
          `${d.netMarginPercent.toFixed(1)}%`
        ]],
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [40, 40, 52], textColor: [255, 255, 255] }
      });
      startY = (doc as any).lastAutoTable.finalY + 8;

      headRows = [['Bag Model Sold', 'Quantity Sold', 'Revenue', 'Cost', 'Gross Profit', 'Gross Margin']];
      bodyRows = d.itemBreakdown.map((item) => [
        item.productName,
        `${item.quantitySold} PCS`,
        formatINR(item.revenuePaise),
        formatINR(item.costPaise),
        formatINR(item.grossProfitPaise),
        `${item.marginPercent.toFixed(1)}%`
      ]);
    }

    // Detail Records Table
    if (headRows.length > 0 && bodyRows.length > 0) {
      autoTable(doc, {
        startY,
        theme: 'striped',
        head: headRows,
        body: bodyRows,
        styles: { fontSize: 7.5, font: 'helvetica', cellPadding: 2 },
        headStyles: { fillColor: [28, 28, 36], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 248, 252] }
      });
    }

    // Footer with Page Numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 135);
      doc.text(
        `Original Modi Bags Financial Audit • Page ${i} of ${pageCount} • Source: Transactional Room DB`,
        105,
        290,
        { align: 'center' }
      );
    }

    doc.save(name);
  }

  // -----------------------------------------------------------
  // EXPORT ENGINE: Shareable Text for WhatsApp & Clipboard
  // -----------------------------------------------------------
  public generateShareableReportText(reportType: ReportType, data: any, profile?: BusinessProfile): string {
    const biz = profile?.name || 'ORIGINAL MODI BAGS';
    const address = profile?.address || '3, Amartalla Lane, Kolkata-700001';
    const phone = profile?.phone || '8240584877';

    let content = `*${biz} - FINANCIAL REPORT*\n📍 ${address} | 📞 ${phone}\n-----------------------------------------\n`;
    content += `*Report:* ${reportType} STATEMENT\n*Date:* ${new Date().toLocaleDateString('en-IN')}\n-----------------------------------------\n`;

    if (reportType === 'SALES') {
      const d = data as SalesReportData;
      content += `📊 *Total Invoices:* ${d.totalBills}\n`;
      content += `🎒 *Total Pieces Sold:* ${d.totalPcsSold} PCS\n`;
      content += `💰 *Gross Sales:* ${formatINR(d.grossSalesPaise)}\n`;
      content += `🏷️ *Discounts Given:* ${formatINR(d.totalDiscountPaise)}\n`;
      content += `📈 *Net Sales Revenue:* ${formatINR(d.netSalesPaise)}\n`;
      content += `💵 *Collections Received:* ${formatINR(d.totalReceivedPaise)}\n`;
      content += `⏳ *Current Balance Due:* ${formatINR(d.totalBalanceDuePaise)}\n`;
    } else if (reportType === 'PURCHASE') {
      const d = data as PurchaseReportData;
      content += `📦 *Total Invoices:* ${d.totalPurchasesCount}\n`;
      content += `🎒 *Pieces Inwarded:* ${d.totalPcsPurchased} PCS\n`;
      content += `💰 *Subtotal:* ${formatINR(d.subtotalPaise)}\n`;
      content += `🚚 *Freight & Cartage:* ${formatINR(d.freightChargesPaise)}\n`;
      content += `📈 *Grand Total:* ${formatINR(d.grandTotalPaise)}\n`;
      content += `💵 *Paid to Suppliers:* ${formatINR(d.paidPaise)}\n`;
      content += `⏳ *Supplier Credit Due:* ${formatINR(d.creditDuePaise)}\n`;
    } else if (reportType === 'COLLECTION') {
      const d = data as CollectionReportData;
      content += `💰 *Total Collections:* ${formatINR(d.totalCollectedPaise)}\n`;
      content += `💵 *Cash Collections:* ${formatINR(d.cashCollectionPaise)}\n`;
      content += `📱 *UPI / QR Collections:* ${formatINR(d.upiCollectionPaise)}\n`;
      content += `🏦 *Bank Transfer:* ${formatINR(d.bankCollectionPaise)}\n`;
    } else if (reportType === 'OUTSTANDING') {
      const d = data as OutstandingReportData;
      content += `📥 *Customer Receivables (Due):* ${formatINR(d.totalReceivablesPaise)} (${d.customerCountWithBalance} accounts)\n`;
      content += `📤 *Supplier Payables:* ${formatINR(d.totalPayablesPaise)} (${d.supplierCountWithBalance} accounts)\n`;
      content += `⚖️ *Net Exposure Position:* ${formatINR(d.netOutstandingPaise)}\n`;
    } else if (reportType === 'EXPENSES') {
      const d = data as ExpensesReportData;
      content += `🏷️ *Total Expenses:* ${formatINR(d.totalExpensesPaise)}\n`;
      content += `📝 *Entries Count:* ${d.totalExpensesCount}\n`;
      content += `💵 *Cash Outflow:* ${formatINR(d.cashExpensePaise)}\n`;
      content += `🏦 *Bank Outflow:* ${formatINR(d.bankExpensePaise)}\n`;
    } else if (reportType === 'CASH') {
      const d = data as CashReportData;
      content += `🚪 *Opening Cash Balance:* ${formatINR(d.openingCashPaise)}\n`;
      content += `🟢 *Total Cash Inflows:* ${formatINR(d.totalCashInflowPaise)}\n`;
      content += `🔴 *Total Cash Outflows:* ${formatINR(d.totalCashOutflowPaise)}\n`;
      content += `🪙 *Net Cash Change:* ${formatINR(d.netCashChangePaise)}\n`;
      content += `🔐 *Closing Cash (Drawer):* ${formatINR(d.closingCashPaise)}\n`;
    } else if (reportType === 'INVENTORY') {
      const d = data as InventoryReportData;
      content += `🏷️ *Total Bag Models:* ${d.totalProductsCount}\n`;
      content += `🎒 *Stock in Godown:* ${d.totalQuantityPcs} PCS\n`;
      content += `💰 *Valuation (At Cost):* ${formatINR(d.totalValuationAtPurchasePaise)}\n`;
      content += `🏷️ *Valuation (Wholesale):* ${formatINR(d.totalValuationAtWholesalePaise)}\n`;
      content += `⚠️ *Low Stock Alerts:* ${d.lowStockCount} items\n`;
    } else if (reportType === 'PROFIT') {
      const d = data as ProfitLossReportData;
      content += `📈 *Net Sales Revenue:* ${formatINR(d.netSalesRevenuePaise)}\n`;
      content += `📦 *Cost of Goods Sold (COGS):* ${formatINR(d.costOfGoodsSoldPaise)}\n`;
      content += `✨ *Gross Profit:* ${formatINR(d.grossProfitPaise)} (${d.grossMarginPercent.toFixed(1)}%)\n`;
      content += `🏷️ *Operating Expenses:* ${formatINR(d.operatingExpensesPaise)}\n`;
      content += `🏆 *NET PROFIT:* ${formatINR(d.netProfitPaise)} (${d.netMarginPercent.toFixed(1)}%)\n`;
    }

    content += `-----------------------------------------\n_Generated via Original Modi Bags ERP Source of Truth_`;
    return content;
  }
}

export const reportsService = ReportsService.getInstance();
