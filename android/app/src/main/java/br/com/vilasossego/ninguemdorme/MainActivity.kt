package br.com.vilasossego.ninguemdorme

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.io.File

/** Abre o jogo (site hospedado em GAME_URL) em tela cheia e liga a ele anúncios e compras. */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var ads: AdsManager
    private lateinit var billing: BillingManager
    private val gameHost: String = Uri.parse(BuildConfig.GAME_URL).host ?: ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this)
        root.setBackgroundColor(0xFF3B49F0.toInt())
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        // Android 15 desenha atrás das barras do sistema: empurra o jogo para dentro delas.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        ads = AdsManager(this, ::emit)
        billing = BillingManager(this, ::emit)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true            // o perfil do jogador fica no localStorage
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        web.setBackgroundColor(0xFF3B49F0.toInt())
        web.addJavascriptInterface(Bridge(), "AndroidApp")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.toString().startsWith("https://appassets.androidplatform.net/retry")) {
                    view.loadUrl(BuildConfig.GAME_URL); return true
                }
                if (url.host == gameHost) return false
                openExternal(url)                // qualquer outro endereço abre fora do jogo
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) view.loadUrl("file:///android_asset/offline.html")
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { moveTaskToBack(true) }    // não derruba a sala sem querer
        })

        if (savedInstanceState == null) web.loadUrl(BuildConfig.GAME_URL) else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); web.saveState(outState) }
    override fun onResume() { super.onResume(); web.onResume(); billing.refresh() }
    override fun onPause() { web.onPause(); super.onPause() }
    override fun onDestroy() { billing.close(); web.destroy(); super.onDestroy() }

    /** Envia um evento para o jogo (window.onMonet). */
    private fun emit(o: JSONObject) {
        web.post { web.evaluateJavascript("window.onMonet&&window.onMonet($o)", null) }
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme != "https" && uri.scheme != "http") return
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) { }
    }

    /** Só aceita chamadas vindas do nosso próprio site. */
    private fun trusted(): Boolean = Uri.parse(web.url ?: "").host == gameHost

    inner class Bridge {
        @JavascriptInterface fun init() = runOnUiThread { if (trusted()) { ads.init(); billing.start() } }
        @JavascriptInterface fun showInterstitial() = runOnUiThread { if (trusted()) ads.showInterstitial() }
        @JavascriptInterface fun showRewarded() = runOnUiThread { if (trusted()) ads.showRewarded() }
        @JavascriptInterface fun buy(id: String) = runOnUiThread { if (trusted()) billing.buy(id) }
        @JavascriptInterface fun openUrl(url: String) = runOnUiThread { if (trusted()) openExternal(Uri.parse(url)) }

        @JavascriptInterface fun share(text: String) = runOnUiThread {
            if (!trusted()) return@runOnUiThread
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text.take(1000))
            startActivity(Intent.createChooser(send, null))
        }

        @JavascriptInterface fun shareImage(base64Png: String, text: String) = runOnUiThread {
            if (!trusted() || base64Png.length > 8_000_000) return@runOnUiThread
            try {
                val dir = File(cacheDir, "shared").apply { mkdirs() }
                val file = File(dir, "vila-resultado.png")
                file.writeBytes(Base64.decode(base64Png, Base64.DEFAULT))
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
                    .putExtra(Intent.EXTRA_TEXT, text.take(1000)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(Intent.createChooser(send, null))
            } catch (_: Exception) { }
        }
    }
}
