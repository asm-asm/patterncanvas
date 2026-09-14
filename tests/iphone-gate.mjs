import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const code='PC-IOS-'+Array(10).fill('ABCD').join('-');let valid=true,network=true;
await context.route('**/access/config.mjs',route=>route.fulfill({contentType:'text/javascript',body:"export default {enabled:true,mode:'test',apiBase:'https://license.test',legalReady:false};"}));
await context.route('https://license.test/**',route=>{
  if(!network)return route.abort();
  const path=new URL(route.request().url()).pathname;
  const data=route.request().postDataJSON();
  const result=path==='/claim-license'?{license:code}:{valid:valid&&data.license===code,status:'active',email:'a***@example.com',verifiedAt:Date.now(),offlineUntil:Date.now()+7*86400000};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
});
const base='http://127.0.0.1:4173';
const project=()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('patterncanvas-iphone-v1'));delete p.updatedAt;return p;});
try{
  await page.goto(base+'/iphone/');await page.getByRole('button',{name:'購入する',exact:true}).waitFor();
  await page.goto(base+'/iphone/app/');await page.getByRole('button',{name:'購入する',exact:true}).waitFor();
  assert.equal(await page.locator('.shell').isVisible(),false);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/app.mjs'))),false);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/license-purchase.png',fullPage:true});
  await page.locator('#license').fill('wrong');await page.getByRole('button',{name:'確認する',exact:true}).click();await page.getByRole('status').filter({hasText:'入力内容'}).waitFor();
  await page.locator('#license').fill(code);await page.getByRole('button',{name:'確認する',exact:true}).click();await page.locator('#chart').waitFor();
  await page.getByRole('button',{name:'この段を完了',exact:false}).click();
  const saved=await project();assert(saved);
  await page.reload();await page.locator('#chart').waitFor();assert.deepEqual(await project(),saved);
  await page.getByRole('button',{name:'ライセンス情報',exact:true}).click();assert.equal(await page.locator('#saved-code').inputValue(),code);
  await page.screenshot({path:'test-results/license-info.png',fullPage:true});
  network=false;await page.reload();await page.locator('#chart').waitFor();
  await page.evaluate(async()=>{const m=await import('/iphone/access/storage.mjs');const r=await m.load('license');await m.save('license',{...r,offlineUntil:Date.now()-1});});
  await page.reload();await page.getByRole('status').filter({hasText:'インターネット'}).waitFor();assert.equal(await page.locator('.shell').isVisible(),false);assert.deepEqual(await project(),saved);
  network=true;valid=false;await page.reload();await page.getByRole('status').filter({hasText:'入力内容'}).waitFor();assert.deepEqual(await project(),saved);
  valid=true;await page.evaluate(async()=>{const m=await import('/iphone/access/storage.mjs');await m.save('checkout-token','a'.repeat(64));});
  await page.goto(base+'/iphone/payment-success/?session_id=cs_test_example');await page.getByRole('heading',{name:'購入が完了しました'}).waitFor();assert.equal(await page.locator('#issued').inputValue(),code);
  await page.getByRole('link',{name:'編みものノートを開く',exact:true}).click();await page.locator('#chart').waitFor();
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('PASS: unpaid gate, invalid code, activation, restart, code display, offline grace/expiry, refund, project preservation, success, iPhone widths');
}finally{await context.close();await browser.close();}
