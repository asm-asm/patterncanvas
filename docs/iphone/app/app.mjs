import * as Platform from './platform.mjs';
import * as M from './model.mjs';
import {draw,CHART_HEADER,CHART_FOOTER,CHART_GUTTER} from './draw.mjs';
import {setupPadding} from './padding.mjs';
import {setupTextImport} from './text-import.mjs';
import {setupImageImport} from './image-import.mjs';
const $=id=>document.getElementById(id),KEY='patterncanvas-iphone-v1';
let p=M.sample(),yarn=1,tool='pen',selection=null,clipboard=null,undo=[],redo=[],mode='both',memoRow=1,sourceImage=null;
const chartView={cell:24,x:CHART_GUTTER,y:CHART_HEADER,numberFromRight:false},previewView={cell:12,x:0,y:0};
let countedRun=null;
let locked=false,readability={color:'#8d1735',width:4};
try{locked=await Platform.readLock();const saved=JSON.parse(localStorage.getItem('patterncanvas-readability')||'{}');if(/^#[0-9a-f]{6}$/i.test(saved.color))readability.color=saved.color;if([2,4,6].includes(saved.width))readability.width=saved.width;}catch{}
try{chartView.numberFromRight=localStorage.getItem('patterncanvas-number-from-right')==='true';}catch{}
const editable=()=>{if(locked){message('編み図はロック中です。編集するにはロックを解除してください。');return false;}return true;};
function message(text){$('message').textContent=text;}
let canSave=true;
try{const raw=await Platform.readProject();if(raw)p=M.validate(JSON.parse(raw));}catch{canSave=false;message('保存データを読み込めませんでした。作品ファイルがあれば「設定・保存」から開いてください。');}
let saveSequence=0;
function save(){if(!canSave){message('元の保存データを保護しています。作品ファイルを読み込むか、新しい作品を作成してください。');return;}p.updatedAt=Date.now();const sequence=++saveSequence;$('save-state').textContent='保存中…';try{Promise.resolve(Platform.writeProject(JSON.stringify(p))).then(()=>{if(sequence===saveSequence)$('save-state').textContent='✓ 端末に保存済み';},()=>saveFailed());}catch{saveFailed();}}
function saveFailed(){$('save-state').textContent='保存できません';message('端末内に保存できません。作品を書き出して保管してください。');}
function history(before){if(JSON.stringify(before)===JSON.stringify(p))return;undo.push(before);while(undo.length>1&&(undo.length>40||undo.reduce((n,item)=>n+item.rows*item.columns,0)>2000000))undo.shift();redo=[];save();}
function change(fn){countedRun=null;const before=M.clone(p);try{fn();history(before);render();}catch(e){p=before;message(e.message);render();}}
function controls(){if(!locked)countedRun=null;$('run-count').hidden=!locked;$('run-count').textContent=countedRun?`${M.rowNumber(p,countedRun.row+1)}段目 · ${p.yarns.find(y=>y.id===countedRun.id)?.name||'毛糸'}：${countedRun.count}目連続（左から${countedRun.left+1}〜${countedRun.right+1}マス）`:'色のマスをタップすると、横に連続する目数を表示します。';$('symbol-tools').hidden=locked||tool!=='symbol';$('column-numbering').value=(p.flatKnitting?M.knittingSide(p).numberFromRight:chartView.numberFromRight)?'right':'left';$('column-numbering').disabled=p.flatKnitting;$('palette').hidden=locked;$('tools').hidden=locked;document.querySelector('.flip-row').hidden=locked;document.querySelectorAll('[data-tool]').forEach(b=>b.disabled=locked&&b.dataset.tool!=='pan');for(const id of ['flip-h','flip-v','clear','copy','move','stitch-edit','add-color','new-project','apply-repeats','image-file','text-open','padding-open','import'])$(id).disabled=locked;$('chart-lock').setAttribute('aria-pressed',String(locked));$('chart-lock').textContent=locked?'ロック中 · 解除する':'編み図をロック';$('chart-panel').classList.toggle('chart-locked',locked);$('lock-hint').textContent=locked?'ロック中：色をタップして目数を確認。1本指のドラッグで移動できます。':'編集できます。編むときはロックすると誤タップを防げます。';document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});$('selection-tools').hidden=!selection;$('undo').disabled=locked||!undo.length;$('redo').disabled=locked||!redo.length;$('zoom-label').textContent=Math.round(chartView.cell/24*100)+'%';}
function render(){const side=M.knittingSide(p),reading=side.wrongSide?'裏側（WS） · 左から右 →':'表側（RS） · 右から左 ←';$('knitting-mode-open').textContent=p.flatKnitting?'編み方：往復編み ▾':'編み方：輪編み・方向を固定 ▾';for(const id of ['working-side','chart-reading']){$(id).hidden=!p.flatKnitting;$(id).textContent=`${M.rowNumber(p,p.currentRow)}段目：${reading}`;}if(!p.yarns.some(y=>y.id===yarn))yarn=p.yarns[0].id;$('project-name').textContent=p.name;$('completed').textContent=`完了 ${p.completedRows.length} / ${M.totalRows(p)}段`;$('choose-row').replaceChildren(document.createTextNode(M.rowNumber(p,p.currentRow)));const small=document.createElement('small');small.textContent=`/ ${M.totalRows(p)} ▾`;$('choose-row').append(small);const done=p.completedRows.includes(p.currentRow);$('complete').textContent=done?(M.rowNumber(p,p.currentRow)===M.totalRows(p)?'最終段は完了 ✓':'次の段へ →'):'この段を完了 →';$('complete').disabled=done&&M.rowNumber(p,p.currentRow)===M.totalRows(p);$('previous').disabled=M.rowNumber(p,p.currentRow)===1&&!p.completedRows.includes(p.currentRow);$('progress').style.width=p.completedRows.length/M.totalRows(p)*100+'%';$('memo-open').textContent=p.notes[p.currentRow]?`メモ：${p.notes[p.currentRow]}`:'＋ この段のメモ';$('repeat-label').textContent=`横${p.horizontalRepeats} × 縦${p.verticalRepeats}`;$('dimensions').textContent=`${p.columns}目 × ${p.rows}段`;$('direction-open').textContent=p.topDown?'編む方向：トップダウン（上→下）':'編む方向：ボトムアップ（下→上）';$('knitting-order').textContent=p.topDown?'1マス＝1目 · 上から下へ':'1マス＝1目 · 下から上へ';$('direction-bottom').setAttribute('aria-pressed',String(!p.topDown));$('direction-top').setAttribute('aria-pressed',String(p.topDown));
 $('palette').replaceChildren();for(const y of p.yarns){const b=document.createElement('button');b.style.setProperty('--swatch',y.color);b.setAttribute('aria-label',y.name);b.title=y.name;b.setAttribute('aria-pressed',String(y.id===yarn));b.disabled=locked;b.onclick=()=>{if(!editable())return;yarn=y.id;tool='pen';render();};$('palette').append(b);}controls();paintCanvases();}
function paintCanvases(){draw($('chart'),p,chartView,false,selection,readability,countedRun);draw($('preview'),p,previewView,true);}
function focus(){chartView.y=CHART_HEADER+($('chart').clientHeight-CHART_HEADER-CHART_FOOTER)/2-(M.totalRows(p)-p.currentRow+.5)*chartView.cell;paintCanvases();}
function fitPreview(){const c=$('preview');previewView.cell=Math.max(3,Math.min(c.clientWidth/M.totalColumns(p),c.clientHeight/M.totalRows(p)/1.22));previewView.x=(c.clientWidth-M.totalColumns(p)*previewView.cell)/2;previewView.y=0;paintCanvases();}
function applyView(){
 document.querySelector('main').classList.toggle('both-view',mode==='both');
 $('settings').hidden=mode!=='settings';$('work').hidden=mode==='settings';
 $('chart-panel').hidden=mode==='preview';$('preview-panel').hidden=mode==='chart';
 $('preview-panel').classList.toggle('preview-only',mode==='preview');
 $('edit-history').hidden=mode!=='both'&&mode!=='chart';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===mode);b.setAttribute('aria-pressed',String(b.dataset.view===mode));});
}
function setView(view){
 mode=['both','chart','preview','settings'].includes(view)?view:'both';applyView();
 try{localStorage.setItem('patterncanvas-active-view',mode);}catch{}
 settings();if(mode!=='settings')requestAnimationFrame(()=>{fitPreview();focus();});window.scrollTo(0,0);
}

document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(mode!==b.dataset.view)setView(b.dataset.view);});document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(!editable())return;tool=b.dataset.tool;clipboard=null;controls();});
$('knitting-mode-open').onclick=()=>{$('knitting-mode').value=p.flatKnitting?'flat':'fixed';$('first-side').value=p.startWrongSide?'wrong':'right';$('first-side-label').hidden=!p.flatKnitting;$('knitting-mode-dialog').showModal();};
$('knitting-mode').onchange=()=>{$('first-side-label').hidden=$('knitting-mode').value!=='flat';};
$('knitting-mode-cancel').onclick=()=>$('knitting-mode-dialog').close();
$('knitting-mode-save').onclick=()=>{change(()=>{p.flatKnitting=$('knitting-mode').value==='flat';p.startWrongSide=$('first-side').value==='wrong';});$('knitting-mode-dialog').close();};
$('direction-open').onclick=()=>$('direction-dialog').showModal();
for(const [id,top] of [['direction-bottom',false],['direction-top',true]])$(id).onclick=()=>{change(()=>M.changeDirection(p,top));$('direction-dialog').close();focus();};
$('complete').onclick=()=>{change(()=>M.complete(p));Platform.rowCompleted();focus();};$('previous').onclick=()=>{change(()=>M.previous(p));focus();};$('choose-row').onclick=()=>{$('row-input').value=M.rowNumber(p,p.currentRow);$('row-input').max=M.totalRows(p);$('row-dialog').showModal();};
function number(id,min,max){const n=Number($(id).value);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${min}〜${max}の整数を入力してください`);return n;}
$('row-go').onclick=()=>{try{const n=number('row-input',1,M.totalRows(p));change(()=>M.selectRow(p,M.physicalRow(p,n)));$('row-dialog').close();focus();}catch(e){$('row-input').setCustomValidity(e.message);$('row-input').reportValidity();}};$('row-input').oninput=()=>$('row-input').setCustomValidity('');
$('memo-open').onclick=()=>{memoRow=p.currentRow;$('memo-title').textContent=`${M.rowNumber(p,memoRow)}段目のメモ`;$('memo').value=p.notes[memoRow]||'';$('memo-dialog').showModal();};$('memo-save').onclick=()=>{change(()=>{if($('memo').value)p.notes[memoRow]=$('memo').value;else delete p.notes[memoRow];});$('memo-dialog').close();};
function restoreHistory(from,to){
 if(!editable()||!from.length)return;
 const columns=M.totalColumns(p),rows=M.totalRows(p);
 to.push(M.clone(p));p=from.pop();selection=null;clipboard=null;tool='pen';save();render();
 // Keep the edited area in place for paint/erase/fill; refit only structural changes.
 if(columns!==M.totalColumns(p)||rows!==M.totalRows(p)){fitPreview();focus();}
}
$('undo').onclick=()=>restoreHistory(undo,redo);$('redo').onclick=()=>restoreHistory(redo,undo);
$('flip-h').onclick=()=>{if(editable())change(()=>M.flip(p,true,selection));};$('flip-v').onclick=()=>{if(editable())change(()=>M.flip(p,false,selection));};$('clear').onclick=()=>{if(editable()&&selection)change(()=>M.clearRange(p,selection));};$('selection-off').onclick=()=>{selection=null;clipboard=null;tool='pen';render();};
function copy(move){if(!editable()||!selection)return;clipboard={cells:M.copyRange(p,selection),symbols:M.copySymbols(p,selection),move:move?{...selection}:null};tool='paste';message('貼り付け先の左下のマスをタップしてください。');controls();}$('copy').onclick=()=>copy(false);$('move').onclick=()=>copy(true);
$('zoom-in').onclick=()=>{chartView.cell=Math.min(64,chartView.cell*1.2);focus();controls();};$('zoom-out').onclick=()=>{chartView.cell=Math.max(10,chartView.cell/1.2);focus();controls();};$('focus').onclick=focus;$('preview-fit').onclick=fitPreview;
function gestures(canvas,view,isPreview){const pointers=new Map();let before=null,last=null,multi=false,start=null,moved=false;
 const point=e=>{const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top};};
 const cell=pos=>{if(!isPreview&&(pos.y<CHART_HEADER||pos.y>=canvas.clientHeight-CHART_FOOTER))return null;const x=Math.floor((pos.x-view.x)/view.cell),r=M.totalRows(p)-1-Math.floor((pos.y-view.y)/view.cell);return x>=0&&r>=0&&x<M.totalColumns(p)&&r<M.totalRows(p)?{x:x%p.columns,r:r%p.rows,displayRow:r+1,displayX:x}:null;};
 function apply(pos){if(locked)return;const at=cell(pos);if(!at||pos.x<CHART_GUTTER)return;if(['pen','eraser','symbol'].includes(tool)){const applyCell=(x,r)=>{if(tool==='symbol')M.setSymbol(p,x,r,$('stitch-symbol').value||null);else if(tool==='eraser')M.erase(p,x,r);else M.paint(p,x,r,yarn);};if(last){const count=Math.max(Math.abs(at.x-last.x),Math.abs(at.r-last.r));if(count<Math.max(p.rows,p.columns)/2)for(let i=1;i<=count;i++)applyCell(Math.round(last.x+(at.x-last.x)*i/count),Math.round(last.r+(at.r-last.r)*i/count));}applyCell(at.x,at.r);last=at;}
 else if(tool==='fill')M.fill(p,at.x,at.r,yarn);else if(tool==='select'){if(!selection||!last)selection={x:at.x,r:at.r,x2:at.x,r2:at.r};else{selection.x2=at.x;selection.r2=at.r;}last=at;}paintCanvases();controls();}
 canvas.onpointerdown=e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);const pos=point(e);pointers.set(e.pointerId,pos);if(pointers.size>1){if(before){p=before;before=null;paintCanvases();}multi=true;return;}multi=false;moved=false;start=pos;last=null;if(!locked&&!isPreview&&pos.x>=CHART_GUTTER&&tool!=='pan'&&tool!=='paste'){before=M.clone(p);apply(pos);}};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const pos=point(e),old=pointers.get(e.pointerId);if(Math.hypot(pos.x-start.x,pos.y-start.y)>5)moved=true;if(pointers.size>=2){const values=[...pointers.values()],other=values.find(v=>v!==old)||values[0];const distance=Math.hypot(old.x-other.x,old.y-other.y),next=Math.hypot(pos.x-other.x,pos.y-other.y);const oldCell=view.cell;view.cell=Math.max(isPreview?3:10,Math.min(80,view.cell*(distance>2?next/distance:1)));const scale=view.cell/oldCell;const mid={x:(old.x+other.x)/2,y:(old.y+other.y)/2};view.x=mid.x-(mid.x-view.x)*scale+(pos.x-old.x)/2;view.y=mid.y-(mid.y-view.y)*scale+(pos.y-old.y)/2;paintCanvases();controls();}
 else if(!multi&&(isPreview||locked||tool==='pan')){view.x+=pos.x-old.x;view.y+=pos.y-old.y;paintCanvases();}else if(!multi&&before)apply(pos);pointers.set(e.pointerId,pos);};
 function finish(e,cancel){const pos=pointers.get(e.pointerId);if(!pos)return;pointers.delete(e.pointerId);if(cancel){if(before)p=before;before=null;multi=true;render();return;}if(!pointers.size){if(!multi&&!isPreview&&!moved&&start.x<CHART_GUTTER){const at=cell({...pos,x:CHART_GUTTER});if(at){change(()=>M.selectRow(p,at.displayRow));}}else if(locked&&!multi&&!isPreview&&!moved&&start.x>=CHART_GUTTER){const at=cell(pos);countedRun=at?M.colorRun(p,at.displayX,at.displayRow-1):null;}else if(!locked&&!multi&&!isPreview&&tool==='paste'&&clipboard&&!moved){const at=cell(pos);if(at&&pos.x>=CHART_GUTTER){try{const b=M.clone(p);M.paste(p,clipboard.cells,at.x,at.r,clipboard.move,clipboard.symbols);history(b);clipboard=null;selection=null;tool='select';message('貼り付けました。');}catch(err){message(err.message);}}}if(before){history(before);before=null;}render();}}
 canvas.onpointerup=e=>finish(e,false);canvas.onpointercancel=e=>finish(e,true);
}
gestures($('chart'),chartView,false);gestures($('preview'),previewView,true);
function settings(){$('name').value=p.name;$('repeat-h').value=p.horizontalRepeats;$('repeat-v').value=p.verticalRepeats;$('dividers').checked=p.showDividers;$('yarn-list').replaceChildren();for(const y of p.yarns){const row=document.createElement('div');row.className='yarn-row';const sw=document.createElement('i');sw.style.background=y.color;const label=document.createElement('span');label.textContent=y.name;const b=document.createElement('button');b.textContent='色を削除';b.disabled=locked||p.yarns.length===1;b.onclick=()=>{if(!editable())return;if(!confirm(`「${y.name}」を削除し、使用しているマスを残りの最初の色に置き換えますか？`))return;change(()=>{p.yarns=p.yarns.filter(a=>a.id!==y.id);p.cells=p.cells.map(r=>r.map(id=>id===y.id?p.yarns[0].id:id));});clipboard=null;settings();};const rename=document.createElement('button');rename.textContent='名前を変更';rename.disabled=locked;rename.onclick=()=>{if(!editable())return;const name=prompt('毛糸の名前（100文字まで）',y.name);if(name===null)return;try{const next=name.trim();if(!next||next.length>100)throw Error('毛糸名は1〜100文字で入力してください。');change(()=>M.renameYarn(p,y.id,next));settings();}catch(e){message(e.message);}};row.append(sw,label,rename,b);$('yarn-list').append(row);}}
$('name').onchange=()=>change(()=>p.name=$('name').value.trim()||'名前のない作品');$('dividers').onchange=()=>change(()=>p.showDividers=$('dividers').checked);$('apply-repeats').onclick=()=>{if(!editable())return;try{const h=number('repeat-h',1,10),v=number('repeat-v',1,10);if(v<p.verticalRepeats&&!confirm('減らした範囲の進捗とメモは除外されます。変更しますか？'))return;change(()=>M.repeats(p,h,v));settings();message('リピートを反映しました。');}catch(e){message(e.message);}};
$('add-color').onclick=()=>{if(!editable())return;if(p.yarns.length>=64)return message('毛糸は64色まで追加できます。');change(()=>{const id=Math.max(...p.yarns.map(y=>y.id))+1;p.yarns.push({id,name:$('new-color-name').value.trim()||`毛糸 ${id+1}`,color:$('new-color').value});yarn=id;});settings();};
function replace(next){if(!editable())return;canSave=true;change(()=>p=next);selection=null;clipboard=null;tool='pen';yarn=p.yarns[0].id;setView('both');render();}
$('new-project').onclick=()=>{if(!editable())return;try{const w=number('new-width',1,200),h=number('new-height',1,200);if(confirm('現在の作品を新しい白紙に置き換えます。必要なら先に作品を書き出してください。'))replace(M.blank(w,h));}catch(e){message(e.message);}};
$('export').onclick=async()=>{try{const name=(p.name.replace(/[\\/:*?"<>|]/g,'_')||'pattern')+'.json';await Platform.exportProject(JSON.stringify(p,null,2),name);message('共有画面から「ファイルに保存」などを選んで保管してください。');}catch{message('書き出しを完了できませんでした。もう一度お試しください。');}};
$('import').onchange=async e=>{if(!editable()){e.target.value='';return;}const file=e.target.files[0];try{if(!file)return;if(file.size>32000000)throw Error('作品ファイルは32MB以下にしてください');const next=M.validate(JSON.parse(await file.text()));if(confirm('このファイルで現在の作品を置き換えますか？'))replace(next);}catch(err){message('読み込みできません：'+err.message);}finally{e.target.value='';}};
setupImageImport({getPattern:()=>p,replace,editable,message});
setupTextImport({replace,editable,message});
setupPadding({getPattern:()=>p,editable,change,settings,message,clearSelection:()=>{selection=null;clipboard=null;render();}});
// Safari's toolbar/keyboard changes viewport height while scrolling. It must
// not reset user zoom or pan. Observe the canvases, not the viewport height.
let resizeFrame=0,lastCanvasSize='';
function scheduleCanvasResize(){
 if(resizeFrame)return;
 resizeFrame=requestAnimationFrame(()=>{
  resizeFrame=0;
  const signature=[$('chart'),$('preview')].map(c=>`${c.clientWidth}:${c.clientHeight}`).join('|')+`:${devicePixelRatio}`;
  if(signature===lastCanvasSize)return;
  lastCanvasSize=signature;paintCanvases();
 });
}
const canvasObserver=new ResizeObserver(scheduleCanvasResize);
canvasObserver.observe($('chart'));canvasObserver.observe($('preview'));
window.addEventListener('resize',scheduleCanvasResize);
let resumeTimer;
function restoreVisibleScreen(){
 if(document.hidden)return;
 if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=0;lastCanvasSize='';
 applyView();render();
 requestAnimationFrame(()=>{applyView();paintCanvases();});
 clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{if(!document.hidden){applyView();paintCanvases();}},250);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else restoreVisibleScreen();});
window.addEventListener('pageshow',restoreVisibleScreen);
window.addEventListener('patterncanvas-resume',restoreVisibleScreen);
window.addEventListener('pagehide',save);
window.addEventListener('storage',e=>{if(e.key===KEY)message('別の画面で作品が変更されました。上書きを避けるため、必要な作品を書き出してから画面を開き直してください。');});
render();requestAnimationFrame(()=>{fitPreview();focus();});
Platform.prepareOffline();

function structureOptions(){
 const [action,kind]=$('structure-action').value.split('-');
 return {kind,options:{action,count:number('structure-count',1,100),fromRow:number('structure-row',1,M.totalRows(p)+(kind==='rows'&&action==='add'?1:0)),position:kind==='rows'?number('structure-row',1,M.totalRows(p)+(action==='add'?1:0)):$('structure-edge').value==='position'?number('structure-position',1,2001):1,edge:$('structure-edge').value,color:yarn,symbol:kind==='stitches'&&action==='add'?$('structure-symbol').value||null:null}};
}
function structurePreview(){
 const [action,kind]=$('structure-action').value.split('-');
 $('structure-symbol-label').hidden=kind!=='stitches'||action!=='add';$('structure-edge-fields').hidden=kind==='rows';$('structure-position-label').hidden=$('structure-edge').value!=='position';
 $('structure-position-text').textContent=action==='add'?'この目番号の前に挿入（左から）':'削除を始める目番号（左から）';
 $('structure-row-label').textContent=kind==='stitches'?(p.topDown?'変更を始める段（この段から下）':'変更を始める段（この段から上）'):action==='add'?'この段の前に挿入（最後の段＋1で末尾に追加）':'削除を始める段';
 $('structure-row').max=M.totalRows(p)+(kind==='rows'&&action==='add'?1:0);
 $('structure-count-label').textContent=(action==='add'?'追加する':'削除する')+(kind==='rows'?'段数':'目数');
 try{
  const {options}=structureOptions(),next=M.clone(p);if(kind==='stitches')M.editInKnittingOrder(next,'stitches',options);else M.editInKnittingOrder(next,'rows',options);
  const row=options.fromRow;
  let text=kind==='stitches'?`${row}〜${M.totalRows(p)}段目を変更。${row}段目は ${M.stitchCount(p,M.physicalRow(p,row))}目 → ${M.stitchCount(next,M.physicalRow(next,row))}目。`:`${options.position}段目から${options.count}段${action==='add'?'挿入':'削除'}。全${M.totalRows(p)}段 → ${next.rows}段。`;
  if(options.symbol)text+=` ${M.INCREASES.find(s=>s.code===options.symbol).code}を開始段の追加マスに付けます。`;
  if(action==='add')text+=` 追加するマスの色：${p.yarns.find(y=>y.id===yarn).name}。`;
  if(p.horizontalRepeats>1||p.verticalRepeats>1)text+=' リピートを含む全体を編集します。柄を保ったまま、変更後のリピート設定は横1×縦1になります。';
  $('structure-summary').textContent=text;$('structure-apply').disabled=locked;
 }catch(e){$('structure-summary').textContent=e.message;$('structure-apply').disabled=true;}
}
$('stitch-edit').onclick=()=>{if(!editable())return;$('structure-row').value=M.rowNumber(p,p.currentRow);$('structure-count').value=1;structurePreview();$('structure-dialog').showModal();};
$('structure-close').onclick=()=>$('structure-dialog').close();
for(const id of ['structure-action','structure-row','structure-edge','structure-position','structure-count','structure-symbol'])$(id).oninput=structurePreview;
$('structure-apply').onclick=()=>{if(!editable())return;try{const {kind,options}=structureOptions(),next=M.clone(p);if(kind==='stitches')M.editInKnittingOrder(next,'stitches',options);else M.editInKnittingOrder(next,'rows',options);change(()=>p=next);selection=null;clipboard=null;tool='pen';$('structure-dialog').close();render();fitPreview();focus();message('目・段の変更を保存しました。「元に戻す」で取り消せます。');}catch(e){$('structure-summary').textContent=e.message;}};

$('chart-lock').onclick=()=>{locked=!locked;selection=null;clipboard=null;try{Promise.resolve(Platform.writeLock(locked)).catch(()=>message('ロック状態を保存できませんでした。'));}catch{message('ロック状態を保存できませんでした。');}render();settings();};
const rowColors=[['ワイン','#8d1735'],['青','#0057b8'],['オレンジ','#b84b00'],['紫','#7838a8'],['黒','#000000'],['黄','#ffe600']];
function updateReadability(){try{localStorage.setItem('patterncanvas-readability',JSON.stringify(readability));}catch{message('表示設定を保存できませんでした。');}paintCanvases();for(const b of $('row-color-presets').children)b.setAttribute('aria-pressed',String(b.dataset.color===readability.color));}
for(const [name,color] of rowColors){const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.color=color;button.onclick=()=>{readability.color=color;$('row-color').value=color;updateReadability();};$('row-color-presets').append(button);}
$('readability-open').onclick=()=>{$('row-color').value=readability.color;$('row-width').value=readability.width;for(const b of $('row-color-presets').children)b.setAttribute('aria-pressed',String(b.dataset.color===readability.color));$('readability-dialog').showModal();};
$('row-color').oninput=()=>{readability.color=$('row-color').value;updateReadability();};$('row-width').onchange=()=>{readability.width=Number($('row-width').value);updateReadability();};
let initialView='both';try{initialView=localStorage.getItem('patterncanvas-active-view')||'both';}catch{}
if(location.hash==='#both'){initialView='both';historyReplaceHash();}
setView(initialView);
function historyReplaceHash(){try{window.history.replaceState(null,'',location.pathname+location.search);}catch{}}

$('column-numbering').onchange=()=>{chartView.numberFromRight=$('column-numbering').value==='right';try{localStorage.setItem('patterncanvas-number-from-right',String(chartView.numberFromRight));}catch{message('目番号の設定を保存できませんでした。');}paintCanvases();};

for(const symbol of M.INCREASES){
 for(const id of ['stitch-symbol','structure-symbol']){const option=document.createElement('option');option.value=symbol.code;option.textContent=`${symbol.code} · ${symbol.name}`;$(id).append(option);}
}
const removeSymbol=document.createElement('option');removeSymbol.value='';removeSymbol.textContent='記号だけ消す';$('stitch-symbol').append(removeSymbol);
function symbolDescription(){const s=M.INCREASES.find(s=>s.code===$('stitch-symbol').value);$('symbol-description').textContent=s?`${s.code}：${s.description} このアプリでは増えた1目のマスに略号を置きます。`:'毛糸色を残して記号だけを消します。';}
$('stitch-symbol').onchange=symbolDescription;symbolDescription();
