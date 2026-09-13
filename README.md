# Pattern Canvas 配布サイト

棒針編み込みの編み図制作・編み地プレビュー・段数カウンターを備えたAndroidアプリの無料試用版です。

**[ダウンロードと初心者向けガイド](https://asm-asm.github.io/patterncanvas/)**

**[iPhone版の配布ページ](https://asm-asm.github.io/patterncanvas/iphone/)** · **[iPhone Webアプリを開く](https://asm-asm.github.io/patterncanvas/iphone/app/)**

- [v0.2.0 APKをダウンロード](https://github.com/asm-asm/patterncanvas/releases/download/v0.2.0/PatternCanvas-0.2.0-debug.apk)
- [更新情報](https://github.com/asm-asm/patterncanvas/releases)
- [不具合・要望を送る](https://github.com/asm-asm/patterncanvas/issues/new?template=feedback.yml)

Android APKはAndroid 8.0以上向けで、iPhone/iPadにはインストールできません。iPhoneでは上のWeb版をご利用ください。Google Playで配信する製品版ではなく、デバッグ署名の試用版です。端末の保護設定によりインストールできない場合があります。全機種での動作を保証するものではありません。

編み図・進捗・毛糸・メモは端末内に保存します。大切な作品はアプリの「作品を書き出す」でバックアップしてください。Androidのバックアップ設定によりOSのバックアップ対象になる場合があります。

## このリポジトリについて

### ダウンロード数

配布ページのダウンロード欄に、v0.2.0 APKの累計取得回数を表示します。ページ表示時にGitHub公開APIの `download_count` を取得するため、導入前の取得や直接リンク経由の取得も含みます。再取得・動作確認・自動取得を区別せず、人数やインストール完了数を意味しません。ファイルの削除・再アップロードでカウントが失われる可能性があります。

APIの制限・通信エラー時は取得不能を表示し、ダウンロード自体は妨げません。独自の追跡Cookieや識別子は使いません。サイト閲覧時にGitHub APIへの通信が追加されます。将来の配布バージョン切り替えでは `docs/downloads.js` のタグ・APK名・説明を合わせて変更してください。

集計の定義：[GitHub Release Assets API](https://docs.github.com/en/rest/releases/assets)。管理者は `gh api repos/asm-asm/patterncanvas/releases/tags/v0.2.0` でも確認できます。

配布ページ、利用案内、iPhone向けWebアプリを管理します。Android本体のソースコード、個人の作品、端末の接続情報、署名鍵は含みません。APKはReleasesで配布します。

`docs/`以下は静的HTML/CSS/JavaScriptです。GitHub Pagesの公開元はmainブランチの`/docs`。

掲載画像はサンプル作品を表示したアプリのテスト環境での画面です。機能説明欄の図はイメージです。

共有用画像 `docs/assets/og.png` は組み込みimagegenで生成した紹介イメージであり、アプリ画面ではありません。生成指示は「生成りの背景、ワインレッドの文字、青と生成りの幾何学的な編み地。Pattern Canvas／ひと目ずつ、思い描いた模様へ。／編み図・編み地プレビュー・段数カウンターを読みやすく配置。画面モックアップではなく横長の紹介カード」です。

## v0.2.0で確認したこと

- 編み図の1マスとプレビューの1目の対応、上下方向、反転、リピート。
- 単体テスト28件をDebug/Releaseで実行し、すべて成功。
- デバッグAPKのビルドとLint成功。
- Galaxy SM-F971Qでインストール、段選択、段完了、戻る、再起動後の保持を確認。
- 物理的なFold開閉・回転、S Pen入力、全機種の検証は未実施。

表示の目の比率や陰影はイメージであり、実物のゲージ・寸法・糸の張りを再現するものではありません。

## iPhone Web版 v0.1.0（2026-09-14）

ストア配布を行わないPWAです。Safariで開き、共有メニューからホーム画面に追加できます。ネイティブIPAではなく、iOS 16以降のSafariを想定したWebアプリです。標準iPhoneの375〜430px幅を中心に、セージグリーン・アプリコットの配色で実装しています。

- `docs/iphone/app/model.mjs`: 下から上の共通二次元配列、反転、範囲コピー・移動・削除、塗りつぶし、段数管理、検証付きJSON入出力、決定的な画像減色。
- `app.mjs` / `draw.mjs`: タップ・ドラッグ描画、2本指ズーム・移動、V字の陰影プレビュー、パレット、段選択、メモ、履歴40操作、保存、画像の切り抜きUI。
- `sw.js` / `manifest.webmanifest`: ホーム画面アプリ・オフラインキャッシュ。公開更新時はキャッシュ名を変更します。新しいキャッシュは開いている旧版を閉じた後に有効化されます。
- `docs/iphone/index.html`: 専用配布ページと初心者ガイド。
- `docs/iphone/og.png`: 組み込みimagegenによる紹介イメージ。「セージとアプリコット、編み地と方眼紙、Pattern Canvas／編みもの時間を、手のひらに。／for iPhone」の指示で生成。アプリの実画面ではありません。
- `docs/iphone/app-screen.png`: テスト用サンプル作品の実画面。

### 検証

`npm test`: モデルの9テスト。1マス=1目、上下方向、3×2リピート、全体・範囲反転、進捗、範囲移動の失敗時保全、塗りつぶし、保存復元、不正ファイル拒否、画像変換を検証。

`npm run test:ui`: ローカル配信中にWebKitで実行。先に `python -m http.server 4173 --bind 127.0.0.1 --directory docs` と `npx playwright install webkit` が必要です。1マス編集時のプレビューピクセル比較、段番号タップ、完了・戻る、Undo/Redo、メモ、リピート、段入力、375/390/430px幅、再読み込み、キャッシュ、作品ファイル入出力、画像選択と減色を検証します。

Chromiumではオフライン再読み込みも確認。Windows上のPlaywright WebKitではネットワーク強制オフ時にエンジン内部エラーが発生したため、キャッシュの存在と通常の再読み込みまで確認しています。iPhone実機での操作・ホーム画面追加・オフライン動作は未検証です。

### 保存と制限

- 作品はこの端末・ブラウザーのlocalStorageへ保存。独自サーバーへの送信や独自アクセス解析はありません。ブラウザーのデータ削除・容量制限に備え、JSONを書き出してバックアップしてください。
- 100目×100段、32色、横・縦リピート各10まで。端末によって大きな作品の描画・変換に時間がかかる場合があります。
- 専用JSON形式で、Android版の.pcanvasとは互換性がありません。クラウド同期・作品一覧・履歴の永続化・筆圧入力は未実装です。
- Safariとホーム画面アプリのデータが分かれる場合はファイルで移行してください。複数タブでの同時編集は避けてください。
- 初回の読み込みとオフライン準備には通信が必要です。配布ページ自体はオフライン保存の対象外です。
