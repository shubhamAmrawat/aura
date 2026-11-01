package expo.modules.auroranotify

import android.util.Log
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * FCM entry point. Aurora's own pushes (data has "rich": true) are drawn by RichNotifications;
 * everything else, and anything that fails, goes to expo-notifications as before.
 * Token refreshes are handled by the parent class, so Expo push tokens keep working.
 */
class AuroraMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val shown = try {
      RichNotifications.showIfAurora(applicationContext, remoteMessage.data)
    } catch (e: Throwable) {
      Log.w("AuroraNotify", "Rich notification failed, falling back", e)
      false
    }
    if (!shown) super.onMessageReceived(remoteMessage)
  }
}
