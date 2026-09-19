import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/iphone/app/model.mjs';
test('flat knitting alternates by logical row in both directions and across odd repeats',()=>{
 for(const topDown of [false,true])for(const startWrongSide of [false,true]){
  const p=M.blank(4,3);p.verticalRepeats=2;p.flatKnitting=true;p.startWrongSide=startWrongSide;M.changeDirection(p,topDown);
  const cells=M.clone(p.cells);
  for(let n=1;n<=6;n++){
   assert.equal(M.rowNumber(p,p.currentRow),n);
   assert.equal(M.knittingSide(p).wrongSide,startWrongSide!==(n%2===0));
   assert.equal(M.knittingSide(p).numberFromRight,!M.knittingSide(p).wrongSide);
   M.complete(p);
  }
  assert.equal(M.rowNumber(p,p.currentRow),6);M.previous(p);assert.equal(M.rowNumber(p,p.currentRow),6);M.previous(p);assert.equal(M.rowNumber(p,p.currentRow),5);
  M.selectRow(p,M.physicalRow(p,2));assert.equal(M.knittingSide(p).wrongSide,!startWrongSide);
  assert.deepEqual(p.cells,cells);
 }
});
test('flat settings survive validation, symbols, shaping and legacy projects',()=>{
 const p=M.blank(4,4);p.flatKnitting=true;p.startWrongSide=true;M.setSymbol(p,0,1,'M1LP');
 const restored=M.validate(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored,p);
 M.editInKnittingOrder(restored,'stitches',{fromRow:2,action:'add',count:1,edge:'right',color:0,symbol:'M1R'});
 assert.equal(restored.flatKnitting,true);assert.equal(restored.startWrongSide,true);assert.equal(M.symbolAt(restored,0,1),'M1LP');
 const old=M.blank();delete old.flatKnitting;delete old.startWrongSide;assert.equal(M.validate(old).flatKnitting,false);
 for(const key of ['flatKnitting','startWrongSide'])assert.throws(()=>M.validate({...p,[key]:'true'}));
});

test('automatic rails alternate while cell colors, symbols and viewport stay fixed',async()=>{
 const {draw}=await import('../docs/iphone/app/draw.mjs');const p=M.blank(3,2);p.cells=[[0,1,2],[3,2,1]];p.flatKnitting=true;M.setSymbol(p,0,1,'M1LP');
 const labels=[],fills=[];const ctx=new Proxy({fillRect(x,y,w,h){if(w===24&&h===24)fills.push([x,y,this.fillStyle]);},fillText(text,x,y){labels.push({text,x,y});}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={width:0,height:0,getBoundingClientRect:()=>({width:400,height:200}),getContext:()=>ctx};const view={cell:24,x:72,y:28};globalThis.devicePixelRatio=1;
 try{
  draw(canvas,p,view);const before=M.clone(fills),position=M.clone(view);
  for(const y of [14,186])assert.deepEqual(labels.filter(l=>l.y===y&&l.text!=='目').map(l=>l.text),['3','2','1']);
  M.complete(p);labels.length=0;fills.length=0;draw(canvas,p,view);
  for(const y of [14,186])assert.deepEqual(labels.filter(l=>l.y===y&&l.text!=='目').map(l=>l.text),['1','2','3']);
  assert.deepEqual(fills,before);assert.deepEqual(view,position);assert(labels.some(l=>l.text==='M1LP'&&l.x===84&&l.y===40));
 }finally{delete globalThis.devicePixelRatio;}
});
