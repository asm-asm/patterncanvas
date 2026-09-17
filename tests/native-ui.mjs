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
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175')&&!r.url().startsWith('blob:http://127.0.0.1:4175/'))remote.push(r.url());});
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
  await page.locator('[data-view=both]').click();
  await page.locator('#direction-open').click();await page.locator('#direction-top').click();
  const top=await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));assert.equal(top.currentRow,top.rows*top.verticalRepeats);assert.ok(top.topDown);
  await page.locator('#complete').click();await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).currentRow),top.currentRow-1);
  await page.locator('#readability-open').click();await page.locator('#row-color-presets button').filter({hasText:'黄'}).click();await page.locator('#row-width').selectOption('6');await page.locator('#readability-dialog .primary').click();
  await page.locator('#stitch-edit').click();await page.locator('#structure-row').fill('2');await page.locator('#structure-count').fill('1');await page.locator('#structure-apply').click();
  const shape=await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));assert.equal(shape.cells.at(-1).at(-1),null);assert.notEqual(shape.cells[0].at(-1),null);
  await page.locator('[data-view=settings]').click();
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=80;const g=c.getContext('2d');g.fillStyle='red';g.fillRect(0,0,120,80);g.fillStyle='blue';g.fillRect(120,0,40,80);return c.toDataURL().split(',')[1];});
  await page.locator('#image-file').setInputFiles({name:'two-colors.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.waitForFunction(()=>!document.getElementById('image-convert').disabled);
  await page.locator('#image-sizes button').first().click();await page.waitForFunction(()=>document.getElementById('image-result-info').textContent==='変換結果：40目 × 20段・2色');await page.locator('#image-recommended').click();await page.waitForFunction(()=>!document.getElementById('image-convert').disabled);
  for(const size of [{width:320,height:480},{width:640,height:360}]){await page.setViewportSize(size);const r=await page.locator('#image-convert').boundingBox();assert(r.y>=0&&r.y+r.height<=size.height&&r.height>=48);}
  await page.locator('#image-convert').click();await page.reload();const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));assert.equal(imported.columns,40);assert.equal(imported.rows,20);assert.deepEqual(new Set(imported.yarns.map(y=>y.color)),new Set(['#ff0000','#0000ff']));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-readability'))),{color:'#ffe600',width:6});
  await page.locator('[data-view=settings]').click();await page.locator('#export').click();assert.equal(JSON.parse((await page.evaluate(()=>window.shared)).data).rows,20);
  console.log('PASS native boundary: direction/restart, readability, top-down shaping, source colors, recommendations, small/landscape modal, native conversion path and share');
  const large={...blank(500,500),format:'patterncanvas-web-2'},buffer=Buffer.from(JSON.stringify(large,null,2));assert(buffer.length>2000000);
  await page.locator('#import').setInputFiles({name:'large-chart.json',mimeType:'application/json',buffer});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).rows===500);
  for(const size of [{width:375,height:667},{width:430,height:932},{width:844,height:390}]){await page.setViewportSize(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);console.log('PASS native UI with plugin boundary mocks: no remote requests, save, share, haptics, lock, privacy, restore, large exported chart import, rotation');
}finally{await browser.close();}
