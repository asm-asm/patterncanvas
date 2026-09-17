import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/iphone/app/model.mjs';

test('increases affect only the specified row and above, with no stitches below added columns',()=>{
  const p=M.blank(3,4);p.cells=[[0,1,2],[1,2,3],[2,3,0],[3,0,1]];
  p.currentRow=3;p.completedRows=[1,2];p.notes={2:'糸替え',3:'増し目'};
  M.editStitches(p,{fromRow:3,action:'add',count:2,color:1});
  assert.deepEqual(p.cells,[[0,1,2,null,null],[1,2,3,null,null],[2,3,0,1,1],[3,0,1,1,1]]);
  assert.equal(M.stitchCount(p,1),3);assert.equal(M.stitchCount(p,3),5);
  assert.equal(p.currentRow,3);assert.deepEqual(p.completedRows,[1,2]);assert.deepEqual(p.notes,{2:'糸替え',3:'増し目'});
  assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);
});
test('decreases preserve lower rows and produce a matching empty preview slot',()=>{
  const p=M.blank(4,3);M.editStitches(p,{fromRow:2,action:'remove',count:1});
  assert.deepEqual(p.cells,[[0,0,0,0],[0,0,0,null],[0,0,0,null]]);
  assert.equal(M.colorAt(p,3,0),0);assert.equal(M.colorAt(p,3,1),null);
  M.paint(p,3,1,1);M.fill(p,3,1,2);assert.equal(p.cells[1][3],null);
  M.clearRange(p,{x:0,x2:3,r:0,r2:2});assert.equal(p.cells[1][3],null);
});
test('left and numbered insert/delete preserve the surrounding colors',()=>{
  const p=M.blank(3,2);p.cells=[[0,1,2],[2,1,0]];
  M.editStitches(p,{fromRow:2,action:'add',count:1,edge:'position',position:2,color:3});
  assert.deepEqual(p.cells[1],[2,3,1,0]);assert.deepEqual(p.cells[0],[0,1,2,null]);
  M.editStitches(p,{fromRow:2,action:'remove',count:1,edge:'left'});
  assert.deepEqual(p.cells[1],[3,1,0,null]);
});
test('repeat expansion changes only the requested displayed rows, not earlier repeats',()=>{
  const p=M.blank(2,2);p.cells=[[1,2],[3,0]];p.horizontalRepeats=3;p.verticalRepeats=2;
  const before=M.expandedCells(p);p.currentRow=3;
  M.editStitches(p,{fromRow:3,action:'add',count:1,color:2});
  assert.equal(p.horizontalRepeats,1);assert.equal(p.verticalRepeats,1);assert.equal(p.rows,4);assert.equal(p.columns,7);
  for(let r=0;r<4;r++)assert.deepEqual(p.cells[r].slice(0,6),before[r]);
  assert.deepEqual(p.cells.map(r=>r[6]),[null,null,2,2]);
});
test('row insertion shifts current row, completed rows and notes with their original pattern',()=>{
  const p=M.blank(2,3);p.cells=[[1,1],[2,2],[3,3]];p.currentRow=2;p.completedRows=[1,2];p.notes={1:'a',2:'b',3:'c'};
  M.editRows(p,{action:'add',position:2,count:2,color:0});
  assert.deepEqual(p.cells,[[1,1],[0,0],[0,0],[2,2],[3,3]]);assert.equal(p.currentRow,4);
  assert.deepEqual(p.completedRows,[1,4]);assert.deepEqual(p.notes,{1:'a',4:'b',5:'c'});
  assert.deepEqual(M.validate(p),p);
});
test('row deletion removes only affected progress and notes; current row stays in range',()=>{
  const p=M.blank(2,4);p.currentRow=4;p.completedRows=[1,2,4];p.notes={1:'keep',2:'remove',4:'remove'};
  M.editRows(p,{action:'remove',position:2,count:3});
  assert.equal(p.rows,1);assert.equal(p.currentRow,1);assert.deepEqual(p.completedRows,[1]);assert.deepEqual(p.notes,{1:'keep'});
});
test('shape-aware row insertion follows neighboring width and flips keep absent stitches',()=>{
  const p=M.blank(3,2);M.editStitches(p,{fromRow:2,action:'remove',count:1});
  M.editRows(p,{action:'add',position:3,count:1,color:2});assert.deepEqual(p.cells[2],[2,2,null]);
  M.flip(p,true);assert.deepEqual(p.cells[2],[null,2,2]);M.flip(p,false);assert.deepEqual(p.cells[0],[null,2,2]);
});
test('invalid structural operations are atomic; size and empty-row limits are enforced',()=>{
  const p=M.blank(2,2),before=M.clone(p);
  assert.throws(()=>M.editStitches(p,{fromRow:1,action:'remove',count:2}));assert.deepEqual(p,before);
  assert.throws(()=>M.editRows(p,{action:'remove',position:1,count:2}));assert.deepEqual(p,before);
  assert.throws(()=>M.editStitches(p,{fromRow:2,action:'add',count:1,edge:'position',position:5}));assert.deepEqual(p,before);
  const wide=M.blank(2000,1),wideBefore=M.clone(wide);assert.throws(()=>M.editStitches(wide,{fromRow:1,action:'add',count:1}));assert.deepEqual(wide,wideBefore);
});
test('legacy files still load and null is accepted only in the new shape format',()=>{
  const p=M.blank(2,2);assert.equal(M.validate(p).format,'patterncanvas-web-1');p.cells[0][0]=null;assert.throws(()=>M.validate(p));
  p.format='patterncanvas-web-2';assert.equal(M.validate(p).cells[0][0],null);
});

test('Top-down shaping follows displayed row numbers while preserving upper pattern',()=>{const p=M.blank(2,3);p.cells=[[0,1],[2,3],[1,2]];M.changeDirection(p,true);M.editInKnittingOrder(p,'stitches',{fromRow:2,action:'add',count:1,color:3});assert.deepEqual(p.cells,[[0,1,3],[2,3,3],[1,2,null]]);assert.equal(p.currentRow,3);assert.equal(M.rowNumber(p,p.currentRow),1);M.editInKnittingOrder(p,'stitches',{fromRow:2,action:'remove',count:1});assert.deepEqual(p.cells,[[0,1,null],[2,3,null],[1,2,null]]);assert.deepEqual(M.validate(p),p);});
test('Top-down insertion and deletion preserve notes and progress across repeats',()=>{const p=M.blank(2,3);p.verticalRepeats=2;M.changeDirection(p,true);p.currentRow=5;p.completedRows=[6];p.notes={6:'first',5:'second'};const before=M.clone(p);M.editInKnittingOrder(p,'rows',{action:'add',position:2,count:2,color:1});assert.equal(M.rowNumber(p,p.currentRow),4);assert.deepEqual(p.notes,{8:'first',5:'second'});M.editInKnittingOrder(p,'rows',{action:'remove',position:2,count:2});assert.deepEqual(p.cells,M.expandedCells(before));assert.deepEqual(p.notes,before.notes);assert.deepEqual(p.completedRows,before.completedRows);const snapshot=M.clone(p);assert.throws(()=>M.editInKnittingOrder(p,'rows',{action:'remove',position:1,count:99}));assert.deepEqual(p,snapshot);});
