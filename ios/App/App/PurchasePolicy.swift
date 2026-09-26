import Foundation

enum PurchasePolicy {
    static let trialID = "jp.amimononote.ios.trial7"
    static let lifetimeID = "jp.amimononote.ios.lifetime"
    static let trialSeconds: TimeInterval = 7 * 24 * 60 * 60
    // iOS AppTransaction.originalAppVersion is CFBundleVersion, NOT 1.0.1.
    // 25.1 is the last paid-download build. Sandbox always reports 1.0.
    static func isLegacy(version: String, production: Bool) -> Bool {
        guard production, let first = Int(version.split(separator: ".").first ?? ""), first > 0 else { return false }
        return first <= 25
    }
    static func state(legacy: Bool, lifetime: Bool, trialStart: Date?, now: Date) -> String {
        if legacy { return "legacy" }
        if lifetime { return "purchased" }
        guard let start = trialStart else { return "notStarted" }
        return now < start.addingTimeInterval(trialSeconds) ? "trial" : "expired"
    }
}
