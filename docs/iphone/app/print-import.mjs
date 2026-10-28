import {PAPERS,PRINT_MODES,CELL_SIZES} from './print-model.mjs';
import {preparePrint,renderPage,makePrintPdf} from './print-render.mjs';

// 「編み図をPDFで書き出す」: choose paper, colours or symbols and cell size, see page 1, then share the PDF
// (print, save to Files, …). Works while the chart is locked and after the trial: it only reads the project.
const KEY='patterncanvas-print-options';
export function setupPrint({project,numberFromRight,exportFile,message}){
 const $=id=>document.getElementById(id),dialog=$('print-dialog');let job=null,busy=false;
 const fill=(id,entries)=>{for(const [value,label] of entries){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}};
 fill('print-paper',Object.entries(PAPERS).map(([k,v])=>[k,v.label]));fill('print-mode',Object.entries(PRINT_MODES));fill('print-cell',Object.entries(CELL_SIZES));
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}})();
 const defaults={paper:'A4',orientation:'portrait',mode:'colorSymbols',cell:'fit'};
 for(const [id,key] of [['print-paper','paper'],['print-orientation','orientation'],['print-mode','mode'],['print-cell','cell']]){const v=saved[key]??defaults[key];if([...$(id).options].some(o=>o.value===v))$(id).value=v;}
 const options=()=>({paper:$('print-paper').value,landscape:$('print-orientation').value==='landscape',mode:$('print-mode').value,cell:$('print-cell').value,
  oneRepeat:!$('print-repeat-row').hidden&&$('print-one-repeat').checked,notes:!$('print-notes-row').hidden&&$('print-notes').checked,numberFromRight:numberFromRight()});
 function update(){
  job=null;$('print-apply').disabled=true;
  try{localStorage.setItem(KEY,JSON.stringify({paper:$('print-paper').value,orientation:$('print-orientation').value,mode:$('print-mode').value,cell:$('print-cell').value}));}catch{}
  try{
   const p=project(),o=options();job=preparePrint(p,o);const L=job.layout,chartPages=L.pages.length,notePages=job.notePages.length;
   $('print-summary').textContent=`${PAPERS[o.paper].label}${o.landscape?'横':'縦'}・${job.total}ページ（表${chartPages}ページ${notePages?`・段メモ${notePages}ページ`:''}）。1ページに${Math.min(L.colsPerPage,L.columns)}目×${Math.min(L.rowsPerPage,L.rows)}段、1マス約${L.cellMm.toFixed(1)}mm。`;
   const preview=renderPage(job,0,48),out=$('print-preview');out.width=preview.width;out.height=preview.height;out.getContext('2d').drawImage(preview,0,0);out.hidden=false;
   $('print-apply').disabled=busy;
  }catch(e){$('print-summary').textContent=e.message;$('print-preview').hidden=true;}
 }
 $('print-open').onclick=()=>{const p=project();$('print-repeat-row').hidden=p.horizontalRepeats*p.verticalRepeats<=1;$('print-notes-row').hidden=!Object.values(p.notes||{}).some(t=>String(t).trim());dialog.showModal();dialog.querySelector('.dialog-body').scrollTop=0;update();};
 $('print-cancel').onclick=()=>{if(!busy)dialog.close();};
 for(const id of ['print-paper','print-orientation','print-mode','print-cell','print-one-repeat','print-notes'])$(id).onchange=update;
 $('print-apply').onclick=async()=>{
  if(!job||busy)return;busy=true;$('print-apply').disabled=true;const label=$('print-apply').textContent;
  try{const pdf=await makePrintPdf(job,(done,total)=>{$('print-apply').textContent=`作成中… ${done} / ${total}ページ`;});
   const name=(job.p.name.replace(/[\\/:*?"<>|]/g,'_')||'pattern')+'.pdf';
   await exportFile(pdf,name,'application/pdf');dialog.close();message('共有画面から「プリント」で印刷、「"ファイル"に保存」で保存できます。');}
  catch(e){if(e?.message&&!/cancel/i.test(e.message))message('PDFを作成できませんでした。マスを小さくするなどしてもう一度お試しください。');}
  finally{busy=false;$('print-apply').textContent=label;$('print-apply').disabled=!job;}
 };
}
