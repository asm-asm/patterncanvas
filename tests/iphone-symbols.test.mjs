import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/iphone/app/model.mjs';

test('six increase symbols preserve yarns and dimensions and roundtrip in v3',()=>{
 const p=M.blank(6,2),before=M.clone(p);M.INCREASES.forEach((s,x)=>M.setSymbol(p,x,0,s.code));
 assert.deepEqual(p.cells,before.cells);assert.deepEqual(p.yarns,before.yarns);assert.equal(p.columns,6);
 assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);
 assert.deepEqual(p.symbols[0],['M1L','M1R','M1LP','M1RP','KFB','YO']);
 assert.deepEqual(M.validate(before),before);
});
test('color painting retains symbols; symbol erasing retains color; eraser removes both',()=>{
 const p=M.blank(2,2);M.setSymbol(p,0,0,'M1L');M.paint(p,0,0,2);M.fill(p,0,0,3);assert.equal(M.symbolAt(p,0,0),'M1L');
 M.setSymbol(p,0,0,null);assert.equal(p.cells[0][0],3);assert.equal(M.symbolAt(p,0,0),null);
 M.setSymbol(p,0,0,'YO');M.erase(p,0,0);assert.equal(p.cells[0][0],0);assert.equal(M.symbolAt(p,0,0),null);
});
test('symbols repeat exactly with cells and cannot occupy absent stitches',()=>{
 const p=M.blank(2,2);M.editStitches(p,{fromRow:2,action:'remove',count:1});M.setSymbol(p,1,1,'M1L');assert.equal(M.symbolAt(p,1,1),null);
 M.setSymbol(p,0,0,'M1RP');M.repeats(p,3,2);
 assert.equal(M.expandedSymbols(p).flat().filter(s=>s==='M1RP').length,6);
 for(let r=0;r<4;r++)for(let x=0;x<6;x++)assert.equal(M.symbolAt(p,x,r),p.symbols[r%2][x%2]);
});
test('invalid or incompatible symbol files are rejected without silently dropping marks',()=>{
 const p=M.blank(2,2);M.setSymbol(p,0,0,'KFB');
 for(const mutate of [q=>q.symbols[0][0]='unknown',q=>q.symbols.pop(),q=>q.symbols[0].pop(),q=>q.cells[0][0]=null,q=>delete q.symbols,q=>q.format='patterncanvas-web-2']){const q=M.clone(p);mutate(q);assert.throws(()=>M.validate(q));}
 const before=M.clone(p);assert.throws(()=>M.setSymbol(p,0,0,'bad'));assert.deepEqual(p,before);
});
test('overlapping selection move carries symbols and invalid paste is atomic',()=>{
 const p=M.blank(4,1);M.setSymbol(p,0,0,'M1L');M.setSymbol(p,1,0,'YO');p.cells[0]=[1,2,3,0];
 const sel={x:0,x2:1,r:0,r2:0},data=M.copyRange(p,sel),marks=M.copySymbols(p,sel),before=M.clone(p);
 assert.throws(()=>M.paste(p,data,3,0,sel,marks));assert.deepEqual(p,before);
 M.paste(p,data,1,0,sel,marks);assert.deepEqual(p.symbols[0],[null,'M1L','YO',null]);assert.deepEqual(p.cells[0],[0,1,2,0]);
 M.paste(p,[[3]],1,0);assert.equal(M.symbolAt(p,1,0),null);M.clearRange(p,{x:2,x2:2,r:0,r2:0});assert.equal(M.symbolAt(p,2,0),null);
});
test('editing a horizontal flip exchanges directional symbols; vertical flip moves exact codes',()=>{
 const p=M.blank(4,2);['M1L','M1R','M1LP','M1RP'].forEach((s,x)=>M.setSymbol(p,x,0,s));M.setSymbol(p,0,1,'KFB');M.setSymbol(p,1,1,'YO');
 M.flip(p,true,{x:0,x2:1,r:0,r2:0});assert.deepEqual(p.symbols[0],['M1L','M1R','M1LP','M1RP']);
 const before=M.clone(p);M.flip(p,true);M.flip(p,true);assert.deepEqual(p,before);
 M.flip(p,false);assert.deepEqual(p.symbols[1],before.symbols[0]);assert.equal(p.symbols[0][0],'KFB');
});
test('structural increase marks only its start row, shifts existing marks, and expands repeats',()=>{
 const p=M.blank(2,2);M.setSymbol(p,1,1,'YO');M.repeats(p,3,2);
 const before=M.expandedSymbols(p);M.editInKnittingOrder(p,'stitches',{fromRow:3,action:'add',count:1,edge:'position',position:2,color:2,symbol:'M1L'});
 assert.equal(p.columns,7);assert.equal(p.rows,4);assert.deepEqual(p.symbols[0],[...before[0],null]);
 assert.equal(p.symbols[2][1],'M1L');assert.equal(p.symbols[3][1],null);assert.equal(p.symbols[3][2],'YO');
 assert.equal(M.stitchCount(p,2),6);assert.equal(M.stitchCount(p,3),7);assert.deepEqual(M.validate(p),p);
 M.editInKnittingOrder(p,'stitches',{fromRow:3,action:'remove',count:1,edge:'position',position:2});
 for(let r=0;r<4;r++)assert.deepEqual(p.symbols[r].slice(0,6),before[r]);
});
test('top-down increases keep marks on physical rows and insert rows without cloning instructions',()=>{
 const p=M.blank(2,3);M.setSymbol(p,1,2,'M1R');M.changeDirection(p,true);p.notes={3:'start'};
 M.editInKnittingOrder(p,'stitches',{fromRow:2,action:'add',count:1,symbol:'M1LP'});
 assert.deepEqual(p.symbols,[[null,null,null],[null,null,'M1LP'],[null,'M1R',null]]);
 const before=M.clone(p);M.editInKnittingOrder(p,'rows',{action:'add',position:2,count:1});assert.deepEqual(p.symbols[2],[null,null,null]);
 M.editInKnittingOrder(p,'rows',{action:'remove',position:2,count:1});assert.deepEqual(p,before);
});
test('invalid structural increases preserve symbols as well as colors',()=>{
 const p=M.blank(2000,1);M.setSymbol(p,0,0,'M1L');const before=M.clone(p);
 assert.throws(()=>M.editInKnittingOrder(p,'stitches',{fromRow:1,action:'add',count:1,symbol:'M1R'}));assert.deepEqual(p,before);
});

test('renderer puts symbols on corresponding bottom-up cells without changing their colors',async()=>{
 const {draw}=await import('../docs/iphone/app/draw.mjs'),p=M.blank(2,2);M.setSymbol(p,1,0,'M1R');M.paint(p,1,0,2);M.repeats(p,3,2);
 const labels=[],fills=[];const ctx=new Proxy({fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle});},fillText(text,x,y){labels.push({text,x,y});}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={width:0,height:0,getBoundingClientRect:()=>({width:400,height:200}),getContext:()=>ctx};globalThis.devicePixelRatio=1;
 try{draw(canvas,p,{cell:24,x:72,y:28,numberFromRight:true});
  const marks=labels.filter(l=>l.text==='M1R');assert.equal(marks.length,6);
  assert.deepEqual(marks.at(-1),{text:'M1R',x:72+5.5*24,y:28+3.5*24});
  assert.equal(fills.find(f=>f.x===72+5*24&&f.y===28+3*24&&f.w===24).color,p.yarns[2].color);
 }finally{delete globalThis.devicePixelRatio;}
});
