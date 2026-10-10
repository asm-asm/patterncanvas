import {yokePattern,yokePlan} from './yoke-model.mjs';
import {INCREASES} from './model.mjs';

// 「丸ヨークの編み図をつくる」: set the neck and hem stitch counts first; the increase rows and symbols are placed for you.
export function setupYoke({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('yoke-dialog');let next=null;
 for(const s of INCREASES){const o=document.createElement('option');o.value=s.code;o.textContent=`${s.code} · ${s.name}`;$('yoke-symbol').append(o);}
 const num=id=>Number($(id).value);
 function suggest(){
  const neck=num('yoke-neck'),bottom=num('yoke-bottom'),box=$('yoke-repeats-suggest');box.replaceChildren();
  if(!Number.isInteger(neck)||!Number.isInteger(bottom)||bottom<=neck)return;
  for(let k=4;k<=40;k++)if(neck%k===0&&bottom%k===0&&bottom/k<=200){const b=document.createElement('button');b.type='button';b.textContent=`${k}模様（1模様 ${neck/k}→${bottom/k}目）`;b.setAttribute('aria-pressed',String(k===num('yoke-repeats')));b.onclick=()=>{$('yoke-repeats').value=k;update();};box.append(b);}
  if(!box.children.length){const p=document.createElement('p');p.className='hint';p.textContent='首回りと裾の目数を、同じ数で割り切れる組み合わせにしてください（例：96目と288目）。';box.append(p);}
 }
 function update(){
  next=null;$('yoke-apply').disabled=true;$('yoke-error').textContent='';suggest();
  try{
   const o={neck:num('yoke-neck'),bottom:num('yoke-bottom'),repeats:num('yoke-repeats'),rows:num('yoke-rows'),rounds:num('yoke-rounds'),symbol:$('yoke-symbol').value};
   const plan=yokePlan(o);next=yokePattern(o);
   $('yoke-summary').textContent=`1模様 ${plan.w0}目 → ${plan.w1}目 × ${o.repeats}模様。増し目は ${plan.steps.map(s=>`${s.row}段目（+${s.perRepeat*o.repeats}目）`).join('・')}。`;
   // One repeat in knitting order, neck (row 1) at the top like the top-down chart; empty slots in grey.
   const c=$('yoke-preview'),w=next.columns,h=next.rows,cell=Math.max(4,Math.floor(Math.min(320/w,240/h)));c.width=w*cell;c.height=h*cell;const g=c.getContext('2d');
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const r=h-1-y,v=next.cells[r][x],s=next.symbols?.[r]?.[x];g.fillStyle=v===null?'#e2e4dc':s?'#dba487':'#f3ead9';g.fillRect(x*cell,y*cell,cell-1,cell-1);}
   $('yoke-apply').disabled=false;
  }catch(e){$('yoke-error').textContent=e.message;$('yoke-summary').textContent='';}
 }
 for(const id of ['yoke-neck','yoke-bottom','yoke-repeats','yoke-rows','yoke-rounds','yoke-symbol'])$(id).oninput=update;
 $('yoke-open').onclick=()=>{if(!editable())return;dialog.showModal();dialog.querySelector('.dialog-body').scrollTop=0;update();};
 $('yoke-cancel').onclick=$('yoke-dismiss').onclick=()=>dialog.close();
 $('yoke-apply').onclick=()=>{if(!editable())return;update();if(!next)return;if(!confirm('現在の作品を丸ヨークの編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('丸ヨークの編み図をつくりました。1模様を描くと、全周にくり返されます。「−」はまだ目がない場所です。');};
}
