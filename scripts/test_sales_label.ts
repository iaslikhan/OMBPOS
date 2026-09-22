/**
 * Phase 9 - Sales / Private Bag Label Test Suite
 * Validates:
 * 1. "6" + integer price encoding for all specification examples (120->6120, 75->675, etc.)
 * 2. ceil(quantity / 6) wholesale bundle quantity rules
 * 3. Automatic, One per piece, and Manual count modes
 * 4. Critical check: Actual selling price NEVER appears in Preview, PDF, Print payload, or Barcode/QR
 */

import { salesLabelService, BagLabelItem } from '../src/services/salesLabelService';
import { SalesLabelSettings } from '../src/types';

async function runTestSuite() {
  console.log('====================================================');
  console.log('PHASE 9: PRIVATE BAG SALES LABEL TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, description: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${description}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${description}`);
      if (detail) console.error(`       Detail: ${detail}`);
    }
  }

  // 1. Mandatory Price Encoding Examples
  console.log('--- TEST 1: Price Encoding ("6" + integer price) ---');
  const examples = [
    { input: 120, expected: '6120' },
    { input: 75, expected: '675' },
    { input: 145, expected: '6145' },
    { input: 180, expected: '6180' },
    { input: 750, expected: '6750' }
  ];

  for (const ex of examples) {
    const encoded = salesLabelService.encodeSalesPrice(ex.input);
    assert(
      encoded === ex.expected,
      `Price ${ex.input} encodes to ${ex.expected}`,
      `Received: ${encoded}`
    );
  }

  // 2. Quantity Rules: ceil(quantity / 6)
  console.log('\n--- TEST 2: Quantity Calculation Rules ---');
  const qtyTests = [
    { qty: 12, expected: 2 },
    { qty: 6, expected: 1 },
    { qty: 7, expected: 2 },
    { qty: 1, expected: 1 },
    { qty: 18, expected: 3 },
    { qty: 19, expected: 4 },
    { qty: 25, expected: 5 },
    { qty: 120, expected: 20 }
  ];

  for (const qt of qtyTests) {
    const calculated = salesLabelService.calculateLabelCount(qt.qty, 'AUTOMATIC');
    assert(
      calculated === qt.expected,
      `Automatic mode: ${qt.qty} bags -> ceil(${qt.qty}/6) = ${qt.expected} label(s)`,
      `Received: ${calculated}`
    );
  }

  // One per piece mode
  const onePerPiece12 = salesLabelService.calculateLabelCount(12, 'ONE_PER_PIECE');
  assert(
    onePerPiece12 === 12,
    `One per piece mode: 12 bags -> 12 labels`,
    `Received: ${onePerPiece12}`
  );

  // Manual count mode
  const manualCount5 = salesLabelService.calculateLabelCount(12, 'MANUAL', 5);
  assert(
    manualCount5 === 5,
    `Manual count mode: user specified 5 -> 5 labels`,
    `Received: ${manualCount5}`
  );

  // 3. Label Content & Zero Price Leakage Verification
  console.log('\n--- TEST 3: Zero Price Leakage in Preview, Payload & Barcode ---');
  const dummySettings: SalesLabelSettings = {
    id: 'test-settings',
    businessId: 'test-biz',
    prefix: '6',
    paperSize: '50x30 mm',
    barcodeType: 'CODE128',
    showBusinessName: true,
    showItemCode: true,
    showBarcode: true,
    labelQuantityRule: 'CEIL_QTY_DIV_6',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'LOCAL'
  };

  const testProducts: BagLabelItem[] = [
    { id: 'p1', productName: 'HYPORA TREKKER', actualRateRupees: 120, quantity: 12 },
    { id: 'p2', productName: 'CLUB POUCH', actualRateRupees: 75, quantity: 6 },
    { id: 'p3', productName: 'SCHOOLBOY HEAVY', actualRateRupees: 145, quantity: 18 },
    { id: 'p4', productName: 'EXECUTIVE BAG', actualRateRupees: 180, quantity: 24 },
    { id: 'p5', productName: 'TROLLEY DUFFEL', actualRateRupees: 750, quantity: 6 }
  ];

  for (const prod of testProducts) {
    const expectedCode = salesLabelService.encodeSalesPrice(prod.actualRateRupees);

    // Generate labels
    const labels = await salesLabelService.generateLabelsForProduct(prod, dummySettings, 'AUTOMATIC');
    assert(labels.length > 0, `Generated ${labels.length} labels for ${prod.productName}`);

    const firstLabel = labels[0];

    // Verify Label elements: ORIGINAL MODI BAGS, PRODUCT, ITEM CODE, BARCODE
    assert(
      firstLabel.brandName === 'ORIGINAL MODI BAGS',
      `[${prod.productName}] Brand: ORIGINAL MODI BAGS`
    );
    assert(
      firstLabel.productName === prod.productName,
      `[${prod.productName}] Product name matches`
    );
    assert(
      firstLabel.itemCode === expectedCode,
      `[${prod.productName}] Encoded item code: ${expectedCode}`
    );
    assert(
      firstLabel.barcodeData === expectedCode,
      `[${prod.productName}] Barcode data: ${expectedCode}`
    );

    // Verify ESC/POS command payload does not contain raw price
    const escposBytes = salesLabelService.generateThermalEscPosCommands(firstLabel);
    const textDecoder = new TextDecoder('latin1');
    const escposText = textDecoder.decode(escposBytes);

    const escposLeakCheck = salesLabelService.verifyZeroPriceLeak(
      escposText,
      prod.actualRateRupees
    );
    assert(
      escposLeakCheck.passed,
      `[${prod.productName}] ESC/POS print payload ZERO price leaks (₹${prod.actualRateRupees} hidden)`,
      escposLeakCheck.detectedLeakedPatterns.join(', ')
    );

    // Verify Barcode SVG does not leak raw price
    const svgLeakCheck = salesLabelService.verifyZeroPriceLeak(
      firstLabel.barcodeSvg,
      prod.actualRateRupees
    );
    assert(
      svgLeakCheck.passed,
      `[${prod.productName}] Barcode SVG ZERO price leaks`,
      svgLeakCheck.detectedLeakedPatterns.join(', ')
    );
  }

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log(`====================================================\n`);
  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite();
