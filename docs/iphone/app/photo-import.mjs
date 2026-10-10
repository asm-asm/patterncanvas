import {photoPattern,isolatedStitches} from './photo-model.mjs';

// Photo -> 2-3 tone chart. Everything runs on the device; the image is never uploaded.
const KEY='patterncanvas-photo-settings',SIZES=[['手軽',40],['標準',60],['細かめ',90],['とても細かい',120]];
export function setupPhotoImport({replace,editable,message}){
 const $=id=>document.getElementById(id),dialog=$('photo-dialog');let source=null,next=null,timer=0,levels=3,shown=null,shape='photo',longest=90;
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({levels,shape,detail:Number($('photo-detail').value),contrast:Number($('photo-contrast').value),cleanup:Number($('photo-cleanup').value),colors:[0,1,2].map(i=>$(`photo-color-${i}`).value)}));}catch{}};
 try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){if([2,3].includes(s.levels))levels=s.levels;if(['photo','square'].includes(s.shape))shape=s.shape;if([0,1,2].includes(s.detail))$('photo-detail').value=s.detail;if([0,1,2,3].includes(s.contrast))$('photo-contrast').value=s.contrast;if([0,1,2,3].includes(s.cleanup))$('photo-cleanup').value=s.cleanup;s.colors?.forEach((c,i)=>{if(/^#[0-9a-f]{6}$/i.test(c))$(`photo-color-${i}`).value=c;});}}catch{}
 const size=(id,label)=>{const n=Number($(id).value);if(!Number.isInteger(n)||n<4||n>200)throw Error(`${label}は4〜200の整数で入力してください。`);return n;};
 function area(columns,rows){const ratio=columns/rows,zoom=Number($('photo-zoom').value);let w=Math.min(source.width,source.height*ratio),h=Math.min(source.height,source.width/ratio);w/=zoom;h/=zoom;return{x:(source.width-w)*Number($('photo-x').value),y:(source.height-h)*Number($('photo-y').value),w,h};}
 function drawSource(c,a,size){const scale=size/Math.max(source.width,source.height);c.width=Math.round(source.width*scale);c.height=Math.round(source.height*scale);const g=c.getContext('2d');g.drawImage(source,0,0,c.width,c.height);g.fillStyle='rgba(48,72,62,.45)';g.beginPath();g.rect(0,0,c.width,c.height);g.rect(a.x*scale,a.y*scale,a.w*scale,a.h*scale);g.fill('evenodd');g.strokeStyle='white';g.lineWidth=Math.max(3,size/160);g.strokeRect(a.x*scale,a.y*scale,a.w*scale,a.h*scale);}
 function showSource(a){shown=a;drawSource($('photo-source'),a,480);if(!$('photo-crop').hidden)drawSource($('photo-crop-canvas'),a,900);}
 // Presets give the long side; the short side follows the photo, or equals it for a square crop.
 function setSize(n){longest=n;const ratio=shape==='square'?1:source.width/source.height;$('photo-width').value=Math.max(4,Math.min(200,Math.round(ratio>=1?longest:longest*ratio)));$('photo-height').value=Math.max(4,Math.min(200,Math.round(ratio>=1?longest/ratio:longest)));}
 function update(){clearTimeout(timer);next=null;$('photo-apply').disabled=true;$('photo-error').textContent='';
  for(const b of $('photo-levels').children)b.setAttribute('aria-pressed',String(Number(b.dataset.levels)===levels));for(const b of $('photo-shapes').children)b.setAttribute('aria-pressed',String(b.dataset.shape===shape));for(const b of $('photo-sizes').children)b.setAttribute('aria-pressed',String(Number(b.dataset.longest)===longest&&Math.max(Number($('photo-width').value),Number($('photo-height').value))===longest));$('photo-color-1-label').hidden=levels===2;
  timer=setTimeout(()=>{try{
   const columns=size('photo-width','目数'),rows=size('photo-height','段数'),a=area(columns,rows),scale=Math.max(3,Math.min(6,Math.floor(600/Math.max(columns,rows))));showSource(a);
   const c=document.createElement('canvas');c.width=columns*scale;c.height=rows*scale;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(source,a.x,a.y,a.w,a.h,0,0,c.width,c.height);
   const colors=levels===2?[$('photo-color-0').value,$('photo-color-2').value]:[0,1,2].map(i=>$(`photo-color-${i}`).value);
   next=photoPattern(g.getImageData(0,0,c.width,c.height).data,columns,rows,{scale,levels,colors,balance:Number($('photo-balance').value),detail:Number($('photo-detail').value),contrast:Number($('photo-contrast').value),cleanup:Number($('photo-cleanup').value)});save();
   const out=$('photo-result');out.width=columns;out.height=rows;const ctx=out.getContext('2d'),img=ctx.createImageData(columns,rows);
   for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const color=parseInt(next.yarns[next.cells[rows-1-y][x]].color.slice(1),16),i=(y*columns+x)*4;img.data[i]=color>>16;img.data[i+1]=(color>>8)&255;img.data[i+2]=color&255;img.data[i+3]=255;}ctx.putImageData(img,0,0);
   const dots=isolatedStitches(next);$('photo-info').textContent=`${columns}目 × ${rows}段・${levels}色。`+(dots?`1目だけの点が${dots}か所あります。すっきり度を上げると減ります。`:'1目だけの点はありません。');$('photo-apply').disabled=false;
  }catch(error){next=null;$('photo-error').textContent=error.message;$('photo-info').textContent='';}},80);
 }
 for(const b of $('photo-levels').children)b.onclick=()=>{levels=Number(b.dataset.levels);update();};
 for(const b of $('photo-shapes').children)b.onclick=()=>{shape=b.dataset.shape;setSize(longest);update();};
 SIZES.forEach(([label,n])=>{const b=document.createElement('button');b.type='button';b.dataset.longest=n;b.textContent=`${label}（長い辺${n}）`;b.onclick=()=>{setSize(n);update();};$('photo-sizes').append(b);});
 for(const id of ['photo-width','photo-height','photo-zoom','photo-x','photo-y','photo-balance','photo-contrast','photo-detail','photo-cleanup','photo-color-0','photo-color-1','photo-color-2'])$(id).oninput=update;
 $('photo-file').onchange=async e=>{let url;try{if(!editable())return;const file=e.target.files[0];if(!file)return;if(file.size>20000000)throw Error('画像は20MB以下にしてください');url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));source=document.createElement('canvas');source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
   $('photo-zoom').value=1;$('photo-x').value=.5;$('photo-y').value=.5;$('photo-balance').value=0;setSize(90);$('photo-crop').hidden=true;dialog.showModal();dialog.querySelector('.dialog-body').scrollTop=0;update();
  }catch(error){message('写真を読み込めません：'+error.message);}finally{if(url)URL.revokeObjectURL(url);e.target.value='';}};
 // Trim in a dedicated crop view so scrolling the dialog never moves the frame: drag to move, pinch (or wheel) to zoom.
 // The sliders stay the source of truth.
 const crop=open=>{$('photo-crop').hidden=!open;if(open&&shown)drawSource($('photo-crop-canvas'),shown,900);};
 $('photo-crop-open').onclick=$('photo-crop-button').onclick=()=>{if(source)crop(true);};$('photo-crop-done').onclick=()=>crop(false);
 $('photo-crop-reset').onclick=()=>{$('photo-zoom').value=1;$('photo-x').value=.5;$('photo-y').value=.5;update();};
 const touches=new Map();let pinch=0;
 const toSource=()=>{const c=$('photo-crop-canvas'),r=c.getBoundingClientRect();return Math.min(r.width/c.width,r.height/c.height)*c.width/source.width;};
 const zoomBy=f=>{$('photo-zoom').value=Math.max(1,Math.min(6,Number($('photo-zoom').value)*f));update();};
 $('photo-crop-canvas').addEventListener('pointerdown',e=>{if(!source)return;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const [a,b]=[...touches.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
 $('photo-crop-canvas').addEventListener('pointermove',e=>{const last=touches.get(e.pointerId);if(!last||!shown)return;const now={x:e.clientX,y:e.clientY};touches.set(e.pointerId,now);
  if(touches.size>=2){const [a,b]=[...touches.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0&&d>0)zoomBy(d/pinch);pinch=d;return;}
  const k=toSource(),move=(id,delta,free)=>{if(free>0)$(id).value=Math.max(0,Math.min(1,Number($(id).value)+delta/k/free));};
  move('photo-x',now.x-last.x,source.width-shown.w);move('photo-y',now.y-last.y,source.height-shown.h);update();});
 for(const type of ['pointerup','pointercancel'])$('photo-crop-canvas').addEventListener(type,e=>{touches.delete(e.pointerId);pinch=0;});
 $('photo-crop-canvas').addEventListener('wheel',e=>{if(!source)return;e.preventDefault();zoomBy(e.deltaY<0?1.1:1/1.1);},{passive:false});
 $('photo-cancel').onclick=$('photo-dismiss').onclick=()=>dialog.close();dialog.addEventListener('close',()=>clearTimeout(timer));
 $('photo-apply').onclick=()=>{if(!next||!editable())return;if(!confirm('現在の作品を写真の編み図に置き換えますか？必要なら先に作品を書き出してください。'))return;replace(next);dialog.close();message('写真から編み図を作成しました。マスや毛糸の色・名前を編集できます。');};
}
