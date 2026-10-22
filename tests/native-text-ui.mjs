import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {blank} from '../docs/iphone/app/model.mjs';
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
const page=await context.newPage(),errors=[],remote=[];page.on('dialog',d=>d.accept(d.type()==='prompt'?'お気に入りの毛糸 20番':undefined));page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175')&&!r.url().startsWith('blob:http://127.0.0.1:4175/'))remote.push(r.url());});
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('#chart').waitFor();
 await page.locator('[data-view=settings]').click();await page.locator('#text-open').click();
 await page.locator('#text-content').fill('あみ\nLOVE');
 assert.equal(await page.locator('#text-apply').isEnabled(),true);
 for(const [width,height] of [[320,568],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});
  const box=await page.locator('#text-apply').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#text-apply').click();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
 const made=await read();assert.equal(made.columns,64);assert.equal(made.rows,32);assert.deepEqual([...new Set(made.cells.flat())].sort(),[0,1]);
 await page.locator('[data-view=settings]').click();await page.getByRole('button',{name:'名前を変更',exact:true}).nth(1).click();
 const named=await read();assert.equal(named.yarns[1].name,'お気に入りの毛糸 20番');assert.deepEqual(named.cells,made.cells);
 await page.reload();await page.locator('#yarn-list button').first().waitFor();assert.equal((await read()).yarns[1].name,'お気に入りの毛糸 20番');
 await page.locator('[data-view=settings]').click();await page.locator('#text-open').click();await page.locator('#text-cancel').click();assert.deepEqual((await read()).cells,made.cells);
 // Typefaces: every bundled face loads from the app itself; pixel faces come out as whole k×k blocks of stitches.
 await page.locator('#text-open').click();
 const fonts=await page.$$eval('#text-font option',o=>o.map(x=>x.value));assert.deepEqual(fonts,['system','misaki','pixelmplus','zenmaru','dela','yusei','pacifico']);
 const settle=()=>page.waitForFunction(()=>!/読み込んでいます/.test(document.querySelector('#text-error').textContent));
 const grid=()=>page.evaluate(()=>{const c=document.querySelector('#text-preview'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,first=[d[0],d[1],d[2]].join();return Array.from({length:c.width*c.height},(_,i)=>[d[i*4],d[i*4+1],d[i*4+2]].join()!==first);});
 await page.locator('#text-content').fill('ねこ');
 const masks={};
 for(const font of fonts){await page.selectOption('#text-font',font);await settle();assert(await page.locator('#text-apply').isEnabled(),font);masks[font]=JSON.stringify(await grid());}
 assert.equal(new Set(Object.values(masks)).size,fonts.length,'each typeface draws differently');
 await page.selectOption('#text-font','misaki');await page.locator('#text-width').fill('48');await page.locator('#text-height').fill('24');await settle();
 const dots=await grid(),k=3;let ink=0;
 for(let y=0;y<24;y++)for(let x=0;x<48;x++){ink+=dots[y*48+x];}
 assert(ink>0);
 const on=dots.flatMap((v,i)=>v?[i]:[]),ox=Math.min(...on.map(i=>i%48)),oy=Math.min(...on.map(i=>Math.floor(i/48)));
 for(let y=oy;y<24;y++)for(let x=ox;x<48;x++){const bx=x-(x-ox)%k,by=y-(y-oy)%k;assert.equal(dots[y*48+x],dots[by*48+bx],`misaki dot at ${x},${y} is not a whole ${k}×${k} block`);}
 await page.locator('#text-width').fill('8');await page.locator('#text-height').fill('8');await settle();
 assert.match(await page.textContent('#text-error'),/以上が必要です/);assert(await page.locator('#text-apply').isDisabled());
 await page.locator('#text-width').fill('64');await page.locator('#text-height').fill('32');await settle();
 await page.locator('#text-cancel').click();await page.reload();await page.locator('#yarn-list button').first().waitFor();
 await page.locator('[data-view=settings]').click();await page.locator('#text-open').click();assert.equal(await page.inputValue('#text-font'),'misaki','last typeface is remembered');
 await page.locator('#text-cancel').click();assert.deepEqual((await read()).cells,made.cells);
 assert.deepEqual(remote,[],'fonts come from the app, not the network');
 await page.locator('[data-view=chart]').click();await page.locator('#chart-lock').click();await page.locator('[data-view=settings]').click();assert(await page.locator('#text-open').isDisabled());assert(await page.getByRole('button',{name:'名前を変更',exact:true}).first().isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS text generation, typefaces (pixel blocks, remembered, offline), responsive dialog, yarn rename, persistence, cancel, lock');
}finally{await browser.close();}
