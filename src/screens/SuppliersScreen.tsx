import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Phone, 
  ArrowLeft, 
  DollarSign, 
  X,
  CreditCard,
  FileText,
  Clock,
  Send,
  MessageCircle,
  TrendingDown,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Supplier, SupplierLedgerTransaction, PaymentMethod } from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { 
  computeSupplierBalanceFromTransactions, 
  postSupplierLedgerTransaction 
} from '../services/supplierLedgerService';
import { recordPhysicalCashMovement } from '../services/cashService';

interface SuppliersScreenProps {
  onBack: () => void;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Selected supplier for detail / ledger view
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<SupplierLedgerTransaction[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // New Supplier Form
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('Kolkata');
  const [outstanding, setOutstanding] = useState('0');

  // Supplier Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK');
  const [payDescription, setPayDescription] = useState('Payment against pending bills');

  const loadSuppliers = async () => {
    const s = await roomDb.getAll<Supplier>('suppliers');
    setSuppliers(s);

    if (selectedSupplier) {
      const refreshed = s.find(item => item.id === selectedSupplier.id);
      if (refreshed) {
        setSelectedSupplier(refreshed);
        loadLedgerForSupplier(refreshed.id);
      }
    }
  };

  const loadLedgerForSupplier = async (supplierId: string) => {
    const all = await roomDb.getAll<SupplierLedgerTransaction>('supplier_ledger');
    const filtered = all.filter(tx => tx.supplierId === supplierId);
    const calculated = computeSupplierBalanceFromTransactions(filtered);
    setSupplierLedger(calculated.orderedTransactions.reverse()); // most recent first
  };

  useEffect(() => {
    loadSuppliers();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'suppliers' || table === 'supplier_ledger') {
        loadSuppliers();
      }
    });
    return () => unsub();
  }, [selectedSupplier?.id]);

  const handleSelectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    loadLedgerForSupplier(s.id);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const outPaise = rupeesToPaise(parseFloat(outstanding) || 0);
    const code = `SUPP-${Math.floor(100 + Math.random() * 900)}`;
    const newSupp: Supplier = {
      id: `supp-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      supplierId: code,
      supplierCode: code,
      name: name.trim(),
      businessName: businessName.trim() || undefined,
      mobile: mobile.trim() || '9876543210',
      city: city.trim() || 'Kolkata',
      openingBalancePaise: outPaise,
      currentOutstandingPaise: outPaise,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('suppliers', newSupp);

    // If opening balance > 0, post transactional opening entry in supplier ledger!
    if (outPaise > 0) {
      await postSupplierLedgerTransaction({
        supplierId: newSupp.id,
        type: 'OPENING_BALANCE',
        description: 'Opening balance payable',
        creditPaise: outPaise,
        debitPaise: 0,
        notes: 'Initial opening ledger entry'
      });
    }

    setShowAddModal(false);
    setName('');
    setBusinessName('');
    setMobile('');
    setOutstanding('0');
    loadSuppliers();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amtNum = parseFloat(payAmount) || 0;
    if (amtNum <= 0) return;

    const amtPaise = rupeesToPaise(amtNum);

    // 1. Post to supplier ledger (Debit: reduces our liability)
    const { supplier: updatedSupp } = await postSupplierLedgerTransaction({
      supplierId: selectedSupplier.id,
      type: 'PAYMENT',
      description: payDescription.trim() || `Payment via ${payMethod}`,
      creditPaise: 0,
      debitPaise: amtPaise,
      paymentMethod: payMethod,
      notes: `Settled via ${payMethod}`
    });

    // 2. If Cash, update physical drawer!
    if (payMethod === 'CASH') {
      await recordPhysicalCashMovement({
        type: 'CASH_PURCHASE',
        description: `Cash paid to supplier ${selectedSupplier.name}`,
        inflowPaise: 0,
        outflowPaise: amtPaise,
        paymentMethod: 'CASH',
        referenceId: selectedSupplier.id
      });
    }

    setSelectedSupplier(updatedSupp);
    await loadLedgerForSupplier(selectedSupplier.id);
    setShowPaymentModal(false);
    setPayAmount('');
    loadSuppliers();
  };

  const totalPayables = suppliers.reduce((sum, s) => sum + (s.currentOutstandingPaise || 0), 0);

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.businessName && s.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.mobile.includes(searchTerm)
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (selectedSupplier) {
                setSelectedSupplier(null);
              } else {
                onBack();
              }
            }} 
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {selectedSupplier ? `${selectedSupplier.name} (Ledger)` : 'Suppliers & Fabric Vendors'}
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Transactional Supplier Ledger & Payables
            </p>
          </div>
        </div>

        {!selectedSupplier ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        ) : (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>Make Payment</span>
          </button>
        )}
      </div>

      {selectedSupplier ? (
        /* DETAIL & TRANSACTIONAL LEDGER VIEW */
        <div className="space-y-4">
          {/* Supplier Header Banner */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-gray-400">Supplier / Vendor</span>
              <h3 className="text-lg font-bold text-white">{selectedSupplier.name}</h3>
              {selectedSupplier.businessName && (
                <p className="text-xs text-orange-400 mt-0.5">{selectedSupplier.businessName}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Phone: {selectedSupplier.mobile} • City: {selectedSupplier.city || 'Kolkata'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#141419] border border-[#2B2B38] flex flex-col justify-center">
              <span className="text-xs text-gray-400">Current Outstanding Payable</span>
              <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                {formatINR(selectedSupplier.currentOutstandingPaise)}
              </div>
              <span className="text-[11px] text-gray-500 mt-0.5">Derived from immutable ledger credits & debits</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <a
                href={`tel:${selectedSupplier.mobile}`}
                className="px-3 py-2 rounded-xl bg-[#252533] text-gray-200 hover:text-white border border-[#3A3A4C] text-xs font-semibold flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call</span>
              </a>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 rounded-xl bg-orange-500 text-black text-xs font-bold hover:bg-orange-400 shadow-md flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Pay Supplier</span>
              </button>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-400" />
                <span>Supplier Account Statement / Ledger Entries</span>
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                {supplierLedger.length} Transactions
              </span>
            </div>

            {supplierLedger.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No ledger transactions recorded for this vendor. Record an inward purchase or payment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Inward (Credit +)</th>
                      <th className="p-2.5 text-right">Payment (Debit -)</th>
                      <th className="p-2.5 text-right">Running Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B2B38]">
                    {supplierLedger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#232330]">
                        <td className="p-2.5 font-mono text-[11px] text-gray-400">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="p-2.5 font-semibold">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            tx.type === 'PURCHASE' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                            tx.type === 'PAYMENT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-2.5 font-medium text-white">
                          {tx.description}
                          {tx.paymentMethod && (
                            <span className="ml-2 text-[10px] text-gray-400 bg-[#252533] px-1.5 py-0.5 rounded font-mono">
                              {tx.paymentMethod}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-rose-400 font-bold">
                          {tx.creditPaise > 0 ? `+${formatINR(tx.creditPaise)}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                          {tx.debitPaise > 0 ? `-${formatINR(tx.debitPaise)}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">
                          {formatINR(tx.runningBalancePaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VENDOR LIST VIEW */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
              <span className="text-xs text-gray-400">Registered Suppliers</span>
              <div className="text-xl font-bold text-white font-mono mt-1">{suppliers.length} Vendors</div>
            </div>
            <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
              <span className="text-xs text-gray-400">Total Payables Due</span>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1">{formatINR(totalPayables)}</div>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search supplier name, firm or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A1A22] border border-[#2B2B38] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-2">
            {filtered.map(s => (
              <div 
                key={s.id} 
                onClick={() => handleSelectSupplier(s)}
                className="bg-[#1A1A22] border border-[#2B2B38] hover:border-orange-500/50 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{s.name}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#252533] text-gray-300">
                      {s.supplierCode || s.supplierId}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.businessName ? `${s.businessName} • ` : ''}Phone: {s.mobile} • City: {s.city || 'Kolkata'}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">Balance Payable</span>
                  <span className="text-sm font-bold font-mono text-rose-400">
                    {formatINR(s.currentOutstandingPaise)}
                  </span>
                  <span className="text-[10px] text-orange-400 block mt-0.5 hover:underline">
                    View Ledger →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white">Add Raw Material & Bag Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengal Fabrics & Accessories"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Firm Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bengal Bag Materials Pvt Ltd"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Mobile</label>
                  <input
                    type="tel"
                    placeholder="10 digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Opening Payable Due (₹)</label>
                <input
                  type="number"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div>
                <h3 className="text-sm font-bold text-white">Record Payment to {selectedSupplier.name}</h3>
                <span className="text-xs text-gray-400">Current Due: {formatINR(selectedSupplier.currentOutstandingPaise)}</span>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BANK', 'UPI', 'CASH'] as PaymentMethod[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`py-2 rounded-xl text-center font-bold transition-all ${
                        payMethod === m
                          ? 'bg-emerald-500 text-black shadow-md'
                          : 'bg-[#121217] text-gray-400 border border-[#2D2D3D]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {payMethod !== 'CASH' && (
                  <p className="text-[11px] text-sky-400 mt-1.5">
                    ℹ️ Bank/UPI payment will reduce supplier due without touching physical cash drawer.
                  </p>
                )}
                {payMethod === 'CASH' && (
                  <p className="text-[11px] text-amber-400 mt-1.5">
                    ⚠️ Cash payment will deduct physical cash from drawer.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Description / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. RTGS / UTR #12345 or Cash voucher"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold shadow-lg"
                >
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
