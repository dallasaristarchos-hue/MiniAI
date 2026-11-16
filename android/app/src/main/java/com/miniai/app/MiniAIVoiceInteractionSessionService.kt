package com.miniai.app

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MiniAIVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle): VoiceInteractionSession = MiniAIVoiceInteractionSession(this)
}

private class MiniAIVoiceInteractionSession(
    private val appContext: android.content.Context
) : VoiceInteractionSession(appContext) {

    private fun dp(value: Int): Int = (value * appContext.resources.displayMetrics.density).toInt()

    override fun onCreateContentView(): View {
        val panel = LinearLayout(appContext).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = GradientDrawable().apply {
                setColor(Color.rgb(15, 13, 21))
                cornerRadius = dp(24).toFloat()
                setStroke(dp(1), Color.rgb(105, 76, 145))
            }
        }
        panel.addView(TextView(appContext).apply {
            text = "MiniAI"
            textSize = 23f
            setTextColor(Color.rgb(246, 237, 255))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2))
        panel.addView(TextView(appContext).apply {
            text = "What would you like to do?"
            textSize = 13f
            setTextColor(Color.rgb(185, 171, 205))
            gravity = Gravity.CENTER
            setPadding(0, dp(5), 0, dp(14))
        }, LinearLayout.LayoutParams(-1, -2))
        fun addAction(label: String, color: Int, focus: Boolean) {
            val button = Button(appContext).apply {
                text = label
                isAllCaps = false
                textSize = 14f
                setTextColor(Color.WHITE)
                backgroundTintList = android.content.res.ColorStateList.valueOf(color)
                setOnClickListener { launchMiniAI(focus) }
            }
            val params = LinearLayout.LayoutParams(-1, dp(48))
            params.bottomMargin = dp(9)
            panel.addView(button, params)
        }
        addAction("Ask MiniAI", Color.rgb(126, 75, 184), true)
        addAction("Open full chat", Color.rgb(65, 52, 82), false)
        panel.addView(TextView(appContext).apply {
            text = "Dismiss"
            textSize = 13f
            setTextColor(Color.rgb(195, 178, 215))
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(4))
            setOnClickListener { hide() }
        }, LinearLayout.LayoutParams(-1, -2))
        return panel
    }

    private fun launchMiniAI(focusComposer: Boolean) {
        val launch = Intent(appContext, MainActivity::class.java).apply {
            action = if (focusComposer) Intent.ACTION_ASSIST else Intent.ACTION_MAIN
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("opened_as_assistant", focusComposer)
        }
        startAssistantActivity(launch)
        hide()
    }
}
