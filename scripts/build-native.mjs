import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),out=new URL('native/www/',root),app=new URL('docs/iphone/app/',root);
await mkdir(out,{recursive:true});
const files=['app.mjs','model.mjs','draw.mjs','app.css','image-model.mjs','image-worker.mjs','image-import.mjs','text-import.mjs','text-model.mjs'];
for(const file of files)await copyFile(new URL(file,app),new URL(file,out));
let html=await readFile(new URL('index.html',app),'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="native.css"></head>').replace(/<link rel="(?:manifest|apple-touch-icon)"[^>]*>/g,'')
 .replace('<link rel="stylesheet" href="../access/gate.css">','<style>.access-pending .shell{display:none}</style>')
 .replace('src="bootstrap.mjs"','src="entry.mjs"')
 .replace('href="../"','href="help.html"')
 .replace('aria-label="使い方・配布ページ"','aria-label="使い方"')
 .replace('iPhone Web版 v0.2.0（有料版準備中）','iPhone・iPad版 1.0.1')
 .replace(/<div class="settings-card"><h3>ホーム画面で使う<\/h3>[\s\S]*?<\/div>/,'<div class="settings-card"><h3>アプリについて</h3><p id="offline-state" class="hint"></p><p class="hint">編みものノート 1.0.1</p><p><a href="help.html">使い方・お問い合わせ</a> · <a href="privacy.html">プライバシーポリシー</a></p></div>')
 .replace('普段は端末内に自動保存。Safariのデータ消去や端末の空き容量不足に備え、','普段はこの端末に自動保存。アプリの削除や端末の故障に備え、')
 .replace('このiPhone版用の形式です。','Web版からの作品JSONも読み込めます。')
 .replace('このアプリにはJavaScriptが必要です。Safariの設定で有効にしてください。','アプリを再起動してください。');
await writeFile(new URL('index.html',out),html);
await copyFile(new URL('native/src/native.css',root),new URL('native.css',out));
await copyFile(new URL('native/src/entry.mjs',root),new URL('entry.mjs',out));
await build({entryPoints:[new URL('native/src/platform.mjs',root).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,format:'esm',platform:'browser',target:'safari16',outfile:new URL('platform.mjs',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'),legalComments:'eof'});
for(const file of ['help.html','privacy.html'])await copyFile(new URL(`native/content/${file}`,root),new URL(file,out));
// Review guideline 2.3.10: public copy must describe this app, not other platforms.
// Capacitor's internal platform detection is deliberately outside this copy check.
for(const file of ['index.html','help.html','privacy.html']){
 const copy=await readFile(new URL(file,out),'utf8');
 if(/android|google\s*play|\.pcanvas/i.test(copy))throw Error(`Other-platform reference in native copy: ${file}`);
}
for(const file of ['description-ja.txt','metadata-ja.json']){
 const copy=await readFile(new URL(`native/release-1.0/${file}`,root),'utf8');
 if(/android|google\s*play|\.pcanvas/i.test(copy))throw Error(`Other-platform reference in Store metadata: ${file}`);
}
// This directory is allowlisted, not a copy of the website. Refuse leftovers.
const allowed=new Set([...files,'native.css','index.html','entry.mjs','platform.mjs','help.html','privacy.html']);
for(const file of await readdir(out))if(!allowed.has(file))throw Error(`Unexpected bundled file: ${file}`);
for(const file of [...files,'native.css','index.html','entry.mjs','platform.mjs','help.html','privacy.html']){
 const text=await readFile(new URL(file,out),'utf8');
 if(/stripe|firebase|verify-license|claim-license|checkout|access\/gate|TODO|serviceWorker\.register|MASTER_LICENSE/i.test(text))throw Error(`Disallowed Store content in ${file}`);
}
console.log('App Store assets built: local editor + native storage/share/haptics; no external payment or license code.');
