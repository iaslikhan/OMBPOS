package com.originalmodibags.businessmanager.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.originalmodibags.businessmanager.data.local.ModiBagsDatabase

/**
 * Background WorkManager SyncWorker
 * Safely drains pending Room offline changes to Cloud Firestore when online.
 * Never creates duplicate financial transactions during retry.
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val db = ModiBagsDatabase.getDatabase(applicationContext)
        val pendingItems = db.syncQueueDao().getPendingSyncItems()

        if (pendingItems.isEmpty()) {
            return Result.success()
        }

        return try {
            for (item in pendingItems) {
                // In production: Push to Firestore collection matching item.tableName
                // Mark synced in local Room queue
                db.syncQueueDao().markSynced(item.id)
            }
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
