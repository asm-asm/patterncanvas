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
 await page.setViewportSize({width:1024,height:900});await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();const fixture=blank(4,2);fixture.cells=[[1,0,0,1],[0,0,1,1]];fixture.horizontalRepeats=3;
 await page.locator('#import').setInputFiles({name:'runs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 await page.locator('#chart-lock').click();const before=await read(),preview=await page.locator('#preview').evaluate(c=>c.toDataURL());
 const box=await page.locator('#chart').boundingBox();await page.locator('#chart').click({position:{x:180,y:64}});await expect(page.locator('#run-count')).toContainText('2目連続（左から4〜5マス）');
 assert.deepEqual(await read(),before);assert.equal(await page.locator('#preview').evaluate(c=>c.toDataURL()),preview);assert.equal((await page.locator('#chart').boundingBox()).y,box.y,'count text must not move canvas');
 await page.locator('#chart').click({position:{x:108,y:40}});await expect(page.locator('#run-count')).toContainText('2段目');
 const status=await page.locator('#run-count').textContent();
 const rect=await page.locator('#chart').boundingBox();await page.mouse.move(rect.x+160,rect.y+64);await page.mouse.down();await page.mouse.move(rect.x+200,rect.y+64,{steps:6});await page.mouse.up();assert.equal(await page.locator('#run-count').textContent(),status,'drag must not count a new run');
 await page.locator('#complete').click();await expect(page.locator('#run-count')).toContainText('色のマスをタップ');
 await page.locator('#chart-lock').click();assert(await page.locator('#run-count').isHidden());
 for(const [width,height] of [[390,844],[320,480],[844,390],[1024,768]]){await page.setViewportSize({width,height});await page.locator('#chart-lock').click();await page.locator('#chart').click({position:{x:108,y:40}});await expect(page.locator('#run-count')).toContainText('目連続');await page.locator('#chart-lock').click();}
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('Locked color runs: repeat seam, physical row, read-only data, preview, stable layout, drag and responsive screens passed');
}finally{await browser.close();}
