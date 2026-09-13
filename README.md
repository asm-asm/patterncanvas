# Pattern Canvas 配布サイト

棒針編み込みの編み図制作・編み地プレビュー・段数カウンターを備えたAndroidアプリの無料試用版です。

**[ダウンロードと初心者向けガイド](https://asm-asm.github.io/patterncanvas/)**

- [v0.2.0 APKをダウンロード](https://github.com/asm-asm/patterncanvas/releases/download/v0.2.0/PatternCanvas-0.2.0-debug.apk)
- [更新情報](https://github.com/asm-asm/patterncanvas/releases)
- [不具合・要望を送る](https://github.com/asm-asm/patterncanvas/issues/new?template=feedback.yml)

Android 8.0以上向け。iPhone/iPadには対応していません。Google Playで配信する製品版ではなく、デバッグ署名の試用版です。端末の保護設定によりインストールできない場合があります。全機種での動作を保証するものではありません。

編み図・進捗・毛糸・メモは端末内に保存します。大切な作品はアプリの「作品を書き出す」でバックアップしてください。Androidのバックアップ設定によりOSのバックアップ対象になる場合があります。

## このリポジトリについて

### ダウンロード数

配布ページのダウンロード欄に、v0.2.0 APKの累計取得回数を表示します。ページ表示時にGitHub公開APIの `download_count` を取得するため、導入前の取得や直接リンク経由の取得も含みます。再取得・動作確認・自動取得を区別せず、人数やインストール完了数を意味しません。ファイルの削除・再アップロードでカウントが失われる可能性があります。

APIの制限・通信エラー時は取得不能を表示し、ダウンロード自体は妨げません。独自の追跡Cookieや識別子は使いません。サイト閲覧時にGitHub APIへの通信が追加されます。将来の配布バージョン切り替えでは `docs/downloads.js` のタグ・APK名・説明を合わせて変更してください。

集計の定義：[GitHub Release Assets API](https://docs.github.com/en/rest/releases/assets)。管理者は `gh api repos/asm-asm/patterncanvas/releases/tags/v0.2.0` でも確認できます。

配布ページと利用案内を管理します。アプリ本体のソースコード、個人の作品、端末の接続情報、署名鍵は含みません。APKはReleasesで配布します。

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
