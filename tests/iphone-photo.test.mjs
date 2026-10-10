import test from 'node:test';import assert from 'node:assert/strict';import {photoPattern,photoThresholds,isolatedStitches} from '../docs/iphone/app/photo-model.mjs';import {validate} from '../docs/iphone/app/model.mjs';
const gray=values=>new Uint8ClampedArray(values.flatMap(v=>[v,v,v,255]));
const colors2=['#f3ead9','#30483e'],colors3=['#f3ead9','#dba487','#30483e'];
// Dark disc ("head") on a light, noisy background; top raster row first.
const portrait=(w,h,noise)=>{const out=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=Math.hypot(x-w/2,y-h*.42)/(w*.3),base=d<1?50:d<1.25?140:215;out.push(Math.max(0,Math.min(255,base+((x*7+y*13)%5===0?noise:0)-((x*11+y*3)%7===0?noise:0))));}return out;};

test('two tones: dark subject on light ground, bottom-up rows, light yarn first',()=>{const w=20,h=20,p=photoPattern(gray(portrait(w,h,0)),w,h,{levels:2,cleanup:0,colors:colors2});
 assert.deepEqual(p.yarns.map(y=>y.color),colors2);assert.equal(p.yarns[0].name,'明るい色');
 assert.equal(p.cells[h-1][0],0,'top-left raster corner is background');assert.equal(p.cells[h-1-Math.round(h*.42)][w/2],1,'head centre is dark');
 assert.deepEqual(validate(structuredClone(p)).cells,p.cells);});
test('three tones keep a middle band between subject and ground',()=>{const w=24,h=24,p=photoPattern(gray(portrait(w,h,0)),w,h,{levels:3,cleanup:0,colors:colors3}),used=new Set(p.cells.flat());
 assert.deepEqual([...used].sort(),[0,1,2]);assert.equal(p.yarns[1].name,'中間の色');});
test('cleanup removes isolated stitches from noise without losing the subject',()=>{const w=40,h=40,b=gray(portrait(w,h,90)),raw=photoPattern(b,w,h,{levels:2,cleanup:0,colors:colors2}),clean=photoPattern(b,w,h,{levels:2,cleanup:2,colors:colors2});
 assert.ok(isolatedStitches(raw)>20,'noise produces specks');assert.equal(isolatedStitches(clean),0);assert.equal(clean.cells[h-1-Math.round(h*.42)][w/2],1);
 assert.deepEqual(clean.cells,photoPattern(b,w,h,{levels:2,cleanup:2,colors:colors2}).cells,'deterministic');});
test('balance shifts stitches toward the light yarn, and low contrast photos are stretched',()=>{const values=Array.from({length:400},(_,i)=>110+(i%20)*2),b=gray(values);
 const count=bal=>photoPattern(b,20,20,{levels:2,balance:bal,cleanup:0,colors:colors2}).cells.flat().filter(c=>c===0).length;
 assert.ok(count(3)>count(0)&&count(0)>count(-3));assert.ok(count(0)>0&&count(0)<400,'narrow 110-148 range still splits');});
test('scale votes per block; transparency is white; flat images become one yarn',()=>{const big=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)big.push((x+y)%2?0:255);
 const p=photoPattern(gray(big),4,4,{scale:2,levels:2,cleanup:0,colors:colors2});assert.equal(new Set(p.cells.flat()).size,1);
 const clear=new Uint8ClampedArray(4*4*4);const q=photoPattern(clear,4,4,{levels:2,cleanup:0,colors:colors2});assert.deepEqual([...new Set(q.cells.flat())],[0]);});
test('thresholds split a bimodal histogram between its peaks',()=>{const [t]=photoThresholds([...Array(50).fill(40),...Array(50).fill(200)],2);assert.ok(t>40&&t<=200);const [a,c]=photoThresholds([...Array(30).fill(20),...Array(30).fill(128),...Array(30).fill(240)],3);assert.ok(a>20&&a<=128&&c>128&&c<=240);});
test('invalid settings fail with Japanese messages',()=>{const b=gray(Array(16).fill(0));
 assert.throws(()=>photoPattern(b,4,4,{levels:4,colors:colors2}),/2色か3色/);assert.throws(()=>photoPattern(b,4,4,{levels:2,colors:['#ffffff','#FFFFFF']}),/違う色/);
 assert.throws(()=>photoPattern(b,3,4,{levels:2,colors:colors2}),/4〜200/);assert.throws(()=>photoPattern(b,4,4,{levels:2,balance:5,colors:colors2}),/バランス/);assert.throws(()=>photoPattern(b,4,4,{scale:2,levels:2,colors:colors2}),/大きさ/);assert.throws(()=>photoPattern(b,4,4,{levels:2,detail:3,colors:colors2}),/目鼻口/);assert.throws(()=>photoPattern(b,4,4,{levels:2,contrast:4,colors:colors2}),/コントラスト/);});
test('detail emphasis separates a face from a background of the same brightness',()=>{const w=40,h=40,v=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const inFace=Math.hypot(x-20,y-18)<9,eye=inFace&&Math.abs(y-15)<=1&&(Math.abs(x-16)<=1||Math.abs(x-24)<=1),dark=x<6||x>=34;v.push(eye?60:inFace?185:dark?20:175);}
 const eyes=p=>[[16,15],[24,15]].every(([x,y])=>p.cells[h-1-y][x]===1);
 assert.ok(eyes(photoPattern(gray(v),w,h,{levels:2,detail:1,colors:colors2})),'eyes stay dark with emphasis');});
test('thin dark features (a mouth line) survive shrinking with eye/nose/mouth emphasis',()=>{const w=20,h=20,k=4;
 // Light face on a mid background with a dark line `thick` source pixels tall inside one stitch row (row of pixels 52..).
 const face=thick=>{const v=[];for(let y=0;y<h*k;y++)for(let x=0;x<w*k;x++){const f=Math.hypot(x-40,y-40)<30,m=f&&y>=52&&y<52+thick&&Math.abs(x-40)<14;v.push(m?25:f?215:120);}return gray(v);};
 const row=h-1-13,mouth=(thick,detail)=>{const p=photoPattern(face(thick),w,h,{scale:k,levels:3,detail,cleanup:1,colors:colors3});return [8,10,12].every(x=>p.cells[row][x]===2);};
 assert.ok(mouth(2,1),'half-stitch line kept at the default emphasis');assert.ok(mouth(1,2),'quarter-stitch line kept at the strongest emphasis');
 assert.ok(!mouth(1,0),'plain majority vote loses a quarter-stitch line');});
test('higher contrast pushes more stitches to the extremes',()=>{const v=Array.from({length:32*32},(_,i)=>60+Math.round(((i%32)+Math.floor(i/32))/62*140)),b=gray(v);
 const mid=c=>photoPattern(b,32,32,{levels:3,contrast:c,detail:0,cleanup:0,colors:colors3}).cells.flat().filter(t=>t===1).length;
 assert.ok(mid(3)<=mid(0),'mid band does not grow with contrast');});
