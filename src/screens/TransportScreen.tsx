import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Phone, 
  ArrowLeft, 
  MapPin, 
  X,
  Star,
  MessageCircle,
  Building,
  Navigation,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { TransportRecord } from '../types';

interface TransportScreenProps {
  onBack: () => void;
}

export const TransportScreen: React.FC<TransportScreenProps> = ({ onBack }) => {
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransport, setEditingTransport] = useState<TransportRecord | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [branch, setBranch] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [godownAddress, setGodownAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  const loadTransports = async () => {
    // Both 'transport' and 'transports' tables exist in schema; we load primarily from 'transport'
    // and sync across any existing records
    let list = await roomDb.getAll<TransportRecord>('transport');
    if (list.length === 0) {
      // Also check 'transports' table fallback
      const fallback = await roomDb.getAll<any>('transports');
      if (fallback.length > 0) {
        list = fallback.map(f => ({
          id: f.id,
          businessId: f.businessId || 'biz-original-modi-bags',
          name: f.name,
          destination: (f.destinationRoutes && f.destinationRoutes[0]) || f.destination || 'Bengal & Bihar',
          destinationRoutes: f.destinationRoutes || [f.destination || 'Bengal & Bihar'],
          branch: f.branch || 'Burrabazar / Posta',
          contactPerson: f.contactPerson || '',
          phone: f.phone || '9830556677',
          address: f.address || f.godownAddress || 'Burrabazar, Kolkata',
          godownAddress: f.godownAddress || f.address || 'Burrabazar, Kolkata',
          isFavorite: f.isFavorite ?? true,
          createdAt: f.createdAt || Date.now(),
          updatedAt: f.updatedAt || Date.now(),
          syncStatus: 'LOCAL'
        }));
        // Store into 'transport'
        for (const item of list) {
          await roomDb.put('transport', item, false);
        }
      }
    }
    setTransports(list);
  };

  useEffect(() => {
    loadTransports();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'transport' || table === 'transports') {
        loadTransports();
      }
    });
    return () => unsub();
  }, []);

  // Compute unique destination list for filtering
  const allDestinations = useMemo(() => {
    const set = new Set<string>();
    transports.forEach(t => {
      if (t.destination) {
        t.destination.split(/[,/]/).forEach(d => {
          const trimmed = d.trim();
          if (trimmed) set.add(trimmed);
        });
      }
      if (t.destinationRoutes) {
        t.destinationRoutes.forEach(r => {
          if (r.trim()) set.add(r.trim());
        });
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [transports]);

  const handleToggleFavorite = async (t: TransportRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: TransportRecord = {
      ...t,
      isFavorite: !t.isFavorite,
      updatedAt: Date.now()
    };
    await roomDb.put('transport', updated);
    loadTransports();
  };

  const handleOpenAddModal = (existing?: TransportRecord) => {
    if (existing) {
      setEditingTransport(existing);
      setName(existing.name);
      setDestination(existing.destination || (existing.destinationRoutes && existing.destinationRoutes.join(', ')) || '');
      setBranch(existing.branch || '');
      setContactPerson(existing.contactPerson || '');
      setPhone(existing.phone || '');
      setAlternatePhone(existing.alternatePhone || '');
      setAddress(existing.address || existing.godownAddress || '');
      setGodownAddress(existing.godownAddress || existing.address || '');
      setNotes(existing.notes || '');
      setIsFavorite(existing.isFavorite ?? false);
    } else {
      setEditingTransport(null);
      setName('');
      setDestination('');
      setBranch('Burrabazar Branch');
      setContactPerson('');
      setPhone('');
      setAlternatePhone('');
      setAddress('15, Pollock Street, Kolkata-700001');
      setGodownAddress('Posta Transport Hub');
      setNotes('');
      setIsFavorite(false);
    }
    setShowAddModal(true);
  };

  const handleSaveTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const routes = destination.split(/[,/]/).map(s => s.trim()).filter(Boolean);

    const record: TransportRecord = {
      id: editingTransport ? editingTransport.id : `trans-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      name: name.trim().toUpperCase(),
      destination: destination.trim(),
      destinationRoutes: routes.length > 0 ? routes : [destination.trim()],
      branch: branch.trim() || 'Burrabazar Branch',
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      address: address.trim(),
      godownAddress: godownAddress.trim() || address.trim(),
      notes: notes.trim() || undefined,
      isFavorite,
      createdAt: editingTransport ? editingTransport.createdAt : Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('transport', record);
    setShowAddModal(false);
    setEditingTransport(null);
    loadTransports();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this transport line from directory?')) {
      await roomDb.delete('transport', id);
      loadTransports();
    }
  };

  // Filtering
  const filtered = transports.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.phone.includes(searchTerm) ||
      (t.destination && t.destination.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.contactPerson && t.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.destinationRoutes && t.destinationRoutes.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesDestination = selectedDestination === 'ALL' || 
      (t.destination && t.destination.toLowerCase().includes(selectedDestination.toLowerCase())) ||
      (t.destinationRoutes && t.destinationRoutes.some(r => r.toLowerCase().includes(selectedDestination.toLowerCase())));

    const matchesFavorite = !showFavoritesOnly || Boolean(t.isFavorite);

    return matchesSearch && matchesDestination && matchesFavorite;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Transport & Cargo Directory
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Burrabazar & Amartalla Lane Logistics Lines & Booking Godowns
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="px-3.5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md active:scale-98 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transport</span>
        </button>
      </div>

      {/* Destination Pill Filters & Favorites Toggle */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transport name, phone, contact or route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121217] border border-[#2B2B38] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto ${
              showFavoritesOnly 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                : 'bg-[#141419] text-gray-400 border border-[#2B2B38] hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Favourites Only</span>
          </button>
        </div>

        {/* Destination Pills */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
            Destination Filtering:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {allDestinations.map((dest) => (
              <button
                key={dest}
                onClick={() => setSelectedDestination(dest)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                  selectedDestination === dest
                    ? 'bg-orange-500 text-black font-bold shadow-md'
                    : 'bg-[#22222E] text-gray-300 hover:bg-[#2C2C3A]'
                }`}
              >
                {dest === 'ALL' ? 'All Destinations' : dest}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-8 text-center text-gray-500 text-xs">
          No transports found matching the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map(t => (
            <div 
              key={t.id} 
              className={`bg-[#1A1A22] border rounded-2xl p-4 space-y-3 transition-all ${
                t.isFavorite ? 'border-amber-500/40 shadow-sm' : 'border-[#2B2B38]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{t.name}</h3>
                    {t.branch && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252533] text-gray-300">
                        {t.branch}
                      </span>
                    )}
                  </div>
                  {t.contactPerson && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Contact: <span className="text-gray-200 font-medium">{t.contactPerson}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleFavorite(t, e)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 transition-colors"
                    title={t.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                  >
                    <Star className={`w-4 h-4 ${t.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleOpenAddModal(t)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-sky-400 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Destination Routes */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Delivery Routes & Destinations
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(t.destinationRoutes || [t.destination]).map((r, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-[#252533] text-orange-300 font-medium border border-[#373748]">
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Godown Address */}
              <div className="text-xs text-gray-400 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                <span>{t.godownAddress || t.address || 'Burrabazar / Posta Godown, Kolkata'}</span>
              </div>

              {/* Action Buttons: CALL & WHATSAPP */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#282836]">
                <a
                  href={`tel:${t.phone}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#252533] hover:bg-[#303042] text-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call {t.phone}</span>
                </a>

                <a
                  href={`https://wa.me/91${t.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                    `Namaskar ${t.name}, this is Original Modi Bags regarding bag parcel transport dispatch.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Transport Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-400" />
                <span>{editingTransport ? 'Edit Transport Company' : 'Add Transport Company'}</span>
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransport} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Transport / Cargo Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KOLKATA CENTRAL CARGO SERVICE"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Destinations / Delivery Routes * (comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Siliguri, North Bengal, Guwahati, Malda"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Manoj Sharma"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Local Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Canning St Branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1 font-semibold">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9830556677"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. 033-22345678"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Booking Office / Godown Address</label>
                <input
                  type="text"
                  placeholder="e.g. 15, Pollock Street, Canning St, Kolkata-700001"
                  value={godownAddress}
                  onChange={(e) => setGodownAddress(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-fav"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="rounded bg-[#121217] border-[#2D2D3D] text-orange-500 focus:ring-0"
                />
                <label htmlFor="chk-fav" className="text-gray-300 select-none cursor-pointer">
                  Mark as Preferred / Favourite Transport Line
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-3.5 py-2 rounded-xl bg-[#252533] text-gray-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold shadow-md"
                >
                  {editingTransport ? 'Update Transport' : 'Save Transport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
