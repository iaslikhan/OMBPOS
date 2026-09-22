/**
 * Exact Financial Mathematics Engine
 * All internal monetary calculations are performed in integer paise (1 Rupee = 100 Paise)
 * to strictly prevent IEEE 754 floating point arithmetic drift.
 */

export const paiseToRupees = (paise: number): number => {
  return Math.round(paise) / 100;
};

export const rupeesToPaise = (rupees: number | string): number => {
  if (typeof rupees === 'string') {
    const cleanStr = rupees.replace(/[^0-9.-]/g, '');
    const val = parseFloat(cleanStr);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }
  return Math.round(rupees * 100);
};

export const formatINR = (paise: number, showSymbol = true): string => {
  const rupees = paiseToRupees(paise);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  
  return showSymbol ? `₹${formatted}` : formatted;
};

export const formatIntegerINR = (paise: number, showSymbol = true): string => {
  const rupees = Math.round(paise / 100);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(rupees);
  
  return showSymbol ? `₹${formatted}` : formatted;
};

/**
 * Calculates line item total in paise:
 * totalPaise = quantity * ratePaise
 */
export const calculateLineTotalPaise = (quantity: number, ratePaise: number): number => {
  return Math.round(quantity * ratePaise);
};

/**
 * Calculates bill financial totals with exact paise precision.
 */
export interface BillCalculationResult {
  totalQuantity: number;
  subtotalPaise: number;
  discountPaise: number;
  gstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  balancePaise: number;
  previousDuePaise: number;
  newBalancePaise: number;
}

export const calculateBillFinancials = (params: {
  items: Array<{ quantity: number; ratePaise: number }>;
  discountPaise?: number;
  gstPaise?: number;
  paidPaise?: number;
  previousDuePaise?: number;
}): BillCalculationResult => {
  const totalQuantity = params.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotalPaise = params.items.reduce(
    (sum, item) => sum + calculateLineTotalPaise(item.quantity, item.ratePaise),
    0
  );

  const discountPaise = params.discountPaise || 0;
  const gstPaise = params.gstPaise || 0;
  const rawTotalPaise = Math.max(0, subtotalPaise - discountPaise + gstPaise);
  
  // Calculate round-off to nearest whole Rupee
  const roundedRupees = Math.round(rawTotalPaise / 100);
  const grandTotalPaise = roundedRupees * 100;
  const roundOffPaise = grandTotalPaise - rawTotalPaise;

  const paidPaise = params.paidPaise || 0;
  const balancePaise = grandTotalPaise - paidPaise;
  const previousDuePaise = params.previousDuePaise || 0;
  const newBalancePaise = previousDuePaise + balancePaise;

  return {
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
  };
};

/**
 * Sales / Private Label Item Code Formula:
 * Prefix "6" + integer selling price
 * Example: ₹120 -> 6120, ₹75 -> 675, ₹145 -> 6145
 * CRITICAL: The raw selling price must NEVER be displayed on this label.
 */
export const generateSalesItemCode = (ratePaise: number, customPrefix = '6'): string => {
  const integerRupees = Math.floor(ratePaise / 100);
  return `${customPrefix}${integerRupees}`;
};

/**
 * Sales Label Quantity Formula:
 * ceil(quantity / 6)
 * 1-6 = 1, 7-12 = 2, 13-18 = 3, 19-24 = 4, etc.
 */
export const calculateSalesLabelCount = (quantity: number): number => {
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / 6);
};

/**
 * Purchase Label Code Formula:
 * Prefix "786" + integer purchase rate
 * Example: ₹150 -> 786150, ₹120 -> 786120
 */
export const generatePurchaseCode = (purchaseRatePaise: number, customPrefix = '786'): string => {
  const integerRupees = Math.floor(purchaseRatePaise / 100);
  return `${customPrefix}${integerRupees}`;
};
