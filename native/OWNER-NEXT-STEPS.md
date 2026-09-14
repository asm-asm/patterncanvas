# 所有者にお願いする準備

こちらで用意済み：iOSプロジェクト、署名なしビルドの検証、紹介・サポート・プライバシーの公開、ストア説明文、審査メモ、実際のシミュレーター画像1枚。

## 1. Appleへの登録と契約

- Apple Developer Programに登録（本人・組織確認と支払いは所有者が行う）。
- App Store Connectの有料アプリ契約、銀行口座、税務情報を設定。
- 正式な販売者・権利者名、審査連絡先をAppleに入力。
- 買い切りの価格と販売地域を決定。980円は候補で、まだ設定していません。

Appleのパスワード、認証コード、銀行情報、秘密鍵はチャットや公開リポジトリへ貼らないでください。

## 2. 署名とTestFlight

- 登録後、App ID（候補 jp.amimononote.ios）とApp Store Connectのアプリを作成。
- Macがある場合はAPP-STORE.mdの手順でXcodeのTeamを選択。
- Macがない場合もmacOS CIでビルドできます。Developer登録後、署名とアップロード用の秘密情報をGitHub Secretsなどへ設定してTestFlightを準備します。現時点では署名・アップロードを設定していません。
- 実機iPhoneで写真選択、共有、保存・再起動、ロック、段数、増減目を確認。

## 3. ストア入力と公開

- STORE-LISTING.mdの説明文、REVIEW-NOTES.mdの審査メモを使用。
- store-assets/の画像は実際のシミュレーター画面。最終ビルドと一致するか確認。
- App Privacy、年齢レーティング、暗号化、配信地域に応じた質問へ回答。
- 審査提出後の公開方法を決定。まだ審査提出・予約注文・販売開始はしていません。

## 公開URL

- 紹介：https://asm-asm.github.io/patterncanvas/app-store/
- サポート：https://asm-asm.github.io/patterncanvas/app-store/support/
- プライバシー：https://asm-asm.github.io/patterncanvas/app-store/privacy/

サポートは現時点では公開GitHub Issuesです。GitHubアカウントなしで問い合わせられるようにする場合は、公開可能なサポート用メールアドレスを用意してください。

公式手続き：
- https://developer.apple.com/programs/enroll/
- https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/
- https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/
