import {reduceImage} from './image-model.mjs';
export const INCREASES=Object.freeze([
 {code:'M1L',name:'左増し目（表目）',description:'渡り糸から左に傾く1目を作る増し目。'},
 {code:'M1R',name:'右増し目（表目）',description:'渡り糸から右に傾く1目を作る増し目。'},
 {code:'M1LP',name:'左増し目（裏目）',description:'裏目で編む左増し目。'},
 {code:'M1RP',name:'右増し目（裏目）',description:'裏目で編む右増し目。'},
 {code:'KFB',name:'表裏を編む増し目',description:'1目の手前と向こう側を編み、2目にする（差し引き＋1目）。'},
 {code:'YO',name:'掛け目',description:'針に糸を掛けて1目増やす。穴のある増し目。'}
]);
const symbolCodes=new Set(INCREASES.map(s=>s.code));
export const symbolAt=(p,x,r)=>colorAt(p,x,r)===null?null:p.symbols?.[r%p.rows]?.[x%p.columns]??null;
function ensureSymbols(p){if(!p.symbols)p.symbols=Array.from({length:p.rows},()=>Array(p.columns).fill(null));p.format='patterncanvas-web-3';}
export function setSymbol(p,x,r,code){
 if(code!==null&&!symbolCodes.has(code))throw Error('対応していない増し目記号です');
 if(!Number.isInteger(x)||!Number.isInteger(r)||x<0||r<0||x>=p.columns||r>=p.rows)throw Error('記号を置くマスを確認してください');
 if(p.cells[r][x]===null||(!p.symbols&&code===null))return;
 ensureSymbols(p);p.symbols[r][x]=code;
}
export function erase(p,x,r){paint(p,x,r,p.yarns[0].id);setSymbol(p,x,r,null);}

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
  if(!p||!['patterncanvas-web-1','patterncanvas-web-2','patterncanvas-web-3'].includes(p.format)||!integer(p.columns,1,2000)||!integer(p.rows,1,2000)||!integer(p.horizontalRepeats,1,10)||!integer(p.verticalRepeats,1,10)||totalRows(p)>2000||totalColumns(p)>2000)throw Error('対応していない作品ファイルです');
  if(typeof p.name!=='string'||p.name.length>100||!Array.isArray(p.yarns)||p.yarns.length<1||p.yarns.length>64)throw Error('作品の情報が不正です');
  const ids=new Set();for(const y of p.yarns){if(!integer(y.id,0,1000000)||ids.has(y.id)||typeof y.name!=='string'||y.name.length>100||!/^#[0-9a-f]{6}$/i.test(y.color))throw Error('毛糸の情報が不正です');ids.add(y.id);}
  if(!Array.isArray(p.cells)||p.cells.length!==p.rows||p.cells.some(r=>!Array.isArray(r)||r.length!==p.columns||r.some(c=>!ids.has(c)&&!(p.format!=='patterncanvas-web-1'&&c===null))))throw Error('編み図のマスが不正です');
  if(p.format==='patterncanvas-web-3'||p.symbols!==undefined){
    if(p.format!=='patterncanvas-web-3'||!Array.isArray(p.symbols)||p.symbols.length!==p.rows||p.symbols.some((row,r)=>!Array.isArray(row)||row.length!==p.columns||row.some((code,x)=>code!==null&&(!symbolCodes.has(code)||p.cells[r][x]===null))))throw Error('増し目記号の情報が不正です');
  }
  if(!integer(p.currentRow,1,totalRows(p))||!Array.isArray(p.completedRows)||p.completedRows.length>totalRows(p)||p.completedRows.some(r=>!integer(r,1,totalRows(p))))throw Error('進捗が不正です');
  if(!p.notes||typeof p.notes!=='object'||Array.isArray(p.notes)||Object.entries(p.notes).some(([k,v])=>!/^\d+$/.test(k)||!integer(Number(k),1,totalRows(p))||typeof v!=='string'||v.length>2000))throw Error('メモが不正です');
  if(p.topDown!==undefined&&typeof p.topDown!=='boolean')throw Error('編む方向が不正です');
  return {...blank(p.columns,p.rows),topDown:p.topDown===true,format:p.format,name:p.name,cells:clone(p.cells),...(p.symbols?{symbols:clone(p.symbols)}:{}),yarns:clone(p.yarns),horizontalRepeats:p.horizontalRepeats,verticalRepeats:p.verticalRepeats,currentRow:p.currentRow,completedRows:[...new Set(p.completedRows)],notes:{...p.notes},showDividers:p.showDividers!==false,updatedAt:Number.isFinite(p.updatedAt)?p.updatedAt:Date.now()};
}
export function paint(p,x,r,id){if(p.cells[r][x]!==null)p.cells[r][x]=id;}
export function fill(p,x,r,id){const before=p.cells[r][x];if(before===null||before===id)return;const q=[[x,r]];p.cells[r][x]=id;while(q.length){const [a,b]=q.pop();for(const [c,d] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]])if(c>=0&&d>=0&&c<p.columns&&d<p.rows&&p.cells[d][c]===before){p.cells[d][c]=id;q.push([c,d]);}}}
export function bounds(s){return {left:Math.min(s.x,s.x2),right:Math.max(s.x,s.x2),bottom:Math.min(s.r,s.r2),top:Math.max(s.r,s.r2)};}
const mirrorSymbol=code=>({M1L:'M1R',M1R:'M1L',M1LP:'M1RP',M1RP:'M1LP'})[code]??code;
export function flip(p,horizontal,selection=null){
 const b=selection?bounds(selection):{left:0,right:p.columns-1,bottom:0,top:p.rows-1},old=clone(p.cells),marks=p.symbols?clone(p.symbols):null;
 for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++){
  const sr=horizontal?r:b.top+b.bottom-r,sx=horizontal?b.left+b.right-x:x;
  p.cells[r][x]=old[sr][sx];if(marks)p.symbols[r][x]=horizontal?mirrorSymbol(marks[sr][sx]):marks[sr][sx];
 }
}
export function clearRange(p,s){const b=bounds(s);for(let r=b.bottom;r<=b.top;r++)for(let x=b.left;x<=b.right;x++)erase(p,x,r);}
export function copyRange(p,s){const b=bounds(s);return p.cells.slice(b.bottom,b.top+1).map(r=>r.slice(b.left,b.right+1));}
export function copySymbols(p,s){if(!p.symbols)return null;const b=bounds(s);return p.symbols.slice(b.bottom,b.top+1).map(r=>r.slice(b.left,b.right+1));}
export function paste(p,data,x,r,move=null,symbols=null){
 if(x<0||r<0||x+data[0].length>p.columns||r+data.length>p.rows)throw Error('選択範囲が収まる位置を選んでください');
 if(symbols&&(!Array.isArray(symbols)||symbols.length!==data.length||symbols.some((row,j)=>!Array.isArray(row)||row.length!==data[j].length||row.some((code,i)=>code!==null&&(!symbolCodes.has(code)||data[j][i]===null)))))throw Error('貼り付ける記号が不正です');
 if(symbols)ensureSymbols(p);
 if(move)clearRange(p,move);
 data.forEach((line,j)=>line.forEach((id,i)=>{p.cells[r+j][x+i]=id;if(p.symbols)p.symbols[r+j][x+i]=symbols?.[j]?.[i]??null;}));
}
export function selectRow(p,r){p.currentRow=Math.max(1,Math.min(totalRows(p),Math.round(r)));}
export function complete(p){if(!p.completedRows.includes(p.currentRow))p.completedRows.push(p.currentRow);selectRow(p,p.currentRow+rowStep(p));}
export function previous(p){if(!p.completedRows.includes(p.currentRow))selectRow(p,p.currentRow-rowStep(p));p.completedRows=p.completedRows.filter(r=>r!==p.currentRow);}
export function repeats(p,h,v){if(!Number.isInteger(h)||!Number.isInteger(v)||h<1||h>10||v<1||v>10||p.columns*h>2000||p.rows*v>2000)throw Error("リピート後は横・縦それぞれ2000までです");p.horizontalRepeats=h;p.verticalRepeats=v;selectRow(p,p.currentRow);p.completedRows=p.completedRows.filter(r=>r<=totalRows(p));p.notes=Object.fromEntries(Object.entries(p.notes).filter(([r])=>Number(r)<=totalRows(p)));}
export function quantize(bytes,w,h,count){const result=reduceImage(bytes,w,h,count),p=blank(w,h);p.name='画像からの編み図';p.yarns=result.colors.map((c,id)=>({id,name:`画像の色 ${id+1}`,color:'#'+c.toString(16).padStart(6,'0')}));p.cells=result.cells;return p;}
// Stored cells, progress and memo keys always use physical rows counted from bottom.
export const rowStep=p=>p.topDown?-1:1;
export const rowNumber=(p,physical)=>p.topDown?totalRows(p)+1-physical:physical;
export const physicalRow=(p,number)=>p.topDown?totalRows(p)+1-number:number;
export function changeDirection(p,topDown){
 if(typeof topDown!=='boolean')throw Error('編む方向が不正です');
 if(p.topDown===topDown)return;
 p.topDown=topDown;p.currentRow=topDown?totalRows(p):1;
}

// Structural edits operate on the displayed rows, including repeats. null means
// no stitch: both renderers read this exact same array, never an inferred shape.
export function expandedCells(p){return Array.from({length:totalRows(p)},(_,r)=>Array.from({length:totalColumns(p)},(_,x)=>colorAt(p,x,r)));}
export function stitchCount(p,row){let count=0;for(let x=0;x<totalColumns(p);x++)if(colorAt(p,x,row-1)!==null)count++;return count;}
export function expandedSymbols(p){return Array.from({length:totalRows(p)},(_,r)=>Array.from({length:totalColumns(p)},(_,x)=>symbolAt(p,x,r)));}
function commitShape(p,cells,symbols=null){
  const width=Math.max(1,...cells.map(r=>r.length));
  if(width>2000||cells.length>2000)throw Error('作品は最大2000目・2000段です');
  p.cells=cells.map(row=>[...row,...Array(width-row.length).fill(null)]);
  p.columns=width;p.rows=cells.length;p.horizontalRepeats=1;p.verticalRepeats=1;p.format=symbols?'patterncanvas-web-3':'patterncanvas-web-2';
  if(symbols)p.symbols=p.cells.map((row,r)=>row.map((c,x)=>c===null?null:symbols[r]?.[x]??null));else delete p.symbols;
}
export function editStitches(p,{fromRow,action,count,edge='right',position=1,color=p.yarns[0].id,symbol=null}){
  if(!Number.isInteger(fromRow)||fromRow<1||fromRow>totalRows(p)||!Number.isInteger(count)||count<1||count>100||!['add','remove'].includes(action)||!['left','right','position'].includes(edge)||!Number.isInteger(position)||position<1||!p.yarns.some(y=>y.id===color))throw Error('対象段・位置・目数を確認してください');
  if(symbol!==null&&(!symbolCodes.has(symbol)||action!=='add'))throw Error('増し目記号を確認してください');
  const cells=expandedCells(p),symbols=(p.symbols||symbol)?expandedSymbols(p):null;
  for(let r=fromRow-1;r<cells.length;r++){
    const row=cells[r];while(row.length&&row.at(-1)===null)row.pop();if(symbols)symbols[r].length=row.length;
    const first=row.findIndex(c=>c!==null);
    const at=edge==='right'?(action==='add'?row.length:row.length-count):edge==='left'?Math.max(0,first):position-1;
    if(at<0||at>row.length||(action==='remove'&&(at+count>row.length||row.slice(at,at+count).some(c=>c===null))))throw Error(`${r+1}段目には、その位置に${count}目ありません`);
    if(action==='remove'&&row.filter(c=>c!==null).length<=count)throw Error(`${r+1}段目には少なくとも1目残してください`);
    row.splice(at,action==='remove'?count:0,...(action==='add'?Array(count).fill(color):[]));
    if(symbols)symbols[r].splice(at,action==='remove'?count:0,...(action==='add'?Array(count).fill(r===fromRow-1?symbol:null):[]));
    while(row.length&&row.at(-1)===null)row.pop();
  }
  // Lower rows keep every original cell and coordinate, including blank slots.
  commitShape(p,cells,symbols);
}
export function editRows(p,{action,position,count,color=p.yarns[0].id}){
  const total=totalRows(p);
  if(!['add','remove'].includes(action)||!Number.isInteger(position)||position<1||position>total+(action==='add'?1:0)||!Number.isInteger(count)||count<1||count>100||!p.yarns.some(y=>y.id===color))throw Error('段の位置・段数を確認してください');
  if(action==='remove'&&(position+count-1>total||count>=total))throw Error('削除範囲を確認してください。少なくとも1段残してください');
  const cells=expandedCells(p),symbols=p.symbols?expandedSymbols(p):null;
  const at=position-1;
  const template=cells[Math.min(at,total-1)];
  cells.splice(at,action==='remove'?count:0,...(action==='add'?Array.from({length:count},()=>template.map(c=>c===null?null:color)):[]));
  if(symbols)symbols.splice(at,action==='remove'?count:0,...(action==='add'?Array.from({length:count},()=>template.map(()=>null)):[]));
  const remap=row=>action==='add'?(row>=position?row+count:row):(row<position?row:row>=position+count?row-count:null);
  const current=remap(p.currentRow);
  const completed=p.completedRows.map(remap).filter(r=>r!==null);
  const notes=Object.fromEntries(Object.entries(p.notes).map(([r,n])=>[remap(Number(r)),n]).filter(([r])=>r!==null));
  commitShape(p,cells,symbols);p.currentRow=current??Math.min(position,p.rows);p.completedRows=completed;p.notes=notes;
}

function reversedCoordinates(p){const n=totalRows(p),q=clone(p);commitShape(q,expandedCells(p).reverse(),p.symbols?expandedSymbols(p).reverse():null);q.currentRow=n+1-p.currentRow;q.completedRows=p.completedRows.map(r=>n+1-r);q.notes=Object.fromEntries(Object.entries(p.notes).map(([r,note])=>[n+1-Number(r),note]));return q;}
export function editInKnittingOrder(p,kind,options){let q=p.topDown?reversedCoordinates(p):clone(p);if(kind==='stitches')editStitches(q,options);else editRows(q,options);if(p.topDown)q=reversedCoordinates(q);Object.assign(p,q);}
