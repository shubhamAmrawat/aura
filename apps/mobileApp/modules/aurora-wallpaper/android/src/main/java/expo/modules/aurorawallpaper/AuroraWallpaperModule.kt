package expo.modules.aurorawallpaper

import android.content.Context
import android.net.Uri
import android.os.PowerManager
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Wallpaper changer native side: set a wallpaper from a file (no Activity needed), and
 * schedule the native background job (ChangerWorker). The manual Apply flow keeps using
 * react-native-manage-wallpaper.
 */
class AuroraWallpaperModule : Module() {
  companion object {
    private const val PERIODIC = "aurora-wallpaper-changer"
    private const val TEST = "aurora-wallpaper-changer-test"
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val networkConstraint: Constraints
    get() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  override fun definition() = ModuleDefinition {
    Name("AuroraWallpaper")

    /** uri: file:// path or plain path. target: "home" | "lock" | "both". */
    AsyncFunction("setFromFile") { uri: String, target: String ->
      val path = if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri else uri
      WallpaperSetter.setFromFile(context, File(path), target)
      true
    }

    /** Runs ChangerWorker about every `intervalMinutes` (Android's minimum is 15). First run after one interval. */
    AsyncFunction("schedule") { intervalMinutes: Int ->
      val minutes = intervalMinutes.coerceAtLeast(15).toLong()
      val request = PeriodicWorkRequestBuilder<ChangerWorker>(minutes, TimeUnit.MINUTES)
        .setConstraints(networkConstraint)
        .setInitialDelay(minutes, TimeUnit.MINUTES)
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE, request)
      true
    }

    AsyncFunction("cancel") {
      WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
      true
    }

    /** Dev test: one background change in `delaySeconds`, through the same native worker. */
    AsyncFunction("scheduleTestRun") { delaySeconds: Int ->
      val request = OneTimeWorkRequestBuilder<ChangerWorker>()
        .setConstraints(networkConstraint)
        .setInitialDelay(delaySeconds.toLong(), TimeUnit.SECONDS)
        .setInputData(Data.Builder().putBoolean(ChangerWorker.KEY_TEST, true).build())
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(TEST, ExistingWorkPolicy.REPLACE, request)
      true
    }

    /** True when the app is exempt from battery optimisation (background work isn't held back). */
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }
  }
}
