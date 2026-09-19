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
 await page.setViewportSize({width:1024,height:900});
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();
 const fixture={...blank(8,4),format:'patterncanvas-web-2'};
 await page.locator('#import').setInputFiles({name:'symbols.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 const preview=await page.locator('#preview').evaluate(c=>c.toDataURL());
 await page.locator('[data-tool=symbol]').click();
 assert.equal(await page.locator('#stitch-symbol option').count(),7);
 const codes=['M1L','M1R','M1LP','M1RP','KFB','YO'];
 for(let x=0;x<codes.length;x++){
  await page.locator('#stitch-symbol').selectOption(codes[x]);
  await page.locator('#chart').click({position:{x:84+x*24,y:40}});
 }
 const marked=await read();assert.deepEqual(marked.cells,fixture.cells);assert.deepEqual(marked.symbols[3].slice(0,6),codes);
 assert.equal(await page.locator('#preview').evaluate(c=>c.toDataURL()),preview,'Symbol annotations must not reshape or recolor preview');
 await page.locator('#undo').click();assert.equal((await read()).symbols[3][5],null);
 await page.locator('#redo').click();assert.deepEqual((await read()).symbols,marked.symbols);
 await page.locator('[data-tool=symbol]').click();await page.locator('#stitch-symbol').selectOption('');await page.locator('#chart').click({position:{x:84,y:40}});
 assert.equal((await read()).symbols[3][0],null);assert.deepEqual((await read()).cells,fixture.cells);await page.locator('#undo').click();
 await page.locator('#chart-lock').click();assert(await page.locator('[data-tool=symbol]').isHidden());
 await page.locator('#chart').click({position:{x:84,y:40}});assert.deepEqual((await read()).symbols,marked.symbols);await page.locator('#chart-lock').click();
 await page.reload();assert.deepEqual((await read()).symbols,marked.symbols);
 await page.locator('[data-view=settings]').click();await page.locator('#export').click();
 const exported=JSON.parse((await page.evaluate(()=>window.shared)).data);assert.deepEqual(exported.symbols,marked.symbols);
 await page.locator('#import').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});assert.deepEqual((await read()).symbols,marked.symbols);
 await page.locator('[data-view=chart]').click();await page.locator('#column-numbering').selectOption('right');assert.deepEqual((await read()).symbols,marked.symbols);
 await page.locator('#stitch-edit').click();await page.locator('#structure-row').fill('2');await page.locator('#structure-symbol').selectOption('M1R');
 assert((await page.locator('#structure-summary').textContent()).includes('M1R'));
 await page.locator('#structure-apply').click();const shape=await read();assert.equal(shape.columns,9);assert.equal(shape.symbols[1][8],'M1R');assert.equal(shape.cells[0][8],null);assert.equal(shape.symbols[2][8],null);assert.deepEqual(shape.symbols[3].slice(0,6),codes);
 await page.locator('#undo').click();assert.deepEqual((await read()).symbols,marked.symbols);await page.locator('#redo').click();assert.deepEqual((await read()).symbols,shape.symbols);
 // Symbol picker, structural dialog and fixed undo stay reachable on small and rotated screens.
 for(const size of [{width:320,height:480},{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
  await page.setViewportSize(size);await page.locator('[data-tool=symbol]').click();
  const select=page.locator('#stitch-symbol');await select.scrollIntoViewIfNeeded();
  const box=await select.boundingBox();assert(box.width>100&&box.x>=0&&box.x+box.width<=size.width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#stitch-edit').click();await page.locator('#structure-symbol').selectOption('M1LP');await page.locator('#structure-apply').scrollIntoViewIfNeeded();
  const button=await page.locator('#structure-apply').boundingBox();assert(button.y>=0&&button.y+button.height<=size.height&&button.height>=44);await page.locator('#structure-close').click();
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view=chart]').click();await page.locator('#chart-panel').screenshot({path:'test-results/increase-symbols-iphone.png'});
 assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
 console.log('PASS six symbols: placement, deletion, undo/redo, locked state, preview, restart, JSON roundtrip, numbering, structural increase and responsive dialogs');
}finally{await browser.close();}
