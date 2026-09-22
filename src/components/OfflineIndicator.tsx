import React from 'react';
import { WifiOff, Database, CheckCircle2 } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  onSimulateToggle: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  onSimulateToggle,
}) => {
  if (isOnline) return null;

  return (
    <div
      id="banner-offline-mode"
      className="bg-amber-950/80 border-b border-amber-600/50 px-4 py-2 text-amber-200 text-xs shadow-inner"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
          <span className="font-semibold text-white">Offline Mode Active:</span>
          <span>Room Database is the active source of truth. All sales, customers, and inventory save safely locally.</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:flex items-center gap-1 text-[11px] text-amber-300">
            <Database className="w-3.5 h-3.5" /> IndexedDB Persistent
          </span>
          <button
            id="btn-offline-banner-restore"
            onClick={onSimulateToggle}
            className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[11px] hover:bg-amber-400 active:scale-95 transition-all"
          >
            Switch to Online Mode
          </button>
        </div>
      </div>
    </div>
  );
};
