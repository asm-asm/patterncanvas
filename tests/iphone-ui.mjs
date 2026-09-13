import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {blank,sample} from '../docs/iphone/app/model.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
await context.addInitScript(p=>{if(location.protocol.startsWith('http')&&!localStorage.getItem('patterncanvas-iphone-v1'))localStorage.setItem('patterncanvas-iphone-v1',JSON.stringify(p));},blank(2,2));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const key='patterncanvas-iphone-v1';
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
try{
 await page.goto(base+'/iphone/app/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const before=await page.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
 await page.getByRole('button',{name:'セージ',exact:true}).click();await page.locator('#chart').click({position:{x:54,y:12}});
 assert.deepEqual((await state()).cells,[[0,0],[1,0]]);
 const after=await page.locator('#preview').evaluate(c=>({width:c.width,height:c.height,data:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)}));
 let changed=0;for(let i=0;i<before.length;i+=4){if(before.slice(i,i+4).some((v,k)=>v!==after.data[i+k])){changed++;const x=(i/4)%after.width,y=Math.floor(i/4/after.width);assert.ok(x<after.width/2&&y<after.height/2,`Only the upper left stitch may change: ${x},${y}; ${after.width}x${after.height}`);}}assert.ok(changed>0);console.log('PASS WebKit: one cell changes only its corresponding preview stitch');
 await page.locator('#undo').click();assert.deepEqual((await state()).cells,[[0,0],[0,0]]);await page.locator('#redo').click();assert.equal((await state()).cells[1][0],1);
 await page.locator('#chart').click({position:{x:22,y:12}});assert.equal((await state()).currentRow,2);assert.deepEqual((await state()).cells,[[0,0],[1,0]]);
 await page.locator('#complete').click();assert.deepEqual((await state()).completedRows,[2]);await page.locator('#previous').click();assert.deepEqual((await state()).completedRows,[]);
 await page.locator('#memo-open').click();await page.locator('#memo').fill('糸を替える');await page.locator('#memo-save').click();await page.reload();assert.equal((await state()).notes[2],'糸を替える');console.log('PASS WebKit: row gutter, complete/back, undo/redo, note and reload');
 await page.locator('[data-view=settings]').click();await page.locator('#repeat-h').fill('3');await page.locator('#repeat-v').fill('2');await page.locator('#apply-repeats').click();assert.equal((await state()).horizontalRepeats,3);assert.equal((await state()).verticalRepeats,2);
 await page.locator('[data-view=chart]').click();await page.locator('#choose-row').click();await page.locator('#row-input').fill('4');await page.locator('#row-go').click();assert.equal((await state()).currentRow,4);
 for(const width of [375,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.equal(await page.evaluate(async()=>!!(await caches.match(location.href))),true);await page.reload();assert.equal((await state()).currentRow,4);assert.ok(await page.locator('#chart').isVisible());console.log('PASS WebKit: repeated row jump, phone widths, cached app shell and reload');
 await page.locator('[data-view=settings]').click();const original=await state();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.json'));await fs.mkdir('test-results',{recursive:true});await download.saveAs('test-results/export.json');assert.deepEqual(JSON.parse(await fs.readFile('test-results/export.json','utf8')).cells,original.cells);
 await page.locator('#image-file').setInputFiles('docs/iphone/app/icon-192.png');await page.locator('#image-dialog').waitFor({state:'visible'});await page.locator('#image-convert').click();assert.equal((await state()).name,'画像からの編み図');assert.ok((await state()).yarns.length<=6);
 await page.locator('[data-view=settings]').click();await page.locator('#import').setInputFiles('test-results/export.json');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')).columns===2);assert.deepEqual((await state()).cells,original.cells);console.log('PASS WebKit: file export/import, image crop and quantization');
 assert.deepEqual(errors,[]);console.log('PASS WebKit: no uncaught errors');
 // Public-facing screenshot is the bundled sample, never a user's project.
 await page.locator('[data-view=settings]').click();await page.locator('#import').setInputFiles({name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample()))});await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-tool=pen]')).backgroundColor==='rgb(82, 121, 107)');await page.screenshot({path:'docs/iphone/app-screen.png'});
}finally{await browser.close();}
