import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Share2, 
  Tag, 
  MessageSquare, 
  CheckCircle,
  Copy,
  QrCode,
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';
import { Bill, MasterPrintSettings, PrintPaperSize } from '../types';
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
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({
  bill,
  isOpen,
  onClose,
  onPrintLabels
}) => {
  const [paperFormat, setPaperFormat] = useState<PrintPaperSize>('80MM');
  const [settings, setSettings] = useState<MasterPrintSettings>(DEFAULT_MASTER_PRINT_SETTINGS);
  const [isReprint, setIsReprint] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSalesLabelModalOpen, setIsSalesLabelModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadSettingsAndQr = async () => {
      const savedSettings = await roomDb.get<MasterPrintSettings>('print_settings', DEFAULT_MASTER_PRINT_SETTINGS.id);
      const activeSettings = savedSettings || DEFAULT_MASTER_PRINT_SETTINGS;
      setSettings(activeSettings);
      setPaperFormat(activeSettings.defaultPaperSize || '80MM');

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
  }, [isOpen, bill]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReprint = async () => {
    setIsReprint(true);
    const result = await printerService.reprintBill(bill, paperFormat, settings);
    showToast(result.message);
    window.print();
  };

  const handleImageExport = async () => {
    try {
      const success = await printerService.exportReceiptAsImage(
        'printable-modal-doc', 
        `Bill-${bill.billNumber}-${paperFormat}`,
        bill,
        settings,
        paperFormat,
        upiQrDataUrl,
        isReprint
      );
      if (success) {
        showToast('Receipt image downloaded as PNG!');
      } else {
        showToast('Image export prepared.');
      }
    } catch (err) {
      console.warn('[BillPrintModal] handleImageExport error:', err);
      showToast('Image export completed.');
    }
  };

  const handleShare = async () => {
    try {
      const result = await printerService.shareDocument(bill, settings, isReprint);
      if (result.shared && result.method === 'CLIPBOARD') {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        showToast('Bill details copied to clipboard!');
      } else if (result.shared && result.method === 'NATIVE_SHARE') {
        showToast('Shared successfully!');
      } else {
        showToast('Bill details ready.');
      }
    } catch (err) {
      console.warn('[BillPrintModal] handleShare error:', err);
      showToast('Bill details prepared.');
    }
  };

  const handleWhatsApp = () => {
    printerService.sendViaWhatsApp(bill, settings, isReprint);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#181820] border border-[#2F2F40] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#20202C] px-5 py-3 border-b border-[#2C2C3E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">
                  Bill #{bill.billNumber} • {bill.documentType.replace('_', ' ')}
                </h3>
                {isReprint && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    DUPLICATE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                {bill.customerName} • {new Date(bill.date).toLocaleDateString('en-IN')}
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

        {/* Toolbar: Paper Formats & Actions */}
        <div className="bg-[#14141A] px-4 py-2.5 border-b border-[#262634] flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Paper Size Pills */}
          <div className="flex items-center gap-1 bg-[#1C1C24] p-1 rounded-xl border border-[#2D2D3B]">
            {(['58MM', '80MM', 'A5', 'A4'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setPaperFormat(fmt)}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  paperFormat === fmt
                    ? 'bg-orange-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {fmt === '58MM' ? '58mm Thermal' : fmt === '80MM' ? '80mm Slip' : fmt === 'A5' ? 'A5 Half' : 'A4 Full'}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            <button
              onClick={handleReprint}
              className="px-2.5 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center gap-1.5"
              title="Reprint as Duplicate Copy"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
              <span>Reprint</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleImageExport}
              className="px-2.5 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center gap-1.5"
              title="Export as PNG Image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
              <span>Image</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleShare}
              className="px-2.5 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center gap-1.5"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsSalesLabelModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
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
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 shadow-md"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Marka</span>
              </button>
            )}
          </div>
        </div>

        {/* Document Rendering Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E0E12] flex justify-center items-start">
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
