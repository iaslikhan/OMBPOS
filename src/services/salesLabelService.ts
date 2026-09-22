/**
 * Original Modi Bags - Phase 9 Private Sales Label Service
 * 
 * CRITICAL BUSINESS RULE:
 * Never show actual selling price on bag sales labels.
 * Encoding formula: "6" + integer price
 * 
 * Mandatory Examples:
 * 120 -> 6120
 * 75  -> 675
 * 145 -> 6145
 * 180 -> 6180
 * 750 -> 6750
 * 
 * Label Structure:
 * - ORIGINAL MODI BAGS
 * - PRODUCT
 * - ITEM CODE (e.g. 6120)
 * - BARCODE
 * 
 * Quantity Rules:
 * - Automatic: ceil(quantity / 6) [Bundles of 6 bags]
 * - One per piece: 1 label per piece
 * - Manual count: custom user count
 */

import QRCode from 'qrcode';
import { SalesLabelSettings } from '../types';

export interface BagLabelItem {
  id: string;
  productName: string;
  productCode?: string;
  category?: string;
  actualRateRupees: number; // For internal encoding ONLY, never displayed!
  quantity: number;
}

export interface GeneratedBagLabel {
  id: string;
  brandName: string;
  productName: string;
  itemCode: string; // The private encoded code, e.g. "6120"
  barcodeData: string;
  barcodeSvg: string;
  qrDataUrl?: string;
  copyIndex: number;
  totalCopies: number;
  bundleQuantityNote?: string;
}

export type LabelQuantityMode = 'AUTOMATIC' | 'ONE_PER_PIECE' | 'MANUAL';

export class SalesLabelService {
  private static instance: SalesLabelService;

  private constructor() {}

  public static getInstance(): SalesLabelService {
    if (!SalesLabelService.instance) {
      SalesLabelService.instance = new SalesLabelService();
    }
    return SalesLabelService.instance;
  }

  /**
   * CRITICAL: Encodes selling price using "6" + integer price.
   * Examples:
   * 120 -> "6120"
   * 75  -> "675"
   * 145 -> "6145"
   * 180 -> "6180"
   * 750 -> "6750"
   */
  public encodeSalesPrice(priceInRupees: number, prefix: string = '6'): string {
    const integerPrice = Math.round(Number(priceInRupees) || 0);
    return `${prefix}${integerPrice}`;
  }

  /**
   * Calculates the number of labels according to wholesale bundle rules.
   * Default wholesale bundle size = 6 bags.
   */
  public calculateLabelCount(
    pieceQuantity: number, 
    mode: LabelQuantityMode, 
    manualCount?: number
  ): number {
    const qty = Math.max(0, Number(pieceQuantity) || 0);
    if (mode === 'AUTOMATIC') {
      // ceil(quantity / 6)
      return Math.max(1, Math.ceil(qty / 6));
    }
    if (mode === 'ONE_PER_PIECE') {
      return Math.max(1, qty);
    }
    return Math.max(1, Number(manualCount) || 1);
  }

  /**
   * Generates crisp Code 128 (Subset B) SVG representation.
   * Encodes ONLY the private item code, never raw selling price.
   */
  public generateCode128Svg(code: string, height: number = 40): string {
    const cleanCode = String(code).trim();
    const pattern = this.getCode128Pattern(cleanCode);
    
    const barWidth = 2;
    const totalWidth = pattern.length * barWidth;

    let svgBars = '';
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        svgBars += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" style="display:block;margin:auto;">
      ${svgBars}
    </svg>`;
  }

  /**
   * Generates QR Code data URL for 2D barcode scanning.
   */
  public async generateQrCodeDataUrl(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 128,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.warn('[SalesLabelService] QR Generation failed:', err);
      return '';
    }
  }

  /**
   * Generates complete set of private bag labels for a product.
   */
  public async generateLabelsForProduct(
    product: BagLabelItem,
    settings: SalesLabelSettings,
    quantityMode: LabelQuantityMode = 'AUTOMATIC',
    manualCount?: number
  ): Promise<GeneratedBagLabel[]> {
    const prefix = settings.prefix || '6';
    const itemCode = this.encodeSalesPrice(product.actualRateRupees, prefix);
    const labelCount = this.calculateLabelCount(product.quantity, quantityMode, manualCount);

    const barcodeSvg = this.generateCode128Svg(itemCode, 36);
    let qrDataUrl = '';
    if (settings.barcodeType === 'QR') {
      qrDataUrl = await this.generateQrCodeDataUrl(itemCode);
    }

    const labels: GeneratedBagLabel[] = [];
    for (let i = 1; i <= labelCount; i++) {
      labels.push({
        id: `label-${product.id}-${i}-${Date.now()}`,
        brandName: settings.showBusinessName ? 'ORIGINAL MODI BAGS' : '',
        productName: product.productName,
        itemCode,
        barcodeData: itemCode,
        barcodeSvg,
        qrDataUrl,
        copyIndex: i,
        totalCopies: labelCount,
        bundleQuantityNote: quantityMode === 'AUTOMATIC' ? 'BUNDLE OF 6' : undefined
      });
    }

    return labels;
  }

  /**
   * Generates ESC/POS thermal command stream for 50x30mm or 40x30mm label stickers.
   * Absolutely NO raw price is written to the command buffer.
   */
  public generateThermalEscPosCommands(label: GeneratedBagLabel): Uint8Array {
    const bytes: number[] = [];

    // ESC @ - Initialize
    bytes.push(0x1B, 0x40);

    // ESC a 1 - Center Align
    bytes.push(0x1B, 0x61, 0x01);

    // Brand Name: ORIGINAL MODI BAGS
    bytes.push(0x1B, 0x45, 0x01); // Bold on
    this.addAscii(bytes, 'ORIGINAL MODI BAGS\n');
    bytes.push(0x1B, 0x45, 0x00); // Bold off

    // Product Name
    this.addAscii(bytes, `${label.productName.toUpperCase()}\n`);

    // Divider
    this.addAscii(bytes, '----------------------\n');

    // Private Item Code (Double height & Double width)
    bytes.push(0x1D, 0x21, 0x11);
    bytes.push(0x1B, 0x45, 0x01); // Bold on
    this.addAscii(bytes, `${label.itemCode}\n`);
    bytes.push(0x1D, 0x21, 0x00); // Normal size
    bytes.push(0x1B, 0x45, 0x00); // Bold off

    // Barcode: GS k (CODE128)
    // GS w 2 (width)
    bytes.push(0x1D, 0x77, 0x02);
    // GS h 50 (height)
    bytes.push(0x1D, 0x68, 0x32);
    // GS H 2 (HRI characters below barcode)
    bytes.push(0x1D, 0x48, 0x02);
    // GS k 73 (Code 128) length + data
    const codeData = label.itemCode;
    bytes.push(0x1D, 0x6B, 0x49, codeData.length);
    this.addAscii(bytes, codeData);

    // Line feed and cut
    bytes.push(0x1B, 0x64, 0x02);
    bytes.push(0x1D, 0x56, 0x00); // Cut

    return new Uint8Array(bytes);
  }

  /**
   * CRITICAL SECURITY VERIFICATION:
   * Inspects rendered text, HTML, and barcode data to verify that the
   * actual selling price NEVER appears anywhere.
   */
  public verifyZeroPriceLeak(
    renderedContent: string, 
    actualPriceRupees: number
  ): { passed: boolean; detectedLeakedPatterns: string[] } {
    const rawPrice = Math.round(actualPriceRupees);
    const leakedPatterns: string[] = [];

    // Patterns that would indicate a leak of the raw price:
    const dangerousPatterns = [
      `₹${rawPrice}`,
      `₹ ${rawPrice}`,
      `Rs.${rawPrice}`,
      `Rs. ${rawPrice}`,
      `INR ${rawPrice}`,
      `Price: ${rawPrice}`,
      `Rate: ${rawPrice}`,
      `Rate : ${rawPrice}`,
      `>${rawPrice}<`,
      `"${rawPrice}.00"`,
      `₹${rawPrice}.00`
    ];

    // Check dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (renderedContent.includes(pattern)) {
        leakedPatterns.push(pattern);
      }
    }

    // Also check if raw price exists as an isolated token not preceded by '6'
    // E.g. " 120 " or ">120<" vs "6120"
    // Note: Strip SVG visual geometry coordinates like <rect x="120" /> or viewBox="0 0 120 40" so visual geometry isn't confused with price
    const textToCheck = renderedContent
      .replace(/<rect\s+[^>]*\/>/gi, '')
      .replace(/viewBox="[^"]*"/gi, '')
      .replace(/width="[^"]*"/gi, '');

    const isolatedRegex = new RegExp(`(?<![60-9])${rawPrice}(?![0-9])`, 'g');
    const matches = textToCheck.match(isolatedRegex);
    if (matches && matches.length > 0) {
      // Confirm it's not part of another valid number
      leakedPatterns.push(`Isolated raw price number: ${rawPrice}`);
    }

    return {
      passed: leakedPatterns.length === 0,
      detectedLeakedPatterns: leakedPatterns
    };
  }

  /**
   * Run full security audit test suite.
   */
  public async runSecurityAuditSuite(): Promise<{
    tested: boolean;
    allPassed: boolean;
    results: Array<{ test: string; passed: boolean; expected: any; actual: any }>;
  }> {
    const tests = this.runSelfTests();
    return {
      tested: true,
      allPassed: tests.allPassed,
      results: tests.results
    };
  }

  /**
   * Automated self-test verifying all 5 user examples and quantity logic:
   * - 120 -> 6120
   * - 75  -> 675
   * - 145 -> 6145
   * - 180 -> 6180
   * - 750 -> 6750
   * - ceil(quantity / 6)
   */
  public runSelfTests(): {
    allPassed: boolean;
    results: Array<{ test: string; passed: boolean; expected: any; actual: any }>;
  } {
    const testCases = [
      { input: 120, expected: '6120' },
      { input: 75, expected: '675' },
      { input: 145, expected: '6145' },
      { input: 180, expected: '6180' },
      { input: 750, expected: '6750' }
    ];

    const results: Array<{ test: string; passed: boolean; expected: any; actual: any }> = [];

    // 1. Price Encoding Tests
    for (const tc of testCases) {
      const actual = this.encodeSalesPrice(tc.input);
      const passed = actual === tc.expected;
      results.push({
        test: `Encode price ₹${tc.input} → ${tc.expected}`,
        passed,
        expected: tc.expected,
        actual
      });
    }

    // 2. Quantity Ceiling Tests: ceil(qty / 6)
    const qtyCases = [
      { qty: 12, expected: 2 },
      { qty: 6, expected: 1 },
      { qty: 7, expected: 2 },
      { qty: 1, expected: 1 },
      { qty: 18, expected: 3 },
      { qty: 19, expected: 4 },
      { qty: 100, expected: 17 }
    ];

    for (const qc of qtyCases) {
      const actual = this.calculateLabelCount(qc.qty, 'AUTOMATIC');
      const passed = actual === qc.expected;
      results.push({
        test: `Automatic label count for ${qc.qty} bags = ceil(${qc.qty}/6)`,
        passed,
        expected: qc.expected,
        actual
      });
    }

    // 3. Security Leak Test
    const sampleHtml = `<div class="bag-label">
      <h1>ORIGINAL MODI BAGS</h1>
      <h2>HYPORA</h2>
      <div class="code">6120</div>
      <svg></svg>
    </div>`;
    const leakCheck = this.verifyZeroPriceLeak(sampleHtml, 120);
    results.push({
      test: 'Zero Price Leak Verification (₹120 hidden, 6120 shown)',
      passed: leakCheck.passed,
      expected: 'No price leaks',
      actual: leakCheck.passed ? 'PASSED (0 leaks)' : leakCheck.detectedLeakedPatterns.join(', ')
    });

    const allPassed = results.every((r) => r.passed);
    return { allPassed, results };
  }

  private addAscii(buffer: number[], text: string) {
    for (let i = 0; i < text.length; i++) {
      buffer.push(text.charCodeAt(i) & 0xff);
    }
  }

  /**
   * Code 128 subset B simple pattern table for ASCII 48-57 (0-9) and basic chars.
   */
  private getCode128Pattern(text: string): string {
    // Standard Code 128B start pattern, digits, and stop pattern
    const patterns: Record<string, string> = {
      '0': '10011101100',
      '1': '10010001100',
      '2': '10010011000',
      '3': '10110010000',
      '4': '10110000100',
      '5': '10001101000',
      '6': '10001100010',
      '7': '11001001000',
      '8': '11001000010',
      '9': '11011001000',
      '-': '10100011000',
      START_B: '11010010000',
      STOP: '1100011101011'
    };

    let result = patterns['START_B'];
    for (const char of text) {
      result += patterns[char] || patterns['0'];
    }
    result += patterns['STOP'];
    return result;
  }
}

export const salesLabelService = SalesLabelService.getInstance();
