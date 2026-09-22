import React, { useEffect, useState } from 'react';
import { 
  Calculator, 
  UserPlus, 
  ArrowDownLeft, 
  PlusCircle, 
  ShoppingBag, 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Database,
  Building2,
  Receipt,
  Truck,
  Phone,
  ArrowUpRight,
  CreditCard,
  Wallet,
  X
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { SystemStats, Product, Customer, Bill, Expense, CashTransaction } from '../types';
import { formatINR, rupeesToPaise } from '../services/currency';
import { NavigationTarget } from '../components/NavigationDrawer';
import { LoadingState } from '../components/CommonStates';

interface HomeScreenProps {
  onNavigate: (target: NavigationTarget) => void;
  isOnline: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, isOnline }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [recentPayments, setRecentPayments] = useState<CashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States for Quick Actions
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showReceivePaymentModal, setShowReceivePaymentModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // Form inputs
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustCity, setNewCustCity] = useState('Kolkata');
  const [newCustOpening, setNewCustOpening] = useState('0');

  const [paymentCustId, setPaymentCustId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [expCategory, setExpCategory] = useState('Packaging');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expMode, setExpMode] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');

  const loadData = async () => {
    try {
      const currentStats = await roomDb.getSystemStats();
      const currentProducts = await roomDb.getAll<Product>('products');
      const currentCustomers = await roomDb.getAll<Customer>('customers');
      const allBills = await roomDb.getAll<Bill>('bills');
      const allCash = await roomDb.getAll<CashTransaction>('cash_transactions');
      
      // Sort recent bills by date descending
      const sortedBills = [...allBills].sort((a, b) => (b.date || 0) - (a.date || 0));
      
      // Filter recent payment/collections
      const sortedPayments = [...allCash]
        .filter(c => (c.inflowPaise || 0) > 0)
        .sort((a, b) => (b.date || 0) - (a.date || 0));

      setStats(currentStats);
      setProducts(currentProducts);
      setCustomers(currentCustomers);
      setRecentBills(sortedBills.slice(0, 5));
      setRecentPayments(sortedPayments.slice(0, 5));
      
      if (currentCustomers.length > 0 && !paymentCustId) {
        setPaymentCustId(currentCustomers[0].id);
      }
    } catch (err) {
      console.error('Error reading Room database', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = roomDb.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const openingPaise = rupeesToPaise(parseFloat(newCustOpening) || 0);
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      customerId: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      name: newCustName.trim(),
      mobile: newCustMobile.trim() || '9876543210',
      city: newCustCity.trim() || 'Kolkata',
      openingBalancePaise: openingPaise,
      currentOutstandingPaise: openingPaise,
      totalSalesPaise: 0,
      totalPaymentsPaise: 0,
      creditLimitPaise: rupeesToPaise(50000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL',
    };

    await roomDb.put('customers', newCustomer);
    setShowNewCustomerModal(false);
    setNewCustName('');
    setNewCustMobile('');
    setNewCustOpening('0');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount) || 0;
    if (amountNum <= 0 || !paymentCustId) return;

    const amountPaise = rupeesToPaise(amountNum);
    const targetCust = customers.find(c => c.id === paymentCustId);
    if (!targetCust) return;

    const newOutstanding = Math.max(0, targetCust.currentOutstandingPaise - amountPaise);

    // 1. Update customer balance
    await roomDb.put('customers', {
      ...targetCust,
      currentOutstandingPaise: newOutstanding,
      totalPaymentsPaise: (targetCust.totalPaymentsPaise || 0) + amountPaise,
      updatedAt: Date.now()
    });

    // 2. Add customer ledger entry
    await roomDb.put('customer_ledger', {
      id: `ledg-pay-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      customerId: targetCust.id,
      date: Date.now(),
      type: 'PAYMENT',
      description: paymentNotes ? `Payment Received: ${paymentNotes}` : `Payment Received via ${paymentMode}`,
      debitPaise: 0,
      creditPaise: amountPaise,
      runningBalancePaise: newOutstanding,
      paymentMethod: paymentMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL',
    });

    // 3. Record in cash transactions if Cash
    if (paymentMode === 'CASH') {
      await roomDb.put('cash_transactions', {
        id: `cash-pay-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        date: Date.now(),
        type: 'CASH_SALE',
        description: `Cash received from ${targetCust.name}`,
        inflowPaise: amountPaise,
        outflowPaise: 0,
        runningCashBalancePaise: (stats?.physicalCashBalancePaise || 0) + amountPaise,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    setShowReceivePaymentModal(false);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(expAmount) || 0;
    if (amtNum <= 0) return;

    const amtPaise = rupeesToPaise(amtNum);
    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      date: Date.now(),
      category: expCategory,
      description: expDescription || `Expense for ${expCategory}`,
      amountPaise: amtPaise,
      paymentMethod: expMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL',
    };

    await roomDb.put('expenses', newExp);

    if (expMode === 'CASH') {
      await roomDb.put('cash_transactions', {
        id: `cash-exp-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        date: Date.now(),
        type: 'CASH_EXPENSE',
        description: `${expCategory}: ${expDescription || 'Expense payment'}`,
        inflowPaise: 0,
        outflowPaise: amtPaise,
        runningCashBalancePaise: Math.max(0, (stats?.physicalCashBalancePaise || 0) - amtPaise),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    setShowAddExpenseModal(false);
    setExpAmount('');
    setExpDescription('');
  };

  if (isLoading || !stats) {
    return <LoadingState message="Initializing Room Database & calculating wholesale ledger totals..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Wholesale Header */}
      <div className="bg-gradient-to-r from-[#1E1E26] to-[#181820] border border-[#2D2D3B] rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                ORIGINAL MODI BAGS
              </h2>
            </div>
            <p className="text-xs text-gray-300">
              3, Amartalla Lane, Kolkata-700001 | Wholesale Bag Business System
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-[#252533] border border-[#3A3A4C] flex items-center gap-2 text-xs">
              <Database className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-gray-400 font-medium">Source of Truth</div>
                <div className="text-emerald-300 font-bold">Room DB Active</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Business Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Quick Business Actions
          </h3>
          <span className="text-[10px] text-gray-500">Instant Wholesale Operations</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <button
            id="action-quick-bill"
            onClick={() => onNavigate('BILLING')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 active:scale-95 transition-all shadow-md shadow-orange-500/20"
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="truncate">Quick Bill</span>
          </button>

          <button
            id="action-new-customer"
            onClick={() => setShowNewCustomerModal(true)}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#22222E] text-white hover:bg-[#2A2A3A] border border-[#333345] font-semibold text-xs active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="truncate">New Customer</span>
          </button>

          <button
            id="action-receive-payment"
            onClick={() => setShowReceivePaymentModal(true)}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#22222E] text-white hover:bg-[#2A2A3A] border border-[#333345] font-semibold text-xs active:scale-95 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Receive Payment</span>
          </button>

          <button
            id="action-add-expense"
            onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#22222E] text-white hover:bg-[#2A2A3A] border border-[#333345] font-semibold text-xs active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">Add Expense</span>
          </button>

          <button
            id="action-new-purchase"
            onClick={() => onNavigate('PURCHASE')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#22222E] text-white hover:bg-[#2A2A3A] border border-[#333345] font-semibold text-xs active:scale-95 transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">New Purchase</span>
          </button>
        </div>
      </div>

      {/* Primary Financial & Operational Metrics (Strictly from real Room DB) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Today's Wholesale Financial Position
          </h3>
          <span className="text-[10px] text-gray-500">Exact Integer Paise Calculations</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Today's Sales */}
          <div 
            onClick={() => onNavigate('BILLING')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-orange-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Today's Sales</span>
              <TrendingUp className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight">
              {formatINR(stats.todaySalesPaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Live from Room Bills</span>
          </div>

          {/* Today's Collection */}
          <div 
            onClick={() => onNavigate('CASH_MANAGEMENT')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Today's Collection</span>
              <DollarSign className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono tracking-tight">
              {formatINR(stats.todayCollectionPaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Cash & digital received</span>
          </div>

          {/* Today's Expenses */}
          <div 
            onClick={() => onNavigate('EXPENSES')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-rose-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Today's Expenses</span>
              <Receipt className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-400 font-mono tracking-tight">
              {formatINR(stats.todayExpensesPaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Rent, van, packaging, tea</span>
          </div>

          {/* Receivables (Customer Credit) */}
          <div 
            onClick={() => onNavigate('CUSTOMERS')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-amber-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Receivables (Due)</span>
              <CreditCard className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-400 font-mono tracking-tight">
              {formatINR(stats.outstandingReceivablesPaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">From wholesale customers</span>
          </div>

          {/* Payables (Supplier Credit) */}
          <div 
            onClick={() => onNavigate('SUPPLIERS')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-red-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Payables (Suppliers)</span>
              <Truck className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-400 font-mono tracking-tight">
              {formatINR(stats.outstandingPayablesPaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Due to bag/fabric vendors</span>
          </div>

          {/* Total Stock Value */}
          <div 
            onClick={() => onNavigate('INVENTORY')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-sky-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Stock Valuation</span>
              <Package className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight">
              {formatINR(stats.currentStockValuePaise)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Purchase rate basis</span>
          </div>

          {/* Low Stock Alerts */}
          <div 
            onClick={() => onNavigate('INVENTORY')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-yellow-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Low Stock Items</span>
              <AlertTriangle className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-yellow-400 font-mono tracking-tight">
              {stats.lowStockCount} Products
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">At or below minimum threshold</span>
          </div>

          {/* Pending Follow-ups */}
          <div 
            onClick={() => onNavigate('CRM')}
            className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38] hover:border-purple-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Pending Follow-ups</span>
              <Clock className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-purple-400 font-mono tracking-tight">
              {stats.pendingFollowUpsCount} Pending
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">Wholesale payment reminders</span>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Recent Bills & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Bills Card */}
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-400" />
                <h4 className="text-sm font-bold text-white">
                  Recent Bills
                </h4>
              </div>
              <button
                onClick={() => onNavigate('BILLING')}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1"
              >
                <span>View Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentBills.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No bills recorded yet. Use Quick Bill to generate invoices.
              </div>
            ) : (
              <div className="space-y-2">
                {recentBills.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-[#22222D] border border-[#313142] flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-orange-300">
                          {b.billNumber}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D2D3B] text-gray-300">
                          {b.documentType}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        {b.customerName}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {b.items.length} items • {b.totalQuantity} pcs • {new Date(b.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">
                        {formatINR(b.grandTotalPaise)}
                      </div>
                      <div className="text-[10px]">
                        {b.balancePaise > 0 ? (
                          <span className="text-amber-400 font-medium">Due: {formatINR(b.balancePaise)}</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">Fully Paid</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments & Collections */}
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  Recent Collections & Cash Flow
                </h4>
              </div>
              <button
                onClick={() => onNavigate('CASH_MANAGEMENT')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <span>Cash Register</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No recent payment transactions recorded today.
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-[#22222D] border border-[#313142] flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {p.description}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {p.type} • {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        +{formatINR(p.inflowPaise)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Drawer: {formatINR(p.runningCashBalancePaise)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Catalog & Wholesale Stock Snapshot */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-400" />
            <h4 className="text-sm font-bold text-white">
              Inventory Snapshot in Room Database
            </h4>
          </div>
          <button
            onClick={() => onNavigate('INVENTORY')}
            className="text-xs text-orange-400 hover:text-orange-300 font-medium"
          >
            Manage All Stock →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p.id} className="p-3 rounded-xl bg-[#22222D] border border-[#313142] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{p.name}</span>
                  <span className="font-mono text-[10px] text-orange-400">{p.productCode}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Category: {p.category} • HSN: {p.hsn || '4202'}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2F2F3D]">
                <div>
                  <div className="text-[10px] text-gray-400">Wholesale Rate</div>
                  <div className="text-xs font-bold font-mono text-white">
                    {formatINR(p.wholesaleRatePaise)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">Available Stock</div>
                  <div className={`text-xs font-bold font-mono ${p.currentStock <= p.minimumStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {p.currentStock} PCS
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture & Financial Test Suite Card */}
      <FoundationTestCard />

      {/* MODAL 1: New Customer */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Add Wholesale Customer</h3>
              </div>
              <button 
                onClick={() => setShowNewCustomerModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Customer / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Howrah Bag Stores"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="10 digit mobile"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">City / Market</label>
                  <input
                    type="text"
                    placeholder="Kolkata"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Opening Credit Balance (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newCustOpening}
                  onChange={(e) => setNewCustOpening(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-gray-400">Previous balance owed by customer</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400"
                >
                  Save to Room DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Receive Payment */}
      {showReceivePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Receive Customer Payment</h3>
              </div>
              <button 
                onClick={() => setShowReceivePaymentModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Select Customer</label>
                <select
                  value={paymentCustId}
                  onChange={(e) => setPaymentCustId(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Due: {formatINR(c.currentOutstandingPaise)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 2000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="CASH">Cash (Drawer)</option>
                    <option value="UPI">UPI (Google Pay / PhonePe)</option>
                    <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Notes / Transaction Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Cash received at counter or UTR number"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowReceivePaymentModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                >
                  Record Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Record Business Expense</h3>
              </div>
              <button 
                onClick={() => setShowAddExpenseModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Expense Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Packaging">Packaging (Tape, Bags)</option>
                    <option value="Transport">Local Transport & Cartage</option>
                    <option value="Rent">Shop / Godown Rent</option>
                    <option value="Salary">Staff Salary / Daily Wages</option>
                    <option value="Tea">Tea & Snacks</option>
                    <option value="Electricity">Electricity & Power</option>
                    <option value="Stationery">Stationery & Printing</option>
                    <option value="Other">Other Expenses</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Payment Mode</label>
                  <select
                    value={expMode}
                    onChange={(e) => setExpMode(e.target.value as any)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="CASH">Cash (Drawer)</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 350"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Description / Paid To</label>
                <input
                  type="text"
                  placeholder="e.g. 5 rolls packing tape from Amartalla lane"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-400"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FoundationTestCard: React.FC = () => {
  const [testResults, setTestResults] = useState<{ passed: boolean; results: string[] } | null>(null);

  const runTests = async () => {
    const { runFoundationTests } = await import('../tests/foundation.test');
    const { runPhase3QuickBillTests } = await import('../tests/quickBill.test');
    const { runPhase4CustomerLedgerTests } = await import('../tests/customerLedger.test');
    const { runPhase5InventoryTests } = await import('../tests/inventory.test');
    const { runPhase6PurchaseAndCashTests } = await import('../tests/purchaseAndCash.test');
    const { runPhase7TransportAndCRMTests } = await import('../tests/transportAndCRM.test');
    const fRes = runFoundationTests();
    const p3Res = runPhase3QuickBillTests();
    const p4Res = runPhase4CustomerLedgerTests();
    const p5Res = runPhase5InventoryTests();
    const p6Res = runPhase6PurchaseAndCashTests();
    const p7Res = runPhase7TransportAndCRMTests();
    setTestResults({
      passed: fRes.passed && p3Res.passed && p4Res.passed && p5Res.passed && p6Res.passed && p7Res.passed,
      results: [
        ...fRes.results, 
        '--- PHASE 3 QUICK BILL TESTS ---', 
        ...p3Res.results,
        '--- PHASE 4 CUSTOMERS & LEDGER TESTS ---',
        ...p4Res.results,
        '--- PHASE 5 PRODUCTS & INVENTORY TESTS ---',
        ...p5Res.results,
        '--- PHASE 6 PURCHASE, SUPPLIER, EXPENSE & CASH TESTS ---',
        ...p6Res.results,
        '--- PHASE 7 TRANSPORT & CRM TESTS ---',
        ...p7Res.results
      ]
    });
  };

  return (
    <div className="bg-[#1A1A23] border border-[#2B2B38] rounded-2xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-white">
            Architecture, Financial & Offline Verification
          </h4>
        </div>
        <button
          id="btn-run-foundation-tests"
          onClick={runTests}
          className="px-3 py-1.5 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Run Verification Tests</span>
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Executes real verification checks: 33 pcs & ₹4065 Quick Bill math, ₹10000 + ₹4065 - ₹2000 = ₹12065 Customer Ledger math, Phase 5 Inventory lifecycle (Op 100 → Sale 12 → Purchase 50 → Sales Return 2 → Purchase Return 10 = 130), StockMovement logging, and free-text inventory exclusion.
      </p>

      {testResults && (
        <div className="p-3 rounded-xl bg-[#141419] border border-[#2C2C3A] text-xs font-mono space-y-1">
          <div className={`font-bold pb-1 mb-1 border-b border-[#2C2C3A] ${testResults.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResults.passed ? 'ALL SYSTEM ARCHITECTURE, FINANCIAL & INVENTORY TESTS PASSED' : 'TEST FAILURES DETECTED'}
          </div>
          {testResults.results.map((res, i) => (
            <div key={i} className="text-gray-300">
              {res}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
