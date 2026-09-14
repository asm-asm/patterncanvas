import {webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {blank} from '../docs/iphone/app/model.mjs';
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
await context.addInitScript(p=>{
  if(location.protocol.startsWith('http')&&!localStorage.getItem('patterncanvas-iphone-v1'))localStorage.setItem('patterncanvas-iphone-v1',JSON.stringify(p));
  const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage,text=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='preview')window.stitches=[];if(this.canvas.id==='chart')window.chartLabels=[];return clear.apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(image,x,y,w,h,...args){if(this.canvas.id==='preview')window.stitches.push({x,y,w,h});return draw.call(this,image,x,y,w,h,...args);};
  CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...args){if(this.canvas.id==='chart')window.chartLabels.push({value:String(value),x,y});return text.call(this,value,x,y,...args);};
},blank(4,4));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const project=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('patterncanvas-iphone-v1')));
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function edit(action,row,count,edge='right'){
  await page.locator('#stitch-edit').click();await page.locator('#structure-action').selectOption(action);
  await page.locator('#structure-row').fill(String(row));await page.locator('#structure-count').fill(String(count));
  if(action.endsWith('stitches'))await page.locator('#structure-edge').selectOption(edge);
  await page.locator('#structure-apply').click();await settle();
}
try{
  await page.goto('http://127.0.0.1:4173/iphone/app/');await page.locator('#chart').waitFor();await settle();
  await page.locator('#stitch-edit').click();await page.locator('#structure-row').fill('3');await page.locator('#structure-count').fill('2');
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/stitch-edit-dialog.png',fullPage:true});
  await page.locator('#structure-apply').click();await settle();
  let p=await project();assert.equal(p.columns,6);assert.deepEqual(p.cells.map(r=>r.filter(c=>c!==null).length),[4,4,6,6]);
  const stitches=await page.evaluate(()=>window.stitches);assert.equal(stitches.length,20,'Preview draws exactly the actual stitches, never the absent slots');
  const heights=[...new Set(stitches.map(s=>s.y))].sort((a,b)=>a-b);assert.deepEqual(heights.map(y=>stitches.filter(s=>s.y===y).length),[6,6,4,4],'First knitting rows remain at bottom');
  const labels=await page.evaluate(()=>window.chartLabels.filter(l=>l.y>document.querySelector('#chart').clientHeight-28));
  assert.deepEqual(labels.map(l=>l.value),['目','1','2','3','4','5','6']);
  assert(labels.slice(1).every((l,i)=>l.x===42+(i+.5)*24));
  await page.locator('#chart').screenshot({path:'test-results/shaped-chart.png'});
  await page.locator('#preview').screenshot({path:'test-results/shaped-preview.png'});
  await page.locator('#undo').click();assert.equal((await project()).columns,4);await page.locator('#redo').click();assert.equal((await project()).columns,6);
  await edit('remove-stitches',4,1);assert.deepEqual((await project()).cells.map(r=>r.filter(c=>c!==null).length),[4,4,6,5]);
  await edit('add-rows',2,1);assert.equal((await project()).rows,5);
  await edit('remove-rows',2,1);assert.equal((await project()).rows,4);
  const cells=(await project()).cells;
  // Ruler is read-only even while the pen is active.
  await page.locator('#chart').click({position:{x:54,y:300}});assert.deepEqual((await project()).cells,cells);
  for(let i=0;i<5;i++)await page.locator('#zoom-in').click();
  await page.locator('#chart-lock').click();assert.equal(await page.locator('#chart-lock').getAttribute('aria-pressed'),'true');
  assert(await page.locator('#stitch-edit').isDisabled());assert(await page.locator('#undo').isDisabled());
  await page.locator('#chart').click({position:{x:54,y:15}});
  const rulerX=()=>page.evaluate(()=>window.chartLabels.find(l=>l.value==='2'&&l.y>document.querySelector('#chart').clientHeight-28).x);
  const beforeX=await rulerX();
  const b=await page.locator('#chart').boundingBox();await page.mouse.move(b.x+220,b.y+150);await page.mouse.down();await page.mouse.move(b.x+80,b.y+150,{steps:8});await page.mouse.up();assert.deepEqual((await project()).cells,cells);
  assert((await rulerX())<beforeX,'Locked one-finger pan moves both the chart and its bottom numbers');
  await page.locator('#complete').click();assert.equal((await project()).currentRow,2);
  await page.locator('#memo-open').click();await page.locator('#memo').fill('ロック中のメモ');await page.locator('#memo-save').click();assert.equal((await project()).notes[2],'ロック中のメモ');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#chart-lock').getAttribute('aria-pressed')==='true');assert.equal(await page.locator('#chart-lock').getAttribute('aria-pressed'),'true');assert.deepEqual((await project()).cells,cells);
  await page.screenshot({path:'test-results/chart-locked.png',fullPage:true});
  await page.locator('#chart-lock').click();assert.equal(await page.locator('#stitch-edit').isDisabled(),false);
  await page.locator('#palette button').nth(2).click();await page.locator('#chart').click({position:{x:54,y:12}});assert.notDeepEqual((await project()).cells,cells);
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await settle();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('PASS WebKit: shaping, row edits, exact preview count/orientation, bottom ruler, undo/redo, lock, pan, counter, memo, persistence and widths');
}finally{await browser.close();}
