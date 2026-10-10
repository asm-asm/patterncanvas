import {yokePattern,yokeSize,YOKE_SIZE_NAMES,YOKE_FITS} from './yoke-model.mjs';

// 「丸ヨークの編み図をつくる」: gauge + size (or measurements) → neck cast-on, increase rows, body/sleeve split and a
// one-repeat chart with the increases already in place, ready for the user's own motif.
export function setupYoke({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('yoke-dialog');let next=null,timer=0;
 const num=id=>Number(String($(id).value).replace(',','.'));
 for(const n of YOKE_SIZE_NAMES){const b=document.createElement('button');b.type='button';b.textContent=n;b.dataset.size=n;b.onclick=()=>{applySize(n);update();};$('yoke-sizes').append(b);}
 for(const [k,f] of Object.entries(YOKE_FITS)){const o=document.createElement('option');o.value=k;o.textContent=f.label;$('yoke-fit').append(o);}
 let size='M';
 function applySize(n){size=n;const s=yokeSize(n,$('yoke-fit').value);for(const [id,v] of [['yoke-chest',s.chest],['yoke-arm',s.arm],['yoke-neck',s.neck],['yoke-depth',s.depth]])$(id).value=v;}
 function update(){
  clearTimeout(timer);next=null;$('yoke-apply').disabled=true;$('yoke-error').textContent='';
  for(const b of $('yoke-sizes').children)b.setAttribute('aria-pressed',String(b.dataset.size===size));
  timer=setTimeout(()=>{try{
   const {pattern,design:d,schedule}=yokePattern({gaugeSts:num('yoke-gauge-sts'),gaugeRows:num('yoke-gauge-rows'),chest:num('yoke-chest'),arm:num('yoke-arm'),neck:num('yoke-neck'),depth:num('yoke-depth'),motif:num('yoke-motif')});
   next=pattern;const s=d.split;
   $('yoke-result').replaceChildren(...[
    ['首の作り目',`${d.neckSts}目（約${d.neckCm.toFixed(1)}cm）`],['模様',`${d.repeats}模様 × 1模様 ${d.w0}目 → ${d.w1}目`],
    ['ヨーク',`${d.rows}段・増し目${schedule.length}回（${schedule.join('・')}段目）`],['ヨーク完成',`${d.yokeSts}目`],
    ['身頃と袖',`後ろ${s.back}目／袖${s.sleeve}目／前${s.front}目／袖${s.sleeve}目`],['脇の作り目',`${s.underarm}目ずつ → 身頃${s.body}目`],
   ].map(([k,v])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;row.append(dt,dd);return row;}));
   // One repeat, neck (row 1) at the top as in the top-down chart; grey = no stitch yet, apricot = increase.
   const c=$('yoke-preview'),w=pattern.columns,h=pattern.rows,cell=Math.max(2,Math.floor(Math.min(300/w,260/h)));c.width=w*cell;c.height=h*cell;const scale=Math.min(300/c.width,260/c.height);c.style.width=`${c.width*scale}px`;c.style.height=`${c.height*scale}px`;const g=c.getContext('2d');
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const r=h-1-y,v=pattern.cells[r][x],sym=pattern.symbols[r][x];g.fillStyle=v===null?'#d8dbd2':sym?'#dba487':'#f3ead9';g.fillRect(x*cell,y*cell,cell-(cell>3?1:0),cell-(cell>3?1:0));}
   $('yoke-apply').disabled=false;
  }catch(e){$('yoke-error').textContent=e.message;$('yoke-result').replaceChildren();}},60);
 }
 $('yoke-fit').oninput=()=>{applySize(size);update();};
 for(const id of ['yoke-chest','yoke-arm','yoke-neck','yoke-depth'])$(id).oninput=()=>{size=null;update();};
 for(const id of ['yoke-gauge-sts','yoke-gauge-rows','yoke-motif'])$(id).oninput=update;
 $('yoke-open').onclick=()=>{if(!editable())return;if(size)applySize(size);dialog.showModal();dialog.querySelector('.dialog-body').scrollTop=0;update();};
 $('yoke-cancel').onclick=$('yoke-dismiss').onclick=()=>dialog.close();
 $('yoke-apply').onclick=()=>{if(!next||!editable())return;if(!confirm('現在の作品を丸ヨークの編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('丸ヨークの編み図をつくりました。1模様に柄を描くと全周にくり返されます。灰色の「−」はまだ目がない場所です。作り目・身頃と袖の分け方は段メモにあります。');};
 dialog.querySelector('.dialog-body').addEventListener('focusin',e=>{if(e.target.matches('input'))setTimeout(()=>e.target.scrollIntoView({block:'center'}),300);});
}
