import {padPattern} from './model.mjs';
export function setupPadding({getPattern,editable,change,settings,message,clearSelection}){
 const $=id=>document.getElementById(id),dialog=$('padding-dialog');
 const amounts=()=>Object.fromEntries(['left','right','bottom','top'].map(side=>[side,Number($(`padding-${side}`).value)]));
 function preview(){
  const p=getPattern(),a=amounts(),valid=Object.values(a).every(n=>Number.isInteger(n)&&n>=0&&n<=100);
  const w=p.columns+a.left+a.right,h=p.rows+a.bottom+a.top;
  $('padding-size').textContent=valid?`追加後の1柄：${w}目 × ${h}段。全体：${w*p.horizontalRepeats}目 × ${h*p.verticalRepeats}段。横の柄間は${a.left+a.right}目、縦の柄間は${a.bottom+a.top}段増えます。`:'余白は0〜100の整数で指定してください。';
  $('padding-apply').disabled=!valid||!Object.values(a).some(Boolean)||w*p.horizontalRepeats>2000||h*p.verticalRepeats>2000;
 }
 $('padding-open').onclick=()=>{
  if(!editable())return;
  const p=getPattern();$('padding-color').replaceChildren();
  for(const y of p.yarns){const o=document.createElement('option');o.value=y.id;o.textContent=y.name;$('padding-color').append(o);}
  for(const side of ['left','right','bottom','top'])$(`padding-${side}`).value=0;
  $('padding-error').textContent='';dialog.showModal();preview();
 };
 for(const side of ['left','right','bottom','top'])$(`padding-${side}`).oninput=preview;
 $('padding-cancel').onclick=()=>dialog.close();
 $('padding-apply').onclick=()=>{
  if(!editable())return;
  try{
   const p=getPattern(),options={...amounts(),color:Number($('padding-color').value)};
   // Validate on a copy before the history transaction.
   padPattern(structuredClone(p),options);
   change(()=>padPattern(p,options));clearSelection();settings();dialog.close();
   message('柄の周囲に余白を追加しました。編み図の「元に戻す」で取り消せます。');
  }catch(e){$('padding-error').textContent=e.message;}
 };
}
