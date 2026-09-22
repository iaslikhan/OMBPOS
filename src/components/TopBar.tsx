import React from 'react';
import { Menu, Wifi, WifiOff, RefreshCw, Phone, MapPin, Lock, UserCheck } from 'lucide-react';
import { SyncState } from '../services/firebaseFoundation';
import { Staff } from '../types';

interface TopBarProps {
  onToggleDrawer: () => void;
  isOnline: boolean;
  syncState: SyncState;
  onSimulateNetworkToggle: () => void;
  onTriggerSync: () => void;
  activeStaff?: Staff | null;
  onLockTerminal?: () => void;
  onSwitchStaff?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleDrawer,
  isOnline,
  syncState,
  onSimulateNetworkToggle,
  onTriggerSync,
  activeStaff,
  onLockTerminal,
  onSwitchStaff,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#16161A] border-b border-[#2A2A35] px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Drawer Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            id="btn-nav-drawer-toggle"
            onClick={onToggleDrawer}
            aria-label="Open Navigation Drawer"
            className="p-2 rounded-lg bg-[#22222B] text-gray-200 hover:text-white hover:bg-[#2D2D3A] active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <Menu className="w-5 h-5 text-orange-400" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide uppercase">
                Original Modi Bags
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                WHOLESALE POS
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none">
                <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                3, Amartalla Lane, Kolkata-700001
              </span>
              <span className="hidden md:flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-500 shrink-0" />
                8240584877
              </span>
            </div>
          </div>
        </div>

        {/* Right: Network & Sync Status Controls */}
        <div className="flex items-center gap-2">
          {/* Network Mode Status Pill & Simulator */}
          <button
            id="btn-network-toggle"
            onClick={onSimulateNetworkToggle}
            title={isOnline ? "Network is Online (Click to test Offline Mode)" : "Network is Offline (Click to restore Online Mode)"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/60'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Offline (Local Room)</span>
              </>
            )}
          </button>

          {/* Sync Status Button */}
          <button
            id="btn-sync-trigger"
            onClick={onTriggerSync}
            disabled={syncState.isSyncing}
            title="Room Database Source of Truth / Firebase Sync"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#22222B] text-gray-300 hover:text-white hover:bg-[#2D2D3A] border border-[#333342] text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-orange-400 ${syncState.isSyncing ? 'animate-spin' : ''}`}
            />
            <span className="hidden md:inline">
              {syncState.isSyncing ? 'Syncing...' : 'Sync'}
            </span>
            {syncState.pendingSyncCount > 0 && (
              <span className="bg-orange-500 text-black font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                {syncState.pendingSyncCount}
              </span>
            )}
          </button>

          {/* Active Staff User Chip & Quick Lock */}
          {activeStaff && (
            <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-[#2E2E3D]">
              <button
                id="btn-active-staff-switch"
                onClick={onSwitchStaff}
                title="Click to Switch Staff"
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#202029] hover:bg-[#282835] border border-[#313142] text-xs text-gray-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold hidden sm:inline max-w-[110px] truncate">
                  {activeStaff.name}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#2C2C3C] text-orange-400">
                  {activeStaff.role}
                </span>
              </button>

              <button
                id="btn-quick-lock-terminal"
                onClick={onLockTerminal}
                title="Lock Terminal (Secures POS Counter)"
                className="p-1.5 rounded-lg bg-[#202029] hover:bg-[#2C2C3D] text-gray-400 hover:text-orange-400 border border-[#313142] transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
