/**
 * Phase 10: Purchase Label System Service
 * 
 * Implements:
 * - Purchase code encoding: Prefix (default "786") + integer purchase rate (e.g., 150 -> 786150)
 * - Label structure:
 *     ORIGINAL MODI BAGS
 *     HYPORA
 *     CODE: 786150
 *     RATE: ₹150
 *     BARCODE
 * - Default: 1 piece = 1 label (e.g. 300 pcs = 300 labels)
 * - Modes: 1 piece = 1 label, Carton/bundle mode (e.g. 1 per 25 pcs), Manual quantity
 * - Print All, Print Range, Reprint, PDF, Preview
 * - CRITICAL: Pure document generation — zero side effects on inventory, supplier balances, or financial records.
 */

import { PurchaseLabelSettings } from '../types';
import { DEFAULT_PURCHASE_LABEL_SETTINGS } from '../db/seedData';
import QRCode from 'qrcode';

export interface PurchaseLabelItem {
  id?: string;
  productName: string;
  productCode?: string;
  purchaseRateRupees: number;
  sellingPriceRupees?: number;
  quantity: number;
  supplierName?: string;
  invoiceNumber?: string;
  batchNumber?: string;
  date?: number;
}

export type PurchaseLabelMode = 'ONE_PER_PIECE' | 'ONE_PER_BUNDLE' | 'MANUAL';

export interface GeneratedPurchaseLabel {
  id: string;
  labelIndex: number;
  totalLabelsInBatch: number;
  brandName: string;
  productName: string;
  purchaseCode: string; // e.g. "786150"
  purchaseRateDisplay: string; // e.g. "₹150" (internal / encoded)
  rawRateRupees: number; // Raw purchase cost
  rawSellingPriceRupees: number; // Customer selling price
  sellingPriceDisplay: string; // e.g. "₹200"
  marginRupees: number; // e.g. ₹50
  marginPercentage: number; // e.g. 33.33%
  barcodeType: 'CODE128' | 'QR';
  barcodeData: string;
  barcodeSvg: string;
  qrDataUrl?: string;
  bundleInfo?: string;
  supplierName?: string;
  invoiceNumber?: string;
  batchNumber?: string;
  dateFormatted?: string;
  isReprint?: boolean;
  paperSize: string;
}

export class PurchaseLabelService {
  private static instance: PurchaseLabelService;

  private constructor() {}

  public static getInstance(): PurchaseLabelService {
    if (!PurchaseLabelService.instance) {
      PurchaseLabelService.instance = new PurchaseLabelService();
    }
    return PurchaseLabelService.instance;
  }

  /**
   * Calculate profit margin amount and percentage:
   * Margin Amount = Selling Price - Purchase Price
   * Margin Percentage = ((Selling Price - Purchase Price) / Purchase Price) * 100
   */
  public calculateMargin(purchasePriceRupees: number, sellingPriceRupees: number): {
    marginAmount: number;
    marginPercentage: number;
  } {
    const purchase = Number(purchasePriceRupees) || 0;
    const selling = Number(sellingPriceRupees) || 0;
    const marginAmount = selling - purchase;
    const marginPercentage = purchase > 0 ? (marginAmount / purchase) * 100 : 0;
    return {
      marginAmount: Math.round(marginAmount * 100) / 100,
      marginPercentage: Math.round(marginPercentage * 100) / 100
    };
  }

  /**
   * Encodes purchase rate with prefix:
   * Example: 150 with prefix "786" -> "786150"
   */
  public encodePurchaseCode(rateRupees: number, prefix: string = '786'): string {
    const cleanPrefix = (prefix || '786').trim();
    const integerPrice = Math.round(Number(rateRupees) || 0);
    return `${cleanPrefix}${integerPrice}`;
  }

  /**
   * Calculates the number of labels required based on mode:
   * - ONE_PER_PIECE: 1 piece = 1 label (e.g. 300 qty -> 300 labels)
   * - ONE_PER_BUNDLE: ceil(quantity / bundleSize) (e.g. 300 qty / 25 -> 12 labels)
   * - MANUAL: user-specified count
   */
  public calculateLabelCount(
    quantity: number,
    mode: PurchaseLabelMode = 'ONE_PER_PIECE',
    bundleSize: number = 10,
    manualCount: number = 1
  ): number {
    const cleanQty = Math.max(1, Math.round(quantity || 1));
    switch (mode) {
      case 'ONE_PER_PIECE':
        return cleanQty;
      case 'ONE_PER_BUNDLE':
        return Math.max(1, Math.ceil(cleanQty / Math.max(1, bundleSize)));
      case 'MANUAL':
        return Math.max(1, Math.round(manualCount || 1));
      default:
        return cleanQty;
    }
  }

  /**
   * Generate an array of labels for a product/purchase item.
   * Supports range filtering (e.g. print from label #10 to #50).
   */
  public async generateLabelsForProduct(
    item: PurchaseLabelItem,
    settings: PurchaseLabelSettings = DEFAULT_PURCHASE_LABEL_SETTINGS,
    mode: PurchaseLabelMode = 'ONE_PER_PIECE',
    bundleSize: number = 10,
    manualCount: number = 1,
    rangeFrom: number = 1,
    rangeTo?: number,
    isReprint: boolean = false
  ): Promise<GeneratedPurchaseLabel[]> {
    const totalCount = this.calculateLabelCount(item.quantity, mode, bundleSize, manualCount);
    const purchaseCode = this.encodePurchaseCode(item.purchaseRateRupees, settings.prefix);
    const rawPurchaseRate = Math.round(item.purchaseRateRupees || 0);
    const rawSellingPrice = item.sellingPriceRupees !== undefined && item.sellingPriceRupees > 0
      ? Math.round(item.sellingPriceRupees)
      : rawPurchaseRate;

    const { marginAmount, marginPercentage } = this.calculateMargin(rawPurchaseRate, rawSellingPrice);

    const purchaseRateDisplay = `₹${rawPurchaseRate}`;
    const sellingPriceDisplay = `₹${rawSellingPrice}`;
    const brandName = 'ORIGINAL MODI BAGS';

    // Generate Code 128 SVG for vector sharpness
    const barcodeSvg = this.generateCode128Svg(purchaseCode, 36);

    // Optional QR code data URL
    let qrDataUrl: string | undefined;
    if (settings.barcodeType === 'QR') {
      try {
        qrDataUrl = await QRCode.toDataURL(purchaseCode, {
          margin: 1,
          width: 120,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (err) {
        console.warn('[PurchaseLabelService] QR generation fallback:', err);
      }
    }

    const labels: GeneratedPurchaseLabel[] = [];
    const dateFormatted = item.date
      ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const from = Math.max(1, Math.min(rangeFrom, totalCount));
    const to = Math.max(from, Math.min(rangeTo || totalCount, totalCount));

    for (let i = from; i <= to; i++) {
      let bundleInfo: string | undefined;
      if (mode === 'ONE_PER_BUNDLE') {
        const startPiece = (i - 1) * bundleSize + 1;
        const endPiece = Math.min(i * bundleSize, item.quantity);
        bundleInfo = `Bundle #${i} (${startPiece}-${endPiece} of ${item.quantity} PCS)`;
      } else if (mode === 'ONE_PER_PIECE') {
        bundleInfo = `Piece ${i} of ${totalCount}`;
      } else {
        bundleInfo = `Tag ${i} of ${totalCount}`;
      }

      labels.push({
        id: `plabel-${item.productName}-${purchaseCode}-${i}-${Date.now()}`,
        labelIndex: i,
        totalLabelsInBatch: totalCount,
        brandName,
        productName: item.productName || 'PRODUCT',
        purchaseCode,
        purchaseRateDisplay,
        rawRateRupees: rawPurchaseRate,
        rawSellingPriceRupees: rawSellingPrice,
        sellingPriceDisplay,
        marginRupees: marginAmount,
        marginPercentage,
        barcodeType: settings.barcodeType,
        barcodeData: purchaseCode,
        barcodeSvg,
        qrDataUrl,
        bundleInfo,
        supplierName: settings.showSupplier ? item.supplierName : undefined,
        invoiceNumber: settings.showInvoice ? item.invoiceNumber : undefined,
        batchNumber: settings.showBatch ? item.batchNumber : undefined,
        dateFormatted: settings.showDate ? dateFormatted : undefined,
        isReprint,
        paperSize: settings.paperSize || '50x30 mm'
      });
    }

    return labels;
  }

  /**
   * Code 128 Pattern generator for sharp SVG vector barcodes
   */
  public generateCode128Svg(text: string, height: number = 36): string {
    const code = text.trim();
    const pattern = this.getCode128Pattern(code);

    const barWidth = 2;
    const totalWidth = pattern.length * barWidth;

    let svgBars = '';
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        svgBars += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="${height}" style="display:block;margin:auto;">
      ${svgBars}
    </svg>`;
  }

  private getCode128Pattern(text: string): string {
    const patterns: { [key: string]: string } = {
      '0': '10011101100', '1': '10010001100', '2': '10010011000', '3': '10110010000',
      '4': '10110001000', '5': '10001101100', '6': '10001100100', '7': '10110110000',
      '8': '10110001100', '9': '10001101000', 'A': '10100011000', 'B': '10100001100',
      'C': '10010110000', 'D': '10010001100', 'E': '10001011000', 'F': '10001000110',
      'G': '10110100000', 'H': '10110000100', 'I': '10001101000', 'J': '10001100010',
      'START_B': '11010010000',
      'STOP': '1100011101011'
    };

    let fullPattern = patterns['START_B'];
    for (let i = 0; i < text.length; i++) {
      const char = text[i].toUpperCase();
      fullPattern += patterns[char] || patterns['0'];
    }
    fullPattern += patterns['STOP'];
    return fullPattern;
  }

  /**
   * Generate raw ESC/POS command byte buffer for 50x30mm thermal label printers
   */
  public generateThermalEscPosCommands(label: GeneratedPurchaseLabel): Uint8Array {
    const bytes: number[] = [];

    // ESC @ (Initialize printer)
    bytes.push(0x1B, 0x40);

    // ESC a 1 (Center alignment)
    bytes.push(0x1B, 0x61, 0x01);

    // Brand Name: ORIGINAL MODI BAGS
    bytes.push(0x1B, 0x45, 0x01); // Bold ON
    bytes.push(0x1D, 0x21, 0x00); // Standard font size
    this.addAscii(bytes, `${label.brandName}\n`);

    // Product Name (Double height / bold)
    bytes.push(0x1D, 0x21, 0x01); // Double height
    this.addAscii(bytes, `${label.productName}\n`);
    bytes.push(0x1D, 0x21, 0x00); // Normal size

    // Details line: CODE: 786150 | PRICE: ₹200 (Selling Price for customer, Purchase Code encoded)
    this.addAscii(bytes, `CODE: ${label.purchaseCode}  PRICE: ${label.sellingPriceDisplay}\n`);
    bytes.push(0x1B, 0x45, 0x00); // Bold OFF

    // Bundle or piece marker
    if (label.bundleInfo) {
      this.addAscii(bytes, `[ ${label.bundleInfo} ]\n`);
    }

    // Barcode: GS k 73 (Code 128)
    bytes.push(0x1D, 0x77, 0x02); // Width 2
    bytes.push(0x1D, 0x68, 0x28); // Height 40
    bytes.push(0x1D, 0x48, 0x02); // HRI text below barcode
    const codeData = label.purchaseCode;
    bytes.push(0x1D, 0x6B, 0x49, codeData.length);
    this.addAscii(bytes, codeData);

    // If reprint, print duplicate banner
    if (label.isReprint) {
      this.addAscii(bytes, `\n* REPRINT PURCHASE TAG *\n`);
    }

    // Line feed & feed to tear bar
    bytes.push(0x1B, 0x64, 0x02);
    bytes.push(0x1D, 0x56, 0x00); // Cut / feed

    return new Uint8Array(bytes);
  }

  private addAscii(arr: number[], str: string) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      arr.push(code > 127 ? 32 : code); // replace non-ascii like ₹ with space
    }
  }
}

export const purchaseLabelService = PurchaseLabelService.getInstance();
