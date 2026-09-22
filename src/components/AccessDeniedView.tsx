import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ArrowLeft, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { securityService } from '../services/securityService';
import { StaffPermissions } from '../types';

interface AccessDeniedViewProps {
  requiredPermission?: keyof StaffPermissions;
  screenName: string;
  onBack: () => void;
  onOverrideSuccess?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  requiredPermission,
  screenName,
  onBack,
  onOverrideSuccess
}) => {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const activeStaff = securityService.getActiveStaff();

  const handleAuthorizeOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overridePin.trim()) return;

    setIsVerifying(true);
    setOverrideError(null);

    try {
      const authorized = await securityService.verifyAdminOverride(
        overridePin.trim(), 
        `Access to restricted screen: ${screenName}`
      );

      if (authorized) {
        setShowOverrideModal(false);
        setOverridePin('');
        if (onOverrideSuccess) {
          onOverrideSuccess();
        } else {
          onBack();
        }
      } else {
        setOverrideError('Incorrect Supervisor or Admin PIN.');
      }
    } catch (err: any) {
      setOverrideError(err?.message || 'Verification error.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            id="btn-access-denied-back"
            onClick={onBack} 
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Restricted Access
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Role-Based Access Control Enforcement
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#181820] border border-[#2D2D3E] rounded-3xl p-8 max-w-xl mx-auto text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-950/30">
          <Lock className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          Access Denied
        </h3>

        <p className="text-sm text-gray-300 mb-6 max-w-md">
          Staff member <span className="font-bold text-orange-400">{activeStaff?.name || 'Current User'}</span> ({activeStaff?.roleName || activeStaff?.role}) does not have permission to view <span className="font-semibold text-white">{screenName}</span>.
        </p>

        {requiredPermission && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#22222E] border border-[#313143] text-xs text-gray-400 mb-6 font-mono">
            <span className="text-gray-500">Required:</span>
            <span className="text-orange-300 font-semibold">{requiredPermission}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            id="btn-return-dashboard"
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#242433] hover:bg-[#2C2C3D] text-gray-200 text-xs font-bold border border-[#36364D] transition-colors"
          >
            Return to Dashboard
          </button>

          <button
            id="btn-admin-override-prompt"
            onClick={() => setShowOverrideModal(true)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-4 h-4" />
            <span>Supervisor / Admin Override</span>
          </button>
        </div>
      </div>

      {/* Admin Override PIN Dialog */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#1A1A24] border border-[#2F2F42] rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-5 h-5 text-orange-400" />
              <h4 className="text-sm font-bold">Admin Authorization</h4>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Enter Owner (Mukesh Modi) or Supervisor Master PIN to authorize one-time access to {screenName}.
            </p>

            <form onSubmit={handleAuthorizeOverride} className="space-y-4">
              <div>
                <input
                  id="input-override-pin"
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-digit Master PIN"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  autoFocus
                  className="w-full bg-[#121218] border border-[#303043] rounded-xl px-3 py-2.5 text-center text-white font-mono font-bold tracking-widest text-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              {overrideError && (
                <div className="p-2 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#242433] text-gray-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-override"
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
