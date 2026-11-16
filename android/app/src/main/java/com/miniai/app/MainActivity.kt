package com.miniai.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.view.WindowManager
import android.os.Build
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private val fileChooserRequest = 4101
    private val webPermissionRequest = 4102
    private var systemBackCallback: OnBackInvokedCallback? = null
    private var pendingAssistantOpen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        window.setSoftInputMode(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
            else WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        )
        webView = WebView(this)
        webView.setBackgroundColor(Color.BLACK)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) webView.settings.safeBrowsingEnabled = true
        pendingAssistantOpen = intent.getBooleanExtra("opened_as_assistant", false) || intent.action == Intent.ACTION_ASSIST
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "miniai-ai.pages.dev") return false
                if (uri.scheme == "https" || uri.scheme == "mailto") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                }
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (pendingAssistantOpen) {
                    openAssistantComposer()
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    startActivityForResult(params.createIntent(), fileChooserRequest)
                    true
                } catch (_: Exception) {
                    filePathCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val supported = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }.toTypedArray()
                    if (supported.isEmpty() || supported.size != request.resources.size) { request.deny(); return@runOnUiThread }
                    val needed = mutableListOf<String>()
                    if (supported.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) needed.add(Manifest.permission.RECORD_AUDIO)
                    if (supported.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) needed.add(Manifest.permission.CAMERA)
                    val missing = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
                    if (missing.isEmpty()) request.grant(supported)
                    else { pendingPermissionRequest = request; requestPermissions(missing.toTypedArray(), webPermissionRequest) }
                }
            }
        }
        webView.setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val systemBars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                val bottomInset = if (insets.isVisible(WindowInsets.Type.ime())) maxOf(systemBars.bottom, ime.bottom) else systemBars.bottom
                view.setPadding(systemBars.left, systemBars.top, systemBars.right, bottomInset)
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        setContentView(webView)
        webView.requestApplyInsets()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            systemBackCallback = OnBackInvokedCallback { handleSystemBack() }
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, systemBackCallback!!)
        }
        if (savedInstanceState == null) webView.loadUrl("https://miniai-ai.pages.dev/?source=android") else webView.restoreState(savedInstanceState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("opened_as_assistant", false) || intent.action == Intent.ACTION_ASSIST) {
            pendingAssistantOpen = true
            if (::webView.isInitialized) openAssistantComposer()
        }
    }

    private fun openAssistantComposer() {
        if (!::webView.isInitialized) { pendingAssistantOpen = true; return }
        webView.post {
            webView.requestFocus()
            webView.evaluateJavascript("window.openMiniAIAssistant ? window.openMiniAIAssistant() : false") { result ->
                if (result == "true") {
                    pendingAssistantOpen = false
                    webView.requestFocus()
                    val inputMethod = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                    inputMethod.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT)
                } else {
                    pendingAssistantOpen = true
                }
            }
        }
    }

    @Deprecated("Legacy file chooser callback required by WebView")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == fileChooserRequest) {
            val callback = filePathCallback
            filePathCallback = null
            callback?.onReceiveValue(if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null)
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == webPermissionRequest) {
            val request = pendingPermissionRequest
            pendingPermissionRequest = null
            if (request != null) {
                if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) request.grant(request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }.toTypedArray())
                else request.deny()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); webView.saveState(outState) }
    private fun handleSystemBack() {
        if (!::webView.isInitialized) { finish(); return }
        webView.evaluateJavascript("window.handleMiniAIBack ? window.handleMiniAIBack() : false") { result ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            if (result != "true") {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        }
    }

    @Deprecated("Legacy back navigation callback for Android versions below 13")
    override fun onBackPressed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) handleSystemBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) systemBackCallback?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
        if (::webView.isInitialized) { webView.stopLoading(); webView.destroy() }
        super.onDestroy()
    }
}
