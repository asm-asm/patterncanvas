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
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 await page.locator('[data-view=settings]').click();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=8;const g=c.getContext('2d');g.fillStyle='red';g.fillRect(0,0,16,8);g.fillStyle='blue';g.fillRect(8,4,8,4);return c.toDataURL().split(',')[1];});
 await page.locator('#image-file').setInputFiles({name:'pattern.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.waitForFunction(()=>!document.getElementById('image-convert').disabled);await page.locator('#image-convert').click();
 await page.locator('[data-view=settings]').click();await page.locator('#repeat-h').fill('3');await page.locator('#repeat-v').fill('2');await page.locator('#apply-repeats').click();const before=await read();
 await page.locator('#padding-open').click();await page.locator('#padding-left').fill('2');await page.locator('#padding-right').fill('3');await page.locator('#padding-top').fill('1');await page.locator('#padding-bottom').fill('4');await page.locator('#padding-color').selectOption(String(before.yarns[1].id));
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});const r=await page.locator('#padding-apply').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);}
 await page.locator('#padding-apply').click();const after=await read();assert.equal(after.columns,before.columns+5);assert.equal(after.rows,before.rows+5);assert.equal(after.horizontalRepeats,3);assert.equal(after.verticalRepeats,2);
 for(let r=0;r<before.rows;r++)assert.deepEqual(after.cells[r+4].slice(2,2+before.columns),before.cells[r]);assert(after.cells[0].every(c=>c===before.yarns[1].id));
 await page.locator('[data-view=chart]').click();await page.locator('#undo').click();assert.deepEqual((await read()).cells,before.cells);await page.locator('#redo').click();assert.deepEqual((await read()).cells,after.cells);
 await page.reload();await page.locator('#chart').waitFor();assert.deepEqual((await read()).cells,after.cells);
 await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#padding-open').isDisabled());assert.deepEqual(errors,[]);
 console.log('PASS imported image padding: 3x2 repeats, motif/color preservation, responsive modal, undo/redo, reload and lock');
}finally{await browser.close();}
