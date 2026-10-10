import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
// 丸ヨーク: set counts, suggestions, validation, creation with automatic increases, repeats, top-down counter, lock.
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const getPurchaseStatus=async()=>({state:'purchased',products:[],now:Date.now()});
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>localStorage.setItem('patterncanvas-iphone-v1',data);
export const readLock=()=>localStorage.getItem('native-lock')==='true';
export const writeLock=value=>localStorage.setItem('native-lock',String(value));
export const rowCompleted=()=>{};export const exportProject=async()=>{};export const prepareOffline=()=>{};`}));
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4175|blob:|data:)/.test(r.url()))remote.push(r.url());});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();await page.locator('#yoke-open').click();await page.locator('#yoke-apply:not([disabled])').waitFor();
 assert.match(await page.locator('#yoke-summary').textContent(),/1模様 8目 → 24目 × 12模様。増し目は 8段目（\+48目）・16段目（\+48目）・24段目（\+48目）・32段目（\+48目）/);
 assert.equal(await page.locator('#yoke-repeats-suggest [aria-pressed=true]').textContent(),'12模様（1模様 8→24目）');
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});const b=await page.locator('#yoke-apply').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
 await page.setViewportSize({width:390,height:844});
 // Validation: counts that do not divide disable creation with a reason; a suggestion fixes it.
 await page.locator('#yoke-repeats').fill('10');assert(await page.locator('#yoke-apply').isDisabled());assert.match(await page.locator('#yoke-error').textContent(),/割り切れる/);
 await page.locator('#yoke-repeats-suggest button',{hasText:'16模様'}).click();assert.equal(await page.locator('#yoke-repeats').inputValue(),'16');assert(await page.locator('#yoke-apply').isEnabled());
 await page.locator('#yoke-repeats-suggest button',{hasText:'12模様'}).click();
 await page.locator('#yoke-apply').click();
 const p=await read();
 assert.equal(p.name,'丸ヨーク 96目→288目');assert.equal(p.columns,24);assert.equal(p.rows,40);assert.equal(p.horizontalRepeats,12);assert.equal(p.topDown,true);
 assert.equal(p.symbols.flat().filter(s=>s==='M1L').length,16);
 assert.equal(await page.locator('#project-name').textContent(),'丸ヨーク 96目→288目');
 // Counter starts at the neck (row 1) and the 8th row carries the increase note.
 assert.match(await page.locator('#choose-row').textContent(),/^1\s*\/\s*40/);
 for(let i=0;i<7;i++)await page.locator('#complete').click();
 assert.match(await page.locator('#choose-row').textContent(),/^8/);assert.match((await read()).notes[String(40+1-8)],/増し目の段/);
 // Locked charts cannot start a new yoke.
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#yoke-open').isDisabled());
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS round yoke: summary, suggestions, validation, responsive dialog, automatic increases and notes, 12 repeats, top-down counter, lock');
}finally{await browser.close();}
