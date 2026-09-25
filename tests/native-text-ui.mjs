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
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept(d.type()==='prompt'?'お気に入りの毛糸 20番':undefined));page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175')&&!r.url().startsWith('blob:http://127.0.0.1:4175/'))remote.push(r.url());});
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();await page.locator('#text-open').click();
 await page.locator('#text-content').fill('あみ\nLOVE');
 assert.equal(await page.locator('#text-apply').isEnabled(),true);
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});
  const box=await page.locator('#text-apply').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#text-apply').click();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 const made=await read();assert.equal(made.columns,64);assert.equal(made.rows,32);assert.deepEqual([...new Set(made.cells.flat())].sort(),[0,1]);
 await page.locator('[data-view=settings]').click();await page.getByRole('button',{name:'名前を変更',exact:true}).nth(1).click();
 const named=await read();assert.equal(named.yarns[1].name,'お気に入りの毛糸 20番');assert.deepEqual(named.cells,made.cells);
 await page.reload();await page.locator('#yarn-list button').first().waitFor();assert.equal((await read()).yarns[1].name,'お気に入りの毛糸 20番');
 await page.locator('[data-view=settings]').click();await page.locator('#text-open').click();await page.locator('#text-cancel').click();assert.deepEqual((await read()).cells,made.cells);
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#text-open').isDisabled());assert(await page.getByRole('button',{name:'名前を変更',exact:true}).first().isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS text generation, responsive dialog, yarn rename, persistence, cancel, lock');
}finally{await browser.close();}
