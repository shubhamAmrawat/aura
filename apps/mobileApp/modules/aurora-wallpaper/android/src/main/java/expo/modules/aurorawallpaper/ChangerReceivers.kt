package expo.modules.aurorawallpaper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** The scheduled change: sets the next wallpaper, then fetches the one after it. */
class ChangerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ChangerScheduler.ACTION_CHANGE) return
    val app = context.applicationContext
    val pending = goAsync()
    Thread {
      try {
        val state = ChangerCore.read(app)
        if (state?.optBoolean("enabled", false) == true) {
          // Short timeouts: a receiver must finish within about a minute.
          val result = ChangerCore.change(app, ChangerCore.QUICK)
          if (result.ok) ChangerScheduler.enqueuePrefetch(app)
        }
      } catch (e: Exception) {
        Log.e(ChangerCore.TAG, "alarm run failed: ${e.message}")
      } finally {
        pending.finish()
      }
    }.start()
  }
}

/** Alarms are cleared on reboot (and may be on app updates): set the next one again. */
class ChangerBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    val app = context.applicationContext
    val pending = goAsync()
    Thread {
      try {
        ChangerScheduler.ensure(app)
      } catch (e: Exception) {
        Log.e(ChangerCore.TAG, "reschedule failed: ${e.message}")
      } finally {
        pending.finish()
      }
    }.start()
  }
}
