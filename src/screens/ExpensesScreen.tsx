import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  Plus, 
  ArrowLeft, 
  Tag, 
  Calendar,
  X,
  TrendingDown
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Expense } from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { recordPhysicalCashMovement } from '../services/cashService';

interface ExpensesScreenProps {
  onBack: () => void;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ onBack }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [category, setCategory] = useState('Shop Rent');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');

  const loadExpenses = async () => {
    const list = await roomDb.getAll<Expense>('expenses');
    setExpenses(list.sort((a, b) => b.date - a.date));
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount) || 0;
    if (amtNum <= 0 || !description.trim()) return;

    const amtPaise = rupeesToPaise(amtNum);
    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      date: Date.now(),
      category,
      amountPaise: amtPaise,
      paymentMethod,
      description: description.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('expenses', newExp);

    // If Cash, record drawer outflow using transactional cashService
    // Non-cash methods (UPI, BANK) automatically do not touch physical cash
    if (paymentMethod === 'CASH') {
      await recordPhysicalCashMovement({
        type: 'CASH_EXPENSE',
        description: `Expense: ${category} - ${description}`,
        inflowPaise: 0,
        outflowPaise: amtPaise,
        paymentMethod: 'CASH',
        referenceId: newExp.id
      });
    }

    // Audit log
    await roomDb.put('audit_logs', {
      id: `audit-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      user: 'Cashier / Manager',
      action: 'RECORD_EXPENSE',
      timestamp: Date.now(),
      recordType: 'EXPENSE',
      recordId: newExp.id,
      notes: `Expense ₹${amtNum} for ${category} (${paymentMethod}): ${description}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    });

    setShowAddModal(false);
    setAmount('');
    setDescription('');
    loadExpenses();
  };

  const totalExpensePaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  const filtered = expenses.filter(e => 
    categoryFilter === 'ALL' ? true : e.category === categoryFilter
  );

  const categories = ['ALL', 'Shop Rent', 'Staff Tea & Food', 'Cartage & Coolie', 'Electricity Bill', 'Packaging Bags', 'Stationery', 'Miscellaneous'];

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Business Expenses & Outflows
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Daily Shop Expenses & Outward Cash Flow
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-400 flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Total Recorded Expenses</span>
          <div className="text-lg font-bold text-rose-400 font-mono mt-1">{formatINR(totalExpensePaise)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Total Entries</span>
          <div className="text-lg font-bold text-white font-mono mt-1">{expenses.length} Vouchers</div>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
              categoryFilter === c
                ? 'bg-orange-500 text-black font-bold'
                : 'bg-[#1A1A22] text-gray-400 hover:text-white border border-[#2C2C3A]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Expense List */}
      <div className="space-y-2">
        {filtered.map(e => (
          <div key={e.id} className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{e.category}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#252533] text-gray-400 font-mono">
                  {e.paymentMethod}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {e.description} • {new Date(e.date).toLocaleDateString()}
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-bold font-mono text-rose-400">
                -{formatINR(e.amountPaise)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white">Record Shop Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Shop Rent">Shop Rent</option>
                  <option value="Staff Tea & Food">Staff Tea & Food</option>
                  <option value="Cartage & Coolie">Cartage & Coolie</option>
                  <option value="Electricity Bill">Electricity Bill</option>
                  <option value="Packaging Bags">Packaging Bags</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="BANK">Bank Account</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Particulars / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily tea for shop staff"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
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
