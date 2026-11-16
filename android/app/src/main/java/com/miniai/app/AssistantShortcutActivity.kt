package com.miniai.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AssistantShortcutActivity : Activity() {
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(15, 13, 21)
        window.navigationBarColor = Color.rgb(15, 13, 21)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(26), dp(24), dp(22))
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(28, 20, 43), Color.rgb(15, 13, 21))).apply {
                cornerRadius = dp(24).toFloat()
                setStroke(dp(1), Color.rgb(126, 75, 184))
            }
        }
        panel.addView(TextView(this).apply {
            text = "MiniAI"; textSize = 25f; setTextColor(Color.rgb(246, 237, 255))
            typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2))
        panel.addView(TextView(this).apply {
            text = "What would you like to do?"; textSize = 14f
            setTextColor(Color.rgb(190, 174, 210)); gravity = Gravity.CENTER
            setPadding(0, dp(7), 0, dp(18))
        }, LinearLayout.LayoutParams(-1, -2))
        fun addAction(label: String, color: Int, ask: Boolean, dismiss: Boolean = false) {
            val button = Button(this).apply {
                text = label; isAllCaps = false; textSize = 15f; setTextColor(Color.WHITE)
                backgroundTintList = android.content.res.ColorStateList.valueOf(color)
                setOnClickListener {
                    if (dismiss) finish() else {
                        val launch = Intent(this@AssistantShortcutActivity, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            if (ask) putExtra("opened_as_assistant", true)
                        }
                        startActivity(launch); finish()
                    }
                }
            }
            val params = LinearLayout.LayoutParams(-1, dp(50)); params.bottomMargin = dp(10)
            panel.addView(button, params)
        }
        addAction("Ask MiniAI", Color.rgb(126, 75, 184), true)
        addAction("Open full chat", Color.rgb(75, 55, 100), false)
        addAction("Dismiss", Color.rgb(48, 42, 57), false, true)
        val outer = LinearLayout(this).apply {
            gravity = Gravity.CENTER; setPadding(dp(18), dp(18), dp(18), dp(18))
            setBackgroundColor(Color.rgb(8, 7, 12))
            addView(panel, LinearLayout.LayoutParams(-1, -2))
        }
        setContentView(outer, ViewGroup.LayoutParams(-1, -1))
    }
}
