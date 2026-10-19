import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Configurar apariencia global oscura de Taquería Km 243
        if #available(iOS 13.0, *) {
            // El ciclo de vida de la ventana lo gestiona SceneDelegate
        } else {
            let ventana = UIWindow(frame: UIScreen.main.bounds)
            ventana.rootViewController = ViewController()
            ventana.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0) // #12100e
            ventana.makeKeyAndVisible()
            self.window = ventana
        }
        return true
    }

    // MARK: - UISceneSession Lifecycle
    @available(iOS 13.0, *)
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    @available(iOS 13.0, *)
    func application(
        _ application: UIApplication,
        didDiscardSceneSessions sceneSessions: Set<UISceneSession>
    ) {
    }
}
