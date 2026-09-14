import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await webkit.launch();
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const snapshot=id=>page.locator(id).evaluate(c=>({width:c.width,height:c.height,image:c.toDataURL()}));
try{
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:4173')+'/iphone/app/');
 await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await page.locator('[data-tool=pan]').click();
 const canvas=page.locator('#chart');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
 await page.mouse.move(box.x+180,box.y+180);await page.mouse.down();await page.mouse.move(box.x+100,box.y+250,{steps:8});await page.mouse.up();await settle();
 const chart=await snapshot('#chart'),preview=await snapshot('#preview'),zoom=await page.locator('#zoom-label').textContent();
 await page.evaluate(()=>{window.resizeDraws=0;const original=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){window.resizeDraws++;return original.apply(this,args);};});
 for(const height of [760,820,740,844]){await page.setViewportSize({width:390,height});await page.evaluate(()=>{window.scrollBy(0,30);for(let n=0;n<10;n++)window.dispatchEvent(new Event('resize'));});await settle();}
 assert.deepEqual(await snapshot('#chart'),chart,'Toolbar resize must preserve chart pan and pixels');
 assert.deepEqual(await snapshot('#preview'),preview,'Toolbar resize must preserve preview scale and pixels');
 assert.equal(await page.locator('#zoom-label').textContent(),zoom);
 assert.equal(await page.evaluate(()=>window.resizeDraws),0,'No canvas redraw for height-only viewport changes');
 console.log('PASS: height-only resize and scroll preserve pan, zoom, pixels; no redraw');
 await page.locator('[data-view=preview]').click();await settle();const fullPreview=await snapshot('#preview');
 for(const height of [700,900,844]){await page.setViewportSize({width:390,height});await settle();assert.deepEqual(await snapshot('#preview'),fullPreview,'Full preview height must not track Safari toolbar');}
 console.log('PASS: full preview does not stretch when viewport height changes');
 await page.setViewportSize({width:430,height:844});await settle();assert.notEqual((await snapshot('#preview')).width,fullPreview.width);
 assert.equal(await page.locator('#zoom-label').textContent(),zoom);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: actual width change redraws correctly; no script errors');
}finally{await browser.close();}
