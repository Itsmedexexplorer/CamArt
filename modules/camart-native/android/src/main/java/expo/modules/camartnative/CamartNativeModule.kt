package expo.modules.camartnative

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class CamartNativeModule : Module() {
  private var pendingPack: Promise? = null
  private val context get() = requireNotNull(appContext.reactContext) { "No React context" }

  override fun definition() = ModuleDefinition {
    Name("CamartNative")

    AsyncFunction("removeBackground") { uri: String, promise: Promise ->
      val src = try { loadUpright(Uri.parse(uri)) } catch (e: Exception) {
        return@AsyncFunction promise.reject(CodedException("ERR_DECODE", "Could not read the photo", e))
      }
      val segmenter = SubjectSegmentation.getClient(SubjectSegmenterOptions.Builder().enableForegroundBitmap().build())
      segmenter.process(InputImage.fromBitmap(src, 0))
        .addOnSuccessListener { result ->
          val fg = result.foregroundBitmap
          if (fg == null) {
            promise.reject(CodedException("ERR_NO_SUBJECT", "No subject found in this photo", null))
          } else {
            val out = File(context.cacheDir, "lift-${System.currentTimeMillis()}.png")
            FileOutputStream(out).use { fg.compress(Bitmap.CompressFormat.PNG, 100, it) }
            promise.resolve(Uri.fromFile(out).toString())
          }
          segmenter.close()
        }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_SEGMENT", e.message ?: "Subject lift failed", e))
          segmenter.close()
        }
      Unit
    }

    // Resolves "added" / "cancelled", or rejects with WhatsApp's own validation message.
    AsyncFunction("addToWhatsApp") { id: String, name: String, promise: Promise ->
      val activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject(CodedException("ERR_NO_ACTIVITY", "App is not in the foreground", null))
      val intent = Intent("com.whatsapp.intent.action.ENABLE_STICKER_PACK").apply {
        putExtra("sticker_pack_id", id)
        putExtra("sticker_pack_authority", "${context.packageName}.stickercontentprovider")
        putExtra("sticker_pack_name", name)
      }
      try {
        pendingPack?.reject(CodedException("ERR_REPLACED", "Replaced by a newer request", null))
        pendingPack = promise
        activity.startActivityForResult(intent, PACK_REQUEST)
      } catch (e: ActivityNotFoundException) {
        pendingPack = null
        promise.reject(CodedException("ERR_NO_WHATSAPP", "WhatsApp is not installed", e))
      }
      Unit
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PACK_REQUEST) return@OnActivityResult
      val p = pendingPack ?: return@OnActivityResult
      pendingPack = null
      val error = payload.data?.getStringExtra("validation_error")
      when {
        payload.resultCode == Activity.RESULT_OK -> p.resolve("added")
        error != null -> p.reject(CodedException("ERR_WHATSAPP", error, null))
        else -> p.resolve("cancelled")
      }
    }

    Function("reloadWidgets") { TodayWidget.updateAll(context) }
  }

  /** Decode, cap at 1600px (segmentation is quick at this size), and apply EXIF rotation. */
  private fun loadUpright(uri: Uri): Bitmap {
    val path = uri.path ?: throw IllegalArgumentException("Bad uri")
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1600) sample *= 2
    val bmp = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw IllegalArgumentException("Undecodable")
    val deg = when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    return if (deg == 0f) bmp else Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(deg) }, true)
  }

  companion object {
    private const val PACK_REQUEST = 2001
  }
}
