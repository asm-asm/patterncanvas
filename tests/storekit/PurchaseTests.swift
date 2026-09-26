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
        _ = try await webView.callAsyncJavaScript("""
          for(let i=0;i<100&&!document.getElementById('purchase-open');i++)await new Promise(r=>setTimeout(r,100));
          document.getElementById('purchase-open').click();
          for(let i=0;i<100&&document.getElementById('purchase-trial').disabled;i++)await new Promise(r=>setTimeout(r,100));
          if(document.getElementById('purchase-trial').disabled)throw Error('Trial product not available in native screen');
          return true;
          """, arguments: [:], in: nil, contentWorld: .page)
        let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
        let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("iap-review.png")
        try XCTUnwrap(image.pngData()).write(to: output)
        try await session.buyProduct(identifier: PurchasePolicy.trialID)
        let plugin = PurchasesPlugin()
        let trial = await plugin.snapshot()
        XCTAssertEqual(trial["state"] as? String, "trial")
        let expiry = try XCTUnwrap(trial["expiresAt"] as? Double)
        try await session.buyProduct(identifier: PurchasePolicy.trialID)
        let restored = await plugin.snapshot()
        XCTAssertEqual(restored["expiresAt"] as? Double, expiry, "Restoring must not restart the trial")
        try await session.buyProduct(identifier: PurchasePolicy.lifetimeID)
        let full = await plugin.snapshot()
        XCTAssertEqual(full["state"] as? String, "purchased")
        let transaction = try XCTUnwrap(session.allTransactions().first { $0.productIdentifier == PurchasePolicy.lifetimeID })
        try session.refundTransaction(identifier: transaction.identifier)
        let refunded = await plugin.snapshot()
        XCTAssertNotEqual(refunded["state"] as? String, "purchased")
    }
}
