# App Store Connectで残る画面操作

初回のアプリ内購入は、App Store ConnectのWeb画面でアプリの新バージョンと一緒に提出する必要があります。APIから単独で初回商品を提出しません。

1. App Store Connect → アプリ → 編みものノート → 配信 → iOS 1.1.0を開きます。
2. 選択ビルドが29.1、公開方法が手動になっていることを確認します。
3. 「アプリ内課金とサブスクリプション」の追加から、以下の2商品を選びます。
   - 7-day Trial / 7日間無料体験：jp.amimononote.ios.trial7、0円
   - Lifetime Full Unlock / 全機能を永久解除：jp.amimononote.ios.lifetime、3,000円
4. 保存し、審査対象にアプリと2商品が含まれることを確認して「審査用に追加」→「審査に提出」へ進みます。
5. 承認後も、アプリ本体のダウンロード価格が無料になるまでは手動公開しないでください。公開手順はRELEASE-CHECKLIST-ja.mdを参照してください。

商品が選択できない場合は、その商品の「不足しているメタデータ」などの表示を確認します。購入画面の審査用画像が登録・処理完了している必要があります。

公式資料：https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases
