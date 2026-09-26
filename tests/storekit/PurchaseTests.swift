import XCTest
import StoreKit
import StoreKitTest
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
        try session.buyProduct(identifier: PurchasePolicy.trialID)
        let plugin = PurchasesPlugin()
        let trial = await plugin.snapshot()
        XCTAssertEqual(trial["state"] as? String, "trial")
        let expiry = try XCTUnwrap(trial["expiresAt"] as? Double)
        try session.buyProduct(identifier: PurchasePolicy.trialID)
        let restored = await plugin.snapshot()
        XCTAssertEqual(restored["expiresAt"] as? Double, expiry, "Restoring must not restart the trial")
        try session.buyProduct(identifier: PurchasePolicy.lifetimeID)
        let full = await plugin.snapshot()
        XCTAssertEqual(full["state"] as? String, "purchased")
        let transaction = try XCTUnwrap(session.allTransactions().first { $0.productIdentifier == PurchasePolicy.lifetimeID })
        try session.refundTransaction(identifier: transaction.identifier)
        let refunded = await plugin.snapshot()
        XCTAssertNotEqual(refunded["state"] as? String, "purchased")
    }
}
