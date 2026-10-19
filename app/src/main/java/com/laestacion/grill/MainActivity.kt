package com.laestacion.grill

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var dirWebLive: File

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Carpeta interna persistente para actualizaciones en caliente OTA
        dirWebLive = File(filesDir, "web_live")
        if (!dirWebLive.exists()) {
            dirWebLive.mkdirs()
        }

        // Manejo nativo y gestual de retroceso para celulares y tablets Android (evita que la app se cierre por accidente)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (this@MainActivity::webView.isInitialized) {
                    webView.evaluateJavascript(
                        "(function() { if (window.__manejarBotonAtras) { return window.__manejarBotonAtras(); } if (window.history.length > 1) { window.history.back(); return true; } return false; })();",
                        null
                    )
                }
            }
        })

        // Configuración inmersiva de pantalla completa para tablets y celulares
        configurarPantallaCompletaInmersiva()

        // Cargador híbrido de assets: Si existe una versión web actualizada OTA en disco interno,
        // se sirve prioritariamente; si no, se sirven los assets de fábrica preempaquetados en el APK.
        val defaultAssetsHandler = WebViewAssetLoader.AssetsPathHandler(this)
        val liveStorageHandler = WebViewAssetLoader.InternalStoragePathHandler(this, dirWebLive)

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .setHttpAllowed(true)
            .addPathHandler("/assets/web/", object : WebViewAssetLoader.PathHandler {
                override fun handle(path: String): WebResourceResponse? {
                    val archivoLive = File(dirWebLive, path)
                    if (archivoLive.exists() && archivoLive.isFile) {
                        return liveStorageHandler.handle(path)
                    }
                    return defaultAssetsHandler.handle("web/$path")
                }
            })
            .addPathHandler("/assets/", defaultAssetsHandler)
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0d0c0a"))

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }

            // Exponer puente nativo para gestión de actualizaciones OTA desde la interfaz web
            addJavascriptInterface(AndroidOtaBridge(), "AndroidOtaBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return false
                    val scheme = uri.scheme?.lowercase() ?: return false
                    if (scheme == "mailto" || scheme == "tel" || scheme == "whatsapp" || scheme == "intent") {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, uri)
                            view?.context?.startActivity(intent)
                            return true
                        } catch (_: Exception) {
                            return true
                        }
                    }
                    return false
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val rootInsets = ViewCompat.getRootWindowInsets(window.decorView)
                    if (rootInsets != null) {
                        aplicarMargenNotch(rootInsets)
                    }
                    // Disparar comprobación de actualización automática en segundo plano
                    view?.postDelayed({
                        view.evaluateJavascript(
                            "(function() { if (window.servicioActualizacionesAuto) { window.servicioActualizacionesAuto(); } })();",
                            null
                        )
                    }, 400)
                }
            }

            webChromeClient = WebChromeClient()
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }

        setContentView(webView)

        // Escucha cambios en el recorte de pantalla (notch) o rotación
        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
            aplicarMargenNotch(insets)
            insets
        }

        // Carga la app a través del dominio virtual permitiendo conexiones seguras y sockets locales
        webView.loadUrl("http://appassets.androidplatform.net/assets/web/index.html")
    }

    /**
     * Puente nativo expuesto a JavaScript para control de actualizaciones OTA sin reinstalar APK.
     */
    inner class AndroidOtaBridge {
        @JavascriptInterface
        fun esAndroidNativo(): Boolean = true

        @JavascriptInterface
        fun obtenerVersionNativa(): String = "1.0.1"

        @JavascriptInterface
        fun verificarActualizaciones() {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Comprobando mejoras del sistema...", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun descargarYActualizar(urlZip: String?) {
            val urlFinal = if (urlZip.isNullOrBlank()) {
                // Endpoint remoto en la nube oficial de Supabase Storage
                "https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip"
            } else {
                urlZip
            }

            thread {
                try {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Actualizando la aplicación...", Toast.LENGTH_SHORT).show()
                    }

                    val conexion = URL(urlFinal).openConnection() as HttpURLConnection
                    conexion.connectTimeout = 8000
                    conexion.readTimeout = 15000
                    conexion.connect()

                    if (conexion.responseCode == HttpURLConnection.HTTP_OK) {
                        val input = conexion.inputStream
                        descomprimirZipEnDirectorio(input, dirWebLive)
                        input.close()

                        runOnUiThread {
                            Toast.makeText(this@MainActivity, "¡Aplicación lista y al día!", Toast.LENGTH_SHORT).show()
                            webView.clearCache(true)
                            webView.reload()
                        }
                    } else {
                        runOnUiThread {
                            webView.clearCache(true)
                            webView.reload()
                        }
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        webView.clearCache(true)
                        webView.reload()
                    }
                }
            }
        }

        @JavascriptInterface
        fun restaurarVersionFabrica() {
            dirWebLive.deleteRecursively()
            dirWebLive.mkdirs()
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Sistema restablecido.", Toast.LENGTH_SHORT).show()
                webView.clearCache(true)
                webView.reload()
            }
        }
    }

    private fun descomprimirZipEnDirectorio(zipInput: InputStream, destino: File) {
        val buffer = ByteArray(4096)
        val zis = ZipInputStream(zipInput)
        var entrada: ZipEntry? = zis.nextEntry

        while (entrada != null) {
            val nombreLimpio = entrada.name.replace('\\', '/')
            val nuevoArchivo = File(destino, nombreLimpio)
            // Seguridad contra Zip Slip
            if (!nuevoArchivo.canonicalPath.startsWith(destino.canonicalPath)) {
                throw SecurityException("Ruta no permitida en archivo zip: ${entrada.name}")
            }

            if (entrada.isDirectory || nombreLimpio.endsWith("/")) {
                nuevoArchivo.mkdirs()
            } else {
                nuevoArchivo.parentFile?.mkdirs()
                val fos = FileOutputStream(nuevoArchivo)
                var len: Int
                while (zis.read(buffer).also { len = it } > 0) {
                    fos.write(buffer, 0, len)
                }
                fos.close()
            }
            zis.closeEntry()
            entrada = zis.nextEntry
        }
        zis.close()
    }

    private fun aplicarMargenNotch(insets: WindowInsetsCompat) {
        val density = resources.displayMetrics.density
        if (density <= 0f) return

        val cutout = insets.displayCutout
        val safeTop = ((cutout?.safeInsetTop ?: 0).coerceAtLeast(insets.getInsets(WindowInsetsCompat.Type.statusBars()).top)) / density
        val safeBottom = ((cutout?.safeInsetBottom ?: 0).coerceAtLeast(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom)) / density
        val safeLeft = ((cutout?.safeInsetLeft ?: 0).coerceAtLeast(insets.getInsets(WindowInsetsCompat.Type.displayCutout()).left)) / density
        val safeRight = ((cutout?.safeInsetRight ?: 0).coerceAtLeast(insets.getInsets(WindowInsetsCompat.Type.displayCutout()).right)) / density

        val js = """
            if (document.documentElement && document.documentElement.style) {
                document.documentElement.style.setProperty('--notch-top', '${safeTop}px');
                document.documentElement.style.setProperty('--notch-bottom', '${safeBottom}px');
                document.documentElement.style.setProperty('--notch-left', '${safeLeft}px');
                document.documentElement.style.setProperty('--notch-right', '${safeRight}px');
            }
        """.trimIndent()

        if (this::webView.isInitialized) {
            webView.post {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun configurarPantallaCompletaInmersiva() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.hide(WindowInsetsCompat.Type.systemBars())
        insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onResume() {
        super.onResume()
        configurarPantallaCompletaInmersiva()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized) {
            webView.evaluateJavascript(
                "(function() { if (window.__manejarBotonAtras) { return window.__manejarBotonAtras(); } if (window.history.length > 1) { window.history.back(); return true; } return false; })();",
                null
            )
        }
    }
}
