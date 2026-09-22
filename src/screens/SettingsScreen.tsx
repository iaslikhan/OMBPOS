import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  ArrowLeft, 
  Building2, 
  Phone, 
  MapPin, 
  Save, 
  CheckCircle,
  Printer,
  Sliders,
  QrCode,
  ExternalLink
} from 'lucide-react';
import { MasterPrintSettings, BusinessProfile } from '../types';
import { roomDb } from '../db/indexedDbRoom';
import { DEFAULT_BUSINESS_PROFILE, DEFAULT_MASTER_PRINT_SETTINGS } from '../db/seedData';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigatePrinting?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onNavigatePrinting }) => {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [printSettings, setPrintSettings] = useState<MasterPrintSettings>(DEFAULT_MASTER_PRINT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const p = await roomDb.get<BusinessProfile>('business_profile', DEFAULT_BUSINESS_PROFILE.id);
      if (p) setProfile(p);
      const s = await roomDb.get<MasterPrintSettings>('print_settings', DEFAULT_MASTER_PRINT_SETTINGS.id);
      if (s) setPrintSettings(s);
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await roomDb.put('business_profile', {
      ...profile,
      updatedAt: Date.now()
    });
    await roomDb.put('print_settings', {
      ...printSettings,
      businessName: profile.name,
      address: profile.address,
      phone: profile.phone,
      gstin: profile.gstin,
      updatedAt: Date.now()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
              <SettingsIcon className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Business & Print Preferences
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Profile, Hardware & Digital Invoicing Settings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigatePrinting && (
            <button
              onClick={onNavigatePrinting}
              className="px-3.5 py-1.5 rounded-xl bg-[#252535] hover:bg-[#2F2F44] text-orange-400 border border-[#3A3A50] text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Printer Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {saved && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>Settings Saved</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* Business Profile */}
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-3.5 shadow-md">
          <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider pb-2 border-b border-[#2C2C3A] flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span>Registered Business Profile</span>
          </h3>

          <div>
            <label className="block text-gray-300 mb-1">Company / Firm Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-1">Wholesale Market Address</label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 mb-1">Contact Phone</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-1">Base Currency</label>
              <input
                type="text"
                readOnly
                value="INR ₹ (Rupees / Paise)"
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-orange-400 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 mb-1">GSTIN</label>
              <input
                type="text"
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-1">Default Bag HSN</label>
              <input
                type="text"
                value={profile.defaultHsn || '4202'}
                onChange={(e) => setProfile({ ...profile, defaultHsn: e.target.value })}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Master Print & Invoice Settings */}
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-3.5 shadow-md">
          <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider pb-2 border-b border-[#2C2C3A] flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            <span>Master Print & UPI Settings</span>
          </h3>

          <div>
            <label className="block text-gray-300 mb-1">Default Slip Paper Format</label>
            <select
              value={printSettings.defaultPaperSize}
              onChange={(e) => setPrintSettings({ ...printSettings, defaultPaperSize: e.target.value as any })}
              className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 font-semibold"
            >
              <option value="80MM">80mm Thermal Slip (Recommended standard)</option>
              <option value="58MM">58mm Portable Bluetooth Slip</option>
              <option value="A5">A5 Half Sheet Voucher</option>
              <option value="A4">A4 Full Tax Invoice</option>
            </select>
          </div>

          <div className="p-3 bg-[#121217] rounded-xl border border-[#2D2D3D] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={printSettings.enableUpiQrCode}
                onChange={(e) => setPrintSettings({ ...printSettings, enableUpiQrCode: e.target.checked })}
                className="rounded text-orange-500 focus:ring-0 w-4 h-4"
              />
              <span className="font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-orange-400" />
                Enable Dynamic UPI QR Code on Receipts
              </span>
            </label>

            {printSettings.enableUpiQrCode && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-gray-400 text-[11px] mb-1">Merchant UPI VPA ID</label>
                  <input
                    type="text"
                    value={printSettings.upiVpa}
                    onChange={(e) => setPrintSettings({ ...printSettings, upiVpa: e.target.value })}
                    className="w-full bg-[#191922] border border-[#353548] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-[11px] mb-1">Payee Display Name</label>
                  <input
                    type="text"
                    value={printSettings.upiPayeeName}
                    onChange={(e) => setPrintSettings({ ...printSettings, upiPayeeName: e.target.value })}
                    className="w-full bg-[#191922] border border-[#353548] rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 mb-1">Bottom Line Feeds</label>
              <input
                type="number"
                min="1"
                max="10"
                value={printSettings.feedLines}
                onChange={(e) => setPrintSettings({ ...printSettings, feedLines: Number(e.target.value) })}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printSettings.autoCutPaper}
                  onChange={(e) => setPrintSettings({ ...printSettings, autoCutPaper: e.target.checked })}
                  className="rounded text-orange-500 focus:ring-0 w-4 h-4"
                />
                <span className="font-semibold text-white">Auto Cut Paper</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-1">Footer Terms & Conditions</label>
            <input
              type="text"
              value={printSettings.footerTerms1}
              onChange={(e) => setPrintSettings({ ...printSettings, footerTerms1: e.target.value })}
              className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Business & Print Settings</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
