/**
 * Original Modi Bags Business Manager - Audit Trail Service
 * Immutable Local Audit Trail of Security, Auth, Billing, Staff and System Events
 */

import { roomDb } from '../db/indexedDbRoom';
import { AuditLogItem, AuditActionType, AuditSeverity } from '../types';

export interface AuditLogFilter {
  searchTerm?: string;
  startDate?: number;
  endDate?: number;
  user?: string;
  action?: string;
  severity?: AuditSeverity | 'ALL';
  recordType?: string;
  limit?: number;
}

export interface NewAuditLogParams {
  user?: string;
  staffId?: string;
  role?: string;
  action: AuditActionType | string;
  recordType: string;
  recordId?: string;
  description: string;
  severity?: AuditSeverity;
  oldValue?: string;
  newValue?: string;
  previousData?: any;
  newData?: any;
  notes?: string;
  timestamp?: number;
}

class AuditService {
  private listeners: Set<(item: AuditLogItem) => void> = new Set();

  public subscribe(listener: (item: AuditLogItem) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(item: AuditLogItem) {
    this.listeners.forEach((fn) => {
      try {
        fn(item);
      } catch (err) {
        console.error('[AuditService] Listener error:', err);
      }
    });
  }

  /**
   * Records an audit log entry in the Room IndexedDB audit_logs table
   */
  public async log(params: NewAuditLogParams): Promise<AuditLogItem> {
    const now = params.timestamp || Date.now();
    const item: AuditLogItem = {
      id: `audit-${now}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: 'biz-original-modi-bags',
      user: params.user || 'Mukesh Modi (Admin)',
      staffId: params.staffId,
      role: params.role || 'ADMIN',
      action: params.action,
      timestamp: now,
      recordType: params.recordType,
      recordId: params.recordId || `rec-${now}`,
      severity: params.severity || 'INFO',
      description: params.description,
      oldValue: params.oldValue || (params.previousData ? JSON.stringify(params.previousData) : undefined),
      newValue: params.newValue || (params.newData ? JSON.stringify(params.newData) : undefined),
      notes: params.notes,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'LOCAL'
    };

    try {
      await roomDb.put('audit_logs', item, false);
      this.notify(item);
    } catch (err) {
      console.warn('[AuditService] Failed to persist audit log entry:', err);
    }

    return item;
  }

  /**
   * Retrieves and filters audit logs from the Room database
   */
  public async getLogs(filter?: AuditLogFilter): Promise<AuditLogItem[]> {
    const list = await roomDb.getAll<AuditLogItem>('audit_logs');
    
    // Sort descending (most recent first)
    let filtered = list.sort((a, b) => b.timestamp - a.timestamp);

    if (!filter) return filtered;

    if (filter.startDate) {
      filtered = filtered.filter(l => l.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      filtered = filtered.filter(l => l.timestamp <= filter.endDate!);
    }
    if (filter.severity && filter.severity !== 'ALL') {
      filtered = filtered.filter(l => l.severity === filter.severity);
    }
    if (filter.recordType && filter.recordType !== 'ALL') {
      filtered = filtered.filter(l => l.recordType.toLowerCase() === filter.recordType!.toLowerCase());
    }
    if (filter.user && filter.user !== 'ALL') {
      filtered = filtered.filter(l => l.user.toLowerCase().includes(filter.user!.toLowerCase()));
    }
    if (filter.action && filter.action !== 'ALL') {
      filtered = filtered.filter(l => l.action.toLowerCase() === filter.action!.toLowerCase());
    }
    if (filter.searchTerm && filter.searchTerm.trim()) {
      const q = filter.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(l => 
        l.action.toLowerCase().includes(q) ||
        l.user.toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.recordId || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q)
      );
    }

    if (filter.limit && filter.limit > 0) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Generates CSV string for exporting audit records
   */
  public generateCSV(logs: AuditLogItem[]): string {
    return this.exportLogsToCsv(logs);
  }

  public exportLogsToCsv(logs: AuditLogItem[]): string {
    const headers = [
      'Timestamp',
      'Date',
      'User',
      'Role',
      'Action',
      'RecordType',
      'RecordId',
      'Severity',
      'Description',
      'Notes'
    ];

    const rows = logs.map(l => {
      return [
        l.timestamp,
        `"${new Date(l.timestamp).toISOString()}"`,
        `"${(l.user || '').replace(/"/g, '""')}"`,
        `"${(l.role || '').replace(/"/g, '""')}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${(l.recordType || '').replace(/"/g, '""')}"`,
        `"${(l.recordId || '').replace(/"/g, '""')}"`,
        `"${l.severity || 'INFO'}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const auditService = new AuditService();
