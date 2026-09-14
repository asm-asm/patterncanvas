import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=path.resolve('docs'),port=4174,base=`http://127.0.0.1:${port}`;
const code='PC-IOS-'+Array(10).fill('ABCD').join('-');
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,base).pathname;
    if(pathname==='/iphone/access/config.mjs'){
      res.setHeader('Content-Type','text/javascript');res.end(`export default {enabled:true,mode:'test',apiBase:'${base}',legalReady:false};`);return;
    }
    if(pathname==='/verify-license'){
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({valid:true,status:'active',email:'a***@example.com',verifiedAt:Date.now(),offlineUntil:Date.now()+7*86400000}));return;
    }
    const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('path');
    const type={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png'}[path.extname(file)];
    res.setHeader('Content-Type',type||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({channel:'chrome'});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
  await page.goto(base+'/iphone/app/');await page.locator('#license').fill(code);await page.getByRole('button',{name:'確認する',exact:true}).click();await page.locator('#chart').waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.getByRole('button',{name:'この段を完了',exact:false}).click();
  const row=await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).currentRow);
  await context.setOffline(true);await page.reload();await page.locator('#chart').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).currentRow),row);
  const urls=await page.evaluate(async()=>{const out=[];for(const name of await caches.keys()){for(const req of await (await caches.open(name)).keys())out.push(req.url);}return out;});
  assert(!urls.some(url=>url.includes('verify-license')));
  assert(urls.some(url=>url.endsWith('/access/gate.mjs')));
  await page.evaluate(async()=>{const s=await import('../access/storage.mjs');const record=await s.load('license');await s.save('license',{...record,offlineUntil:Date.now()-1});});
  await page.reload();await page.getByRole('status').filter({hasText:'インターネット'}).waitFor();
  assert.equal(await page.locator('.shell').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).currentRow),row);
  console.log('PASS Chromium: actual offline reload through Service Worker, valid grace, expiry lock, preserved progress, no API cache');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
