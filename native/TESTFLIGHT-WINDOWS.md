# WindowsからTestFlightへ送る

署名とアップロードはGitHub ActionsのmacOS環境で行います。Macの購入、Apple Accountのパスワード共有は不要です。

## 構成

- ワークフロー：`.github/workflows/ios-testflight.yml`（手動実行のみ）
- ビルド対象：`feature/iphone-paid-pwa` のコミット。実行時のcheckoutログで対象SHAを確認。
- 処理：単体テスト → ネイティブ同梱 → 証明書・プロファイル確認 → 実機向けArchive → IPA署名 → Apple検証 → 任意アップロード。
- `upload` を有効にするとApp Store Connectへ送信。アプリ審査への提出、販売開始、テスターへの招待は行いません。
- ビルド番号は実行番号と再実行回数から生成します。既に存在する番号より小さくなった場合は設定を見直してください。
- 公開サイトやAndroid APKはこのワークフローでは変更しません。

## GitHub Secrets

登録済みの項目名（値は記載しない）：

- ASC_PRIVATE_KEY / ASC_KEY_ID / ASC_ISSUER_ID
- APPLE_TEAM_ID
- IOS_CERTIFICATE_BASE64 / IOS_CERTIFICATE_PASSWORD / IOS_PROFILE_BASE64

署名用秘密鍵、証明書のローカルバックアップ、API操作の作業ファイルは `.secrets/` に保存し、Git追跡から除外しています。秘密情報はログや配信アーティファクトへ含めません。配布証明書・プロファイルが失効または期限切れになったら更新が必要です。

## 起動

GitHubのActions → iPhone TestFlight → Run workflow。
初回はこの作業環境から実行済みです。進行中の実行がある場合は重複実行しないでください。

## アップロード後

Appleの処理が完了すると、App Store Connectの対象アプリ → TestFlightにビルドが表示されます。
自分を内部テスターのグループへ追加し、iPhoneのTestFlightアプリで確認します。外部テスターへの配信は別途準備が必要です。

写真選択・共有、作品の保存と再起動、段数・ロック・増減目は実機で確認してください。自動ビルドが成功しても物理端末での操作確認が完了した意味ではありません。

公式資料：
- https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/

## 初回の実行結果（2026年9月15日）

- バージョン1.0.0、ビルド11.1。
- Xcode 26.3で実機向けArchive・署名・IPA書き出し成功。
- Appleの検証とアップロード成功。アップロード後のApple処理は別工程です。
- 実行記録：https://github.com/asm-asm/patterncanvas/actions/runs/34894830597
- 署名付きIPA：ローカル `test-results/testflight-11/App.ipa`（Gitには含めない）。
- 実機での操作確認・テスター招待・App Review提出は未実施。
