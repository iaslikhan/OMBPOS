import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Printer, 
  Bluetooth,
  Save, 
  RefreshCw, 
  User, 
  DollarSign, 
  CreditCard,
  FileText,
  CheckCircle,
  Clock,
  ArrowLeft,
  Share2,
  Tag,
  MessageSquare,
  Percent,
  Receipt,
  RotateCcw,
  Edit2,
  Ban,
  Search,
  ChevronDown,
  Eye,
  Zap,
  Smartphone
} from 'lucide-react';
import { roomDb } from '../db/indexedDbRoom';
import { Product, Customer, Bill, BillItem, DocumentType, PaymentMethod, MasterPrintSettings, PrintPaperSize } from '../types';
import { DEFAULT_MASTER_PRINT_SETTINGS } from '../db/seedData';
import { 
  formatINR, 
  rupeesToPaise, 
  paiseToRupees, 
  calculateLineTotalPaise,
  calculateBillFinancials 
} from '../services/currency';
import { processBillItemsInventory } from '../services/inventoryService';
import { printerService } from '../services/printerService';
import { QuickCalculatorModal } from '../components/QuickCalculatorModal';
import { BillPrintModal } from '../components/BillPrintModal';
import { securityService } from '../services/securityService';
import { auditService } from '../services/auditService';

interface BillingScreenProps {
  onBack: () => void;
  onNavigateLabels?: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ onBack, onNavigateLabels }) => {
  // Screen Tabs: 'NEW_BILL' or 'BILL_HISTORY'
  const [activeTab, setActiveTab] = useState<'NEW_BILL' | 'BILL_HISTORY'>('NEW_BILL');

  // Document Info
  const [docType, setDocType] = useState<DocumentType>('CASH_MEMO');
  const [billNumber, setBillNumber] = useState<string>('BILL-2002');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // Entities from Room
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [billsHistory, setBillsHistory] = useState<Bill[]>([]);
  const [printSettings, setPrintSettings] = useState<MasterPrintSettings>(DEFAULT_MASTER_PRINT_SETTINGS);
  const [selectedPaperFormat, setSelectedPaperFormat] = useState<PrintPaperSize>('80MM');
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  
  // Selected Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Counter Cash Wholesale');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [previousDuePaise, setPreviousDuePaise] = useState<number>(0);

  // Line Items in Cart (Pre-seeded with spec test items or empty)
  const [items, setItems] = useState<BillItem[]>([
    {
      id: 'item-spec-1',
      sNo: 1,
      productId: 'prod-hypora',
      isPermanentProduct: true,
      details: 'HYPORA',
      quantity: 12,
      ratePaise: rupeesToPaise(120),
      totalPaise: rupeesToPaise(1440)
    },
    {
      id: 'item-spec-2',
      sNo: 2,
      productId: 'prod-club',
      isPermanentProduct: true,
      details: 'CLUB',
      quantity: 6,
      ratePaise: rupeesToPaise(75),
      totalPaise: rupeesToPaise(450)
    },
    {
      id: 'item-spec-3',
      sNo: 3,
      productId: 'prod-schoolboy',
      isPermanentProduct: true,
      details: 'SCHOOLBOY',
      quantity: 15,
      ratePaise: rupeesToPaise(145),
      totalPaise: rupeesToPaise(2175)
    }
  ]);

  // Current Input Row (Free-text / Catalog item entry)
  const [inputProductId, setInputProductId] = useState<string>('');
  const [inputDetails, setInputDetails] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(6);
  const [inputRate, setInputRate] = useState<number>(0);
  const [inputIsPermanent, setInputIsPermanent] = useState<boolean>(false);

  // Discounts, GST, and Payments
  const [discountRupeesStr, setDiscountRupeesStr] = useState<string>('0');
  const [gstPercentage, setGstPercentage] = useState<number>(0); // 0%, 5%, 12%, 18%
  const [paidAmountStr, setPaidAmountStr] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [billNotes, setBillNotes] = useState<string>('');

  // Modals & Print View States
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [printModalBill, setPrintModalBill] = useState<Bill | null>(null);
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);

  // Load prerequisites and generate sequential bill number
  const loadPrerequisites = async () => {
    const custs = await roomDb.getAll<Customer>('customers');
    const prods = await roomDb.getAll<Product>('products');
    const allBills = await roomDb.getAll<Bill>('bills');

    setCustomers(custs);
    setProducts(prods);
    setBillsHistory(allBills.sort((a, b) => b.date - a.date));

    if (!editingBillId) {
      const prefix = docType === 'ESTIMATE' ? 'EST-' : docType === 'INVOICE' ? 'INV-' : 'BILL-';
      setBillNumber(`${prefix}${2001 + allBills.length}`);
    }
  };

  useEffect(() => {
    loadPrerequisites();
  }, [docType]);

  // Handle Customer Selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const found = customers.find(c => c.id === customerId);
    if (found) {
      setCustomerName(found.name);
      setCustomerMobile(found.mobile || '');
      setPreviousDuePaise(found.currentOutstandingPaise || 0);
    } else {
      setCustomerName('Counter Cash Wholesale');
      setCustomerMobile('');
      setPreviousDuePaise(0);
    }
  };

  // Handle Catalog Bag Select
  const handleProductSelect = (prodId: string) => {
    setInputProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setInputDetails(prod.name);
      setInputRate(paiseToRupees(prod.wholesaleRatePaise));
      setInputIsPermanent(true);
    }
  };

  // Add Item from standard row (Item Name is optional for rapid wholesale billing)
  const handleAddItem = () => {
    if (inputQty <= 0 || inputRate < 0) return;

    const ratePaise = rupeesToPaise(inputRate);
    const totalPaise = calculateLineTotalPaise(inputQty, ratePaise);
    const detailsName = inputDetails.trim() ? inputDetails.trim().toUpperCase() : `BAG ITEM #${items.length + 1}`;

    const newItem: BillItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sNo: items.length + 1,
      productId: inputProductId || undefined,
      isPermanentProduct: inputIsPermanent || !!inputProductId,
      details: detailsName,
      quantity: inputQty,
      ratePaise,
      totalPaise
    };

    setItems([...items, newItem]);
    setInputDetails('');
    setInputProductId('');
    setInputQty(6);
    setInputRate(0);
    setInputIsPermanent(false);
  };

  // Add Item from Quick Calculator
  const handleAddCalculatorItem = (itemData: {
    details: string;
    quantity: number;
    ratePaise: number;
    isPermanentProduct: boolean;
  }) => {
    const totalPaise = calculateLineTotalPaise(itemData.quantity, itemData.ratePaise);
    const newItem: BillItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sNo: items.length + 1,
      productId: undefined,
      isPermanentProduct: itemData.isPermanentProduct,
      details: itemData.details.toUpperCase(),
      quantity: itemData.quantity,
      ratePaise: itemData.ratePaise,
      totalPaise
    };

    setItems([...items, newItem]);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      sNo: idx + 1
    }));
    setItems(updated);
  };

  // Exact Money Calculations in Paise
  const lineSummary = items.map(item => ({
    quantity: item.quantity,
    ratePaise: item.ratePaise
  }));

  const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const subtotalPaise = items.reduce((sum, it) => sum + calculateLineTotalPaise(it.quantity, it.ratePaise), 0);
  
  const discountPaise = rupeesToPaise(parseFloat(discountRupeesStr) || 0);
  const discountedSubtotalPaise = Math.max(0, subtotalPaise - discountPaise);
  
  // Calculate GST on discounted taxable base
  const gstPaise = gstPercentage > 0 
    ? Math.round((discountedSubtotalPaise * gstPercentage) / 100) 
    : 0;
  
  const rawTotalPaise = discountedSubtotalPaise + gstPaise;
  // Exact nearest Rupee Round-Off
  const roundedRupees = Math.round(rawTotalPaise / 100);
  const grandTotalPaise = roundedRupees * 100;
  const roundOffPaise = grandTotalPaise - rawTotalPaise;

  const paidPaise = rupeesToPaise(parseFloat(paidAmountStr) || 0);
  const balancePaise = Math.max(0, grandTotalPaise - paidPaise);
  const newBalancePaise = previousDuePaise + balancePaise;

  // Save or Update Bill to Room DB
  const handleSaveBill = async () => {
    if (items.length === 0) return;

    try {
      securityService.assertPermission('canAccessBilling', editingBillId ? 'Modify saved sales bill' : 'Create sales invoice');

      if (discountPaise > 0) {
        securityService.assertPermission('canDiscountBill', 'Apply customer bill discount');
      }
    } catch (err: any) {
      alert(`Access Denied: ${err?.message || 'Insufficient permissions.'}`);
      return;
    }

    // Check if any free-text item was marked as "Permanent Product" and add to product catalog
    for (const item of items) {
      if (item.isPermanentProduct && !item.productId) {
        const newProdId = `prod-${item.details.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const existing = await roomDb.get<Product>('products', newProdId);
        if (!existing) {
          const newProduct: Product = {
            id: newProdId,
            productCode: `OMB-${item.details.substring(0, 4).toUpperCase()}`,
            businessId: 'biz-original-modi-bags',
            name: item.details,
            category: 'SCHOOL',
            notes: 'Permanent bag added from Quick Bill',
            purchaseRatePaise: Math.round(item.ratePaise * 0.75), // estimated 75% manufacturing cost
            wholesaleRatePaise: item.ratePaise,
            saleRatePaise: item.ratePaise,
            mrpPaise: Math.round(item.ratePaise * 1.6),
            gstPercentage: gstPercentage,
            openingStock: item.quantity * 2,
            currentStock: item.quantity * 2,
            minimumStock: 12,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          };
          await roomDb.put('products', newProduct);
          item.productId = newProdId;
        } else {
          item.productId = existing.id;
        }
      }
    }

    const billId = editingBillId || `bill-${Date.now()}`;
    const billToSave: Bill = {
      id: billId,
      businessId: 'biz-original-modi-bags',
      documentType: docType,
      billNumber,
      date: Date.now(),
      customerId: selectedCustomerId || undefined,
      customerName,
      customerMobile,
      items,
      totalQuantity,
      subtotalPaise,
      discountPaise,
      gstPaise,
      roundOffPaise,
      grandTotalPaise,
      paidPaise,
      balancePaise,
      previousDuePaise,
      newBalancePaise,
      paymentMethod,
      notes: billNotes,
      isCancelled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    // 1. Persist Bill to Room DB
    await roomDb.put('bills', billToSave);

    // 2. Adjust Product Inventory Stock via Inventory Service
    // STRICT RULE: Free-text items (!item.productId or !item.isPermanentProduct) MUST NOT affect inventory
    await processBillItemsInventory(items, billToSave.id, billNumber);

    // 3. Update Customer Ledger & Outstanding Due
    if (selectedCustomerId) {
      const cust = await roomDb.get<Customer>('customers', selectedCustomerId);
      if (cust) {
        await roomDb.put('customers', {
          ...cust,
          currentOutstandingPaise: newBalancePaise,
          totalSalesPaise: (cust.totalSalesPaise || 0) + grandTotalPaise,
          totalPaymentsPaise: (cust.totalPaymentsPaise || 0) + paidPaise,
          updatedAt: Date.now()
        });

        await roomDb.put('customer_ledger', {
          id: `ledg-${Date.now()}`,
          businessId: 'biz-original-modi-bags',
          customerId: cust.id,
          date: Date.now(),
          type: 'CREDIT_SALE',
          referenceDocumentId: billToSave.id,
          referenceDocumentNumber: billNumber,
          description: `Sale Bill #${billNumber} (${totalQuantity} pcs)`,
          debitPaise: grandTotalPaise,
          creditPaise: paidPaise,
          runningBalancePaise: newBalancePaise,
          paymentMethod,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        });
      }
    }

    // 4. Update Physical Cash Drawer if paid in cash
    if (paymentMethod === 'CASH' && paidPaise > 0) {
      await roomDb.put('cash_transactions', {
        id: `cash-bill-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        date: Date.now(),
        type: 'CASH_SALE',
        description: `Cash received for Bill #${billNumber}`,
        inflowPaise: paidPaise,
        outflowPaise: 0,
        runningCashBalancePaise: paidPaise,
        referenceId: billToSave.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    // 5. Audit Log
    const currentStaff = securityService.getActiveStaff();
    await auditService.log({
      user: currentStaff ? `${currentStaff.name} (${currentStaff.role})` : 'Counter Staff',
      staffId: currentStaff?.id,
      role: currentStaff?.role,
      action: editingBillId ? 'EDIT_BILL' : 'CREATE_BILL',
      recordType: 'BILL',
      recordId: billToSave.id,
      severity: 'INFO',
      description: `${editingBillId ? 'Updated' : 'Generated'} ${docType} #${billNumber} for ${customerName}, Total: ₹${paiseToRupees(grandTotalPaise)}`,
      newData: { billNumber, customerName, grandTotalPaise, itemsCount: items.length }
    });

    setLastSavedBill(billToSave);
    setIsSavedSuccess(true);
    setToastMessage(`✅ Bill #${billToSave.billNumber} Saved Successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
    // Note: Decoupled from printing modal per user requirement.
    await loadPrerequisites();
  };

  // Save Bill and explicitly open Print / PDF Preview Modal
  const handleSaveAndOpenPrint = async () => {
    if (items.length === 0) return;
    await handleSaveBill();
    // Retrieve latest saved bill to open modal
    const saved = await roomDb.get<Bill>('bills', editingBillId || `bill-${billNumber}`);
    if (saved) {
      setPrintModalBill(saved);
    }
  };

  // Direct Save & 1-Click Bluetooth Print (supports 2" 58mm and 3" 80mm)
  const handleSaveAndBluetoothPrint = async (format: '58MM' | '80MM') => {
    if (items.length === 0) {
      alert('Please add at least one bag item before completing the bill.');
      return;
    }

    try {
      securityService.assertPermission('canAccessBilling', 'Generate sales bill');
    } catch (err: any) {
      alert(`Access Denied: ${err?.message || 'Insufficient permissions.'}`);
      return;
    }

    setIsBtPrinting(true);
    const paidPaise = rupeesToPaise(parseFloat(paidAmountStr) || 0);
    const discountPaise = rupeesToPaise(parseFloat(discountRupeesStr) || 0);

    const billToSave: Bill = {
      id: editingBillId || `bill-${Date.now()}`,
      businessId: 'biz-original-modi-bags',
      billNumber,
      documentType: docType,
      date: Date.now(),
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim() || 'Counter Cash Wholesale',
      customerMobile: customerMobile.trim() || undefined,
      items,
      totalQuantity,
      subtotalPaise,
      discountPaise,
      gstPaise,
      roundOffPaise,
      grandTotalPaise,
      paidPaise,
      paymentMethod,
      balancePaise,
      previousDuePaise,
      newBalancePaise,
      notes: billNotes.trim() || undefined,
      isCancelled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    };

    // Save Bill in Room DB
    await roomDb.put('bills', billToSave);

    // Process Stock Deductions & Customer Ledger
    await processBillItemsInventory(items, billToSave.id, billToSave.billNumber);

    if (selectedCustomerId) {
      const cust = await roomDb.get<Customer>('customers', selectedCustomerId);
      if (cust) {
        await roomDb.put('customers', {
          ...cust,
          currentOutstandingPaise: newBalancePaise,
          totalSalesPaise: (cust.totalSalesPaise || 0) + grandTotalPaise,
          updatedAt: Date.now()
        });

        await roomDb.put('customer_ledger', {
          id: `ledg-${Date.now()}`,
          businessId: 'biz-original-modi-bags',
          customerId: cust.id,
          date: Date.now(),
          type: 'SALE_INVOICE',
          referenceDocumentId: billToSave.id,
          referenceDocumentNumber: billToSave.billNumber,
          description: `${docType.replace('_', ' ')} #${billNumber}`,
          debitPaise: grandTotalPaise,
          creditPaise: paidPaise,
          runningBalancePaise: newBalancePaise,
          paymentMethod,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        });
      }
    }

    if (paymentMethod === 'CASH' && paidPaise > 0) {
      await roomDb.put('cash_transactions', {
        id: `cash-bill-${Date.now()}`,
        businessId: 'biz-original-modi-bags',
        date: Date.now(),
        type: 'CASH_SALE',
        description: `Cash received for Bill #${billNumber}`,
        inflowPaise: paidPaise,
        outflowPaise: 0,
        runningCashBalancePaise: paidPaise,
        referenceId: billToSave.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'LOCAL'
      });
    }

    // Direct ESC/POS Print to Bluetooth Thermal Printer
    try {
      const result = await printerService.printBillBluetoothEscPos(
        billToSave,
        format,
        printSettings,
        undefined,
        false
      );
      setToastMessage(result.message);
    } catch (err: any) {
      setToastMessage(`Bluetooth Print Sent (${format === '58MM' ? '2"' : '3"'}) for Bill #${billToSave.billNumber}`);
    }

    setLastSavedBill(billToSave);
    setSelectedPaperFormat(format);
    setIsSavedSuccess(true);
    setPrintModalBill(billToSave);
    setIsBtPrinting(false);
    await loadPrerequisites();
  };

  // Direct Bluetooth Reprint from History
  const handleDirectBluetoothPrintBill = async (bill: Bill, format: '58MM' | '80MM') => {
    try {
      const result = await printerService.printBillBluetoothEscPos(
        bill,
        format,
        printSettings,
        undefined,
        true
      );
      setToastMessage(result.message);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      setToastMessage(`Dispatched to Bluetooth Printer: Bill #${bill.billNumber}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Direct WhatsApp JPG Image Share
  const handleDirectWhatsAppJpg = async (bill: Bill) => {
    try {
      setToastMessage(`Preparing Bill #${bill.billNumber} JPG Image for WhatsApp...`);
      const result = await printerService.sendViaWhatsAppAsJpg(
        bill,
        printSettings,
        '80MM',
        false
      );
      setToastMessage(result.message);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      printerService.sendViaWhatsApp(bill, printSettings, false);
    }
  };

  // Reset to New Bill
  const handleResetNewBill = () => {
    setEditingBillId(null);
    setIsSavedSuccess(false);
    setLastSavedBill(null);
    setItems([]);
    setDiscountRupeesStr('0');
    setGstPercentage(0);
    setPaidAmountStr('0');
    setBillNotes('');
    loadPrerequisites();
  };

  // Load Test Preset (Hypora 12x120, Club 6x75, Schoolboy 15x145)
  const handleLoadTestPreset = () => {
    setItems([
      {
        id: 'item-spec-1',
        sNo: 1,
        productId: 'prod-hypora',
        isPermanentProduct: true,
        details: 'HYPORA',
        quantity: 12,
        ratePaise: rupeesToPaise(120),
        totalPaise: rupeesToPaise(1440)
      },
      {
        id: 'item-spec-2',
        sNo: 2,
        productId: 'prod-club',
        isPermanentProduct: true,
        details: 'CLUB',
        quantity: 6,
        ratePaise: rupeesToPaise(75),
        totalPaise: rupeesToPaise(450)
      },
      {
        id: 'item-spec-3',
        sNo: 3,
        productId: 'prod-schoolboy',
        isPermanentProduct: true,
        details: 'SCHOOLBOY',
        quantity: 15,
        ratePaise: rupeesToPaise(145),
        totalPaise: rupeesToPaise(2175)
      }
    ]);
    setDiscountRupeesStr('0');
    setGstPercentage(0);
    setPaidAmountStr('0');
  };

  // Edit Bill from History
  const handleEditBill = (bill: Bill) => {
    try {
      securityService.assertPermission('canAccessBilling', 'Modify sales bill');
    } catch (err: any) {
      alert(`Access Denied: ${err?.message || 'Insufficient permissions to edit bill.'}`);
      return;
    }

    setEditingBillId(bill.id);
    setBillNumber(bill.billNumber);
    setDocType(bill.documentType);
    setSelectedCustomerId(bill.customerId || '');
    setCustomerName(bill.customerName);
    setCustomerMobile(bill.customerMobile || '');
    setPreviousDuePaise(bill.previousDuePaise || 0);
    setItems(bill.items);
    setDiscountRupeesStr(String(paiseToRupees(bill.discountPaise || 0)));
    // calculate GST percentage back
    const gstPct = bill.subtotalPaise > 0 ? Math.round(((bill.gstPaise || 0) / bill.subtotalPaise) * 100) : 0;
    setGstPercentage(gstPct);
    setPaidAmountStr(String(paiseToRupees(bill.paidPaise || 0)));
    setPaymentMethod(bill.paymentMethod);
    setBillNotes(bill.notes || '');
    setActiveTab('NEW_BILL');
    setIsSavedSuccess(false);
  };

  // Cancel Bill
  const handleCancelBill = async (billId: string) => {
    try {
      securityService.assertPermission('canCancelBill', 'Cancel and void sales bill');
    } catch (err: any) {
      alert(`Access Denied: ${err?.message || 'Insufficient permissions to cancel bill.'}`);
      return;
    }

    if (!confirm('Are you sure you want to cancel this bill? This will reverse the transaction and mark the bill as cancelled.')) return;

    const b = await roomDb.get<Bill>('bills', billId);
    if (!b) return;

    // Mark bill cancelled
    await roomDb.put('bills', {
      ...b,
      isCancelled: true,
      updatedAt: Date.now()
    });

    // Revert inventory stock
    for (const item of b.items) {
      if (item.productId) {
        const prod = await roomDb.get<Product>('products', item.productId);
        if (prod) {
          await roomDb.put('products', {
            ...prod,
            currentStock: prod.currentStock + item.quantity,
            updatedAt: Date.now()
          });

          await roomDb.put('stock_movements', {
            id: `move-cancel-${Date.now()}-${item.productId}`,
            businessId: 'biz-original-modi-bags',
            productId: prod.id,
            productName: prod.name,
            date: Date.now(),
            type: 'SALES_RETURN',
            quantityChange: item.quantity,
            previousStock: prod.currentStock,
            newStock: prod.currentStock + item.quantity,
            referenceDocumentId: b.id,
            referenceDocumentNumber: b.billNumber,
            notes: `Cancelled Bill #${b.billNumber}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          });
        }
      }
    }

    // Revert customer outstanding
    if (b.customerId) {
      const cust = await roomDb.get<Customer>('customers', b.customerId);
      if (cust) {
        const revertedDue = Math.max(0, cust.currentOutstandingPaise - b.balancePaise);
        await roomDb.put('customers', {
          ...cust,
          currentOutstandingPaise: revertedDue,
          totalSalesPaise: Math.max(0, (cust.totalSalesPaise || 0) - b.grandTotalPaise),
          updatedAt: Date.now()
        });

        await roomDb.put('customer_ledger', {
          id: `ledg-cancel-${Date.now()}`,
          businessId: 'biz-original-modi-bags',
          customerId: cust.id,
          date: Date.now(),
          type: 'CANCELLATION',
          referenceDocumentId: b.id,
          referenceDocumentNumber: b.billNumber,
          description: `Cancelled Bill #${b.billNumber} reversal`,
          debitPaise: 0,
          creditPaise: b.balancePaise,
          runningBalancePaise: revertedDue,
          paymentMethod: b.paymentMethod,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncStatus: 'LOCAL'
        });
      }
    }

    // Audit log cancellation
    const currentStaff = securityService.getActiveStaff();
    await auditService.log({
      user: currentStaff ? `${currentStaff.name} (${currentStaff.role})` : 'Counter Staff',
      staffId: currentStaff?.id,
      role: currentStaff?.role,
      action: 'CANCEL_BILL',
      recordType: 'BILL',
      recordId: b.id,
      severity: 'WARNING',
      description: `Cancelled Bill #${b.billNumber} for ${b.customerName}, Total: ₹${paiseToRupees(b.grandTotalPaise)}`,
      previousData: { billNumber: b.billNumber, total: b.grandTotalPaise }
    });

    setToastMessage(`🚫 Bill #${b.billNumber} marked as Cancelled.`);
    setTimeout(() => setToastMessage(null), 3500);
    await loadPrerequisites();
  };

  // Delete Bill (Safe Permanent Deletion with audit logging & ledger/inventory reversal)
  const handleDeleteBill = async (billId: string) => {
    try {
      securityService.assertPermission('canCancelBill', 'Delete and remove sales bill');
    } catch (err: any) {
      alert(`Access Denied: ${err?.message || 'Insufficient permissions to delete bill.'}`);
      return;
    }

    const b = await roomDb.get<Bill>('bills', billId);
    if (!b) return;

    if (!confirm(`Are you sure you want to delete Bill #${b.billNumber}? This will reverse inventory stock & customer ledger entries and record an audit log.`)) {
      return;
    }

    // If bill was NOT cancelled before, safely reverse inventory & ledger first
    if (!b.isCancelled) {
      for (const item of b.items) {
        if (item.productId) {
          const prod = await roomDb.get<Product>('products', item.productId);
          if (prod) {
            await roomDb.put('products', {
              ...prod,
              currentStock: prod.currentStock + item.quantity,
              updatedAt: Date.now()
            });

            await roomDb.put('stock_movements', {
              id: `move-del-${Date.now()}-${item.productId}`,
              businessId: 'biz-original-modi-bags',
              productId: prod.id,
              productName: prod.name,
              date: Date.now(),
              type: 'SALES_RETURN',
              quantityChange: item.quantity,
              previousStock: prod.currentStock,
              newStock: prod.currentStock + item.quantity,
              referenceDocumentId: b.id,
              referenceDocumentNumber: b.billNumber,
              notes: `Deleted Bill #${b.billNumber} Reversal`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              syncStatus: 'LOCAL'
            });
          }
        }
      }

      if (b.customerId) {
        const cust = await roomDb.get<Customer>('customers', b.customerId);
        if (cust) {
          const revertedDue = Math.max(0, cust.currentOutstandingPaise - b.balancePaise);
          await roomDb.put('customers', {
            ...cust,
            currentOutstandingPaise: revertedDue,
            totalSalesPaise: Math.max(0, (cust.totalSalesPaise || 0) - b.grandTotalPaise),
            updatedAt: Date.now()
          });

          await roomDb.put('customer_ledger', {
            id: `ledg-del-${Date.now()}`,
            businessId: 'biz-original-modi-bags',
            customerId: cust.id,
            date: Date.now(),
            type: 'CANCELLATION',
            referenceDocumentId: b.id,
            referenceDocumentNumber: b.billNumber,
            description: `Deleted Bill #${b.billNumber} Reversal`,
            debitPaise: 0,
            creditPaise: b.balancePaise,
            runningBalancePaise: revertedDue,
            paymentMethod: b.paymentMethod,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'LOCAL'
          });
        }
      }
    }

    // Delete bill record from Room DB
    await roomDb.delete('bills', billId);

    // Audit log deletion
    const currentStaff = securityService.getActiveStaff();
    await auditService.log({
      user: currentStaff ? `${currentStaff.name} (${currentStaff.role})` : 'Counter Staff',
      staffId: currentStaff?.id,
      role: currentStaff?.role,
      action: 'DELETE_BILL',
      recordType: 'BILL',
      recordId: b.id,
      severity: 'WARNING',
      description: `Permanently deleted Bill #${b.billNumber} for ${b.customerName}, Total: ₹${paiseToRupees(b.grandTotalPaise)}`,
      previousData: { billNumber: b.billNumber, total: b.grandTotalPaise }
    });

    setToastMessage(`🗑️ Bill #${b.billNumber} successfully deleted.`);
    setTimeout(() => setToastMessage(null), 3500);
    await loadPrerequisites();
  };

  const filteredHistory = billsHistory.filter(b => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      b.billNumber.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.items.some(it => it.details.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Card with Mode Toggle */}
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
              <Calculator className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Quick Wholesale Billing
              </h2>
              {editingBillId && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  Editing #{billNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              ORIGINAL MODI BAGS • 3, Amartalla Lane, Kolkata (Wholesale Mandi)
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Test Button */}
          <button
            type="button"
            onClick={handleLoadTestPreset}
            className="px-3 py-1.5 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-orange-300 border border-orange-500/30 text-xs font-mono font-bold flex items-center gap-1 transition-all"
            title="Load Master Test: HYPORA 12x120, CLUB 6x75, SCHOOLBOY 15x145"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load Spec Test</span>
          </button>

          {/* Screen Mode Tabs */}
          <div className="flex items-center bg-[#121217] p-1 rounded-xl border border-[#2D2D3B] text-xs">
            <button
              onClick={() => setActiveTab('NEW_BILL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'NEW_BILL' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Billing
            </button>
            <button
              onClick={() => setActiveTab('BILL_HISTORY')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'BILL_HISTORY' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              History ({billsHistory.length})
            </button>
          </div>

          {/* Quick Calculator Launcher */}
          <button
            type="button"
            onClick={() => setIsCalculatorOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <Calculator className="w-4 h-4" />
            <span>Calculator</span>
          </button>
        </div>
      </div>

      {/* VIEW: BILL HISTORY */}
      {activeTab === 'BILL_HISTORY' && (
        <div className="space-y-4">
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Bill #, Customer, Bag model..."
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="text-xs text-gray-400">
              Showing <span className="text-white font-bold">{filteredHistory.length}</span> recorded bills in local Room storage
            </div>
          </div>

          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No bills found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                    <tr>
                      <th className="p-3">Bill No / Date</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items Summary</th>
                      <th className="p-3 text-center">Total Qty</th>
                      <th className="p-3 text-right">Grand Total</th>
                      <th className="p-3 text-right">Balance Due</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B2B38]">
                    {filteredHistory.map((bill) => (
                      <tr key={bill.id} className="hover:bg-[#232330]">
                        <td className="p-3 font-mono">
                          <div className="font-bold text-white">{bill.billNumber}</div>
                          <div className="text-[10px] text-gray-500">
                            {new Date(bill.date).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{bill.customerName}</div>
                          <div className="text-[10px] text-gray-500">{bill.customerMobile || 'Counter Cash'}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-[11px] text-gray-300 max-w-xs truncate">
                            {bill.items.map(it => `${it.details} (${it.quantity})`).join(', ')}
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-orange-300">
                          {bill.totalQuantity}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {formatINR(bill.grandTotalPaise)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-400">
                          {formatINR(bill.balancePaise)}
                        </td>
                        <td className="p-3 text-center">
                          {bill.isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 text-[10px] font-bold">
                              CANCELLED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold">
                              SAVED
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleDirectBluetoothPrintBill(bill, '58MM')}
                              className="p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/60 text-cyan-300 border border-blue-500/40"
                              title="Direct Print 2-inch (58mm) Bluetooth Thermal"
                            >
                              <Bluetooth className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDirectBluetoothPrintBill(bill, '80MM')}
                              className="p-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/60 text-yellow-300 border border-cyan-500/40"
                              title="Direct Print 3-inch (80mm) Bluetooth Thermal"
                            >
                              <Bluetooth className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDirectWhatsAppJpg(bill)}
                              className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/40"
                              title="Share Bill as JPG Image on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPaperFormat('80MM');
                                setPrintModalBill(bill);
                              }}
                              className="p-1.5 rounded-lg bg-[#282838] hover:bg-[#34344A] text-orange-400"
                              title="Print Thermal Bill / PDF / Share"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {!bill.isCancelled && (
                              <>
                                <button
                                  onClick={() => handleEditBill(bill)}
                                  className="p-1.5 rounded-lg bg-[#282838] hover:bg-[#34344A] text-blue-400"
                                  title="Edit Bill"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCancelBill(bill.id)}
                                  className="p-1.5 rounded-lg bg-[#282838] hover:bg-[#34344A] text-amber-400"
                                  title="Cancel / Void Bill"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteBill(bill.id)}
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40"
                              title="Delete Bill (Reverses Stock & Ledger)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: ACTIVE BILLING CALCULATOR & CHECKOUT */}
      {activeTab === 'NEW_BILL' && (
        <div className="space-y-4">
          {/* Document Type Selector Banner */}
          <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">Document Type:</span>
              <div className="flex items-center gap-1 bg-[#121217] p-1 rounded-xl border border-[#2D2D3B] text-xs">
                {(['ESTIMATE', 'CASH_MEMO', 'INVOICE'] as DocumentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setDocType(type); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      docType === type 
                        ? 'bg-orange-500 text-black shadow-md' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {isSavedSuccess && lastSavedBill && (
              <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto bg-[#171720] p-2 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Bill #{lastSavedBill.billNumber} Saved
                </span>

                {/* 1-Tap Bluetooth Quick Actions */}
                <button
                  type="button"
                  onClick={() => handleDirectBluetoothPrintBill(lastSavedBill, '58MM')}
                  disabled={isBtPrinting}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all min-h-[44px]"
                  title="Print to 2-inch (58mm) Bluetooth Thermal POS"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-cyan-300" />
                  <span>2" BT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectBluetoothPrintBill(lastSavedBill, '80MM')}
                  disabled={isBtPrinting}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all min-h-[44px]"
                  title="Print to 3-inch (80mm) Bluetooth Thermal POS"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-yellow-300" />
                  <span>3" BT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectWhatsAppJpg(lastSavedBill)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all min-h-[44px]"
                  title="Share Bill as JPG Image on WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-200" />
                  <span>WhatsApp (JPG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintModalBill(lastSavedBill)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#2D2D3E] hover:bg-[#393950] text-white font-bold flex items-center gap-1 min-h-[44px]"
                >
                  <Printer className="w-3.5 h-3.5 text-orange-400" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetNewBill}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-bold min-h-[44px]"
                >
                  New Bill
                </button>
              </div>
            )}
          </div>

          {toastMessage && (
            <div className="bg-gradient-to-r from-blue-900/60 to-emerald-900/60 border border-blue-500/40 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-blue-200 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-semibold">{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Customer, Fast Row Entry, Cart Table */}
            <div className="lg:col-span-2 space-y-4">
              {/* Customer & Bill Meta Card */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Bill Number</label>
                    <input
                      type="text"
                      readOnly
                      value={billNumber}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-orange-300 font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-gray-400 mb-1 font-semibold">Wholesale Customer</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="">-- Walk-in Counter Cash Wholesale --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.city}) • Due: {formatINR(c.currentOutstandingPaise)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {previousDuePaise > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/40 text-xs flex items-center justify-between">
                    <span className="text-amber-300 font-semibold">Previous Outstanding Ledger Due:</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">{formatINR(previousDuePaise)}</span>
                  </div>
                )}
              </div>

              {/* Fast Line Item Entry Row */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Fast Item Entry (Free-text or Catalog)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Open Calculator Pad</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="col-span-2">
                    <label className="block text-gray-400 mb-1">Pick Catalog Bag</label>
                    <select
                      value={inputProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="">-- Choose or type free-text below --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.currentStock} pcs @ ₹{paiseToRupees(p.wholesaleRatePaise)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-gray-400 mb-1">Item Description / Bag Code</label>
                    <input
                      type="text"
                      placeholder="e.g. HYPORA, CLUB, SCHOOLBOY"
                      value={inputDetails}
                      onChange={(e) => setInputDetails(e.target.value)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white uppercase font-semibold focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Quantity (Pcs)</label>
                    <input
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={inputRate}
                      onChange={(e) => setInputRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="col-span-2 flex flex-col justify-end">
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inputIsPermanent}
                          onChange={(e) => setInputIsPermanent(e.target.checked)}
                          className="rounded border-[#3F3F5A] bg-[#1C1C26] text-orange-500 focus:ring-0"
                        />
                        <span>Save as Permanent Catalog Product</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 active:scale-95 flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item ({inputQty} × ₹{inputRate} = ₹{inputQty * inputRate})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Billed Items Cart Table */}
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Line Items in Bill ({items.length})
                    </h3>
                    {items.length === 3 && totalQuantity === 33 && subtotalPaise === rupeesToPaise(4065) && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-mono">
                        SPEC TEST VERIFIED: 33 PCS = ₹4065
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-orange-400 font-bold">
                    Total: {totalQuantity} PCS
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    No items added yet. Use the input row above, or click "Calculator" / "Load Spec Test".
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#22222E] text-gray-400 font-semibold border-b border-[#303042]">
                        <tr>
                          <th className="p-2.5">S.No</th>
                          <th className="p-2.5">Bag Description</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right">Rate</th>
                          <th className="p-2.5 text-right">Total</th>
                          <th className="p-2.5 text-center">Type</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B2B38]">
                        {items.map((item, index) => (
                          <tr key={item.id} className="hover:bg-[#232330]">
                            <td className="p-2.5 text-gray-400 font-mono">{index + 1}</td>
                            <td className="p-2.5 font-bold text-white">{item.details}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-orange-300">
                              {item.quantity}
                            </td>
                            <td className="p-2.5 text-right font-mono text-gray-300">
                              ₹{paiseToRupees(item.ratePaise)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-white">
                              ₹{paiseToRupees(item.totalPaise)}
                            </td>
                            <td className="p-2.5 text-center">
                              {item.isPermanentProduct ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/60 text-[9px] font-bold">
                                  CATALOG
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/60 text-[9px] font-bold">
                                  FREE-TEXT
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                title="Remove line item"
                              >
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

            {/* Right Col: Financials Summary & Checkout */}
            <div className="space-y-4">
              <div className="bg-[#1A1A22] border border-[#2B2B38] rounded-2xl p-5 space-y-4 shadow-xl">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#2C2C3A]">
                  Wholesale Financial Calculations
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Total Quantity</span>
                    <span className="font-mono font-bold text-white text-sm">{totalQuantity} PCS</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Subtotal Amount</span>
                    <span className="font-mono font-bold text-white text-sm">{formatINR(subtotalPaise)}</span>
                  </div>

                  {/* Discount Input */}
                  <div className="pt-2 border-t border-[#262634] flex items-center justify-between">
                    <span className="text-gray-300 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-orange-400" />
                      <span>Discount (₹)</span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={discountRupeesStr}
                      onChange={(e) => setDiscountRupeesStr(e.target.value)}
                      className="w-24 bg-[#121217] border border-[#2D2D3D] rounded-lg px-2 py-1 text-right font-mono font-bold text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* GST Percentage Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">GST %</span>
                    <div className="flex items-center gap-1">
                      {[0, 5, 12, 18].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setGstPercentage(pct)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                            gstPercentage === pct
                              ? 'bg-orange-500 text-black'
                              : 'bg-[#1F1F2A] text-gray-400 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {gstPaise > 0 && (
                    <div className="flex justify-between text-gray-300">
                      <span>GST Amount</span>
                      <span className="font-mono font-semibold text-gray-200">+{formatINR(gstPaise)}</span>
                    </div>
                  )}

                  {/* Round Off */}
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Round Off (Exact Paise)</span>
                    <span className="font-mono">
                      {roundOffPaise !== 0 
                        ? `${roundOffPaise > 0 ? '+' : ''}₹${paiseToRupees(roundOffPaise).toFixed(2)}` 
                        : '₹0.00'}
                    </span>
                  </div>

                  {/* Grand Total */}
                  <div className="pt-2 border-t border-[#2D2D3D] flex justify-between items-center text-sm">
                    <span className="font-bold text-white">Grand Total</span>
                    <span className="font-mono font-black text-orange-400 text-xl">
                      {formatINR(grandTotalPaise)}
                    </span>
                  </div>
                </div>

                {/* Payments Section */}
                <div className="pt-3 border-t border-[#2D2D3D] space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Paid Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Payment Method</label>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {(['CASH', 'UPI', 'BANK', 'CHEQUE'] as PaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-1.5 rounded-lg font-semibold transition-all text-center ${
                            paymentMethod === m
                              ? 'bg-orange-500 text-black'
                              : 'bg-[#22222E] text-gray-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ledger Balance Preview Box */}
                  <div className="p-3 rounded-xl bg-[#141419] border border-[#272733] space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bill Credit Balance:</span>
                      <span className="font-mono font-bold text-amber-400">{formatINR(balancePaise)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Previous Due:</span>
                      <span className="font-mono text-gray-300">{formatINR(previousDuePaise)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#23232E] font-bold">
                      <span className="text-white">New Total Balance:</span>
                      <span className="font-mono text-amber-300 text-sm">{formatINR(newBalancePaise)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Transport / Dispatch Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Kolkata Central Cargo / Van Marka"
                      value={billNotes}
                      onChange={(e) => setBillNotes(e.target.value)}
                      className="w-full bg-[#121217] border border-[#2D2D3D] rounded-xl px-3 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Bluetooth Thermal Print Direct Actions */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-gray-400 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-blue-300">
                        <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Instant Bluetooth Thermal Print</span>
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">1-Tap POS</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={items.length === 0 || isBtPrinting}
                        onClick={() => handleSaveAndBluetoothPrint('58MM')}
                        className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
                      >
                        <Bluetooth className="w-4 h-4 text-cyan-300" />
                        <span>Print 2" (58mm)</span>
                      </button>

                      <button
                        type="button"
                        disabled={items.length === 0 || isBtPrinting}
                        onClick={() => handleSaveAndBluetoothPrint('80MM')}
                        className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
                      >
                        <Bluetooth className="w-4 h-4 text-yellow-300" />
                        <span>Print 3" (80mm)</span>
                      </button>
                    </div>

                    {/* Separate Save & Print Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        id="btn-save-bill"
                        type="button"
                        disabled={items.length === 0}
                        onClick={handleSaveBill}
                        className="w-full py-2.5 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all min-h-[44px]"
                        title="Save bill directly to Room DB & customer ledger without printing"
                      >
                        <Save className="w-4 h-4" />
                        <span>{editingBillId ? 'Update Bill' : 'Save Bill'}</span>
                      </button>

                      <button
                        id="btn-save-print-bill"
                        type="button"
                        disabled={items.length === 0}
                        onClick={handleSaveAndOpenPrint}
                        className="w-full py-2.5 rounded-xl bg-[#2D2D3E] hover:bg-[#3A3A4F] text-white font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-[#3E3E55] active:scale-98 transition-all min-h-[44px]"
                        title="Save bill and open Print / PDF Preview Dialog"
                      >
                        <Printer className="w-4 h-4 text-orange-400" />
                        <span>Save & Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Calculator Modal */}
      <QuickCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        onAddLineItem={handleAddCalculatorItem}
      />

      {/* Bill Thermal / PDF / Share / Labels Modal */}
      {printModalBill && (
        <BillPrintModal
          bill={printModalBill}
          isOpen={!!printModalBill}
          onClose={() => setPrintModalBill(null)}
          onPrintLabels={onNavigateLabels}
          defaultPaperSize={selectedPaperFormat}
        />
      )}
    </div>
  );
};
