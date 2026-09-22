import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  ArrowLeft, 
  TrendingUp, 
  Tag, 
  History, 
  X, 
  CheckCircle,
  BarChart3,
  RotateCcw,
  ArrowDownRight,
  ArrowUpRight,
  ShoppingBag,
  Truck,
  FileText
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Product, StockMovement, StockMovementType } from '../types';
import { formatINR, rupeesToPaise, paiseToRupees } from '../services/currency';
import { recordStockMovement } from '../services/inventoryService';

interface InventoryScreenProps {
  onBack: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New product form
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('School Bags');
  const [size, setSize] = useState('');
  const [colour, setColour] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('100');
  const [wholesaleRate, setWholesaleRate] = useState('140');
  const [openingStock, setOpeningStock] = useState('50');
  const [minimumStock, setMinimumStock] = useState('10');

  // Stock Movement Form
  const [movementType, setMovementType] = useState<StockMovementType>('PURCHASE');
  const [movementQty, setMovementQty] = useState('');
  const [movementRef, setMovementRef] = useState('');
  const [movementNotes, setMovementNotes] = useState('');

  const loadInventory = async () => {
    const prods = await roomDb.getAll<Product>('products');
    const moves = await roomDb.getAll<StockMovement>('stock_movements');
    setProducts(prods);
    setMovements(moves.sort((a, b) => b.date - a.date));
  };

  useEffect(() => {
    loadInventory();
    const unsub = roomDb.subscribe((table) => {
      if (table === 'products' || table === 'stock_movements') {
        loadInventory();
      }
    });
    return () => unsub();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const pRatePaise = rupeesToPaise(parseFloat(purchaseRate) || 0);
    const wRatePaise = rupeesToPaise(parseFloat(wholesaleRate) || 0);
    const initStock = parseInt(openingStock) || 0;
    const minStock = parseInt(minimumStock) || 10;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      productCode: productCode.trim().toUpperCase() || `BAG-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim().toUpperCase(),
      category,
      size: size.trim() || undefined,
      colour: colour.trim() || undefined,
      purchaseRatePaise: pRatePaise,
      wholesaleRatePaise: wRatePaise,
      saleRatePaise: wRatePaise,
      mrpPaise: Math.round(wRatePaise * 1.5),
      gstPercentage: 0,
      hsn: '4202',
      openingStock: initStock,
      currentStock: initStock,
      minimumStock: minStock,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('products', newProd);

    if (initStock > 0) {
      await roomDb.put('stock_movements', {
        id: `move-init-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        productId: newProd.id,
        productName: newProd.name,
        date: Date.now(),
        type: 'PURCHASE',
        quantityChange: initStock,
        previousStock: 0,
        newStock: initStock,
        referenceDocumentNumber: 'OPENING-STOCK',
        notes: 'Initial Opening Stock Entry',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    setShowAddModal(false);
    setName('');
    setProductCode('');
    setSize('');
    setColour('');
    setPurchaseRate('100');
    setWholesaleRate('140');
    setOpeningStock('50');
    setMinimumStock('10');
    await loadInventory();
  };

  const handleApplyStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(movementQty) || 0;
    if (qty <= 0) return;

    await recordStockMovement({
      productId: selectedProduct.id,
      type: movementType,
      quantity: qty,
      referenceDocumentNumber: movementRef.trim() || undefined,
      notes: movementNotes.trim() || undefined
    });

    setShowAdjustModal(false);
    setSelectedProduct(null);
    setMovementQty('');
    setMovementRef('');
    setMovementNotes('');
    await loadInventory();
  };

  // Preset Spec Test: Opening 100 -> Sale 12 (88) -> Purchase 50 (138) -> Sales Return 2 (140) -> Purchase Return 10 (130)
  const handleLoadPhase5SpecTest = async () => {
    const testProdId = 'prod-spec-hypora-test';
    
    // Clear old test product and movements
    await roomDb.delete('products', testProdId);
    const existingMoves = await roomDb.getAll<StockMovement>('stock_movements');
    for (const m of existingMoves.filter(m => m.productId === testProdId)) {
      await roomDb.delete('stock_movements', m.id);
    }

    const t0 = Date.now() - 3600000 * 4;
    const testProd: Product = {
      id: testProdId,
      businessId: 'biz-original-modi-bags',
      productCode: 'HYPORA-TEST',
      name: 'HYPORA PREMIUM BAG (PHASE 5 TEST)',
      category: 'School Bags',
      size: '18 Inch',
      colour: 'Navy Blue',
      purchaseRatePaise: rupeesToPaise(90),
      wholesaleRatePaise: rupeesToPaise(120),
      saleRatePaise: rupeesToPaise(120),
      mrpPaise: rupeesToPaise(180),
      gstPercentage: 0,
      hsn: '4202',
      openingStock: 100,
      currentStock: 130, // End of spec test
      minimumStock: 15,
      createdAt: t0,
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    await roomDb.put('products', testProd);

    // 1. Initial Opening 100
    await roomDb.put('stock_movements', {
      id: 'move-spec-1-open',
      businessId: 'biz-original-modi-bags',
      productId: testProdId,
      productName: testProd.name,
      date: t0,
      type: 'PURCHASE',
      quantityChange: 100,
      previousStock: 0,
      newStock: 100,
      referenceDocumentNumber: 'OPEN-100',
      notes: 'Initial Opening Stock of 100 pcs',
      createdAt: t0,
      updatedAt: t0,
      syncStatus: 'LOCAL'
    });

    // 2. Sale 12 -> 88
    const t1 = t0 + 3600000;
    await roomDb.put('stock_movements', {
      id: 'move-spec-2-sale',
      businessId: 'biz-original-modi-bags',
      productId: testProdId,
      productName: testProd.name,
      date: t1,
      type: 'SALE',
      quantityChange: -12,
      previousStock: 100,
      newStock: 88,
      referenceDocumentNumber: 'BILL-101',
      notes: 'Sale to Wholesale Party (12 pcs)',
      createdAt: t1,
      updatedAt: t1,
      syncStatus: 'LOCAL'
    });

    // 3. Purchase 50 -> 138
    const t2 = t1 + 3600000;
    await roomDb.put('stock_movements', {
      id: 'move-spec-3-purchase',
      businessId: 'biz-original-modi-bags',
      productId: testProdId,
      productName: testProd.name,
      date: t2,
      type: 'PURCHASE',
      quantityChange: 50,
      previousStock: 88,
      newStock: 138,
      referenceDocumentNumber: 'PUR-201',
      notes: 'Fresh Factory Inward Batch (50 pcs)',
      createdAt: t2,
      updatedAt: t2,
      syncStatus: 'LOCAL'
    });

    // 4. Sales Return 2 -> 140
    const t3 = t2 + 1800000;
    await roomDb.put('stock_movements', {
      id: 'move-spec-4-salesreturn',
      businessId: 'biz-original-modi-bags',
      productId: testProdId,
      productName: testProd.name,
      date: t3,
      type: 'SALES_RETURN',
      quantityChange: 2,
      previousStock: 138,
      newStock: 140,
      referenceDocumentNumber: 'RET-301',
      notes: 'Customer Returned 2 pcs (Stitch Inspection)',
      createdAt: t3,
      updatedAt: t3,
      syncStatus: 'LOCAL'
    });

    // 5. Purchase Return 10 -> 130
    const t4 = t3 + 1800000;
    await roomDb.put('stock_movements', {
      id: 'move-spec-5-purchasereturn',
      businessId: 'biz-original-modi-bags',
      productId: testProdId,
      productName: testProd.name,
      date: t4,
      type: 'PURCHASE_RETURN',
      quantityChange: -10,
      previousStock: 140,
      newStock: 130,
      referenceDocumentNumber: 'PRET-401',
      notes: 'Returned 10 pcs to Fabric Vendor / Stitching Unit',
      createdAt: t4,
      updatedAt: t4,
      syncStatus: 'LOCAL'
    });

    await loadInventory();
    setSelectedProduct(testProd);
    setShowHistoryModal(true);
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filtered = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.colour && p.colour.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLowStock = showLowStockOnly ? p.currentStock <= p.minimumStock : true;
    const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;

    return matchesSearch && matchesLowStock && matchesCategory;
  });

  const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.purchaseRatePaise), 0);
  const totalStockPieces = products.reduce((sum, p) => sum + p.currentStock, 0);
  const lowStockCount = products.filter(p => p.currentStock <= p.minimumStock).length;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-[#1C1C24] border border-[#2D2D3B] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white hover:bg-[#2F2F40]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Wholesale Bag Inventory & Stock Movements
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • Physical Stock Counts, Purchasing, Returns & Immutable Audit
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 5 Test Preset Button */}
          <button
            onClick={handleLoadPhase5SpecTest}
            className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-orange-300 border border-orange-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            title="Load Spec: Op 100 -> Sale 12 (88) -> Purchase 50 (138) -> Sales Return 2 (140) -> Purchase Return 10 (130)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load Phase 5 Test</span>
          </button>

          <button
            onClick={() => {
              setSelectedProduct(null);
              setShowHistoryModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white border border-[#3A3A4C] text-xs font-semibold flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5 text-sky-400" />
            <span>All Stock Movements ({movements.length})</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Bag</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Total Stock Inventory</span>
          <div className="text-lg font-bold text-white font-mono mt-1">
            {totalStockPieces} PCS
          </div>
          <span className="text-[10px] text-gray-500">{products.length} Bag Varieties Cataloged</span>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Inventory Valuation (Cost)</span>
          <div className="text-lg font-bold text-orange-400 font-mono mt-1">
            {formatINR(totalStockValue)}
          </div>
          <span className="text-[10px] text-gray-500">Based on purchase cost</span>
        </div>

        <div 
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            showLowStockOnly 
              ? 'bg-yellow-950/30 border-yellow-500' 
              : 'bg-[#1A1A22] border-[#2B2B38] hover:border-yellow-500/50'
          }`}
        >
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span>Low Stock Alert</span>
          </span>
          <div className="text-lg font-bold text-yellow-400 font-mono mt-1">
            {lowStockCount} Bags
          </div>
          <span className="text-[10px] text-gray-500">Click to filter alerts</span>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1A22] border border-[#2B2B38]">
          <span className="text-xs text-gray-400">Stock Movements Log</span>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {movements.length} Events
          </div>
          <span className="text-[10px] text-gray-500">Full audit trail maintained</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bag name, bag code (e.g. HYPORA, CLUB), colour..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-gray-400">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#121217] border border-[#2D2D3D] rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="ALL">All Categories ({products.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-8 text-center text-gray-500 text-xs">
            No products found matching filters.
          </div>
        ) : (
          filtered.map((p) => {
            const isLowStock = p.currentStock <= p.minimumStock;
            return (
              <div 
                key={p.id}
                className={`bg-[#1A1A22] border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                  isLowStock ? 'border-yellow-900/60 bg-yellow-950/10' : 'border-[#2B2B38] hover:border-[#38384C]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-orange-400">
                      {p.productCode}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isLowStock 
                        ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/40' 
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                    }`}>
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white mt-1">
                    {p.name}
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Category: {p.category} {p.size ? `• Size: ${p.size}` : ''} {p.colour ? `• Color: ${p.colour}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#141419] border border-[#23232E] text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Wholesale Rate</span>
                    <span className="font-bold text-white">₹{paiseToRupees(p.wholesaleRatePaise)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Purchase Cost</span>
                    <span className="text-gray-400">₹{paiseToRupees(p.purchaseRatePaise)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#262633]">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Current Stock</span>
                    <span className={`text-base font-bold font-mono ${isLowStock ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {p.currentStock} PCS
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedProduct(p);
                        setShowHistoryModal(true);
                      }}
                      className="p-1.5 rounded-xl bg-[#282836] hover:bg-[#343446] text-sky-300 text-xs transition-all"
                      title="View Product Stock History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProduct(p);
                        setShowAdjustModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 text-black text-xs font-bold hover:bg-orange-400 transition-all"
                    >
                      Stock Movement
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RECORD STOCK MOVEMENT MODAL */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Record Stock Movement
                </h3>
                <p className="text-xs text-orange-400 font-semibold mt-0.5">
                  {selectedProduct.name} ({selectedProduct.productCode})
                </p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyStockMovement} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141419] border border-[#272733] flex justify-between">
                <span className="text-gray-400">Current Stock:</span>
                <span className="font-mono font-bold text-white text-sm">{selectedProduct.currentStock} PCS</span>
              </div>

              <div>
                <label className="block text-gray-300 mb-1.5 font-semibold">Movement Type *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['PURCHASE', 'SALE', 'SALES_RETURN', 'PURCHASE_RETURN', 'DAMAGE', 'MANUAL_ADJUSTMENT'] as StockMovementType[]).map((t) => {
                    const isSelected = movementType === t;
                    const isPositive = t === 'PURCHASE' || t === 'SALES_RETURN';
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMovementType(t)}
                        className={`p-2 rounded-xl text-center font-bold text-[10px] transition-all ${
                          isSelected
                            ? isPositive 
                              ? 'bg-emerald-500 text-black shadow-md' 
                              : 'bg-rose-500 text-white shadow-md'
                            : 'bg-[#252533] text-gray-300 hover:bg-[#303042]'
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-semibold">Quantity (Pieces) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Bill / Challan / Invoice Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. PUR-201, BILL-101, RET-301"
                  value={movementRef}
                  onChange={(e) => setMovementRef(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Notes / Particulars</label>
                <input
                  type="text"
                  placeholder="e.g. Factory inward lot / Returned from party"
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {movementQty && (
                <div className="p-2.5 rounded-xl bg-[#141419] border border-[#2B2B38] text-xs flex justify-between">
                  <span className="text-gray-400">Projected New Stock:</span>
                  <span className="font-mono font-bold text-white">
                    {movementType === 'PURCHASE' || movementType === 'SALES_RETURN'
                      ? selectedProduct.currentStock + (parseInt(movementQty) || 0)
                      : Math.max(0, selectedProduct.currentStock - (parseInt(movementQty) || 0))} PCS
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 shadow-md"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3A]">
              <h3 className="text-sm font-bold text-white">Add New Bag to Catalog</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Bag Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HYPORA, CLUB, SCHOOLBOY"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Bag Code / SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. HYP-01"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="School Bags">School Bags</option>
                    <option value="College Backpacks">College Backpacks</option>
                    <option value="Office & Laptop Bags">Office & Laptop Bags</option>
                    <option value="Duffle & Travel Bags">Duffle & Travel Bags</option>
                    <option value="Tiffin & Lunch Bags">Tiffin & Lunch Bags</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Size / Dimension</label>
                  <input
                    type="text"
                    placeholder="e.g. 18 Inch, 2 Compartments"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Colour / Finish</label>
                  <input
                    type="text"
                    placeholder="e.g. Black / Blue / Red"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Wholesale Rate (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={wholesaleRate}
                    onChange={(e) => setWholesaleRate(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 mb-1">Opening Stock (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Minimum Alert Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2C2C3A]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#252533] text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 shadow-md"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK MOVEMENTS AUDIT MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#2C2C3A] flex items-center justify-between bg-[#15151D]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-orange-400" />
                  <span>
                    {selectedProduct 
                      ? `Stock Movement History: ${selectedProduct.name}`
                      : 'Complete Stock Movement Audit Log'}
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Every change generates an immutable StockMovement entry with previous and new stock.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedProduct(null);
                }} 
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {(() => {
                const list = selectedProduct 
                  ? movements.filter(m => m.productId === selectedProduct.id)
                  : movements;

                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500 text-xs">
                      No stock movements recorded yet.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                        <tr>
                          <th className="p-2.5">Date & Time</th>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Ref / Notes</th>
                          <th className="p-2.5 text-center">Previous</th>
                          <th className="p-2.5 text-center">Change</th>
                          <th className="p-2.5 text-right">New Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B2B38]">
                        {list.map((m) => (
                          <tr key={m.id} className="hover:bg-[#232330]">
                            <td className="p-2.5 text-gray-400 font-mono text-[11px]">
                              {new Date(m.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short'
                              })}{' '}
                              {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5 font-bold text-white max-w-[160px] truncate">
                              {m.productName}
                            </td>
                            <td className="p-2.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                m.type === 'PURCHASE' || m.type === 'SALES_RETURN'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              }`}>
                                {m.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-400 text-[11px] max-w-[200px] truncate">
                              {m.referenceDocumentNumber ? `#${m.referenceDocumentNumber}` : ''}
                              {m.notes ? ` • ${m.notes}` : ''}
                            </td>
                            <td className="p-2.5 text-center font-mono text-gray-400">
                              {m.previousStock}
                            </td>
                            <td className={`p-2.5 text-center font-mono font-bold ${
                              m.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-white">
                              {m.newStock} pcs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
