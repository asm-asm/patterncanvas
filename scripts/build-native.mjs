import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),out=new URL('native/www/',root),app=new URL('docs/iphone/app/',root);
await mkdir(out,{recursive:true});
const files=['app.mjs','model.mjs','draw.mjs','app.css'];
for(const file of files)await copyFile(new URL(file,app),new URL(file,out));
let html=await readFile(new URL('index.html',app),'utf8');
html=html.replace(/<link rel="(?:manifest|apple-touch-icon)"[^>]*>/g,'')
 .replace('<link rel="stylesheet" href="../access/gate.css">','<style>.access-pending .shell{display:none}</style>')
 .replace('src="bootstrap.mjs"','src="entry.mjs"')
 .replace('href="../"','href="help.html"')
 .replace('aria-label="使い方・配布ページ"','aria-label="使い方"')
 .replace('iPhone Web版 v0.2.0（有料版準備中）','iPhone版 1.0.0')
 .replace(/<div class="settings-card"><h3>ホーム画面で使う<\/h3>[\s\S]*?<\/div>/,'<div class="settings-card"><h3>アプリについて</h3><p id="offline-state" class="hint"></p><p class="hint">編みものノート 1.0.0</p><p><a href="help.html">使い方・お問い合わせ</a> · <a href="privacy.html">プライバシーポリシー</a></p></div>')
 .replace('普段は端末内に自動保存。Safariのデータ消去や端末の空き容量不足に備え、','普段はこのiPhoneに自動保存。アプリの削除や端末の故障に備え、')
 .replace('このiPhone版用の形式です。','Web版からの作品JSONも読み込めます。')
 .replace('このアプリにはJavaScriptが必要です。Safariの設定で有効にしてください。','アプリを再起動してください。');
await writeFile(new URL('index.html',out),html);
await copyFile(new URL('native/src/entry.mjs',root),new URL('entry.mjs',out));
await build({entryPoints:[new URL('native/src/platform.mjs',root).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,format:'esm',platform:'browser',target:'safari16',outfile:new URL('platform.mjs',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'),legalComments:'eof'});
for(const file of ['help.html','privacy.html'])await copyFile(new URL(`native/content/${file}`,root),new URL(file,out));
// This directory is allowlisted, not a copy of the website. Refuse leftovers.
const allowed=new Set([...files,'index.html','entry.mjs','platform.mjs','help.html','privacy.html']);
for(const file of await readdir(out))if(!allowed.has(file))throw Error(`Unexpected bundled file: ${file}`);
for(const file of ['index.html','entry.mjs','app.mjs','platform.mjs','help.html','privacy.html']){
 const text=await readFile(new URL(file,out),'utf8');
 if(/stripe|firebase|verify-license|claim-license|checkout|access\/gate|TODO|serviceWorker\.register|MASTER_LICENSE/i.test(text))throw Error(`Disallowed Store content in ${file}`);
}
console.log('App Store assets built: local editor + native storage/share/haptics; no external payment or license code.');
