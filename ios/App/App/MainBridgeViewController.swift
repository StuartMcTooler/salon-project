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
        bridge?.registerPluginType(StripeTapToPayPlugin.self)
    }
}
