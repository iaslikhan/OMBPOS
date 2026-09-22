import * as XLSX from 'xlsx';
import { roomDb, TableName } from '../db/indexedDbRoom';
import { 
  ImportEntityType, 
  ImportFormat, 
  ImportErrorDetail, 
  ImportValidationSummary, 
  ImportExecutionResult,
  Product,
  Customer,
  Supplier,
  CustomerLedgerTransaction,
  SupplierLedgerTransaction,
  StockMovement,
  TransportRecord,
  Bill,
  Expense
} from '../types';
import { rupeesToPaise, paiseToRupees } from './currency';
import { auditService } from './auditService';
import { securityService } from './securityService';

export interface ImportOptions {
  updateExisting?: boolean; // If true, matches by unique code/mobile/name and updates; else creates or skips
  strictMode?: boolean; // If true, any single error rolls back the entire batch
  dryRun?: boolean; // If true, only validates without persisting
}

class ImportService {
  /**
   * Parses CSV string into array of object records
   */
  public parseCsv(csvText: string): Record<string, any>[] {
    const lines = csvText.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header
    const headers = this.splitCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    const records: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCsvLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const row: Record<string, any> = { _rowNumber: i + 1 };
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index].trim() : '';
      });
      records.push(row);
    }
    return records;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  /**
   * Parses Excel file buffer / arrayBuffer into row objects
   */
  public parseExcel(buffer: ArrayBuffer): Record<string, any>[] {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];

    const ws = wb.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

    return rawData.map((row, index) => {
      const normalizedRow: Record<string, any> = { _rowNumber: index + 2 };
      Object.entries(row).forEach(([key, val]) => {
        const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        normalizedRow[cleanKey] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      return normalizedRow;
    });
  }

  public parseXlsx(buffer: ArrayBuffer): Record<string, any>[] {
    return this.parseExcel(buffer);
  }

  public downloadTemplate(entityType: ImportEntityType, format: 'CSV' | 'XLSX' = 'CSV'): void {
    const csvContent = this.getSampleTemplateCsv(entityType);
    let blob: Blob;
    let fileName: string;

    if (format === 'XLSX') {
      const parsedRows = this.parseCsv(csvContent);
      const headers = Object.keys(parsedRows[0] || {}).filter(k => k !== '_rowNumber');
      const rowArrays = parsedRows.map(r => headers.map(h => r[h]));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rowArrays]);
      XLSX.utils.book_append_sheet(wb, ws, entityType.slice(0, 31));
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      fileName = `OMB_Template_${entityType}.xlsx`;
    } else {
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      fileName = `OMB_Template_${entityType}.csv`;
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
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

  /**
   * Validates dataset before committing to database
   */
  public validateRows(entityType: ImportEntityType, rows: Record<string, any>[]): ImportValidationSummary {
    const errors: ImportErrorDetail[] = [];
    const warnings: string[] = [];
    let validRows = 0;

    if (!rows || rows.length === 0) {
      errors.push({ row: 0, message: 'File is empty or contains no valid data rows.' });
      return { validRows: 0, invalidRows: 0, errors, warnings, sampleParsedRows: [] };
    }

    const seenKeys = new Set<string>();

    rows.forEach((row) => {
      const rowNum = row._rowNumber || 0;
      let isRowValid = true;

      switch (entityType) {
        case 'PRODUCTS': {
          const name = row.name || row.product_name;
          const code = row.product_code || row.code || row.sku;
          const wholesaleRate = Number(row.wholesale_rate || row.rate || row.price);

          if (!name) {
            errors.push({ row: rowNum, column: 'name', value: name, message: 'Product Name is required.' });
            isRowValid = false;
          }
          if (code) {
            if (seenKeys.has(code.toUpperCase())) {
              warnings.push(`Row ${rowNum}: Duplicate product code '${code}' in import file. Later row will overwrite.`);
            } else {
              seenKeys.add(code.toUpperCase());
            }
          }
          if (isNaN(wholesaleRate) || wholesaleRate < 0) {
            warnings.push(`Row ${rowNum}: Invalid wholesale rate. Defaulting to Rs. 0.`);
          }
          break;
        }

        case 'CUSTOMERS': {
          const name = row.name || row.customer_name;
          const mobile = row.mobile || row.phone;

          if (!name) {
            errors.push({ row: rowNum, column: 'name', message: 'Customer Name is required.' });
            isRowValid = false;
          }
          if (!mobile) {
            errors.push({ row: rowNum, column: 'mobile', message: 'Customer Mobile is required.' });
            isRowValid = false;
          } else {
            const cleanMobile = mobile.replace(/[^0-9]/g, '');
            if (cleanMobile.length < 10) {
              warnings.push(`Row ${rowNum}: Mobile number '${mobile}' is less than 10 digits.`);
            }
          }
          break;
        }

        case 'SUPPLIERS': {
          const name = row.name || row.supplier_name || row.company_name;
          if (!name) {
            errors.push({ row: rowNum, column: 'name', message: 'Supplier Name is required.' });
            isRowValid = false;
          }
          break;
        }

        case 'OPENING_BALANCES': {
          const party = row.party_name || row.customer_name || row.name;
          const bal = Number(row.opening_balance || row.balance || row.amount);
          if (!party) {
            errors.push({ row: rowNum, column: 'party_name', message: 'Party/Customer Name is required.' });
            isRowValid = false;
          }
          if (isNaN(bal)) {
            errors.push({ row: rowNum, column: 'opening_balance', message: 'Opening balance must be a valid number.' });
            isRowValid = false;
          }
          break;
        }

        case 'OPENING_STOCK': {
          const code = row.product_code || row.code || row.name;
          const stock = Number(row.opening_stock || row.stock || row.quantity || row.qty);
          if (!code) {
            errors.push({ row: rowNum, column: 'product_code', message: 'Product Code or Name is required.' });
            isRowValid = false;
          }
          if (isNaN(stock) || stock < 0) {
            errors.push({ row: rowNum, column: 'opening_stock', message: 'Stock must be a positive integer.' });
            isRowValid = false;
          }
          break;
        }

        case 'TRANSPORT': {
          const transName = row.transport_name || row.transporter || row.name;
          if (!transName) {
            errors.push({ row: rowNum, column: 'transport_name', message: 'Transporter agency name is required.' });
            isRowValid = false;
          }
          break;
        }

        case 'HISTORICAL_RECORDS': {
          const docNum = row.doc_number || row.bill_no || row.invoice_no || row.voucher_no;
          const totalAmt = Number(row.total_amount || row.amount || 0);
          if (!docNum) {
            errors.push({ row: rowNum, column: 'doc_number', message: 'Document number is required for historical records.' });
            isRowValid = false;
          }
          if (isNaN(totalAmt) || totalAmt < 0) {
            errors.push({ row: rowNum, column: 'total_amount', message: 'Amount must be a non-negative number.' });
            isRowValid = false;
          }
          break;
        }
      }

      if (isRowValid) {
        validRows++;
      }
    });

    return {
      validRows,
      invalidRows: rows.length - validRows,
      errors,
      warnings,
      sampleParsedRows: rows.slice(0, 5)
    };
  }

  /**
   * Executes atomic batch import with automatic rollback protection on failure
   */
  public async executeImport(
    entityType: ImportEntityType,
    rawRows: Record<string, any>[],
    options: ImportOptions = { updateExisting: true, strictMode: false }
  ): Promise<ImportExecutionResult> {
    const activeStaff = securityService.getActiveStaff();
    const timestamp = Date.now();

    // 1. Validate
    const validation = this.validateRows(entityType, rawRows);
    if (validation.invalidRows > 0 && options.strictMode) {
      return {
        success: false,
        entityType,
        totalRows: rawRows.length,
        importedCount: 0,
        skippedCount: 0,
        errors: validation.errors,
        warnings: validation.warnings,
        rolledBack: true,
        timestamp
      };
    }

    if (options.dryRun) {
      return {
        success: validation.errors.length === 0,
        entityType,
        totalRows: rawRows.length,
        importedCount: validation.validRows,
        skippedCount: validation.invalidRows,
        errors: validation.errors,
        warnings: validation.warnings,
        rolledBack: false,
        timestamp
      };
    }

    // 2. Capture table state snapshots for transactional rollback
    const affectedTables: TableName[] = this.getAffectedTables(entityType);
    const preImportSnapshots: Record<string, any[]> = {};

    for (const table of affectedTables) {
      preImportSnapshots[table] = await roomDb.getAll(table);
    }

    let importedCount = 0;
    let skippedCount = 0;
    const importErrors: ImportErrorDetail[] = [...validation.errors];

    try {
      switch (entityType) {
        case 'PRODUCTS': {
          const existingProducts = await roomDb.getAll<Product>('products');
          for (const row of rawRows) {
            const rowNum = row._rowNumber || 0;
            const name = (row.name || row.product_name || '').trim();
            if (!name) {
              skippedCount++;
              continue;
            }

            const code = (row.product_code || row.code || row.sku || `OMB-${Date.now().toString().slice(-4)}`).trim();
            const existing = existingProducts.find(p => p.productCode.toUpperCase() === code.toUpperCase() || p.name.toLowerCase() === name.toLowerCase());

            const wholesaleRatePaise = rupeesToPaise(Number(row.wholesale_rate || row.rate || row.price || 0));
            const purchaseRatePaise = rupeesToPaise(Number(row.purchase_rate || row.cost_price || Math.round(Number(row.wholesale_rate || 0) * 0.75)));
            const saleRatePaise = rupeesToPaise(Number(row.sale_rate || row.mrp || Math.round(Number(row.wholesale_rate || 0) * 1.25)));
            const openingStock = parseInt(row.opening_stock || row.stock || row.qty || '0', 10) || 0;
            const minimumStock = parseInt(row.min_stock || row.minimum_stock || '10', 10) || 10;
            const category = (row.category || 'SCHOOL_BAG').toUpperCase();
            const gstPercentage = Number(row.gst || row.gst_percentage || 18);
            const hsn = String(row.hsn || '4202');

            const productToSave: Product = {
              id: existing ? existing.id : `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              businessId: 'biz-original-modi-bags',
              productCode: code,
              name,
              category,
              size: row.size || row.bag_size || 'Standard',
              colour: row.colour || row.color || 'Standard',
              purchaseRatePaise,
              wholesaleRatePaise,
              saleRatePaise,
              mrpPaise: saleRatePaise,
              gstPercentage,
              hsn,
              openingStock,
              currentStock: existing ? (options.updateExisting ? openingStock : existing.currentStock) : openingStock,
              minimumStock,
              createdAt: existing ? existing.createdAt : timestamp,
              updatedAt: timestamp,
              syncStatus: 'LOCAL'
            };

            await roomDb.put('products', productToSave);
            importedCount++;
          }
          break;
        }

        case 'CUSTOMERS': {
          const existingCustomers = await roomDb.getAll<Customer>('customers');
          for (const row of rawRows) {
            const rowNum = row._rowNumber || 0;
            const name = (row.name || row.customer_name || '').trim();
            const mobile = (row.mobile || row.phone || '').trim();

            if (!name || !mobile) {
              importErrors.push({ row: rowNum, message: 'Customer name and mobile are required.' });
              continue;
            }

            const existing = existingCustomers.find(c => c.mobile === mobile || c.name.toLowerCase() === name.toLowerCase());
            const openingBalPaise = rupeesToPaise(Number(row.opening_balance || row.balance || 0));
            const creditLimitPaise = rupeesToPaise(Number(row.credit_limit || 50000));

            const customerToSave: Customer = {
              id: existing ? existing.id : `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              businessId: 'biz-original-modi-bags',
              customerId: existing ? existing.customerId : `CUST-${Date.now().toString().slice(-4)}`,
              name,
              businessName: row.business_name || row.shop_name || undefined,
              mobile,
              whatsapp: row.whatsapp || mobile,
              address: row.address || 'Kolkata',
              city: row.city || 'Kolkata',
              state: row.state || 'West Bengal',
              gstin: row.gstin || row.gst_number || undefined,
              openingBalancePaise: openingBalPaise,
              currentOutstandingPaise: existing ? (options.updateExisting ? openingBalPaise : existing.currentOutstandingPaise) : openingBalPaise,
              creditLimitPaise,
              preferredTransport: row.preferred_transport || row.transport || undefined,
              notes: row.notes || undefined,
              totalSalesPaise: existing ? existing.totalSalesPaise : 0,
              totalPaymentsPaise: existing ? existing.totalPaymentsPaise : 0,
              createdAt: existing ? existing.createdAt : timestamp,
              updatedAt: timestamp,
              syncStatus: 'LOCAL'
            };

            await roomDb.put('customers', customerToSave);
            importedCount++;
          }
          break;
        }

        case 'SUPPLIERS': {
          const existingSuppliers = await roomDb.getAll<Supplier>('suppliers');
          for (const row of rawRows) {
            const rowNum = row._rowNumber || 0;
            const name = (row.name || row.supplier_name || row.company_name || '').trim();
            if (!name) {
              importErrors.push({ row: rowNum, message: 'Supplier name is required.' });
              continue;
            }

            const existing = existingSuppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
            const openingBalPaise = rupeesToPaise(Number(row.opening_balance || row.balance || 0));

            const supplierToSave: Supplier = {
              id: existing ? existing.id : `supp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              businessId: 'biz-original-modi-bags',
              supplierId: existing ? existing.supplierId : `SUPP-${Date.now().toString().slice(-4)}`,
              name,
              businessName: row.business_name || name,
              mobile: row.phone || row.mobile || '8240584877',
              whatsapp: row.whatsapp || undefined,
              address: row.address || 'Kolkata',
              city: row.city || 'Kolkata',
              gstin: row.gstin || undefined,
              openingBalancePaise: openingBalPaise,
              currentOutstandingPaise: existing ? (options.updateExisting ? openingBalPaise : existing.currentOutstandingPaise) : openingBalPaise,
              notes: row.notes || undefined,
              totalPurchasesPaise: existing ? existing.totalPurchasesPaise : 0,
              totalPaymentsPaise: existing ? existing.totalPaymentsPaise : 0,
              createdAt: existing ? existing.createdAt : timestamp,
              updatedAt: timestamp,
              syncStatus: 'LOCAL'
            };

            await roomDb.put('suppliers', supplierToSave);
            importedCount++;
          }
          break;
        }

        case 'OPENING_BALANCES': {
          const customers = await roomDb.getAll<Customer>('customers');
          const suppliers = await roomDb.getAll<Supplier>('suppliers');

          for (const row of rawRows) {
            const partyName = (row.party_name || row.customer_name || row.name || '').trim();
            const partyType = (row.party_type || row.type || 'CUSTOMER').toUpperCase();
            const openingBalPaise = rupeesToPaise(Number(row.opening_balance || row.balance || 0));

            if (partyType === 'SUPPLIER') {
              const matchedSupplier = suppliers.find(s => s.name.toLowerCase() === partyName.toLowerCase());
              if (matchedSupplier) {
                matchedSupplier.openingBalancePaise = openingBalPaise;
                matchedSupplier.currentOutstandingPaise = openingBalPaise;
                matchedSupplier.updatedAt = timestamp;
                await roomDb.put('suppliers', matchedSupplier);

                // Add to supplier ledger
                const ledgerTx: SupplierLedgerTransaction = {
                  id: `supp-led-open-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  businessId: 'biz-original-modi-bags',
                  supplierId: matchedSupplier.id,
                  date: timestamp,
                  type: 'OPENING_BALANCE',
                  description: 'Opening Balance (Imported)',
                  creditPaise: openingBalPaise,
                  debitPaise: 0,
                  runningBalancePaise: openingBalPaise,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                  syncStatus: 'LOCAL'
                };
                await roomDb.put('supplier_ledger', ledgerTx);
                importedCount++;
              } else {
                skippedCount++;
              }
            } else {
              // Customer
              const matchedCustomer = customers.find(c => c.name.toLowerCase() === partyName.toLowerCase() || (row.mobile && c.mobile === row.mobile));
              if (matchedCustomer) {
                matchedCustomer.openingBalancePaise = openingBalPaise;
                matchedCustomer.currentOutstandingPaise = openingBalPaise;
                matchedCustomer.updatedAt = timestamp;
                await roomDb.put('customers', matchedCustomer);

                // Add to customer ledger
                const ledgerTx: CustomerLedgerTransaction = {
                  id: `cust-led-open-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  businessId: 'biz-original-modi-bags',
                  customerId: matchedCustomer.id,
                  date: timestamp,
                  type: 'OPENING_BALANCE',
                  description: 'Opening Balance (Imported)',
                  debitPaise: openingBalPaise,
                  creditPaise: 0,
                  runningBalancePaise: openingBalPaise,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                  syncStatus: 'LOCAL'
                };
                await roomDb.put('customer_ledger', ledgerTx);
                importedCount++;
              } else {
                skippedCount++;
              }
            }
          }
          break;
        }

        case 'OPENING_STOCK': {
          const products = await roomDb.getAll<Product>('products');
          for (const row of rawRows) {
            const identifier = (row.product_code || row.code || row.name || '').trim().toLowerCase();
            const stockQty = parseInt(row.opening_stock || row.stock || row.qty || '0', 10);

            const matchedProduct = products.find(p => 
              p.productCode.toLowerCase() === identifier || 
              p.name.toLowerCase().includes(identifier)
            );

            if (matchedProduct) {
              const prevStock = matchedProduct.currentStock;
              matchedProduct.openingStock = stockQty;
              matchedProduct.currentStock = stockQty;
              matchedProduct.updatedAt = timestamp;
              await roomDb.put('products', matchedProduct);

              const movement: StockMovement = {
                id: `mov-open-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                businessId: 'biz-original-modi-bags',
                productId: matchedProduct.id,
                productName: matchedProduct.name,
                date: timestamp,
                type: 'OPENING_STOCK',
                quantityChange: stockQty - prevStock,
                previousStock: prevStock,
                newStock: stockQty,
                notes: 'Opening Stock Balance (Imported)',
                createdAt: timestamp,
                updatedAt: timestamp,
                syncStatus: 'LOCAL'
              };
              await roomDb.put('stock_movements', movement);
              importedCount++;
            } else {
              skippedCount++;
            }
          }
          break;
        }

        case 'TRANSPORT': {
          for (const row of rawRows) {
            const transportName = (row.transport_name || row.transporter || row.name || '').trim();
            const destination = (row.destination || row.city || 'Kolkata').trim();

            const transportEntry: TransportRecord = {
              id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              businessId: 'biz-original-modi-bags',
              name: transportName,
              destination,
              contactPerson: row.contact_person || undefined,
              phone: row.phone || row.mobile || '8240584877',
              alternatePhone: row.alternate_phone || undefined,
              godownAddress: row.godown_address || row.address || 'Posta Transport Hub, Kolkata',
              destinationRoutes: row.routes ? String(row.routes).split(',').map((r: string) => r.trim()) : [destination],
              notes: row.notes || undefined,
              createdAt: timestamp,
              updatedAt: timestamp,
              syncStatus: 'LOCAL'
            };

            await roomDb.put('transport', transportEntry);
            importedCount++;
          }
          break;
        }

        case 'HISTORICAL_RECORDS': {
          for (const row of rawRows) {
            const docType = (row.record_type || row.type || 'BILL').toUpperCase();
            if (docType === 'EXPENSE') {
              const expense: Expense = {
                id: `exp-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                businessId: 'biz-original-modi-bags',
                category: (row.category || 'MISCELLANEOUS').toUpperCase(),
                amountPaise: rupeesToPaise(Number(row.amount || 0)),
                date: row.date ? new Date(row.date).getTime() || timestamp : timestamp,
                paymentMethod: (row.payment_method || 'CASH').toUpperCase() as any,
                description: row.description || 'Historical expense record',
                reference: row.doc_number || `EXP-HIST-${Date.now().toString().slice(-4)}`,
                notes: 'Imported historical record',
                createdAt: timestamp,
                updatedAt: timestamp,
                syncStatus: 'LOCAL'
              };
              await roomDb.put('expenses', expense);
              importedCount++;
            } else {
              // Historical Bill
              const grandTotalPaise = rupeesToPaise(Number(row.total_amount || row.amount || 0));
              const paidPaise = rupeesToPaise(Number(row.paid_amount || row.paid || 0));
              const balancePaise = Math.max(0, grandTotalPaise - paidPaise);

              const bill: Bill = {
                id: `bill-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                businessId: 'biz-original-modi-bags',
                billNumber: row.doc_number || `OMB-HIST-${Date.now().toString().slice(-4)}`,
                customerName: row.customer_name || row.party_name || 'Historical Customer',
                customerMobile: row.customer_mobile || row.phone || '8240584877',
                date: row.date ? new Date(row.date).getTime() || timestamp : timestamp,
                items: [],
                totalQuantity: parseInt(row.quantity || row.pcs || '1', 10) || 1,
                subtotalPaise: grandTotalPaise,
                discountPaise: 0,
                gstPaise: 0,
                roundOffPaise: 0,
                grandTotalPaise,
                paidPaise,
                balancePaise,
                previousDuePaise: 0,
                newBalancePaise: balancePaise,
                paymentMethod: (row.payment_method || 'CASH').toUpperCase() as any,
                documentType: 'INVOICE',
                isCancelled: false,
                notes: 'Imported historical bill',
                createdAt: timestamp,
                updatedAt: timestamp,
                syncStatus: 'LOCAL'
              };
              await roomDb.put('bills', bill);
              importedCount++;
            }
          }
          break;
        }
      }

      // Check if strict mode failed
      if (options.strictMode && importErrors.length > 0) {
        throw new Error(`Strict Mode failure: ${importErrors.length} validation errors encountered during import.`);
      }

      await auditService.log({
        user: activeStaff?.name || 'Admin',
        role: activeStaff?.role || 'ADMIN',
        action: 'DATA_IMPORTED',
        recordType: entityType,
        recordId: `import-${timestamp}`,
        severity: 'INFO',
        description: `Imported ${importedCount} records for ${entityType} (Skipped: ${skippedCount})`,
        notes: `Entity: ${entityType} | Format: CSV/XLSX`
      });

      return {
        success: true,
        entityType,
        totalRows: rawRows.length,
        importedCount,
        skippedCount,
        errors: importErrors,
        warnings: validation.warnings,
        rolledBack: false,
        timestamp
      };

    } catch (batchErr: any) {
      console.error(`[ImportService] Batch import failed for ${entityType}. Executing rollback...`, batchErr);

      // ROLLBACK SNAPSHOT
      for (const [table, rows] of Object.entries(preImportSnapshots)) {
        await roomDb.clear(table as TableName);
        for (const row of rows) {
          await roomDb.put(table as TableName, row, false);
        }
      }

      await auditService.log({
        user: activeStaff?.name || 'Admin',
        role: activeStaff?.role || 'ADMIN',
        action: 'IMPORT_ROLLED_BACK',
        recordType: entityType,
        recordId: `import-rollback-${timestamp}`,
        severity: 'ALERT',
        description: `Batch import rolled back for ${entityType}: ${batchErr.message}`,
        notes: `Error: ${batchErr.message}`
      });

      return {
        success: false,
        entityType,
        totalRows: rawRows.length,
        importedCount: 0,
        skippedCount: 0,
        errors: [{ row: 0, message: batchErr.message || 'Import failed and was rolled back.' }],
        warnings: validation.warnings,
        rolledBack: true,
        timestamp
      };
    }
  }

  /**
   * Generates sample downloadable CSV template for each entity
   */
  public getSampleTemplateCsv(entityType: ImportEntityType): string {
    switch (entityType) {
      case 'PRODUCTS':
        return `Product_Code,Name,Category,Size,Colour,Wholesale_Rate,Purchase_Rate,Sale_Rate,Opening_Stock,Min_Stock,GST_Percentage,HSN\n` +
          `OMB-SB-01,Heavy Duty School Bag,SCHOOL_BAG,Large,Navy Blue,150,110,220,50,10,18,4202\n` +
          `OMB-BP-02,Executive Laptop Backpack,OFFICE_BAG,Medium,Black,280,210,399,30,10,18,4202\n` +
          `OMB-TB-03,Duffel Travel Bag,TRAVEL_BAG,XL,Grey Red,220,165,320,25,5,18,4202`;

      case 'CUSTOMERS':
        return `Customer_Name,Business_Name,Mobile,WhatsApp,Address,City,State,GSTIN,Opening_Balance,Credit_Limit,Preferred_Transport\n` +
          `Raju Traders,Raju Bag Center,9830011223,9830011223,"12, MG Road",Kolkata,West Bengal,19ABCDE1234F1Z5,15000,50000,Kolkata Central Cargo\n` +
          `Bengal Distributors,Bengal Luggage,9830044556,9830044556,"Station Road",Siliguri,West Bengal,,8500,40000,Maa Tara Roadways`;

      case 'SUPPLIERS':
        return `Supplier_Name,Business_Name,Phone,Address,City,State,GSTIN,Opening_Balance\n` +
          `Evergreen Fabrics,Evergreen Textiles Ltd,9831122334,"Posta Market",Kolkata,West Bengal,19XYZAB1234C1Z9,25000\n` +
          `Supreme Zippers,Supreme Fasteners,9831998877,"Burrabazar",Kolkata,West Bengal,,12000`;

      case 'OPENING_BALANCES':
        return `Party_Name,Party_Type,Mobile,Opening_Balance\n` +
          `Raju Bag Center,CUSTOMER,9830011223,15000\n` +
          `Evergreen Fabrics,SUPPLIER,9831122334,25000`;

      case 'OPENING_STOCK':
        return `Product_Code,Product_Name,Opening_Stock\n` +
          `OMB-SB-01,Heavy Duty School Bag,120\n` +
          `OMB-BP-02,Executive Laptop Backpack,85`;

      case 'TRANSPORT':
        return `Transport_Name,Destination,Contact_Person,Phone,Godown_Address,Routes\n` +
          `Kolkata Central Cargo,Siliguri,Manoj Sharma,9830556677,"15 Pollock St, Kolkata","Siliguri, Malda, North Bengal"\n` +
          `Maa Tara Roadways,Patna,Alok Roy,9831998877,"Posta Transport Hub, Kolkata","Ranchi, Dhanbad, Patna"`;

      case 'HISTORICAL_RECORDS':
        return `Record_Type,Doc_Number,Date,Party_Name,Quantity,Total_Amount,Paid_Amount,Payment_Method\n` +
          `BILL,OMB-HIST-2025-01,2025-11-20,Raju Bag Center,25,3500,3500,CASH\n` +
          `EXPENSE,EXP-HIST-2025-01,2025-11-21,Counter Petty Cash,1,450,450,CASH`;

      default:
        return '';
    }
  }

  private getAffectedTables(entityType: ImportEntityType): TableName[] {
    switch (entityType) {
      case 'PRODUCTS':
        return ['products'];
      case 'CUSTOMERS':
        return ['customers'];
      case 'SUPPLIERS':
        return ['suppliers'];
      case 'OPENING_BALANCES':
        return ['customers', 'suppliers', 'customer_ledger', 'supplier_ledger'];
      case 'OPENING_STOCK':
        return ['products', 'stock_movements'];
      case 'TRANSPORT':
        return ['transport'];
      case 'HISTORICAL_RECORDS':
        return ['bills', 'expenses'];
      default:
        return [];
    }
  }
}

export const importService = new ImportService();
