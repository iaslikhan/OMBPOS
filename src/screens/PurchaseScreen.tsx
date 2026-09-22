import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Truck, 
  CheckCircle, 
  Receipt,
  Building2,
  DollarSign,
  CreditCard,
  History,
  FileText,
  Tag,
  Printer
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Supplier, Product, Purchase, PurchaseItem, PaymentMethod } from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { processAtomicPurchase } from '../services/purchaseService';
import { PurchaseLabelModal } from '../components/PurchaseLabelModal';
import { PurchaseLabelItem } from '../services/purchaseLabelService';

interface PurchaseScreenProps {
  onBack: () => void;
}

export const PurchaseScreen: React.FC<PurchaseScreenProps> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [transport, setTransport] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
  // Current Item input
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [rate, setRate] = useState(100);

  const [paidAmount, setPaidAmount] = useState('0');
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedPurchase, setLastSavedPurchase] = useState<Purchase | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Purchase Label Modal State
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelModalItems, setLabelModalItems] = useState<PurchaseLabelItem[]>([]);
  const [labelModalTitle, setLabelModalTitle] = useState('Purchase & Inward Goods Labels');
  const [isReprintLabel, setIsReprintLabel] = useState(false);

  const initData = async () => {
    const s = await roomDb.getAll<Supplier>('suppliers');
    const p = await roomDb.getAll<Product>('products');
    const pur = await roomDb.getAll<Purchase>('purchases');
    setSuppliers(s);
    setProducts(p);
    setPurchases(pur.sort((a, b) => b.date - a.date));
    if (s.length > 0 && !selectedSupplierId) setSelectedSupplierId(s[0].id);
    if (p.length > 0 && !productId) {
      setProductId(p[0].id);
      setProductName(p[0].name);
      setRate(paiseToRupees(p[0].purchaseRatePaise));
    }
  };

  useEffect(() => {
    initData();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'purchases' || table === 'suppliers' || table === 'products') {
        initData();
      }
    });
    return () => unsub();
  }, []);

  const handleProductSelect = (id: string) => {
    setProductId(id);
    const p = products.find(prod => prod.id === id);
    if (p) {
      setProductName(p.name);
      setRate(paiseToRupees(p.purchaseRatePaise));
    }
  };

  const handleAddItem = () => {
    if (!productName || quantity <= 0 || rate <= 0) return;
    const ratePaise = rupeesToPaise(rate);
    const totalPaise = quantity * ratePaise;

    setItems([...items, {
      id: `pitem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      purchaseId: '',
      productId: productId || 'custom-item',
      productName,
      quantity,
      purchaseRatePaise: ratePaise,
      totalPaise
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotalPaise = items.reduce((sum, i) => sum + i.totalPaise, 0);
  const paidPaise = rupeesToPaise(parseFloat(paidAmount) || 0);
  const creditPaise = Math.max(0, grandTotalPaise - paidPaise);

  const handleSavePurchase = async () => {
    if (items.length === 0 || !selectedSupplierId) return;

    try {
      const result = await processAtomicPurchase({
        supplierId: selectedSupplierId,
        purchaseInvoiceNumber: invoiceNumber.trim() || `PUR-${Date.now().toString().slice(-4)}`,
        items,
        paymentMethod,
        paidPaise,
        transport: transport.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setLastSavedPurchase(result.purchase);
      setIsSaved(true);
      setItems([]);
      setPaidAmount('0');
      setInvoiceNumber('');
      setNotes('');
      await initData();
    } catch (err: any) {
      alert(`Purchase save error: ${err.message}`);
    }
  };

  const openLabelModalForPurchase = (p: Purchase, reprint: boolean = false) => {
    const labelItems: PurchaseLabelItem[] = (p.items || []).map((it) => ({
      id: it.id,
      productName: it.productName,
      purchaseRateRupees: paiseToRupees(it.purchaseRatePaise),
      quantity: it.quantity,
      supplierName: p.supplierName,
      invoiceNumber: p.purchaseInvoiceNumber,
      date: p.date
    }));

    if (labelItems.length === 0) {
      labelItems.push({
        productName: 'INWARD ITEM',
        purchaseRateRupees: paiseToRupees(Math.round(p.grandTotalPaise / (p.totalQuantity || 1))),
        quantity: p.totalQuantity || 1,
        supplierName: p.supplierName,
        invoiceNumber: p.purchaseInvoiceNumber,
        date: p.date
      });
    }

    setLabelModalItems(labelItems);
    setLabelModalTitle(`Purchase Labels • Inv #${p.purchaseInvoiceNumber}`);
    setIsReprintLabel(reprint);
    setIsLabelModalOpen(true);
  };

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
              <ShoppingBag className="w-5 h-5 text-sky-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Purchase & Inward Goods Entry
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Atomic Inventory, Supplier Ledger, Cash Drawer & Audit Sync
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3.5 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white border border-[#3A3A4C] text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <History className="w-3.5 h-3.5 text-sky-400" />
          <span>{showHistory ? 'New Purchase Form' : `Purchase History (${purchases.length})`}</span>
        </button>
      </div>

      {showHistory ? (
        <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            <span>Recorded Inward Purchase Invoices</span>
          </h3>

          {purchases.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              No purchase invoices recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-center">Items</th>
                    <th className="p-2.5 text-right">Grand Total</th>
                    <th className="p-2.5 text-right">Paid</th>
                    <th className="p-2.5 text-right">Credit Due</th>
                    <th className="p-2.5 text-center">Mode</th>
                    <th className="p-2.5 text-center">Labels (Phase 10)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2B38]">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-[#232330]">
                      <td className="p-2.5 font-mono text-[11px] text-gray-400">
                        {new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="p-2.5 font-bold font-mono text-sky-400">
                        {p.purchaseInvoiceNumber}
                      </td>
                      <td className="p-2.5 font-bold text-white">
                        {p.supplierName}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {p.totalQuantity} pcs
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-white">
                        {formatINR(p.grandTotalPaise)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                        {formatINR(p.paidPaise)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-rose-400 font-bold">
                        {formatINR(p.creditPaise)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#272738] text-gray-300">
                          {p.paymentMethod || 'CASH'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => openLabelModalForPurchase(p, true)}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 mx-auto"
                        >
                          <Tag className="w-3 h-3" />
                          <span>Reprint Labels</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : isSaved && lastSavedPurchase ? (
        <div className="bg-[#1A1A22] border border-sky-500/40 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center mx-auto text-sky-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Purchase Invoice #{lastSavedPurchase.purchaseInvoiceNumber} Saved!
            </h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
              Atomic updates completed: {lastSavedPurchase.totalQuantity} pcs added to inventory, StockMovement logged, Supplier ledger credited, and drawer updated appropriately.
            </p>
          </div>

          <div className="max-w-md mx-auto p-3 rounded-xl bg-[#141419] border border-[#2B2B38] text-xs grid grid-cols-3 gap-2">
            <div>
              <span className="text-gray-500 block">Total Inward</span>
              <span className="font-bold text-white">{formatINR(lastSavedPurchase.grandTotalPaise)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Paid ({lastSavedPurchase.paymentMethod})</span>
              <span className="font-bold text-emerald-400">{formatINR(lastSavedPurchase.paidPaise)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Credit Payable</span>
              <span className="font-bold text-rose-400">{formatINR(lastSavedPurchase.creditPaise)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => openLabelModalForPurchase(lastSavedPurchase, false)}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <Tag className="w-4 h-4" />
              <span>Print Purchase Labels (786)</span>
            </button>

            <button
              onClick={() => setIsSaved(false)}
              className="px-5 py-2.5 rounded-xl bg-[#282838] hover:bg-[#343448] text-gray-200 text-xs font-bold border border-[#3A3A4C]"
            >
              Create Another Inward Purchase
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Supplier & Invoice */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Select Bag / Fabric Supplier *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Outstanding: {formatINR(s.currentOutstandingPaise)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Supplier Invoice / Challan # *</label>
                  <input
                    type="text"
                    placeholder="e.g. BENGAL-504, PUR-902"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Transport / Vehicle Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Kolkata Central Cargo / Van WB-04-1234"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Notes / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Inward lot of school bags and backpacks"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Inward Line Item Input */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Add Bag Model to Inward Lot
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="col-span-2">
                  <label className="block text-gray-400 mb-1">Catalog Bag Model</label>
                  <select
                    value={productId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Current Stock: {p.currentStock} pcs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Quantity Received</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="col-span-full">
                  <button
                    onClick={handleAddItem}
                    className="w-full py-2.5 rounded-xl bg-sky-500 text-black font-bold text-xs hover:bg-sky-400 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item to Purchase Invoice</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inward Items Table */}
            <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Inward Items Lot ({items.length})
              </h3>
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No inward items added yet. Select a bag model above and click Add.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Rate</th>
                        <th className="p-2.5 text-right">Total</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B38]">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#232330]">
                          <td className="p-2.5 font-bold text-white">{it.productName}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-sky-400">{it.quantity}</td>
                          <td className="p-2.5 text-right font-mono">₹{paiseToRupees(it.purchaseRatePaise)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">₹{paiseToRupees(it.totalPaise)}</td>
                          <td className="p-2.5 text-center">
                            <button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-rose-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#2C2C3A]">
              Atomic Inward Settlement
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-300">
                <span>Total Received Pieces</span>
                <span className="font-mono font-bold text-white">{totalQuantity} PCS</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Invoice Grand Total</span>
                <span className="font-mono font-bold text-sky-400 text-sm">{formatINR(grandTotalPaise)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2D3D] space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Payment Method</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['CASH', 'UPI', 'BANK', 'CREDIT'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 px-2.5 rounded-xl text-center font-bold text-xs transition-all ${
                        paymentMethod === m
                          ? 'bg-sky-500 text-black shadow-md'
                          : 'bg-[#15151D] text-gray-300 hover:bg-[#252533]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {paymentMethod !== 'CASH' && (
                  <p className="text-[11px] text-sky-400 mt-1.5 flex items-center gap-1">
                    <span>ℹ️ Non-cash method: Drawer physical cash is NOT deducted.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Paid Now Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#141419] border border-[#272733] flex justify-between">
                <span className="text-gray-400">Supplier Credit Liability:</span>
                <span className="font-mono font-bold text-rose-400">{formatINR(creditPaise)}</span>
              </div>

              <button
                disabled={items.length === 0}
                onClick={handleSavePurchase}
                className="w-full py-3 rounded-xl bg-sky-500 text-black font-bold text-sm hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Atomic Purchase</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Purchase Label Modal (Phase 10) */}
      <PurchaseLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        items={labelModalItems}
        defaultTitle={labelModalTitle}
        isReprint={isReprintLabel}
      />
    </div>
  );
};
