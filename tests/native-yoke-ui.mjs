import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
// 丸ヨーク: gauge + size → counts, split and a chart with mirrored increases; inputs on top, editable measurements.
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
await context.addInitScript(()=>localStorage.setItem('patterncanvas-guide-done','1'));
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4175|blob:|data:)/.test(r.url()))remote.push(r.url());});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
const result=async()=>Object.fromEntries(await page.locator('#yoke-result div').evaluateAll(rows=>rows.map(r=>[r.querySelector('dt').textContent,r.querySelector('dd').textContent])));
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();await page.locator('#yoke-open').click();await page.locator('#yoke-apply:not([disabled])').waitFor();
 // The first inputs are visible without scrolling.
 for(const id of ['yoke-gauge-sts','yoke-gauge-rows']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.y+b.height<=844,id+' visible');}
 assert.equal(await page.locator('#yoke-sizes [aria-pressed=true]').textContent(),'M');assert.equal(await page.locator('#yoke-chest').inputValue(),'104');
 let r=await result();assert.match(r['首の作り目'],/^\d+目（約[\d.]+cm）$/);assert.match(r['身頃と袖'],/^後ろ\d+目／袖\d+目／前\d+目／袖\d+目$/);
 // Gauge and fit change the counts; a typed measurement deselects the preset size.
 const before=r['首の作り目'];await page.locator('#yoke-gauge-sts').fill('18');await page.locator('#yoke-gauge-rows').fill('26');await page.waitForTimeout(200);
 r=await result();assert.notEqual(r['首の作り目'],before);
 await page.locator('#yoke-fit').selectOption('relaxed');await page.waitForTimeout(200);assert.equal(await page.locator('#yoke-chest').inputValue(),'118');
 await page.locator('#yoke-sizes button',{hasText:/^L$/}).click();await page.waitForTimeout(200);assert.equal(await page.locator('#yoke-chest').inputValue(),'128');
 await page.locator('#yoke-chest').fill('120');await page.waitForTimeout(200);assert.equal(await page.locator('#yoke-sizes [aria-pressed=true]').count(),0);
 // Bad input disables creation with a reason.
 await page.locator('#yoke-depth').fill('3');await page.waitForTimeout(200);assert(await page.locator('#yoke-apply').isDisabled());assert.match(await page.locator('#yoke-error').textContent(),/ヨーク丈/);
 await page.locator('#yoke-depth').fill('32');await page.waitForTimeout(200);assert(await page.locator('#yoke-apply').isEnabled());r=await result();
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});const b=await page.locator('#yoke-apply').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
 await page.setViewportSize({width:390,height:844});
 await page.locator('#yoke-apply').click();
 const p=await read(),neck=Number(r['首の作り目'].match(/^\d+/)[0]);
 assert.equal(p.topDown,true);assert.match(p.name,new RegExp(`^丸ヨーク ${neck}目→`));
 assert(p.symbols.flat().includes('M1R')&&p.symbols.flat().includes('M1L'));assert.match(p.notes[String(p.rows)],new RegExp(`作り目${neck}目`));assert.match(p.notes['1'],/前身頃/);
 assert.match(await page.locator('#choose-row').textContent(),new RegExp(`^1\\s*/\\s*${p.rows}`));
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#yoke-open').isDisabled());
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS round yoke from gauge and size: visible inputs, presets, fit, custom measurements, validation, split, mirrored increases, notes, counter, lock');
}finally{await browser.close();}
