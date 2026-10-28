import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const getPurchaseStatus=async()=>({state:window.expired?'expired':'purchased',products:[],now:Date.now()});
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>localStorage.setItem('patterncanvas-iphone-v1',data);
export const readLock=()=>localStorage.getItem('native-lock')==='true';
export const writeLock=value=>localStorage.setItem('native-lock',String(value));
export const rowCompleted=()=>{};
export const exportProject=async()=>{};
export const exportFile=async(bytes,name,type)=>{window.printed={text:Array.from(bytes.subarray(0,Math.min(bytes.length,4e6)),c=>String.fromCharCode(c)).join(''),size:bytes.length,name,type};};
export const prepareOffline=()=>{};
`}));
await context.addInitScript(()=>localStorage.setItem('patterncanvas-guide-done','1'));
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4175|blob:|data:)/.test(r.url()))remote.push(r.url());});
const pdf=async()=>{await page.locator('#print-apply').click();await page.waitForFunction(()=>window.printed,null,{timeout:60000});return page.evaluate(()=>{const x=window.printed;window.printed=null;return x;});};
const pages=t=>(t.match(/\/Type \/Page /g)||[]).length;
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor({state:'attached'});
 // Locking the chart must not stop printing: it only reads the project.
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();
 await page.locator('[data-view=settings]').click();assert(await page.locator('#print-open').isEnabled());await page.locator('#print-open').click();
 assert.deepEqual(await page.$$eval('#print-paper option',o=>o.map(x=>x.textContent)),['A4','B5','A3','レター']);
 assert.deepEqual(await page.$$eval('#print-mode option',o=>o.map(x=>x.value)),['color','colorSymbols','mono']);
 assert.equal(await page.inputValue('#print-mode'),'colorSymbols');assert.equal(await page.inputValue('#print-cell'),'fit');
 assert(await page.locator('#print-repeat-row').isVisible(),'the sample has repeats');assert(await page.locator('#print-notes-row').isHidden(),'no row notes yet');
 assert.match(await page.textContent('#print-summary'),/A4縦・1ページ/);assert(await page.locator('#print-preview').isVisible());
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});const b=await page.locator('#print-apply').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height,`button visible at ${width}x${height}`);}
 await page.setViewportSize({width:390,height:844});
 let out=await pdf();assert.equal(out.type,'application/pdf');assert.match(out.name,/\.pdf$/);assert(out.text.startsWith('%PDF-1.4'));assert.equal(pages(out.text),1);
 assert.match(out.text,/\/MediaBox \[0 0 595\.28 841\.89\]/,'A4 portrait');assert(await page.locator('#print-dialog').evaluate(d=>!d.open),'dialog closes after sharing');
 // Options are remembered; landscape A3 at large cells takes more pages; notes add a page.
 await page.locator('#print-open').click();await page.selectOption('#print-paper','A3');await page.selectOption('#print-orientation','landscape');await page.selectOption('#print-mode','mono');
 await page.locator('#print-cancel').click();await page.reload();await page.locator('#chart').waitFor({state:'attached'});
 await page.locator('[data-view=settings]').click();await page.locator('#print-open').click();
 assert.deepEqual([await page.inputValue('#print-paper'),await page.inputValue('#print-orientation'),await page.inputValue('#print-mode')],['A3','landscape','mono']);
 out=await pdf();assert.match(out.text,/\/MediaBox \[0 0 1190\.55 841\.89\]/,'A3 landscape');
 // A big chart spans many pages; 「1模様だけ」 brings it back to one.
 // Through the app itself: unlock, 10×10 repeats, and a row note on the current row.
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();
 await page.locator('[data-view=settings]').click();await page.locator('#repeat-h').fill('10');await page.locator('#repeat-v').fill('10');await page.locator('#apply-repeats').click();
 await page.locator('[data-view=both]').click();await page.locator('#memo-open').click();await page.locator('#memo').fill('ここから模様');await page.locator('#memo-save').click();
 await page.locator('[data-view=settings]').click();await page.locator('#print-open').click();
 await page.selectOption('#print-paper','A4');await page.selectOption('#print-orientation','portrait');await page.selectOption('#print-cell','large');
 const many=Number((await page.textContent('#print-summary')).match(/表(\d+)ページ/)[1]);assert(many>20,'the full 10×10 repeat chart spans many pages: '+many);
 await page.locator('#print-one-repeat').check();assert(await page.locator('#print-notes-row').isVisible());
 assert.match(await page.textContent('#print-summary'),/2ページ（表1ページ・段メモ1ページ）/);
 out=await pdf();assert.equal(pages(out.text),2);
 await page.locator('#print-open').click();await page.locator('#print-notes').uncheck();assert.match(await page.textContent('#print-summary'),/1ページ（表1ページ）/);await page.locator('#print-cancel').click();
 // The project is untouched by printing.
 const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));assert.equal(p.horizontalRepeats,10);assert(Object.values(p.notes).includes('ここから模様'));
 assert.deepEqual(remote,[],'made on the device');assert.deepEqual(errors,[]);
 console.log('PASS PDF print: locked chart, paper/orientation/mode/cell options remembered, A4/A3 page sizes, many pages, one repeat, row notes, responsive dialog, no network');
}finally{await browser.close();}
