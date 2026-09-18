import test from 'node:test';import assert from 'node:assert/strict';import * as M from '../docs/iphone/app/model.mjs';
test('One square maps to one stitch; row one stays at bottom',()=>{const p=M.blank(2,3);M.paint(p,1,0,2);assert.equal(M.colorAt(p,1,M.rowAtVisual(p,2)),2);assert.equal(M.colorAt(p,1,M.rowAtVisual(p,0)),0);assert.equal(p.cells.flat().filter(x=>x===2).length,1);});
test('3 × 2 repeats produce exactly six copies',()=>{const p=M.blank(2,3);M.paint(p,1,0,2);M.repeats(p,3,2);assert.equal(M.totalColumns(p),6);assert.equal(M.totalRows(p),6);let n=0;for(let r=0;r<6;r++)for(let x=0;x<6;x++)if(M.colorAt(p,x,r)===2)n++;assert.equal(n,6);});
test('Horizontal and vertical flips, whole chart and selection',()=>{const p=M.blank(2,2);p.cells=[[0,1],[2,3]];M.flip(p,true);assert.deepEqual(p.cells,[[1,0],[3,2]]);M.flip(p,false);assert.deepEqual(p.cells,[[3,2],[1,0]]);M.flip(p,true,{x:0,x2:1,r:0,r2:0});assert.deepEqual(p.cells,[[2,3],[1,0]]);});
test('Selection, completion, return and upper boundary',()=>{const p=M.blank(2,4);p.completedRows=[1,4];M.selectRow(p,3);assert.deepEqual(p.completedRows,[1,4]);M.complete(p);assert.equal(p.currentRow,4);M.previous(p);assert.equal(p.currentRow,4);assert.deepEqual(p.completedRows,[1,3]);M.previous(p);assert.equal(p.currentRow,3);assert.deepEqual(p.completedRows,[1]);M.selectRow(p,999);M.complete(p);assert.equal(p.currentRow,4);});
test('Selection move validates bounds before clearing and supports overlap',()=>{const p=M.blank(4,1);p.cells=[[1,2,3,0]];const s={x:0,x2:1,r:0,r2:0},copy=M.copyRange(p,s);assert.throws(()=>M.paste(p,copy,3,0,s));assert.deepEqual(p.cells,[[1,2,3,0]]);M.paste(p,copy,1,0,s);assert.deepEqual(p.cells,[[0,1,2,0]]);});
test('Flood fill stays within connected color',()=>{const p=M.blank(3,2);p.cells=[[0,1,0],[0,1,0]];M.fill(p,0,0,2);assert.deepEqual(p.cells,[[2,1,0],[2,1,0]]);});
test('Roundtrip preserves all project fields',()=>{const p=M.sample();p.currentRow=3;p.completedRows=[1,2];p.notes={3:'糸を替える'};assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);});
test('Reject unknown colors, bad dimensions and unsafe notes',()=>{const p=M.blank();p.cells[0][0]=77;assert.throws(()=>M.validate(p));const q=M.blank();q.rows=0;assert.throws(()=>M.validate(q));const r=M.blank();r.notes=JSON.parse('{"__proto__":"bad"}');assert.throws(()=>M.validate(r));});
test('Image quantization preserves bottom row orientation and color limit',()=>{const p=M.quantize(new Uint8ClampedArray([255,0,0,255,0,0,255,255]),1,2,2);assert.equal(p.yarns[p.cells[0][0]].color,'#0000ff');assert.equal(p.yarns[p.cells[1][0]].color,'#ff0000');assert.equal(p.yarns.length,2);M.paint(p,0,0,p.cells[1][0]);assert.equal(p.cells[0][0],p.cells[1][0]);});

test('Top-down labels span all repeats without moving stitches, progress or notes',()=>{const p=M.blank(2,3);p.cells=[[0,1],[2,3],[1,2]];M.repeats(p,3,2);p.completedRows=[2,5];p.notes={2:'keep'};const before=M.clone(p);M.changeDirection(p,true);assert.equal(p.currentRow,6);assert.equal(M.rowNumber(p,6),1);assert.deepEqual([6,5,4,3,2,1].map(r=>M.rowNumber(p,r)),[1,2,3,4,5,6]);assert.deepEqual(p.cells,before.cells);assert.deepEqual(p.completedRows,before.completedRows);assert.deepEqual(p.notes,before.notes);for(let y=0;y<6;y++)for(let x=0;x<6;x++)assert.equal(M.colorAt(p,x,M.rowAtVisual(p,y)),M.colorAt(before,x,M.rowAtVisual(before,y)));M.changeDirection(p,false);assert.equal(p.currentRow,1);});
test('Top-down complete and return honor both boundaries and completed selected rows',()=>{const p=M.blank(2,3);M.changeDirection(p,true);M.complete(p);assert.equal(p.currentRow,2);assert.deepEqual(p.completedRows,[3]);M.previous(p);assert.equal(p.currentRow,3);assert.deepEqual(p.completedRows,[]);for(let i=0;i<5;i++)M.previous(p);assert.equal(p.currentRow,3);for(let i=0;i<5;i++)M.complete(p);assert.equal(p.currentRow,1);assert.deepEqual(p.completedRows,[3,2,1]);M.previous(p);assert.equal(p.currentRow,1);assert.deepEqual(p.completedRows,[3,2]);M.selectRow(p,2);M.previous(p);assert.equal(p.currentRow,2);assert.deepEqual(p.completedRows,[3]);});
test('Direction survives JSON roundtrip; legacy files default bottom-up; invalid values rejected',()=>{const p=M.blank(2,3);M.changeDirection(p,true);M.complete(p);p.notes={3:'top'};assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);const old=M.clone(p);delete old.topDown;assert.equal(M.validate(old).topDown,false);for(const value of ['true',1,null])assert.throws(()=>M.validate({...p,topDown:value}));});
test('Single row stays bounded in both directions and row-number jumps preserve notes',()=>{for(const top of [false,true]){const p=M.blank(1,1);M.changeDirection(p,top);M.complete(p);M.previous(p);assert.equal(p.currentRow,1);assert.deepEqual(p.completedRows,[]);}const p=M.blank(1,5);M.changeDirection(p,true);p.notes={4:'second'};M.selectRow(p,M.physicalRow(p,2));assert.equal(p.currentRow,4);assert.equal(M.rowNumber(p,p.currentRow),2);assert.equal(p.notes[p.currentRow],'second');});

// Mirroring is a view transform; repeat coordinates and stitch labels keep identity.
test('chart mirror maps all repeated columns without mutating project', async()=>{
 const {chartColumn,draw}=await import('../docs/iphone/app/draw.mjs');
 const p={columns:3,rows:2,horizontalRepeats:3,verticalRepeats:2,cells:[[0,1,2],[2,null,0]],yarns:[{id:0,color:'#ffffff'},{id:1,color:'#ff0000'},{id:2,color:'#0000ff'}],currentRow:1,completedRows:[],showDividers:true};
 const before=JSON.stringify(p),fills=[],labels=[];
 const ctx=new Proxy({fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle});},fillText(text,x,y){labels.push({text,x,y});}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={width:0,height:0,getBoundingClientRect:()=>({width:400,height:200}),getContext:()=>ctx};
 globalThis.devicePixelRatio=1;
 draw(canvas,p,{cell:24,x:72,y:0,mirrored:true});
 assert.equal(JSON.stringify(p),before);
 assert.deepEqual(labels.filter(l=>l.y===186&&l.text!=='目').map(l=>l.text),['9','8','7','6','5','4','3','2','1']);
 // Top displayed row maps to source row 1, rightmost source column 2 (white).
 assert.equal(fills.find(f=>f.x===72&&f.y===0&&f.w===24).color,'#ffffff');
 for(let x=0;x<9;x++)assert.equal(chartColumn(chartColumn(x,9,true),9,true),x);
 assert.equal(chartColumn(0,9,false),0);
 delete globalThis.devicePixelRatio;
});


test('turning the work preserves visible source stitches, zoom and row at any scroll offset',async()=>{
 const {turnChart,CHART_GUTTER:g}=await import('../docs/iphone/app/draw.mjs');
 for(const columns of [1,3,41,123,500])for(const cell of [10,24,34.56,80])for(const width of [278,343.5,700,1024]){
  const minX=Math.min(g,width-columns*cell);
  for(const x of [g,minX,(g+minX)/2])for(const mirrored of [false,true]){
   const view={x,y:-147.25,cell,mirrored},before={...view};
   const right=Math.min(width,g+columns*cell);
   // Continuous source coordinates at corresponding reflected screen points must match.
   const source=(v,px)=>v.mirrored?columns-(px-v.x)/v.cell:(px-v.x)/v.cell;
   const positions=[g+.01,(g+right)/2,right-.01];
   const expected=positions.map(px=>source(before,px));
   turnChart(view,columns,width);
   positions.forEach((px,i)=>assert(Math.abs(source(view,g+right-px)-expected[i])<1e-9));
   assert.equal(view.y,before.y);assert.equal(view.cell,before.cell);
   assert(view.x>=minX-1e-9&&view.x<=g+1e-9);
   turnChart(view,columns,width);
   assert(Math.abs(view.x-before.x)<1e-9);assert.equal(view.mirrored,before.mirrored);
  }
 }
});
