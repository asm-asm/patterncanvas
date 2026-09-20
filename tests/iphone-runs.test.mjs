import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/iphone/app/model.mjs';
test('runs stop at yarn changes, empty stitches and chart edges without altering data',()=>{
 const p=M.blank(7,2);p.format='patterncanvas-web-2';p.cells=[[0,1,1,1,null,1,1],[1,0,0,0,0,0,1]];
 const before=JSON.stringify(p);assert.deepEqual(M.colorRun(p,2,0),{left:1,right:3,row:0,id:1,count:3});assert.equal(M.colorRun(p,4,0),null);assert.equal(M.colorRun(p,6,0).count,2);assert.equal(M.colorRun(p,0,0).count,1);assert.equal(M.colorRun(p,3,1).count,5);
 for(const [x,r] of [[-1,0],[7,0],[0,-1],[0,2],[.5,0]])assert.equal(M.colorRun(p,x,r),null);
 assert.equal(JSON.stringify(p),before);
});
test('runs span repeat seams and ignore symbols and reading direction',()=>{
 const p=M.blank(4,3);p.cells[0]=[1,0,0,1];M.repeats(p,3,2);M.setSymbol(p,3,0,'M1R');
 assert.deepEqual(M.colorRun(p,4,3),{left:3,right:4,row:3,id:1,count:2});assert.equal(M.colorRun(p,8,1).count,12);
 p.flatKnitting=true;p.startWrongSide=true;p.topDown=true;assert.equal(M.colorRun(p,4,3).count,2);
});
