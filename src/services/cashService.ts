/**
 * Cash & Drawer Management Service
 *
 * Implements strict cash register rules:
 * - Inflows and outflows to Physical Cash Drawer.
 * - CRITICAL RULE: Non-cash payment methods (UPI, BANK, CHEQUE, CREDIT) MUST NOT modify physical cash!
 * - Only CASH payment method generates CashTransaction records for sales, purchases, or expenses.
 */

import { CashTransaction, CashTransactionType, PaymentMethod } from '../types';
import { roomDb } from '../db/indexedDbRoom';

export interface CashBalanceSummary {
  totalInflowPaise: number;
  totalOutflowPaise: number;
  computedCashBalancePaise: number;
  transactions: CashTransaction[];
}

/**
 * Pure calculation function for physical cash register:
 * Cash Balance = Total Inflows - Total Outflows
 */
export function computePhysicalCashBalance(transactions: CashTransaction[]): CashBalanceSummary {
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  let runningBalance = 0;
  let totalInflowPaise = 0;
  let totalOutflowPaise = 0;

  const orderedTransactions: CashTransaction[] = [];

  for (const tx of sorted) {
    totalInflowPaise += tx.inflowPaise || 0;
    totalOutflowPaise += tx.outflowPaise || 0;
    runningBalance = runningBalance + (tx.inflowPaise || 0) - (tx.outflowPaise || 0);

    orderedTransactions.push({
      ...tx,
      runningCashBalancePaise: runningBalance
    });
  }

  return {
    totalInflowPaise,
    totalOutflowPaise,
    computedCashBalancePaise: runningBalance,
    transactions: orderedTransactions
  };
}

/**
 * Records a cash movement into or out of the physical drawer.
 * If the payment method is NOT 'CASH', this operation is safely a NO-OP for physical cash.
 */
export async function recordPhysicalCashMovement(params: {
  type: CashTransactionType;
  description: string;
  inflowPaise: number;
  outflowPaise: number;
  paymentMethod: PaymentMethod;
  referenceId?: string;
  date?: number;
}): Promise<CashTransaction | null> {
  // CRITICAL SPEC REQUIREMENT:
  // Non-cash payment methods MUST NOT modify physical cash!
  if (params.paymentMethod !== 'CASH') {
    return null;
  }

  if (params.inflowPaise === 0 && params.outflowPaise === 0) {
    return null;
  }

  const existingTxs = await roomDb.getAll<CashTransaction>('cash_transactions');
  const summary = computePhysicalCashBalance(existingTxs);
  const newBalance = summary.computedCashBalancePaise + params.inflowPaise - params.outflowPaise;

  const now = params.date || Date.now();
  const tx: CashTransaction = {
    id: `cash-${now}-${Math.random().toString(36).substr(2, 5)}`,
    businessId: 'biz-original-modi-bags',
    date: now,
    type: params.type,
    description: params.description,
    inflowPaise: params.inflowPaise,
    outflowPaise: params.outflowPaise,
    runningCashBalancePaise: newBalance,
    referenceId: params.referenceId,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };

  await roomDb.put('cash_transactions', tx);
  return tx;
}
