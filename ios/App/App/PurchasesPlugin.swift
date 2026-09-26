import Capacitor
import StoreKit
import Security

@objc(PurchasesPlugin)
public class PurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PurchasesPlugin"
    public let jsName = "Purchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    private var updates: Task<Void, Never>?
    private var busy = false
    private var products: [Product] = []
    private var clockDate = Date()
    private var clockUptime = ProcessInfo.processInfo.systemUptime

    public override func load() {
        updates = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result,
                   [PurchasePolicy.trialID, PurchasePolicy.lifetimeID].contains(transaction.productID) {
                    await transaction.finish()
                    self.notifyListeners("changed", data: await self.snapshot())
                }
            }
        }
    }
    deinit { updates?.cancel() }

    // A Keychain high-water mark and monotonic uptime prevent a simple clock
    // rollback from extending an already-used trial. StoreKit owns the start date.
    @MainActor private func effectiveNow(signed: Date? = nil) -> Date {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "jp.amimononote.purchase-clock",
            kSecAttrAccount as String: "lastSeen"]
        var read = query; read[kSecReturnData as String] = true
        var item: CFTypeRef?
        SecItemCopyMatching(read as CFDictionary, &item)
        let saved = (item as? Data).flatMap { String(data: $0, encoding: .utf8) }.flatMap(Double.init) ?? 0
        let uptime = ProcessInfo.processInfo.systemUptime
        let elapsed = max(0, uptime - clockUptime)
        let now = [Date().timeIntervalSince1970, saved, clockDate.timeIntervalSince1970 + elapsed, signed?.timeIntervalSince1970 ?? 0].max()!
        clockDate = Date(timeIntervalSince1970: now); clockUptime = uptime
        let data = Data(String(now).utf8)
        if SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecItemNotFound {
            var add = query; add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        }
        return clockDate
    }

    @MainActor func snapshot() async -> JSObject {
        var legacy = false, appVerified = false, lifetime = false, uncertain = false
        var trialStart: Date?, signed: Date?
        do {
            let result = try await AppTransaction.shared
            if case .verified(let app) = result, app.bundleID == "jp.amimononote.ios" {
                appVerified = true
                legacy = PurchasePolicy.isLegacy(version: app.originalAppVersion, production: app.environment == .production)
            }
        } catch { /* Keep viewing/export available; never ask an unverified owner to pay again. */ }
        for await result in Transaction.currentEntitlements {
            switch result {
            case .verified(let transaction):
                guard [PurchasePolicy.trialID, PurchasePolicy.lifetimeID].contains(transaction.productID),
                      transaction.revocationDate == nil, !transaction.isUpgraded else { continue }
                signed = max(signed ?? transaction.signedDate, transaction.signedDate)
                if transaction.productID == PurchasePolicy.lifetimeID { lifetime = true }
                if transaction.productID == PurchasePolicy.trialID { trialStart = transaction.originalPurchaseDate }
            case .unverified: uncertain = true
            }
        }
        let now = effectiveNow(signed: signed)
        var state = PurchasePolicy.state(legacy: legacy, lifetime: lifetime, trialStart: trialStart, now: now)
        if !legacy && !lifetime && (!appVerified || uncertain) { state = "unavailable" }
        var result: JSObject = ["state": state, "now": now.timeIntervalSince1970 * 1000,
            "canPurchase": appVerified && !legacy && !lifetime && !uncertain]
        if let start = trialStart { result["expiresAt"] = start.addingTimeInterval(PurchasePolicy.trialSeconds).timeIntervalSince1970 * 1000 }
        result["products"] = products.map { ["id": $0.id, "price": $0.displayPrice, "isFree": $0.price == 0] }
        return result
    }
    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            if call.getBool("loadProducts") == true {
                do { products = try await Product.products(for: [PurchasePolicy.trialID, PurchasePolicy.lifetimeID]) }
                catch { products = [] }
            }
            call.resolve(await snapshot())
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !busy else { call.reject("購入処理中です。しばらくお待ちください。"); return }
            busy = true; defer { busy = false }
            let current = await snapshot()
            guard current["canPurchase"] as? Bool == true else { call.resolve(current); return }
            let id = call.getString("productId") ?? ""
            guard [PurchasePolicy.trialID, PurchasePolicy.lifetimeID].contains(id) else { call.reject("商品が見つかりません。"); return }
            if id == PurchasePolicy.trialID && current["state"] as? String != "notStarted" { call.resolve(current); return }
            do {
                guard let product = try await Product.products(for: [id]).first,
                      product.type == .nonConsumable,
                      (id != PurchasePolicy.trialID || product.price == 0) else { call.reject("商品を取得できません。通信状態を確認して再度お試しください。"); return }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else { call.reject("購入を確認できません。「購入を復元」をお試しください。"); return }
                    await transaction.finish()
                    call.resolve(await snapshot())
                case .userCancelled:
                    var result = await snapshot(); result["action"] = "cancelled"; call.resolve(result)
                case .pending:
                    var result = await snapshot(); result["action"] = "pending"; call.resolve(result)
                @unknown default: call.reject("購入状況を確認できません。「購入を復元」をお試しください。")
                }
            } catch { call.reject("購入を完了できませんでした。通信状態を確認して再度お試しください。") }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !busy else { call.reject("購入処理中です。"); return }
            busy = true; defer { busy = false }
            do {
                try await AppStore.sync()
                _ = try await AppTransaction.refresh()
                call.resolve(await snapshot())
            } catch { call.reject("購入を復元できませんでした。購入時と同じApple Accountで再度お試しください。") }
        }
    }
}

class PurchaseViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(PurchasesPlugin()) }
}
