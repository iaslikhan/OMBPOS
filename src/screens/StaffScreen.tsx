import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Plus, 
  Phone, 
  ArrowLeft, 
  UserCheck, 
  X 
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Staff } from '../types';

interface StaffScreenProps {
  onBack: () => void;
}

export const StaffScreen: React.FC<StaffScreenProps> = ({ onBack }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'SALES' | 'INVENTORY_STAFF'>('SALES');
  const [phone, setPhone] = useState('');

  const loadStaff = async () => {
    const list = await roomDb.getAll<Staff>('staff');
    if (list.length === 0) {
      // Seed default staff
      const initStaff: Staff[] = [
        {
          id: 'staff-1',
          businessId: 'biz-original-modi-bags',
          name: 'Mukesh Modi',
          role: 'ADMIN',
          roleType: 'ADMIN',
          roleId: 'role-admin',
          pin: '1234',
          phone: '8240584877',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        },
        {
          id: 'staff-2',
          businessId: 'biz-original-modi-bags',
          name: 'Ramu (Counter Sales)',
          role: 'SALES',
          roleType: 'BILLING',
          roleId: 'role-billing',
          pin: '2222',
          phone: '9830112233',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        }
      ];
      for (const s of initStaff) await roomDb.put('staff', s);
      setStaffList(initStaff);
    } else {
      setStaffList(list);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newStaff: Staff = {
      id: `staff-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      name: name.trim(),
      role,
      roleType: role === 'ADMIN' ? 'ADMIN' : role === 'MANAGER' ? 'MANAGER' : role === 'INVENTORY_STAFF' ? 'INVENTORY' : 'BILLING',
      roleId: role === 'ADMIN' ? 'role-admin' : role === 'MANAGER' ? 'role-manager' : role === 'INVENTORY_STAFF' ? 'role-inventory' : 'role-billing',
      pin: '2222',
      phone: phone.trim() || '8240584877',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('staff', newStaff);
    setShowAddModal(false);
    setName('');
    setPhone('');
    loadStaff();
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
              <UserCheck className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Shop Staff & Roles
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Counter Sales & Store Staff Management
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {staffList.map(s => (
          <div key={s.id} className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{s.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {s.role}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Phone: {s.phone} • Status: {s.active ? 'Active on Duty' : 'Inactive'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Add Staff Member</h3>
            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ADMIN">Owner / Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="SALES">Counter Billing Staff</option>
                  <option value="INVENTORY_STAFF">Godown / Packing Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Mobile</label>
                <input
                  type="tel"
                  placeholder="10 digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold">
                  Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
