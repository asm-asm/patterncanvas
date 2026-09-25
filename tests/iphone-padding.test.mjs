import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/iphone/app/model.mjs';
test('padding preserves imported motif in every repeat with exact gap stitches',()=>{
 const p=M.quantize(new Uint8ClampedArray([255,0,0,255,0,0,255,255,0,255,0,255,255,255,255,255]),2,2,4);
 const original=M.clone(p);M.repeats(p,3,2);p.currentRow=3;p.completedRows=[1,4];p.notes={3:'糸替え'};
 M.setSymbol(p,1,0,'M1L');M.padPattern(p,{left:1,right:2,bottom:2,top:1,color:p.yarns[0].id});
 assert.equal(M.totalColumns(p),15);assert.equal(M.totalRows(p),10);
 for(let r=0;r<10;r++)for(let x=0;x<15;x++){
  const xx=x%5,rr=r%5;
  assert.equal(M.colorAt(p,x,r),xx>=1&&xx<3&&rr>=2&&rr<4?original.cells[rr-2][xx-1]:p.yarns[0].id);
  assert.equal(M.symbolAt(p,x,r),xx===2&&rr===2?'M1L':null);
 }
 assert.equal(p.currentRow,8);assert.deepEqual(p.completedRows,[3,9]);assert.deepEqual(p.notes,{8:'糸替え'});
 assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);
});
test('padding limits fail atomically, blank rows stay incomplete, top-down position retained',()=>{
 const p=M.blank(200,200);M.repeats(p,10,10);const before=M.clone(p);
 for(const a of [{left:1,right:0,top:0,bottom:0,color:0},{left:-1,right:0,top:0,bottom:0,color:0},{left:0,right:0,top:0,bottom:0,color:0}]){assert.throws(()=>M.padPattern(p,a));assert.deepEqual(p,before);}
 const q=M.blank(2,2);q.topDown=true;q.currentRow=2;q.completedRows=[2];
 M.padPattern(q,{left:0,right:0,bottom:1,top:2,color:1});assert.equal(q.currentRow,3);assert.equal(M.rowNumber(q,q.currentRow),3);assert.deepEqual(q.completedRows,[3]);
});
