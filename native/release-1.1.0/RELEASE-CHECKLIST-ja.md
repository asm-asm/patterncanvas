# 1.1.0 無料体験への移行

## 実装
- StoreKit 2の署名検証済み購入を使用。Firebase・外部決済・開発者サーバーは使用しない。
- `jp.amimononote.ios.trial7`: 非消耗型、0円、元の購入日時から604800秒。
- `jp.amimononote.ios.lifetime`: 非消耗型、3,000円、永久解除。
- 期限切れ後も現在保存している作品の閲覧・ズーム・書き出しを許可。編集・ファイル読み込み・段数変更は購入まで無効。
- 旧有料版の本番AppTransaction.originalAppVersion（iOSではビルド番号）が25以下なら全機能を維持。Sandboxの1.0を旧購入者と誤認しない。
- 購入情報が検証できない場合は追加購入ボタンも無効にし、復元を案内。データは削除しない。
- 復元は利用権限の復元。作品データ自体の機種間同期ではない。

## 検証
- 既存モデル・ストレージ55件。
- WebKit：開始前、体験開始、期間終了、永久解除、旧購入復元、取消、承認待ち、エラー、作品保持と書き出し、スマホ・iPad相当のレイアウト。
- Mac Swift：旧有料版判定、sandbox除外、永久解除、7日境界。
- iOS Simulator StoreKitTest：実商品の取得、無料体験購入、再購入／復元で開始日時を維持、永久解除、返金。結果はCI参照。
- 実機のApple Sandbox操作・Apple Account変更・オフライン再起動はTestFlightで最終確認する。

## 公開順序（まだ価格を無料にしない）
1. 2商品を初回アプリ内購入として1.1.0と同時審査する。購入画面の審査用画像を添付。
2. 1.1.0と商品が承認されるまで手動公開で保留する。
3. App Store Connectのアプリ価格を日本0円へ変更する。アプリ内永久解除は3,000円のまま。
4. 日本のストアで無料反映を確認してから1.1.0を手動公開する。無料反映前に1.1.0を公開すると、有料ダウンロードとアプリ内解除が重なるため不可。
5. 切替時に旧版を無料取得した方も旧版購入判定で解除される可能性がある。この短い切替期間は二重請求の防止を優先する。
6. LPの価格表示を「無料で7日間体験・3,000円で永久解除」に更新し、サポートページとプライバシーを新仕様へ合わせる。
7. 公開後に新規取得と既存購入者の更新を確認する。

## 公式根拠
- https://developer.apple.com/app-store/review/guidelines/#in-app-purchase （非サブスクの期間限定無料体験）
- https://developer.apple.com/documentation/storekit/apptransaction/originalappversion （旧有料版の判定。iOSはCFBundleVersion）
- https://developer.apple.com/documentation/storekit/supporting-business-model-changes-by-using-the-app-transaction
