import Foundation
import Capacitor
import StripeTerminal

@available(iOS 15.0, *)
@objc public class StripeTapToPayPlugin: CAPPlugin, CAPBridgedPlugin, ConnectionTokenProvider, DiscoveryDelegate, TapToPayReaderDelegate {
    public let identifier = "StripeTapToPayPlugin"
    public let jsName = "StripeTapToPay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setConnectionToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discoverReaders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connectReader", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnectReader", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "collectPaymentMethod", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirmPaymentIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelPaymentIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isDeviceCapable", returnType: CAPPluginReturnPromise)
    ]
    private var connectionTokenCompletion: ConnectionTokenCompletionBlock?
    private var discoverCancelable: Cancelable?
    private var pendingDiscoverCall: CAPPluginCall?
    private var discoveredReaders: [Reader] = []
    private var currentPaymentIntent: PaymentIntent?
    private var lastLocationId: String?

    @objc func initialize(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] initialize() called")
        DispatchQueue.main.async {
            CAPLog.print("⚡️ [StripeTapToPay] initialize() running on main thread: \(Thread.isMainThread)")
            if !Terminal.isInitialized() {
                Terminal.setLogListener { logLine in
                    CAPLog.print("⚡️ [StripeTapToPay] \(logLine)")
                }
                // Stripe Terminal iOS calls are expected on the main thread.
                Terminal.initWithTokenProvider(self, delegate: nil, offlineDelegate: nil, logLevel: .verbose)
            }
            call.resolve()
        }
    }

    // MARK: - SCPConnectionTokenProvider
    public func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        DispatchQueue.main.async {
            if self.connectionTokenCompletion != nil {
                CAPLog.print("⚡️ [StripeTapToPay] Ignoring duplicate token request while one is already pending")
                return
            }
            CAPLog.print("⚡️ [StripeTapToPay] fetchConnectionToken requested by SDK")
            self.connectionTokenCompletion = completion
            self.notifyListeners("requestedConnectionToken", data: [:])
        }
    }

    @objc func setConnectionToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty else {
            call.reject("Missing connection token")
            return
        }

        if let completion = connectionTokenCompletion {
            CAPLog.print("⚡️ [StripeTapToPay] setConnectionToken received token, completing pending request")
            completion(token, nil)
            connectionTokenCompletion = nil
        } else {
            CAPLog.print("⚡️ [StripeTapToPay] setConnectionToken received token but no pending completion exists")
        }
        call.resolve()
    }

    // MARK: - Discovery
    @objc func discoverReaders(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] discoverReaders() called")
        DispatchQueue.main.async {
            CAPLog.print("⚡️ [StripeTapToPay] discoverReaders() running on main thread: \(Thread.isMainThread)")
            guard Terminal.isInitialized() else {
                call.reject("Terminal not initialized")
                return
            }

            if Terminal.shared.connectionStatus == .connected, let existingReader = Terminal.shared.connectedReader {
                CAPLog.print("⚡️ [StripeTapToPay] discoverReaders() reusing existing connected reader")
                call.resolve(["readers": [self.serializeReader(existingReader)], "alreadyConnected": true])
                return
            }

            let type = call.getString("type") ?? "tap-to-pay"
            let isSimulated = call.getBool("isSimulated") ?? false
            let locationId = call.getString("locationId")
            self.lastLocationId = locationId

            let config: DiscoveryConfiguration
            do {
                switch type {
                case "tap_to_pay", "tap-to-pay":
                    CAPLog.print("⚡️ [StripeTapToPay] Using TapToPay discovery (simulated=\(isSimulated))")
                    config = try TapToPayDiscoveryConfigurationBuilder()
                        .setSimulated(isSimulated)
                        .build()
                default:
                    CAPLog.print("⚡️ [StripeTapToPay] Using Internet discovery (simulated=\(isSimulated))")
                    let builder = InternetDiscoveryConfigurationBuilder()
                        .setSimulated(isSimulated)
                    if let loc = locationId {
                        _ = builder.setLocationId(loc)
                    }
                    config = try builder.build()
                }
            } catch {
                call.reject(error.localizedDescription)
                return
            }

            self.discoveredReaders = []
            self.pendingDiscoverCall = call

            if let existingCancelable = self.discoverCancelable {
                Task {
                    try? await existingCancelable.cancel()
                }
            }

            self.discoverCancelable = Terminal.shared.discoverReaders(config, delegate: self) { [weak self] error in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    defer { self.discoverCancelable = nil }

                    if let error = error {
                        CAPLog.print("⚡️ [StripeTapToPay] discoverReaders failed: \(error.localizedDescription)")
                        self.pendingDiscoverCall?.reject(error.localizedDescription)
                        self.pendingDiscoverCall = nil
                        return
                    }

                    CAPLog.print("⚡️ [StripeTapToPay] discoverReaders completed")
                    if let pendingCall = self.pendingDiscoverCall {
                        let payload = self.discoveredReaders.map { self.serializeReader($0) }
                        pendingCall.resolve(["readers": payload])
                        self.pendingDiscoverCall = nil
                    }
                }
            }
        }
    }

    public func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        DispatchQueue.main.async {
            CAPLog.print("⚡️ [StripeTapToPay] discoverReaders emitted \(readers.count) readers")
            self.discoveredReaders = readers

            if let pendingCall = self.pendingDiscoverCall {
                let payload = readers.map { self.serializeReader($0) }
                pendingCall.resolve(["readers": payload])
                self.pendingDiscoverCall = nil

                if let cancelable = self.discoverCancelable {
                    Task {
                        try? await cancelable.cancel()
                    }
                }
            }
        }
    }

    // MARK: - Connect / Disconnect
    @objc func connectReader(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] connectReader() called")
        DispatchQueue.main.async {
            if Terminal.shared.connectionStatus == .connected, let existingReader = Terminal.shared.connectedReader {
                CAPLog.print("⚡️ [StripeTapToPay] connectReader() reusing existing connected reader")
                let payload = self.serializeReader(existingReader)
                call.resolve(["reader": payload, "alreadyConnected": true])
                return
            }

            guard let readerDict = call.getObject("reader") else {
                call.reject("Missing reader")
                return
            }

            guard let reader = self.lookupReader(from: readerDict) else {
                call.reject("Reader not found")
                return
            }

            let locationId = call.getString("locationId") ?? reader.locationId ?? self.lastLocationId ?? ""

            guard reader.deviceType == .tapToPay else {
                call.reject("Only Tap to Pay is supported on iOS")
                return
            }
            if locationId.isEmpty {
                call.reject("Missing locationId for Tap to Pay")
                return
            }

            let builder = TapToPayConnectionConfigurationBuilder(delegate: self, locationId: locationId)
            let connectionConfig: TapToPayConnectionConfiguration
            do {
                connectionConfig = try builder.build()
            } catch {
                call.reject(error.localizedDescription)
                return
            }

            Terminal.shared.connectReader(reader, connectionConfig: connectionConfig) { connectedReader, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                CAPLog.print("⚡️ [StripeTapToPay] connectReader() success")
                let payload = self.serializeReader(connectedReader ?? reader)
                call.resolve(["reader": payload])
            }
        }
    }

    @objc func disconnectReader(_ call: CAPPluginCall) {
        Terminal.shared.disconnectReader { error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve()
        }
    }

    // MARK: - Payments
    @objc func collectPaymentMethod(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] collectPaymentMethod() called")
        guard let clientSecret = call.getString("paymentIntent"), !clientSecret.isEmpty else {
            call.reject("Missing paymentIntent client secret")
            return
        }

        Terminal.shared.retrievePaymentIntent(clientSecret: clientSecret) { intent, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let intent = intent else {
                call.reject("PaymentIntent not found")
                return
            }
            self.currentPaymentIntent = intent

            _ = Terminal.shared.collectPaymentMethod(intent) { collectedIntent, collectError in
                if let collectError = collectError {
                    call.reject(collectError.localizedDescription)
                    return
                }
                if let collectedIntent = collectedIntent {
                    self.currentPaymentIntent = collectedIntent
                    call.resolve(["paymentIntent": self.serializePaymentIntent(collectedIntent)])
                } else {
                    call.reject("collectPaymentMethod failed")
                }
            }
        }
    }

    @objc func confirmPaymentIntent(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] confirmPaymentIntent() called")
        guard let intent = currentPaymentIntent else {
            call.reject("No PaymentIntent available to confirm")
            return
        }

        _ = Terminal.shared.confirmPaymentIntent(intent) { confirmedIntent, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            if let confirmedIntent = confirmedIntent {
                self.currentPaymentIntent = confirmedIntent
                call.resolve(["paymentIntent": self.serializePaymentIntent(confirmedIntent)])
            } else {
                call.reject("confirmPaymentIntent failed")
            }
        }
    }

    @objc func cancelPaymentIntent(_ call: CAPPluginCall) {
        guard let intent = currentPaymentIntent else {
            call.reject("No PaymentIntent available to cancel")
            return
        }

        Terminal.shared.cancelPaymentIntent(intent) { canceledIntent, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            if let canceledIntent = canceledIntent {
                self.currentPaymentIntent = canceledIntent
                call.resolve(["paymentIntent": self.serializePaymentIntent(canceledIntent)])
            } else {
                call.reject("cancelPaymentIntent failed")
            }
        }
    }

    @objc func isDeviceCapable(_ call: CAPPluginCall) {
        CAPLog.print("⚡️ [StripeTapToPay] isDeviceCapable() called")
        let result = Terminal.shared.supportsReaders(of: .tapToPay, discoveryMethod: .tapToPay, simulated: false)
        switch result {
        case .success:
            call.resolve(["value": true])
        case .failure(let error):
            call.resolve(["value": false, "error": error.localizedDescription])
        }
    }

    // MARK: - Helpers
    private func lookupReader(from dict: [String: Any]) -> Reader? {
        if let serial = dict["serialNumber"] as? String {
            return discoveredReaders.first { $0.serialNumber == serial }
        }
        return discoveredReaders.first
    }

    private func serializeReader(_ reader: Reader) -> [String: Any] {
        return [
            "serialNumber": reader.serialNumber,
            "stripeId": reader.stripeId ?? "",
            "deviceType": deviceTypeString(reader.deviceType),
            "locationId": reader.locationId ?? "",
            "label": reader.label ?? "",
            "simulated": reader.simulated,
        ]
    }

    private func serializePaymentIntent(_ intent: PaymentIntent) -> [String: Any] {
        return [
            "id": intent.stripeId,
            "clientSecret": intent.clientSecret ?? "",
            "amount": intent.amount,
            "currency": intent.currency,
            "livemode": intent.livemode,
        ]
    }

    private func deviceTypeString(_ type: DeviceType) -> String {
        switch type {
        case .tapToPay: return "tap_to_pay"
        case .stripeS700, .stripeS700DevKit, .stripeS710, .stripeS710DevKit: return "business_reader"
        case .stripeM2, .wisePad3, .chipper2X: return "bluetooth"
        default: return "unknown"
        }
    }

    // MARK: - Required TapToPay reader delegate methods (no-op)
    public func tapToPayReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {}
    public func tapToPayReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {}
    public func tapToPayReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {}
    public func tapToPayReader(_ reader: Reader, didRequestReaderInput inputOptions: ReaderInputOptions) {}
    public func tapToPayReader(_ reader: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {}
}
