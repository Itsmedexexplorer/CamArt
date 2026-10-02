package expo.modules.camartnative

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import org.json.JSONObject
import java.io.File

/**
 * Serves sticker packs to WhatsApp, following its third-party sticker contract.
 * Packs live at <filesDir>/camart/whatsapp/<id>/contents.json plus their image files,
 * written by the JS side (expo-file-system's Paths.document is filesDir).
 */
class StickerContentProvider : ContentProvider() {
  private lateinit var matcher: UriMatcher
  private lateinit var authority: String
  private val root get() = File(context!!.filesDir, "camart/whatsapp")

  override fun onCreate(): Boolean {
    authority = "${context!!.packageName}.stickercontentprovider"
    matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
      addURI(authority, "metadata", METADATA)
      addURI(authority, "metadata/*", METADATA_ONE)
      addURI(authority, "stickers/*", STICKERS)
      addURI(authority, "stickers_asset/*/*", ASSET)
    }
    return true
  }

  private fun packs(): List<JSONObject> =
    root.listFiles()?.mapNotNull { dir -> File(dir, "contents.json").takeIf { it.exists() }?.let { JSONObject(it.readText()) } } ?: emptyList()

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, args: Array<out String>?, sort: String?): Cursor? =
    when (matcher.match(uri)) {
      METADATA -> metadata(packs())
      METADATA_ONE -> metadata(packs().filter { it.getString("identifier") == uri.lastPathSegment })
      STICKERS -> {
        val c = MatrixCursor(arrayOf("sticker_file_name", "sticker_emoji", "sticker_accessibility_text"))
        packs().firstOrNull { it.getString("identifier") == uri.lastPathSegment }?.getJSONArray("stickers")?.let { arr ->
          for (i in 0 until arr.length()) {
            val s = arr.getJSONObject(i)
            val emojis = s.getJSONArray("emojis")
            c.addRow(arrayOf(s.getString("image_file"), (0 until emojis.length()).joinToString(",") { emojis.getString(it) }, s.optString("accessibility_text")))
          }
        }
        c
      }
      else -> throw IllegalArgumentException("Unknown URI: $uri")
    }

  private fun metadata(list: List<JSONObject>) = MatrixCursor(
    arrayOf(
      "sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon",
      "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email", "sticker_pack_publisher_website",
      "sticker_pack_privacy_policy_website", "sticker_pack_license_agreement_website", "image_data_version",
      "whatsapp_will_not_cache_stickers", "animated_sticker_pack",
    ),
  ).apply {
    for (p in list) addRow(arrayOf(
      p.getString("identifier"), p.getString("name"), p.getString("publisher"), p.getString("tray_image_file"),
      "", "", "", "", "", "", p.optString("image_data_version", "1"), 0, 0,
    ))
  }

  override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
    if (matcher.match(uri) != ASSET) return null
    val seg = uri.pathSegments // stickers_asset / <id> / <file>
    val file = File(File(root, seg[1]), seg[2])
    if (!file.canonicalPath.startsWith(root.canonicalPath) || !file.exists()) return null
    return AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY), 0, AssetFileDescriptor.UNKNOWN_LENGTH)
  }

  override fun getType(uri: Uri): String? = when (matcher.match(uri)) {
    METADATA -> "vnd.android.cursor.dir/vnd.$authority.metadata"
    METADATA_ONE -> "vnd.android.cursor.item/vnd.$authority.metadata"
    STICKERS -> "vnd.android.cursor.dir/vnd.$authority.stickers"
    ASSET -> if (uri.lastPathSegment!!.endsWith(".png")) "image/png" else "image/webp"
    else -> null
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
  override fun delete(uri: Uri, selection: String?, args: Array<out String>?): Int = throw UnsupportedOperationException()
  override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<out String>?): Int = throw UnsupportedOperationException()

  companion object {
    private const val METADATA = 1
    private const val METADATA_ONE = 2
    private const val STICKERS = 3
    private const val ASSET = 4
  }
}
