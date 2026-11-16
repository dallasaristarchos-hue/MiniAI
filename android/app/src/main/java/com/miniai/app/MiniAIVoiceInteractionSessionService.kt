package com.miniai.app

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class MiniAIVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle): VoiceInteractionSession {
        return MiniAIVoiceInteractionSession(this)
    }
}

private class MiniAIVoiceInteractionSession(
    private val appContext: android.content.Context
) : VoiceInteractionSession(appContext) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        val launch = android.content.Intent(appContext, MainActivity::class.java).apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("opened_as_assistant", true)
        }
        appContext.startActivity(launch)
        hide()
    }
}
