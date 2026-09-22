package com.originalmodibags.businessmanager.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "business_profile")
data class BusinessProfileEntity(
    @PrimaryKey val id: String = "biz-original-modi-bags",
    val name: String = "ORIGINAL MODI BAGS",
    val address: String = "3, AMARTALLA LANE",
    val city: String = "KOLKATA",
    val state: String = "WEST BENGAL",
    val pincode: String = "700001",
    val phone: String = "8240584877",
    val currency: String = "INR",
    val currencySymbol: String = "₹",
    val syncStatus: String = "LOCAL",
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val customerId: String,
    val name: String,
    val businessName: String? = null,
    val mobile: String,
    val whatsapp: String? = null,
    val address: String? = null,
    val city: String? = null,
    val gstin: String? = null,
    val openingBalancePaise: Long = 0L,
    val currentOutstandingPaise: Long = 0L,
    val creditLimitPaise: Long = 0L,
    val preferredTransport: String? = null,
    val totalSalesPaise: Long = 0L,
    val totalPaymentsPaise: Long = 0L,
    val syncStatus: String = "LOCAL",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "customer_ledger")
data class CustomerLedgerEntity(
    @PrimaryKey val id: String,
    val customerId: String,
    val date: Long,
    val type: String, // CREDIT_SALE, PAYMENT, OPENING_BALANCE, SALES_RETURN, ADJUSTMENT
    val referenceDocumentId: String? = null,
    val referenceDocumentNumber: String? = null,
    val description: String,
    val debitPaise: Long = 0L,
    val creditPaise: Long = 0L,
    val runningBalancePaise: Long = 0L,
    val paymentMethod: String? = null,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val productCode: String,
    val name: String,
    val category: String,
    val subcategory: String? = null,
    val size: String? = null,
    val colour: String? = null,
    val purchaseRatePaise: Long,
    val wholesaleRatePaise: Long,
    val saleRatePaise: Long,
    val mrpPaise: Long,
    val gstPercentage: Double = 0.0,
    val hsn: String? = "4202",
    val openingStock: Int = 0,
    val currentStock: Int = 0,
    val minimumStock: Int = 10,
    val barcode: String? = null,
    val syncStatus: String = "LOCAL",
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "stock_movements")
data class StockMovementEntity(
    @PrimaryKey val id: String,
    val productId: String,
    val productName: String,
    val date: Long,
    val type: String, // PURCHASE, SALE, SALES_RETURN, PURCHASE_RETURN, DAMAGE, ADJUSTMENT
    val quantityChange: Int,
    val previousStock: Int,
    val newStock: Int,
    val referenceDocumentNumber: String? = null,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "bills")
data class BillEntity(
    @PrimaryKey val id: String,
    val documentType: String, // ESTIMATE, CASH_MEMO, INVOICE, GST_INVOICE
    val billNumber: String,
    val date: Long,
    val customerId: String? = null,
    val customerName: String,
    val customerMobile: String? = null,
    val totalQuantity: Int,
    val subtotalPaise: Long,
    val discountPaise: Long = 0L,
    val gstPaise: Long = 0L,
    val roundOffPaise: Long = 0L,
    val grandTotalPaise: Long,
    val paidPaise: Long,
    val balancePaise: Long,
    val previousDuePaise: Long = 0L,
    val newBalancePaise: Long,
    val paymentMethod: String,
    val isCancelled: Boolean = false,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "bill_items")
data class BillItemEntity(
    @PrimaryKey val id: String,
    val billId: String,
    val sNo: Int,
    val productId: String? = null,
    val isPermanentProduct: Boolean,
    val details: String,
    val quantity: Int,
    val ratePaise: Long,
    val totalPaise: Long
)

@Entity(tableName = "suppliers")
data class SupplierEntity(
    @PrimaryKey val id: String,
    val supplierId: String,
    val name: String,
    val mobile: String,
    val openingBalancePaise: Long = 0L,
    val currentOutstandingPaise: Long = 0L,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "purchases")
data class PurchaseEntity(
    @PrimaryKey val id: String,
    val supplierId: String,
    val supplierName: String,
    val purchaseInvoiceNumber: String,
    val date: Long,
    val totalQuantity: Int,
    val grandTotalPaise: Long,
    val paidPaise: Long,
    val creditPaise: Long,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "purchase_items")
data class PurchaseItemEntity(
    @PrimaryKey val id: String,
    val purchaseId: String,
    val productId: String,
    val productName: String,
    val quantity: Int,
    val purchaseRatePaise: Long,
    val totalPaise: Long
)

@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val date: Long,
    val category: String,
    val description: String,
    val amountPaise: Long,
    val paymentMethod: String,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "cash_transactions")
data class CashTransactionEntity(
    @PrimaryKey val id: String,
    val date: Long,
    val type: String, // CASH_SALE, CASH_PURCHASE, CASH_EXPENSE, CASH_DEPOSIT, CASH_WITHDRAWAL
    val description: String,
    val inflowPaise: Long = 0L,
    val outflowPaise: Long = 0L,
    val runningCashBalancePaise: Long = 0L,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "transport")
data class TransportEntity(
    @PrimaryKey val id: String,
    val name: String,
    val destination: String,
    val phone: String,
    val isFavorite: Boolean = false,
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "crm_followups")
data class CRMFollowUpEntity(
    @PrimaryKey val id: String,
    val customerId: String,
    val customerName: String,
    val type: String,
    val date: Long,
    val nextDate: Long,
    val notes: String,
    val status: String, // PENDING, COMPLETED, CANCELLED
    val syncStatus: String = "LOCAL"
)

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey val id: String,
    val user: String,
    val action: String,
    val timestamp: Long = System.currentTimeMillis(),
    val recordType: String,
    val recordId: String,
    val notes: String? = null
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val id: String,
    val tableName: String,
    val recordId: String,
    val action: String, // UPSERT, DELETE
    val payloadJson: String,
    val timestamp: Long = System.currentTimeMillis(),
    val status: String = "PENDING"
)
