import {webkit,expect} from '@playwright/test';
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
 for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width,height});await page.locator('[data-view=both]').click();
  const footer=await page.locator('.bottom-dock').boundingBox();assert(footer.height<=60,'navigation must be one compact row');
  await page.locator('#complete').scrollIntoViewIfNeeded();
  const complete=await page.locator('#complete').boundingBox(),row=await page.locator('#choose-row').boundingBox(),counter=await page.locator('.counter').boundingBox();
  assert(complete.y>=row.y+row.height&&complete.width>=counter.width-30&&complete.height>=44);
  assert(await page.locator('#complete').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view=both]').click();await page.locator('#complete').click();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 const before=await read();
 for(const mode of ['both','chart','preview','settings']){
  await page.locator(`[data-view=${mode}]`).click();
  const chartBefore=mode!=='preview'&&mode!=='settings'?await page.locator('#chart').evaluate(c=>c.toDataURL()):null;
  for(const event of ['patterncanvas-resume','pageshow','visibilitychange']){
   await page.evaluate(event=>{for(const id of ['work','preview-panel','chart-panel'])document.getElementById(id).hidden=true;for(const id of ['chart','preview']){const c=document.getElementById(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}if(event==='visibilitychange')document.dispatchEvent(new Event(event));else window.dispatchEvent(new Event(event));},event);
   await expect(page.locator(`[data-view=${mode}]`)).toHaveAttribute('aria-pressed','true');
   assert.equal(await page.locator('#work').evaluate(e=>e.hidden),mode==='settings');
   assert.equal(await page.locator('#preview-panel').evaluate(e=>e.hidden),mode==='chart');
   assert.equal(await page.locator('#chart-panel').evaluate(e=>e.hidden),mode==='preview');
   if(chartBefore)assert.equal(await page.locator('#chart').evaluate(c=>c.toDataURL()),chartBefore,'resume keeps chart viewport and cells');
   if(mode!=='settings')assert(await page.locator('.counter').isVisible());
   if(mode==='both'||mode==='preview')assert(await page.locator('#preview').evaluate(c=>c.getContext('2d').getImageData(1,1,1,1).data[3]>0),'preview bitmap restored without resize');
  }
  await page.reload();await expect(page.locator(`[data-view=${mode}]`)).toHaveAttribute('aria-pressed','true');assert.equal((await read()).currentRow,before.currentRow);assert.deepEqual((await read()).cells,before.cells);
 }
 await page.locator('[data-view=both]').click();await page.locator('#complete').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/compact-counter-iphone.png'});
 await page.locator('[data-view=chart]').click();await page.locator('#chart').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/compact-chart-iphone.png'});
 assert.deepEqual(errors,[]);console.log('Compact UI and resume: 5 viewport sizes, completion placement, native/pageshow/visibility recovery and persisted tabs passed');
}finally{await browser.close();}
