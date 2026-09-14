# App Storeアイコン

組み込みimage_genで、既存のWeb版アイコンを参照してストア用に出力しました。
生成元：`native/assets/icon-source.png`。
配信用：`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`。
配信ファイルはアセット処理で1024×1024、RGB・不透明へ正規化しています。

使用プロンプト：

> Create a 1024 by 1024 pixel App Store icon version of the attached existing app icon. Faithfully preserve the exact composition: full bleed solid sage green background (#52796b), centered symmetrical pixel-grid flower made of cream (#f3ead9) squares and an apricot (#eac5af) 2x2 center, thin sage grid lines. Preserve the existing flower silhouette, placement, proportions, and empty margins. Flat sharp graphic, no text, no shadow, no gradients, no rounded corners, no new elements. Completely opaque RGB PNG intended for iOS AppIcon, precisely square 1024x1024.

旧Web版のアイコンは変更していません。
