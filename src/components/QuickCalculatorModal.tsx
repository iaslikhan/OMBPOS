import React, { useState } from 'react';
import { Calculator, Plus, X, ArrowRight, CornerDownLeft, RefreshCcw } from 'lucide-react';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';

interface QuickCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLineItem: (item: {
    details: string;
    quantity: number;
    ratePaise: number;
    isPermanentProduct: boolean;
  }) => void;
}

export const QuickCalculatorModal: React.FC<QuickCalculatorModalProps> = ({
  isOpen,
  onClose,
  onAddLineItem
}) => {
  const [display, setDisplay] = useState('0');
  const [details, setDetails] = useState('');
  const [qty, setQty] = useState<number>(12);
  const [rate, setRate] = useState<number>(120);
  const [isPermanent, setIsPermanent] = useState(false);

  if (!isOpen) return null;

  // Preset quick buttons matching Modi Bags fast selling products & typical wholesale bundles
  const quickTestBundles = [
    { label: 'HYPORA 12 × ₹120', name: 'HYPORA', q: 12, r: 120, perm: true },
    { label: 'CLUB 6 × ₹75', name: 'CLUB', q: 6, r: 75, perm: true },
    { label: 'SCHOOLBOY 15 × ₹145', name: 'SCHOOLBOY', q: 15, r: 145, perm: true },
    { label: 'DELUXE 6 × ₹190', name: 'DELUXE', q: 6, r: 190, perm: true },
    { label: 'DUFFEL 10 × ₹210', name: 'DUFFEL', q: 10, r: 210, perm: true },
  ];

  const handleApplyBundle = (bundle: { name: string; q: number; r: number; perm: boolean }) => {
    setDetails(bundle.name);
    setQty(bundle.q);
    setRate(bundle.r);
    setIsPermanent(bundle.perm);
    setDisplay(`${bundle.q * bundle.r}`);
  };

  const handleDigit = (digit: string) => {
    setDisplay(prev => (prev === '0' || prev === 'Error' ? digit : prev + digit));
  };

  const handleClear = () => {
    setDisplay('0');
  };

  const handleEvaluate = () => {
    try {
      // Safe arithmetic evaluator for standard wholesale expressions like "12*120"
      const cleaned = display.replace(/[^0-9+\-*/.]/g, '');
      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${cleaned})`)();
      if (typeof result === 'number' && !isNaN(result)) {
        setDisplay(String(result));
        setRate(result);
      } else {
        setDisplay('Error');
      }
    } catch {
      setDisplay('Error');
    }
  };

  const handleCommit = () => {
    const itemName = (details.trim() || 'BAG ITEM').toUpperCase();
    const finalQty = Math.max(1, qty);
    const finalRate = Math.max(0, rate);

    onAddLineItem({
      details: itemName,
      quantity: finalQty,
      ratePaise: rupeesToPaise(finalRate),
      isPermanentProduct: isPermanent
    });

    onClose();
  };

  const lineTotalRupees = qty * rate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#181820] border border-[#2F2F40] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-[#20202C] px-4 py-3 border-b border-[#2C2C3E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-white text-sm">
              Quick Wholesale Calculator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A3C]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preset Fast Test Shortcuts */}
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Fast Shortcuts & Spec Presets
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickTestBundles.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyBundle(b)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#242434] hover:bg-[#2D2D42] border border-[#34344A] text-xs font-mono text-orange-300 hover:text-white transition-all"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calculator Input Form */}
          <div className="bg-[#121217] p-3 rounded-xl border border-[#2A2A3A] space-y-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">
                Item Description (Free-text or Bag Model)
              </label>
              <input
                type="text"
                placeholder="e.g. HYPORA, CLUB, SCHOOLBOY"
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="w-full bg-[#1C1C26] border border-[#303044] rounded-lg px-3 py-2 text-white font-semibold text-xs uppercase focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Quantity (Pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={e => {
                    const q = parseInt(e.target.value) || 0;
                    setQty(q);
                    setDisplay(String(q * rate));
                  }}
                  className="w-full bg-[#1C1C26] border border-[#303044] rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Rate Per Pc (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={rate}
                  onChange={e => {
                    const r = parseFloat(e.target.value) || 0;
                    setRate(r);
                    setDisplay(String(qty * r));
                  }}
                  className="w-full bg-[#1C1C26] border border-[#303044] rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={isPermanent}
                  onChange={e => setIsPermanent(e.target.checked)}
                  className="rounded border-[#3F3F5A] bg-[#1C1C26] text-orange-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Save as Permanent Catalog Product</span>
              </label>

              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">Line Item Total</span>
                <span className="text-sm font-mono font-bold text-orange-400">
                  {formatINR(rupeesToPaise(lineTotalRupees))}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Digit Pad */}
          <div className="bg-[#121217] p-2 rounded-xl border border-[#2A2A3A]">
            <div className="bg-[#0D0D11] border border-[#252535] rounded-lg px-3 py-1.5 text-right font-mono font-bold text-base text-orange-300 mb-2 overflow-x-auto">
              {display}
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              {['7', '8', '9', '/'].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (k === '/' ? handleDigit(' / ') : handleDigit(k))}
                  className="py-2.5 rounded-lg bg-[#1F1F2C] hover:bg-[#28283C] text-white font-bold"
                >
                  {k}
                </button>
              ))}
              {['4', '5', '6', '*'].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (k === '*' ? handleDigit(' * ') : handleDigit(k))}
                  className="py-2.5 rounded-lg bg-[#1F1F2C] hover:bg-[#28283C] text-white font-bold"
                >
                  {k === '*' ? '×' : k}
                </button>
              ))}
              {['1', '2', '3', '-'].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (k === '-' ? handleDigit(' - ') : handleDigit(k))}
                  className="py-2.5 rounded-lg bg-[#1F1F2C] hover:bg-[#28283C] text-white font-bold"
                >
                  {k}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 font-bold"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="py-2.5 rounded-lg bg-[#1F1F2C] hover:bg-[#28283C] text-white font-bold"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleEvaluate}
                className="py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-black font-bold"
              >
                =
              </button>
              <button
                type="button"
                onClick={() => handleDigit(' + ')}
                className="py-2.5 rounded-lg bg-[#1F1F2C] hover:bg-[#28283C] text-white font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleCommit}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Line Item ({qty} pcs × ₹{rate} = ₹{lineTotalRupees})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
