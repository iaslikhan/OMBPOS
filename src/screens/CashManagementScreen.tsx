import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Calculator, 
  RefreshCw, 
  CheckCircle,
  Coins
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { CashTransaction } from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { computePhysicalCashBalance, recordPhysicalCashMovement } from '../services/cashService';

interface CashManagementScreenProps {
  onBack: () => void;
}

export const CashManagementScreen: React.FC<CashManagementScreenProps> = ({ onBack }) => {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  
  // Denomination state
  const [denoms, setDenoms] = useState<{ [key: number]: number }>({
    500: 10,
    200: 15,
    100: 25,
    50: 20,
    20: 30,
    10: 50
  });

  // Entry Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const loadCashTransactions = async () => {
    const list = await roomDb.getAll<CashTransaction>('cash_transactions');
    const computed = computePhysicalCashBalance(list);
    setTransactions(computed.transactions.reverse());
  };

  useEffect(() => {
    loadCashTransactions();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'cash_transactions') {
        loadCashTransactions();
      }
    });
    return () => unsub();
  }, []);

  const handleDenomChange = (val: number, count: number) => {
    setDenoms({ ...denoms, [val]: Math.max(0, count) });
  };

  const physicalCashTotal = Object.entries(denoms).reduce((sum, [val, count]) => {
    return sum + (parseInt(val) * count);
  }, 0);

  const totalInflowPaise = transactions.reduce((sum, t) => sum + t.inflowPaise, 0);
  const totalOutflowPaise = transactions.reduce((sum, t) => sum + t.outflowPaise, 0);
  const ledgerCashPaise = Math.max(0, totalInflowPaise - totalOutflowPaise);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount) || 0;
    if (amtNum <= 0 || !description.trim()) return;

    const amtPaise = rupeesToPaise(amtNum);
    await recordPhysicalCashMovement({
      type: entryType === 'IN' ? 'DEPOSIT' : 'WITHDRAWAL',
      description: description.trim(),
      inflowPaise: entryType === 'IN' ? amtPaise : 0,
      outflowPaise: entryType === 'OUT' ? amtPaise : 0,
      paymentMethod: 'CASH'
    });

    await roomDb.put('audit_logs', {
      id: `audit-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      user: 'Cashier / Admin',
      action: entryType === 'IN' ? 'CASH_DRAWER_DEPOSIT' : 'CASH_DRAWER_WITHDRAWAL',
      timestamp: Date.now(),
      recordType: 'CASH',
      recordId: `cash-${Date.now()}`,
      notes: `${entryType === 'IN' ? 'Deposit' : 'Withdrawal'} of ₹${amtNum}: ${description.trim()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    });

    setShowAddModal(false);
    setAmount('');
    setDescription('');
    loadCashTransactions();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Cash Management & Drawer Counter
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Physical Drawer Count vs System Cash Ledger
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Cash Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">System Cash Book Balance</span>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {formatINR(ledgerCashPaise)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Physical Drawer Count (Tally)</span>
          <div className="text-lg font-bold text-white font-mono mt-1">
            {formatINR(rupeesToPaise(physicalCashTotal))}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Count Variance</span>
          <div className={`text-lg font-bold font-mono mt-1 ${
            physicalCashTotal === paiseToRupees(ledgerCashPaise) ? 'text-emerald-400' : 'text-yellow-400'
          }`}>
            ₹{Math.abs(physicalCashTotal - paiseToRupees(ledgerCashPaise))}
          </div>
        </div>
      </div>

      {/* Denominations Tally Table */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-orange-400" />
          <span>Physical Currency Denominations Calculator</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {[500, 200, 100, 50, 20, 10].map((val) => (
            <div key={val} className="p-3 rounded-xl bg-[#141419] border border-[#272733] space-y-1">
              <span className="font-bold text-orange-400 font-mono text-sm">₹{val}</span>
              <div>
                <label className="text-[10px] text-gray-400 block">Count</label>
                <input
                  type="number"
                  min="0"
                  value={denoms[val]}
                  onChange={(e) => handleDenomChange(val, parseInt(e.target.value) || 0)}
                  className="w-full bg-[#1A1A22] border border-[#2D2D3D] rounded-lg px-2 py-1 text-white font-mono font-bold text-center focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="text-[11px] font-mono text-gray-300 text-right pt-1 border-t border-[#23232E]">
                = ₹{val * denoms[val]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cash Log */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Cash Inflow & Outflow History ({transactions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
              <tr>
                <th className="p-2.5">Date & Time</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Particulars</th>
                <th className="p-2.5 text-right">Inflow (Cash In)</th>
                <th className="p-2.5 text-right">Outflow (Cash Out)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2B38]">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-[#232330]">
                  <td className="p-2.5 text-gray-400 font-mono text-[11px]">
                    {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252533] text-gray-300">
                      {t.type}
                    </span>
                  </td>
                  <td className="p-2.5 font-medium text-white">{t.description}</td>
                  <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                    {t.inflowPaise > 0 ? `+${formatINR(t.inflowPaise)}` : '-'}
                  </td>
                  <td className="p-2.5 text-right font-mono text-rose-400 font-bold">
                    {t.outflowPaise > 0 ? `-${formatINR(t.outflowPaise)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Cash Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Record Cash Drawer Transaction</h3>

            <form onSubmit={handleSaveEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryType('IN')}
                  className={`py-2 rounded-xl font-bold ${
                    entryType === 'IN' ? 'bg-emerald-500 text-black' : 'bg-[#252533] text-gray-300'
                  }`}
                >
                  Cash In (Deposit)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('OUT')}
                  className={`py-2 rounded-xl font-bold ${
                    entryType === 'OUT' ? 'bg-rose-500 text-white' : 'bg-[#252533] text-gray-300'
                  }`}
                >
                  Cash Out (Withdrawal)
                </button>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Particulars / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank cash withdrawal / Petty cash float"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
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
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold"
                >
                  Save Cash Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
