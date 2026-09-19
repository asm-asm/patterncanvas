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
 await page.setViewportSize({width:1024,height:900});
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();
 const fixture=blank(8,3);fixture.verticalRepeats=2;fixture.cells[0][1]=1;
 await page.locator('#import').setInputFiles({name:'flat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 const preview=await page.locator('#preview').evaluate(c=>c.toDataURL());
 await page.locator('#knitting-mode-open').click();await page.locator('#knitting-mode').selectOption('flat');await page.locator('#knitting-mode-save').click();
 assert.match(await page.locator('#working-side').textContent(),/1段目.*表側/);assert.equal(await page.locator('#column-numbering').inputValue(),'right');assert(await page.locator('#column-numbering').isDisabled());
 await page.locator('#chart-lock').click();await page.locator('#complete').click();
 assert.match(await page.locator('#working-side').textContent(),/2段目.*裏側/);assert.equal(await page.locator('#column-numbering').inputValue(),'left');
 assert.equal(await page.locator('#preview').evaluate(c=>c.toDataURL()),preview);
 await page.locator('#previous').click();assert.match(await page.locator('#working-side').textContent(),/1段目.*表側/);
 await page.locator('#choose-row').click();await page.locator('#row-input').fill('4');await page.locator('#row-go').click();assert.match(await page.locator('#working-side').textContent(),/4段目.*裏側/);
 await page.reload();await expect(page.locator('#working-side')).toHaveText(/4段目.*裏側/);assert.deepEqual((await read()).cells,fixture.cells);
 await page.locator('#direction-open').click();await page.locator('#direction-top').click();assert.match(await page.locator('#working-side').textContent(),/1段目.*表側/);await page.locator('#complete').click();assert.match(await page.locator('#working-side').textContent(),/2段目.*裏側/);
 await page.locator('#knitting-mode-open').click();await page.locator('#first-side').selectOption('wrong');await page.locator('#knitting-mode-save').click();assert.match(await page.locator('#working-side').textContent(),/2段目.*表側/);
 await page.locator('[data-view=settings]').click();await page.locator('#export').click();const exported=JSON.parse((await page.evaluate(()=>window.shared)).data);assert.equal(exported.flatKnitting,true);assert.equal(exported.startWrongSide,true);
 await page.locator('[data-view=chart]').click();
 for(const [width,height] of [[320,480],[390,844],[844,390],[1024,768]]){
  await page.setViewportSize({width,height});await page.locator('#knitting-mode-open').click();await page.locator('#knitting-mode-save').click();assert(await page.locator('#chart-reading').isVisible());
 }
 await page.locator('#knitting-mode-open').click();await page.locator('#knitting-mode').selectOption('fixed');await page.locator('#knitting-mode-save').click();assert(await page.locator('#working-side').isHidden());assert(await page.locator('#column-numbering').isEnabled());
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('Flat knitting UI: row alternation, lock, restart, top-down, export and responsive dialog passed');
}finally{await browser.close();}
