package expo.modules.camartnative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.graphics.BitmapFactory
import android.view.View
import android.widget.RemoteViews
import java.io.File

/** Home-screen widget showing the latest sticker (written by JS to <filesDir>/camart/widget/today.png). */
class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val file = File(context.filesDir, "camart/widget/today.png")
    // Keep the bitmap small: RemoteViews travel over a size-limited binder.
    val bmp = if (file.exists()) BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = 2 }) else null
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val tap = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.today_widget)
      if (bmp != null) {
        views.setImageViewBitmap(R.id.widget_sticker, bmp)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
      } else {
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
      }
      views.setOnClickPendingIntent(R.id.widget_root, tap)
      manager.updateAppWidget(id, views)
    }
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidget::class.java))
      if (ids.isNotEmpty()) TodayWidget().onUpdate(context, manager, ids)
    }
  }
}
