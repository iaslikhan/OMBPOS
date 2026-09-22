/**
 * Customer Ledger Transaction Manager
 *
 * Implements strict transaction-based accounting rules:
 * - Balances are NEVER directly overwritten.
 * - Every balance change MUST be derived from an immutable CustomerLedgerTransaction.
 * - Current balance = sum(all debits) - sum(all credits).
 * - Running balances on ledger entries represent the exact snapshot at that transaction point.
 */

import { Customer, CustomerLedgerTransaction, CustomerLedgerTxType, PaymentMethod } from '../types';
import { roomDb } from '../db/indexedDbRoom';

export interface LedgerCalculationResult {
  totalDebitsPaise: number;
  totalCreditsPaise: number;
  computedBalancePaise: number;
  orderedTransactions: CustomerLedgerTransaction[];
}

/**
 * Recomputes the entire ledger balance from atomic ledger transactions.
 * Balances are strictly transactional: Balance = Debits - Credits
 */
export function computeCustomerBalanceFromTransactions(
  transactions: CustomerLedgerTransaction[]
): LedgerCalculationResult {
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  let runningBalance = 0;
  let totalDebitsPaise = 0;
  let totalCreditsPaise = 0;

  const orderedTransactions: CustomerLedgerTransaction[] = [];

  for (const tx of sorted) {
    totalDebitsPaise += tx.debitPaise || 0;
    totalCreditsPaise += tx.creditPaise || 0;
    runningBalance = runningBalance + (tx.debitPaise || 0) - (tx.creditPaise || 0);

    orderedTransactions.push({
      ...tx,
      runningBalancePaise: runningBalance
    });
  }

  return {
    totalDebitsPaise,
    totalCreditsPaise,
    computedBalancePaise: runningBalance,
    orderedTransactions
  };
}

/**
 * Appends a new immutable ledger transaction for a customer and updates the customer
 * summary fields purely as an indexed snapshot of the transactional ledger.
 */
export async function postCustomerLedgerTransaction(params: {
  customerId: string;
  type: CustomerLedgerTxType;
  description: string;
  debitPaise: number;
  creditPaise: number;
  paymentMethod?: PaymentMethod;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  date?: number;
}): Promise<{ customer: Customer; transaction: CustomerLedgerTransaction }> {
  const customer = await roomDb.get<Customer>('customers', params.customerId);
  if (!customer) {
    throw new Error(`Customer with ID ${params.customerId} not found.`);
  }

  // Fetch all existing ledger transactions
  const allLedger = await roomDb.getAll<CustomerLedgerTransaction>('customer_ledger');
  const customerTxs = allLedger.filter(tx => tx.customerId === params.customerId);

  // Derive previous balance strictly from ledger
  const currentCalc = computeCustomerBalanceFromTransactions(customerTxs);
  const newBalance = currentCalc.computedBalancePaise + params.debitPaise - params.creditPaise;

  const now = params.date || Date.now();
  const txId = `ledg-${now}-${Math.random().toString(36).substr(2, 5)}`;

  const newTx: CustomerLedgerTransaction = {
    id: txId,
    businessId: customer.businessId || 'biz-original-modi-bags',
    customerId: customer.id,
    date: now,
    type: params.type,
    description: params.description,
    debitPaise: params.debitPaise,
    creditPaise: params.creditPaise,
    runningBalancePaise: newBalance,
    paymentMethod: params.paymentMethod,
    referenceDocumentId: params.referenceDocumentId,
    referenceDocumentNumber: params.referenceDocumentNumber,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  };

  // 1. Persist the atomic transaction
  await roomDb.put('customer_ledger', newTx);

  // 2. Update customer record solely reflecting transactional sums
  const updatedCustomer: Customer = {
    ...customer,
    currentOutstandingPaise: newBalance,
    totalSalesPaise: (customer.totalSalesPaise || 0) + (params.type === 'CREDIT_SALE' ? params.debitPaise : 0),
    totalPaymentsPaise: (customer.totalPaymentsPaise || 0) + (params.type === 'PAYMENT' ? params.creditPaise : 0),
    updatedAt: now
  };

  await roomDb.put('customers', updatedCustomer);

  // 3. If cash was received, record in physical cash transactions
  if (params.paymentMethod === 'CASH' && params.creditPaise > 0) {
    await roomDb.put('cash_transactions', {
      id: `cash-cust-pay-${now}`,
      businessId: customer.businessId || 'biz-original-modi-bags',
      date: now,
      type: 'CASH_SALE',
      description: `Collection from ${customer.name}: ${params.description}`,
      inflowPaise: params.creditPaise,
      outflowPaise: 0,
      runningCashBalancePaise: params.creditPaise,
      referenceId: newTx.id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'LOCAL'
    });
  }

  // 4. Audit Log
  await roomDb.put('audit_logs', {
    id: `audit-${now}`,
    businessId: customer.businessId || 'biz-original-modi-bags',
    user: 'Counter Staff',
    action: `LEDGER_${params.type}`,
    timestamp: now,
    recordType: 'CUSTOMER_LEDGER',
    recordId: newTx.id,
    notes: `${params.description} for ${customer.name}. Debit: ₹${(params.debitPaise / 100).toFixed(2)}, Credit: ₹${(params.creditPaise / 100).toFixed(2)}, Balance: ₹${(newBalance / 100).toFixed(2)}`,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'LOCAL'
  });

  return { customer: updatedCustomer, transaction: newTx };
}
