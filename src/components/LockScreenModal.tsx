import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  KeyRound, 
  Fingerprint, 
  ShieldAlert, 
  CheckCircle2, 
  Delete, 
  UserCheck, 
  Store,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { securityService } from '../services/securityService';
import { Staff } from '../types';

interface LockScreenModalProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({ isOpen, onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [remainingLockout, setRemainingLockout] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      loadStaff();
    }
  }, [isOpen]);

  const loadStaff = async () => {
    const list = await securityService.getAllStaff();
    setAllStaff(list.filter(s => s.active));
    const active = securityService.getActiveStaff();
    if (active) {
      setSelectedStaffId(active.id);
    } else if (list.length > 0) {
      setSelectedStaffId(list[0].id);
    }
  };

  // Lockout countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isOpen) {
      interval = setInterval(() => {
        const secs = securityService.getLockoutRemainingSeconds();
        setRemainingLockout(secs);
        if (secs === 0 && error?.includes('Too many failed')) {
          setError(null);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, error]);

  // Handle keyboard typing on physical keyboards
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          handleDigitPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          handleVerifyPin(pin);
        }
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, selectedStaffId]);

  const handleDigitPress = (digit: string) => {
    if (remainingLockout > 0) return;
    setError(null);
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Fast verify on 4 digits
        handleVerifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  const handleVerifyPin = async (pinToTest: string) => {
    if (isAuthenticating || remainingLockout > 0) return;
    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await securityService.unlockWithPin(pinToTest, selectedStaffId || undefined);
      if (result.success) {
        setPin('');
        onUnlocked();
      } else {
        setError(result.error || 'Incorrect PIN entered.');
        setPin('');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
      setPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (isAuthenticating || remainingLockout > 0) return;
    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await securityService.unlockWithBiometric(selectedStaffId || undefined);
      if (result.success) {
        setPin('');
        onUnlocked();
      } else {
        setError(result.error || 'Biometric authentication failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric scan could not complete.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isOpen) return null;

  const currentSelectedStaff = allStaff.find(s => s.id === selectedStaffId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="lock-screen-modal"
        className="relative w-full max-w-md bg-[#181820] border border-[#2D2D3E] rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center text-white"
      >
        {/* Header Branding */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Store className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
            Original Modi Bags
          </span>
        </div>

        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#242432] border border-[#36364A] text-orange-400 mb-2 shadow-inner">
          <Lock className="w-6 h-6" />
        </div>

        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Terminal Locked
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          Enter 4-digit security PIN or scan fingerprint to resume counter POS
        </p>

        {/* Staff Switcher Pills */}
        <div className="w-full flex items-center justify-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {allStaff.map(st => {
            const isSelected = st.id === selectedStaffId;
            return (
              <button
                key={st.id}
                id={`btn-staff-pick-${st.id}`}
                onClick={() => {
                  setSelectedStaffId(st.id);
                  setPin('');
                  setError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm'
                    : 'bg-[#22222D] border-[#313142] text-gray-400 hover:text-gray-200 hover:bg-[#282836]'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-orange-400' : 'bg-gray-500'}`} />
                <span>{st.name}</span>
                <span className="text-[10px] opacity-70">({st.role})</span>
              </button>
            );
          })}
        </div>

        {/* Active Staff Info Banner */}
        {currentSelectedStaff && (
          <div className="w-full bg-[#1F1F2A] border border-[#2F2F40] rounded-xl px-3 py-2 mb-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-gray-200">{currentSelectedStaff.name}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#292938] text-gray-300 border border-[#3E3E52]">
              {currentSelectedStaff.roleName || currentSelectedStaff.role}
            </span>
          </div>
        )}

        {/* PIN Dots Indicator */}
        <div className="flex items-center justify-center gap-3 my-2">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  filled 
                    ? 'bg-orange-500 scale-110 shadow-sm shadow-orange-500/50' 
                    : 'bg-[#282838] border border-[#3E3E55]'
                }`}
              />
            );
          })}
        </div>

        {/* Error / Alert Display */}
        {error && (
          <div className="w-full mt-3 p-2.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center justify-center gap-1.5 animate-shake">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-center">{error}</span>
          </div>
        )}

        {remainingLockout > 0 && (
          <div className="w-full mt-2 p-2 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs text-center font-mono">
            Cooldown remaining: {remainingLockout}s
          </div>
        )}

        {/* Numeric Keypad for Fast Touch POS Entry */}
        <div className="w-full grid grid-cols-3 gap-2.5 mt-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              id={`keypad-${num}`}
              onClick={() => handleDigitPress(num)}
              disabled={remainingLockout > 0}
              className="h-12 sm:h-14 rounded-2xl bg-[#22222E] hover:bg-[#2A2A3B] active:scale-95 text-white font-mono text-lg sm:text-xl font-bold border border-[#313143] transition-all flex items-center justify-center disabled:opacity-30"
            >
              {num}
            </button>
          ))}

          {/* Clear Key */}
          <button
            id="keypad-clear"
            onClick={handleClear}
            className="h-12 sm:h-14 rounded-2xl bg-[#22222E] hover:bg-[#2A2A3B] active:scale-95 text-gray-400 hover:text-white font-bold text-xs border border-[#313143] transition-all flex items-center justify-center uppercase tracking-wider"
          >
            Clear
          </button>

          {/* 0 Key */}
          <button
            id="keypad-0"
            onClick={() => handleDigitPress('0')}
            disabled={remainingLockout > 0}
            className="h-12 sm:h-14 rounded-2xl bg-[#22222E] hover:bg-[#2A2A3B] active:scale-95 text-white font-mono text-lg sm:text-xl font-bold border border-[#313143] transition-all flex items-center justify-center disabled:opacity-30"
          >
            0
          </button>

          {/* Backspace Key */}
          <button
            id="keypad-backspace"
            onClick={handleBackspace}
            className="h-12 sm:h-14 rounded-2xl bg-[#22222E] hover:bg-[#2A2A3B] active:scale-95 text-gray-400 hover:text-white border border-[#313143] transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Biometric Button */}
        <div className="w-full mt-4 pt-4 border-t border-[#292938]">
          <button
            id="btn-biometric-unlock"
            onClick={handleBiometricAuth}
            disabled={remainingLockout > 0}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all active:scale-98 disabled:opacity-40"
          >
            <Fingerprint className="w-4 h-4 text-orange-400" />
            <span>Unlock with Fingerprint / Biometrics</span>
          </button>
        </div>

        <div className="mt-3 text-[11px] text-gray-500">
          Default Master PIN: <span className="font-mono text-gray-400">1234</span> (Admin Mukesh Modi)
        </div>
      </div>
    </div>
  );
};
