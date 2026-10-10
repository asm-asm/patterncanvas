import {photoPattern,isolatedStitches} from './photo-model.mjs';

// Photo -> 2-3 tone chart. Everything runs on the device; the image is never uploaded.
const KEY='patterncanvas-photo-settings',SIZES=[['手軽',30],['標準',50],['細かめ',80]];
export function setupPhotoImport({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('photo-dialog');let source=null,next=null,timer=0,levels=3;
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({levels,detail:Number($('photo-detail').value),cleanup:Number($('photo-cleanup').value),colors:[0,1,2].map(i=>$(`photo-color-${i}`).value)}));}catch{}};
 try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){if([2,3].includes(s.levels))levels=s.levels;if([0,1,2].includes(s.detail))$('photo-detail').value=s.detail;if([0,1,2,3].includes(s.cleanup))$('photo-cleanup').value=s.cleanup;s.colors?.forEach((c,i)=>{if(/^#[0-9a-f]{6}$/i.test(c))$(`photo-color-${i}`).value=c;});}}catch{}
 const size=(id,label)=>{const n=Number($(id).value);if(!Number.isInteger(n)||n<4||n>200)throw Error(`${label}は4〜200の整数で入力してください。`);return n;};
 function area(columns,rows){const ratio=columns/rows,zoom=Number($('photo-zoom').value);let w=Math.min(source.width,source.height*ratio),h=Math.min(source.height,source.width/ratio);w/=zoom;h/=zoom;return{x:(source.width-w)*Number($('photo-x').value),y:(source.height-h)*Number($('photo-y').value),w,h};}
 function showSource(a){const c=$('photo-source'),scale=480/Math.max(source.width,source.height),x=0,y=0;c.width=Math.round(source.width*scale);c.height=Math.round(source.height*scale);const g=c.getContext('2d');g.drawImage(source,0,0,c.width,c.height);g.fillStyle='rgba(48,72,62,.45)';g.beginPath();g.rect(0,0,c.width,c.height);g.rect(x+a.x*scale,y+a.y*scale,a.w*scale,a.h*scale);g.fill('evenodd');g.strokeStyle='white';g.lineWidth=4;g.strokeRect(x+a.x*scale,y+a.y*scale,a.w*scale,a.h*scale);}
 function setSize(longest){const ratio=source.width/source.height;$('photo-width').value=Math.max(4,Math.min(200,Math.round(ratio>=1?longest:longest*ratio)));$('photo-height').value=Math.max(4,Math.min(200,Math.round(ratio>=1?longest/ratio:longest)));}
 function update(){clearTimeout(timer);next=null;$('photo-apply').disabled=true;$('photo-error').textContent='';
  for(const b of $('photo-levels').children)b.setAttribute('aria-pressed',String(Number(b.dataset.levels)===levels));$('photo-color-1-label').hidden=levels===2;
  timer=setTimeout(()=>{try{
   const columns=size('photo-width','目数'),rows=size('photo-height','段数'),a=area(columns,rows),scale=Math.max(1,Math.min(4,Math.floor(800/Math.max(columns,rows))));showSource(a);
   const c=document.createElement('canvas');c.width=columns*scale;c.height=rows*scale;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(source,a.x,a.y,a.w,a.h,0,0,c.width,c.height);
   const colors=levels===2?[$('photo-color-0').value,$('photo-color-2').value]:[0,1,2].map(i=>$(`photo-color-${i}`).value);
   next=photoPattern(g.getImageData(0,0,c.width,c.height).data,columns,rows,{scale,levels,colors,balance:Number($('photo-balance').value),detail:Number($('photo-detail').value),cleanup:Number($('photo-cleanup').value)});save();
   const out=$('photo-result');out.width=columns;out.height=rows;const ctx=out.getContext('2d'),img=ctx.createImageData(columns,rows);
   for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const color=parseInt(next.yarns[next.cells[rows-1-y][x]].color.slice(1),16),i=(y*columns+x)*4;img.data[i]=color>>16;img.data[i+1]=(color>>8)&255;img.data[i+2]=color&255;img.data[i+3]=255;}ctx.putImageData(img,0,0);
   const dots=isolatedStitches(next);$('photo-info').textContent=`${columns}目 × ${rows}段・${levels}色。`+(dots?`1目だけの点が${dots}か所あります。すっきり度を上げると減ります。`:'1目だけの点はありません。');$('photo-apply').disabled=false;
  }catch(error){next=null;$('photo-error').textContent=error.message;$('photo-info').textContent='';}},80);
 }
 for(const b of $('photo-levels').children)b.onclick=()=>{levels=Number(b.dataset.levels);update();};
 SIZES.forEach(([label,n])=>{const b=document.createElement('button');b.type='button';b.textContent=`${label}（長い辺${n}）`;b.onclick=()=>{setSize(n);update();};$('photo-sizes').append(b);});
 for(const id of ['photo-width','photo-height','photo-zoom','photo-x','photo-y','photo-balance','photo-detail','photo-cleanup','photo-color-0','photo-color-1','photo-color-2'])$(id).oninput=update;
 $('photo-file').onchange=async e=>{let url;try{if(!editable())return;const file=e.target.files[0];if(!file)return;if(file.size>20000000)throw Error('画像は20MB以下にしてください');url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));source=document.createElement('canvas');source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
   $('photo-zoom').value=1;$('photo-x').value=.5;$('photo-y').value=.5;$('photo-balance').value=0;setSize(50);dialog.showModal();dialog.querySelector('.dialog-body').scrollTop=0;update();
  }catch(error){message('写真を読み込めません：'+error.message);}finally{if(url)URL.revokeObjectURL(url);e.target.value='';}};
 $('photo-cancel').onclick=$('photo-dismiss').onclick=()=>dialog.close();dialog.addEventListener('close',()=>clearTimeout(timer));
 $('photo-apply').onclick=()=>{if(!next||!editable())return;if(!confirm('現在の作品を写真の編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('写真から編み図を作成しました。マスや毛糸の色・名前を編集できます。');};
}
