import Capacitor

@available(iOS 15.0, *)
class MainBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        CAPLog.print("⚡️ [StripeTapToPay] MainBridgeViewController capacitorDidLoad")
        // Log plugin list from capacitor.config.json inside the app bundle
        if let url = Bundle.main.url(forResource: "capacitor.config", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let list = json["packageClassList"] {
            CAPLog.print("⚡️ [StripeTapToPay] capacitor.config packageClassList: \(String(describing: list))")
        } else {
            CAPLog.print("⚡️ [StripeTapToPay] capacitor.config.json not found in bundle")
        }
        // Force-register an instance of the custom plugin after the bridge loads.
        // This is more reliable than registerPluginType(_:), which is ignored when
        // Capacitor auto-registers plugins from capacitor.config.json.
        if let bridge = bridge {
            bridge.registerPluginInstance(StripeTapToPayPlugin())
            CAPLog.print("⚡️ [StripeTapToPay] registerPluginInstance(StripeTapToPayPlugin())")
        } else {
            CAPLog.print("⚡️ [StripeTapToPay] bridge unavailable while registering StripeTapToPayPlugin")
        }
    }
}
