export const clone = p => JSON.parse(JSON.stringify(p));
export const totalRows = p => p.rows * p.verticalRepeats;
export const totalColumns = p => p.columns * p.horizontalRepeats;
export const colorAt = (p, x, row) => p.cells[row % p.rows][x % p.columns];
export const rowAtVisual = (p, y) => totalRows(p) - 1 - y;
export function blank(columns = 16, rows = 20) {
  return {format:'patterncanvas-web-1', name:'新しい編み図', columns, rows,
    cells:Array.from({length:rows},()=>Array(columns).fill(0)),
    yarns:[{id:0,name:'ミルク',color:'#f3ead9'},{id:1,name:'セージ',color:'#52796b'},{id:2,name:'アプリコット',color:'#dba487'},{id:3,name:'チャコール',color:'#3c4b49'}],
    horizontalRepeats:1,verticalRepeats:1,currentRow:1,completedRows:[],notes:{},showDividers:true,updatedAt:Date.now()};
}
export function sample() {
  const p = blank(12,16); p.name='セージの小さな花';p.horizontalRepeats=3;
  p.cells = Array.from({length:16},(_,r)=>Array.from({length:12},(_,x)=>{
    const d=Math.abs(x-5.5)+Math.abs((r%8)-3.5);
    return d<2 ? 2 : d<4 ? 1 : 0;
  }));return p;
}
export function validate(p) {
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!p||!['patterncanvas-web-1','patterncanvas-web-2'].includes(p.format)||!integer(p.columns,1,1000)||!integer(p.rows,1,1000)||!integer(p.horizontalRepeats,1,10)||!integer(p.verticalRepeats,1,10)||totalRows(p)>1000||totalColumns(p)>1000)throw Error('対応していない作品ファイルです');
  if(typeof p.name!=='string'||p.name.length>100||!Array.isArray(p.yarns)||p.yarns.length<1||p.yarns.length>32)throw Error('作品の情報が不正です');
  const ids=new Set();for(const y of p.yarns){if(!integer(y.id,0,1000000)||ids.has(y.id)||typeof y.name!=='string'||y.name.length>100||!/^#[0-9a-f]{6}$/i.test(y.color))throw Error('毛糸の情報が不正です');ids.add(y.id);}
  if(!Array.isArray(p.cells)||p.cells.length!==p.rows||p.cells.some(r=>!Array.isArray(r)||r.length!==p.columns||r.some(c=>!ids.has(c)&&!(p.format==='patterncanvas-web-2'&&c===null))))throw Error('編み図のマスが不正です');
  if(!integer(p.currentRow,1,totalRows(p))||!Array.isArray(p.completedRows)||p.completedRows.length>totalRows(p)||p.completedRows.some(r=>!integer(r,1,totalRows(p))))throw Error('進捗が不正です');
  if(!p.notes||typeof p.notes!=='object'||Array.isArray(p.notes)||Object.entries(p.notes).some(([k,v])=>!/^\d+$/.test(k)||!integer(Number(k),1,totalRows(p))||typeof v!=='string'||v.length>2000))throw Error('メモが不正です');
  return {...blank(p.columns,p.rows),format:p.format,name:p.name,cells:clone(p.cells),yarns:clone(p.yarns),horizontalRepeats:p.horizontalRepeats,verticalRepeats:p.verticalRepeats,currentRow:p.currentRow,completedRows:[...new Set(p.completedRows)],notes:{...p.notes},showDividers:p.showDividers!==false,updatedAt:Number.isFinite(p.updatedAt)?p.updatedAt:Date.now()};
}
export function paint(p,x,r,id){if(p.cells[r][x]!==null)p.cells[r][x]=id;}
export function fill(p,x,r,id){const before=p.cells[r][x];if(before===null||before===id)return;const q=[[x,r]];p.cells[r][x]=id;while(q.length){const [a,b]=q.pop();for(const [c,d] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]])if(c>=0&&d>=0&&c<p.columns&&d<p.rows&&p.cells[d][c]===before){p.cells[d][c]=id;q.push([c,d]);}}}
export function bounds(s){return {left:Math.min(s.x,s.x2),right:Math.max(s.x,s.x2),bottom:Math.min(s.r,s.r2),top:Math.max(s.r,s.r2)};}
export function flip(p,horizontal,selection=null){const b=selection?bounds(selection):{left:0,right:p.columns-1,bottom:0,top:p.rows-1};const old=clone(p.cells);for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++)p.cells[r][x]=old[horizontal?r:b.top+b.bottom-r][horizontal?b.left+b.right-x:x];}
export function clearRange(p,s){const b=bounds(s);for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++)paint(p,x,r,p.yarns[0].id);}
export function copyRange(p,s){const b=bounds(s);return p.cells.slice(b.bottom,b.top+1).map(r=>r.slice(b.left,b.right+1));}
export function paste(p,data,x,r,move=null){if(x<0||r<0||x+data[0].length>p.columns||r+data.length>p.rows)throw Error('選択範囲が収まる位置を選んでください');if(move)clearRange(p,move);data.forEach((line,j)=>line.forEach((id,i)=>p.cells[r+j][x+i]=id));}
export function selectRow(p,r){p.currentRow=Math.max(1,Math.min(totalRows(p),Math.round(r)));}
export function complete(p){if(!p.completedRows.includes(p.currentRow))p.completedRows.push(p.currentRow);selectRow(p,p.currentRow+1);}
export function previous(p){const all=p.currentRow===totalRows(p)&&p.completedRows.includes(p.currentRow);if(!all)selectRow(p,p.currentRow-1);p.completedRows=p.completedRows.filter(r=>r!==p.currentRow);}
export function repeats(p,h,v){if(p.columns*h>1000||p.rows*v>1000)throw Error('リピート後は横・縦それぞれ1000までです');p.horizontalRepeats=h;p.verticalRepeats=v;selectRow(p,p.currentRow);p.completedRows=p.completedRows.filter(r=>r<=totalRows(p));p.notes=Object.fromEntries(Object.entries(p.notes).filter(([r])=>Number(r)<=totalRows(p)));}

// Structural edits operate on the displayed rows, including repeats. null means
// no stitch: both renderers read this exact same array, never an inferred shape.
export function expandedCells(p){return Array.from({length:totalRows(p)},(_,r)=>Array.from({length:totalColumns(p)},(_,x)=>colorAt(p,x,r)));}
export function stitchCount(p,row){let count=0;for(let x=0;x<totalColumns(p);x++)if(colorAt(p,x,row-1)!==null)count++;return count;}
function commitShape(p,cells){
  const width=Math.max(1,...cells.map(r=>r.length));
  if(width>1000||cells.length>1000)throw Error('作品は最大1000目・1000段です');
  p.cells=cells.map(row=>[...row,...Array(width-row.length).fill(null)]);
  p.columns=width;p.rows=cells.length;p.horizontalRepeats=1;p.verticalRepeats=1;p.format='patterncanvas-web-2';
}
export function editStitches(p,{fromRow,action,count,edge='right',position=1,color=p.yarns[0].id}){
  if(!Number.isInteger(fromRow)||fromRow<1||fromRow>totalRows(p)||!Number.isInteger(count)||count<1||count>100||!['add','remove'].includes(action)||!['left','right','position'].includes(edge)||!Number.isInteger(position)||position<1||!p.yarns.some(y=>y.id===color))throw Error('対象段・位置・目数を確認してください');
  const cells=expandedCells(p);
  for(let r=fromRow-1;r<cells.length;r++){
    const row=cells[r];while(row.length&&row.at(-1)===null)row.pop();
    const first=row.findIndex(c=>c!==null);
    const at=edge==='right'?(action==='add'?row.length:row.length-count):edge==='left'?Math.max(0,first):position-1;
    if(at<0||at>row.length||(action==='remove'&&(at+count>row.length||row.slice(at,at+count).some(c=>c===null))))throw Error(`${r+1}段目には、その位置に${count}目ありません`);
    if(action==='remove'&&row.filter(c=>c!==null).length<=count)throw Error(`${r+1}段目には少なくとも1目残してください`);
    row.splice(at,action==='remove'?count:0,...(action==='add'?Array(count).fill(color):[]));
    while(row.length&&row.at(-1)===null)row.pop();
  }
  // Lower rows keep every original cell and coordinate, including blank slots.
  commitShape(p,cells);
}
export function editRows(p,{action,position,count,color=p.yarns[0].id}){
  const total=totalRows(p);
  if(!['add','remove'].includes(action)||!Number.isInteger(position)||position<1||position>total+(action==='add'?1:0)||!Number.isInteger(count)||count<1||count>100||!p.yarns.some(y=>y.id===color))throw Error('段の位置・段数を確認してください');
  if(action==='remove'&&(position+count-1>total||count>=total))throw Error('削除範囲を確認してください。少なくとも1段残してください');
  const cells=expandedCells(p);
  const at=position-1;
  const template=cells[Math.min(at,total-1)];
  cells.splice(at,action==='remove'?count:0,...(action==='add'?Array.from({length:count},()=>template.map(c=>c===null?null:color)):[]));
  const remap=row=>action==='add'?(row>=position?row+count:row):(row<position?row:row>=position+count?row-count:null);
  const current=remap(p.currentRow);
  const completed=p.completedRows.map(remap).filter(r=>r!==null);
  const notes=Object.fromEntries(Object.entries(p.notes).map(([r,n])=>[remap(Number(r)),n]).filter(([r])=>r!==null));
  commitShape(p,cells);p.currentRow=current??Math.min(position,p.rows);p.completedRows=completed;p.notes=notes;
}
// Deterministic k-means, then map image top row to the highest knitting row.
export function quantize(bytes,w,h,count){
 const pixels=Array.from({length:w*h},(_,i)=>{const a=bytes[i*4+3]/255;return [0,1,2].map(k=>Math.round(bytes[i*4+k]*a+255*(1-a)));});
 const unique=[...new Map(pixels.map(p=>[p.join(','),p])).values()];count=Math.min(count,unique.length);
 let centers=Array.from({length:count},(_,i)=>unique[Math.floor(i*unique.length/count)].slice());
 const distance=(a,b)=>a.reduce((n,v,k)=>n+(v-b[k])**2,0);
 const nearest=p=>centers.reduce((best,c,i)=>distance(p,c)<distance(p,centers[best])?i:best,0);
 for(let pass=0;pass<8;pass++){const sums=centers.map(()=>[0,0,0,0]);for(const p of pixels){const s=sums[nearest(p)];p.forEach((v,k)=>s[k]+=v);s[3]++;}centers=centers.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>Math.round(v/sums[i][3])):c);}
 const p=blank(w,h);p.name='画像からの編み図';p.yarns=centers.map((c,id)=>({id,name:`画像の色 ${id+1}`,color:'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')}));
 p.cells=Array.from({length:h},(_,r)=>Array.from({length:w},(_,x)=>nearest(pixels[(h-1-r)*w+x])));return p;
}
