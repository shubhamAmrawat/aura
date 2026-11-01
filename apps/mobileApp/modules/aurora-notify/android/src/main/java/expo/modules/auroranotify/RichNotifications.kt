package expo.modules.auroranotify

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Draws one Aurora push: title, text, the wallpaper as a big picture, and up to 3 buttons.
 * Every tap and button opens the app at its deep link (aurora://…), or an https link.
 *
 * Expo's push service puts our `data` object, as JSON, in the "body" field, and the title and
 * text in "title" / "message".
 */
object RichNotifications {
  private const val ACCENT = 0xFF81EE4E.toInt()
  private const val NOTIFICATION_PARAM = "_n"

  /** Same ids and names as lib/notifications.ts creates (whichever runs first wins). */
  private val CHANNELS = mapOf(
    "drops" to Pair("New drops", NotificationManagerCompat.IMPORTANCE_HIGH),
    "daily" to Pair("Wallpaper of the day", NotificationManagerCompat.IMPORTANCE_DEFAULT),
    "uploads" to Pair("Your uploads", NotificationManagerCompat.IMPORTANCE_DEFAULT),
    "account" to Pair("Account and reports", NotificationManagerCompat.IMPORTANCE_DEFAULT),
    "updates" to Pair("App updates and news", NotificationManagerCompat.IMPORTANCE_DEFAULT),
  )

  fun showIfAurora(context: Context, data: Map<String, String>): Boolean {
    val payload = data["body"]?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return false
    if (!payload.optBoolean("rich", false)) return false

    val manager = NotificationManagerCompat.from(context)
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return true // not allowed to show anything; expo-notifications couldn't either
    }

    val title = data["title"] ?: payload.optString("title", "Aurora")
    val text = data["message"]
    val channelId = data["channelId"]?.takeIf { CHANNELS.containsKey(it) } ?: "updates"
    ensureChannel(manager, channelId)

    val notificationId = (payload.optString("nid").ifEmpty { System.currentTimeMillis().toString() }).hashCode()
    val url = payload.optString("url").takeIf { it.isNotEmpty() && it != "null" }
    val image = payload.optString("image").takeIf { it.startsWith("https://") }?.let { download(it) }

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(smallIcon(context))
      .setColor(ACCENT)
      .setContentTitle(title)
      .setAutoCancel(true)
      .setPriority(if (channelId == "drops") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(open(context, url, notificationId, 0))
    if (!text.isNullOrEmpty()) builder.setContentText(text)

    if (image != null) {
      builder.setLargeIcon(image)
      val style = NotificationCompat.BigPictureStyle().bigPicture(image).bigLargeIcon(null as Bitmap?)
      if (!text.isNullOrEmpty()) style.setSummaryText(text)
      builder.setStyle(style)
    } else if (!text.isNullOrEmpty()) {
      builder.setStyle(NotificationCompat.BigTextStyle().bigText(text))
    }

    val buttons = payload.optJSONArray("buttons")
    if (buttons != null) {
      for (i in 0 until minOf(buttons.length(), 3)) {
        val b = buttons.optJSONObject(i) ?: continue
        val label = b.optString("label").takeIf { it.isNotEmpty() } ?: continue
        val target = b.optString("url").takeIf { it.isNotEmpty() } ?: continue
        builder.addAction(0, label, open(context, target, notificationId, i + 1))
      }
    }

    manager.notify(notificationId, builder.build())
    return true
  }

  /** aurora://path for app paths (with the notification id, so the app can clear it), https as is. */
  private fun open(context: Context, url: String?, notificationId: Int, slot: Int): PendingIntent {
    val intent = when {
      url != null && url.startsWith("https://") -> Intent(Intent.ACTION_VIEW, Uri.parse(url))
      else -> {
        val path = when {
          url == null -> "notifications"
          url.startsWith("aurora://") -> url.removePrefix("aurora://")
          else -> url.trimStart('/')
        }
        val sep = if (path.contains('?')) "&" else "?"
        Intent(Intent.ACTION_VIEW, Uri.parse("aurora://$path$sep$NOTIFICATION_PARAM=$notificationId")).setPackage(context.packageName)
      }
    }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    // unique request code per notification + button, so the extras don't overwrite each other
    return PendingIntent.getActivity(
      context,
      notificationId * 4 + slot,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ensureChannel(manager: NotificationManagerCompat, id: String) {
    if (manager.getNotificationChannelCompat(id) != null) return
    val (name, importance) = CHANNELS[id] ?: return
    manager.createNotificationChannel(NotificationChannelCompat.Builder(id, importance).setName(name).build())
  }

  private fun smallIcon(context: Context): Int {
    val res = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (res != 0) res else context.applicationInfo.icon
  }

  /** The wallpaper thumbnail; null if it can't be fetched in time (the text still shows). */
  private fun download(url: String): Bitmap? = runCatching {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 6000
    conn.readTimeout = 8000
    conn.instanceFollowRedirects = true
    try {
      conn.inputStream.use { BitmapFactory.decodeStream(it) }
    } finally {
      conn.disconnect()
    }
  }.getOrNull()

  fun cancel(context: Context, id: Int) {
    NotificationManagerCompat.from(context).cancel(id)
  }
}
