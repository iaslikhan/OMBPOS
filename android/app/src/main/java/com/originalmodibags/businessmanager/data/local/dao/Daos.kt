package com.originalmodibags.businessmanager.data.local.dao

import androidx.room.*
import com.originalmodibags.businessmanager.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name ASC")
    fun getAllCustomers(): Flow<List<CustomerEntity>>

    @Query("SELECT * FROM customers WHERE id = :id LIMIT 1")
    suspend fun getCustomerById(id: String): CustomerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomer(customer: CustomerEntity)

    @Update
    suspend fun updateCustomer(customer: CustomerEntity)

    @Query("UPDATE customers SET currentOutstandingPaise = :newBalance WHERE id = :customerId")
    suspend fun updateOutstanding(customerId: String, newBalance: Long)
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name ASC")
    fun getAllProducts(): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE id = :id LIMIT 1")
    suspend fun getProductById(id: String): ProductEntity?

    @Query("SELECT * FROM products WHERE currentStock <= minimumStock")
    fun getLowStockProducts(): Flow<List<ProductEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: ProductEntity)

    @Query("UPDATE products SET currentStock = currentStock + :delta WHERE id = :productId")
    suspend fun adjustStock(productId: String, delta: Int)
}

@Dao
interface BillDao {
    @Query("SELECT * FROM bills ORDER BY date DESC")
    fun getAllBills(): Flow<List<BillEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBill(bill: BillEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBillItems(items: List<BillItemEntity>)

    @Transaction
    suspend fun saveBillWithItems(bill: BillEntity, items: List<BillItemEntity>) {
        insertBill(bill)
        insertBillItems(items)
    }
}

@Dao
interface PurchaseDao {
    @Query("SELECT * FROM purchases ORDER BY date DESC")
    fun getAllPurchases(): Flow<List<PurchaseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPurchase(purchase: PurchaseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPurchaseItems(items: List<PurchaseItemEntity>)
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses ORDER BY date DESC")
    fun getAllExpenses(): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: ExpenseEntity)
}

@Dao
interface CashTransactionDao {
    @Query("SELECT * FROM cash_transactions ORDER BY date DESC")
    fun getAllCashTransactions(): Flow<List<CashTransactionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCashTransaction(tx: CashTransactionEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY timestamp ASC")
    suspend fun getPendingSyncItems(): List<SyncQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: SyncQueueEntity)

    @Query("DELETE FROM sync_queue WHERE id = :id")
    suspend fun markSynced(id: String)
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    fun getAllAuditLogs(): Flow<List<AuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun log(entry: AuditLogEntity)
}
