export const clone = p => JSON.parse(JSON.stringify(p));
export const totalRows = p => p.rows * p.verticalRepeats;
export const totalColumns = p => p.columns * p.horizontalRepeats;
export const colorAt = (p, x, row) => p.cells[row % p.rows][x % p.columns];
export const rowAtVisual = (p, y) => totalRows(p) - 1 - y;
export function blank(columns = 16, rows = 20) {
  return {format:'patterncanvas-web-1', name:'新しい編み図', columns, rows,
    cells:Array.from({length:rows},()=>Array(columns).fill(0)),
    yarns:[{id:0,name:'ミルク',color:'#f3ead9'},{id:1,name:'セージ',color:'#52796b'},{id:2,name:'アプリコット',color:'#dba487'},{id:3,name:'チャコール',color:'#3c4b49'}],
    horizontalRepeats:1,verticalRepeats:1,currentRow:1,topDown:false,completedRows:[],notes:{},showDividers:true,updatedAt:Date.now()};
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
  if(!p||p.format!=='patterncanvas-web-1'||!integer(p.columns,1,100)||!integer(p.rows,1,100)||!integer(p.horizontalRepeats,1,10)||!integer(p.verticalRepeats,1,10))throw Error('対応していない作品ファイルです');
  if(typeof p.name!=='string'||p.name.length>100||!Array.isArray(p.yarns)||p.yarns.length<1||p.yarns.length>32)throw Error('作品の情報が不正です');
  const ids=new Set();for(const y of p.yarns){if(!integer(y.id,0,1000000)||ids.has(y.id)||typeof y.name!=='string'||y.name.length>100||!/^#[0-9a-f]{6}$/i.test(y.color))throw Error('毛糸の情報が不正です');ids.add(y.id);}
  if(!Array.isArray(p.cells)||p.cells.length!==p.rows||p.cells.some(r=>!Array.isArray(r)||r.length!==p.columns||r.some(c=>!ids.has(c))))throw Error('編み図のマスが不正です');
  if(!integer(p.currentRow,1,totalRows(p))||!Array.isArray(p.completedRows)||p.completedRows.length>totalRows(p)||p.completedRows.some(r=>!integer(r,1,totalRows(p))))throw Error('進捗が不正です');
  if(!p.notes||typeof p.notes!=='object'||Array.isArray(p.notes)||Object.entries(p.notes).some(([k,v])=>!/^\d+$/.test(k)||!integer(Number(k),1,totalRows(p))||typeof v!=='string'||v.length>2000))throw Error('メモが不正です');
  if(p.topDown!==undefined&&typeof p.topDown!=='boolean')throw Error('編む方向が不正です');
  return {...blank(p.columns,p.rows),topDown:p.topDown===true,name:p.name,cells:clone(p.cells),yarns:clone(p.yarns),horizontalRepeats:p.horizontalRepeats,verticalRepeats:p.verticalRepeats,currentRow:p.currentRow,completedRows:[...new Set(p.completedRows)],notes:{...p.notes},showDividers:p.showDividers!==false,updatedAt:Number.isFinite(p.updatedAt)?p.updatedAt:Date.now()};
}
export function paint(p,x,r,id){p.cells[r][x]=id;}
export function fill(p,x,r,id){const before=p.cells[r][x];if(before===id)return;const q=[[x,r]];p.cells[r][x]=id;while(q.length){const [a,b]=q.pop();for(const [c,d] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]])if(c>=0&&d>=0&&c<p.columns&&d<p.rows&&p.cells[d][c]===before){p.cells[d][c]=id;q.push([c,d]);}}}
export function bounds(s){return {left:Math.min(s.x,s.x2),right:Math.max(s.x,s.x2),bottom:Math.min(s.r,s.r2),top:Math.max(s.r,s.r2)};}
export function flip(p,horizontal,selection=null){const b=selection?bounds(selection):{left:0,right:p.columns-1,bottom:0,top:p.rows-1};const old=clone(p.cells);for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++)p.cells[r][x]=old[horizontal?r:b.top+b.bottom-r][horizontal?b.left+b.right-x:x];}
export function clearRange(p,s){const b=bounds(s);for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++)p.cells[r][x]=p.yarns[0].id;}
export function copyRange(p,s){const b=bounds(s);return p.cells.slice(b.bottom,b.top+1).map(r=>r.slice(b.left,b.right+1));}
export function paste(p,data,x,r,move=null){if(x<0||r<0||x+data[0].length>p.columns||r+data.length>p.rows)throw Error('選択範囲が収まる位置を選んでください');if(move)clearRange(p,move);data.forEach((line,j)=>line.forEach((id,i)=>p.cells[r+j][x+i]=id));}
export function selectRow(p,r){p.currentRow=Math.max(1,Math.min(totalRows(p),Math.round(r)));}
export function complete(p){if(!p.completedRows.includes(p.currentRow))p.completedRows.push(p.currentRow);selectRow(p,p.currentRow+rowStep(p));}
export function previous(p){if(!p.completedRows.includes(p.currentRow))selectRow(p,p.currentRow-rowStep(p));p.completedRows=p.completedRows.filter(r=>r!==p.currentRow);}
export function repeats(p,h,v){p.horizontalRepeats=h;p.verticalRepeats=v;selectRow(p,p.currentRow);p.completedRows=p.completedRows.filter(r=>r<=totalRows(p));p.notes=Object.fromEntries(Object.entries(p.notes).filter(([r])=>Number(r)<=totalRows(p)));}
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

// Stored cells, progress and memo keys always use physical rows counted from bottom.
export const rowStep=p=>p.topDown?-1:1;
export const rowNumber=(p,physical)=>p.topDown?totalRows(p)+1-physical:physical;
export const physicalRow=(p,number)=>p.topDown?totalRows(p)+1-number:number;
export function changeDirection(p,topDown){
 if(typeof topDown!=='boolean')throw Error('編む方向が不正です');
 if(p.topDown===topDown)return;
 p.topDown=topDown;p.currentRow=topDown?totalRows(p):1;
}
