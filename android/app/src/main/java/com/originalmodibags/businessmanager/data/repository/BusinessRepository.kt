package com.originalmodibags.businessmanager.data.repository

import com.originalmodibags.businessmanager.data.local.ModiBagsDatabase
import com.originalmodibags.businessmanager.data.local.entity.*
import kotlinx.coroutines.flow.Flow

/**
 * Clean Architecture Repository
 * Exposes Room Database as the native source of truth for the ViewModels.
 */
class BusinessRepository(private val db: ModiBagsDatabase) {

    fun getProducts(): Flow<List<ProductEntity>> = db.productDao().getAllProducts()
    fun getCustomers(): Flow<List<CustomerEntity>> = db.customerDao().getAllCustomers()
    fun getBills(): Flow<List<BillEntity>> = db.billDao().getAllBills()
    fun getExpenses(): Flow<List<ExpenseEntity>> = db.expenseDao().getAllExpenses()
    fun getPurchases(): Flow<List<PurchaseEntity>> = db.purchaseDao().getAllPurchases()

    suspend fun saveBillTransaction(bill: BillEntity, items: List<BillItemEntity>) {
        db.billDao().saveBillWithItems(bill, items)

        // Record customer ledger adjustment if credit sale
        if (bill.balancePaise > 0 && bill.customerId != null) {
            val customer = db.customerDao().getCustomerById(bill.customerId)
            if (customer != null) {
                val newOutstanding = customer.currentOutstandingPaise + bill.balancePaise
                db.customerDao().updateOutstanding(bill.customerId, newOutstanding)
            }
        }

        // Decrement stock for inventory products
        for (item in items) {
            if (item.isPermanentProduct && item.productId != null) {
                db.productDao().adjustStock(item.productId, -item.quantity)
            }
        }

        // Record physical cash if cash payment
        if (bill.paymentMethod.equals("CASH", ignoreCase = true) && bill.paidPaise > 0) {
            db.cashTransactionDao().insertCashTransaction(
                CashTransactionEntity(
                    id = "cash-bill-${bill.id}",
                    date = bill.date,
                    type = "CASH_SALE",
                    description = "Cash collected for Bill #${bill.billNumber}",
                    inflowPaise = bill.paidPaise,
                    outflowPaise = 0L
                )
            )
        }

        // Audit Log
        db.auditLogDao().log(
            AuditLogEntity(
                id = "audit-bill-${bill.id}",
                user = "Billing Staff",
                action = "CREATE_BILL",
                recordType = "BILL",
                recordId = bill.id,
                notes = "Created bill #${bill.billNumber} for ${bill.customerName}"
            )
        )
    }
}
