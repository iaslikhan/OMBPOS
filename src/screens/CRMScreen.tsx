import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, 
  Search, 
  Plus, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  User, 
  Calendar,
  X,
  Phone,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  MapPin,
  HelpCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { CRMFollowUp, Customer, CRMType, CRMStatus, CRMViewFilter } from '../types';

interface CRMScreenProps {
  onBack: () => void;
}

export const CRMScreen: React.FC<CRMScreenProps> = ({ onBack }) => {
  const [followUps, setFollowUps] = useState<CRMFollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Views: Today | Overdue | Upcoming
  const [currentView, setCurrentView] = useState<CRMViewFilter>('TODAY');
  // Status filter: All | Pending | Completed | Cancelled
  const [statusFilter, setStatusFilter] = useState<'ALL' | CRMStatus>('ALL');
  // Type filter: All | PAYMENT | SALES | ORDER | CUSTOMER_VISIT | OTHER
  const [typeFilter, setTypeFilter] = useState<'ALL' | CRMType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CRMFollowUp | null>(null);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState<CRMType>('PAYMENT');
  const [scheduledDateStr, setScheduledDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [purpose, setPurpose] = useState('Payment Due Collection');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CRMStatus>('PENDING');

  const loadData = async () => {
    const list = await roomDb.getAll<CRMFollowUp>('crm_followups');
    const custs = await roomDb.getAll<Customer>('customers');
    setFollowUps(list);
    setCustomers(custs);
    if (custs.length > 0 && !customerId) {
      setCustomerId(custs[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'crm_followups' || table === 'customers') {
        loadData();
      }
    });
    return () => unsub();
  }, []);

  // Today boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  // Helper to categorize an item into Today / Overdue / Upcoming
  const getItemViewCategory = (item: CRMFollowUp): CRMViewFilter => {
    const targetDate = item.scheduledDate || item.nextDate || item.date || 0;
    if (targetDate < startOfToday) {
      return 'OVERDUE';
    } else if (targetDate > endOfToday) {
      return 'UPCOMING';
    } else {
      return 'TODAY';
    }
  };

  // Counts for tabs
  const counts = useMemo(() => {
    let today = 0;
    let overdue = 0;
    let upcoming = 0;

    followUps.forEach(item => {
      const cat = getItemViewCategory(item);
      if (cat === 'TODAY') today++;
      else if (cat === 'OVERDUE') overdue++;
      else if (cat === 'UPCOMING') upcoming++;
    });

    return { today, overdue, upcoming, total: followUps.length };
  }, [followUps, startOfToday, endOfToday]);

  const handleOpenModal = (existing?: CRMFollowUp) => {
    if (existing) {
      setEditingItem(existing);
      setCustomerId(existing.customerId);
      setType(existing.type || 'PAYMENT');
      const d = new Date(existing.scheduledDate || existing.nextDate || existing.date || Date.now());
      setScheduledDateStr(d.toISOString().split('T')[0]);
      setPurpose(existing.purpose || '');
      setNotes(existing.notes || '');
      setStatus(existing.status || 'PENDING');
    } else {
      setEditingItem(null);
      if (customers.length > 0) setCustomerId(customers[0].id);
      setType('PAYMENT');
      setScheduledDateStr(new Date().toISOString().split('T')[0]);
      setPurpose('Payment Due Collection');
      setNotes('');
      setStatus('PENDING');
    }
    setShowAddModal(true);
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    const parts = scheduledDateStr.split('-');
    const scheduledTimestamp = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      10, 0, 0
    ).getTime();

    const followUpRecord: CRMFollowUp = {
      id: editingItem ? editingItem.id : `crm-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      customerId: cust.id,
      customerName: cust.name,
      customerMobile: cust.mobile,
      type,
      purpose: purpose.trim() || getDefaultPurpose(type),
      scheduledDate: scheduledTimestamp,
      date: scheduledTimestamp,
      nextDate: scheduledTimestamp,
      notes: notes.trim(),
      status,
      completedAt: status === 'COMPLETED' ? (editingItem?.completedAt || Date.now()) : undefined,
      createdAt: editingItem ? editingItem.createdAt : Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('crm_followups', followUpRecord);
    setShowAddModal(false);
    setEditingItem(null);
    loadData();
  };

  const getDefaultPurpose = (t: CRMType) => {
    switch (t) {
      case 'PAYMENT': return 'Collect Outstanding Due / Cheque Clearance';
      case 'SALES': return 'School Session / Festive Bag Catalog Inquiry';
      case 'ORDER': return 'Confirm Custom Printed Bag Order Specs';
      case 'CUSTOMER_VISIT': return 'Field Visit to Burrabazar / Howrah Shop';
      case 'OTHER': return 'General Customer Relationship Follow-up';
    }
  };

  const handleUpdateStatus = async (item: CRMFollowUp, newStatus: CRMStatus) => {
    const updated: CRMFollowUp = {
      ...item,
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? Date.now() : undefined,
      updatedAt: Date.now()
    };
    await roomDb.put('crm_followups', updated);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this CRM follow-up record?')) {
      await roomDb.delete('crm_followups', id);
      loadData();
    }
  };

  // Filtered followups
  const filtered = followUps.filter(f => {
    // 1. View Filter (Today | Overdue | Upcoming)
    const matchesView = getItemViewCategory(f) === currentView;

    // 2. Status Filter (Pending | Completed | Cancelled)
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;

    // 3. Type Filter (Payment | Sales | Order | Customer Visit | Other)
    const matchesType = typeFilter === 'ALL' || f.type === typeFilter;

    // 4. Search Term
    const matchesSearch = 
      f.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.customerMobile && f.customerMobile.includes(searchTerm)) ||
      (f.purpose && f.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.notes && f.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesView && matchesStatus && matchesType && matchesSearch;
  }).sort((a, b) => {
    // Sort by scheduledDate
    return (a.scheduledDate || 0) - (b.scheduledDate || 0);
  });

  const getTypeIcon = (t: CRMType) => {
    switch (t) {
      case 'PAYMENT': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'SALES': return <TrendingUp className="w-4 h-4 text-sky-400" />;
      case 'ORDER': return <ShoppingBag className="w-4 h-4 text-orange-400" />;
      case 'CUSTOMER_VISIT': return <MapPin className="w-4 h-4 text-purple-400" />;
      case 'OTHER': return <HelpCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (s: CRMStatus) => {
    switch (s) {
      case 'PENDING':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950/60 text-rose-400 border border-rose-800/40 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Wholesale CRM & Follow-up Center
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Payment Recovery, Repeat Orders & Customer Visits
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-3.5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md active:scale-98 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Follow-up</span>
        </button>
      </div>

      {/* Primary Views: TODAY | OVERDUE | UPCOMING */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#1A1A22] border border-[#2B2B38]">
        <button
          onClick={() => setCurrentView('TODAY')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            currentView === 'TODAY'
              ? 'bg-orange-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Today ({counts.today})</span>
        </button>

        <button
          onClick={() => setCurrentView('OVERDUE')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            currentView === 'OVERDUE'
              ? 'bg-rose-500 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Overdue ({counts.overdue})</span>
        </button>

        <button
          onClick={() => setCurrentView('UPCOMING')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            currentView === 'UPCOMING'
              ? 'bg-sky-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming ({counts.upcoming})</span>
        </button>
      </div>

      {/* Filter Bar: Types & Statuses */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, mobile, purpose or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121217] border border-[#2B2B38] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-gray-400">Status:</span>
            {(['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === s 
                    ? 'bg-[#2E2E3E] text-white border border-[#444458]' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* CRM Type Filters (Payment, Sales, Order, Customer Visit, Other) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">
            Type:
          </span>
          {[
            { id: 'ALL', label: 'All Types' },
            { id: 'PAYMENT', label: 'Payment' },
            { id: 'SALES', label: 'Sales' },
            { id: 'ORDER', label: 'Order' },
            { id: 'CUSTOMER_VISIT', label: 'Customer Visit' },
            { id: 'OTHER', label: 'Other' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTypeFilter(item.id as any)}
              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                typeFilter === item.id
                  ? 'bg-orange-500 text-black font-bold shadow-md'
                  : 'bg-[#22222E] text-gray-300 hover:bg-[#2C2C3A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of Follow-ups */}
      {filtered.length === 0 ? (
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-8 text-center text-gray-500 text-xs">
          No follow-ups found for the selected view and filter criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-[#1A1A22] border rounded-2xl p-4 space-y-3 transition-all ${
                item.status === 'COMPLETED' 
                  ? 'border-[#282834] opacity-80' 
                  : item.status === 'CANCELLED' 
                  ? 'border-rose-950/40 opacity-60' 
                  : getItemViewCategory(item) === 'OVERDUE'
                  ? 'border-rose-500/40'
                  : 'border-[#2B2B38]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#22222D] border border-[#2F2F3E] mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{item.customerName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#252533] text-orange-300 font-semibold uppercase tracking-wider">
                        {item.type}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="text-xs text-gray-300 mt-1 font-medium">
                      {item.purpose}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">
                        "{item.notes}"
                      </p>
                    )}

                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                      <span className="font-mono">
                        Scheduled: {new Date(item.scheduledDate).toLocaleDateString()}
                      </span>
                      {item.customerMobile && (
                        <span>• Phone: {item.customerMobile}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit & Delete actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-sky-400 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Update Quick Toggles & Communication */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#282836]">
                {/* Communication buttons */}
                {item.customerMobile ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${item.customerMobile}`}
                      className="py-1.5 px-3 rounded-xl bg-[#252533] hover:bg-[#303042] text-gray-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call</span>
                    </a>

                    <a
                      href={`https://wa.me/91${item.customerMobile.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                        `Namaskar ${item.customerName}, this is Original Modi Bags regarding ${item.purpose}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No mobile recorded</div>
                )}

                {/* Status Switchers */}
                <div className="flex items-center gap-1.5">
                  {item.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleUpdateStatus(item, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Completed</span>
                    </button>
                  )}

                  {item.status !== 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus(item, 'PENDING')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Set Pending</span>
                    </button>
                  )}

                  {item.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleUpdateStatus(item, 'CANCELLED')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-bold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Follow-up Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-orange-400" />
                <span>{editingItem ? 'Edit Follow-up' : 'Schedule CRM Follow-up'}</span>
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Wholesale Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city || 'Kolkata'}) - {c.mobile}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1 font-semibold">CRM Type *</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const newT = e.target.value as CRMType;
                      setType(newT);
                      setPurpose(getDefaultPurpose(newT));
                    }}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="PAYMENT">Payment</option>
                    <option value="SALES">Sales</option>
                    <option value="ORDER">Order</option>
                    <option value="CUSTOMER_VISIT">Customer Visit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-semibold">Follow-up Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduledDateStr}
                    onChange={(e) => setScheduledDateStr(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Purpose / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment Due Follow-up / New School Bag Samples"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Detailed Notes / Commitment</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Party promised payment on Friday after bank clearing"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PENDING', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`py-1.5 rounded-xl font-bold text-xs ${
                        status === s 
                          ? s === 'PENDING' ? 'bg-amber-500 text-black' : s === 'COMPLETED' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                          : 'bg-[#252533] text-gray-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-3.5 py-2 rounded-xl bg-[#252533] text-gray-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold shadow-md"
                >
                  {editingItem ? 'Update Follow-up' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
