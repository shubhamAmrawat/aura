package expo.modules.auroranotify

import android.content.Context
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Notifications helpers (clear one shown notification) and Google Play in-app updates:
 * checkForUpdate → startUpdate("flexible" | "immediate") → onUpdateState events → completeUpdate.
 */
class AuroraNotifyModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var updates: AppUpdateManager? = null
  private val manager: AppUpdateManager
    get() = updates ?: AppUpdateManagerFactory.create(context).also { updates = it }

  private val listener = InstallStateUpdatedListener { state ->
    sendEvent(
      "onUpdateState",
      mapOf(
        "status" to statusName(state.installStatus()),
        "bytesDownloaded" to state.bytesDownloaded().toDouble(),
        "totalBytes" to state.totalBytesToDownload().toDouble(),
      )
    )
  }

  override fun definition() = ModuleDefinition {
    Name("AuroraNotify")
    Events("onUpdateState")

    OnCreate {
      runCatching { manager.registerListener(listener) }
    }
    OnDestroy {
      runCatching { updates?.unregisterListener(listener) }
    }

    /** Remove a notification drawn by AuroraMessagingService (its id is in the deep link). */
    Function("cancelNotification") { id: Int ->
      RichNotifications.cancel(context, id)
    }

    /** True when the app was installed from Google Play (only then can Play update it in place). */
    Function("isFromPlay") {
      val pm = context.packageManager
      val installer = runCatching {
        if (Build.VERSION.SDK_INT >= 30) pm.getInstallSourceInfo(context.packageName).installingPackageName
        else @Suppress("DEPRECATION") pm.getInstallerPackageName(context.packageName)
      }.getOrNull()
      installer == "com.android.vending"
    }

    /** { available, flexible, immediate, versionCode, stalenessDays, status } — status "downloaded" = ready to restart. */
    AsyncFunction("checkForUpdate") { promise: Promise ->
      manager.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          promise.resolve(
            mapOf(
              "available" to (availability == UpdateAvailability.UPDATE_AVAILABLE ||
                availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
              "inProgress" to (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
              "flexible" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
              "immediate" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
              "versionCode" to info.availableVersionCode(),
              "stalenessDays" to (info.clientVersionStalenessDays() ?: -1),
              "status" to statusName(info.installStatus()),
            )
          )
        }
        .addOnFailureListener { e -> promise.reject("ERR_UPDATE_CHECK", e.message ?: "Update check failed", e) }
    }

    /** Shows Play's update UI. Resolves true if the user accepted. */
    AsyncFunction("startUpdate") { type: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "No screen to show the update on", null)
        return@AsyncFunction
      }
      val updateType = if (type == "immediate") AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
      manager.appUpdateInfo
        .addOnSuccessListener { info ->
          if (!info.isUpdateTypeAllowed(updateType)) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(updateType).build())
            .addOnSuccessListener { result -> promise.resolve(result == android.app.Activity.RESULT_OK) }
            .addOnFailureListener { e -> promise.reject("ERR_UPDATE_START", e.message ?: "Couldn't start the update", e) }
        }
        .addOnFailureListener { e -> promise.reject("ERR_UPDATE_CHECK", e.message ?: "Update check failed", e) }
    }.runOnQueue(Queues.MAIN)

    /** After a flexible update downloaded: restart into the new version. */
    AsyncFunction("completeUpdate") { promise: Promise ->
      manager.completeUpdate()
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e -> promise.reject("ERR_UPDATE_COMPLETE", e.message ?: "Couldn't finish the update", e) }
    }
  }

  private fun statusName(status: Int) = when (status) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.FAILED -> "failed"
    InstallStatus.CANCELED -> "canceled"
    else -> "unknown"
  }
}
