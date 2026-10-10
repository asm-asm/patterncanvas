// First-run guide: three short steps on the sample chart. Shown once, only to people with no saved project,
// never to purchased or legacy users, and only after the trial sheet (if any) has been closed. Always skippable.
const DONE='patterncanvas-guide-done';
const STEPS=[
 {title:'編み図と編み地は、同じ柄',text:'このプレビューの1目は、編み図の1マスです。編み図の色を変えると、プレビューもその場で変わります。',targets:['#preview-panel','#chart-panel .chart-viewport']},
 {title:'色を選んで、マスをタップ',text:'毛糸の色を選んで編み図をタップすると、編み地もすぐ変わります。まちがえても「元に戻す」で戻せます。',targets:['#palette','#edit-history']},
 {title:'編めたら「この段を完了」',text:'今編んでいる段は赤い枠で表示されます。完了すると次の段へ進み、チェックが付きます。',targets:['#complete']},
];
export function setupGuide({firstRun,accessState}){
 const $=id=>document.getElementById(id),card=$('guide');
 const done=()=>{try{return localStorage.getItem(DONE)==='1';}catch{return false;}};
 const finish=()=>{try{localStorage.setItem(DONE,'1');}catch{}clear();card.hidden=true;};
 const clear=()=>document.querySelectorAll('.guide-focus').forEach(el=>el.classList.remove('guide-focus'));
 if(!card)return;
 if(!firstRun){finish();return;}
 let step=0;
 function show(){
  clear();const s=STEPS[step];$('guide-step').textContent=`${step+1} / ${STEPS.length}`;$('guide-title').textContent=s.title;$('guide-text').textContent=s.text;
  $('guide-next').textContent=step===STEPS.length-1?'はじめる':'次へ';card.hidden=false;
  const els=s.targets.map(sel=>document.querySelector(sel)).filter(Boolean);els.forEach(el=>el.classList.add('guide-focus'));els[0]?.scrollIntoView({block:'center',behavior:'smooth'});
 }
 $('guide-next').onclick=()=>{if(step<STEPS.length-1){step++;show();}else finish();};
 $('guide-skip').onclick=finish;
 // Start once nothing modal is open; the trial sheet goes first.
 const timer=setInterval(()=>{
  if(done()){clearInterval(timer);return;}
  const state=accessState();if(state==='checking')return;
  if(['legacy','purchased'].includes(state)){clearInterval(timer);finish();return;}
  if(document.querySelector('dialog[open]'))return;
  clearInterval(timer);document.querySelector('[data-view=both]')?.click();show();
 },400);
}
