package de.stillmind.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import de.stillmind.app.R

class StillMindWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences("de.stillmind.app.widget", Context.MODE_PRIVATE)
            val streak    = prefs.getInt("widget_streak", 0)
            val doneToday = prefs.getBoolean("widget_done_today", false)
            val missed    = prefs.getInt("widget_missed_days", 0)

            // Determine state
            data class StoneState(
                val message: String,
                val subMessage: String,
                val streakLabel: String,
                val showCta: Boolean,
                val messageColor: Int,
                val alpha: Float
            )

            val state = when {
                doneToday -> StoneState(
                    message = "Du bist ruhig.",
                    subMessage = if (streak > 1) "$streak Tage Streak 🔥" else "Heute geschafft ✓",
                    streakLabel = if (streak > 1) "🔥 $streak Tage" else "",
                    showCta = false,
                    messageColor = Color.parseColor("#CDB98A"),
                    alpha = 1.0f
                )
                missed == 0 -> StoneState(
                    message = "Heute noch nichts.",
                    subMessage = "60 Sekunden reichen.",
                    streakLabel = "",
                    showCta = true,
                    messageColor = Color.WHITE,
                    alpha = 0.85f
                )
                missed == 1 -> StoneState(
                    message = "Dein Streak bröckelt…",
                    subMessage = "Rette ihn jetzt.",
                    streakLabel = "",
                    showCta = true,
                    messageColor = Color.WHITE,
                    alpha = 0.70f
                )
                missed == 2 -> StoneState(
                    message = "Du wirst unruhiger.",
                    subMessage = "Komm zurück.",
                    streakLabel = "",
                    showCta = true,
                    messageColor = Color.WHITE,
                    alpha = 0.55f
                )
                else -> StoneState(
                    message = "Alles auf Anfang?",
                    subMessage = "Starte neu – jetzt.",
                    streakLabel = "",
                    showCta = true,
                    messageColor = Color.parseColor("#FF6B6B"),
                    alpha = 0.45f
                )
            }

            // Try both layouts (small + medium share same Provider for simplicity)
            val views = RemoteViews(context.packageName, R.layout.widget_medium)

            views.setTextViewText(R.id.widget_message, state.message)
            views.setTextColor(R.id.widget_message, state.messageColor)
            views.setTextViewText(R.id.widget_sub, state.subMessage)
            views.setFloat(R.id.widget_stone, "setAlpha", state.alpha)

            // Streak badge
            if (state.streakLabel.isNotEmpty()) {
                views.setTextViewText(R.id.widget_streak, state.streakLabel)
                views.setViewVisibility(R.id.widget_streak, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.widget_streak, View.GONE)
            }

            // CTA
            views.setViewVisibility(R.id.widget_cta, if (state.showCta) View.VISIBLE else View.GONE)

            // Tap → open app
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?.apply { action = "de.stillmind.app.OPEN_SESSION" }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_stone, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_message, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_cta, pendingIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val provider = android.content.ComponentName(context, StillMindWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(provider)
            for (id in ids) updateWidget(context, manager, id)
        }
    }
}
