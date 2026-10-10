import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
// First launch welcome (terms shown before the trial starts), last-day reminder and expiry notice, each shown once.
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
const products=[{id:'jp.amimononote.ios.trial7',price:'¥0',isFree:true},{id:'jp.amimononote.ios.lifetime',price:'¥3,000',isFree:false}];
export const getPurchaseStatus=async(options={})=>({...window.purchaseFixture,now:Date.now(),products:options.loadProducts||window.loaded?(window.loaded=true,products):[]});
export const purchaseProduct=async id=>{window.bought=(window.bought||[]).concat(id);window.purchaseFixture=id.endsWith('trial7')?{state:'trial',expiresAt:Date.now()+604800000,canPurchase:true}:{state:'purchased',canPurchase:false};return getPurchaseStatus({loadProducts:true});};
export const restorePurchases=async()=>getPurchaseStatus({loadProducts:true});
export const onPurchaseChange=fn=>{window.purchaseChanged=fn;};
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>localStorage.setItem('patterncanvas-iphone-v1',data);
export const readLock=()=>false;export const writeLock=()=>{};export const rowCompleted=()=>{};export const exportProject=async()=>{};
export const prepareOffline=()=>{};
`}));
await context.addInitScript(()=>{if(!sessionStorage.getItem('fixture'))window.purchaseFixture={state:'notStarted',canPurchase:true};else window.purchaseFixture=JSON.parse(sessionStorage.getItem('fixture'));});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const fixture=f=>page.evaluate(f=>sessionStorage.setItem('fixture',JSON.stringify(f)),f);
try{
 // 1. First launch: welcome states duration, what stops and the price before the trial can start.
 await page.goto('http://127.0.0.1:4175/');await page.locator('#access-dialog[open]').waitFor();
 assert.equal(await page.locator('#access-title').textContent(),'7日間、全機能を無料でお試しください');
 const terms=await page.locator('#access-terms').textContent();for(const t of ['7日間','¥3,000の買い切り','自動で課金されることはなく','閲覧・書き出しは体験後も'])assert(terms.includes(t),t);
 await page.locator('#access-primary:not([disabled])').waitFor();assert.equal(await page.locator('#access-primary').textContent(),'7日間無料で始める');
 for(const [width,height]of [[320,568],[844,390]]){await page.setViewportSize({width,height});const b=await page.locator('#access-primary').boundingBox();assert(b.y>=0&&b.y+b.height<=height,'start button visible');}
 await page.setViewportSize({width:390,height:844});
 await page.locator('#access-primary').click();await page.locator('#access-dialog').waitFor({state:'hidden'});
 assert.deepEqual(await page.evaluate(()=>window.bought),['jp.amimononote.ios.trial7']);assert(await page.locator('#complete').isEnabled());
 // Not shown again the same day once dismissed or started.
 await fixture({state:'notStarted',canPurchase:true});await page.reload();await page.locator('#chart').waitFor();await page.waitForTimeout(1500);assert(await page.locator('#access-dialog').isHidden());
 // 2. Last day reminder, once per trial.
 const expiresAt=Date.now()+5*3600000;await fixture({state:'trial',expiresAt,canPurchase:true});await page.reload();await page.locator('#access-dialog[open]').waitFor();
 assert.match(await page.locator('#access-title').textContent(),/^無料体験は残り約5時間です$/);await page.locator('#access-primary:not([disabled])').waitFor();assert.equal(await page.locator('#access-primary').textContent(),'¥3,000で永久解除');
 await page.locator('#access-later').click();await page.reload();await page.locator('#chart').waitFor();await page.waitForTimeout(1500);assert(await page.locator('#access-dialog').isHidden(),'reminder shown once');
 // 3. Expiry while the app is open: notice appears, editing is disabled, buying from it unlocks.
 await page.evaluate(()=>{window.purchaseFixture={state:'trial',expiresAt:Date.now()-1000,canPurchase:true};window.purchaseChanged({...window.purchaseFixture,now:Date.now(),products:[]});});
 await page.locator('#access-dialog[open]').waitFor();assert.equal(await page.locator('#access-title').textContent(),'無料体験が終了しました');await page.waitForFunction(()=>document.querySelector('#complete').disabled,null,{timeout:3000});
 assert((await page.locator('#access-points').textContent()).includes('作品はそのまま残っています'));
 await page.locator('#access-primary:not([disabled])').waitFor();await page.locator('#access-primary').click();await page.locator('#access-dialog').waitFor({state:'hidden'});
 assert.equal((await page.evaluate(()=>window.bought)).at(-1),'jp.amimononote.ios.lifetime');await page.waitForFunction(()=>!document.querySelector('#complete').disabled,null,{timeout:3000});
 assert.deepEqual(errors,[]);console.log('PASS welcome terms before trial, start from welcome, once-a-day, last-day reminder, expiry notice and unlock');
}finally{await browser.close();}
