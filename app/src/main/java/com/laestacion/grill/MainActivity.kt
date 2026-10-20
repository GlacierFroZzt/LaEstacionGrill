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
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import android.Manifest

class MainActivity : AppCompatActivity() {

    companion object {
        const val CANAL_ID = "canal_taqueria_alertas"
        const val CODIGO_PERMISO_NOTIF = 101
    }

    private lateinit var webView: WebView
    private lateinit var dirWebLive: File
    private var ultimaDescargaOtaMs: Long = 0L

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

        // Configuración del canal de notificaciones de alta prioridad para alertas del restaurante
        configurarCanalNotificaciones()
        solicitarPermisoNotificaciones()

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
            // Exponer puente nativo de notificaciones de alta prioridad para avisos y crasheos
            addJavascriptInterface(AndroidNotificationBridge(), "AndroidNotificationBridge")

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
            val ahora = System.currentTimeMillis()
            // Protección contra descargas duplicadas concurrentes (10 segundos)
            if (ahora - ultimaDescargaOtaMs < 10_000L) {
                return
            }
            ultimaDescargaOtaMs = ahora

            val urlFinal = if (urlZip.isNullOrBlank()) {
                if (packageName.contains("terminal")) {
                    "https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/terminal-bundle.zip"
                } else {
                    "https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip"
                }
            } else {
                urlZip
            }

            thread {
                try {
                    val conexion = URL(urlFinal).openConnection() as HttpURLConnection
                    conexion.connectTimeout = 8000
                    conexion.readTimeout = 15000
                    conexion.connect()

                    if (conexion.responseCode == HttpURLConnection.HTTP_OK) {
                        val input = conexion.inputStream
                        descomprimirZipEnDirectorio(input, dirWebLive)
                        input.close()

                        runOnUiThread {
                            Toast.makeText(this@MainActivity, "¡Aplicación actualizada!", Toast.LENGTH_SHORT).show()
                            webView.clearCache(true)
                            webView.reload()
                        }
                    } else {
                        // NUNCA recargar ante respuestas no-OK para no interrumpir al usuario
                        conexion.disconnect()
                    }
                } catch (_: Exception) {
                    // NUNCA recargar ante excepciones de red para no crear bucles de recarga
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

    private fun configurarCanalNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            val sonidoUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val canal = NotificationChannel(
                CANAL_ID,
                "Alertas de Alta Prioridad - La Estación Grill",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones críticas de crasheos, errores y eventos importantes del restaurante"
                enableLights(true)
                lightColor = Color.parseColor("#f59e0b")
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 350, 150, 350, 150, 450)
                setSound(sonidoUri, audioAttributes)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(canal)
        }
    }

    private fun solicitarPermisoNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), CODIGO_PERMISO_NOTIF)
            }
        }
    }

    fun mostrarNotificacionNativa(titulo: String, mensaje: String, nivel: String) {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(this, CANAL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(titulo)
                .setContentText(mensaje)
                .setStyle(NotificationCompat.BigTextStyle().bigText(mensaje))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(longArrayOf(0, 350, 150, 350, 150, 450))

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val idNotif = (System.currentTimeMillis() % 100000).toInt()
            notificationManager.notify(idNotif, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Puente para enviar notificaciones nativas de alta prioridad desde la app web
     */
    inner class AndroidNotificationBridge {
        @JavascriptInterface
        fun emitirNotificacion(titulo: String, mensaje: String, nivel: String) {
            runOnUiThread {
                mostrarNotificacionNativa(titulo, mensaje, nivel)
            }
        }

        @JavascriptInterface
        fun tienePermisoNotificaciones(): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        }

        @JavascriptInterface
        fun solicitarPermiso() {
            runOnUiThread {
                solicitarPermisoNotificaciones()
            }
        }
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
