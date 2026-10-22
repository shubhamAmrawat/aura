package expo.modules.aurorawallpaper

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Background work for the wallpaper changer. Changes themselves come from ChangerAlarmReceiver;
 * this job downloads the next wallpaper ahead of time. A run of the old repeating job (from an
 * earlier app version) moves the schedule over to alarms instead of changing at a random time.
 */
class ChangerWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  companion object {
    const val KEY_MODE = "mode"
    const val MODE_PREFETCH = "prefetch"
  }

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    when (inputData.getString(KEY_MODE)) {
      MODE_PREFETCH -> if (ChangerCore.prefetch(applicationContext)) Result.success() else Result.retry()
      else -> {
        ChangerScheduler.ensure(applicationContext)
        Result.success()
      }
    }
  }
}
