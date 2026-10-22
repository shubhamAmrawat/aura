package expo.modules.aurorawallpaper

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The wallpaper changer's shared logic, used by the alarm, the prefetch job and "Shuffle now".
 * State lives in files/wallpaper-changer.json, which the app also reads and writes.
 *
 * Each change uses the wallpaper downloaded in advance (files/changer_next.img) when it's the
 * next one in the round, so a change needs no network (often unavailable while the phone dozes).
 */
object ChangerCore {
  const val TAG = "AuroraWallpaperChanger"
  private const val STATE_FILE = "wallpaper-changer.json"
  private const val NEXT_FILE = "changer_next.img"
  private const val RETRY_MS = 30 * 60_000L
  private val lock = Any()

  data class Outcome(val ok: Boolean, val title: String? = null, val error: String? = null)
  class Timeouts(val connectMs: Int, val readMs: Int)
  val QUICK = Timeouts(8_000, 30_000)
  val NORMAL = Timeouts(20_000, 60_000)

  private fun stateFile(ctx: Context) = File(ctx.filesDir, STATE_FILE)
  private fun nextFile(ctx: Context) = File(ctx.filesDir, NEXT_FILE)

  fun read(ctx: Context): JSONObject? = try {
    val f = stateFile(ctx)
    if (f.exists()) JSONObject(f.readText()) else null
  } catch (e: Exception) {
    Log.e(TAG, "settings file unreadable: ${e.message}")
    null
  }

  fun write(ctx: Context, state: JSONObject) {
    stateFile(ctx).writeText(state.toString())
  }

  fun intervalMs(state: JSONObject): Long =
    (state.optDouble("intervalHours", 12.0) * 3_600_000).toLong().coerceAtLeast(15 * 60_000L)

  private fun longOrZero(state: JSONObject, key: String): Long = if (state.isNull(key)) 0L else state.optLong(key, 0L)

  private fun pool(state: JSONObject): LinkedHashMap<String, JSONObject> {
    val byId = LinkedHashMap<String, JSONObject>()
    val arr = state.optJSONArray("pool") ?: JSONArray()
    for (i in 0 until arr.length()) {
      val item = arr.optJSONObject(i) ?: continue
      val id = item.optString("id")
      if (id.isNotEmpty()) byId[id] = item
    }
    return byId
  }

  /** The rest of this round (first = next); a new shuffled round, current wallpaper last, when empty. */
  private fun upcoming(state: JSONObject, byId: Map<String, JSONObject>): MutableList<String> {
    val queue = mutableListOf<String>()
    state.optJSONArray("queue")?.let { q ->
      for (i in 0 until q.length()) q.optString(i).takeIf { byId.containsKey(it) }?.let(queue::add)
    }
    if (queue.isEmpty()) {
      val current = state.optString("lastWallpaperId")
      queue.addAll(byId.keys.filter { it != current }.shuffled())
      if (byId.containsKey(current)) queue.add(current)
    }
    return queue
  }

  /**
   * Sets the next wallpaper. When the changer is on, the next alarm is set one interval later
   * (or sooner, to retry, if this attempt failed), so the chain never stops.
   */
  fun change(ctx: Context, timeouts: Timeouts): Outcome {
    synchronized(lock) {
      return changeLocked(ctx, timeouts)
    }
  }

  private fun changeLocked(ctx: Context, timeouts: Timeouts): Outcome {
    val state = read(ctx) ?: return Outcome(false, error = "Choose where wallpapers come from first.")
    val enabled = state.optBoolean("enabled", false)
    val byId = pool(state)
    if (byId.isEmpty()) return fail(ctx, state, enabled, "No wallpapers in this source.")

    val queue = upcoming(state, byId)
    val id = queue.removeAt(0)
    val item = byId[id]!!
    val prefetched = nextFile(ctx)
    val usePrefetched = state.optString("prefetchId") == id && prefetched.exists() && prefetched.length() > 0
    var tmp: File? = null
    try {
      val source = if (usePrefetched) {
        prefetched
      } else {
        File(ctx.cacheDir, "changer_${System.currentTimeMillis()}.img").also {
          tmp = it
          download(item.optString("fileUrl"), it, timeouts)
        }
      }
      WallpaperSetter.setFromFile(ctx, source, state.optString("target", "both"))
      val now = System.currentTimeMillis()
      state.put("queue", JSONArray(queue))
      state.put("lastChangedAt", now)
      state.put("lastWallpaperId", id)
      state.put("lastError", JSONObject.NULL)
      state.put("lastErrorAt", JSONObject.NULL)
      state.put("prefetchId", JSONObject.NULL)
      if (enabled) state.put("nextAt", now + intervalMs(state))
      write(ctx, state)
      prefetched.delete()
      if (enabled) ChangerScheduler.setAlarm(ctx, state.optLong("nextAt"))
      Log.d(TAG, "changed to \"${item.optString("title")}\" (prefetched=$usePrefetched)")
      return Outcome(true, title = item.optString("title"))
    } catch (e: Exception) {
      Log.e(TAG, "change failed: ${e.message}")
      return fail(ctx, state, enabled, e.message ?: "Couldn't change the wallpaper.")
    } finally {
      tmp?.delete()
    }
  }

  private fun fail(ctx: Context, state: JSONObject, enabled: Boolean, message: String): Outcome {
    try {
      val now = System.currentTimeMillis()
      state.put("lastError", message)
      state.put("lastErrorAt", now)
      if (enabled) state.put("nextAt", now + minOf(intervalMs(state), RETRY_MS))
      write(ctx, state)
      if (enabled) ChangerScheduler.setAlarm(ctx, state.optLong("nextAt"))
    } catch (e: Exception) {
      Log.e(TAG, "couldn't record the error: ${e.message}")
    }
    return Outcome(false, error = message)
  }

  /** Downloads the next wallpaper in the round ahead of time. False = try again later. */
  fun prefetch(ctx: Context): Boolean {
    val (id, url) = synchronized(lock) {
      val state = read(ctx) ?: return true
      val byId = pool(state)
      if (byId.isEmpty()) return true
      val queue = upcoming(state, byId)
      val id = queue.first()
      if (state.optString("prefetchId") == id && nextFile(ctx).exists()) return true
      // Keep the round we just decided on, so the change uses this same wallpaper.
      state.put("queue", JSONArray(queue))
      write(ctx, state)
      id to byId[id]!!.optString("fileUrl")
    }
    val part = File(ctx.filesDir, "$NEXT_FILE.part")
    return try {
      download(url, part, NORMAL)
      synchronized(lock) {
        val state = read(ctx) ?: return true
        val byId = pool(state)
        if (byId.isEmpty() || upcoming(state, byId).first() != id) {
          part.delete() // the round changed meanwhile; the next run fetches the new one
          return true
        }
        if (!part.renameTo(nextFile(ctx))) {
          part.copyTo(nextFile(ctx), overwrite = true)
          part.delete()
        }
        state.put("prefetchId", id)
        write(ctx, state)
      }
      Log.d(TAG, "prefetched $id")
      true
    } catch (e: Exception) {
      Log.e(TAG, "prefetch failed: ${e.message}")
      part.delete()
      false
    }
  }

  private fun download(url: String, dest: File, timeouts: Timeouts) {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = timeouts.connectMs
    conn.readTimeout = timeouts.readMs
    try {
      if (conn.responseCode !in 200..299) throw IllegalStateException("Download failed (${conn.responseCode})")
      conn.inputStream.use { input -> dest.outputStream().use { output -> input.copyTo(output) } }
    } finally {
      conn.disconnect()
    }
  }
}
