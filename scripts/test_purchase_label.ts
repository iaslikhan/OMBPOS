import { purchaseLabelService, PurchaseLabelItem } from '../src/services/purchaseLabelService';
import { DEFAULT_PURCHASE_LABEL_SETTINGS } from '../src/db/seedData';

console.log('====================================================');
console.log('🧪 PHASE 10: PURCHASE LABEL SYSTEM VERIFICATION TEST');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string, expected?: any, actual?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${desc} | Expected: ${expected}, Got: ${actual}`);
    failCount++;
  }
}

async function runTests() {
  // Test Set 1: User's Exact Specification Example (Cost ₹150, Selling ₹200, Prefix 786)
  console.log('1. User Specification Example Test (HYPORA, 300 Qty, Cost ₹150, Selling ₹200, Prefix 786)');
  const item1: PurchaseLabelItem = {
    productName: 'HYPORA',
    purchaseRateRupees: 150,
    sellingPriceRupees: 200,
    quantity: 300
  };

  const code1 = purchaseLabelService.encodePurchaseCode(item1.purchaseRateRupees, '786');
  assert(code1 === '786150', 'Code equals 786150', '786150', code1);

  const margin1 = purchaseLabelService.calculateMargin(150, 200);
  assert(margin1.marginAmount === 50, 'Margin amount is ₹50', 50, margin1.marginAmount);
  assert(margin1.marginPercentage === 33.33, 'Margin percentage is 33.33%', 33.33, margin1.marginPercentage);

  const count1 = purchaseLabelService.calculateLabelCount(item1.quantity, 'ONE_PER_PIECE');
  assert(count1 === 300, 'Labels count equals 300', 300, count1);

  const labels1 = await purchaseLabelService.generateLabelsForProduct(
    item1,
    DEFAULT_PURCHASE_LABEL_SETTINGS,
    'ONE_PER_PIECE'
  );
  assert(labels1.length === 300, 'Generated exactly 300 labels in array', 300, labels1.length);
  assert(labels1[0].brandName === 'ORIGINAL MODI BAGS', 'Brand name is ORIGINAL MODI BAGS', 'ORIGINAL MODI BAGS', labels1[0].brandName);
  assert(labels1[0].productName === 'HYPORA', 'Product name is HYPORA', 'HYPORA', labels1[0].productName);
  assert(labels1[0].purchaseCode === '786150', 'Item purchase code is 786150', '786150', labels1[0].purchaseCode);
  assert(labels1[0].rawRateRupees === 150, 'Purchase cost is ₹150', 150, labels1[0].rawRateRupees);
  assert(labels1[0].rawSellingPriceRupees === 200, 'Selling price is ₹200', 200, labels1[0].rawSellingPriceRupees);
  assert(labels1[0].sellingPriceDisplay === '₹200', 'Customer label displays Selling Price ₹200', '₹200', labels1[0].sellingPriceDisplay);
  assert(labels1[0].marginRupees === 50, 'Label margin amount is ₹50', 50, labels1[0].marginRupees);
  assert(labels1[0].marginPercentage === 33.33, 'Label margin percentage is 33.33%', 33.33, labels1[0].marginPercentage);
  assert(labels1[0].barcodeData === '786150', 'Barcode payload is 786150', '786150', labels1[0].barcodeData);

  // Test Set 2: Rate variations
  console.log('\n2. Rate Variations (Prefix 786)');
  const testRates = [
    { rate: 75, expected: '78675' },
    { rate: 120, expected: '786120' },
    { rate: 145, expected: '786145' },
    { rate: 180, expected: '786180' },
    { rate: 750, expected: '786750' },
    { rate: 1250, expected: '7861250' }
  ];

  for (const tr of testRates) {
    const encoded = purchaseLabelService.encodePurchaseCode(tr.rate, '786');
    assert(encoded === tr.expected, `Rate ₹${tr.rate} encodes to ${tr.expected}`, tr.expected, encoded);
  }

  // Test Set 3: Quantity Modes (One Per Piece, Bundle / Carton, Manual)
  console.log('\n3. Quantity Modes');
  const pieceCount = purchaseLabelService.calculateLabelCount(300, 'ONE_PER_PIECE');
  assert(pieceCount === 300, 'ONE_PER_PIECE: 300 pcs -> 300 labels', 300, pieceCount);

  const bundleCount1 = purchaseLabelService.calculateLabelCount(300, 'ONE_PER_BUNDLE', 25);
  assert(bundleCount1 === 12, 'ONE_PER_BUNDLE: 300 pcs / 25 per bundle -> 12 labels', 12, bundleCount1);

  const bundleCount2 = purchaseLabelService.calculateLabelCount(100, 'ONE_PER_BUNDLE', 12);
  assert(bundleCount2 === 9, 'ONE_PER_BUNDLE: 100 pcs / 12 per bundle -> ceil(100/12) = 9 labels', 9, bundleCount2);

  const manualCount = purchaseLabelService.calculateLabelCount(300, 'MANUAL', 25, 15);
  assert(manualCount === 15, 'MANUAL: explicit 15 labels -> 15', 15, manualCount);

  // Test Set 4: Range Filter & Reprinting
  console.log('\n4. Range Filter & Reprinting');
  const rangeLabels = await purchaseLabelService.generateLabelsForProduct(
    item1,
    DEFAULT_PURCHASE_LABEL_SETTINGS,
    'ONE_PER_PIECE',
    25,
    1,
    50,
    100,
    true // isReprint
  );
  assert(rangeLabels.length === 51, 'Range 50 to 100 generates 51 labels', 51, rangeLabels.length);
  assert(rangeLabels[0].labelIndex === 50, 'First label has index 50', 50, rangeLabels[0].labelIndex);
  assert(rangeLabels[50].labelIndex === 100, 'Last label has index 100', 100, rangeLabels[50].labelIndex);
  assert(rangeLabels[0].isReprint === true, 'isReprint flag correctly preserved', true, rangeLabels[0].isReprint);

  // Test Set 5: Barcode SVG Generation
  console.log('\n5. Vector Barcode SVG Generation');
  const barcodeSvg = purchaseLabelService.generateCode128Svg('786150');
  assert(barcodeSvg.includes('<svg'), 'Barcode output is a valid SVG element', true, barcodeSvg.includes('<svg'));
  assert(barcodeSvg.includes('<rect'), 'Barcode SVG contains rendered bars (<rect>)', true, barcodeSvg.includes('<rect'));

  // Test Set 6: ESC/POS Thermal Commands
  console.log('\n6. ESC/POS Thermal Commands Generator');
  const escPosBytes = purchaseLabelService.generateThermalEscPosCommands(labels1[0]);
  assert(escPosBytes instanceof Uint8Array, 'Returns Uint8Array binary stream', true, escPosBytes instanceof Uint8Array);
  assert(escPosBytes.length > 20, 'Binary payload contains header, text, barcode, and cut bytes', true, escPosBytes.length > 20);

  // Summary
  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
