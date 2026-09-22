import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  ArrowLeft, 
  Calendar, 
  Download, 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  CreditCard,
  Package,
  FileSpreadsheet,
  FileText,
  Printer,
  Share2,
  Check,
  Copy,
  AlertTriangle,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Building2,
  Clock
} from 'lucide-react';
import { 
  reportsService, 
  ReportType, 
  DateRangePreset, 
  DateFilterRange,
  SalesReportData,
  PurchaseReportData,
  CollectionReportData,
  OutstandingReportData,
  ExpensesReportData,
  CashReportData,
  InventoryReportData,
  ProfitLossReportData,
  ReportConsistencyAuditResult
} from '../services/reportsService';
import { roomDb } from '../db/indexedDbRoom';
import { BusinessProfile } from '../types';
import { formatINR, paiseToRupees } from '../services/currency';

interface ReportsScreenProps {
  onBack: () => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ReportType>('SALES');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | undefined>(undefined);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<ReportConsistencyAuditResult | null>(null);

  // Report Datasets State
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseReportData | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionReportData | null>(null);
  const [outstandingData, setOutstandingData] = useState<OutstandingReportData | null>(null);
  const [expensesData, setExpensesData] = useState<ExpensesReportData | null>(null);
  const [cashData, setCashData] = useState<CashReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [profitData, setProfitData] = useState<ProfitLossReportData | null>(null);

  // Build active filter range object
  const activeFilter: DateFilterRange = useMemo(() => {
    if (datePreset === 'CUSTOM') {
      const s = customStartDate ? new Date(customStartDate).getTime() : 0;
      const e = customEndDate ? new Date(customEndDate).getTime() + 86400000 - 1 : Date.now();
      return { preset: 'CUSTOM', startDate: s, endDate: e };
    }
    return { preset: datePreset };
  }, [datePreset, customStartDate, customEndDate]);

  // Load all reports concurrently from Room Database
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const bizList = await roomDb.getAll<BusinessProfile>('business_profile');
      if (bizList.length > 0) setBusinessProfile(bizList[0]);

      const [s, pu, col, out, exp, c, inv, pr] = await Promise.all([
        reportsService.getSalesReport(activeFilter),
        reportsService.getPurchaseReport(activeFilter),
        reportsService.getCollectionReport(activeFilter),
        reportsService.getOutstandingReport(),
        reportsService.getExpensesReport(activeFilter),
        reportsService.getCashReport(activeFilter),
        reportsService.getInventoryReport(),
        reportsService.getProfitLossReport(activeFilter)
      ]);

      setSalesData(s);
      setPurchaseData(pu);
      setCollectionData(col);
      setOutstandingData(out);
      setExpensesData(exp);
      setCashData(c);
      setInventoryData(inv);
      setProfitData(pr);
    } catch (err) {
      console.error('[ReportsScreen] Error fetching report data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Export handlers
  const getCurrentData = () => {
    switch (activeTab) {
      case 'SALES': return salesData;
      case 'PURCHASE': return purchaseData;
      case 'COLLECTION': return collectionData;
      case 'OUTSTANDING': return outstandingData;
      case 'EXPENSES': return expensesData;
      case 'CASH': return cashData;
      case 'INVENTORY': return inventoryData;
      case 'PROFIT': return profitData;
    }
  };

  const handleExportCSV = () => {
    const data = getCurrentData();
    if (!data) return;
    reportsService.exportToCSV(activeTab, data);
  };

  const handleExportXLSX = () => {
    const data = getCurrentData();
    if (!data) return;
    reportsService.exportToXLSX(activeTab, data);
  };

  const handleExportPDF = () => {
    const data = getCurrentData();
    if (!data) return;
    reportsService.exportToPDF(activeTab, data, businessProfile);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const data = getCurrentData();
    if (!data) return;
    const text = reportsService.generateShareableReportText(activeTab, data, businessProfile);

    // Try Web Share API if mobile / supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Original Modi Bags - ${activeTab} Report`,
          text
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    // Direct WhatsApp Web url or fallback to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    } catch {
      // Prompt manual copy if needed
      window.prompt('Copy report text:', text);
    }
  };

  const handleRunAudit = async () => {
    const res = await reportsService.verifyConsistency();
    setAuditResult(res);
    setShowAuditModal(true);
  };

  // -------------------------------------------------------------
  // Filtered views based on search query
  // -------------------------------------------------------------
  const filteredSalesBills = useMemo(() => {
    if (!salesData) return [];
    if (!searchQuery.trim()) return salesData.bills;
    const q = searchQuery.toLowerCase();
    return salesData.bills.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        (b.customerMobile && b.customerMobile.includes(q))
    );
  }, [salesData, searchQuery]);

  const filteredPurchases = useMemo(() => {
    if (!purchaseData) return [];
    if (!searchQuery.trim()) return purchaseData.purchases;
    const q = searchQuery.toLowerCase();
    return purchaseData.purchases.filter(
      (p) =>
        p.purchaseInvoiceNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
    );
  }, [purchaseData, searchQuery]);

  const filteredCollections = useMemo(() => {
    if (!collectionData) return [];
    if (!searchQuery.trim()) return collectionData.collections;
    const q = searchQuery.toLowerCase();
    return collectionData.collections.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) ||
        c.paymentMethod.toLowerCase().includes(q)
    );
  }, [collectionData, searchQuery]);

  const filteredExpenses = useMemo(() => {
    if (!expensesData) return [];
    if (!searchQuery.trim()) return expensesData.expenses;
    const q = searchQuery.toLowerCase();
    return expensesData.expenses.filter(
      (e) =>
        e.category.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [expensesData, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!inventoryData) return [];
    if (!searchQuery.trim()) return inventoryData.products;
    const q = searchQuery.toLowerCase();
    return inventoryData.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.productCode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [inventoryData, searchQuery]);

  return (
    <div className="space-y-4 pb-24 text-gray-200">
      {/* 1. Header & Quick Actions */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            id="btn-back-reports"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#252533] text-gray-300 hover:text-white hover:bg-[#2F2F40] transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Executive Financial Reports & Audit
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full uppercase tracking-wider">
                Phase 11
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              ORIGINAL MODI BAGS • 3, Amartalla Lane, Kolkata • Source of Truth: Room Database
            </p>
          </div>
        </div>

        {/* Global Toolbar: Exports & Consistency Audit */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            id="btn-audit-consistency"
            onClick={handleRunAudit}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Verify mathematical consistency against all transaction tables"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verify Invariants</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-xl bg-[#252533] hover:bg-[#2F2F42] text-white border border-[#3A3A4E] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Download vector PDF document"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>PDF</span>
          </button>

          <button
            id="btn-export-xlsx"
            onClick={handleExportXLSX}
            className="px-3 py-1.5 rounded-xl bg-[#252533] hover:bg-[#2F2F42] text-white border border-[#3A3A4E] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Export Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>XLSX</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-[#252533] hover:bg-[#2F2F42] text-white border border-[#3A3A4E] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Export raw CSV table"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>CSV</span>
          </button>

          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl bg-[#252533] hover:bg-[#2F2F42] text-white border border-[#3A3A4E] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Print report"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Print</span>
          </button>

          <button
            id="btn-share-report"
            onClick={handleShare}
            className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Share via WhatsApp or Clipboard"
          >
            {copiedFeedback ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4 text-white" />}
            <span>{copiedFeedback ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* 2. Date Range Filter Bar */}
      <div className="bg-[#181820] border border-[#2B2B38] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          <Calendar className="w-4 h-4 text-orange-400 shrink-0 mr-1" />
          <span className="font-semibold text-gray-400 shrink-0 mr-1">Period:</span>
          {(['ALL_TIME', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                datePreset === preset
                  ? 'bg-orange-500 text-black font-bold shadow-sm'
                  : 'bg-[#22222E] text-gray-300 hover:text-white hover:bg-[#2B2B3B]'
              }`}
            >
              {preset.replace('_', ' ')}
            </button>
          ))}
        </div>

        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-[#242432] border border-[#38384A] rounded-lg px-2 py-1 text-white text-xs"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-[#242432] border border-[#38384A] rounded-lg px-2 py-1 text-white text-xs"
            />
          </div>
        )}

        {/* Search Filter in active report */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()} records...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#20202B] border border-[#303042] rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* 3. 8 Master Report Navigation Tabs */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 bg-[#121217] p-1.5 rounded-2xl border border-[#262634]">
        {[
          { id: 'SALES', label: 'Sales', icon: Receipt, badge: salesData?.totalBills },
          { id: 'PURCHASE', label: 'Purchase', icon: ShoppingCart, badge: purchaseData?.totalPurchasesCount },
          { id: 'COLLECTION', label: 'Collection', icon: DollarSign, badge: collectionData?.collections.length },
          { id: 'OUTSTANDING', label: 'Outstanding', icon: CreditCard, badge: outstandingData ? outstandingData.customerCountWithBalance + outstandingData.supplierCountWithBalance : 0 },
          { id: 'EXPENSES', label: 'Expenses', icon: Layers, badge: expensesData?.totalExpensesCount },
          { id: 'CASH', label: 'Cash Book', icon: ArrowUpRight, badge: cashData?.transactions.length },
          { id: 'INVENTORY', label: 'Inventory', icon: Package, badge: inventoryData?.totalProductsCount },
          { id: 'PROFIT', label: 'Profit & Loss', icon: TrendingUp, badge: profitData?.isProfitable ? 'Profit' : 'Loss' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportType);
                setSearchQuery('');
              }}
              className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'bg-orange-500 text-black font-bold shadow-lg shadow-orange-500/20'
                  : 'bg-[#181822] text-gray-400 hover:text-white hover:bg-[#20202C]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[11px] font-semibold whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-black/20 text-black' : 'bg-[#2A2A3A] text-gray-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Active Tab Content Rendering */}
      {isLoading ? (
        <div className="p-12 text-center bg-[#1A1A22] rounded-2xl border border-[#2B2B38]">
          <RefreshCw className="w-6 h-6 text-orange-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-400">Querying Room Database & aggregating financials...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TAB 1: SALES REPORT */}
          {activeTab === 'SALES' && salesData && (
            <div className="space-y-4">
              {/* Executive Sales KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Net Billed Sales</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {formatINR(salesData.netSalesPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{salesData.totalBills} Invoices Generated</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Pcs Sold</span>
                  <div className="text-lg font-bold text-orange-400 font-mono mt-1">
                    {salesData.totalPcsSold} PCS
                  </div>
                  <span className="text-[10px] text-gray-500">Gross: {formatINR(salesData.grossSalesPaise)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Received at Billing</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    {formatINR(salesData.totalReceivedPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Upfront Collections</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Credit Sales Balance</span>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                    {formatINR(salesData.totalBalanceDuePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Added to Customer Due</span>
                </div>
              </div>

              {/* Item-wise Sales Distribution */}
              {salesData.itemBreakdown.length > 0 && (
                <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                    Top Selling Bag Models
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {salesData.itemBreakdown.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[#22222E] border border-[#303042] flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs">{item.productName}</div>
                          <div className="text-[11px] text-orange-300 font-mono">{item.quantity} PCS Sold</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400 font-mono text-xs">{formatINR(item.revenuePaise)}</div>
                          <div className="text-[10px] text-gray-400">Avg {formatINR(item.averageRatePaise)}/pc</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sales Invoice Registers Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Sales Invoice Registers ({filteredSalesBills.length} Invoices)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Bill #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Customer Name</th>
                        <th className="p-2.5 text-center">Qty (PCS)</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                        <th className="p-2.5 text-right">Grand Total</th>
                        <th className="p-2.5 text-right">Paid</th>
                        <th className="p-2.5 text-right">Balance Due</th>
                        <th className="p-2.5 text-center">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {filteredSalesBills.map((b) => (
                        <tr key={b.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 font-mono text-orange-400 font-bold">{b.billNumber}</td>
                          <td className="p-2.5 text-gray-400">{new Date(b.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2.5 font-medium text-white">{b.customerName}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-orange-300">{b.totalQuantity}</td>
                          <td className="p-2.5 text-right font-mono text-gray-300">{formatINR(b.subtotalPaise)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">{formatINR(b.grandTotalPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">{formatINR(b.paidPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-amber-400">{formatINR(b.balancePaise)}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                              b.paymentMethod === 'CASH'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : b.paymentMethod === 'CREDIT'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-sky-500/20 text-sky-400'
                            }`}>
                              {b.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PURCHASE REPORT */}
          {activeTab === 'PURCHASE' && purchaseData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Purchases</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {formatINR(purchaseData.grandTotalPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{purchaseData.totalPurchasesCount} Inward Invoices</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Pieces Inwarded</span>
                  <div className="text-lg font-bold text-orange-400 font-mono mt-1">
                    {purchaseData.totalPcsPurchased} PCS
                  </div>
                  <span className="text-[10px] text-gray-500">Subtotal: {formatINR(purchaseData.subtotalPaise)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Paid to Suppliers</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    {formatINR(purchaseData.paidPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Freight: {formatINR(purchaseData.freightChargesPaise)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Supplier Credit Due</span>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                    {formatINR(purchaseData.creditDuePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Payable Liability</span>
                </div>
              </div>

              {/* Inward Purchases Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                  Supplier Purchase Registers ({filteredPurchases.length} Invoices)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Supplier Name</th>
                        <th className="p-2.5 text-center">Inward Qty</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                        <th className="p-2.5 text-right">Freight</th>
                        <th className="p-2.5 text-right">Grand Total</th>
                        <th className="p-2.5 text-right">Paid</th>
                        <th className="p-2.5 text-right">Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {filteredPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 font-mono text-orange-400 font-bold">{p.purchaseInvoiceNumber}</td>
                          <td className="p-2.5 text-gray-400">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2.5 font-medium text-white">{p.supplierName}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-orange-300">{p.totalQuantity} PCS</td>
                          <td className="p-2.5 text-right font-mono text-gray-300">{formatINR(p.subtotalPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-gray-400">{formatINR(p.freightChargesPaise || p.freightPaise || 0)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">{formatINR(p.grandTotalPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">{formatINR(p.paidPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-amber-400">{formatINR(p.creditPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLLECTION REPORT */}
          {activeTab === 'COLLECTION' && collectionData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Collections</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    {formatINR(collectionData.totalCollectedPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{collectionData.collections.length} Payments Collected</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Cash Receipts</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {formatINR(collectionData.cashCollectionPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Direct Drawer Cash</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">UPI / QR Collections</span>
                  <div className="text-lg font-bold text-sky-400 font-mono mt-1">
                    {formatINR(collectionData.upiCollectionPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Instant UPI Transfers</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Bank / Cheque</span>
                  <div className="text-lg font-bold text-purple-400 font-mono mt-1">
                    {formatINR(collectionData.bankCollectionPaise + collectionData.chequeCollectionPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">NEFT / RTGS / Cheques</span>
                </div>
              </div>

              {/* Collections Log Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                  Collection Register & Receipt Logs ({filteredCollections.length} Records)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Reference #</th>
                        <th className="p-2.5">Customer Name</th>
                        <th className="p-2.5">Payment Method</th>
                        <th className="p-2.5 text-right">Amount Collected</th>
                        <th className="p-2.5">Particulars / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {filteredCollections.map((c) => (
                        <tr key={c.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 text-gray-400">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2.5 font-mono text-orange-400 font-semibold">{c.reference}</td>
                          <td className="p-2.5 font-medium text-white">{c.customerName}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 text-[10px] bg-[#2A2A3A] text-gray-200 rounded-full font-mono">
                              {c.paymentMethod}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">{formatINR(c.amountPaise)}</td>
                          <td className="p-2.5 text-gray-400">{c.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OUTSTANDING (RECEIVABLES & PAYABLES) REPORT */}
          {activeTab === 'OUTSTANDING' && outstandingData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Customer Receivables (Due)</span>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                    {formatINR(outstandingData.totalReceivablesPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{outstandingData.customerCountWithBalance} Customers with pending credit</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Supplier Payables (Owed)</span>
                  <div className="text-xl font-bold text-rose-400 font-mono mt-1">
                    {formatINR(outstandingData.totalPayablesPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{outstandingData.supplierCountWithBalance} Suppliers to be paid</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Net Exposure (Working Capital)</span>
                  <div className={`text-xl font-bold font-mono mt-1 ${
                    outstandingData.netOutstandingPaise >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formatINR(outstandingData.netOutstandingPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Receivables minus Payables</span>
                </div>
              </div>

              {/* Customer Receivables List */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
                  Customer Receivables Ledger (Due from Clients)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Party / Business</th>
                        <th className="p-2.5">Mobile</th>
                        <th className="p-2.5">City / Station</th>
                        <th className="p-2.5 text-right">Credit Limit</th>
                        <th className="p-2.5 text-right">Outstanding Balance</th>
                        <th className="p-2.5 text-center">Aging Bucket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {outstandingData.customers.map((c, idx) => (
                        <tr key={idx} className="hover:bg-[#232330]">
                          <td className="p-2.5">
                            <div className="font-bold text-white">{c.name}</div>
                            {c.businessName && <div className="text-[10px] text-gray-400">{c.businessName}</div>}
                          </td>
                          <td className="p-2.5 text-gray-400 font-mono">{c.mobile}</td>
                          <td className="p-2.5 text-gray-300">{c.city}</td>
                          <td className="p-2.5 text-right font-mono text-gray-400">{c.creditLimitPaise ? formatINR(c.creditLimitPaise) : 'No Limit'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-400">{formatINR(c.outstandingPaise)}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-semibold">
                              {c.aging}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Supplier Payables List */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3">
                  Supplier Payables Ledger (Owed to Material Suppliers)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Supplier Name</th>
                        <th className="p-2.5">Mobile</th>
                        <th className="p-2.5">City / Station</th>
                        <th className="p-2.5 text-right">Payable Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {outstandingData.suppliers.map((s, idx) => (
                        <tr key={idx} className="hover:bg-[#232330]">
                          <td className="p-2.5">
                            <div className="font-bold text-white">{s.name}</div>
                            {s.businessName && <div className="text-[10px] text-gray-400">{s.businessName}</div>}
                          </td>
                          <td className="p-2.5 text-gray-400 font-mono">{s.mobile}</td>
                          <td className="p-2.5 text-gray-300">{s.city}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-400">{formatINR(s.outstandingPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXPENSES REPORT */}
          {activeTab === 'EXPENSES' && expensesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Expenses</span>
                  <div className="text-lg font-bold text-rose-400 font-mono mt-1">
                    {formatINR(expensesData.totalExpensesPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">{expensesData.totalExpensesCount} Entries Recorded</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Cash Expenses</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {formatINR(expensesData.cashExpensePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Paid from drawer</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Bank / Online</span>
                  <div className="text-lg font-bold text-sky-400 font-mono mt-1">
                    {formatINR(expensesData.bankExpensePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Digital disbursements</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Major Category</span>
                  <div className="text-sm font-bold text-orange-400 mt-1 truncate">
                    {expensesData.categoryBreakdown[0]?.category || 'General'}
                  </div>
                  <span className="text-[10px] text-gray-500">Highest spend category</span>
                </div>
              </div>

              {/* Expense Category Breakdown */}
              {expensesData.categoryBreakdown.length > 0 && (
                <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                    Category Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {expensesData.categoryBreakdown.map((cat, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[#22222E] border border-[#303042]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{cat.category}</span>
                          <span className="text-gray-400 text-[10px]">{cat.percentage.toFixed(0)}%</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-rose-400 mt-1">{formatINR(cat.totalPaise)}</div>
                        <span className="text-[10px] text-gray-500">{cat.count} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Expenses Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                  Expense Register ({filteredExpenses.length} Records)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Payment Mode</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {filteredExpenses.map((e) => (
                        <tr key={e.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 text-gray-400">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2.5 font-bold text-orange-400">{e.category}</td>
                          <td className="p-2.5 text-white">{e.description}</td>
                          <td className="p-2.5 font-mono text-[11px] text-gray-300">{e.paymentMethod}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-400">{formatINR(e.amountPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CASH REPORT (CASH BOOK & FLOW) */}
          {activeTab === 'CASH' && cashData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Opening Cash</span>
                  <div className="text-base font-bold text-white font-mono mt-1">
                    {formatINR(cashData.openingCashPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Drawer Start</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Inflows (+)</span>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                    {formatINR(cashData.totalCashInflowPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Sales & Collections</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Outflows (-)</span>
                  <div className="text-base font-bold text-rose-400 font-mono mt-1">
                    {formatINR(cashData.totalCashOutflowPaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Expenses & Cash Buys</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Net Movement</span>
                  <div className={`text-base font-bold font-mono mt-1 ${
                    cashData.netCashChangePaise >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formatINR(cashData.netCashChangePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Inflows minus Outflows</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-orange-500/30 bg-orange-500/5">
                  <span className="text-[11px] text-orange-400 uppercase font-bold">Closing Cash (Drawer)</span>
                  <div className="text-base font-bold text-orange-400 font-mono mt-1">
                    {formatINR(cashData.closingCashPaise)}
                  </div>
                  <span className="text-[10px] text-gray-400">Current Cash In Hand</span>
                </div>
              </div>

              {/* Cash Book Transactions Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                  Cash Book Register ({cashData.transactions.length} Transactions)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right text-emerald-400">Inflow (+)</th>
                        <th className="p-2.5 text-right text-rose-400">Outflow (-)</th>
                        <th className="p-2.5 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {cashData.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 text-gray-400">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2.5 font-bold text-orange-400">{tx.type}</td>
                          <td className="p-2.5 text-white">{tx.description}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">
                            {tx.inflowPaise > 0 ? formatINR(tx.inflowPaise) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-rose-400">
                            {tx.outflowPaise > 0 ? formatINR(tx.outflowPaise) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">
                            {formatINR(tx.runningCashBalancePaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: INVENTORY REPORT (STOCK & VALUATION) */}
          {activeTab === 'INVENTORY' && inventoryData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Stock in Godown</span>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {inventoryData.totalQuantityPcs} PCS
                  </div>
                  <span className="text-[10px] text-gray-500">{inventoryData.totalProductsCount} Unique Bag Models</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Valuation at Purchase Cost</span>
                  <div className="text-xl font-bold text-orange-400 font-mono mt-1">
                    {formatINR(inventoryData.totalValuationAtPurchasePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Manufacturing / Inward Cost</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Wholesale Sale Value</span>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                    {formatINR(inventoryData.totalValuationAtWholesalePaise)}
                  </div>
                  <span className="text-[10px] text-gray-500">Potential Gross Realization</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Low Stock Warnings</span>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                    {inventoryData.lowStockCount} Models
                  </div>
                  <span className="text-[10px] text-gray-500">At or below reorder threshold</span>
                </div>
              </div>

              {/* Product Stock Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                  Catalog Stock Valuation Breakdown ({filteredProducts.length} Items)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-center">Stock (PCS)</th>
                        <th className="p-2.5 text-right">Cost Rate</th>
                        <th className="p-2.5 text-right">Wholesale Rate</th>
                        <th className="p-2.5 text-right">Cost Valuation</th>
                        <th className="p-2.5 text-right">Wholesale Value</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {filteredProducts.map((p) => (
                        <tr key={p.productId} className="hover:bg-[#232330]">
                          <td className="p-2.5 font-mono text-orange-400 font-semibold">{p.productCode}</td>
                          <td className="p-2.5 font-bold text-white">{p.name}</td>
                          <td className="p-2.5 text-gray-400">{p.category}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-white">{p.currentStock} PCS</td>
                          <td className="p-2.5 text-right font-mono text-gray-400">{formatINR(p.purchaseRatePaise)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">{formatINR(p.wholesaleRatePaise)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-orange-300">{formatINR(p.valuationCostPaise)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">{formatINR(p.valuationWholesalePaise)}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                              p.status === 'IN_STOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : p.status === 'LOW_STOCK'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {p.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PROFIT & LOSS REPORT */}
          {activeTab === 'PROFIT' && profitData && (
            <div className="space-y-4">
              {/* Executive P&L Income Statement Box */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-[#2C2C3D] mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Executive Profit & Loss Statement</h2>
                    <p className="text-xs text-gray-400">
                      Standard Wholesale Accounting: Sales Revenue − COGS = Gross Profit − Operating Expenses = Net Profit
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                    profitData.isProfitable
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {profitData.isProfitable ? 'Net Operating Profit' : 'Net Operating Deficit'}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 px-3 rounded-lg bg-[#22222E]">
                    <span className="text-gray-300 font-semibold">Gross Sales Revenue</span>
                    <span className="font-mono font-bold text-white">{formatINR(profitData.grossSalesRevenuePaise)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded-lg bg-[#22222E]">
                    <span className="text-gray-400">Less: Trade Discounts</span>
                    <span className="font-mono text-gray-400">{formatINR(profitData.discountPaise)}</span>
                  </div>
                  <div className="flex justify-between py-2 px-3 rounded-lg bg-[#262635] border border-[#333345] font-bold text-sm">
                    <span className="text-white">Net Sales Revenue</span>
                    <span className="font-mono text-emerald-400">{formatINR(profitData.netSalesRevenuePaise)}</span>
                  </div>

                  <div className="flex justify-between py-1.5 px-3 rounded-lg bg-[#22222E] text-rose-300">
                    <span>Less: Cost of Goods Sold (COGS - Bag Purchase/Fabric Cost)</span>
                    <span className="font-mono font-bold">{formatINR(profitData.costOfGoodsSoldPaise)}</span>
                  </div>

                  <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#2A2A3A] border border-orange-500/30 text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400">GROSS OPERATING PROFIT</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                        {profitData.grossMarginPercent.toFixed(1)}% Margin
                      </span>
                    </div>
                    <span className="font-mono text-orange-400">{formatINR(profitData.grossProfitPaise)}</span>
                  </div>

                  <div className="flex justify-between py-1.5 px-3 rounded-lg bg-[#22222E] text-rose-300">
                    <span>Less: Total Operating Expenses (Packaging, Transport, Overhead)</span>
                    <span className="font-mono font-bold">{formatINR(profitData.operatingExpensesPaise)}</span>
                  </div>

                  <div className={`flex justify-between py-3 px-4 rounded-xl border text-base font-bold ${
                    profitData.netProfitPaise >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span>NET BUSINESS PROFIT</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/30">
                        {profitData.netMarginPercent.toFixed(1)}% Net Margin
                      </span>
                    </div>
                    <span className="font-mono text-lg">{formatINR(profitData.netProfitPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Product Gross Margin Breakdown */}
              {profitData.itemBreakdown.length > 0 && (
                <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                    Product-Wise Gross Profit Contribution
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                        <tr>
                          <th className="p-2.5">Bag Description</th>
                          <th className="p-2.5 text-center">Qty Sold</th>
                          <th className="p-2.5 text-right">Revenue</th>
                          <th className="p-2.5 text-right">Cost (COGS)</th>
                          <th className="p-2.5 text-right">Gross Profit</th>
                          <th className="p-2.5 text-center">Gross Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B2B38]">
                        {profitData.itemBreakdown.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#232330]">
                            <td className="p-2.5 font-bold text-white">{item.productName}</td>
                            <td className="p-2.5 text-center font-mono text-orange-300">{item.quantitySold} PCS</td>
                            <td className="p-2.5 text-right font-mono text-white">{formatINR(item.revenuePaise)}</td>
                            <td className="p-2.5 text-right font-mono text-rose-300">{formatINR(item.costPaise)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-400">{formatINR(item.grossProfitPaise)}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-orange-400">
                              {item.marginPercent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Invariant Consistency Audit Modal Dialog */}
      {showAuditModal && auditResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1C1C26] border border-[#333346] rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#2C2C3D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  Database Invariant & Reconciliation Audit
                </h3>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-[#272736]"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                auditResult.allPassed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <div className="font-bold">
                  {auditResult.allPassed ? '✅ 100% Mathematical Consistency Verified' : '⚠️ Discrepancy Found in Database'}
                </div>
                <div className="font-mono text-xs">
                  {auditResult.passedTests}/{auditResult.totalTests} Checks Passed
                </div>
              </div>

              <div className="space-y-2">
                {auditResult.checks.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-[#232332] border border-[#2F2F42] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400">
                          {c.report}
                        </span>
                        <span className="font-semibold text-white">{c.invariant}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 font-mono">
                        Expected: {c.expected} • Computed: {c.actual}
                      </div>
                    </div>
                    <div>
                      {c.passed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                          PASSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                          FAILED
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-[#2C2C3D] flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 rounded-xl bg-orange-500 text-black font-bold text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
