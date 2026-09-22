import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { roomDb } from '../db/indexedDbRoom';
import { 
  ExportEntityType, 
  ExportFileFormat,
  Bill,
  Customer,
  Supplier,
  Product,
  Purchase,
  Expense,
  CashTransaction,
  TransportRecord,
  CRMFollowUp,
  CustomerLedgerTransaction,
  SupplierLedgerTransaction,
  BusinessProfile
} from '../types';
import { paiseToRupees, formatINR } from './currency';
import { reportsService } from './reportsService';
import { auditService } from './auditService';
import { securityService } from './securityService';

export interface ExportOptions {
  startDate?: number;
  endDate?: number;
  filterId?: string;
  notes?: string;
}

class ExportService {
  /**
   * Main Dispatcher for all entity and format exports
   */
  public async exportData(
    entity: ExportEntityType,
    format: ExportFileFormat,
    options?: ExportOptions
  ): Promise<{ fileName: string; rowCount: number; blob?: Blob; buffer?: ArrayBuffer | string }> {
    const activeStaff = securityService.getActiveStaff();
    const timestamp = Date.now();
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    const fileName = `OMB_${entity}_${dateStr}_${timestamp.toString().slice(-4)}.${format.toLowerCase()}`;

    // 1. Fetch Data for Entity
    const exportDataset = await this.prepareDataset(entity, options);

    let blob: Blob;
    let buffer: ArrayBuffer | string;

    // 2. Generate according to format
    if (format === 'CSV') {
      const csvContent = this.generateCsvString(exportDataset.headers, exportDataset.rows);
      buffer = csvContent;
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    } else if (format === 'XLSX') {
      const wb = XLSX.utils.book_new();
      if (entity === 'ALL') {
        // Multi-sheet workbook
        const allDatasets = await this.prepareAllEntitiesWorkbook();
        for (const sheet of allDatasets) {
          const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
          XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
        }
      } else {
        const ws = XLSX.utils.aoa_to_sheet([exportDataset.headers, ...exportDataset.rows]);
        XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 31));
      }
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      buffer = wbout;
      blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else {
      // PDF Format via jsPDF + autoTable
      const doc = await this.generatePdfDocument(entity, exportDataset.title, exportDataset.headers, exportDataset.rows, exportDataset.summaryNotes);
      const pdfArrayBuffer = doc.output('arraybuffer');
      buffer = pdfArrayBuffer;
      blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    }

    // 3. Trigger Browser Download if running in browser
    this.triggerBrowserDownload(blob, fileName);

    // 4. Record Audit Log
    await auditService.log({
      user: activeStaff?.name || 'Admin',
      role: activeStaff?.role || 'ADMIN',
      action: 'DATA_EXPORTED',
      recordType: entity,
      recordId: `export-${timestamp}`,
      severity: 'INFO',
      description: `Exported ${exportDataset.rows.length} rows of ${entity} as ${format}`,
      notes: `Filename: ${fileName} | Format: ${format}`
    });

    return {
      fileName,
      rowCount: exportDataset.rows.length,
      blob,
      buffer
    };
  }

  /**
   * Prepares tabular dataset (title, headers, rows) for any entity
   */
  public async prepareDataset(entity: ExportEntityType, options?: ExportOptions): Promise<{
    title: string;
    headers: string[];
    rows: any[][];
    summaryNotes?: string[];
  }> {
    switch (entity) {
      case 'SALES':
      case 'BILLS': {
        const bills = await roomDb.getAll<Bill>('bills');
        const filtered = bills.filter(b => {
          if (options?.startDate && b.date < options.startDate) return false;
          if (options?.endDate && b.date > options.endDate) return false;
          return true;
        });

        const headers = ['Bill No', 'Date', 'Customer Name', 'Mobile', 'Doc Type', 'Items Count', 'Pcs Sold', 'Subtotal (Rs)', 'Discount (Rs)', 'GST (Rs)', 'Grand Total (Rs)', 'Paid (Rs)', 'Balance Due (Rs)', 'Payment Method', 'Status'];
        const rows = filtered.map(b => [
          b.billNumber,
          new Date(b.date).toLocaleDateString('en-IN'),
          b.customerName,
          b.customerMobile || '-',
          b.documentType,
          b.items?.length || 0,
          b.totalQuantity,
          paiseToRupees(b.subtotalPaise),
          paiseToRupees(b.discountPaise || 0),
          paiseToRupees(b.gstPaise || 0),
          paiseToRupees(b.grandTotalPaise),
          paiseToRupees(b.paidPaise),
          paiseToRupees(b.balancePaise),
          b.paymentMethod,
          b.isCancelled ? 'CANCELLED' : 'ACTIVE'
        ]);

        const totalRevenue = filtered.filter(b => !b.isCancelled).reduce((s, b) => s + b.grandTotalPaise, 0);
        const totalPcs = filtered.filter(b => !b.isCancelled).reduce((s, b) => s + b.totalQuantity, 0);

        return {
          title: 'ORIGINAL MODI BAGS - SALES & BILLING INVOICES',
          headers,
          rows,
          summaryNotes: [`Total Invoices: ${filtered.length}`, `Active Sales Revenue: ${formatINR(totalRevenue)}`, `Total Pieces Sold: ${totalPcs}`]
        };
      }

      case 'CUSTOMERS': {
        const customers = await roomDb.getAll<Customer>('customers');
        const headers = ['Customer ID', 'Name', 'Business / Shop', 'Mobile', 'WhatsApp', 'Address', 'City', 'State', 'GSTIN', 'Opening Due (Rs)', 'Current Outstanding (Rs)', 'Credit Limit (Rs)', 'Preferred Transport'];
        const rows = customers.map(c => [
          c.customerId,
          c.name,
          c.businessName || '-',
          c.mobile,
          c.whatsapp || c.mobile,
          c.address || 'Kolkata',
          c.city || 'Kolkata',
          c.state || 'West Bengal',
          c.gstin || '-',
          paiseToRupees(c.openingBalancePaise),
          paiseToRupees(c.currentOutstandingPaise),
          paiseToRupees(c.creditLimitPaise || 0),
          c.preferredTransport || '-'
        ]);

        const totalOutstanding = customers.reduce((s, c) => s + c.currentOutstandingPaise, 0);
        return {
          title: 'ORIGINAL MODI BAGS - CUSTOMER DIRECTORY & BALANCES',
          headers,
          rows,
          summaryNotes: [`Total Customers: ${customers.length}`, `Total Market Receivables: ${formatINR(totalOutstanding)}`]
        };
      }

      case 'LEDGER':
      case 'CUSTOMER_LEDGER': {
        const customerLedger = await roomDb.getAll<CustomerLedgerTransaction>('customer_ledger');
        const customers = await roomDb.getAll<Customer>('customers');
        const custMap = new Map(customers.map(c => [c.id, c.name]));

        const headers = ['Date', 'Customer Name', 'Type', 'Ref Document No', 'Description', 'Debit (Rs)', 'Credit (Rs)', 'Running Balance (Rs)', 'Payment Method'];
        const rows = customerLedger.map(l => [
          new Date(l.date).toLocaleDateString('en-IN'),
          custMap.get(l.customerId) || 'Customer',
          l.type,
          l.referenceDocumentNumber || '-',
          l.description,
          paiseToRupees(l.debitPaise),
          paiseToRupees(l.creditPaise),
          paiseToRupees(l.runningBalancePaise),
          l.paymentMethod || '-'
        ]);

        return {
          title: 'ORIGINAL MODI BAGS - CUSTOMER ACCOUNT LEDGERS',
          headers,
          rows,
          summaryNotes: [`Total Ledger Entries: ${customerLedger.length}`]
        };
      }

      case 'SUPPLIER_LEDGER': {
        const supplierLedger = await roomDb.getAll<SupplierLedgerTransaction>('supplier_ledger');
        const suppliers = await roomDb.getAll<Supplier>('suppliers');
        const suppMap = new Map(suppliers.map(s => [s.id, s.name]));

        const headers = ['Date', 'Supplier Name', 'Type', 'Ref Invoice No', 'Description', 'Debit / Paid (Rs)', 'Credit / Inward (Rs)', 'Balance Due (Rs)', 'Payment Method'];
        const rows = supplierLedger.map(l => [
          new Date(l.date).toLocaleDateString('en-IN'),
          suppMap.get(l.supplierId) || 'Supplier',
          l.type,
          l.referenceDocumentNumber || '-',
          l.description,
          paiseToRupees(l.debitPaise),
          paiseToRupees(l.creditPaise),
          paiseToRupees(l.runningBalancePaise),
          l.paymentMethod || '-'
        ]);

        return {
          title: 'ORIGINAL MODI BAGS - SUPPLIER ACCOUNT LEDGERS',
          headers,
          rows,
          summaryNotes: [`Total Supplier Entries: ${supplierLedger.length}`]
        };
      }

      case 'PAYMENTS': {
        const cashTxs = await roomDb.getAll<CashTransaction>('cash_transactions');
        const headers = ['Tx ID', 'Date & Time', 'Transaction Type', 'Inflow / Received (Rs)', 'Outflow / Paid (Rs)', 'Running Cash Balance (Rs)', 'Reference ID', 'Description'];
        const rows = cashTxs.map(tx => [
          tx.id.slice(-8),
          new Date(tx.date).toLocaleString('en-IN'),
          tx.type,
          paiseToRupees(tx.inflowPaise || 0),
          paiseToRupees(tx.outflowPaise || 0),
          paiseToRupees(tx.runningCashBalancePaise || 0),
          tx.referenceId || '-',
          tx.description
        ]);

        const totalIn = cashTxs.reduce((s, tx) => s + (tx.inflowPaise || 0), 0);
        const totalOut = cashTxs.reduce((s, tx) => s + (tx.outflowPaise || 0), 0);

        return {
          title: 'ORIGINAL MODI BAGS - CASH & BANK PAYMENT TRANSACTIONS',
          headers,
          rows,
          summaryNotes: [`Total Inflow: ${formatINR(totalIn)}`, `Total Outflow: ${formatINR(totalOut)}`, `Net Cash Flow: ${formatINR(totalIn - totalOut)}`]
        };
      }

      case 'PURCHASES': {
        const purchases = await roomDb.getAll<Purchase>('purchases');
        const headers = ['Purchase Invoice No', 'Date', 'Supplier Name', 'Items Count', 'Total Pcs Inward', 'Subtotal (Rs)', 'GST (Rs)', 'Grand Total (Rs)', 'Paid (Rs)', 'Credit Due (Rs)', 'Payment Method'];
        const rows = purchases.map(p => [
          p.purchaseInvoiceNumber,
          new Date(p.date).toLocaleDateString('en-IN'),
          p.supplierName,
          p.items?.length || 0,
          p.totalQuantity || 0,
          paiseToRupees(p.subtotalPaise),
          paiseToRupees(p.gstPaise || 0),
          paiseToRupees(p.grandTotalPaise),
          paiseToRupees(p.paidPaise),
          paiseToRupees(p.creditPaise),
          p.paymentMethod || '-'
        ]);

        const totalPurchases = purchases.reduce((s, p) => s + p.grandTotalPaise, 0);

        return {
          title: 'ORIGINAL MODI BAGS - INWARD GOODS & PURCHASES',
          headers,
          rows,
          summaryNotes: [`Total Inward Invoices: ${purchases.length}`, `Total Purchases Value: ${formatINR(totalPurchases)}`]
        };
      }

      case 'STOCK': {
        const products = await roomDb.getAll<Product>('products');
        const headers = ['Product Code', 'Product Name', 'Category', 'Bag Size', 'Colour', 'Opening Stock', 'Current Stock (Pcs)', 'Min Stock Level', 'Cost Rate (Rs)', 'Wholesale Rate (Rs)', 'MRP (Rs)', 'Cost Valuation (Rs)', 'Wholesale Valuation (Rs)', 'Status'];
        const rows = products.map(p => {
          const costVal = Math.max(0, p.currentStock) * (p.purchaseRatePaise || 0);
          const wsVal = Math.max(0, p.currentStock) * (p.wholesaleRatePaise || 0);
          const isLow = p.currentStock <= p.minimumStock;

          return [
            p.productCode,
            p.name,
            p.category,
            p.size || '-',
            p.colour || '-',
            p.openingStock,
            p.currentStock,
            p.minimumStock,
            paiseToRupees(p.purchaseRatePaise),
            paiseToRupees(p.wholesaleRatePaise),
            paiseToRupees(p.saleRatePaise),
            paiseToRupees(costVal),
            paiseToRupees(wsVal),
            isLow ? 'LOW STOCK' : 'IN STOCK'
          ];
        });

        const totalPcs = products.reduce((s, p) => s + Math.max(0, p.currentStock), 0);
        const totalCostVal = products.reduce((s, p) => s + Math.max(0, p.currentStock) * (p.purchaseRatePaise || 0), 0);
        const totalWsVal = products.reduce((s, p) => s + Math.max(0, p.currentStock) * (p.wholesaleRatePaise || 0), 0);

        return {
          title: 'ORIGINAL MODI BAGS - PHYSICAL STOCK & GODOWN INVENTORY VALUATION',
          headers,
          rows,
          summaryNotes: [`Total Product SKUs: ${products.length}`, `Total Physical Bags: ${totalPcs} PCS`, `Total Stock Cost Value: ${formatINR(totalCostVal)}`, `Total Wholesale Value: ${formatINR(totalWsVal)}`]
        };
      }

      case 'EXPENSES': {
        const expenses = await roomDb.getAll<Expense>('expenses');
        const headers = ['Expense Date', 'Category', 'Description', 'Payment Method', 'Amount (Rs)', 'Reference', 'Notes'];
        const rows = expenses.map(e => [
          new Date(e.date).toLocaleDateString('en-IN'),
          e.category,
          e.description,
          e.paymentMethod,
          paiseToRupees(e.amountPaise),
          e.reference || '-',
          e.notes || '-'
        ]);

        const totalExp = expenses.reduce((s, e) => s + e.amountPaise, 0);

        return {
          title: 'ORIGINAL MODI BAGS - OPERATING EXPENSES & VOUCHERS',
          headers,
          rows,
          summaryNotes: [`Total Expenses: ${expenses.length}`, `Total Amount Spent: ${formatINR(totalExp)}`]
        };
      }

      case 'CRM': {
        const crm = await roomDb.getAll<CRMFollowUp>('crm_followups');
        const headers = ['Customer Name', 'Mobile', 'Scheduled Date', 'Type', 'Purpose', 'Status', 'Notes'];
        const rows = crm.map(f => [
          f.customerName,
          f.customerMobile || '-',
          new Date(f.scheduledDate).toLocaleDateString('en-IN'),
          f.type,
          f.purpose || '-',
          f.status,
          f.notes || '-'
        ]);

        return {
          title: 'ORIGINAL MODI BAGS - CRM & CUSTOMER FOLLOW-UPS',
          headers,
          rows,
          summaryNotes: [`Total CRM Followups: ${crm.length}`]
        };
      }

      case 'TRANSPORT': {
        const transports = await roomDb.getAll<TransportRecord>('transport');
        const headers = ['Transport Agency Name', 'Destination / City', 'Contact Person', 'Phone', 'Alternate Phone', 'Godown Address', 'Routes', 'Notes'];
        const rows = transports.map(t => [
          t.name,
          t.destination,
          t.contactPerson || '-',
          t.phone,
          t.alternatePhone || '-',
          t.godownAddress || '-',
          (t.destinationRoutes || []).join(', ') || '-',
          t.notes || '-'
        ]);

        return {
          title: 'ORIGINAL MODI BAGS - TRANSPORT & PARCEL LOGISTICS DIRECTORY',
          headers,
          rows,
          summaryNotes: [`Total Transporters: ${transports.length}`]
        };
      }

      case 'REPORTS': {
        const plReport = await reportsService.getProfitLossReport({ preset: 'ALL_TIME' });
        const outstanding = await reportsService.getOutstandingReport();
        const inventory = await reportsService.getInventoryReport();

        const headers = ['Executive Financial Metric', 'Value / Amount'];
        const rows = [
          ['Gross Sales Revenue', formatINR(plReport.grossSalesRevenuePaise)],
          ['Bill Discounts Applied', formatINR(plReport.discountPaise)],
          ['Net Sales Revenue', formatINR(plReport.netSalesRevenuePaise)],
          ['Cost of Goods Sold (COGS)', formatINR(plReport.costOfGoodsSoldPaise)],
          ['Gross Operating Profit', formatINR(plReport.grossProfitPaise)],
          ['Gross Margin Percentage', `${plReport.grossMarginPercent.toFixed(1)}%`],
          ['Operating Expenses', formatINR(plReport.operatingExpensesPaise)],
          ['Net Profit / Loss', formatINR(plReport.netProfitPaise)],
          ['Net Margin Percentage', `${plReport.netMarginPercent.toFixed(1)}%`],
          ['Market Receivables Due', formatINR(outstanding.totalReceivablesPaise)],
          ['Supplier Payables Due', formatINR(outstanding.totalPayablesPaise)],
          ['Physical Stock Valuation (Cost)', formatINR(inventory.totalValuationAtPurchasePaise)],
          ['Physical Stock Valuation (Wholesale)', formatINR(inventory.totalValuationAtWholesalePaise)]
        ];

        return {
          title: 'ORIGINAL MODI BAGS - EXECUTIVE BUSINESS & FINANCIAL SUMMARY REPORT',
          headers,
          rows,
          summaryNotes: [
            `Report Date: ${new Date().toLocaleDateString('en-IN')}`,
            `Net Profit: ${formatINR(plReport.netProfitPaise)}`,
            `Physical Stock Value: ${formatINR(inventory.totalValuationAtPurchasePaise)}`
          ]
        };
      }

      case 'ALL':
      default: {
        return {
          title: 'ORIGINAL MODI BAGS - MASTER EXPORT',
          headers: ['Table', 'Status'],
          rows: [['All Business Tables', 'Ready for Multi-Sheet Export']],
          summaryNotes: ['Comprehensive multi-table workbook']
        };
      }
    }
  }

  /**
   * Prepares all entities into sheets for single-click "Export All" Excel workbook
   */
  private async prepareAllEntitiesWorkbook(): Promise<{ sheetName: string; headers: string[]; rows: any[][] }[]> {
    const entities: ExportEntityType[] = [
      'SALES',
      'CUSTOMERS',
      'STOCK',
      'PURCHASES',
      'PAYMENTS',
      'EXPENSES',
      'CUSTOMER_LEDGER',
      'SUPPLIER_LEDGER',
      'TRANSPORT',
      'CRM',
      'REPORTS'
    ];

    const sheets: { sheetName: string; headers: string[]; rows: any[][] }[] = [];
    for (const ent of entities) {
      const data = await this.prepareDataset(ent);
      sheets.push({
        sheetName: ent,
        headers: data.headers,
        rows: data.rows
      });
    }
    return sheets;
  }

  /**
   * Builds RFC 4180 CSV string from headers and 2D row array
   */
  public generateCsvString(headers: string[], rows: any[][]): string {
    const formatCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headerLine = headers.map(formatCell).join(',');
    const bodyLines = rows.map(r => r.map(formatCell).join(',')).join('\n');
    return `${headerLine}\n${bodyLines}`;
  }

  /**
   * Generates a stylized PDF Document using jsPDF + autoTable
   */
  public async generatePdfDocument(
    entity: ExportEntityType,
    title: string,
    headers: string[],
    rows: any[][],
    summaryNotes?: string[]
  ): Promise<jsPDF> {
    const JSPDFConstructor: any = (jsPDF as any).jsPDF || (jsPDF as any).default || jsPDF;
    const doc: jsPDF = new JSPDFConstructor({
      orientation: rows.length > 0 && headers.length > 7 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 30;

    // Header Branding
    doc.setFillColor(28, 28, 36);
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 140, 0); // Orange
    doc.setFontSize(14);
    doc.text('ORIGINAL MODI BAGS', 20, 26);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(9);
    doc.text('3, Amartalla Lane, Kolkata-700001 | Phone: 8240584877 | GSTIN: 19AAACA1234A1Z5', 20, 42);

    currentY = 75;

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(12);
    doc.text(title, 20, currentY);
    currentY += 16;

    // Timestamp & Export Metadata
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    doc.setFontSize(8.5);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (Kolkata Standard Time)`, 20, currentY);
    currentY += 14;

    // Summary Notes (if any)
    if (summaryNotes && summaryNotes.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 60);
      doc.setFontSize(8.5);
      const summaryText = summaryNotes.join('  •  ');
      doc.text(summaryText, 20, currentY);
      currentY += 14;
    }

    // Tabular Grid using autoTable
    const autoTableFn: any = (autoTable as any).default || autoTable;
    autoTableFn(doc, {
      startY: currentY,
      head: [headers],
      body: rows.map(r => r.map(c => c !== null && c !== undefined ? String(c) : '-')),
      theme: 'grid',
      headStyles: {
        fillColor: [30, 30, 40],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 30, 30],
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [248, 248, 252]
      },
      margin: { left: 20, right: 20 },
      didDrawPage: (data: any) => {
        // Page footer
        const pageCount = doc.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(130, 130, 140);
        doc.text(`Page ${data.pageNumber} of ${pageCount} | Original Modi Bags Manager`, 20, doc.internal.pageSize.getHeight() - 15);
      }
    });

    return doc;
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
