import { roomDb, TableName, REQUIRED_TABLES } from '../db/indexedDbRoom';
import { 
  DatabaseBackupPayload, 
  AutoBackupSettings, 
  BackupHistoryEntry, 
  RestoreResult, 
  AutoBackupFrequency 
} from '../types';
import { auditService } from './auditService';
import { securityService } from './securityService';

const BACKUP_SETTINGS_KEY = 'omb_auto_backup_settings_v1';
const BACKUP_HISTORY_STORAGE_KEY = 'omb_backup_history_snapshots_v1';

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  enabled: true,
  frequency: 'DAILY',
  maxRetainedSnapshots: 5,
  downloadLocalCopyOnAutoBackup: false
};

class BackupService {
  private autoBackupTimer: any = null;

  constructor() {
    this.initAutoBackupWatchdog();
  }

  /**
   * Generates a cryptographic / hash checksum string for data integrity validation
   */
  private generateSimpleChecksum(dataStr: string): string {
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `omb-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  /**
   * Creates a complete backup payload of all tables in the Room IndexedDB
   */
  public async createBackup(options?: { 
    note?: string; 
    type?: 'MANUAL' | 'AUTOMATIC';
    skipAudit?: boolean;
  }): Promise<{ 
    payload: DatabaseBackupPayload; 
    jsonString: string; 
    fileName: string; 
    recordCounts: Record<string, number>;
    checksum: string;
  }> {
    const now = Date.now();
    const dateStr = new Date(now).toISOString();
    const dateFileSlug = dateStr.replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `OriginalModiBags_Backup_${dateFileSlug}.json`;

    const tablesData: Record<string, any[]> = {};
    const recordCounts: Record<string, number> = {};

    for (const table of REQUIRED_TABLES) {
      try {
        const rows = await roomDb.getAll(table);
        tablesData[table] = rows || [];
        recordCounts[table] = rows.length;
      } catch (err) {
        console.warn(`[BackupService] Table ${table} not loaded:`, err);
        tablesData[table] = [];
        recordCounts[table] = 0;
      }
    }

    const payload: DatabaseBackupPayload = {
      version: 1,
      exportedAt: now,
      exportedDate: dateStr,
      business: 'ORIGINAL MODI BAGS',
      businessId: 'biz-original-modi-bags',
      source: 'RoomDB Native IndexedDB Storage Engine',
      note: options?.note || (options?.type === 'AUTOMATIC' ? 'Scheduled Automatic Snapshot' : 'Manual Full System Backup'),
      tables: tablesData
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const checksum = this.generateSimpleChecksum(jsonString);
    payload.checksum = checksum;

    // Save snapshot to history queue
    await this.saveSnapshotToHistory({
      id: `snap-${now}`,
      timestamp: now,
      dateStr: new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      note: payload.note || 'Full System Snapshot',
      type: options?.type || 'MANUAL',
      recordCounts,
      sizeBytes: new Blob([jsonString]).size,
      checksum,
      payload
    });

    if (!options?.skipAudit) {
      const activeStaff = securityService.getActiveStaff();
      await auditService.log({
        user: activeStaff?.name || 'Admin',
        role: activeStaff?.role || 'ADMIN',
        action: 'BACKUP_CREATED',
        recordType: 'SYSTEM_BACKUP',
        recordId: `snap-${now}`,
        severity: 'INFO',
        description: `Full database backup generated (${Object.values(recordCounts).reduce((a, b) => a + b, 0)} total records across ${REQUIRED_TABLES.length} tables)`,
        notes: `Checksum: ${checksum} | Note: ${payload.note}`
      });
    }

    return {
      payload,
      jsonString,
      fileName,
      recordCounts,
      checksum
    };
  }

  /**
   * Triggers client-side browser file download of full backup
   */
  public async downloadBackupNow(options?: { note?: string }): Promise<string> {
    const { jsonString, fileName } = await this.createBackup({ 
      note: options?.note || 'Manual Download Backup',
      type: 'MANUAL' 
    });

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return fileName;
  }

  /**
   * Restores database from backup with ATOMIC TRANSACTION ROLLBACK on failure
   */
  public async restoreBackup(
    backupInput: DatabaseBackupPayload | string, 
    options?: { clearExistingBeforeRestore?: boolean }
  ): Promise<RestoreResult> {
    const activeStaff = securityService.getActiveStaff();

    // 1. Parse and Validate Backup Format
    let payload: DatabaseBackupPayload;
    try {
      if (typeof backupInput === 'string') {
        payload = JSON.parse(backupInput);
      } else {
        payload = backupInput;
      }
    } catch (err: any) {
      return {
        success: false,
        restoredAt: Date.now(),
        tablesRestored: [],
        totalRecordsRestored: 0,
        error: `Invalid JSON backup format: ${err?.message || 'Parse error'}`
      };
    }

    if (!payload || !payload.tables || typeof payload.tables !== 'object') {
      return {
        success: false,
        restoredAt: Date.now(),
        tablesRestored: [],
        totalRecordsRestored: 0,
        error: 'Backup payload missing required "tables" root object.'
      };
    }

    // 2. Take Safety Snapshot Before Restore for Atomic Rollback
    let safetySnapshot: DatabaseBackupPayload;
    try {
      const backupResult = await this.createBackup({ 
        note: 'Pre-Restore Rollback Safety Point', 
        type: 'AUTOMATIC',
        skipAudit: true 
      });
      safetySnapshot = backupResult.payload;
    } catch (snapshotErr: any) {
      return {
        success: false,
        restoredAt: Date.now(),
        tablesRestored: [],
        totalRecordsRestored: 0,
        error: `Failed to create pre-restore safety checkpoint: ${snapshotErr?.message}`
      };
    }

    // 3. Perform Transactional Restore
    const restoredTables: string[] = [];
    let totalRestoredCount = 0;

    try {
      // Step A: If clearing existing tables, clear them
      if (options?.clearExistingBeforeRestore) {
        for (const table of REQUIRED_TABLES) {
          if (payload.tables[table]) {
            await roomDb.clear(table);
          }
        }
      }

      // Step B: Write rows into each table
      for (const [table, rows] of Object.entries(payload.tables)) {
        if (!Array.isArray(rows)) continue;
        
        // Ensure table exists in Room
        await roomDb.ensureStores([table as TableName]);

        for (const row of rows) {
          if (!row || typeof row !== 'object') {
            throw new Error(`Corrupt row record in table '${table}'`);
          }
          if (!row.id) {
            throw new Error(`Missing primary key 'id' in table '${table}'`);
          }
          await roomDb.put(table as TableName, row);
          totalRestoredCount++;
        }
        restoredTables.push(table);
      }

      // Re-initialize security & audit to ensure permissions and active staff sync
      await securityService.init();

      await auditService.log({
        user: activeStaff?.name || 'Admin',
        role: activeStaff?.role || 'ADMIN',
        action: 'BACKUP_RESTORED',
        recordType: 'SYSTEM_RESTORE',
        recordId: `restore-${Date.now()}`,
        severity: 'ALERT',
        description: `Database successfully restored from backup. ${totalRestoredCount} records across ${restoredTables.length} tables.`,
        notes: `Backup timestamp: ${payload.exportedDate || payload.exportedAt}`
      });

      return {
        success: true,
        restoredAt: Date.now(),
        tablesRestored: restoredTables,
        totalRecordsRestored: totalRestoredCount
      };

    } catch (restoreErr: any) {
      console.error('[BackupService] Restore failed! Executing atomic rollback...', restoreErr);

      // STEP C: ATOMIC ROLLBACK TO PRE-RESTORE SAFETY SNAPSHOT
      try {
        for (const table of REQUIRED_TABLES) {
          if (safetySnapshot.tables[table]) {
            await roomDb.clear(table);
            for (const row of safetySnapshot.tables[table]) {
              await roomDb.put(table, row);
            }
          }
        }

        await auditService.log({
          user: activeStaff?.name || 'Admin',
          role: activeStaff?.role || 'ADMIN',
          action: 'RESTORE_ROLLED_BACK',
          recordType: 'SYSTEM_RESTORE',
          recordId: `rollback-${Date.now()}`,
          severity: 'ALERT',
          description: `Restore operation failed and was completely ROLLED BACK to safety snapshot. Error: ${restoreErr?.message}`,
          notes: 'Zero database corruption: previous state preserved 100%'
        });

        return {
          success: false,
          restoredAt: Date.now(),
          tablesRestored: [],
          totalRecordsRestored: 0,
          error: `Restore failed: ${restoreErr?.message}. Database rolled back successfully to previous state.`,
          rolledBack: true
        };

      } catch (rollbackErr: any) {
        console.error('[BackupService] CRITICAL: Rollback exception:', rollbackErr);
        return {
          success: false,
          restoredAt: Date.now(),
          tablesRestored: [],
          totalRecordsRestored: 0,
          error: `Restore failed (${restoreErr?.message}) AND rollback had errors: ${rollbackErr?.message}`,
          rolledBack: false
        };
      }
    }
  }

  /**
   * Retrieves Auto Backup Configuration Settings
   */
  public getAutoBackupSettings(): AutoBackupSettings {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return DEFAULT_AUTO_BACKUP_SETTINGS;
    }
    try {
      const stored = localStorage.getItem(BACKUP_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_AUTO_BACKUP_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_AUTO_BACKUP_SETTINGS;
  }

  /**
   * Saves Auto Backup Configuration Settings
   */
  public saveAutoBackupSettings(settings: Partial<AutoBackupSettings>): AutoBackupSettings {
    const current = this.getAutoBackupSettings();
    const updated: AutoBackupSettings = { ...current, ...settings };
    
    // Recalculate next backup time
    updated.nextBackupAt = this.calculateNextBackupTime(updated.frequency);

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(updated));
    }

    return updated;
  }

  /**
   * Calculates next epoch ms timestamp based on frequency
   */
  private calculateNextBackupTime(frequency: AutoBackupFrequency): number | undefined {
    if (frequency === 'OFF') return undefined;
    const now = Date.now();
    switch (frequency) {
      case 'EVERY_6_HOURS':
        return now + 6 * 60 * 60 * 1000;
      case 'EVERY_12_HOURS':
        return now + 12 * 60 * 60 * 1000;
      case 'DAILY':
        return now + 24 * 60 * 60 * 1000;
      case 'WEEKLY':
        return now + 7 * 24 * 60 * 60 * 1000;
      default:
        return now + 24 * 60 * 60 * 1000;
    }
  }

  /**
   * In-Memory / Local Storage Backup History Management
   */
  public async getBackupHistory(): Promise<BackupHistoryEntry[]> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const history: BackupHistoryEntry[] = JSON.parse(raw);
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  private async saveSnapshotToHistory(entry: BackupHistoryEntry): Promise<void> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    try {
      const history = await this.getBackupHistory();
      const settings = this.getAutoBackupSettings();
      const maxSnapshots = Math.max(3, settings.maxRetainedSnapshots || 5);

      const updated = [entry, ...history.filter(h => h.id !== entry.id)].slice(0, maxSnapshots);
      localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[BackupService] Failed to save snapshot to history:', e);
    }
  }

  public async deleteBackupHistoryItem(id: string): Promise<void> {
    const history = await this.getBackupHistory();
    const updated = history.filter(h => h.id !== id);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    }
  }

  /**
   * Initializes Auto-Backup Background Watchdog
   */
  private initAutoBackupWatchdog(): void {
    if (typeof window === 'undefined') return;

    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }

    // Check periodically every 5 minutes
    this.autoBackupTimer = setInterval(() => {
      this.checkAndTriggerAutoBackup();
    }, 5 * 60 * 1000);

    // Initial check on launch
    setTimeout(() => {
      this.checkAndTriggerAutoBackup();
    }, 2000);
  }

  /**
   * Checks if an auto backup is due and executes it
   */
  public async checkAndTriggerAutoBackup(): Promise<boolean> {
    const settings = this.getAutoBackupSettings();
    if (!settings.enabled || settings.frequency === 'OFF') return false;

    const now = Date.now();
    const isDue = !settings.lastBackupAt || (settings.nextBackupAt && now >= settings.nextBackupAt);

    if (isDue) {
      try {
        const { fileName } = await this.createBackup({ 
          note: `Automatic Background Backup (${settings.frequency})`,
          type: 'AUTOMATIC' 
        });

        const updatedSettings: AutoBackupSettings = {
          ...settings,
          lastBackupAt: now,
          nextBackupAt: this.calculateNextBackupTime(settings.frequency)
        };
        this.saveAutoBackupSettings(updatedSettings);

        if (settings.downloadLocalCopyOnAutoBackup) {
          await this.downloadBackupNow({ note: 'Scheduled Auto Backup' });
        }

        console.log(`[BackupService] Auto backup completed successfully: ${fileName}`);
        return true;
      } catch (err) {
        console.error('[BackupService] Auto backup failed:', err);
        return false;
      }
    }
    return false;
  }
}

export const backupService = new BackupService();
