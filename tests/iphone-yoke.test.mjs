import test from 'node:test';import assert from 'node:assert/strict';
import {yokePattern,yokePlan,yokeStitches} from '../docs/iphone/app/yoke-model.mjs';
import * as M from '../docs/iphone/app/model.mjs';
const roundTrip=p=>M.validate(JSON.parse(JSON.stringify(p)));

test('96 to 288 stitches in 12 repeats: four even increase rounds, symbols on exactly the new stitches',()=>{
 const p=yokePattern({neck:96,bottom:288,repeats:12,rows:40,rounds:4});
 assert.equal(p.topDown,true);assert.equal(p.horizontalRepeats,12);assert.equal(p.columns,24);assert.equal(p.rows,40);
 const counts=Array.from({length:40},(_,i)=>yokeStitches(p,i+1));
 assert.equal(counts[0],96);assert.equal(counts[39],288);
 const changes=counts.flatMap((c,i)=>i&&c!==counts[i-1]?[[i+1,c-counts[i-1]]]:[]);
 assert.deepEqual(changes,[[8,48],[16,48],[24,48],[32,48]]);
 // Symbols: one per added stitch, only on increase rows (knitting order), all M1L.
 const symbolRows={};for(let r=0;r<p.rows;r++)for(let x=0;x<p.columns;x++)if(p.symbols?.[r]?.[x]){const row=p.rows-r;symbolRows[row]=(symbolRows[row]||0)+1;assert.equal(p.symbols[r][x],'M1L');}
 assert.deepEqual(symbolRows,{8:4,16:4,24:4,32:4});
 assert.match(p.notes[40+1-8],/1模様に4目（全体で48目）/);assert.equal(Object.keys(p.notes).length,4);
 assert.deepEqual(roundTrip(p).cells,p.cells);assert.deepEqual(roundTrip(p).symbols,p.symbols);});

test('uneven increases are spread over rounds and every repeat stays identical',()=>{
 const p=yokePattern({neck:100,bottom:270,repeats:10,rows:30,rounds:3,symbol:'KFB'});
 const counts=Array.from({length:30},(_,i)=>yokeStitches(p,i+1));assert.equal(counts[0],100);assert.equal(counts[29],270);
 assert.deepEqual(yokePlan({neck:100,bottom:270,repeats:10,rows:30,rounds:3}).steps.map(s=>s.perRepeat),[5,6,6]);
 for(let r=0;r<p.rows;r++)for(let x=0;x<M.totalColumns(p);x++)assert.equal(M.colorAt(p,x,r),M.colorAt(p,x%p.columns,r));});

test('painting a stitch in one repeat changes it all the way round; no-stitch slots cannot be painted',()=>{
 const p=yokePattern({neck:64,bottom:192,repeats:16,rows:24,rounds:2}),r=0; // r=0 is the last (widest) row in storage order
 M.paint(p,1,r,2);for(let k=0;k<16;k++)assert.equal(M.colorAt(p,1+k*p.columns,r),2);
 const neckRow=p.rows-1,slot=p.cells[neckRow].indexOf(null);assert(slot>0,'neck row has empty slots');M.paint(p,slot,neckRow,2);assert.equal(p.cells[neckRow][slot],null);});

test('row counter and progress work top-down from the neck',()=>{
 const p=yokePattern({neck:96,bottom:288,repeats:12,rows:40,rounds:4});
 assert.equal(M.rowNumber(p,p.currentRow),1);M.complete(p);assert.equal(M.rowNumber(p,p.currentRow),2);assert.deepEqual(p.completedRows.map(r=>M.rowNumber(p,r)),[1]);
 for(let i=1;i<7;i++)M.complete(p);assert.equal(M.rowNumber(p,p.currentRow),8);assert.match(p.notes[p.currentRow],/増し目の段/,'the increase note is on knitting row 8');});

test('invalid plans explain what to change',()=>{
 const bad=o=>()=>yokePattern({neck:96,bottom:288,repeats:12,rows:40,rounds:4,...o});
 assert.throws(bad({repeats:10}),/割り切れる/);assert.throws(bad({bottom:90}),/首回りより多く/);
 assert.throws(bad({rounds:17}),/16回以下/);assert.throws(bad({rows:3}),/4〜200/);assert.throws(bad({repeats:1,bottom:2000,neck:96}),/200目まで/);
 assert.throws(bad({symbol:'XX'}),/記号/);});

test('horizontal repeats up to 40 are accepted, beyond that refused',()=>{
 const p=M.blank(4,4);M.repeats(p,40,1);assert.equal(M.totalColumns(p),160);assert.equal(roundTrip(p).horizontalRepeats,40);
 assert.throws(()=>M.repeats(p,41,1));});
