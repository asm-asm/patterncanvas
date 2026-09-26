import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {blank} from '../docs/iphone/app/model.mjs';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const getPurchaseStatus=async(options={})=>{if(!window.statusStarted){window.statusStarted=true;window.statusInFlight=true;await new Promise(r=>setTimeout(r,1500));window.statusInFlight=false;}if(options.loadProducts)window.loadedProducts=[{id:'jp.amimononote.ios.trial7',price:'¥0',isFree:true},{id:'jp.amimononote.ios.lifetime',price:'¥3,000',isFree:false}];return {...window.purchaseFixture,now:Date.now(),products:window.loadedProducts||[]};};
export const purchaseProduct=async id=>{if(window.purchaseAction==='error')throw Error('購入できません');if(['pending','cancelled'].includes(window.purchaseAction))return {...await getPurchaseStatus(),action:window.purchaseAction};window.purchaseFixture={state:id.endsWith('trial7')?'trial':'purchased',expiresAt:Date.now()+604800000,canPurchase:!id.endsWith('lifetime')};return getPurchaseStatus();};
export const restorePurchases=async()=>{window.purchaseFixture={state:'legacy',canPurchase:false};return getPurchaseStatus();};
export const onPurchaseChange=fn=>{window.purchaseChanged=fn;};
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>{localStorage.setItem('patterncanvas-iphone-v1',data);window.nativeSaves=(window.nativeSaves||0)+1;};
export const readLock=()=>localStorage.getItem('native-lock')==='true';
export const writeLock=value=>localStorage.setItem('native-lock',String(value));
export const rowCompleted=()=>window.haptics=(window.haptics||0)+1;
export const exportProject=async(data,name)=>{window.shared={data,name};};
export const prepareOffline=()=>document.querySelector('#offline-state').textContent='初回からオフラインで使えます';
`}));
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175')&&!r.url().startsWith('blob:http://127.0.0.1:4175/'))remote.push(r.url());});
await context.addInitScript(()=>{window.purchaseFixture={state:'notStarted',canPurchase:true};});
try{
 await page.goto('http://127.0.0.1:4175/');await page.waitForFunction(()=>window.statusInFlight);assert(await page.locator('#complete').isDisabled());
 await page.evaluate(async()=>{const access=await import('./purchase-access.mjs');access.openPurchase();});await page.waitForFunction(()=>!document.querySelector('#purchase-trial').disabled);
 for(const [width,height]of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});for(const id of ['purchase-trial','purchase-full','purchase-restore']){const b=await page.locator('#'+id).boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}}
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.purchaseAction='cancelled');await page.locator('#purchase-trial').click();assert(await page.locator('#complete').isDisabled());
 await page.evaluate(()=>window.purchaseAction='pending');await page.locator('#purchase-full').click();assert(await page.locator('#complete').isDisabled());
 await page.evaluate(()=>window.purchaseAction='error');await page.locator('#purchase-full').click();assert(await page.locator('#complete').isDisabled());
 await page.evaluate(()=>window.purchaseAction='');await page.locator('#purchase-trial').click();await page.waitForFunction(()=>!document.querySelector('#complete').disabled);await page.locator('#purchase-close').click();
 await page.locator('#complete').click();const before=await page.evaluate(()=>localStorage.getItem('patterncanvas-iphone-v1'));assert.equal(JSON.parse(before).currentRow,2);
 await page.evaluate(()=>{window.purchaseFixture={state:'trial',expiresAt:Date.now()+500,canPurchase:true};window.purchaseChanged({...window.purchaseFixture,now:Date.now(),products:[]});});
 await page.waitForFunction(()=>document.querySelector('#complete').disabled);await page.locator('[data-view=chart]').click();await page.locator('#chart').click({position:{x:95,y:70}});assert.equal(await page.evaluate(()=>localStorage.getItem('patterncanvas-iphone-v1')),before);
 await page.locator('[data-view=settings]').click();assert(await page.locator('#add-color').isDisabled());assert(await page.locator('#text-open').isDisabled());assert(await page.locator('#padding-open').isDisabled());await page.locator('#export').click();assert.deepEqual(JSON.parse((await page.evaluate(()=>window.shared)).data).cells,JSON.parse(before).cells);
 await page.locator('#purchase-open').click();await page.waitForFunction(()=>!document.querySelector('#purchase-full').disabled);await page.locator('#purchase-full').click();await page.locator('#purchase-close').click();assert.equal(await page.locator('#name').isDisabled(),false);
 await page.locator('#purchase-open').click();await page.locator('#purchase-restore').click();assert((await page.locator('#purchase-status').textContent()).includes('購入済み'));assert(await page.locator('#purchase-full').isHidden());await page.locator('#purchase-close').click();
 await page.evaluate(()=>window.purchaseChanged({state:'unavailable',canPurchase:false,products:[]}));await page.locator('#purchase-open').click();await page.evaluate(()=>{window.purchaseFixture={state:'unavailable',canPurchase:false};});await page.locator('#purchase-refresh').click();assert(await page.locator('#purchase-full').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS trial start/expiry, cancel/pending/error, lifetime, legacy restoration, uncertainty, data retention/export and responsive purchase screen');
}finally{await browser.close();}
