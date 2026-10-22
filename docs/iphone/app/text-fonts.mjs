// Typefaces for 「文字から編み図を作成」. All are free for commercial use and bundled in fonts/ (licences beside them),
// so they work offline. Pixel faces are drawn at their own dot size and enlarged whole-stitch, so every dot is one
// crisp block of stitches; outline faces are drawn to fit and thresholded.
export const TEXT_FONTS=[
 {id:'system',label:'ゴシック（標準）',family:'"Hiragino Sans", "Yu Gothic", sans-serif',weight:700},
 {id:'misaki',label:'ドット 8×8（美咲フォント）',file:'misaki_gothic.woff2',dots:8,baseline:6},
 {id:'pixelmplus',label:'ドット 12×12（PixelMplus）',file:'PixelMplus12-Bold.woff2',dots:12,baseline:9.6},
 {id:'zenmaru',label:'丸ゴシック（Zen Maru Gothic）',file:'ZenMaruGothic-Bold.woff2',weight:700},
 {id:'dela',label:'極太ゴシック（Dela Gothic One）',file:'DelaGothicOne-Regular.woff2'},
 {id:'yusei',label:'手書き風（Yusei Magic）',file:'YuseiMagic-Regular.woff2'},
 {id:'pacifico',label:'筆記体・英数字（Pacifico）',file:'Pacifico-Regular.woff2',latin:true},
];
const FALLBACK='"Hiragino Sans", "Yu Gothic", sans-serif',loaded=new Map();
const familyOf=f=>f.file?`"PC ${f.id}", ${FALLBACK}`:f.family;

export function textFont(id){return TEXT_FONTS.find(f=>f.id===id)||TEXT_FONTS[0];}

// Resolves once the bundled face can be drawn (a no-op for the system face).
export function loadTextFont(font){
 if(!font.file)return Promise.resolve();
 if(!loaded.has(font.id)){
  const face=new FontFace(`PC ${font.id}`,`url(${new URL(`fonts/${font.file}`,import.meta.url)})`,{weight:font.weight?String(font.weight):'400'});
  loaded.set(font.id,face.load().then(f=>{document.fonts.add(f);},e=>{loaded.delete(font.id);throw Error('書体を読み込めませんでした。もう一度お試しください。');}));
 }
 return loaded.get(font.id);
}

// Returns a w×h mask (row-major, top row first) with the text centred, or throws a message for the user.
export function renderTextMask(text,w,h,font){
 const lines=text.split(/\r?\n/);
 return font.dots?pixelMask(lines,w,h,font):outlineMask(lines,w,h,font);
}

function outlineMask(lines,w,h,font){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),css=s=>`${font.weight||400} ${s}px ${familyOf(font)}`;
 let size=1;
 for(let s=1;s<=400;s++){ctx.font=css(s);if(Math.max(...lines.map(l=>ctx.measureText(l).width))>w-4||s*1.3*lines.length>h-4)break;size=s;}
 if(size<5)throw Error('文字が細かすぎます。目数・段数を増やすか、文字を短くするか、ドットの書体をお試しください。');
 ctx.font=css(size);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#000';
 lines.forEach((line,i)=>ctx.fillText(line,w/2,h/2+(i-(lines.length-1)/2)*size*1.3));
 const rgba=ctx.getImageData(0,0,w,h).data;return Array.from({length:w*h},(_,i)=>rgba[i*4+3]>=96);
}

function pixelMask(lines,w,h,font){
 // Draw at the face's own dot size with the dot grid on whole pixels, then crop to the ink.
 const d=font.dots,probe=document.createElement('canvas').getContext('2d'),css=`${d}px ${familyOf(font)}`;probe.font=css;
 const widths=lines.map(l=>Math.round(probe.measureText(l).width)),W=Math.max(1,...widths),H=d*lines.length;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.font=css;ctx.textBaseline='alphabetic';ctx.fillStyle='#000';
 lines.forEach((line,i)=>ctx.fillText(line,Math.floor((W-widths[i])/2),i*d+font.baseline));
 const rgba=ctx.getImageData(0,0,W,H).data,ink=(x,y)=>rgba[(y*W+x)*4+3]>=128;
 let x0=W,x1=-1,y0=H,y1=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(ink(x,y)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<0)return Array(w*h).fill(false);
 const cw=x1-x0+1,ch=y1-y0+1,k=Math.min(Math.floor(w/cw),Math.floor(h/ch));
 if(k<1)throw Error(`このドットの書体には ${cw}目 × ${ch}段 以上が必要です。目数・段数を増やすか、文字を短くしてください。`);
 const ox=Math.floor((w-cw*k)/2),oy=Math.floor((h-ch*k)/2),mask=Array(w*h).fill(false);
 for(let y=0;y<ch*k;y++)for(let x=0;x<cw*k;x++)mask[(oy+y)*w+ox+x]=ink(x0+Math.floor(x/k),y0+Math.floor(y/k));
 return mask;
}
