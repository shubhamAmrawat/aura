package expo.modules.aurorawallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/** Decode → centre-crop to the screen → set as home / lock / both. Works without an Activity. */
object WallpaperSetter {
  fun setFromFile(context: Context, file: File, target: String) {
    if (!file.exists()) throw IllegalStateException("Image file not found")
    val (screenW, screenH) = screenSize(context)
    val bitmap = decodeForScreen(file, screenW, screenH) ?: throw IllegalStateException("Couldn't read the image")
    val fitted = centerCropTo(bitmap, screenW, screenH)
    if (fitted !== bitmap) bitmap.recycle()

    val manager = WallpaperManager.getInstance(context)
    val flags = when (target) {
      "home" -> WallpaperManager.FLAG_SYSTEM
      "lock" -> WallpaperManager.FLAG_LOCK
      else -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
    }
    try {
      // Same approach as the patched manual Apply: canvas = screen size, no parallax zoom.
      try {
        manager.suggestDesiredDimensions(fitted.width, fitted.height)
      } catch (_: Exception) {
        // some OEM ROMs throw here; the defaults still work
      }
      manager.setBitmap(fitted, Rect(0, 0, fitted.width, fitted.height), true, flags)
    } finally {
      fitted.recycle()
    }
  }

  /** Full physical screen size in pixels (portrait orientation). */
  private fun screenSize(context: Context): Pair<Int, Int> {
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val (w, h) = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val b = wm.maximumWindowMetrics.bounds
      b.width() to b.height()
    } else {
      val m = DisplayMetrics()
      @Suppress("DEPRECATION")
      wm.defaultDisplay.getRealMetrics(m)
      m.widthPixels to m.heightPixels
    }
    val safeW = if (w > 0) w else 1080
    val safeH = if (h > 0) h else 1920
    return if (safeW <= safeH) safeW to safeH else safeH to safeW
  }

  /** Decodes at no more than ~2x the screen size, so 5K originals don't exhaust memory. */
  private fun decodeForScreen(file: File, screenW: Int, screenH: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= screenW && bounds.outHeight / (sample * 2) >= screenH) sample *= 2
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return BitmapFactory.decodeFile(file.absolutePath, opts)
  }

  /** Crops the centre to the screen's shape, then scales to the screen size. */
  private fun centerCropTo(src: Bitmap, targetW: Int, targetH: Int): Bitmap {
    val targetRatio = targetW.toFloat() / targetH
    val srcRatio = src.width.toFloat() / src.height
    var cropW = src.width
    var cropH = src.height
    if (srcRatio > targetRatio) cropW = (src.height * targetRatio).roundToInt() else cropH = (src.width / targetRatio).roundToInt()
    val x = max(0, (src.width - cropW) / 2)
    val y = max(0, (src.height - cropH) / 2)
    val cropped = if (x == 0 && y == 0 && cropW == src.width && cropH == src.height) src
      else Bitmap.createBitmap(src, x, y, cropW, cropH)
    if (cropped.width == targetW && cropped.height == targetH) return cropped
    val scaled = Bitmap.createScaledBitmap(cropped, targetW, targetH, true)
    if (cropped !== src && cropped !== scaled) cropped.recycle()
    return scaled
  }
}
