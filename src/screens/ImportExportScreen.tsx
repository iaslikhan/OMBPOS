import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle,
  FileCode,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { importService } from '../services/importService';
import { exportService } from '../services/exportService';
import { 
  ImportEntityType, 
  ExportEntityType, 
  ExportFileFormat, 
  ImportValidationSummary,
  ImportExecutionResult 
} from '../types';

interface ImportExportScreenProps {
  onBack: () => void;
  onNavigateBackup?: () => void;
}

const IMPORT_ENTITIES: { type: ImportEntityType; label: string; desc: string }[] = [
  { type: 'PRODUCTS', label: 'Products & Bag Catalog', desc: 'Bag sizes, fabric, purchase/wholesale rates, stock' },
  { type: 'CUSTOMERS', label: 'Customers Directory', desc: 'Party names, phones, GSTIN, credit limits, city' },
  { type: 'SUPPLIERS', label: 'Suppliers Master', desc: 'Fabric mills, zipper vendors, GSTIN, bank details' },
  { type: 'OPENING_BALANCES', label: 'Opening Balances', desc: 'Customer & supplier previous debit/credit balances' },
  { type: 'OPENING_STOCK', label: 'Opening Stock Balances', desc: 'Godown inventory quantity adjustments & valuation' },
  { type: 'TRANSPORT', label: 'Transport & Transporters', desc: 'Transporter directories, LR records & parcel freight' },
  { type: 'HISTORICAL_RECORDS', label: 'Historical Bills & Expenses', desc: 'Past invoices, expense vouchers & ledger records' }
];

const EXPORT_ENTITIES: { type: ExportEntityType; label: string; desc: string }[] = [
  { type: 'SALES', label: 'Sales Invoices & Cash Memos', desc: 'Bill numbers, customer details, taxes, pieces, totals' },
  { type: 'BILLS', label: 'Detailed Bills Breakdown', desc: 'Line items, rates, discounts, GST, payment methods' },
  { type: 'CUSTOMERS', label: 'Customer Directory & Balances', desc: 'Full contact directory with current market dues' },
  { type: 'LEDGER', label: 'Customer Account Ledgers', desc: 'Debits, credits, running balances, payment receipts' },
  { type: 'SUPPLIER_LEDGER', label: 'Supplier Account Ledgers', desc: 'Vendor purchases, payment vouchers, running dues' },
  { type: 'PAYMENTS', label: 'Cash & Bank Transactions', desc: 'Inflow & outflow cashbook, receipts, disbursements' },
  { type: 'PURCHASES', label: 'Inward Goods & Purchases', desc: 'Vendor invoices, fabric/material pieces, payment state' },
  { type: 'STOCK', label: 'Physical Stock & Godown Valuation', desc: 'SKU inventory levels, cost valuation, wholesale value' },
  { type: 'EXPENSES', label: 'Operating Expenses & Vouchers', desc: 'Rent, electricity, tea/snacks, staff expenses' },
  { type: 'CRM', label: 'CRM & Customer Follow-ups', desc: 'Scheduled reminders, loyalty notes, interaction logs' },
  { type: 'TRANSPORT', label: 'Transport & Logistics Register', desc: 'LR tracking, destination cities, freight dues' },
  { type: 'REPORTS', label: 'Executive Financial Summary', desc: 'P&L, gross margins, receivables, payables, stock value' }
];

export const ImportExportScreen: React.FC<ImportExportScreenProps> = ({ onBack, onNavigateBackup }) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');

  // Export State
  const [exportingEntity, setExportingEntity] = useState<string | null>(null);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Import State
  const [selectedImportEntity, setSelectedImportEntity] = useState<ImportEntityType>('PRODUCTS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [validationSummary, setValidationSummary] = useState<ImportValidationSummary | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [strictMode, setStrictMode] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  // Handle Export Dispatch
  const handleTriggerExport = async (entity: ExportEntityType, format: ExportFileFormat) => {
    setExportingEntity(`${entity}_${format}`);
    try {
      const res = await exportService.exportData(entity, format);
      setExportNotification(`Successfully downloaded ${res.fileName} (${res.rowCount} records)`);
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Error'}`);
    } finally {
      setExportingEntity(null);
    }
  };

  // Handle Template Download
  const handleDownloadTemplate = (format: 'CSV' | 'XLSX') => {
    importService.downloadTemplate(selectedImportEntity, format);
  };

  // Handle Import File Selection & Validation
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let rows: Record<string, any>[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        rows = importService.parseCsv(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        rows = importService.parseXlsx(buffer);
      } else if (ext === 'json') {
        const text = await file.text();
        const json = JSON.parse(text);
        rows = Array.isArray(json) ? json : (json.rows || json.data || []);
      } else {
        alert('Unsupported file format. Please choose a .csv, .xlsx, or .json file.');
        return;
      }

      setParsedRows(rows);
      const validation = importService.validateRows(selectedImportEntity, rows);
      setValidationSummary(validation);
    } catch (err: any) {
      alert(`Failed to parse file: ${err?.message || 'Invalid file format'}`);
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;

    setIsProcessingImport(true);
    try {
      const result = await importService.executeImport(selectedImportEntity, parsedRows, {
        strictMode,
        updateExisting
      });

      setImportResult(result);
      if (result.success) {
        setParsedRows([]);
        setValidationSummary(null);
        setSelectedFile(null);
      }
    } catch (err: any) {
      alert(`Import error: ${err?.message}`);
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Import & Export Center
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Multi-Format Data Hub (XLSX, CSV, PDF) with Transactional Rollback
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateBackup && (
            <button
              onClick={onNavigateBackup}
              className="px-3 py-1.5 rounded-xl bg-[#282838] hover:bg-[#34344A] text-orange-400 text-xs font-semibold flex items-center gap-1.5 border border-[#3A3A4E] transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Full System Backup & Restore</span>
            </button>
          )}

          {/* Tab Switcher */}
          <div className="flex bg-[#141419] p-1 rounded-xl border border-[#2B2B38]">
            <button
              onClick={() => setActiveTab('EXPORT')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'EXPORT'
                  ? 'bg-orange-500 text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setActiveTab('IMPORT')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'IMPORT'
                  ? 'bg-orange-500 text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {exportNotification && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* TAB 1: EXPORT */}
      {activeTab === 'EXPORT' && (
        <div className="space-y-4">
          {/* Quick Master Export Bar */}
          <div className="bg-gradient-to-r from-[#1E1E28] to-[#252535] border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/10 text-orange-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">One-Click Multi-Sheet Master Export</h3>
                <p className="text-xs text-gray-400">
                  Downloads all business tables in a unified, multi-sheet formatted Excel workbook.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTriggerExport('ALL', 'XLSX')}
              disabled={exportingEntity === 'ALL_XLSX'}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{exportingEntity === 'ALL_XLSX' ? 'Building Master XLSX...' : 'Download Master Workbook (XLSX)'}</span>
            </button>
          </div>

          {/* Export Entities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {EXPORT_ENTITIES.map((ent) => (
              <div
                key={ent.type}
                className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex flex-col justify-between hover:border-[#38384C] transition space-y-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    {ent.label}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    {ent.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#23232E] flex items-center gap-1.5 justify-end">
                  <button
                    onClick={() => handleTriggerExport(ent.type, 'XLSX')}
                    disabled={exportingEntity === `${ent.type}_XLSX`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-[#3A3A4E] transition disabled:opacity-40"
                    title="Export as Microsoft Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>XLSX</span>
                  </button>

                  <button
                    onClick={() => handleTriggerExport(ent.type, 'CSV')}
                    disabled={exportingEntity === `${ent.type}_CSV`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-sky-400 text-xs font-semibold flex items-center gap-1 border border-[#3A3A4E] transition disabled:opacity-40"
                    title="Export as CSV (.csv)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    onClick={() => handleTriggerExport(ent.type, 'PDF')}
                    disabled={exportingEntity === `${ent.type}_PDF`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-rose-400 text-xs font-semibold flex items-center gap-1 border border-[#3A3A4E] transition disabled:opacity-40"
                    title="Export as printable PDF document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Step 1: Select Entity & Download Templates */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-400 font-bold text-xs flex items-center justify-center border border-orange-500/20">
                  1
                </div>
                <h3 className="text-sm font-bold text-white">Select Entity & Get Template</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 block font-medium">Business Entity to Import</label>
                <select
                  value={selectedImportEntity}
                  onChange={(e) => {
                    setSelectedImportEntity(e.target.value as ImportEntityType);
                    setParsedRows([]);
                    setValidationSummary(null);
                    setImportResult(null);
                  }}
                  className="w-full bg-[#141419] border border-[#2E2E3E] text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-orange-500"
                >
                  {IMPORT_ENTITIES.map((ent) => (
                    <option key={ent.type} value={ent.type}>
                      {ent.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 pt-1">
                  {IMPORT_ENTITIES.find(e => e.type === selectedImportEntity)?.desc}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141419] border border-[#23232E] space-y-2.5">
                <span className="text-xs font-semibold text-gray-300 block">Download Standard Sample Template</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('CSV')}
                    className="flex-1 py-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-sky-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#3A3A4E] transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample CSV</span>
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('XLSX')}
                    className="flex-1 py-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#3A3A4E] transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Sample XLSX</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Upload File & Configure Guard Options */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-400 font-bold text-xs flex items-center justify-center border border-orange-500/20">
                  2
                </div>
                <h3 className="text-sm font-bold text-white">Upload File & Security Guards</h3>
              </div>

              <div className="border-2 border-dashed border-[#3A3A4E] rounded-xl p-4 text-center space-y-2 bg-[#141419]/60">
                <FileCode className="w-7 h-7 text-orange-400 mx-auto" />
                <div className="text-xs text-gray-300 font-medium">
                  {selectedFile ? selectedFile.name : 'Choose CSV, XLSX or JSON File'}
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileSelected}
                  className="text-[11px] text-gray-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-orange-500 file:text-black hover:file:bg-orange-400 cursor-pointer"
                />
              </div>

              {/* Guards Toggle */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141419] border border-[#23232E]">
                  <div>
                    <span className="text-white font-medium block">Strict Validation & Rollback</span>
                    <span className="text-[10px] text-gray-400">Abort & revert all rows if any single error occurs</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                    className="rounded text-orange-500 bg-[#1C1C24] border-gray-600 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141419] border border-[#23232E]">
                  <div>
                    <span className="text-white font-medium block">Update Existing Records</span>
                    <span className="text-[10px] text-gray-400">Overwrite matching Product Code/Customer Phone</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="rounded text-orange-500 bg-[#1C1C24] border-gray-600 focus:ring-0"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Validate & Execute */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-400 font-bold text-xs flex items-center justify-center border border-orange-500/20">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-white">Pre-Flight Validation & Commit</h3>
                </div>

                {validationSummary ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-[#141419] border border-[#23232E] text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Rows Detected:</span>
                        <span className="text-white font-bold">{parsedRows.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Valid Schema Rows:</span>
                        <span className="text-emerald-400 font-bold">{validationSummary.validRows}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Validation Errors:</span>
                        <span className={`font-bold ${validationSummary.invalidRows > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                          {validationSummary.invalidRows}
                        </span>
                      </div>
                    </div>

                    {validationSummary.errors.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-[11px] text-rose-300 max-h-24 overflow-y-auto space-y-1 font-mono">
                        {validationSummary.errors.slice(0, 3).map((err, i) => (
                          <div key={i}>• Row {err.row}: {err.message}</div>
                        ))}
                        {validationSummary.errors.length > 3 && (
                          <div>... and {validationSummary.errors.length - 3} more errors.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 p-4 rounded-xl bg-[#141419] border border-[#23232E] text-center">
                    Please upload a data file in Step 2 to view validation and execute import.
                  </div>
                )}
              </div>

              <button
                onClick={handleExecuteImport}
                disabled={!validationSummary || parsedRows.length === 0 || isProcessingImport}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-40"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isProcessingImport ? 'Importing with Rollback Armed...' : `Execute Import (${parsedRows.length} Rows)`}</span>
              </button>
            </div>
          </div>

          {/* Execution Result Banner */}
          {importResult && (
            <div className={`p-4 rounded-2xl border ${
              importResult.success
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-700/50 text-rose-300'
            } space-y-2`}>
              <div className="flex items-center gap-2 text-sm font-bold">
                {importResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                )}
                <span>
                  {importResult.success
                    ? `Import Completed Successfully! ${importResult.importedCount} records written into ${importResult.entityType}.`
                    : `Import Failed and was ROLLED BACK. Zero state corruption.`}
                </span>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-2.5 rounded-xl bg-black/40 border border-black/20 text-xs font-mono space-y-1">
                  {importResult.errors.map((e, idx) => (
                    <div key={idx}>Row {e.row}: {e.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sample Rows Preview Table */}
          {validationSummary && validationSummary.sampleParsedRows.length > 0 && (
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-orange-400" />
                <span>Parsed Data Preview (First 5 Rows)</span>
              </h4>

              <div className="overflow-x-auto rounded-xl border border-[#2E2E3E]">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[#141419] text-gray-400 border-b border-[#2E2E3E]">
                    <tr>
                      {Object.keys(validationSummary.sampleParsedRows[0]).filter(k => !k.startsWith('_')).map((key) => (
                        <th key={key} className="p-2.5 font-bold uppercase tracking-wider">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23232E]">
                    {validationSummary.sampleParsedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#20202C]">
                        {Object.entries(row).filter(([k]) => !k.startsWith('_')).map(([k, val], cIdx) => (
                          <td key={cIdx} className="p-2.5 text-gray-300 font-mono">
                            {String(val || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
