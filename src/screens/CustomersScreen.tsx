import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  CreditCard, 
  ArrowLeft, 
  FileText, 
  DollarSign, 
  History, 
  X, 
  CheckCircle,
  AlertCircle,
  MessageCircle,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Printer,
  ChevronRight,
  TrendingDown,
  Building,
  UserCheck,
  Send,
  Eye
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { 
  Customer, 
  CustomerLedgerTransaction, 
  CRMFollowUp, 
  BusinessProfile,
  PaymentMethod,
  CustomerLedgerTxType
} from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { 
  computeCustomerBalanceFromTransactions, 
  postCustomerLedgerTransaction 
} from '../services/customerLedgerService';
import { PaymentReceiptModal } from '../components/PaymentReceiptModal';

interface CustomersScreenProps {
  onBack: () => void;
  onNavigateBilling?: () => void;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ onBack, onNavigateBilling }) => {
  // Screen Tabs: 'CUSTOMERS' or 'FOLLOWUPS'
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'FOLLOWUPS'>('CUSTOMERS');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('ALL');

  // Customer Ledger Modal & Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerTransaction[]>([]);
  const [customerFollowUps, setCustomerFollowUps] = useState<CRMFollowUp[]>([]);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptTx, setReceiptTx] = useState<CustomerLedgerTransaction | null>(null);

  // Add Customer Form Fields
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('Kolkata');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [preferredTransport, setPreferredTransport] = useState('');

  // Payment Form Fields
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMethod>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [payRefNo, setPayRefNo] = useState('');

  // Sales Return / Credit Note Form Fields
  const [returnAmount, setReturnAmount] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged bag return / Defective stitch');
  const [returnBillRef, setReturnBillRef] = useState('');

  // Follow-up Form Fields
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpDays, setFollowUpDays] = useState(3);
  const [followUpPurpose, setFollowUpPurpose] = useState<'PAYMENT' | 'ORDER' | 'SALES'>('PAYMENT');

  // All CRM Followups
  const [allFollowUps, setAllFollowUps] = useState<CRMFollowUp[]>([]);

  const loadData = async () => {
    const list = await roomDb.getAll<Customer>('customers');
    const biz = await roomDb.getAll<BusinessProfile>('business_profile');
    const followups = await roomDb.getAll<CRMFollowUp>('crm_followups');
    setCustomers(list);
    setBusinessProfile(biz[0] || null);
    setAllFollowUps(followups.sort((a, b) => (a.scheduledDate || 0) - (b.scheduledDate || 0)));
  };

  useEffect(() => {
    loadData();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'customers' || table === 'customer_ledger' || table === 'crm_followups') {
        loadData();
        if (selectedCustomer) {
          viewCustomerDetails(selectedCustomer.id);
        }
      }
    });
    return () => unsub();
  }, [selectedCustomer?.id]);

  const viewCustomerDetails = async (customerId: string) => {
    const cust = await roomDb.get<Customer>('customers', customerId);
    if (!cust) return;

    setSelectedCustomer(cust);
    const allLedger = await roomDb.getAll<CustomerLedgerTransaction>('customer_ledger');
    const custLedger = allLedger.filter(l => l.customerId === cust.id);

    // Compute balance from transaction ledger to guarantee mathematical integrity
    const computed = computeCustomerBalanceFromTransactions(custLedger);
    // Sort descending for display
    setLedgerEntries(computed.orderedTransactions.reverse());

    // Load customer follow-ups
    const allFollow = await roomDb.getAll<CRMFollowUp>('crm_followups');
    setCustomerFollowUps(allFollow.filter(f => f.customerId === cust.id));
  };

  // Add Wholesale Customer with transactional Opening Balance
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const opPaise = rupeesToPaise(parseFloat(openingBalance) || 0);
    const creditLimitPaise = rupeesToPaise(parseFloat(creditLimit) || 50000);
    const custId = `cust-${Date.now()}`;

    const newCust: Customer = {
      id: custId,
      businessId: 'biz-original-modi-bags',
      customerId: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim(),
      businessName: businessName.trim() || undefined,
      mobile: mobile.trim() || '9830000000',
      whatsapp: (whatsapp.trim() || mobile.trim()) || undefined,
      city: city.trim() || 'Kolkata',
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      openingBalancePaise: opPaise,
      currentOutstandingPaise: opPaise,
      creditLimitPaise,
      preferredTransport: preferredTransport.trim() || undefined,
      totalSalesPaise: 0,
      totalPaymentsPaise: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('customers', newCust);

    // If opening balance > 0, write atomic Opening Balance ledger transaction
    if (opPaise > 0) {
      await roomDb.put('customer_ledger', {
        id: `ledg-op-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        customerId: newCust.id,
        date: Date.now(),
        type: 'OPENING_BALANCE',
        description: 'Opening Balance Carried Forward',
        debitPaise: opPaise,
        creditPaise: 0,
        runningBalancePaise: opPaise,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    setShowAddModal(false);
    setName('');
    setBusinessName('');
    setMobile('');
    setWhatsapp('');
    setOpeningBalance('0');
    setCreditLimit('50000');
    setAddress('');
    setPreferredTransport('');
    await loadData();
  };

  // Receive Payment: Appends transactional Credit entry
  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amountNum = parseFloat(payAmount) || 0;
    if (amountNum <= 0) return;

    const amountPaise = rupeesToPaise(amountNum);
    const desc = payNotes ? `Payment: ${payNotes}` : `Payment Received via ${payMode}`;

    const { customer: updated, transaction: newTx } = await postCustomerLedgerTransaction({
      customerId: selectedCustomer.id,
      type: 'PAYMENT',
      description: desc,
      debitPaise: 0,
      creditPaise: amountPaise,
      paymentMethod: payMode,
      referenceDocumentNumber: payRefNo.trim() || `REC-${Date.now().toString().slice(-6)}`,
      date: Date.now()
    });

    setSelectedCustomer(updated);
    setReceiptTx(newTx);
    setShowPaymentModal(false);
    setShowReceiptModal(true);
    setPayAmount('');
    setPayNotes('');
    setPayRefNo('');
    await viewCustomerDetails(updated.id);
  };

  // Record Sales Return (Credit Note): Reduces customer outstanding balance
  const handleRecordReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const returnNum = parseFloat(returnAmount) || 0;
    if (returnNum <= 0) return;

    const returnPaise = rupeesToPaise(returnNum);
    const desc = returnBillRef 
      ? `Sales Return against Bill #${returnBillRef}: ${returnReason}`
      : `Sales Return Credit Note: ${returnReason}`;

    const { customer: updated } = await postCustomerLedgerTransaction({
      customerId: selectedCustomer.id,
      type: 'SALES_RETURN',
      description: desc,
      debitPaise: 0,
      creditPaise: returnPaise,
      referenceDocumentNumber: returnBillRef ? `RET-${returnBillRef}` : undefined,
      date: Date.now()
    });

    setSelectedCustomer(updated);
    setShowReturnModal(false);
    setReturnAmount('');
    setReturnBillRef('');
    await viewCustomerDetails(updated.id);
  };

  // Schedule CRM Follow-up
  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !followUpNotes.trim()) return;

    const scheduledDate = Date.now() + followUpDays * 24 * 60 * 60 * 1000;
    const newFollowUp: CRMFollowUp = {
      id: `crm-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerMobile: selectedCustomer.mobile,
      type: followUpPurpose,
      purpose: followUpPurpose === 'PAYMENT' ? 'Payment Due Collection Follow-up' : 'Wholesale Bag Order Inquiries',
      date: Date.now(),
      scheduledDate,
      notes: followUpNotes.trim(),
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('crm_followups', newFollowUp);
    setShowFollowUpModal(false);
    setFollowUpNotes('');
    await loadData();
    await viewCustomerDetails(selectedCustomer.id);
  };

  // Mark Follow-up Completed
  const handleCompleteFollowUp = async (id: string) => {
    const item = await roomDb.get<CRMFollowUp>('crm_followups', id);
    if (item) {
      await roomDb.put('crm_followups', {
        ...item,
        status: 'COMPLETED',
        updatedAt: Date.now()
      });
      await loadData();
      if (selectedCustomer) {
        await viewCustomerDetails(selectedCustomer.id);
      }
    }
  };

  // Direct Phone Call
  const handleCallCustomer = (mobileNumber: string) => {
    window.location.href = `tel:${mobileNumber}`;
  };

  // Direct WhatsApp Message / Reminder
  const handleWhatsAppCustomer = (cust: Customer, customText?: string) => {
    const rawNumber = (cust.whatsapp || cust.mobile || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;

    const defaultReminder = `Namaste ${cust.name} ji 🙏,
Greetings from *ORIGINAL MODI BAGS*, 3 Amartalla Lane, Kolkata.

Your current wholesale ledger outstanding due balance is *${formatINR(cust.currentOutstandingPaise)}*.

Kindly arrange the payment at your earliest convenience via UPI or Bank Transfer.

For any queries regarding bag designs or bills, please contact Ratan Modi at +91 98300 00000.
Thank you!`;

    const textToSend = customText || defaultReminder;
    const encoded = encodeURIComponent(textToSend);
    const url = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  // Filtered Customers
  const filtered = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      (c.businessName && c.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = filterCity === 'ALL' || (c.city || 'Kolkata') === filterCity;
    return matchesSearch && matchesCity;
  });

  const uniqueCities = Array.from(new Set(customers.map(c => c.city || 'Kolkata')));
  const totalReceivables = customers.reduce((sum, c) => sum + (c.currentOutstandingPaise || 0), 0);
  const overCreditLimitCustomers = customers.filter(c => c.creditLimitPaise && c.currentOutstandingPaise > c.creditLimitPaise);
  const pendingFollowups = allFollowUps.filter(f => f.status === 'PENDING');

  // Load Spec Test Preset Customer: Opening ₹10,000, Credit ₹4,065, Payment ₹2,000, Payment ₹1,000
  const handleLoadPhase4SpecTest = async () => {
    const testCustId = 'cust-spec-phase4';
    const existing = await roomDb.get<Customer>('customers', testCustId);

    const testCust: Customer = {
      id: testCustId,
      businessId: 'biz-original-modi-bags',
      customerId: 'CUST-SPEC4',
      name: 'Agarwal Bag Emporium (Phase 4 Spec Test)',
      businessName: 'Agarwal Bag Emporium',
      mobile: '9831122334',
      whatsapp: '9831122334',
      city: 'Kolkata (Burrabazar)',
      address: '14, Canning Street, Kolkata',
      openingBalancePaise: rupeesToPaise(10000),
      currentOutstandingPaise: rupeesToPaise(11065),
      creditLimitPaise: rupeesToPaise(25000),
      totalSalesPaise: rupeesToPaise(4065),
      totalPaymentsPaise: rupeesToPaise(3000),
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('customers', testCust);

    // Delete existing ledger for clean test
    const allLedgers = await roomDb.getAll<CustomerLedgerTransaction>('customer_ledger');
    for (const l of allLedgers.filter(l => l.customerId === testCustId)) {
      await roomDb.delete('customer_ledger', l.id);
    }

    const t0 = Date.now() - 3600000;
    // Step 1: Opening ₹10,000
    await roomDb.put('customer_ledger', {
      id: `ledg-test-1`,
      businessId: 'biz-original-modi-bags',
      customerId: testCustId,
      date: t0,
      type: 'OPENING_BALANCE',
      description: 'Opening Balance Carried Forward',
      debitPaise: rupeesToPaise(10000),
      creditPaise: 0,
      runningBalancePaise: rupeesToPaise(10000),
      createdAt: t0,
      updatedAt: t0,
      syncStatus: 'LOCAL'
    });

    // Step 2: Credit ₹4065 (Master Bill 33 pcs)
    const t1 = t0 + 600000;
    await roomDb.put('customer_ledger', {
      id: `ledg-test-2`,
      businessId: 'biz-original-modi-bags',
      customerId: testCustId,
      date: t1,
      type: 'CREDIT_SALE',
      description: 'Credit Sale Bill #BILL-2001 (33 pcs: Hypora, Club, Schoolboy)',
      referenceDocumentNumber: 'BILL-2001',
      debitPaise: rupeesToPaise(4065),
      creditPaise: 0,
      runningBalancePaise: rupeesToPaise(14065),
      createdAt: t1,
      updatedAt: t1,
      syncStatus: 'LOCAL'
    });

    // Step 3: Payment ₹2000 => Expected ₹12065
    const t2 = t1 + 600000;
    await roomDb.put('customer_ledger', {
      id: `ledg-test-3`,
      businessId: 'biz-original-modi-bags',
      customerId: testCustId,
      date: t2,
      type: 'PAYMENT',
      description: 'Payment Received via CASH',
      paymentMethod: 'CASH',
      referenceDocumentNumber: 'REC-2001',
      debitPaise: 0,
      creditPaise: rupeesToPaise(2000),
      runningBalancePaise: rupeesToPaise(12065),
      createdAt: t2,
      updatedAt: t2,
      syncStatus: 'LOCAL'
    });

    // Step 4: Then payment ₹1000 => Expected ₹11065
    const t3 = t2 + 600000;
    await roomDb.put('customer_ledger', {
      id: `ledg-test-4`,
      businessId: 'biz-original-modi-bags',
      customerId: testCustId,
      date: t3,
      type: 'PAYMENT',
      description: 'Payment Received via UPI',
      paymentMethod: 'UPI',
      referenceDocumentNumber: 'REC-2002',
      debitPaise: 0,
      creditPaise: rupeesToPaise(1000),
      runningBalancePaise: rupeesToPaise(11065),
      createdAt: t3,
      updatedAt: t3,
      syncStatus: 'LOCAL'
    });

    await loadData();
    await viewCustomerDetails(testCustId);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Card */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white hover:bg-[#2F2F40]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Wholesale Customers, Credit & Ledger
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Transaction-based accounting, credit limits & payment follow-ups
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 4 Master Spec Test Runner */}
          <button
            onClick={handleLoadPhase4SpecTest}
            className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-orange-300 border border-orange-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            title="Load Spec: Op ₹10000 + Sale ₹4065 - Pay ₹2000 (Exp: ₹12065) - Pay ₹1000 (Exp: ₹11065)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load Phase 4 Test</span>
          </button>

          {/* Tab Selector */}
          <div className="flex items-center bg-[#121217] p-1 rounded-xl border border-[#2D2D3B] text-xs">
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'CUSTOMERS' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Accounts ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('FOLLOWUPS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'FOLLOWUPS' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Follow-ups</span>
              {pendingFollowups.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'FOLLOWUPS' ? 'bg-black text-orange-400' : 'bg-orange-500 text-black'
                }`}>
                  {pendingFollowups.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Metrics Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-gray-400">Total Receivables (Due)</span>
          <div className="text-lg font-bold text-amber-400 font-mono mt-1">
            {formatINR(totalReceivables)}
          </div>
          <span className="text-[10px] text-gray-500">Across {customers.length} accounts</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-gray-400">Credit Limit Breaches</span>
          <div className="text-lg font-bold font-mono mt-1 text-red-400 flex items-center gap-1">
            <span>{overCreditLimitCustomers.length}</span>
            {overCreditLimitCustomers.length > 0 && (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
          </div>
          <span className="text-[10px] text-gray-500">Accounts exceeding limit</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-gray-400">Pending Follow-ups</span>
          <div className="text-lg font-bold font-mono mt-1 text-orange-400">
            {pendingFollowups.length} Tasks
          </div>
          <span className="text-[10px] text-gray-500">Calls & WhatsApp reminders</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-gray-400">Accounting Rule</span>
          <div className="text-xs font-bold text-emerald-400 mt-1">
            Transaction Ledger
          </div>
          <span className="text-[10px] text-gray-500">No direct balance overwrites</span>
        </div>
      </div>

      {/* TAB 1: WHOLESALE CUSTOMERS LIST */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-3">
          {/* Search & City Filter Bar */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, phone, business, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
              <span className="text-gray-400">Filter City:</span>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="bg-[#121217] border border-[#2D2D3D] rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="ALL">All Cities ({customers.length})</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.length === 0 ? (
              <div className="col-span-2 bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-8 text-center text-gray-500 text-xs">
                No wholesale customers found matching your criteria.
              </div>
            ) : (
              filtered.map((c) => {
                const isOverLimit = !!(c.creditLimitPaise && c.currentOutstandingPaise > c.creditLimitPaise);
                return (
                  <div 
                    key={c.id}
                    className={`bg-[#1A1A22] border rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all hover:bg-[#20202A] ${
                      isOverLimit ? 'border-red-900/60 bg-red-950/10' : 'border-[#2B2B38] hover:border-[#38384A]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{c.name}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#252533] text-orange-300">
                              {c.customerId}
                            </span>
                          </div>
                          {c.businessName && (
                            <div className="text-xs text-gray-300 font-medium mt-0.5">
                              {c.businessName}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3">
                            <span>Ph: {c.mobile}</span>
                            <span>•</span>
                            <span>{c.city || 'Kolkata'}</span>
                          </div>
                        </div>

                        {/* Balance Callout */}
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block font-semibold">Current Balance</span>
                          <span className={`text-base font-bold font-mono ${
                            c.currentOutstandingPaise > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {formatINR(c.currentOutstandingPaise)}
                          </span>
                          {c.creditLimitPaise ? (
                            <span className={`text-[10px] block font-mono ${
                              isOverLimit ? 'text-red-400 font-bold' : 'text-gray-500'
                            }`}>
                              Limit: {formatINR(c.creditLimitPaise)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Over limit warning */}
                      {isOverLimit && (
                        <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span>Credit limit exceeded by {formatINR(c.currentOutstandingPaise - (c.creditLimitPaise || 0))}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="pt-2 border-t border-[#282838] flex items-center justify-between gap-2 text-xs">
                      {/* Communication Actions: Call & WhatsApp */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCallCustomer(c.mobile)}
                          className="p-1.5 rounded-lg bg-[#252535] hover:bg-[#303045] text-blue-400 transition-all"
                          title={`Call ${c.name} (${c.mobile})`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleWhatsAppCustomer(c)}
                          className="p-1.5 rounded-lg bg-[#1b3323] hover:bg-[#254932] text-emerald-400 transition-all"
                          title="Send Due Reminder on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCustomer(c);
                            viewCustomerDetails(c.id);
                            setShowPaymentModal(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1 transition-all"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>

                        <button
                          onClick={() => viewCustomerDetails(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#35354E] text-white font-semibold flex items-center gap-1 transition-all"
                        >
                          <History className="w-3.5 h-3.5 text-orange-400" />
                          <span>Ledger</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CRM FOLLOW-UPS & DUE REMINDERS */}
      {activeTab === 'FOLLOWUPS' && (
        <div className="space-y-3">
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Pending Due Follow-ups & Reminders</h3>
              <p className="text-xs text-gray-400">Track promises to pay, overdue accounts and scheduled client calls</p>
            </div>
            <span className="text-xs font-mono text-orange-400 font-bold bg-[#14141A] px-3 py-1 rounded-xl border border-[#2B2B38]">
              {pendingFollowups.length} Tasks Scheduled
            </span>
          </div>

          <div className="space-y-2">
            {allFollowUps.length === 0 ? (
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-8 text-center text-gray-500 text-xs">
                No follow-ups recorded yet. Open any customer ledger and click "Schedule Follow-up".
              </div>
            ) : (
              allFollowUps.map((f) => {
                const isOverdue = (f.scheduledDate || 0) < Date.now() && f.status === 'PENDING';
                return (
                  <div
                    key={f.id}
                    className={`bg-[#1A1A22] border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      isOverdue ? 'border-red-900/60 bg-red-950/10' : 'border-[#2B2B38]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{f.customerName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.status === 'COMPLETED' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                            : isOverdue 
                            ? 'bg-red-950 text-red-400 border border-red-800' 
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {f.status === 'COMPLETED' ? 'COMPLETED' : isOverdue ? 'OVERDUE' : 'PENDING'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#252533] text-gray-300">
                          {f.type || 'PAYMENT'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1 font-medium">{f.notes}</p>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Scheduled for: {new Date(f.scheduledDate || f.date || 0).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {f.customerMobile && (
                        <>
                          <button
                            onClick={() => handleCallCustomer(f.customerMobile || '')}
                            className="p-2 rounded-xl bg-[#252535] hover:bg-[#303045] text-blue-400"
                            title="Call Customer"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const cust = customers.find(c => c.id === f.customerId);
                              if (cust) handleWhatsAppCustomer(cust);
                            }}
                            className="p-2 rounded-xl bg-[#1b3323] hover:bg-[#254932] text-emerald-400"
                            title="WhatsApp Due Reminder"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {f.status === 'PENDING' && (
                        <button
                          onClick={() => handleCompleteFollowUp(f.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 flex items-center gap-1 transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Done</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* FULL CUSTOMER ACCOUNT & TRANSACTIONAL LEDGER MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header Strip */}
            <div className="p-4 border-b border-[#2C2C3A] flex items-center justify-between bg-[#15151D]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedCustomer.name}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2A2A3A] text-orange-300 font-bold">
                    {selectedCustomer.customerId}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedCustomer.businessName ? `${selectedCustomer.businessName} • ` : ''}
                  Mobile: {selectedCustomer.mobile} • City: {selectedCustomer.city || 'Kolkata'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCallCustomer(selectedCustomer.mobile)}
                  className="p-2 rounded-xl bg-[#252535] hover:bg-[#303045] text-blue-400 text-xs flex items-center gap-1"
                  title="Call Customer"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">Call</span>
                </button>
                <button
                  onClick={() => handleWhatsAppCustomer(selectedCustomer)}
                  className="p-2 rounded-xl bg-[#1b3323] hover:bg-[#254932] text-emerald-400 text-xs flex items-center gap-1"
                  title="WhatsApp Statement Reminder"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-400 hover:text-white p-2 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial Metrics Banner */}
            <div className="p-4 bg-[#141419] border-b border-[#282836] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block">Current Outstanding Balance</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {formatINR(selectedCustomer.currentOutstandingPaise)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Credit Limit</span>
                <span className="text-sm font-bold font-mono text-gray-200">
                  {selectedCustomer.creditLimitPaise ? formatINR(selectedCustomer.creditLimitPaise) : 'No Limit'}
                </span>
                {selectedCustomer.creditLimitPaise && selectedCustomer.currentOutstandingPaise > selectedCustomer.creditLimitPaise && (
                  <span className="text-[10px] text-red-400 font-bold block">Limit Breached</span>
                )}
              </div>
              <div>
                <span className="text-gray-400 block">Opening Balance</span>
                <span className="text-sm font-mono text-gray-300">
                  {formatINR(selectedCustomer.openingBalancePaise || 0)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Preferred Transport</span>
                <span className="text-xs text-orange-300 font-semibold truncate block">
                  {selectedCustomer.preferredTransport || 'Local Kolkata / Direct'}
                </span>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="p-3 bg-[#181822] border-b border-[#282836] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow-md"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Receive Payment</span>
                </button>
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-orange-300 border border-orange-500/30 font-semibold text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Record Return / Credit Note</span>
                </button>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-blue-300 border border-blue-500/30 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Follow-up</span>
                </button>
              </div>

              {onNavigateBilling && (
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    onNavigateBilling();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 text-xs font-bold"
                >
                  New Wholesale Bill →
                </button>
              )}
            </div>

            {/* Transaction Ledger Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Transaction-Based Account Ledger ({ledgerEntries.length} Transactions)
                </h4>
                <span className="text-[11px] text-gray-500">
                  Strictly Derived: Balance = Debits - Credits
                </span>
              </div>

              {ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  No individual ledger entries recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Particulars / Description</th>
                        <th className="p-2.5 text-right">Debit (Sale / Op)</th>
                        <th className="p-2.5 text-right">Credit (Payment / Ret)</th>
                        <th className="p-2.5 text-right">Running Balance</th>
                        <th className="p-2.5 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {ledgerEntries.map((l) => (
                        <tr key={l.id} className="hover:bg-[#232330]">
                          <td className="p-2.5 text-gray-400 font-mono text-[11px]">
                            {new Date(l.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              l.type === 'CREDIT_SALE' 
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' 
                                : l.type === 'PAYMENT'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : l.type === 'SALES_RETURN'
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                : 'bg-gray-800 text-gray-300'
                            }`}>
                              {l.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-2.5 font-medium text-white max-w-xs truncate">
                            {l.description}
                            {l.referenceDocumentNumber && (
                              <span className="ml-1 text-[10px] text-gray-500 font-mono">
                                (#{l.referenceDocumentNumber})
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-amber-300">
                            {l.debitPaise > 0 ? formatINR(l.debitPaise) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-400">
                            {l.creditPaise > 0 ? formatINR(l.creditPaise) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">
                            {formatINR(l.runningBalancePaise)}
                          </td>
                          <td className="p-2.5 text-center">
                            {l.type === 'PAYMENT' && (
                              <button
                                onClick={() => {
                                  setReceiptTx(l);
                                  setShowReceiptModal(true);
                                }}
                                className="p-1 rounded bg-[#2B2B3C] hover:bg-[#38384E] text-orange-400"
                                title="Print / Share Official Receipt"
                              >
                                <ReceiptIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Receive Payment from {selectedCustomer.name}
                </h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceivePayment} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141419] border border-[#272733] flex justify-between">
                <span className="text-gray-400">Current Outstanding Due:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatINR(selectedCustomer.currentOutstandingPaise)}
                </span>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Amount to Receive (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 2000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Payment Mode</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['CASH', 'UPI', 'BANK', 'CHEQUE'] as PaymentMethod[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPayMode(mode)}
                      className={`py-1.5 rounded-lg font-semibold transition-all text-center ${
                        payMode === mode
                          ? 'bg-orange-500 text-black'
                          : 'bg-[#22222E] text-gray-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Cheque No / UTR / Reference No</label>
                <input
                  type="text"
                  placeholder="Optional reference number"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Notes / Particulars</label>
                <input
                  type="text"
                  placeholder="e.g. Counter cash payment"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {payAmount && (
                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex justify-between">
                  <span>Balance After Payment:</span>
                  <span className="font-mono font-bold">
                    {formatINR(Math.max(0, selectedCustomer.currentOutstandingPaise - rupeesToPaise(parseFloat(payAmount) || 0)))}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 shadow-md"
                >
                  Record & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALES RETURN / CREDIT NOTE MODAL */}
      {showReturnModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white">
                  Sales Return Credit Note
                </h3>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordReturn} className="space-y-3 text-xs">
              <p className="text-gray-400">
                Issue a credit note for returned, defective, or exchanged wholesale bags. This decreases customer outstanding balance.
              </p>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Credit Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 450"
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Reason for Return</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="Damaged bag return / Defective stitch">Damaged bag return / Defective stitch</option>
                  <option value="Zip runner issue / Hardware replacement">Zip runner issue / Hardware replacement</option>
                  <option value="Unsold inventory exchange">Unsold inventory exchange</option>
                  <option value="Wrong model delivered">Wrong model delivered</option>
                  <option value="Special wholesale rate discount adjustment">Special wholesale rate discount adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Original Bill Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. BILL-2001"
                  value={returnBillRef}
                  onChange={(e) => setReturnBillRef(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white uppercase placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 shadow-md"
                >
                  Post Credit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE CRM FOLLOW-UP MODAL */}
      {showFollowUpModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Schedule Follow-up with {selectedCustomer.name}
                </h3>
              </div>
              <button onClick={() => setShowFollowUpModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Purpose</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['PAYMENT', 'ORDER', 'SALES'] as ('PAYMENT' | 'ORDER' | 'SALES')[]).map((purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => setFollowUpPurpose(purpose)}
                      className={`py-1.5 rounded-lg font-semibold transition-all text-center ${
                        followUpPurpose === purpose
                          ? 'bg-orange-500 text-black'
                          : 'bg-[#22222E] text-gray-400 hover:text-white'
                      }`}
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Follow-up In</label>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setFollowUpDays(days)}
                      className={`py-1.5 rounded-lg font-semibold transition-all text-center ${
                        followUpDays === days
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#22222E] text-gray-400 hover:text-white'
                      }`}
                    >
                      {days === 1 ? 'Tomorrow' : `${days} Days`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Notes / Discussion Details *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Customer promised payment of ₹5000 on Friday afternoon by RTGS."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-400 shadow-md"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white">Add Wholesale Customer Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">Customer / Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Agarwal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">Business / Firm Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Agarwal Bag House"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">Calling Mobile *</label>
                  <input
                    type="tel"
                    required
                    placeholder="10 digit number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    placeholder="Same as mobile if blank"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">City / Mandi Hub</label>
                  <input
                    type="text"
                    placeholder="Kolkata / Patna / Ranchi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Preferred Transport Line</label>
                  <input
                    type="text"
                    placeholder="e.g. New Bengal Transport"
                    value={preferredTransport}
                    onChange={(e) => setPreferredTransport(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Shop / Godown Address</label>
                <input
                  type="text"
                  placeholder="e.g. 12, Canning Street, Burrabazar"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-gray-500">Creates transactional opening balance</span>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-gray-500">Warns on limit breaches</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400"
                >
                  Save Wholesale Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL MONEY PAYMENT RECEIPT MODAL */}
      {showReceiptModal && selectedCustomer && receiptTx && (
        <PaymentReceiptModal
          customer={selectedCustomer}
          transaction={receiptTx}
          businessProfile={businessProfile}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptTx(null);
          }}
        />
      )}
    </div>
  );
};
