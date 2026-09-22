package com.originalmodibags.businessmanager.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.originalmodibags.businessmanager.data.local.dao.*
import com.originalmodibags.businessmanager.data.local.entity.*

/**
 * ORIGINAL MODI BAGS Room Database
 * Local native source of truth for wholesale business management.
 * Offline-first architecture.
 */
@Database(
    entities = [
        BusinessProfileEntity::class,
        CustomerEntity::class,
        CustomerLedgerEntity::class,
        ProductEntity::class,
        StockMovementEntity::class,
        BillEntity::class,
        BillItemEntity::class,
        SupplierEntity::class,
        PurchaseEntity::class,
        PurchaseItemEntity::class,
        ExpenseEntity::class,
        CashTransactionEntity::class,
        TransportEntity::class,
        CRMFollowUpEntity::class,
        AuditLogEntity::class,
        SyncQueueEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class ModiBagsDatabase : RoomDatabase() {
    abstract fun customerDao(): CustomerDao
    abstract fun productDao(): ProductDao
    abstract fun billDao(): BillDao
    abstract fun purchaseDao(): PurchaseDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun cashTransactionDao(): CashTransactionDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun auditLogDao(): AuditLogDao

    companion object {
        @Volatile
        private var INSTANCE: ModiBagsDatabase? = null

        fun getDatabase(context: Context): ModiBagsDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ModiBagsDatabase::class.java,
                    "original_modi_bags_room.db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
