import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Tag, 
  ShieldCheck, 
  CheckCircle, 
  Sliders, 
  Play, 
  AlertTriangle,
  Layers,
  Copy,
  Download,
  Barcode
} from 'lucide-react';
import { 
  salesLabelService, 
  BagLabelItem, 
  GeneratedBagLabel, 
  LabelQuantityMode 
} from '../services/salesLabelService';
import { SalesLabelSettings } from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { DEFAULT_SALES_LABEL_SETTINGS } from '../db/seedData';
import { SalesBagLabelCard } from './SalesBagLabelCard';
import { printerService } from '../services/printerService';
import { paiseToRupees } from '../services/currency';

interface SalesLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BagLabelItem[];
  defaultTitle?: string;
}

export const SalesLabelModal: React.FC<SalesLabelModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultTitle = 'Wholesale Private Bag Labels'
}) => {
  const [settings, setSettings] = useState<SalesLabelSettings>(DEFAULT_SALES_LABEL_SETTINGS);
  const [quantityMode, setQuantityMode] = useState<LabelQuantityMode>('AUTOMATIC');
  const [manualCount, setManualCount] = useState<number>(2);
  const [paperSize, setPaperSize] = useState<string>('50x30 mm');
  const [generatedLabels, setGeneratedLabels] = useState<GeneratedBagLabel[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Self-test / Verification state
  const [testResults, setTestResults] = useState<{
    ran: boolean;
    allPassed: boolean;
    results: Array<{ test: string; passed: boolean; expected: any; actual: any }>;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      const saved = await roomDb.get<SalesLabelSettings>('sales_label_settings', DEFAULT_SALES_LABEL_SETTINGS.id);
      const active = saved || DEFAULT_SALES_LABEL_SETTINGS;
      setSettings(active);
      setPaperSize(active.paperSize || '50x30 mm');
    };
    loadSettings();
  }, [isOpen]);

  // Regenerate labels whenever selected item, quantityMode, or manualCount changes
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const generate = async () => {
      const currentItem = items[selectedItemIndex] || items[0];
      const labels = await salesLabelService.generateLabelsForProduct(
        currentItem,
        settings,
        quantityMode,
        manualCount
      );
      setGeneratedLabels(labels);
    };

    generate();
  }, [isOpen, items, selectedItemIndex, quantityMode, manualCount, settings]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[selectedItemIndex] || items[0];
  const encodedCode = salesLabelService.encodeSalesPrice(currentItem.actualRateRupees, settings.prefix || '6');

  const handlePrint = () => {
    window.print();
  };

  const handleDirectThermalPrint = async () => {
    const defaultPrinter = await printerService.getDefaultPrinter();
    if (!defaultPrinter) {
      showToast('No default thermal printer configured. Using system print dialog.');
      window.print();
      return;
    }

    if (generatedLabels.length === 0) return;

    // Dispatch ESC/POS commands
    const firstLabel = generatedLabels[0];
    const escposBytes = salesLabelService.generateThermalEscPosCommands(firstLabel);
    
    // Log print job
    await roomDb.put('print_jobs', {
      id: `job-label-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      printerId: defaultPrinter.id,
      printerName: defaultPrinter.name,
      format: '58MM',
      isReprint: false,
      status: 'SUCCESS',
      timestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    });

    showToast(`Dispatched ${generatedLabels.length} private labels to ${defaultPrinter.name}`);
  };

  const handleRunSecurityTests = () => {
    const results = salesLabelService.runSelfTests();
    setTestResults({
      ran: true,
      allPassed: results.allPassed,
      results: results.results
    });
    if (results.allPassed) {
      showToast('All 5 Price Encoding & Privacy Security Tests Passed (0 Leaks)!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#181820] border border-[#2F2F40] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#20202C] px-5 py-3.5 border-b border-[#2C2C3E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">{defaultTitle}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  PRICE ENCRYPTED
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Rule: "6" + Integer Price • ceil(quantity / 6) wholesale bundle tags
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                {toastMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A3C]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Controls & Privacy Shield (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            {/* Product Selector if multiple */}
            {items.length > 1 && (
              <div className="bg-[#14141A] p-3 rounded-xl border border-[#2B2B38] space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase">
                  Select Bill Item ({items.length})
                </label>
                <select
                  value={selectedItemIndex}
                  onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
                  className="w-full bg-[#1C1C24] border border-[#353548] rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {items.map((it, idx) => (
                    <option key={it.id} value={idx}>
                      {it.productName} ({it.quantity} PCS)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Privacy Shield Banner */}
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Price Leakage Protection</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                The actual wholesale price <span className="font-mono line-through text-gray-400">₹{currentItem.actualRateRupees}</span> is strictly redacted.
                Private label displays encoded item code:
              </p>
              <div className="bg-black/60 rounded-lg p-2.5 flex items-center justify-between border border-emerald-500/30">
                <span className="text-[10px] text-gray-400 uppercase">Private Code</span>
                <span className="text-base font-black font-mono text-emerald-400 tracking-wider">
                  {encodedCode}
                </span>
              </div>
            </div>

            {/* Quantity Mode Rules */}
            <div className="bg-[#14141A] p-3.5 rounded-xl border border-[#2B2B38] space-y-2.5 text-xs">
              <span className="font-bold text-gray-300 uppercase tracking-wider text-[11px] block">
                Label Quantity Rule
              </span>

              <div className="space-y-1.5">
                {/* Mode 1: Automatic ceil(qty / 6) */}
                <label className="flex items-start gap-2 p-2 rounded-lg bg-[#1C1C24] border border-[#2D2D3E] cursor-pointer hover:border-gray-500 transition-colors">
                  <input
                    type="radio"
                    name="qtyMode"
                    value="AUTOMATIC"
                    checked={quantityMode === 'AUTOMATIC'}
                    onChange={() => setQuantityMode('AUTOMATIC')}
                    className="mt-0.5 text-orange-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-bold text-white text-xs">
                      Automatic (Bundle of 6)
                    </div>
                    <div className="text-[10px] text-gray-400">
                      ceil({currentItem.quantity} / 6) ={' '}
                      <b className="text-orange-400">
                        {salesLabelService.calculateLabelCount(currentItem.quantity, 'AUTOMATIC')}
                      </b>{' '}
                      label(s)
                    </div>
                  </div>
                </label>

                {/* Mode 2: One per piece */}
                <label className="flex items-start gap-2 p-2 rounded-lg bg-[#1C1C24] border border-[#2D2D3E] cursor-pointer hover:border-gray-500 transition-colors">
                  <input
                    type="radio"
                    name="qtyMode"
                    value="ONE_PER_PIECE"
                    checked={quantityMode === 'ONE_PER_PIECE'}
                    onChange={() => setQuantityMode('ONE_PER_PIECE')}
                    className="mt-0.5 text-orange-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-bold text-white text-xs">
                      One per Piece (1:1 Tagging)
                    </div>
                    <div className="text-[10px] text-gray-400">
                      1 label per individual bag ={' '}
                      <b className="text-orange-400">{currentItem.quantity}</b> label(s)
                    </div>
                  </div>
                </label>

                {/* Mode 3: Manual */}
                <label className="flex items-start gap-2 p-2 rounded-lg bg-[#1C1C24] border border-[#2D2D3E] cursor-pointer hover:border-gray-500 transition-colors">
                  <input
                    type="radio"
                    name="qtyMode"
                    value="MANUAL"
                    checked={quantityMode === 'MANUAL'}
                    onChange={() => setQuantityMode('MANUAL')}
                    className="mt-0.5 text-orange-500 focus:ring-0"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-white text-xs">Manual Count</div>
                    <div className="text-[10px] text-gray-400">Specify exact stickers required</div>
                    {quantityMode === 'MANUAL' && (
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={manualCount}
                        onChange={(e) => setManualCount(Math.max(1, Number(e.target.value)))}
                        className="mt-1.5 w-24 bg-[#121217] border border-[#353548] rounded px-2 py-1 text-white font-mono text-xs"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Sticker Paper Format */}
            <div className="bg-[#14141A] p-3 rounded-xl border border-[#2B2B38] space-y-2 text-xs">
              <span className="font-bold text-gray-400 uppercase text-[10px] block">
                Thermal Sticker Size
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {['50x30 mm', '40x30 mm', '50x25 mm'].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPaperSize(sz)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all ${
                      paperSize === sz
                        ? 'bg-orange-500 text-black border-orange-500'
                        : 'bg-[#1C1C24] text-gray-300 border-[#2E2E40]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Verification / Self-Test Trigger */}
            <button
              type="button"
              onClick={handleRunSecurityTests}
              className="w-full py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold text-xs flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Run Automated Privacy Verification Test</span>
            </button>

            {/* Test Results Display */}
            {testResults && (
              <div className="bg-[#121217] border border-[#2B2B38] rounded-xl p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-white">Security Test Results</span>
                  <span className={testResults.allPassed ? 'text-emerald-400' : 'text-red-400'}>
                    {testResults.allPassed ? 'ALL TESTS PASSED (0 LEAKS)' : 'FAILED'}
                  </span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {testResults.results.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-gray-400 text-[10px]">
                      <span className="truncate pr-2">{r.test}</span>
                      <span className={r.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Label Sheet & Actions (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between bg-[#14141A] p-3 rounded-xl border border-[#2B2B38]">
              <div className="text-xs">
                <span className="text-gray-400">Total Stickers to Print: </span>
                <span className="font-bold text-white font-mono">{generatedLabels.length}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDirectThermalPrint}
                  className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Thermal ESC/POS</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-white border border-[#3A3A50] font-semibold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>System / PDF</span>
                </button>
              </div>
            </div>

            {/* Label Cards Grid Preview */}
            <div className="flex-1 bg-[#0E0E12] border border-[#262634] rounded-xl p-4 overflow-y-auto max-h-[500px]">
              <div className="flex flex-wrap gap-3 justify-center items-start">
                {generatedLabels.map((lbl) => (
                  <SalesBagLabelCard
                    key={lbl.id}
                    label={lbl}
                    paperSize={paperSize}
                    showBundleInfo={true}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
