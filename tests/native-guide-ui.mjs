import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {blank} from '../docs/iphone/app/model.mjs';
// First run: Nordic sample opens, guide follows the trial sheet, three steps, shown once; existing and purchased users never see it.
const browser=await webkit.launch();
async function run(fixture,setup=()=>{}){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
const products=[{id:'jp.amimononote.ios.trial7',price:'¥0',isFree:true},{id:'jp.amimononote.ios.lifetime',price:'¥3,000',isFree:false}];
export const getPurchaseStatus=async()=>({...window.purchaseFixture,now:Date.now(),products});
export const purchaseProduct=async()=>getPurchaseStatus();export const restorePurchases=async()=>getPurchaseStatus();export const onPurchaseChange=()=>{};
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');export const writeProject=d=>localStorage.setItem('patterncanvas-iphone-v1',d);
export const readLock=()=>false;export const writeLock=()=>{};export const rowCompleted=()=>{};export const exportProject=async()=>{};export const prepareOffline=()=>{};`}));
 await context.addInitScript(f=>{window.purchaseFixture=f;localStorage.setItem('patterncanvas-purchase-notices',JSON.stringify({welcome:new Date().toDateString()}));},fixture);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();return {page,context,errors};
}
try{
 // 1. New install during the trial: sample + guide.
 {const {page,context,errors}=await run({state:'trial',expiresAt:Date.now()+6*86400000,canPurchase:true});
  assert.equal(await page.locator('#project-name').textContent(),'ノルディックの雪の結晶');
  await page.locator('#guide:not([hidden])').waitFor();
  const seen=[];for(let i=0;i<3;i++){seen.push(await page.locator('#guide-title').textContent());assert(await page.locator('.guide-focus').count()>=1,'something is highlighted');
   const b=await page.locator('#guide').boundingBox();assert(b.y>=0&&b.y+b.height<=844,'card on screen');await page.locator('#guide-next').click();}
  assert.deepEqual(seen,['編み図と編み地は、同じ柄','色を選んで、マスをタップ','編めたら「この段を完了」']);
  assert(await page.locator('#guide').isHidden());assert.equal(await page.locator('.guide-focus').count(),0);
  await page.reload();await page.locator('#chart').waitFor();await page.waitForTimeout(1500);assert(await page.locator('#guide').isHidden(),'shown once');
  assert.deepEqual(errors,[]);await context.close();}
 // 2. Before the trial: the trial sheet comes first, the guide only after 「あとで」; skip ends it.
 {const {page,context}=await run({state:'notStarted',canPurchase:true},p=>p.addInitScript(()=>localStorage.removeItem('patterncanvas-purchase-notices')));
  await page.locator('#access-dialog[open]').waitFor();await page.waitForTimeout(1000);assert(await page.locator('#guide').isHidden(),'guide waits for the trial sheet');
  await page.locator('#access-later').click();await page.locator('#guide:not([hidden])').waitFor();
  await page.locator('#guide-skip').click();assert(await page.locator('#guide').isHidden());
  await page.reload();await page.locator('#chart').waitFor();await page.waitForTimeout(1500);assert(await page.locator('#guide').isHidden(),'skip is remembered');await context.close();}
 // 3. Existing user with a saved project: their project, no guide.
 {const mine=blank(10,10);mine.name='わたしの作品';
  const {page,context}=await run({state:'trial',expiresAt:Date.now()+86400000*3,canPurchase:true},p=>p.addInitScript(d=>localStorage.setItem('patterncanvas-iphone-v1',d),JSON.stringify(mine)));
  await page.waitForTimeout(1500);assert.equal(await page.locator('#project-name').textContent(),'わたしの作品');assert(await page.locator('#guide').isHidden());await context.close();}
 // 4. Purchased or legacy user reinstalling: no guide.
 for(const state of ['purchased','legacy']){const {page,context}=await run({state,canPurchase:false});await page.waitForTimeout(1500);assert(await page.locator('#guide').isHidden(),state);await context.close();}
 console.log('PASS Nordic sample, guide after the trial sheet, three steps, once, skip, none for existing/purchased/legacy');
}finally{await browser.close();}
