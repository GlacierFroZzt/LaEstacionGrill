import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private var webView: WKWebView!

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override var prefersHomeIndicatorAutoHidden: Bool {
        return true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0) // #12100e

        configurarWebView()
        cargarAplicacion()
    }

    private func configurarWebView() {
        let configuracion = WKWebViewConfiguration()
        configuracion.allowsInlineMediaPlayback = true
        configuracion.mediaTypesRequiringUserActionForPlayback = []

        let preferencias = WKWebpagePreferences()
        preferencias.allowsContentJavaScript = true
        configuracion.defaultWebpagePreferences = preferencias

        webView = WKWebView(frame: .zero, configuration: configuracion)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0)
        webView.scrollView.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true

        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        inyectarSafeAreas()
    }

    private func inyectarSafeAreas() {
        let insets = view.safeAreaInsets
        let js = """
            document.documentElement.style.setProperty('--notch-top', '\(insets.top)px');
            document.documentElement.style.setProperty('--notch-bottom', '\(insets.bottom)px');
            document.documentElement.style.setProperty('--notch-left', '\(insets.left)px');
            document.documentElement.style.setProperty('--notch-right', '\(insets.right)px');
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func cargarAplicacion() {
        // 1. Intentar cargar los assets locales empaquetados en la app
        if let urlIndex = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            let directorioWeb = urlIndex.deletingLastPathComponent()
            webView.loadFileURL(urlIndex, allowingReadAccessTo: directorioWeb)
            return
        }

        // 2. Si no están en bundle local, intentar ruta en Documents o servidor local
        let fileManager = FileManager.default
        if let docsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            let rutaWebDocs = docsDir.appendingPathComponent("web/index.html")
            if fileManager.fileExists(atPath: rutaWebDocs.path) {
                webView.loadFileURL(rutaWebDocs, allowingReadAccessTo: docsDir.appendingPathComponent("web"))
                return
            }
        }

        // 3. Fallback por defecto en desarrollo local
        if let urlLocal = URL(string: "http://localhost:5173") {
            let peticion = URLRequest(url: urlLocal)
            webView.load(peticion)
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        inyectarSafeAreas()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        decisionHandler(.allow)
    }
}
