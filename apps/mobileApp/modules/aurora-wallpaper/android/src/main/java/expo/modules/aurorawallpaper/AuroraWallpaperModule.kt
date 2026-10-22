package expo.modules.aurorawallpaper

import android.content.Context
import android.net.Uri
import android.os.PowerManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Wallpaper changer native side: set a wallpaper from a file (no Activity needed), and
 * run the wallpaper changer (ChangerCore / ChangerScheduler). The manual Apply flow keeps using
 * react-native-manage-wallpaper.
 */
class AuroraWallpaperModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AuroraWallpaper")

    /** uri: file:// path or plain path. target: "home" | "lock" | "both". */
    AsyncFunction("setFromFile") { uri: String, target: String ->
      val path = if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri else uri
      WallpaperSetter.setFromFile(context, File(path), target)
      true
    }

    /** Turn the changer on, or apply a new interval: next change one interval from now. Returns its time (ms). */
    AsyncFunction("schedule") { intervalMinutes: Int ->
      ChangerScheduler.start(context, intervalMinutes.coerceAtLeast(15).toLong()).toDouble()
    }

    AsyncFunction("cancel") {
      ChangerScheduler.stop(context)
      true
    }

    /** "Shuffle now": the next wallpaper in the round (restarts the timer when the changer is on). */
    AsyncFunction("changeNow") {
      val result = ChangerCore.change(context, ChangerCore.NORMAL)
      if (result.ok) ChangerScheduler.enqueuePrefetch(context)
      mapOf("ok" to result.ok, "title" to (result.title ?: ""), "error" to (result.error ?: ""))
    }

    /** On app start: make sure the next change is scheduled (and move off the old repeating job). */
    AsyncFunction("ensureScheduled") {
      ChangerScheduler.ensure(context)
      true
    }

    /** Dev test: the scheduled change, through the real alarm, in `delaySeconds`. */
    AsyncFunction("scheduleTestRun") { delaySeconds: Int ->
      ChangerScheduler.setAlarm(context, System.currentTimeMillis() + delaySeconds * 1000L)
      true
    }

    /** True when the app is exempt from battery optimisation (background work isn't held back). */
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }
  }
}
