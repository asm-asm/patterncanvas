import test from 'node:test';import assert from 'node:assert/strict';
import {yokePattern,yokeDesign,yokeSchedule,yokeSize,yokeStitches,YOKE_SIZE_NAMES} from '../docs/iphone/app/yoke-model.mjs';
import * as M from '../docs/iphone/app/model.mjs';
const roundTrip=p=>M.validate(JSON.parse(JSON.stringify(p)));
const knitRow=(p,r)=>p.rows-r; // stored index of knitting row r (top-down)

test('worsted relaxed M: neck, yoke, split and gauge-based counts are consistent',()=>{
 const {design:d}=yokePattern({gaugeSts:18,gaugeRows:26,chest:118,arm:36,neck:50,depth:30});
 assert.equal(d.body,212);assert.equal(d.underarm,16,'about 8% of the body');assert.equal(d.rows,78);
 assert.equal(d.neckSts,d.repeats*d.w0);assert.equal(d.yokeSts,d.repeats*d.w1);assert.equal((d.w1-d.w0)%2,0,'mirrored pairs');
 assert(Math.abs(d.neckCm-50)<=3,'neck within 3 cm');
 const s=d.split;assert.equal(s.back+s.front+2*s.sleeve,d.yokeSts,'every yoke stitch goes to body or sleeves');assert.equal(s.body,212,'body keeps the chest size');});

test('chart: centre block live at the neck, mirrored edge increases with M1R left and M1L right, no shifting',()=>{
 const {pattern:p,design:d,schedule}=yokePattern({gaugeSts:22,gaugeRows:30,...yokeSize('M')});
 const row1=p.cells[knitRow(p,1)],live=row1.map(c=>c!==null),first=live.indexOf(true),last=live.lastIndexOf(true);
 assert.equal(live.filter(Boolean).length,d.w0);assert.equal(first,p.columns-1-last,'centre block');
 for(let x=0;x<p.columns;x++){let seen=false;for(let r=1;r<=p.rows;r++){const on=p.cells[knitRow(p,r)][x]!==null;if(seen)assert(on,'a column never loses its stitch');seen||=on;}}
 const L=[],R=[];for(let i=0;i<p.rows;i++)p.symbols[i].forEach((s,x)=>{if(s==='M1R')L.push(x);if(s==='M1L')R.push(x);});
 assert.equal(L.length,schedule.length);assert.deepEqual(L.map(x=>p.columns-1-x).sort((a,b)=>a-b),[...R].sort((a,b)=>a-b),'mirrored');
 assert(L.every(x=>x<p.columns/2)&&R.every(x=>x>=p.columns/2));
 assert.equal(yokeStitches(p,1),d.neckSts);assert.equal(yokeStitches(p,p.rows),d.yokeSts);
 assert.deepEqual(roundTrip(p).cells,p.cells);assert.deepEqual(roundTrip(p).symbols,p.symbols);});

test('increases are denser near the neck and finish before the split',()=>{
 const at=yokeSchedule(90,10),gaps=at.slice(1).map((r,i)=>r-at[i]);
 assert(at[0]<=5);assert(at.at(-1)<=Math.round(90*.85));assert(gaps[0]<gaps.at(-1),'gaps grow');assert.equal(new Set(at).size,10);
 assert.throws(()=>yokeSchedule(10,12),/増し目が多すぎ/);});

test('notes carry the cast-on, increase rows and the body/sleeve split; counter starts at the neck',()=>{
 const {pattern:p,design:d,schedule}=yokePattern({gaugeSts:22,gaugeRows:30,...yokeSize('L','relaxed')});
 assert.match(p.notes[p.rows],new RegExp(`作り目${d.neckSts}目`));assert.match(p.notes[1],/後ろ身頃\d+目、袖\d+目（休み目）、前身頃\d+目/);
 for(const r of schedule)assert.match(p.notes[p.rows+1-r],/増し目の段/);
 assert.equal(M.rowNumber(p,p.currentRow),1);M.complete(p);assert.equal(M.rowNumber(p,p.currentRow),2);});

test('painting one repeat repeats all the way round; empty slots cannot be painted',()=>{
 const {pattern:p}=yokePattern({gaugeSts:22,gaugeRows:30,...yokeSize('S')}),r=0;M.paint(p,0,r,2);
 for(let k=0;k<p.horizontalRepeats;k++)assert.equal(M.colorAt(p,k*p.columns,r),2);
 const top=knitRow(p,1);M.paint(p,0,top,2);assert.equal(p.cells[top][0],null);});

test('every preset size and fit produces a valid chart',()=>{
 for(const fit of ['standard','relaxed'])for(const n of YOKE_SIZE_NAMES)for(const [gs,gr] of [[18,26],[22,30],[28,36]]){
  const {pattern:p,design:d}=yokePattern({gaugeSts:gs,gaugeRows:gr,...yokeSize(n,fit)});roundTrip(p);
  assert(d.repeats>=4&&d.repeats<=40&&p.horizontalRepeats===d.repeats,`${fit} ${n} ${gs}`);assert(d.yokeSts>d.neckSts*1.6);}});

test('invalid inputs explain what to change',()=>{
 const base={gaugeSts:22,gaugeRows:30,chest:100,arm:32,neck:50,depth:22};
 assert.throws(()=>yokeDesign({...base,gaugeSts:3}),/ゲージの目数/);assert.throws(()=>yokeDesign({...base,neck:80,chest:60,arm:16}),/小さすぎ|二の腕/);
 assert.throws(()=>yokeDesign({...base,depth:2}),/ヨーク丈/);assert.throws(()=>yokeSize('XXL'),/サイズ/);});

test('horizontal repeats up to 40 are accepted, beyond that refused',()=>{
 const p=M.blank(4,4);M.repeats(p,40,1);assert.equal(M.totalColumns(p),160);assert.equal(roundTrip(p).horizontalRepeats,40);
 assert.throws(()=>M.repeats(p,41,1));});
