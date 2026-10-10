import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {blank} from '../docs/iphone/app/model.mjs';
// The system review request is asked once at the 20th completed row, never in the first minute or right after a purchase sheet.
const browser=await webkit.launch();
async function open(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const getPurchaseStatus=async()=>({state:'purchased',products:[],now:Date.now()});export const onPurchaseChange=()=>{};
export const purchaseProduct=async()=>getPurchaseStatus();export const restorePurchases=async()=>getPurchaseStatus();
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');export const writeProject=d=>localStorage.setItem('patterncanvas-iphone-v1',d);
export const readLock=()=>false;export const writeLock=()=>{};export const rowCompleted=()=>{};export const exportProject=async()=>{};export const prepareOffline=()=>{};
export const requestReview=()=>{window.reviews=(window.reviews||0)+1;localStorage.setItem('reviews',String(window.reviews));};`}));
 const p=blank(8,60);p.name='長い作品';
 await context.addInitScript(d=>{if(!localStorage.getItem('patterncanvas-iphone-v1'))localStorage.setItem('patterncanvas-iphone-v1',d);},JSON.stringify(p));
 await context.clock.install();
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();return {context,page,errors};
}
const reviews=page=>page.evaluate(()=>window.reviews||0);
const complete=async(page,n)=>{for(let i=0;i<n;i++)await page.locator('#complete').click();};
try{
 const {context,page,errors}=await open();
 // Within the first minute the 20th row does not ask; the next completed row after a minute does.
 await complete(page,20);assert.equal(await reviews(page),0,'not right after launch');
 await page.clock.fastForward(61000);
 // Right after closing the purchase sheet: wait.
 await page.evaluate(async()=>{const a=await import('./purchase-access.mjs');a.openPurchase();});await page.locator('#purchase-dialog[open]').waitFor();await page.locator('#purchase-close').click();
 await complete(page,1);assert.equal(await reviews(page),0,'not right after the purchase sheet');
 await page.clock.fastForward(31000);await complete(page,1);assert.equal(await reviews(page),1,'asked once');
 await complete(page,10);assert.equal(await reviews(page),1,'only once');
 // Undo/back does not count, and after a restart it is never asked again.
 await page.locator('#previous').click();await page.reload();await page.locator('#chart').waitFor();await page.clock.fastForward(61000);await complete(page,5);
 assert.equal(await page.evaluate(()=>window.reviews||0),0,'no new request after restart');assert.equal(await page.evaluate(()=>localStorage.getItem('reviews')),'1');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS review request once at 20 completed rows, not in the first minute, not after a purchase sheet, never again');
}finally{await browser.close();}
