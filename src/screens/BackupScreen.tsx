import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ArrowLeft, 
  Download, 
  Upload, 
  Cloud, 
  CheckCircle, 
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Clock,
  AlertTriangle,
  FileCode,
  Trash2,
  Sliders,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowDownToLine,
  History,
  Wifi,
  WifiOff,
  CloudRain,
  RotateCw,
  Check,
  Server
} from 'lucide-react';
import { backupService } from '../services/backupService';
import { exportService } from '../services/exportService';
import { firebaseFoundation, SyncState } from '../services/firebaseFoundation';
import { networkMonitor } from '../services/networkMonitor';
import { AutoBackupSettings, BackupHistoryEntry, RestoreResult, SyncQueueItem, CloudSyncSummary } from '../types';

interface BackupScreenProps {
  onBack: () => void;
  onNavigateImportExport?: () => void;
}

export const BackupScreen: React.FC<BackupScreenProps> = ({ onBack, onNavigateImportExport }) => {
  const [activeTab, setActiveTab] = useState<'BACKUP_RESTORE' | 'CLOUD_SYNC'>('BACKUP_RESTORE');
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [autoSettings, setAutoSettings] = useState<AutoBackupSettings>(backupService.getAutoBackupSettings());
  const [historyList, setHistoryList] = useState<BackupHistoryEntry[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Cloud Sync State
  const [syncState, setSyncState] = useState<SyncState>(firebaseFoundation.getState());
  const [isOnline, setIsOnline] = useState<boolean>(networkMonitor.isOnline());
  const [pendingQueue, setPendingQueue] = useState<SyncQueueItem[]>([]);
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  // Restore State
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{ tableCount: number; recordCount: number; date: string } | null>(null);
  const [clearExisting, setClearExisting] = useState(true);

  useEffect(() => {
    loadBackupHistory();
    loadSyncQueue();

    const unsubSync = firebaseFoundation.subscribe((st) => {
      setSyncState(st);
      loadSyncQueue();
    });

    const unsubNet = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    return () => {
      unsubSync();
      unsubNet();
    };
  }, []);

  const loadBackupHistory = async () => {
    const list = await backupService.getBackupHistory();
    setHistoryList(list);
  };

  const loadSyncQueue = async () => {
    const q = await firebaseFoundation.getPendingQueue();
    setPendingQueue(q);
  };

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 5000);
  };

  // 1. Instant Backup Now
  const handleBackupNow = async () => {
    setIsExporting(true);
    try {
      const fileName = await backupService.downloadBackupNow({ note: 'Manual user backup' });
      await loadBackupHistory();
      showNotification(`Full Room DB backup saved successfully as ${fileName}`, 'success');
    } catch (err: any) {
      showNotification(`Backup failed: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export All Master XLSX
  const handleExportAllMaster = async () => {
    setIsExporting(true);
    try {
      const result = await exportService.exportData('ALL', 'XLSX');
      showNotification(`Master Multi-Sheet Excel Workbook exported (${result.fileName})`, 'success');
    } catch (err: any) {
      showNotification(`Export All failed: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Update Auto Backup Settings
  const handleToggleAutoBackup = (enabled: boolean) => {
    const updated = backupService.saveAutoBackupSettings({ enabled });
    setAutoSettings(updated);
    showNotification(`Automatic backup ${enabled ? 'enabled' : 'disabled'}.`);
  };

  const handleFrequencyChange = (freq: any) => {
    const updated = backupService.saveAutoBackupSettings({ frequency: freq });
    setAutoSettings(updated);
    showNotification(`Auto backup frequency set to ${freq}.`);
  };

  const handleTriggerAutoTest = async () => {
    const executed = await backupService.checkAndTriggerAutoBackup();
    await loadBackupHistory();
    if (executed) {
      showNotification('Scheduled auto-backup executed successfully and added to history snapshot archive.');
    } else {
      await backupService.createBackup({ note: 'Forced Auto Backup Test', type: 'AUTOMATIC' });
      await loadBackupHistory();
      showNotification('Auto-backup snapshot captured and stored.');
    }
  };

  // 4. File selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        setSelectedFileContent(content);
        const parsed = JSON.parse(content);
        
        let totalRecs = 0;
        let tblCount = 0;
        if (parsed.tables && typeof parsed.tables === 'object') {
          tblCount = Object.keys(parsed.tables).length;
          totalRecs = (Object.values(parsed.tables) as any[]).reduce((acc: number, cur: any) => acc + (Array.isArray(cur) ? cur.length : 0), 0);
        }

        setParsedPreview({
          tableCount: tblCount,
          recordCount: totalRecs,
          date: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString('en-IN') : 'Unknown'
        });
      } catch (err: any) {
        showNotification('Invalid JSON file. Please choose a valid Original Modi Bags backup file.', 'error');
        setSelectedFileContent(null);
        setParsedPreview(null);
      }
    };
    reader.readAsText(file);
  };

  // 5. Execute Restore
  const handleExecuteRestore = async () => {
    if (!selectedFileContent) return;

    const confirmed = window.confirm(
      '⚠️ WARNING: Restoring will overwrite existing database records with the backup data. Any error will trigger an automatic rollback to preserve current data. Do you wish to continue?'
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const result: RestoreResult = await backupService.restoreBackup(selectedFileContent, {
        clearExistingBeforeRestore: clearExisting
      });

      if (result.success) {
        showNotification(`Restore completed successfully! Restored ${result.totalRecordsRestored} records across ${result.tablesRestored.length} tables.`, 'success');
        setSelectedFileContent(null);
        setSelectedFileName('');
        setParsedPreview(null);
        await loadBackupHistory();
      } else {
        showNotification(`Restore failed: ${result.error || 'Validation error'}. Database rolled back safely to previous state.`, 'error');
      }
    } catch (err: any) {
      showNotification(`Restore failed with error: ${err?.message || 'Unknown'}. Rolled back.`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // 6. Restore from Local History
  const handleRestoreFromHistory = async (entry: BackupHistoryEntry) => {
    const confirmed = window.confirm(
      `Restore database snapshot from ${entry.dateStr} (${entry.note})? Current database will be replaced with this snapshot point.`
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const result = await backupService.restoreBackup(JSON.stringify(entry.payload), {
        clearExistingBeforeRestore: true
      });

      if (result.success) {
        showNotification(`Restored from history snapshot (${result.totalRecordsRestored} records)!`, 'success');
      } else {
        showNotification(`Snapshot restore failed: ${result.error}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Snapshot restore error: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    await backupService.deleteBackupHistoryItem(id);
    await loadBackupHistory();
    showNotification('Snapshot deleted from history.');
  };

  // Cloud Sync Handlers
  const handleTriggerCloudSync = async () => {
    try {
      const summary = await firebaseFoundation.triggerSync();
      if (summary.success) {
        showNotification(`Cloud sync complete! Pushed ${summary.syncedOutboundCount} records, Pulled ${summary.syncedInboundCount} records.`, 'success');
      } else {
        showNotification(`Sync notice: ${summary.errorMessage || 'Queued locally'}`, summary.failedCount > 0 ? 'error' : 'info');
      }
    } catch (err: any) {
      showNotification(`Sync error: ${err?.message || 'Failed'}`, 'error');
    }
  };

  const handleRetryFailedQueue = async () => {
    setIsRetryingSync(true);
    try {
      const summary = await firebaseFoundation.retryFailedSync();
      if (summary.success) {
        showNotification(`Retry succeeded: ${summary.syncedOutboundCount} records synced to Firestore.`, 'success');
      } else {
        showNotification(`Retry partial: ${summary.errorMessage || 'Some items failed'}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Retry error: ${err?.message}`, 'error');
    } finally {
      setIsRetryingSync(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header & Mode Switcher */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Database Backup & Cloud Synchronization
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              Room IndexedDB (Offline Source of Truth) • Firebase Firestore Cloud Replica & Auto-Sync
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-[#141419] p-1.5 rounded-xl border border-[#2B2B38] self-stretch md:self-auto justify-between">
          <button
            onClick={() => setActiveTab('BACKUP_RESTORE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'BACKUP_RESTORE'
                ? 'bg-orange-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Snapshots & Restore</span>
          </button>

          <button
            onClick={() => setActiveTab('CLOUD_SYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'CLOUD_SYNC'
                ? 'bg-orange-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Firebase Cloud Sync</span>
            {syncState.pendingSyncCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'CLOUD_SYNC' ? 'bg-black text-orange-400' : 'bg-orange-500 text-black'
              }`}>
                {syncState.pendingSyncCount}
              </span>
            )}
          </button>

          {onNavigateImportExport && (
            <button
              onClick={onNavigateImportExport}
              className="px-3 py-1.5 rounded-lg bg-[#22222E] hover:bg-[#2F2F40] text-orange-400 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">CSV Import</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition animate-in fade-in ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' 
            : feedbackMessage.type === 'error'
            ? 'bg-rose-950/40 border-rose-700/50 text-rose-300'
            : 'bg-sky-950/40 border-sky-700/50 text-sky-300'
        }`}>
          {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {feedbackMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          {feedbackMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-sky-400 shrink-0 animate-spin" />}
          <span className="font-medium">{feedbackMessage.text}</span>
        </div>
      )}

      {/* TAB 1: BACKUP & RESTORE */}
      {activeTab === 'BACKUP_RESTORE' && (
        <div className="space-y-4">
          {/* Main Action Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card 1: Backup Now & Export All */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-orange-500/10 text-orange-400">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Full Backup & Master Export</h3>
                    <p className="text-[11px] text-gray-400">Instant database snapshot of all 25 system tables</p>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  Creates an encrypted, verified JSON backup containing all customers, bills, stock, purchases, ledgers, staff credentials, and audit logs.
                </p>

                <div className="p-3 rounded-xl bg-[#141419] border border-[#23232E] text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Total Stored Tables:</span>
                    <span className="text-white font-bold">25 Room Stores</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Integrity Guard:</span>
                    <span className="text-emerald-400">Checksum Armed</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Backup Schema:</span>
                    <span className="text-orange-400">v1.3 Native JSON</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleBackupNow}
                  disabled={isExporting}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Generating Snapshot...' : 'Backup Database Now (JSON)'}</span>
                </button>

                <button
                  onClick={handleExportAllMaster}
                  disabled={isExporting}
                  className="w-full py-2.5 rounded-xl bg-[#252533] hover:bg-[#323246] text-orange-400 font-semibold text-xs flex items-center justify-center gap-2 border border-[#3A3A4E] transition disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export All Tables (Master XLSX)</span>
                </button>
              </div>
            </div>

            {/* Card 2: Automatic Backup Scheduler */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Automatic Background Backup</h3>
                      <p className="text-[11px] text-gray-400">Scheduled snapshot rotation</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSettings.enabled}
                      onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#252533] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 block font-medium">Backup Frequency:</label>
                  <select
                    value={autoSettings.frequency}
                    onChange={(e) => handleFrequencyChange(e.target.value)}
                    disabled={!autoSettings.enabled}
                    className="w-full px-3 py-2 rounded-xl bg-[#141419] border border-[#2B2B38] text-xs text-white focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  >
                    <option value="EVERY_6_HOURS">Every 6 Hours (Recommended for High Volume POS)</option>
                    <option value="EVERY_12_HOURS">Every 12 Hours (Twice Daily)</option>
                    <option value="DAILY">Once Daily (End of Day Closing)</option>
                    <option value="WEEKLY">Weekly Summary</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-[#141419] border border-[#23232E] text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Last Automated Snapshot:</span>
                    <span className="text-white">
                      {autoSettings.lastBackupAt 
                        ? new Date(autoSettings.lastBackupAt).toLocaleDateString('en-IN') + ' ' + new Date(autoSettings.lastBackupAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : 'None yet'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Snapshot Retention:</span>
                    <span className="text-sky-400">Keep latest {autoSettings.maxRetainedSnapshots || 5} snapshots</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTriggerAutoTest}
                  className="w-full py-2 rounded-xl bg-[#252533] hover:bg-[#323246] text-gray-200 text-xs font-semibold flex items-center justify-center gap-2 border border-[#3A3A4E] transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Run Auto-Backup Watchdog Now</span>
                </button>
              </div>
            </div>

            {/* Card 3: Restore Database with Transaction Rollback */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Restore with Rollback Shield</h3>
                    <p className="text-[11px] text-gray-400">Fault-tolerant import & state recovery</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-dashed border-[#3A3A4E] bg-[#141419] text-center space-y-2">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                  <div className="text-xs text-gray-300">
                    <label className="text-orange-400 hover:text-orange-300 cursor-pointer font-semibold underline">
                      Choose Backup File (.json)
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {selectedFileName && (
                    <span className="text-[11px] font-mono text-emerald-400 block truncate">
                      {selectedFileName}
                    </span>
                  )}
                </div>

                {parsedPreview && (
                  <div className="p-2.5 rounded-xl bg-[#141419] border border-emerald-500/30 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-gray-400">
                      <span>Tables in File:</span>
                      <span className="text-white font-bold">{parsedPreview.tableCount} tables</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Total Records:</span>
                      <span className="text-emerald-400 font-bold">{parsedPreview.recordCount} rows</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleExecuteRestore}
                  disabled={!selectedFileContent || isRestoring}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isRestoring ? 'Verifying & Restoring...' : 'Execute Protected Restore'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Local Snapshot Archive Table */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Local Snapshot Archive & 1-Click Rollback Points</h3>
              </div>
              <span className="text-xs text-gray-400">
                Retaining {historyList.length} of {autoSettings.maxRetainedSnapshots || 5} snapshots
              </span>
            </div>

            {historyList.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">
                No local snapshot history available. Click "Backup Database Now" to generate the first snapshot.
              </div>
            ) : (
              <div className="space-y-2">
                {historyList.map((entry) => {
                  const totalRecs = Object.values(entry.recordCounts || {}).reduce((a, b) => a + b, 0);
                  const sizeKb = (entry.sizeBytes / 1024).toFixed(1);

                  return (
                    <div key={entry.id} className="p-3.5 rounded-xl bg-[#141419] border border-[#23232E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#353548] transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{entry.dateStr}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.type === 'AUTOMATIC' 
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            {entry.type}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">({sizeKb} KB)</span>
                        </div>
                        <p className="text-[11px] text-gray-400 flex items-center gap-3">
                          <span>{entry.note}</span>
                          <span>•</span>
                          <span className="text-gray-300 font-semibold">{totalRecs} records</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-gray-500">Checksum: {entry.checksum}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreFromHistory(entry)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30 transition"
                          title="Restore entire database to this point in time"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>1-Click Restore</span>
                        </button>

                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(entry.payload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `OMB_Snapshot_${entry.id}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 rounded-lg bg-[#252533] hover:bg-[#323246] text-gray-300 hover:text-white transition"
                          title="Download snapshot JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteHistory(entry.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
                          title="Delete snapshot from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FIREBASE CLOUD SYNCHRONIZATION */}
      {activeTab === 'CLOUD_SYNC' && (
        <div className="space-y-4">
          {/* Cloud Overview Status Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-1.5">
              <span className="text-xs text-gray-400">Local Source of Truth</span>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-400" />
                <span className="text-base font-bold text-white">Room IndexedDB</span>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium">100% Offline Autonomous</p>
            </div>

            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-1.5">
              <span className="text-xs text-gray-400">Cloud Replica Target</span>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-sky-400" />
                <span className="text-base font-bold text-white">Firestore Cloud</span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate">groovy-reserve-0lxdt</p>
            </div>

            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-1.5">
              <span className="text-xs text-gray-400">Pending Sync Queue</span>
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-5 h-5 ${syncState.isSyncing ? 'text-orange-400 animate-spin' : 'text-gray-300'}`} />
                <span className="text-base font-bold text-white">{syncState.pendingSyncCount} mutations</span>
              </div>
              <p className="text-[11px] text-gray-400">
                {syncState.failedCount > 0 ? `${syncState.failedCount} failed attempts` : 'Queue healthy'}
              </p>
            </div>

            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-1.5">
              <span className="text-xs text-gray-400">Network State</span>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-amber-400" />
                )}
                <span className={`text-base font-bold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {syncState.lastSyncedTime 
                  ? `Last synced: ${new Date(syncState.lastSyncedTime).toLocaleTimeString('en-IN')}` 
                  : 'Never synced'}
              </p>
            </div>
          </div>

          {/* Sync Control Card & Security Guarantees */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-orange-400" />
                  <h3 className="text-sm font-bold text-white">Offline-First Cloud Synchronization Engine</h3>
                </div>
                <p className="text-xs text-gray-400">
                  Room DB operations never block on network. All invoices, payments, purchases, and label updates queue safely for background delivery.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => networkMonitor.simulateToggle()}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                    isOnline 
                      ? 'bg-[#252533] text-amber-300 border-amber-500/30 hover:bg-[#2F2F42]' 
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                  }`}
                >
                  {isOnline ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
                  <span>{isOnline ? 'Simulate Offline Mode' : 'Restore Online Mode'}</span>
                </button>

                {syncState.failedCount > 0 && (
                  <button
                    onClick={handleRetryFailedQueue}
                    disabled={isRetryingSync || syncState.isSyncing}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RotateCw className={`w-4 h-4 ${isRetryingSync ? 'animate-spin' : ''}`} />
                    <span>Retry Failed ({syncState.failedCount})</span>
                  </button>
                )}

                <button
                  onClick={handleTriggerCloudSync}
                  disabled={syncState.isSyncing || !isOnline}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncState.isSyncing ? 'Synchronizing Cloud...' : 'Synchronize Now'}</span>
                </button>
              </div>
            </div>

            {/* Offline-First Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#141419] border border-[#23232E] space-y-1 text-xs">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Zero Local Data Loss</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Local Room IndexedDB data is NEVER deleted because a cloud sync fails or network drops.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141419] border border-[#23232E] space-y-1 text-xs">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Check className="w-4 h-4 text-sky-400" />
                  <span>Deterministic Idempotency</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Unique immutable IDs for bills, payments & ledger items prevent duplicate financial transactions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141419] border border-[#23232E] space-y-1 text-xs">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <RotateCw className="w-4 h-4 text-orange-400" />
                  <span>Automatic Retry & Backoff</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Failed queue mutations automatically retry when network reconnects or on scheduled timer.
                </p>
              </div>
            </div>
          </div>

          {/* Pending Queue Inspector */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Active Mutation Queue ({pendingQueue.length} records)
                </h4>
              </div>
              <button
                onClick={loadSyncQueue}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Queue</span>
              </button>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-[#2B2B38] rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-semibold text-gray-400">All local data is fully synchronized with Firebase Firestore</p>
                <p className="text-[11px] text-gray-500 mt-1">No pending mutations in queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#2A2A38] text-gray-400 bg-[#141419]">
                      <th className="p-2.5">Table</th>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Entity ID</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Retries</th>
                      <th className="p-2.5">Error / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23232E]">
                    {pendingQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1C1C26] transition">
                        <td className="p-2.5 text-white font-bold">{item.table}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.action === 'UPSERT' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-300 truncate max-w-[150px]">{item.entityId}</td>
                        <td className="p-2.5 text-gray-400">{new Date(item.timestamp).toLocaleTimeString('en-IN')}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : item.status === 'SYNCING'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-400">{item.retryCount || 0}</td>
                        <td className="p-2.5 text-rose-400 max-w-[200px] truncate text-[11px]">
                          {item.lastError || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
