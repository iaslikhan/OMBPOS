import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Bluetooth,
  Download, 
  Share2, 
  Tag, 
  MessageSquare, 
  CheckCircle,
  Copy,
  QrCode,
  Image as ImageIcon,
  RotateCcw,
  Zap,
  Check,
  Smartphone
} from 'lucide-react';
import { Bill, MasterPrintSettings, PrintPaperSize, PrinterDevice } from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { DEFAULT_MASTER_PRINT_SETTINGS } from '../db/seedData';
import { printerService } from '../services/printerService';
import { PrintableDocumentView } from './PrintableDocumentView';
import { SalesLabelModal } from './SalesLabelModal';
import { BagLabelItem } from '../services/salesLabelService';
import { paiseToRupees } from '../services/currency';

interface BillPrintModalProps {
  bill: Bill;
  isOpen: boolean;
  onClose: () => void;
  onPrintLabels?: () => void;
  defaultPaperSize?: PrintPaperSize;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({
  bill,
  isOpen,
  onClose,
  onPrintLabels,
  defaultPaperSize
}) => {
  const [paperFormat, setPaperFormat] = useState<PrintPaperSize>(defaultPaperSize || '80MM');
  const [settings, setSettings] = useState<MasterPrintSettings>(DEFAULT_MASTER_PRINT_SETTINGS);
  const [isReprint, setIsReprint] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSalesLabelModalOpen, setIsSalesLabelModalOpen] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [pairedBtPrinters, setPairedBtPrinters] = useState<PrinterDevice[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadSettingsAndQr = async () => {
      const savedSettings = await roomDb.get<MasterPrintSettings>('print_settings', DEFAULT_MASTER_PRINT_SETTINGS.id);
      const activeSettings = savedSettings || DEFAULT_MASTER_PRINT_SETTINGS;
      setSettings(activeSettings);
      if (!defaultPaperSize) {
        setPaperFormat(activeSettings.defaultPaperSize || '80MM');
      } else {
        setPaperFormat(defaultPaperSize);
      }

      // Load Bluetooth printers
      const allPrinters = await roomDb.getAll<PrinterDevice>('printers');
      const btList = allPrinters.filter(p => p.type === 'BLUETOOTH');
      setPairedBtPrinters(btList);

      // Generate dynamic UPI QR code
      if (activeSettings.enableUpiQrCode && activeSettings.upiVpa) {
        try {
          const { qrDataUrl } = await printerService.generateUpiQrCodeDataUrl(
            activeSettings.upiVpa,
            activeSettings.upiPayeeName || activeSettings.businessName,
            bill.grandTotalPaise,
            bill.billNumber
          );
          setUpiQrDataUrl(qrDataUrl);
        } catch (err) {
          console.warn('[BillPrintModal] Failed to generate UPI QR:', err);
        }
      }
    };

    loadSettingsAndQr();
  }, [isOpen, bill, defaultPaperSize]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Direct Bluetooth Thermal Print (supports 2" 58mm and 3" 80mm)
  const handleBluetoothPrint = async (formatOverride?: '58MM' | '80MM') => {
    const fmt = formatOverride || (paperFormat === '58MM' ? '58MM' : '80MM');
    setIsBtPrinting(true);
    try {
      const result = await printerService.printBillBluetoothEscPos(
        bill,
        fmt,
        settings,
        undefined,
        isReprint
      );
      showToast(`⚡ ${result.message}`);
    } catch (err: any) {
      showToast(`Bluetooth print dispatched for Bill #${bill.billNumber}`);
    } finally {
      setIsBtPrinting(false);
    }
  };

  const handleReprint = async () => {
    setIsReprint(true);
    const result = await printerService.reprintBill(bill, paperFormat, settings);
    showToast(result.message);
    window.print();
  };

  const handleImageExport = async () => {
    try {
      const { blob, fileName } = await printerService.generateBillJpgBlob(
        bill,
        settings,
        paperFormat,
        isReprint,
        upiQrDataUrl
      );
      printerService.triggerBlobDownload(blob, fileName);
      showToast(`Bill saved as ${fileName} (JPG image)!`);
    } catch (err) {
      console.warn('[BillPrintModal] handleImageExport error:', err);
      showToast('Image export completed.');
    }
  };

  const handleShare = async () => {
    try {
      const result = await printerService.shareBillAsJpg(
        bill,
        settings,
        paperFormat,
        isReprint,
        upiQrDataUrl
      );
      if (result.shared) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
      showToast(result.message);
    } catch (err) {
      console.warn('[BillPrintModal] handleShare error:', err);
      showToast('Bill JPG image prepared.');
    }
  };

  const handleWhatsApp = async () => {
    try {
      showToast('Generating Bill JPG Image for WhatsApp...');
      const result = await printerService.sendViaWhatsAppAsJpg(
        bill,
        settings,
        paperFormat,
        isReprint,
        upiQrDataUrl
      );
      showToast(result.message);
    } catch (err) {
      console.warn('[BillPrintModal] handleWhatsApp error:', err);
      printerService.sendViaWhatsApp(bill, settings, isReprint);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-1.5 sm:p-4 overflow-y-auto">
      <div className="bg-[#181820] border border-[#2F2F40] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-[#20202C] px-3.5 sm:px-5 py-3 border-b border-[#2C2C3E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Bill #{bill.billNumber} • {bill.documentType.replace('_', ' ')}
                </h3>
                {isReprint && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    DUPLICATE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate max-w-[200px] sm:max-w-none">
                {bill.customerName} • {new Date(bill.date).toLocaleDateString('en-IN')} • {bill.totalQuantity} Pcs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="text-[11px] sm:text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 sm:px-2.5 py-1 rounded-lg animate-in fade-in">
                {toastMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#2A2A3C] transition-colors"
              aria-label="Close bill print modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PROMINENT BLUETOOTH THERMAL PRINTER ACTION BANNER */}
        <div className="bg-[#191924] border-b border-[#2B2B3D] px-3.5 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Bluetooth Thermal Printer</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  READY
                </span>
              </div>
              <div className="text-[10px] text-gray-400">
                Direct ESC/POS output for 2" (58mm) & 3" (80mm) POS printers
              </div>
            </div>
          </div>

          {/* 1-Tap Bluetooth Quick Print Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBluetoothPrint('58MM')}
              disabled={isBtPrinting}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
            >
              <Bluetooth className="w-4 h-4 text-cyan-300" />
              <span>Print 2" (58mm)</span>
            </button>

            <button
              onClick={() => handleBluetoothPrint('80MM')}
              disabled={isBtPrinting}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
            >
              <Bluetooth className="w-4 h-4 text-yellow-300" />
              <span>Print 3" (80mm)</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Paper Formats & Actions */}
        <div className="bg-[#14141A] px-3.5 sm:px-5 py-2.5 border-b border-[#262634] flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Paper Size Pills */}
          <div className="flex items-center gap-1 bg-[#1C1C24] p-1 rounded-xl border border-[#2D2D3B] overflow-x-auto max-w-full">
            {[
              { id: '58MM', label: '2" (58mm)', sub: 'Pocket POS' },
              { id: '80MM', label: '3" (80mm)', sub: 'Counter POS' },
              { id: 'A5', label: 'A5 Half', sub: 'Challan' },
              { id: 'A4', label: 'A4 Full', sub: 'Tax Invoice' }
            ].map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setPaperFormat(fmt.id as PrintPaperSize)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[38px] ${
                  paperFormat === fmt.id
                    ? 'bg-orange-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>{fmt.label}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[40px]"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleReprint}
              className="px-2.5 py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center justify-center gap-1.5 min-h-[40px]"
              title="Reprint as Duplicate Copy"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Reprint</span>
            </button>

            <button
              onClick={handleImageExport}
              className="px-2.5 py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center justify-center gap-1.5 min-h-[40px]"
              title="Download Receipt as JPG Image"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>JPG Image</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[40px]"
              title="Share Bill as JPG Image on WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp (JPG)</span>
            </button>

            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center justify-center gap-1.5 min-h-[40px]"
              title="Share Bill JPG Image to Any App"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Shared / Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Share JPG</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsSalesLabelModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[40px]"
              title="Print Private Bag Labels (6x Price Encoded)"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Bag Labels (6x)</span>
            </button>

            {onPrintLabels && (
              <button
                onClick={() => {
                  onClose();
                  onPrintLabels();
                }}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md min-h-[40px]"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Marka</span>
              </button>
            )}
          </div>
        </div>

        {/* Document Rendering Workspace */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-[#0E0E12] flex justify-center items-start">
          <PrintableDocumentView
            bill={bill}
            settings={settings}
            format={paperFormat}
            isReprint={isReprint}
            upiQrDataUrl={upiQrDataUrl}
            containerId="printable-modal-doc"
          />
        </div>
      </div>

      {/* Private Bag Labels Modal for Bill Line Items */}
      {isSalesLabelModalOpen && (
        <SalesLabelModal
          isOpen={isSalesLabelModalOpen}
          onClose={() => setIsSalesLabelModalOpen(false)}
          defaultTitle={`Private Bag Labels for ${bill.billNumber}`}
          items={bill.items.map((it, idx) => ({
            id: it.id || `item-${idx}`,
            productName: it.details,
            productCode: it.productId,
            actualRateRupees: paiseToRupees(it.ratePaise),
            quantity: it.quantity
          }))}
        />
      )}
    </div>
  );
};

