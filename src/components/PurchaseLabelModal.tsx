import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Tag, 
  Layers, 
  FileText, 
  Download, 
  RotateCcw, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Sliders, 
  ShieldCheck,
  Package,
  Info
} from 'lucide-react';
import { PurchaseLabelSettings } from '../types';
import { DEFAULT_PURCHASE_LABEL_SETTINGS } from '../db/seedData';
import { 
  purchaseLabelService, 
  PurchaseLabelItem, 
  GeneratedPurchaseLabel, 
  PurchaseLabelMode 
} from '../services/purchaseLabelService';
import { PurchaseLabelCard } from './PurchaseLabelCard';
import { printerService } from '../services/printerService';

interface PurchaseLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PurchaseLabelItem[];
  defaultTitle?: string;
  isReprint?: boolean;
}

export const PurchaseLabelModal: React.FC<PurchaseLabelModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultTitle = 'Purchase & Inward Goods Labels',
  isReprint = false
}) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [settings, setSettings] = useState<PurchaseLabelSettings>(DEFAULT_PURCHASE_LABEL_SETTINGS);
  const [mode, setMode] = useState<PurchaseLabelMode>('ONE_PER_PIECE');
  const [bundleSize, setBundleSize] = useState<number>(25);
  const [manualCount, setManualCount] = useState<number>(10);
  const [prefix, setPrefix] = useState<string>('786');
  
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(1);
  const [useRange, setUseRange] = useState<boolean>(false);

  const [generatedLabels, setGeneratedLabels] = useState<GeneratedPurchaseLabel[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentItem = items[selectedItemIndex] || items[0] || {
    productName: 'HYPORA',
    purchaseRateRupees: 150,
    quantity: 300
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Re-generate labels whenever item, mode, bundleSize, manualCount, prefix, or range changes
  useEffect(() => {
    const updateLabels = async () => {
      const activeSettings: PurchaseLabelSettings = {
        ...settings,
        prefix
      };

      const calculatedTotal = purchaseLabelService.calculateLabelCount(
        currentItem.quantity,
        mode,
        bundleSize,
        manualCount
      );

      const to = useRange ? Math.min(rangeTo, calculatedTotal) : calculatedTotal;
      const from = useRange ? Math.min(rangeFrom, to) : 1;

      const labels = await purchaseLabelService.generateLabelsForProduct(
        currentItem,
        activeSettings,
        mode,
        bundleSize,
        manualCount,
        from,
        to,
        isReprint
      );

      setGeneratedLabels(labels);
      setPreviewIndex(0);
      if (!useRange) {
        setRangeTo(calculatedTotal);
      }
    };

    updateLabels();
  }, [selectedItemIndex, currentItem, mode, bundleSize, manualCount, prefix, rangeFrom, rangeTo, useRange, isReprint, settings]);

  if (!isOpen) return null;

  const totalCalculated = purchaseLabelService.calculateLabelCount(
    currentItem.quantity,
    mode,
    bundleSize,
    manualCount
  );

  const encodedCode = purchaseLabelService.encodePurchaseCode(currentItem.purchaseRateRupees, prefix);

  // Direct Browser / PDF Print for sticker sheets
  const handlePrintSheet = () => {
    window.print();
  };

  // Thermal direct print via Bluetooth / USB / LAN ESC/POS
  const handleDirectThermalPrint = async () => {
    if (generatedLabels.length === 0) return;
    setIsPrinting(true);

    try {
      const activePrinter = await printerService.getActivePrinter();
      if (!activePrinter) {
        showToast('No thermal printer paired. Printing via system dialog...');
        window.print();
        setIsPrinting(false);
        return;
      }

      for (const label of generatedLabels) {
        const payload = purchaseLabelService.generateThermalEscPosCommands(label);
        await printerService.printRawEscPosBytes(payload);
      }
      showToast(`Sent ${generatedLabels.length} thermal label(s) to ${activePrinter.name}!`);
    } catch (err: any) {
      console.warn('[PurchaseLabelModal] Thermal print fallback:', err);
      showToast('Thermal print failed. Triggering browser print...');
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="bg-[#181822] border border-[#2F2F42] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#20202E] px-5 py-3.5 border-b border-[#2D2D40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {defaultTitle}
                </h3>
                {isReprint && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                    REPRINT
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                ORIGINAL MODI BAGS • Inward Stock Tag Generation (Prefix + Rate Encoding)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#272738] text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guarantee Banner */}
        <div className="bg-sky-950/40 border-b border-sky-900/40 px-5 py-2 flex items-center gap-2 text-xs text-sky-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <b>Zero-Financial Activity:</b> Printing purchase labels does <b>NOT</b> alter inventory, modify supplier balances, or create financial ledger records.
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Product Selection & Configuration */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Multiple Items Selector (if more than 1 item) */}
            {items.length > 1 && (
              <div className="bg-[#1D1D28] border border-[#2D2D3E] p-3 rounded-xl space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Select Invoiced Item</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {items.map((it, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedItemIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedItemIndex === idx
                          ? 'bg-sky-600 text-white font-bold shadow-md'
                          : 'bg-[#262638] text-gray-300 hover:bg-[#303046]'
                      }`}
                    >
                      {it.productName} ({it.quantity} pcs @ ₹{Math.round(it.purchaseRateRupees)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product & Rate Summary Card */}
            <div className="bg-[#1E1E2A] border border-[#2E2E40] rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Product Name</span>
                  <div className="text-base font-black text-white">{currentItem.productName}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Inward Qty</span>
                  <div className="text-sm font-bold text-sky-400">{currentItem.quantity} PCS</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2B2B3C]">
                <div className="bg-[#161620] p-2 rounded-lg border border-[#262636]">
                  <span className="text-[10px] text-gray-400 block">Purchase Rate</span>
                  <span className="text-xs font-bold text-emerald-400">₹{Math.round(currentItem.purchaseRateRupees)}</span>
                </div>
                <div className="bg-[#161620] p-2 rounded-lg border border-[#262636]">
                  <span className="text-[10px] text-gray-400 block">Prefix</span>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-sky-400 focus:outline-none"
                    placeholder="786"
                  />
                </div>
                <div className="bg-[#161620] p-2 rounded-lg border border-[#262636]">
                  <span className="text-[10px] text-gray-400 block">Generated Code</span>
                  <span className="text-xs font-mono font-black text-amber-400 tracking-wider">
                    {encodedCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity Mode Selection */}
            <div className="bg-[#1E1E2A] border border-[#2E2E40] rounded-xl p-3.5 space-y-3">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Label Quantity Calculation Rule</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('ONE_PER_PIECE')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    mode === 'ONE_PER_PIECE'
                      ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg'
                      : 'bg-[#181822] border-[#2A2A3A] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="text-xs font-bold block">1 Piece = 1 Label</span>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Default 1:1 ({currentItem.quantity} labels)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('ONE_PER_BUNDLE')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    mode === 'ONE_PER_BUNDLE'
                      ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg'
                      : 'bg-[#181822] border-[#2A2A3A] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="text-xs font-bold block">Carton / Bundle</span>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    1 tag per {bundleSize} pcs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('MANUAL')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    mode === 'MANUAL'
                      ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg'
                      : 'bg-[#181822] border-[#2A2A3A] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="text-xs font-bold block">Manual Count</span>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Custom stickers
                  </span>
                </button>
              </div>

              {/* Mode Specific Inputs */}
              {mode === 'ONE_PER_BUNDLE' && (
                <div className="flex items-center gap-3 bg-[#15151F] p-2.5 rounded-lg border border-[#2B2B3C]">
                  <span className="text-xs text-gray-300">Pieces per Carton/Bundle:</span>
                  <input
                    type="number"
                    min="1"
                    value={bundleSize}
                    onChange={(e) => setBundleSize(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-[#222232] border border-[#353548] text-white px-2 py-1 rounded text-xs font-bold text-center"
                  />
                  <span className="text-[11px] text-sky-400 font-semibold">
                    = {Math.ceil(currentItem.quantity / bundleSize)} Labels
                  </span>
                </div>
              )}

              {mode === 'MANUAL' && (
                <div className="flex items-center gap-3 bg-[#15151F] p-2.5 rounded-lg border border-[#2B2B3C]">
                  <span className="text-xs text-gray-300">Exact Label Count to Print:</span>
                  <input
                    type="number"
                    min="1"
                    value={manualCount}
                    onChange={(e) => setManualCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-[#222232] border border-[#353548] text-white px-2 py-1 rounded text-xs font-bold text-center"
                  />
                  <span className="text-[11px] text-sky-400 font-semibold">
                    = {manualCount} Labels
                  </span>
                </div>
              )}
            </div>

            {/* Print Range Filter */}
            <div className="bg-[#1E1E2A] border border-[#2E2E40] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Print Range Filter</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUseRange(!useRange)}
                  className={`text-xs px-2 py-0.5 rounded font-semibold transition-all ${
                    useRange ? 'bg-sky-600 text-white' : 'bg-[#28283C] text-gray-400'
                  }`}
                >
                  {useRange ? 'Range Enabled' : 'Print All'}
                </button>
              </div>

              {useRange && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">From Label #</label>
                    <input
                      type="number"
                      min="1"
                      max={totalCalculated}
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[#15151F] border border-[#2D2D3E] text-white px-2.5 py-1.5 rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">To Label #</label>
                    <input
                      type="number"
                      min={rangeFrom}
                      max={totalCalculated}
                      value={rangeTo}
                      onChange={(e) => setRangeTo(Math.max(rangeFrom, Math.min(totalCalculated, parseInt(e.target.value) || totalCalculated)))}
                      className="w-full bg-[#15151F] border border-[#2D2D3E] text-white px-2.5 py-1.5 rounded text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Sticker Live Preview */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="bg-[#12121A] border border-[#262638] rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] relative">
              
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400">Live Preview</span>
                <span className="text-[10px] bg-[#222232] text-sky-400 px-2 py-0.5 rounded font-mono font-bold">
                  {generatedLabels.length > 0 ? `${previewIndex + 1} of ${generatedLabels.length}` : '0 of 0'}
                </span>
              </div>

              {/* Render Selected Label Card */}
              {generatedLabels.length > 0 && generatedLabels[previewIndex] ? (
                <div className="my-4 transition-all duration-200 hover:scale-[1.02]">
                  <PurchaseLabelCard label={generatedLabels[previewIndex]} />
                </div>
              ) : (
                <div className="text-xs text-gray-500 py-10">No labels generated yet.</div>
              )}

              {/* Carousel Controls */}
              {generatedLabels.length > 1 && (
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                    disabled={previewIndex === 0}
                    className="p-1.5 rounded-lg bg-[#222232] text-gray-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-gray-300">
                    Tag #{generatedLabels[previewIndex]?.labelIndex} / {generatedLabels[previewIndex]?.totalLabelsInBatch}
                  </span>
                  <button
                    onClick={() => setPreviewIndex((prev) => Math.min(generatedLabels.length - 1, prev + 1))}
                    disabled={previewIndex === generatedLabels.length - 1}
                    className="p-1.5 rounded-lg bg-[#222232] text-gray-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Total Badges & Quick Stats */}
            <div className="bg-[#1C1C28] p-3 rounded-xl border border-[#2D2D3E] flex items-center justify-between text-xs">
              <span className="text-gray-400">Total Labels in this Print Batch:</span>
              <span className="font-mono font-black text-sky-400 text-sm">
                {generatedLabels.length} {generatedLabels.length === 1 ? 'Label' : 'Labels'}
              </span>
            </div>

            {/* Actions Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={handlePrintSheet}
                className="px-3 py-2.5 rounded-xl bg-[#28283A] hover:bg-[#34344C] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>PDF / Sheet</span>
              </button>

              <button
                onClick={handleDirectThermalPrint}
                disabled={isPrinting || generatedLabels.length === 0}
                className="px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all col-span-1 sm:col-span-2"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Printing...' : `Print ${generatedLabels.length} Labels`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Printable Sheet Container for Window.print() */}
        <div id="purchase-labels-print-area" className="hidden print:block print:w-full print:p-2">
          <div className="grid grid-cols-3 gap-3">
            {generatedLabels.map((lbl, idx) => (
              <div key={idx} className="break-inside-avoid">
                <PurchaseLabelCard label={lbl} />
              </div>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-sky-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 border border-sky-400 animate-bounce">
            <CheckCircle className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
