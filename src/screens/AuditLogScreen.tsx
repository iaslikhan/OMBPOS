import React, { useState, useEffect } from 'react';
import { 
  History, 
  ArrowLeft, 
  Search, 
  ShieldCheck, 
  Clock, 
  FileText,
  User
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { AuditLog } from '../types';

interface AuditLogScreenProps {
  onBack: () => void;
}

export const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    const list = await roomDb.getAll<AuditLog>('audit_logs');
    setLogs(list.sort((a, b) => b.timestamp - a.timestamp));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                System Audit & Security Logs
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Immutable Local Audit Trail of Transactions & Actions
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search audit action, user or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1A1A22] border border-[#2B2B38] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Audit Records ({logs.length})
        </h3>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No audit records found matching search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Staff / User</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Details</th>
                  <th className="p-2.5 text-center">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2B2B38]">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-[#232330]">
                    <td className="p-2.5 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleDateString()} {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-2.5 font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-orange-400" />
                      <span>{l.user}</span>
                    </td>
                    <td className="p-2.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-300 font-medium">
                      {l.notes}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="text-[10px] font-mono text-emerald-400">
                        ROOM_LOCAL
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
