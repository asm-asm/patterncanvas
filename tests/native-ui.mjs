import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {blank} from '../docs/iphone/app/model.mjs';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>{localStorage.setItem('patterncanvas-iphone-v1',data);window.nativeSaves=(window.nativeSaves||0)+1;};
export const readLock=()=>localStorage.getItem('native-lock')==='true';
export const writeLock=value=>localStorage.setItem('native-lock',String(value));
export const rowCompleted=()=>window.haptics=(window.haptics||0)+1;
export const exportProject=async(data,name)=>{window.shared={data,name};};
export const prepareOffline=()=>document.querySelector('#offline-state').textContent='初回からオフラインで使えます';
`}));
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175'))remote.push(r.url());});
try{
  await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
  assert.equal(await page.getByText('購入する',{exact:true}).count(),0);
  await page.locator('#complete').click();assert.equal(await page.evaluate(()=>window.haptics),1);assert((await page.evaluate(()=>window.nativeSaves))>0);
  await page.locator('#chart-lock').click();await page.reload();await page.waitForFunction(()=>document.querySelector('#chart-lock').getAttribute('aria-pressed')==='true');
  await page.locator('[data-view=settings]').click();await page.locator('#export').click();
  const shared=await page.evaluate(()=>window.shared);assert.equal(JSON.parse(shared.data).currentRow,2);assert(shared.name.endsWith('.json'));
  await page.getByRole('link',{name:'プライバシーポリシー',exact:true}).click();await page.getByRole('heading',{name:'プライバシーポリシー'}).waitFor();
  await page.getByRole('link',{name:'編み図へ戻る',exact:true}).click();await page.locator('#chart').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).currentRow),2);
  await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();
  const large={...blank(500,500),format:'patterncanvas-web-2'},buffer=Buffer.from(JSON.stringify(large,null,2));assert(buffer.length>2000000);
  await page.locator('#import').setInputFiles({name:'large-chart.json',mimeType:'application/json',buffer});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).rows===500);
  for(const size of [{width:375,height:667},{width:430,height:932},{width:844,height:390}]){await page.setViewportSize(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);console.log('PASS native UI with plugin boundary mocks: no remote requests, save, share, haptics, lock, privacy, restore, large exported chart import, rotation');
}finally{await browser.close();}
