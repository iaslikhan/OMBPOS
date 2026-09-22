import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  KeyRound, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface SecurityScreenProps {
  onBack: () => void;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ onBack }) => {
  const [appPin, setAppPin] = useState('1234');
  const [requirePinOnLaunch, setRequirePinOnLaunch] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Security & Access Control
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • PIN Protection & Staff Authorization
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-6 space-y-4 text-xs max-w-xl">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#2C2C3A]">
          Counter Lock PIN
        </h3>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141419] border border-[#23232E]">
            <div>
              <span className="text-white font-bold block">Require 4-Digit PIN to Access Reports & Settings</span>
              <span className="text-gray-400 text-[11px]">Prevents counter boys from accessing owner reports</span>
            </div>
            <input
              type="checkbox"
              checked={requirePinOnLaunch}
              onChange={(e) => setRequirePinOnLaunch(e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-1">Master Owner PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={appPin}
                onChange={(e) => setAppPin(e.target.value)}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm tracking-widest focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 shadow-md"
            >
              Update Security PIN
            </button>
          </div>

          {saved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>PIN preferences updated successfully!</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
