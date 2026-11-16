package com.miniai.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.content.Intent
import android.net.Uri

class MainActivity : Activity() {
    private lateinit var webView: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "https" && uri.host == "miniai-ai.pages.dev") false else {
                    startActivity(Intent(Intent.ACTION_VIEW, uri)); true
                }
            }
        }
        webView.webChromeClient = WebChromeClient()
        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl("https://miniai-ai.pages.dev/?source=android") else webView.restoreState(savedInstanceState)
    }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); webView.saveState(outState) }
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
}
