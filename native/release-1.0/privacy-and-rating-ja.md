# プライバシー・年齢レーティング入力の確認用

提出候補は1.0.0（14.1）、iPhone・iPad、iOS/iPadOS 16以降。

## App Privacy
回答案：このアプリから開発者がデータを収集しない。
- 会員登録、広告、独自アクセス解析、位置情報、連絡先アクセスなし。
- 写真は選択された画像だけを端末内で変換。開発者のサーバーへ送信しない。
- 作品・段数・メモはアプリ専用領域に保存。
- ユーザーが共有画面で選択した相手・保存先への書き出しはあり。
- Appleの購入処理、OSバックアップ、利用者が開くGitHubサポートは各サービスの取扱いに従う。
- アプリのPrivacy Manifestは追跡なし・収集項目なし。ファイル時刻APIの利用理由C617.1。
- Filesystem / Share / Hapticsを含む提出バイナリのPrivacy Reportを最終確認する。

## 年齢レーティング
独自に「4+」等を断定せず、Appleの最新質問票に回答して算定する。
実装上：公開投稿・チャット・ユーザー間交流・広告・購入ガチャ・賭博・成人向け表現・健康助言はない。
画像読み込みは個人が端末内で編集する機能。投稿サービスではない。
固定のサポートリンクはあるが、自由なWeb閲覧機能はない。

## 暗号化
アプリのInfo.plistではITSAppUsesNonExemptEncryption=false。独自暗号化の実装なし。提出時の輸出コンプライアンス質問に実装に即して回答。

## アクセシビリティ
色変更・枠の太さ・拡大機能はあるが、VoiceOver等の包括的対応は未検証。未確認の対応ラベルを掲載しない。

公式資料：
https://developer.apple.com/app-store/app-privacy-details/
https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
