package expo.modules.aurorawallpaper

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Timing for the wallpaper changer. Each change is an alarm that may fire while the phone is
 * idle (Doze), set again one interval after every change. (A repeating WorkManager job, used
 * before, is held back until the phone wakes, so changes were late or came only when the app
 * was opened.) Prefetching the next wallpaper is ordinary background work, whenever there's
 * network.
 */
object ChangerScheduler {
  const val ACTION_CHANGE = "expo.modules.aurorawallpaper.CHANGE"
  private const val REQUEST_CODE = 4201
  /** The old repeating job's name; cancelled wherever it may still be scheduled. */
  const val LEGACY_PERIODIC = "aurora-wallpaper-changer"
  private const val PREFETCH = "aurora-wallpaper-prefetch"

  private fun pendingIntent(ctx: Context, flags: Int): PendingIntent? =
    PendingIntent.getBroadcast(
      ctx,
      REQUEST_CODE,
      Intent(ctx, ChangerAlarmReceiver::class.java).setAction(ACTION_CHANGE),
      flags or PendingIntent.FLAG_IMMUTABLE
    )

  fun setAlarm(ctx: Context, atMillis: Long) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pendingIntent(ctx, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    // Exact timing needs a permission the user grants on Android 12+; without it, an inexact
    // alarm that still fires in Doze (Android may delay it a few minutes).
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi)
    Log.d(ChangerCore.TAG, "next change at $atMillis (exact=$exact)")
  }

  /** Turn on (or change the interval): the next change is one interval from now. Returns its time. */
  fun start(ctx: Context, intervalMinutes: Long): Long {
    WorkManager.getInstance(ctx).cancelUniqueWork(LEGACY_PERIODIC)
    val at = System.currentTimeMillis() + intervalMinutes * 60_000L
    ChangerCore.read(ctx)?.let {
      it.put("nextAt", at)
      ChangerCore.write(ctx, it)
    }
    setAlarm(ctx, at)
    enqueuePrefetch(ctx)
    return at
  }

  fun stop(ctx: Context) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    pendingIntent(ctx, PendingIntent.FLAG_NO_CREATE)?.let {
      am.cancel(it)
      it.cancel()
    }
    val wm = WorkManager.getInstance(ctx)
    wm.cancelUniqueWork(PREFETCH)
    wm.cancelUniqueWork(LEGACY_PERIODIC)
  }

  /**
   * After a reboot, an app update or on app start: set the alarm again from the saved state
   * (alarms don't survive a reboot). An overdue change happens about 30 seconds later.
   */
  fun ensure(ctx: Context) {
    WorkManager.getInstance(ctx).cancelUniqueWork(LEGACY_PERIODIC)
    val state = ChangerCore.read(ctx) ?: return
    if (!state.optBoolean("enabled", false)) {
      stop(ctx)
      return
    }
    val now = System.currentTimeMillis()
    var at = if (state.isNull("nextAt")) 0L else state.optLong("nextAt", 0L)
    if (at <= 0L) {
      val last = if (state.isNull("lastChangedAt")) 0L else state.optLong("lastChangedAt", 0L)
      at = (if (last > 0) last else now) + ChangerCore.intervalMs(state)
    }
    if (at < now + 30_000L) at = now + 30_000L
    if (state.optLong("nextAt", -1L) != at) {
      state.put("nextAt", at)
      ChangerCore.write(ctx, state)
    }
    setAlarm(ctx, at)
    enqueuePrefetch(ctx)
  }

  fun enqueuePrefetch(ctx: Context) {
    val request = OneTimeWorkRequestBuilder<ChangerWorker>()
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
      .setInputData(Data.Builder().putString(ChangerWorker.KEY_MODE, ChangerWorker.MODE_PREFETCH).build())
      .build()
    WorkManager.getInstance(ctx).enqueueUniqueWork(PREFETCH, ExistingWorkPolicy.REPLACE, request)
  }
}
