import {textPattern} from './text-model.mjs';
import {TEXT_FONTS,textFont,loadTextFont,renderTextMask} from './text-fonts.mjs';

const FONT_KEY='patterncanvas-text-font';

export function setupTextImport({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('text-dialog');let next=null,run=0;
 for(const f of TEXT_FONTS){const o=document.createElement('option');o.value=f.id;o.textContent=f.label;$('text-font').append(o);}
 try{$('text-font').value=textFont(localStorage.getItem(FONT_KEY)).id;}catch{}
 async function update(){
  const mine=++run;next=null;$('text-apply').disabled=true;
  try{
   const text=$('text-content').value.trim(),w=Number($('text-width').value),h=Number($('text-height').value),font=textFont($('text-font').value);
   if(!text)throw Error('絵柄にしたい文字を入力してください。');
   if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||w>200||h<8||h>200)throw Error('目数・段数は8〜200で指定してください。');
   if(text.split(/\r?\n/).length>10)throw Error('改行は10行までにしてください。');
   $('text-font-hint').textContent=font.dots?`ドットの書体は、${font.dots}目 × ${font.dots}段 で1文字。目数・段数に合わせて整数倍に大きくなります。`:font.latin?'英数字の書体です。日本語の文字は標準のゴシックで描きます。':'';
   if(font.file){$('text-error').textContent='書体を読み込んでいます…';await loadTextFont(font);if(mine!==run)return;}
   const mask=renderTextMask(text,w,h,font);
   if(!mask.some(Boolean))throw Error('文字を描画できませんでした。別の文字をお試しください。');
   next=textPattern(mask,w,h,text,$('text-foreground').value,$('text-background').value);
   const preview=$('text-preview');preview.width=w;preview.height=h;preview.hidden=false;
   const out=preview.getContext('2d');for(let y=0;y<h;y++)for(let x=0;x<w;x++){out.fillStyle=next.yarns[next.cells[h-1-y][x]].color;out.fillRect(x,y,1,1);}
   $('text-error').textContent=`${w}目 × ${h}段・2色。作成後にマスを手直しできます。`;$('text-apply').disabled=false;
  }catch(e){if(mine!==run)return;next=null;$('text-preview').hidden=true;$('text-error').textContent=e.message;}
 }
 $('text-open').onclick=()=>{if(!editable())return;dialog.showModal();update();};
 $('text-cancel').onclick=()=>dialog.close();
 for(const id of ['text-content','text-width','text-height','text-foreground','text-background','text-font'])$(id).oninput=update;
 $('text-font').onchange=()=>{try{localStorage.setItem(FONT_KEY,$('text-font').value);}catch{}update();};
 $('text-apply').onclick=async()=>{if(!editable())return;await update();if(!next)return;if(!confirm('現在の作品を文字の編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('文字の編み図を作成しました。マスや毛糸名を編集できます。');};
}
