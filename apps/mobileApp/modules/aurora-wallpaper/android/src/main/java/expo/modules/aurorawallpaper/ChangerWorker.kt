package expo.modules.aurorawallpaper

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The background wallpaper changer, fully native (no JavaScript runs in the background).
 * Reads the same JSON file the app writes (files/wallpaper-changer.json: settings + the
 * cached wallpaper list), sets the next wallpaper, and records progress in that file.
 * The app refreshes the wallpaper list whenever it's opened.
 */
class ChangerWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  companion object {
    const val TAG = "AuroraWallpaperChanger"
    const val KEY_TEST = "test"
    const val STATE_FILE = "wallpaper-changer.json"
  }

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val isTest = inputData.getBoolean(KEY_TEST, false)
    val file = File(applicationContext.filesDir, STATE_FILE)
    Log.d(TAG, "run started (test=$isTest)")
    if (!file.exists()) {
      Log.d(TAG, "no settings file, nothing to do")
      return@withContext Result.success()
    }
    val state = try {
      JSONObject(file.readText())
    } catch (e: Exception) {
      Log.e(TAG, "settings file unreadable: ${e.message}")
      return@withContext Result.success()
    }

    if (!state.optBoolean("enabled", false)) {
      Log.d(TAG, "changer is off, skipping")
      return@withContext Result.success()
    }
    val intervalHours = state.optDouble("intervalHours", 12.0)
    val lastChangedAt = if (state.isNull("lastChangedAt")) 0L else state.optLong("lastChangedAt", 0L)
    // Not right after a manual "Change now" (less than half an interval ago).
    if (!isTest && lastChangedAt > 0 && System.currentTimeMillis() - lastChangedAt < intervalHours * 3600_000 / 2) {
      Log.d(TAG, "changed recently, skipping")
      return@withContext Result.success()
    }

    val pool = state.optJSONArray("pool") ?: JSONArray()
    val byId = LinkedHashMap<String, JSONObject>()
    for (i in 0 until pool.length()) pool.optJSONObject(i)?.let { item -> item.optString("id").takeIf { it.isNotEmpty() }?.let { byId[it] = item } }
    if (byId.isEmpty()) return@withContext fail(file, state, "No wallpapers in this source.")

    // Next in the shuffled round; new round (not starting with the current one) when empty.
    val queue = mutableListOf<String>()
    state.optJSONArray("queue")?.let { q -> for (i in 0 until q.length()) q.optString(i).takeIf { byId.containsKey(it) }?.let(queue::add) }
    if (queue.isEmpty()) {
      queue.addAll(byId.keys.shuffled())
      val current = state.optString("lastWallpaperId")
      if (queue.size > 1 && queue.first() == current) queue.add(queue.removeAt(0))
    }
    val id = queue.removeAt(0)
    val item = byId[id]!!
    val url = item.optString("fileUrl")

    val tmp = File(applicationContext.cacheDir, "changer_${System.currentTimeMillis()}.img")
    try {
      download(url, tmp)
      WallpaperSetter.setFromFile(applicationContext, tmp, state.optString("target", "both"))
      state.put("queue", JSONArray(queue))
      state.put("lastChangedAt", System.currentTimeMillis())
      state.put("lastWallpaperId", id)
      state.put("lastError", JSONObject.NULL)
      state.put("lastErrorAt", JSONObject.NULL)
      file.writeText(state.toString())
      Log.d(TAG, "changed to \"${item.optString("title")}\"")
      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "change failed: ${e.message}")
      fail(file, state, e.message ?: "Couldn't change the wallpaper.")
    } finally {
      tmp.delete()
    }
  }

  private fun fail(file: File, state: JSONObject, message: String): Result {
    try {
      state.put("lastError", message)
      state.put("lastErrorAt", System.currentTimeMillis())
      file.writeText(state.toString())
    } catch (_: Exception) {
    }
    // Success keeps the periodic schedule going; the error is shown in the app.
    return Result.success()
  }

  private fun download(url: String, dest: File) {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 20_000
    conn.readTimeout = 60_000
    try {
      if (conn.responseCode !in 200..299) throw IllegalStateException("Download failed (${conn.responseCode})")
      conn.inputStream.use { input -> dest.outputStream().use { output -> input.copyTo(output) } }
    } finally {
      conn.disconnect()
    }
  }
}
