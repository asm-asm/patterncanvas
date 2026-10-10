import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/platform.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
export const native=true;
export const getPurchaseStatus=async()=>({state:'purchased',products:[],now:Date.now()});
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>{localStorage.setItem('patterncanvas-iphone-v1',data);window.nativeSaves=(window.nativeSaves||0)+1;};
export const readLock=()=>localStorage.getItem('native-lock')==='true';
export const writeLock=value=>localStorage.setItem('native-lock',String(value));
export const rowCompleted=()=>window.haptics=(window.haptics||0)+1;
export const exportProject=async(data,name)=>{window.shared={data,name};};
export const prepareOffline=()=>document.querySelector('#offline-state').textContent='初回からオフラインで使えます';
`}));
// Synthetic portrait: dark hair and eyes on a light face, mid-tone background, with sensor-like noise.
const W=300,H=400,raw=Buffer.alloc(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const face=Math.hypot((x-150)/80,(y-190)/105)<1,hair=!face&&Math.hypot((x-150)/100,(y-170)/125)<1,eye=face&&Math.abs(y-175)<14&&(Math.abs(x-115)<20||Math.abs(x-185)<20);
 const v=Math.max(0,Math.min(255,(eye?45:face?205:hair?35:135)+((x*31+y*17)%23)-11)),i=(y*W+x)*3;raw[i]=v;raw[i+1]=v*.95;raw[i+2]=v*.9;}
const photo=await sharp(raw,{raw:{width:W,height:H,channels:3}}).jpeg().toBuffer();
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175')&&!r.url().startsWith('blob:http://127.0.0.1:4175/')&&!r.url().startsWith('data:'))remote.push(r.url());});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();
 await page.locator('#photo-file').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:photo});
 await page.locator('#photo-dialog').waitFor();await page.locator('#photo-apply:not([disabled])').waitFor();
 assert.match(await page.locator('#photo-info').textContent(),/^38目 × 50段・3色。/,'standard size keeps the 3:4 photo aspect');
 assert.equal(await page.locator('#photo-levels [data-levels="3"]').getAttribute('aria-pressed'),'true');
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});
  const box=await page.locator('#photo-apply').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
 }
 await page.setViewportSize({width:390,height:844});
 // Two colours: the middle yarn disappears from the form and from the result.
 await page.locator('#photo-levels [data-levels="2"]').click();await page.waitForTimeout(250);
 assert.equal(await page.locator('#photo-color-1-label').isHidden(),true);assert.match(await page.locator('#photo-info').textContent(),/2色/);
 await page.locator('#photo-sizes button').first().click();await page.waitForTimeout(250);assert.match(await page.locator('#photo-info').textContent(),/^23目 × 30段/);
 await page.locator('#photo-width').fill('3');await page.waitForTimeout(250);assert(await page.locator('#photo-apply').isDisabled());assert.match(await page.locator('#photo-error').textContent(),/4〜200/);
 await page.locator('#photo-width').fill('30');await page.locator('#photo-height').fill('40');await page.locator('#photo-cleanup').fill('2');await page.waitForTimeout(250);
 assert.match(await page.locator('#photo-info').textContent(),/1目だけの点はありません/);
 await page.locator('#photo-apply').click();
 const made=await read();assert.equal(made.columns,30);assert.equal(made.rows,40);assert.equal(made.name,'写真からの編み図');
 assert.deepEqual(made.yarns.map(y=>y.name),['明るい色','暗い色']);assert.deepEqual([...new Set(made.cells.flat())].sort(),[0,1]);
 // Raster row 175px of 400 -> chart row from the bottom; eyes are dark, cheeks light.
 const eyeRow=made.rows-1-Math.floor(175/400*40);assert.equal(made.cells[eyeRow][Math.floor(115/300*30)],1);assert.equal(made.cells[made.rows-1-Math.floor(230/400*40)][15],0);
 // Settings persist; cancelling a second import leaves the project untouched.
 await page.reload();await page.locator('#chart').waitFor();await page.locator('[data-view=settings]').click();
 await page.locator('#photo-file').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:photo});await page.locator('#photo-apply:not([disabled])').waitFor();
 assert.equal(await page.locator('#photo-levels [data-levels="2"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#photo-cleanup').inputValue(),'2');
 await page.locator('#photo-dismiss').click();assert.deepEqual((await read()).cells,made.cells);
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#photo-file').isDisabled());
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('PASS photo to 2-3 tone chart, sizes, validation, cleanup, persistence, cancel, lock, no network');
}finally{await browser.close();}
