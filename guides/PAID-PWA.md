# 編みものノート iPhone版：買い切りPWAのセットアップ

## 現在の状態

実装ブランチは `feature/iphone-paid-pwa`。公開中のmainは変更していません。購入ゲートの設定は無効です。外部設定が済むまでは現在の無料版の動作を保ちます。Firebaseは依存関係・実行コードから除外しました。

**未完了：Cloudflareアカウント連携、リモートD1作成、Stripeテスト用Price・Secrets・Webhook登録、実サービス間の決済テスト、iPhone実機確認、販売者情報入力、本番販売開始。** 自動テストはこれらの代替ではありません。

> 以下のPhase記録は購入ゲート実装時点のものです。その後の依頼で、有料版の編集機能へ増減目・段編集・下端番号・ロックを追加しました。現在の変更点・保存形式はREADMEの「有料版の操作改善」を参照してください。

## Phase 1：既存構成の確認

| 調査項目 | 結果 |
|---|---|
| 使用技術 | HTML/CSS/ES Modules、Canvas。ビルドフレームワークなし |
| 構成 | `docs/`公開サイト、`docs/iphone/`iPhone、`tests/`検証 |
| iPhone入口 | `docs/iphone/index.html`、本体`docs/iphone/app/index.html` |
| PWA | 既存対応済み。standalone、アイコン、Safari追加案内あり |
| Service Worker | `docs/iphone/app/sw.js`。静的アプリをキャッシュ |
| manifest | `docs/iphone/app/manifest.webmanifest`。ID・scope・start_urlは維持 |
| 作品保存 | localStorage `patterncanvas-iphone-v1`、JSON `patterncanvas-web-1` |
| デプロイ | GitHub Pages：mainブランチの `/docs` |
| Androidとの分離 | Android本体は隣の`PatternCanvas/`。サイトではAPKリンクのみ |

選択した方法：アプリを外側から起動する `bootstrap.mjs` を追加。`app.mjs`、`draw.mjs`、`model.mjs`、`app.css` は変更しません。既存のスクロール修正・編集・保存をそのまま使います。ユーザー操作は不要です。

## Phase 2～7：Worker・D1・決済API

| Phase | ファイル・理由 | 影響／次の操作 |
|---|---|---|
| 2 Worker | `worker/wrangler.jsonc`、`worker/src/index.mjs`：Pagesと分離したAPI | 既存サイトへの影響なし。下記Cloudflareログイン |
| 3 D1 | `worker/migrations/`：購入・ライセンス・イベント・短期制限用テーブル | 作品DBとは別。下記D1作成・migration |
| 4 Checkout | `index.mjs`の`/create-checkout`：Price ID、payment、カード、メール取得 | テスト商品・Price IDを設定 |
| 5 Webhook | `/stripe/webhook`：Stripe SDKで生bodyの署名・時刻・test/liveを検証 | Webhookの登録とSecret設定 |
| 6 発行 | `crypto.mjs`：160bit乱数、HMAC、AES-GCM。session UNIQUEで重複防止 | HASH/ENCRYPTION Secrets設定・安全に保管 |
| 7 確認 | `/verify-license`：prepared SQLでactive確認 | Workerデプロイ後にテスト |

### 1. PCの準備

CloudflareとStripeでアカウントを作成します。Node.js 24とnpmが使えるPCで、このリポジトリのフォルダーを開きます。以下はすべてリポジトリのルートで実行します。

```powershell
npm ci
npm run build:commerce
npx wrangler login
npx wrangler whoami
```

`npm ci`でWranglerも入るので、グローバルインストールは不要です。ブラウザで自分のCloudflareアカウントへのアクセスを許可します。複数アカウントがある場合は `worker/wrangler.jsonc` に使う `account_id` を指定してください。

Workerプロジェクトはこのリポジトリに作成済みです。`wrangler init`で別アプリを作り直す必要はありません。初回deployでCloudflare上にWorkerが作成されます。

### 2. D1を作成

```powershell
npx wrangler d1 create amimono-note-license-test
```

表示された `database_id` を `worker/wrangler.jsonc` のゼロのUUIDと置き換えます。binding名は `DB`、database_nameは `amimono-note-license-test` のままにします。

```powershell
npx wrangler d1 migrations apply amimono-note-license-test --local --config worker/wrangler.jsonc
npx wrangler d1 migrations apply amimono-note-license-test --remote --config worker/wrangler.jsonc
```

`--local` はPC内、`--remote` はCloudflare上です。初期migrationには既存テーブルを消す処理はありません。実行後の確認：

```powershell
npx wrangler d1 migrations list amimono-note-license-test --remote --config worker/wrangler.jsonc
```

### 3. Stripeをテストモードに設定

1. Stripe Dashboardでテストモード／テスト用サンドボックスを選びます。
2. 商品「編みものノート iPhone版」を作ります。
3. JPY、買い切り（定期請求ではない）、980円のPriceを作ります。
4. `price_...`をコピーし、`worker/wrangler.jsonc` の `STRIPE_PRICE_ID_TEST` に設定します。
5. テスト用Secret Key `sk_test_...`を取得します。公開キー `pk_test_...` は今回不要です。
6. Secretを登録します。値はコマンドの後の入力欄へ貼り付けます。

```powershell
npx wrangler secret put STRIPE_SECRET_KEY --config worker/wrangler.jsonc
```

価格の設定元は `commerce/product.json` の `amount`、`currency` です。金額変更時はStripeに新しい買い切りPriceを作成し、WorkerのPrice IDを更新します。表示も再生成します。Checkout開始時の金額・通貨はD1へ記録するため、変更前の決済通知が遅れて届いても開始時の価格で照合します。

```powershell
npm run build:commerce
```

金額・通貨・一回払い・test/liveの不一致は決済を開始せずエラーにします。値引き、数量変更、自動税計算は今回追加していません。

### 4. ライセンス用Secretを作る

次のコマンドを2回実行して**異なる値**を作ります。最初の値をHASH、次をENCRYPTION用に、安全なパスワード管理ソフト等で保存してください。

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put LICENSE_HASH_SECRET --config worker/wrangler.jsonc
npx wrangler secret put LICENSE_ENCRYPTION_SECRET --config worker/wrangler.jsonc
```

これらをGitHubやチャットへ貼らないでください。HASHを失うと既存コードの照合ができず、ENCRYPTIONを失うと決済から同じコードを取り出せません。既存レコードの移行なしに変更しないでください。

### 5. デプロイとWebhook登録

```powershell
npm run worker:check
npx wrangler deploy --config worker/wrangler.jsonc
```

表示されたURL（例 `https://amimono-note-license-test.YOUR-SUBDOMAIN.workers.dev`）を控えます。Secret未設定の間、APIはエラーを返します。

Stripe DashboardのWebhook／イベント送信先で次を登録します。

- URL：`https://実際のWorkerホスト/stripe/webhook`
- イベント：`checkout.session.completed`、`charge.refunded`、`payment_intent.payment_failed`
- 対象：このStripeアカウントのテストモード

署名Secret `whsec_...` を取得して登録します。

```powershell
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

成功ページへの移動だけでは利用権は付与されません。Webhookを受け、Stripe APIからセッションを取得してpaid・商品・Price・金額を確認した後にD1へ記録します。

`charge.refunded`は**部分返金を含む返金**でrefundedにします。返金が先に届いても、後の完了通知でactiveに戻しません。失敗イベントは記録のみで発行しません。返金後の再購入は別セッション・別コードになります。

## Phase 8～11：画面・保存・PWA

| Phase | ファイル・理由 | 影響／次の操作 |
|---|---|---|
| 8 ゲート | `access/gate.mjs`・CSS、`entry.mjs`、`app/bootstrap.mjs`：購入とコード入力を外側に追加 | 本体コードは維持。API URLを設定 |
| 9 完了 | `payment-success/`：Webhook反映を待って同じコードを取得 | Stripeのテスト決済で動作確認 |
| 10 保存 | `access/storage.mjs`：専用IndexedDB、再確認、コード表示 | 作品localStorageを触らない。再起動確認 |
| 11 PWA | `app/sw.js`：追加静的ファイルをキャッシュ。APIは対象外 | ホーム画面・オフラインを実機確認 |

### GitHub Pages側の設定

`docs/iphone/access/config.mjs` を編集します。秘密鍵は一切入れません。

```javascript
export default Object.freeze({
  enabled: true,
  mode: 'test',
  apiBase: 'https://実際のWorkerホスト',
  legalReady: false
});
```

`enabled:false` は有料化開始前の切り替え設定です。公開ソースのためDRMではありません。testでは画面にも「テスト決済」と表示します。本番公開前に `docs/iphone/legal/` のTODOを埋めてください。

変更を確認し、テスト用設定でPagesへ配信すると、既存利用者にもテスト用ゲートが表示されます。営業公開前のテストであることを案内してください。未設定のままmainへ反映しないでください。

```powershell
git diff
git add docs/iphone commerce worker scripts tests guides README.md package.json package-lock.json .gitignore .env.example
git commit -m "Add iPhone license checkout with Cloudflare and Stripe"
git push -u origin feature/iphone-paid-pwa
gh pr create --base main --head feature/iphone-paid-pwa --title "iPhone版の買い切りライセンス対応" --body "CloudflareとStripeテスト決済を設定したうえで確認します。"
```

GitHubでPRの差分とテスト結果を確認してmainへマージします。Settings → Pages → Deploy from a branch → main /docs が現在の設定です。Pagesのデプロイ完了後、Safariで `https://asm-asm.github.io/patterncanvas/iphone/` を開きます。これらのpush・マージは今回自動実行していません。

### 初購入・他端末

購入時に利用したSafariで成功ページへ戻ってください。購入開始前に保存するランダムなclaim tokenとSession IDの両方が必要です。URLを知っただけの第三者にはコードを渡しません。ページの再読み込みでも同じコードです。Webhookが遅い場合は待機後「もう一度確認」を押せます。

取得したライセンスをコピーして保管し、「編みものノートを開く」を押します。上部「ライセンス情報」から後でコード・マスク済みメール・最終確認日時を見られます。別端末やSafariデータ削除後はコードを入力してください。台数制限・パスワード・会員登録はありません。

Safariとホーム画面PWAで保存領域が分かれる場合は、PWAで同じライセンスを再入力します。作品はSafari側でJSONを書き出し、PWA側で読み込みます。自動移行を保証しません。

### ホーム画面とオフライン

アプリ本体をSafariで開き、共有 → ホーム画面に追加を選びます。追加したアイコンから起動してください。最初の静的ファイル取得にはオンライン接続が必要です。

`commerce/product.json` の `offlineGraceDays` が期間（初期値7日）です。起動・オンライン復帰・画面復帰・15分ごとに確認します。通信障害時は最後の成功から期限内なら使えます。期限切れなら接続を促し、作品は残します。認証画面から作品バックアップもできます。明確な無効応答は期限内でもロックします。完全オフライン中は返金を即座に反映できません。

Service Workerは静的ファイルの許可リストだけをキャッシュします。APIのPOST・他Origin・決済レスポンスは対象外、APIも `Cache-Control:no-store` です。新しいSWは開いている旧アプリを閉じた後で有効になります。更新時は `sw.js` のCACHE名を変えてください。旧無料版のオフラインコピーを強制的に消す設計ではありません。

## ローカル開発用コード（Stripe決済不要）

```powershell
Copy-Item worker/.dev.vars.example worker/.dev.vars
```

`.dev.vars`のHASH/ENCRYPTIONを上記と同じ方法で作った開発用の値に置き換えます。`LOCAL_DEVELOPMENT=true`を維持します。StripeキーはAPI起動用に `sk_test_REPLACE` のままでもライセンス確認のみの開発ができます。決済を試す場合は本物のテストキーが必要です。

```powershell
npx wrangler d1 migrations apply amimono-note-license-test --local --config worker/wrangler.jsonc
node scripts/seed-local-license.mjs
npm run worker:dev
```

seedはlocalのD1へだけ書き込みます。remoteオプションや任意引数は受け付けません。出力された開発用コードはこのPCのDBのみで使えます。万能コードはありません。

別のターミナルでフロントを配信します。

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory docs
```

ローカルテスト中だけconfigの `enabled:true`、`apiBase:'http://127.0.0.1:8787'` にします。公開前に正しいWorker URLへ戻してください。ローカルoriginはtestかつ `LOCAL_DEVELOPMENT=true` のときだけ許可されます。公開Workerにはこのフラグを有効にしないでください。

ローカルで実Stripeテストイベントを受ける場合、Stripe CLIを用意して：

```powershell
stripe login
stripe listen --events checkout.session.completed,charge.refunded,payment_intent.payment_failed --forward-to http://127.0.0.1:8787/stripe/webhook
```

表示されたCLI専用 `whsec_...`を `.dev.vars` に設定してWorkerを再起動します。単なる `stripe trigger` の架空注文はこのアプリのCheckoutと紐づかないため発行されません。購入画面から実際にテストCheckoutを作ってください。

## Phase 12：セキュリティと検証

変更：`tests/commerce.test.mjs`、`tests/iphone-gate.mjs`。既存テストは維持しました。

```powershell
npm test
npm run test:commerce
npm run worker:check
npx playwright install webkit
npm run test:gate
npm run test:ui
npm run test:scroll
npm run test:pwa-license
npm audit
```

UI系は上記4173のサーバーを先に起動してください。`test:pwa-license` はインストール済みGoogle Chromeを使い、4174で専用サーバーを自動起動します。実際のService Worker経由のオフライン再読み込み・期限切れ・進捗保持・API非キャッシュを確認します。

- APIテスト：ローカルD1の実SQL、Stripe署名、不正Origin、未払い、誤コード、重複通知、同一コード取得、返金前後の順序逆転、revoked維持、rate limit、test/live不一致。
- ゲートテスト：WebKit、未購入で本体未ロード、コード認証、再読み込み、コード表示、オフライン通信エラー時の猶予と期限、無効化、作品保持、成功画面、375/390/430px。
- 既存テスト：1マスと1目、上下方向、反転、3×2リピート、保存、段数、画像変換、拡縮、スクロール時の伸縮なし。
- **Stripe APIはテストダブル**です。自動テスト成功だけで実際のStripe CheckoutやWebhook配信が成功したとはみなしません。

制限：これは軽量ゲートです。フロントのコード・確認日時は利用者が変更でき、完全DRMではありません。コード共有も厳格には防ぎません。正規利用者の移行を優先します。CORSはブラウザ境界で、APIの認証そのものではありません。verifyはランダムコード、claimは購入時のランダムtoken、WebhookはStripe署名で保護します。DBはブラウザから直接アクセスできません。

APIは毎分/IP/経路でCheckout10回・他60回に制限し、IPはHMACにして数分後の次リクエストで削除します。将来はCloudflareのRate Limiting binding/WAFに置き換え可能です。D1クエリはprepared statements、SecretsはWrangler、エラーは汎用文言です。コードはD1で平文保持しませんが、Secretへアクセスできる運営者は復号可能です。

手動無効化は対象sessionを十分確認してD1のstatusをrevokedに更新します。フロントに管理APIはありません。

```powershell
npx wrangler d1 execute amimono-note-license-test --remote --config worker/wrangler.jsonc --command "UPDATE licenses SET status='revoked' WHERE stripe_session_id='cs_REPLACE_WITH_CONFIRMED_SESSION';"
```

将来のメール復旧はResend、Cloudflare Email Workers等を利用し、メールの所持確認と回数制限を入れてから暗号文を復号して届ける構造です。メールアドレスだけでコードを返すAPIは作らないでください。デバイス管理は将来 `licenses.id` を参照する別テーブルを追加できます。現時点では追跡せず制限OFFです。

## Phase 13：実サービス・iPhone実機チェック

変更：この手順書と法的ページ。次の操作はCloudflare/Stripe設定後、所有者のiPhoneで行います。まだ実施していません。

1. 未購入状態で `/iphone/` と `/iphone/app/` を開き、購入画面を確認。
2. 同意して購入。Stripeテスト画面で `4242 4242 4242 4242`、将来の期限、任意の3桁CVCを入力。実カードは使わない。
3. 成功ページで待機→コード表示。Stripe DashboardのWebhook配信が200になり、D1のactiveレコードが1件であることを確認。
4. 再読み込み・同じ通知の再送でレコードとコードが増えないことを確認。
5. アプリを開き、編み図を塗り、現在段・メモを保存。Safari終了後に同じデータと利用権が残ることを確認。
6. ホーム画面に追加して起動。必要なら同じコード入力と作品JSONの移行を行う。
7. 一度オンラインで起動後、機内モードでPWAを再起動し、作品が編集できることを確認。
8. 別のiPhoneで同じコードを入力。購入を要求せず開けることを確認。
9. Stripeテスト決済を返金。次のオンライン確認でロックされ、作品バックアップは可能であることを確認。
10. コードを登録解除しても作品が残ることを確認。データ削除テスト前には必ず作品とコードを保管。
11. 販売者情報・返金条件・問い合わせ先を法的ページへ記入。法的表示の確認参考：[消費者庁の通信販売広告案内](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php)。

## 本番販売への切り替え（今回未実施）

テスト用と本番用のD1・Worker・Secretsは分離します。testのDBをliveで使わないでください。`worker/wrangler.jsonc`を別ファイル `worker/wrangler.live.jsonc`へコピーし、name・database_name/id・ENVIRONMENT=live・STRIPE_PRICE_ID_LIVEを本番用に変更します。main/migrations_dirの相対位置を維持するため同じworkerフォルダーに置きます。本番商品・Price・sk_live・本番WebhookをStripeで用意し、同じ手順の `--config` をlive用に置き換えて実行します。HASH/ENCRYPTIONも本番専用にします。

フロントのmodeをlive、apiBaseを本番Workerへ、法的ページを確定後legalReadyをtrueにします。コード・テスト結果・画面を確認してから公開します。testキーとlive設定の混在はエラーとなります。testライセンスは本番で使えません。

## 参考（公式）

- [Cloudflare D1のmigration](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 prepared statements・batch](https://developers.cloudflare.com/d1/worker-api/)
- [Wrangler Secrets](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Stripe Webhook署名検証](https://docs.stripe.com/webhooks?lang=node)
- [Stripe Checkoutの購入確定処理](https://docs.stripe.com/checkout/fulfillment)


## 今回の実行結果（2026-09-14）

- モデル単体テスト9件、購入APIテスト7件：成功。
- WebKit：既存UI、スクロール、購入ゲートの各テスト成功。
- Google Chrome：実際のSWキャッシュからのオフライン再起動、猶予期限切れ、進捗保持を確認。
- ローカルD1：migration 2本、開発用seed、Wrangler dev上の `/verify-license` が成功。
- Worker deployのdry-run：成功。外部へのdeployは未実施。
- npm audit：検出された脆弱性0件。
- app.mjs / draw.mjs / model.mjs / app.css：変更前後のSHA-256が一致。
- Androidソース・APK・トップ配布サイトは変更なし。
- 公開サイト・実Stripeテスト決済・iPhone実機の有料版フローは未検証。

途中のFirebase作業ファイルは `.obsolete-firebase/` にローカル退避し、Git対象外にしています。配信ファイル・npm依存関係・WorkerにFirebaseは含まれません。開発用SecretsとローカルD1もGit対象外です。
