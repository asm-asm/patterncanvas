import XCTest
import StoreKit
import StoreKitTest
import UIKit
import WebKit
@testable import App

@MainActor final class PurchaseTests: XCTestCase {
    func testStoreKitPurchasesAndRefund() async throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "Purchases", withExtension: "storekit"))
        let session = try SKTestSession(contentsOf: url)
        session.disableDialogs = true
        session.clearTransactions()
        defer { session.clearTransactions() }
        let products = try await Product.products(for: [PurchasePolicy.trialID, PurchasePolicy.lifetimeID])
        XCTAssertEqual(products.count, 2)
        XCTAssertEqual(products.first { $0.id == PurchasePolicy.trialID }?.price, 0)
        XCTAssertEqual(products.first { $0.id == PurchasePolicy.lifetimeID }?.price, 3000)
        // Capture the actual native purchase screen for the IAP review attachment.
        let window = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }.first { $0.isKeyWindow })
        let controller = try XCTUnwrap(window.rootViewController as? PurchaseViewController)
        let webView = try XCTUnwrap(controller.webView)
        // Wait outside the JS context: initial navigation can replace that context.
        var ready = false
        for _ in 0..<120 {
            if (try? await webView.evaluateJavaScript("document.readyState === 'complete' && typeof window.Capacitor !== 'undefined' && typeof document.getElementById('purchase-open')?.onclick === 'function'")) as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        XCTAssertTrue(ready, "Native page must finish loading")
        // 1.2.1 states on the real native page: new install (trial sheet), trial (days-left pill), purchased (no pill).
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        func capture(_ name: String) throws {
            let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
            try XCTUnwrap(image.pngData()).write(to: docs.appendingPathComponent(name))
        }
        func waitJS(_ script: String) async -> Bool {
            for _ in 0..<60 { if (try? await webView.evaluateJavaScript(script)) as? Bool == true { return true }; try? await Task.sleep(nanoseconds: 250_000_000) }
            return false
        }
        let welcome = await waitJS("document.getElementById('access-dialog').open && document.getElementById('access-title').textContent === '7日間、すべての機能を無料で試せます'")
        XCTAssertTrue(welcome, "New install shows the trial sheet first")
        try capture("state-new-install.png")
        _ = try await webView.evaluateJavaScript("document.getElementById('access-later').click()")
        let guide = await waitJS("!document.getElementById('guide').hidden")
        XCTAssertTrue(guide, "Guide follows the trial sheet on a new install")
        try capture("state-guide.png")
        _ = try await webView.evaluateJavaScript("document.getElementById('guide-skip').click()")
        _ = try await webView.evaluateJavaScript("document.getElementById('purchase-open').click()")
        var purchasable = false
        for _ in 0..<120 {
            if (try? await webView.evaluateJavaScript("!document.getElementById('purchase-trial').disabled")) as? Bool == true { purchasable = true; break }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        if !purchasable { print("PURCHASE SCREEN:", try await webView.evaluateJavaScript("document.body.innerText")) }
        XCTAssertTrue(purchasable, "Trial product must be available in the native screen")
        let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
        let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("iap-review.png")
        try XCTUnwrap(image.pngData()).write(to: output)
        try await session.buyProduct(identifier: PurchasePolicy.trialID)
        let plugin = PurchasesPlugin()
        func waitForState(_ expected: String) async throws -> [String: Any] {
            for _ in 0..<60 {
                let value = await plugin.snapshot()
                if value["state"] as? String == expected { return value }
                try await Task.sleep(nanoseconds: 250_000_000)
            }
            return await plugin.snapshot()
        }
        let trial = try await waitForState("trial")
        XCTAssertEqual(trial["state"] as? String, "trial")
        let expiry = try XCTUnwrap(trial["expiresAt"] as? Double)
        _ = try await webView.evaluateJavaScript("document.getElementById('purchase-close').click(); window.dispatchEvent(new Event('patterncanvas-resume'))")
        let pill = await waitJS("document.getElementById('purchase-banner').classList.contains('trial-pill') && /無料体験 残り7日/.test(document.getElementById('purchase-banner').innerText)")
        XCTAssertTrue(pill, "Trial shows the days-left pill")
        try capture("state-trial.png")
        try await AppStore.sync()
        _ = try await AppTransaction.refresh()
        let restored = await plugin.snapshot()
        XCTAssertEqual(restored["expiresAt"] as? Double, expiry, "Restoring must not restart the trial")
        try await session.buyProduct(identifier: PurchasePolicy.lifetimeID)
        let full = try await waitForState("purchased")
        XCTAssertEqual(full["state"] as? String, "purchased")
        _ = try await webView.evaluateJavaScript("window.dispatchEvent(new Event('patterncanvas-resume'))")
        let unlocked = await waitJS("document.getElementById('purchase-banner').hidden")
        XCTAssertTrue(unlocked, "Purchased hides the trial pill")
        try capture("state-purchased.png")
        let transaction = try XCTUnwrap(session.allTransactions().first { $0.productIdentifier == PurchasePolicy.lifetimeID })
        try session.refundTransaction(identifier: transaction.identifier)
        let refunded = try await waitForState("trial")
        XCTAssertNotEqual(refunded["state"] as? String, "purchased")
    }
}
