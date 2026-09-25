import {textPattern} from './text-model.mjs';

export function setupTextImport({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('text-dialog');let next=null;
 function update(){
  next=null;$('text-apply').disabled=true;$('text-preview').hidden=true;
  try{
   const text=$('text-content').value.trim(),w=Number($('text-width').value),h=Number($('text-height').value);
   if(!text)throw Error('絵柄にしたい文字を入力してください。');
   if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||w>200||h<8||h>200)throw Error('目数・段数は8〜200で指定してください。');
   const lines=text.split(/\r?\n/);if(lines.length>10)throw Error('改行は10行までにしてください。');
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),font='"Hiragino Sans", "Yu Gothic", sans-serif';
   let size=1;
   for(let s=1;s<=400;s++){ctx.font=`700 ${s}px ${font}`;if(Math.max(...lines.map(l=>ctx.measureText(l).width))>w-4||s*1.3*lines.length>h-4)break;size=s;}
   if(size<5)throw Error('文字が細かすぎます。目数・段数を増やすか、文字を短くしてください。');
   ctx.font=`700 ${size}px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#000';
   lines.forEach((line,i)=>ctx.fillText(line,w/2,h/2+(i-(lines.length-1)/2)*size*1.3));
   const rgba=ctx.getImageData(0,0,w,h).data,mask=Array.from({length:w*h},(_,i)=>rgba[i*4+3]>=96);
   if(!mask.some(Boolean))throw Error('文字を描画できませんでした。別の文字をお試しください。');
   next=textPattern(mask,w,h,text,$('text-foreground').value,$('text-background').value);
   const preview=$('text-preview');preview.width=w;preview.height=h;preview.hidden=false;
   const out=preview.getContext('2d');for(let y=0;y<h;y++)for(let x=0;x<w;x++){out.fillStyle=next.yarns[next.cells[h-1-y][x]].color;out.fillRect(x,y,1,1);}
   $('text-error').textContent=`${w}目 × ${h}段・2色。作成後にマスを手直しできます。`;$('text-apply').disabled=false;
  }catch(e){$('text-error').textContent=e.message;}
 }
 $('text-open').onclick=()=>{if(!editable())return;dialog.showModal();update();};
 $('text-cancel').onclick=()=>dialog.close();
 for(const id of ['text-content','text-width','text-height','text-foreground','text-background'])$(id).oninput=update;
 $('text-apply').onclick=()=>{if(!editable())return;update();if(!next)return;if(!confirm('現在の作品を文字の編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('文字の編み図を作成しました。マスや毛糸名を編集できます。');};
}
