import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  FileText, 
  Settings as SettingsIcon, 
  Bluetooth,
  Usb,
  Wifi,
  RotateCcw,
  Download,
  Share2,
  MessageSquare,
  CheckCircle,
  Copy,
  Plus,
  RefreshCw,
  Power,
  Star,
  QrCode,
  Image as ImageIcon,
  AlertCircle,
  Search,
  Check,
  Zap,
  Sliders,
  Radio,
  FileCheck
} from 'lucide-react';
import { 
  Bill, 
  MasterPrintSettings, 
  PrinterDevice, 
  PrinterConnectionType, 
  PrintPaperSize 
} from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { DEFAULT_MASTER_PRINT_SETTINGS } from '../db/seedData';
import { printerService } from '../services/printerService';
import { PrintableDocumentView } from '../components/PrintableDocumentView';
import { formatINR, paiseToRupees } from '../services/currency';

interface PrintingScreenProps {
  onBack: () => void;
}

export const PrintingScreen: React.FC<PrintingScreenProps> = ({ onBack }) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'STUDIO' | 'HARDWARE' | 'SETTINGS'>('STUDIO');

  // Bills & Document State
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [paperFormat, setPaperFormat] = useState<PrintPaperSize>('80MM');
  const [copyLabel, setCopyLabel] = useState<string>('ORIGINAL FOR RECIPIENT');
  const [isReprint, setIsReprint] = useState<boolean>(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');

  // Hardware State
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<PrinterConnectionType>('BLUETOOTH');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<PrinterDevice[]>([]);
  const [hardwareActionLoading, setHardwareActionLoading] = useState<string | null>(null);

  // Manual LAN Printer Modal
  const [showAddLanModal, setShowAddLanModal] = useState(false);
  const [lanName, setLanName] = useState('');
  const [lanIp, setLanIp] = useState('192.168.1.');
  const [lanPort, setLanPort] = useState('9100');
  const [lanPaper, setLanPaper] = useState<PrintPaperSize>('80MM');

  // Master Settings State
  const [settings, setSettings] = useState<MasterPrintSettings>(DEFAULT_MASTER_PRINT_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Status & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Bills, Printers, and Settings
  const refreshAllData = async () => {
    const billList = await roomDb.getAll<Bill>('bills');
    const sortedBills = billList.sort((a, b) => b.date - a.date);
    setBills(sortedBills);
    if (!selectedBill && sortedBills.length > 0) {
      setSelectedBill(sortedBills[0]);
    }

    const savedSettings = await roomDb.get<MasterPrintSettings>('print_settings', DEFAULT_MASTER_PRINT_SETTINGS.id);
    const activeSettings = savedSettings || DEFAULT_MASTER_PRINT_SETTINGS;
    setSettings(activeSettings);
    if (!paperFormat) {
      setPaperFormat(activeSettings.defaultPaperSize || '80MM');
    }

    const printerList = await roomDb.getAll<PrinterDevice>('printers');
    setPrinters(printerList);
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Update dynamic UPI QR Code when selected bill or settings change
  useEffect(() => {
    const updateQr = async () => {
      if (!selectedBill) return;
      if (settings.enableUpiQrCode && settings.upiVpa) {
        try {
          const { qrDataUrl } = await printerService.generateUpiQrCodeDataUrl(
            settings.upiVpa,
            settings.upiPayeeName || settings.businessName,
            selectedBill.grandTotalPaise,
            selectedBill.billNumber
          );
          setUpiQrDataUrl(qrDataUrl);
        } catch (err) {
          console.warn('[PrintingScreen] UPI QR Generation error:', err);
        }
      } else {
        setUpiQrDataUrl('');
      }
    };
    updateQr();
  }, [selectedBill, settings]);

  // ----------------------------------------------------------------
  // Document Studio Handlers
  // ----------------------------------------------------------------
  const handlePrint = () => {
    window.print();
  };

  const handleReprint = async () => {
    if (!selectedBill) return;
    setIsReprint(true);
    setCopyLabel('DUPLICATE / REPRINT COPY');
    const result = await printerService.reprintBill(selectedBill, paperFormat, settings);
    showToast(result.message);
    window.print();
  };

  const handleImageExport = async () => {
    if (!selectedBill) return;
    try {
      const fileName = `WholesaleBill-${selectedBill.billNumber}-${paperFormat}`;
      const success = await printerService.exportReceiptAsImage(
        'studio-document-container', 
        fileName,
        selectedBill,
        settings,
        paperFormat,
        upiQrDataUrl,
        isReprint
      );
      if (success) {
        showToast('Document exported as high-res PNG image!');
      } else {
        showToast('Preparing image export...');
      }
    } catch (err) {
      console.warn('[PrintingScreen] handleImageExport error:', err);
      showToast('Image export prepared.');
    }
  };

  const handleShare = async () => {
    if (!selectedBill) return;
    try {
      const result = await printerService.shareDocument(selectedBill, settings, isReprint);
      if (result.shared && result.method === 'CLIPBOARD') {
        showToast('Bill invoice summary copied to clipboard!');
      } else if (result.shared && result.method === 'NATIVE_SHARE') {
        showToast('Shared successfully!');
      } else {
        showToast('Bill invoice summary prepared.');
      }
    } catch (err) {
      console.warn('[PrintingScreen] handleShare error:', err);
      showToast('Bill invoice summary prepared.');
    }
  };

  const handleWhatsApp = () => {
    if (!selectedBill) return;
    printerService.sendViaWhatsApp(selectedBill, settings, isReprint);
  };

  // ----------------------------------------------------------------
  // Hardware Management Handlers
  // ----------------------------------------------------------------
  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const results = await printerService.discoverPrinters(selectedInterface);
      setDiscoveredPrinters(results);
      if (results.length > 0) {
        showToast(`Discovered ${results.length} ${selectedInterface} device(s) nearby`);
      } else {
        showToast('No new devices discovered in this scan.');
      }
    } catch (err) {
      showToast('Discovery process completed.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handlePair = async (printer: PrinterDevice) => {
    setHardwareActionLoading(printer.id);
    try {
      await printerService.pairPrinter(printer);
      setDiscoveredPrinters((prev) => prev.filter((p) => p.id !== printer.id));
      await refreshAllData();
      showToast(`Paired with ${printer.name}`);
    } finally {
      setHardwareActionLoading(null);
    }
  };

  const handleConnect = async (printerId: string) => {
    setHardwareActionLoading(printerId);
    try {
      await printerService.connectPrinter(printerId);
      await refreshAllData();
      showToast('Printer connected and ready for ESC/POS jobs.');
    } finally {
      setHardwareActionLoading(null);
    }
  };

  const handleDisconnect = async (printerId: string) => {
    setHardwareActionLoading(printerId);
    try {
      await printerService.disconnectPrinter(printerId);
      await refreshAllData();
      showToast('Printer disconnected.');
    } finally {
      setHardwareActionLoading(null);
    }
  };

  const handleSetDefault = async (printerId: string) => {
    setHardwareActionLoading(printerId);
    try {
      await printerService.setDefaultPrinter(printerId);
      await refreshAllData();
      showToast('Default printer updated for one-click billing.');
    } finally {
      setHardwareActionLoading(null);
    }
  };

  const handleTestPrint = async (printerId: string) => {
    setHardwareActionLoading(printerId);
    try {
      const result = await printerService.testPrint(printerId, settings);
      showToast(result.message);
    } finally {
      setHardwareActionLoading(null);
    }
  };

  const handleAddLanPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lanName || !lanIp) return;

    const newPrinter: PrinterDevice = {
      id: `lan-custom-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      name: lanName,
      type: 'WIFI_LAN',
      status: 'DISCONNECTED',
      address: `${lanIp}:${lanPort}`,
      paperWidth: lanPaper,
      isDefault: false,
      model: `Raw TCP IP Printer (${lanPort})`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('printers', newPrinter);
    setShowAddLanModal(false);
    setLanName('');
    await refreshAllData();
    showToast(`Added network printer ${lanName}`);
  };

  // ----------------------------------------------------------------
  // Master Settings Handlers
  // ----------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      updatedAt: Date.now()
    };
    await roomDb.put('print_settings', updated);
    setSettings(updated);
    setSettingsSaved(true);
    showToast('Print & Invoice Master Settings saved to Room DB.');
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleResetSettings = async () => {
    setSettings(DEFAULT_MASTER_PRINT_SETTINGS);
    await roomDb.put('print_settings', DEFAULT_MASTER_PRINT_SETTINGS);
    showToast('Settings reset to Original Modi Bags defaults.');
  };

  // Filter bills for left panel
  const filteredBills = bills.filter((b) =>
    b.billNumber.toLowerCase().includes(billSearch.toLowerCase()) ||
    b.customerName.toLowerCase().includes(billSearch.toLowerCase())
  );

  const defaultPrinter = printers.find((p) => p.isDefault) || printers[0];

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Printing & Digital Documents Studio
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              58mm • 80mm • A5 • A4 • Bluetooth • USB/LAN • UPI QR • Digital Share
            </p>
          </div>
        </div>

        {/* Status Toast & Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {toastMessage && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          <div className="flex items-center bg-[#121217] p-1 rounded-xl border border-[#2D2D3B] text-xs">
            <button
              onClick={() => setActiveTab('STUDIO')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'STUDIO' ? 'bg-orange-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Document Studio</span>
            </button>
            <button
              onClick={() => setActiveTab('HARDWARE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'HARDWARE' ? 'bg-orange-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Hardware & Printers</span>
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'SETTINGS' ? 'bg-orange-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Master Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: DOCUMENT STUDIO & PRINT CENTER */}
      {/* ================================================================ */}
      {activeTab === 'STUDIO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Bill Selector & Controls (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            {/* Paper Size Selector Box */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Paper Format & Size
                </span>
                {defaultPrinter && (
                  <span className="text-[10px] text-orange-400 font-mono flex items-center gap-1">
                    <Star className="w-3 h-3 fill-orange-400" />
                    {defaultPrinter.name}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['58MM', '80MM', 'A5', 'A4'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      setPaperFormat(fmt);
                      setIsReprint(false);
                    }}
                    className={`py-2 px-1 text-center rounded-xl font-bold text-xs transition-all border ${
                      paperFormat === fmt
                        ? 'bg-orange-500 text-black border-orange-500 shadow-md scale-[1.02]'
                        : 'bg-[#121217] text-gray-300 border-[#2D2D3D] hover:border-gray-500'
                    }`}
                  >
                    <div>{fmt}</div>
                    <div className="text-[9px] opacity-80 font-normal">
                      {fmt === '58MM' ? 'Thermal' : fmt === '80MM' ? 'Slip' : fmt === 'A5' ? 'Half' : 'Tax Inv'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Copy Label Selector */}
              <div className="pt-1">
                <label className="text-[11px] text-gray-400 block mb-1">Invoice Copy Label</label>
                <select
                  value={copyLabel}
                  onChange={(e) => setCopyLabel(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ORIGINAL FOR RECIPIENT">Original for Recipient</option>
                  <option value="DUPLICATE FOR TRANSPORTER">Duplicate for Transporter</option>
                  <option value="TRIPLICATE FOR SUPPLIER">Triplicate for Supplier (Office Copy)</option>
                  <option value="DELIVERY CHALLAN">Delivery Challan</option>
                  <option value="ESTIMATE / KACHHA BILL">Wholesale Estimate Slip</option>
                </select>
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-[#262634] grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrint}
                  className="col-span-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document ({paperFormat})</span>
                </button>

                <button
                  onClick={handleReprint}
                  className="py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold text-xs flex items-center justify-center gap-1.5"
                  title="Reprint as Duplicate Copy"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                  <span>Reprint</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>PDF Print</span>
                </button>

                <button
                  onClick={handleImageExport}
                  className="py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                  <span>Save Image</span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={handleShare}
                  className="col-span-2 py-2 rounded-xl bg-[#20202C] hover:bg-[#282838] text-gray-200 border border-[#3A3A50] font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>System Share / Copy Text</span>
                </button>
              </div>
            </div>

            {/* Bill List Box */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Select Bill ({filteredBills.length})
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bill no or customer..."
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredBills.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBill(b);
                      setIsReprint(false);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedBill?.id === b.id
                        ? 'bg-orange-500/15 border-orange-500/60 shadow-sm'
                        : 'bg-[#141419] border-[#242430] hover:border-[#383848]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-orange-400 text-xs">{b.billNumber}</span>
                      <span className="text-[10px] text-gray-400">{new Date(b.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="text-xs font-bold text-white mt-0.5 truncate">{b.customerName}</div>
                    <div className="text-[11px] text-gray-400 flex justify-between mt-1">
                      <span>{b.totalQuantity} PCS</span>
                      <span className="font-mono text-white font-bold">{formatINR(b.grandTotalPaise)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Document Preview (8 Cols) */}
          <div className="lg:col-span-8 bg-[#0E0E12] border border-[#282835] rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-start overflow-x-auto min-h-[600px]">
            {selectedBill ? (
              <div className="w-full flex flex-col items-center">
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#22222E] text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#1C1C24] font-mono text-orange-400 font-bold">
                      {paperFormat}
                    </span>
                    <span>Previewing Bill #{selectedBill.billNumber}</span>
                  </div>
                  {settings.enableUpiQrCode && (
                    <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-semibold">
                      <QrCode className="w-3.5 h-3.5" />
                      Dynamic UPI QR Active
                    </span>
                  )}
                </div>

                <div className="w-full overflow-x-auto flex justify-center py-2">
                  <PrintableDocumentView
                    bill={selectedBill}
                    settings={settings}
                    format={paperFormat}
                    isReprint={isReprint}
                    copyLabel={copyLabel}
                    upiQrDataUrl={upiQrDataUrl}
                    containerId="studio-document-container"
                  />
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-500 text-sm">
                No bill selected. Choose a bill from the left list.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: HARDWARE & PRINTER MANAGER */}
      {/* ================================================================ */}
      {activeTab === 'HARDWARE' && (
        <div className="space-y-4">
          {/* Hardware Header Card */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-white text-base">Thermal & Network Printer Management</h3>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Configure ESC/POS Bluetooth, USB Thermal, and Raw TCP IP (Port 9100) devices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscover}
                disabled={isDiscovering}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
                <span>{isDiscovering ? 'Scanning Hardware...' : `Discover ${selectedInterface} Devices`}</span>
              </button>

              {selectedInterface === 'WIFI_LAN' && (
                <button
                  onClick={() => setShowAddLanModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-white border border-[#3A3A50] font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-orange-400" />
                  <span>Add IP Printer</span>
                </button>
              )}
            </div>
          </div>

          {/* Interface Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-[#2C2C3C] pb-2 text-xs font-semibold">
            {[
              { type: 'BLUETOOTH', label: 'Bluetooth Thermal', icon: Bluetooth },
              { type: 'USB', label: 'USB Direct POS', icon: Usb },
              { type: 'WIFI_LAN', label: 'Wi-Fi / LAN Network (9100)', icon: Wifi },
              { type: 'SYSTEM', label: 'System Spooler / PDF', icon: Printer }
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedInterface(type as PrinterConnectionType);
                  setDiscoveredPrinters([]);
                }}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  selectedInterface === type
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40'
                    : 'text-gray-400 hover:text-white bg-[#141419]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Discovered Printers (Unpaired) */}
          {discoveredPrinters.length > 0 && (
            <div className="bg-[#1C1C24] border border-orange-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-orange-400 animate-pulse" />
                  Discovered Devices Nearby ({discoveredPrinters.length})
                </span>
                <span className="text-[11px] text-gray-400">Click Pair to add to persistent Room DB</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {discoveredPrinters.map((p) => (
                  <div key={p.id} className="bg-[#121217] border border-[#2D2D3D] rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{p.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{p.address || p.model}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
                        {p.paperWidth}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePair(p)}
                      disabled={hardwareActionLoading === p.id}
                      className="w-full py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{hardwareActionLoading === p.id ? 'Pairing...' : 'Pair Printer'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paired Printers Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Configured & Paired {selectedInterface} Devices
            </h4>

            {printers.filter((p) => p.type === selectedInterface).length === 0 ? (
              <div className="bg-[#15151C] border border-[#262634] rounded-2xl p-10 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
                <div className="text-white text-xs font-bold">No {selectedInterface} Printers Configured</div>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  Click the Discover button above to scan and pair your Bluetooth, USB, or Wi-Fi thermal printer.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {printers
                  .filter((p) => p.type === selectedInterface)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`bg-[#171720] border rounded-2xl p-4 space-y-3 transition-all ${
                        p.isDefault ? 'border-orange-500/60 shadow-lg' : 'border-[#2D2D3D]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{p.name}</span>
                            {p.isDefault && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-black flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-black" />
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            Address / MAC: {p.address || 'Hardware Direct'}
                          </div>
                          {p.model && (
                            <div className="text-[11px] text-gray-500">Model: {p.model}</div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'CONNECTED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {p.status}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Paper: <b>{p.paperWidth}</b>
                          </span>
                          {p.batteryLevel !== undefined && (
                            <span className="text-[10px] text-gray-400">
                              Battery: <b>{p.batteryLevel}%</b>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Device Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#262634] text-xs">
                        {p.status === 'CONNECTED' ? (
                          <button
                            onClick={() => handleDisconnect(p.id)}
                            disabled={hardwareActionLoading === p.id}
                            className="py-1.5 rounded-xl bg-[#252535] hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-[#3A3A50] font-semibold flex items-center justify-center gap-1"
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>Disconnect</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(p.id)}
                            disabled={hardwareActionLoading === p.id}
                            className="py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Connect</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleTestPrint(p.id)}
                          disabled={hardwareActionLoading === p.id}
                          className="py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-200 border border-[#3A3A50] font-semibold flex items-center justify-center gap-1"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-orange-400" />
                          <span>Test Print</span>
                        </button>

                        <button
                          onClick={() => handleSetDefault(p.id)}
                          disabled={p.isDefault || hardwareActionLoading === p.id}
                          className={`py-1.5 rounded-xl font-semibold flex items-center justify-center gap-1 border ${
                            p.isDefault
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 cursor-default'
                              : 'bg-[#20202C] hover:bg-[#2A2A3C] text-gray-300 border-[#3A3A50]'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${p.isDefault ? 'fill-orange-400' : ''}`} />
                          <span>{p.isDefault ? 'Default' : 'Set Default'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 3: MASTER PRINT & INVOICE SETTINGS */}
      {/* ================================================================ */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 shadow-md flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Wholesale Invoice & Print Configuration</h3>
              <p className="text-xs text-gray-400">
                Customize headers, transport lines, UPI payment QR codes, table columns, and hardware cut parameters.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSettings}
                className="px-3.5 py-2 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-gray-300 text-xs font-semibold border border-[#3A3A50]"
              >
                Reset Defaults
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Save All Settings</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Box 1: Paper & Header */}
            <div className="bg-[#171720] border border-[#2D2D3D] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-orange-400 uppercase tracking-wider text-xs border-b border-[#292938] pb-2">
                1. Store Header & Identity
              </h4>

              <div>
                <label className="block text-gray-300 mb-1">Business Name on Invoices</label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Subtitle / Tagline</label>
                <input
                  type="text"
                  value={settings.subtitle}
                  onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={settings.gstin}
                    onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">State Name</label>
                  <input
                    type="text"
                    value={settings.stateName}
                    onChange={(e) => setSettings({ ...settings, stateName: e.target.value })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">State Code</label>
                  <input
                    type="text"
                    value={settings.stateCode}
                    onChange={(e) => setSettings({ ...settings, stateCode: e.target.value })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Dynamic UPI QR Code & Financials */}
            <div className="bg-[#171720] border border-[#2D2D3D] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-orange-400 uppercase tracking-wider text-xs border-b border-[#292938] pb-2">
                2. Dynamic UPI QR & Financial Breakdown
              </h4>

              <div className="p-3 bg-[#121217] rounded-xl border border-[#282838] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableUpiQrCode}
                    onChange={(e) => setSettings({ ...settings, enableUpiQrCode: e.target.checked })}
                    className="rounded text-orange-500 focus:ring-0 w-4 h-4 bg-[#1F1F2B]"
                  />
                  <span className="font-bold text-white text-xs">Print Dynamic UPI Payment QR Code</span>
                </label>
                <p className="text-[11px] text-gray-400 pl-6">
                  Encodes bill grand total & merchant VPA so customers can scan with PhonePe / GPay / Paytm.
                </p>

                {settings.enableUpiQrCode && (
                  <div className="grid grid-cols-2 gap-3 pt-2 pl-6">
                    <div>
                      <label className="block text-gray-400 text-[11px] mb-1">Merchant UPI VPA ID</label>
                      <input
                        type="text"
                        value={settings.upiVpa}
                        onChange={(e) => setSettings({ ...settings, upiVpa: e.target.value })}
                        placeholder="8240584877@upi"
                        className="w-full bg-[#1A1A24] border border-[#353548] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-[11px] mb-1">Payee Name</label>
                      <input
                        type="text"
                        value={settings.upiPayeeName}
                        onChange={(e) => setSettings({ ...settings, upiPayeeName: e.target.value })}
                        placeholder="Original Modi Bags"
                        className="w-full bg-[#1A1A24] border border-[#353548] rounded-lg px-2.5 py-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Checkboxes for Financial Fields */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Visible Totals & Ledger Items</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showTaxBreakup}
                      onChange={(e) => setSettings({ ...settings, showTaxBreakup: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Show Tax Breakdown</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showDiscountColumn}
                      onChange={(e) => setSettings({ ...settings, showDiscountColumn: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Show Discount Amount</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showPreviousDue}
                      onChange={(e) => setSettings({ ...settings, showPreviousDue: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Show Previous Outstanding</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showNewTotalBalance}
                      onChange={(e) => setSettings({ ...settings, showNewTotalBalance: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Show Total Net Due</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showTransportInfo}
                      onChange={(e) => setSettings({ ...settings, showTransportInfo: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Show Transport & Marka</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.showSignatureBox}
                      onChange={(e) => setSettings({ ...settings, showSignatureBox: e.target.checked })}
                      className="rounded text-orange-500"
                    />
                    <span>Authorized Signatory Box</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Box 3: Hardware ESC/POS Options */}
            <div className="bg-[#171720] border border-[#2D2D3D] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-orange-400 uppercase tracking-wider text-xs border-b border-[#292938] pb-2">
                3. Hardware ESC/POS Controls
              </h4>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.autoCutPaper}
                    onChange={(e) => setSettings({ ...settings, autoCutPaper: e.target.checked })}
                    className="rounded text-orange-500"
                  />
                  <span className="font-semibold text-white">Auto Cut Paper (GS V 0)</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.openCashDrawer}
                    onChange={(e) => setSettings({ ...settings, openCashDrawer: e.target.checked })}
                    className="rounded text-orange-500"
                  />
                  <span className="font-semibold text-white">Kick Cash Drawer on Print (ESC p)</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-gray-300 mb-1">Bottom Line Feeds</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.feedLines}
                    onChange={(e) => setSettings({ ...settings, feedLines: Number(e.target.value) })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Default Paper Size</label>
                  <select
                    value={settings.defaultPaperSize}
                    onChange={(e) => setSettings({ ...settings, defaultPaperSize: e.target.value as PrintPaperSize })}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="80MM">80mm Thermal Slip</option>
                    <option value="58MM">58mm Portable Slip</option>
                    <option value="A5">A5 Half Sheet</option>
                    <option value="A4">A4 Tax Invoice</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Box 4: Legal Terms & Footer */}
            <div className="bg-[#171720] border border-[#2D2D3D] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-orange-400 uppercase tracking-wider text-xs border-b border-[#292938] pb-2">
                4. Legal Terms & Disclaimers
              </h4>

              <div>
                <label className="block text-gray-300 mb-1">Terms Condition Line 1</label>
                <input
                  type="text"
                  value={settings.footerTerms1}
                  onChange={(e) => setSettings({ ...settings, footerTerms1: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Terms Condition Line 2</label>
                <input
                  type="text"
                  value={settings.footerTerms2}
                  onChange={(e) => setSettings({ ...settings, footerTerms2: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Signatory Title</label>
                <input
                  type="text"
                  value={settings.signatoryTitle}
                  onChange={(e) => setSettings({ ...settings, signatoryTitle: e.target.value })}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Manual Add LAN Printer Modal */}
      {showAddLanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddLanPrinter}
            className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2C2C3A] pb-3">
              <h3 className="font-bold text-white text-sm">Add Raw TCP IP Network Printer</h3>
              <button
                type="button"
                onClick={() => setShowAddLanModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Printer Nickname / Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Burrabazar 1st Floor LAN Printer"
                  value={lanName}
                  onChange={(e) => setLanName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-gray-300 mb-1">IP Address</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.120"
                    value={lanIp}
                    onChange={(e) => setLanIp(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Raw Port</label>
                  <input
                    type="text"
                    required
                    placeholder="9100"
                    value={lanPort}
                    onChange={(e) => setLanPort(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Paper Width</label>
                <select
                  value={lanPaper}
                  onChange={(e) => setLanPaper(e.target.value as PrintPaperSize)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
                >
                  <option value="80MM">80mm Thermal</option>
                  <option value="58MM">58mm Thermal</option>
                  <option value="A4">A4 Laser / Network Node</option>
                  <option value="A5">A5 Voucher</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2C2C3A]">
              <button
                type="button"
                onClick={() => setShowAddLanModal(false)}
                className="px-4 py-2 rounded-xl bg-[#252535] text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400"
              >
                Save Network Printer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
