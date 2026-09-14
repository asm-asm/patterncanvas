# App Store版：提出までの手順

これまでのWeb版の買い切り販売案から、**App Storeの有料ダウンロード**を前提とする構成へ切り替えています。ストア版の機能を使うためのアカウント・ライセンス入力・外部決済はありません。価格はApp Store Connectで設定します。無料ダウンロード＋アプリ内購入にする場合は、別途StoreKitの実装・復元・検証が必要です。

現状は提出準備です。審査通過はAppleが判断します。ネイティブ実機の確認、署名、App Store Connectの登録内容、プライバシーURLの公開、最終スクリーンショットが済むまでは提出しないでください。

## 今回追加したもの

- `ios/App/App.xcodeproj`：Capacitor 8によるiPhone用プロジェクト。iOS 16以降、縦・横向き。
- `scripts/build-native.mjs`：既存編集コードと端末用アダプターだけを同梱。リモートサイト表示、決済ゲート、ライセンス、Service Worker、開発中表示を含めない許可リスト。
- `native/src/platform.mjs`・`storage.mjs`：アプリ領域へのファイル保存、前回スナップショットからの復旧、iOS共有、段完了時の軽い振動。
- `docs/iphone/app/platform.mjs`：既存Web版用アダプター。作品の保存キーと機能を維持。
- `native/content/`：アプリ内でオフライン閲覧できる使い方とプライバシーポリシー。
- `PrivacyInfo.xcprivacy`：トラッキングなし、収集データなし、ファイル時刻APIの使用理由C617.1。XcodeのPrivacy Reportも確認すること。
- `Info.plist`：日本語表示、写真選択・撮影時の説明、暗号化申告用設定。
- AppIcon：1024×1024 RGB。制作記録は `ICON-PROVENANCE.md`。
- `.github/workflows/ios-build.yml`：macOS上の署名なしシミュレータービルドと起動画像の取得。App Storeへのアップロードはしません。

## Appleの審査上の対応

### 3.1：支払い

ストア購入で全機能を提供します。アプリに外部購入リンク・コード入力・会員登録を入れません。Web版の決済コードはストアの配信ファイルへコピーされません。Appleの決済方式が異なる場合に単に表示を隠すような審査専用動作はありません。

### 4.2：最低限の機能

URLを開くだけのアプリではありません。編み図編集、同一データの編み地プレビュー、画像の切り抜き・減色、増減目、段挿入・削除、メモ、進捗、ロック、Undo/Redoを端末内で実行します。ネイティブ保存・復旧・共有・触覚フィードバックを追加しています。ただし、この実装をもって4.2の通過を保証するものではありません。

### 2.1：完成度

審査用アカウントは不要です。起動するとサンプルから全機能を操作できます。アプリ内からTODO・販売準備中表示・空のボタンを除外します。写真・ファイル選択、共有キャンセル、保存失敗、バックグラウンド復帰を実機で確認してください。

### 5.1：プライバシー

端末内保存・ユーザーが選択した画像だけを処理します。解析・広告・独自サーバーへのデータ送信はありません。外部サポートページを開く場合は利用者の操作でSafariへ移ります。アプリ内プライバシーポリシーに加え、App Store Connectへ公開URLを登録します。

公開用ファイル：`docs/app-store/privacy/index.html`。
予定URL：`https://asm-asm.github.io/patterncanvas/app-store/privacy/`。
**mainへ公開して実際にURLが開けることを確認するまでは、提出用に使えません。**

## 所有者が準備するもの

1. Apple Developer Programの登録。
2. App Store Connectで必要な契約・税務・銀行口座の設定。
3. App IDの登録。現在の候補は `jp.amimononote.ios`。登録可能か確認し、必要なら初回提出前に変更。
4. 販売価格・販売地域・正式な権利者名・審査連絡先。
5. 実機iPhone。MacがあればXcodeから実行できます。Macがない場合は、Developer登録後にmacOS CIへ署名を設定し、TestFlightへ送る構成で進められます。

署名証明書、秘密鍵、App Store Connect API Keyはリポジトリへ入れません。必要なときにOSのキーチェーンまたはCIのSecretsへ設定してください。

## Macで開く

リポジトリをMacへ取得し、Node.js 24と対応するXcodeを用意します。Appleの2026年4月28日以降の提出要件はXcode 26以降・iOS 26 SDK以降です。提出時に最新の要件を再確認してください。

```bash
npm ci
npm run ios:sync
npm run ios:open
```

XcodeのAppターゲット → Signing & Capabilitiesで自分のTeamを選択します。Bundle Identifierを確定し、Automatically manage signingを設定します。初回のSwift Package取得には通信が必要です。アプリ実行時の通信とは別です。

コードを変更したときは毎回 `npm run ios:sync` を実行します。`native/www` と `ios/App/App/public` は生成物なので直接編集しません。CapacitorはSPMの `Package.swift` を生成します。

シミュレータービルド：

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/App/DerivedData CODE_SIGNING_ALLOWED=NO build
```

この出力はシミュレーター用であり、実機インストール用IPA・ストア提出用アーカイブではありません。

## 実機・TestFlightで確認する操作

- 初回起動を機内モードで行い、編み図が開く。
- 1マス変更で対応する1目だけが変化し、1段目が下にある。
- 画像を写真ライブラリ・ファイルから選択して切り抜き・減色。キャンセルも正常。
- カメラを選べる端末では撮影・キャンセル・許可拒否を確認。
- 増減目、段の挿入・削除、現在段とメモの移動、Undo/Redo。
- ロック中の誤描画防止、移動・ズーム、カウンターとメモ。
- 段完了の振動。振動非対応端末でも操作が成功する。
- 書き出しのネイティブ共有シートを開き「ファイルに保存」。再読み込みで復元。
- 保存、アプリ終了、再起動、バックグラウンド移行直後の終了でも作品を復元。
- 保存領域不足・壊れたJSONに対して、元の作品を勝手にサンプルで上書きしない。
- 375〜430px相当、横向き、ノッチ・ホームインジケーター・キーボード表示を確認。
- VoiceOver・文字サイズ変更で利用可能な範囲を確認し、未確認機能の対応をストアで宣言しない。
- サポートとプライバシーへのリンクが正常。不要な権限要求がない。

## App Store Connect入力

`STORE-LISTING.md`の案を使い、実在する販売者情報・連絡先を入力します。
`REVIEW-NOTES.md`の操作手順を審査メモへ記載できます。

- 有料ダウンロードの価格を設定。復元用コードやアプリ内課金の商品登録は不要。
- 年齢レーティングの質問票に実装どおり回答。
- App PrivacyはSDKとPrivacy Reportを確認してから確定。
- 暗号化の質問も実際の配信内容に基づき回答。本実装に独自暗号化はなく、OS提供機能を利用。
- 日本語の説明文、キーワード、サポートURL、公開済みプライバシーURL。
- 実際のiPhone／シミュレーターで取得したスクリーンショット。WebKitテスト画像を実機画像として提出しない。
- iPad・Mac・Vision Pro向けの対応範囲は、検証できた端末に合わせて配信設定を確認。

## 提出

Xcodeで実機向けの実行先を選び、Product → Archive。
OrganizerでValidate App → Distribute App → App Store Connect。
処理後、まずTestFlightで動作確認します。確認済みビルドを選び、必要項目を埋めて審査へ提出します。

**審査への送信、価格の確定、有料公開は所有者が内容を確認した後の最終操作です。今回まだ行っていません。**

## 検証の種類

- `npm test`：モデルと形状編集の18件。
- `npm run test:native`：保存順序、スナップショット復旧、失敗・破損時の保全。
- `npm run test:native-ui`：WebKitでネイティブAPI境界を模擬したUI確認。実機の共有・触覚・権限確認の代わりではありません。先に `python -m http.server 4175 --bind 127.0.0.1 --directory native/www`。
- `npm run ios:sync`：配信用ファイル生成・禁止内容の検査・ネイティブ依存の同期。
- GitHub Actions：実際のXcodeシミュレータービルドと起動。結果を確認してください。
- 実機・署名・TestFlight：上のチェックリスト。未実施の項目を完了扱いにしません。

## 公式資料

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [提出SDK要件](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)
- [Privacy manifest](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Capacitor iOS](https://capacitorjs.com/docs/ios)
- [FilesystemのPrivacy要件](https://capacitorjs.com/docs/apis/filesystem)
