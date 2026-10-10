import {blank} from './model.mjs';

// Photo -> 2 or 3 brightness tones -> knittable chart. Deterministic and local; no colour sampling.
// Tones are found at full resolution and each stitch takes a dark-first vote of its scale x scale block.
// bytes: RGBA raster of (columns*scale) x (rows*scale), top row first. Project rows start at the bottom.
export const PHOTO_LEVELS=[2,3],PHOTO_CLEANUP=[0,1,2,3],PHOTO_DETAIL=[0,1,2],PHOTO_CONTRAST=[0,1,2,3];
const NAMES={2:['明るい色','暗い色'],3:['明るい色','中間の色','暗い色']};

// Contrast 0-3: how hard to clip and S-curve the tones. Detail 0-2 (目鼻口の強調): small-scale sharpening plus
// a dark-first vote when shrinking, so thin eyes, brows and mouths survive instead of averaging into skin.
const CLIP=[.02,.04,.06,.08],CURVE=[0,.4,.7,1],SHARP=[0,1,1.8],DARK_SHARE=[.5,.4,.25];

function gaussBlur(src,width,height,sigma){
 const radius=Math.max(1,Math.ceil(sigma*2.5)),kernel=[];let total=0;for(let i=-radius;i<=radius;i++){const v=Math.exp(-i*i/(2*sigma*sigma));kernel.push(v);total+=v;}
 const tmp=new Float64Array(src.length),out=new Float64Array(src.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let i=-radius;i<=radius;i++)sum+=src[y*width+Math.min(width-1,Math.max(0,x+i))]*kernel[i+radius];tmp[y*width+x]=sum/total;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let i=-radius;i<=radius;i++)sum+=tmp[Math.min(height-1,Math.max(0,y+i))*width+x]*kernel[i+radius];out[y*width+x]=sum/total;}
 return out;
}

// Edge-preserving smoothing: flattens skin, fur and sensor texture but keeps the outline of features.
function bilateral(src,width,height,radius){
 const range=new Float64Array(256);for(let d=0;d<256;d++)range[d]=Math.exp(-d*d/(2*18*18));
 const out=new Float64Array(src.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const centre=src[y*width+x];let sum=0,weight=0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=height||xx>=width)continue;
   const v=src[yy*width+xx],w=Math.exp(-(dx*dx+dy*dy)/(2*radius*radius))*range[Math.min(255,Math.round(Math.abs(v-centre)))];sum+=v*w;weight+=w;}
  out[y*width+x]=sum/weight;}
 return out;
}

// Full-resolution tones (one value per source pixel, not per stitch).
function tones(bytes,width,height,scale,contrast,detail){
 let out=new Float64Array(width*height);
 for(let i=0;i<out.length;i++){const a=bytes[i*4+3]/255,over=c=>c*a+255*(1-a);out[i]=0.299*over(bytes[i*4])+0.587*over(bytes[i*4+1])+0.114*over(bytes[i*4+2]);}
 out=bilateral(out,width,height,Math.max(1,Math.round(scale/2)));
 // Auto levels on clipped percentiles, then an S-curve, so dull or backlit photos separate boldly.
 const sorted=[...out].sort((a,b)=>a-b),lo=sorted[Math.floor((sorted.length-1)*CLIP[contrast])],hi=sorted[Math.ceil((sorted.length-1)*(1-CLIP[contrast]))];
 out=out.map(v=>{if(hi-lo<1)return 128;const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return(t+(t*t*(3-2*t)-t)*CURVE[contrast])*255;});
 if(SHARP[detail]){const blur=gaussBlur(out,width,height,1.5*scale);out=out.map((v,i)=>v+SHARP[detail]*(v-blur[i]));}
 return out.map(v=>Math.max(0,Math.min(255,v)));
}

// Multi-level Otsu: thresholds that maximise between-class variance.
export function photoThresholds(values,levels){
 const hist=new Array(256).fill(0);for(const v of values)hist[Math.min(255,Math.round(v))]++;
 const n=new Array(257).fill(0),s=new Array(257).fill(0);for(let i=0;i<256;i++){n[i+1]=n[i]+hist[i];s[i+1]=s[i]+hist[i]*i;}
 const score=(a,b)=>{const c=n[b]-n[a];return c?(s[b]-s[a])**2/c:0;};
 if(levels===2){let best=[128],top=-1;for(let t=1;t<256;t++){const v=score(0,t)+score(t,256);if(v>top){top=v;best=[t];}}return best;}
 let best=[85,170],top=-1;
 for(let t1=1;t1<255;t1++)for(let t2=t1+1;t2<256;t2++){const v=score(0,t1)+score(t1,t2)+score(t2,256);if(v>top){top=v;best=[t1,t2];}}
 return best;
}

function majority(grid,columns,rows,levels){
 const next=grid.slice();
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const count=new Array(levels).fill(0);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&xx>=0&&yy<rows&&xx<columns)count[grid[yy*columns+xx]]++;}
  const own=grid[y*columns+x];let pick=own;for(let l=0;l<levels;l++)if(count[l]>count[pick])pick=l;
  if(count[pick]>=5)next[y*columns+x]=pick;
 }
 return next;
}

// Merge 4-connected specks smaller than minSize into their most common neighbouring tone.
function despeckle(grid,columns,rows,levels,minSize){
 for(let pass=0;pass<3;pass++){
  const seen=new Uint8Array(grid.length);let changed=false;
  for(let start=0;start<grid.length;start++){
   if(seen[start])continue;const tone=grid[start],cells=[start],border=new Array(levels).fill(0);seen[start]=1;
   for(let k=0;k<cells.length;k++){const i=cells[k],x=i%columns,y=(i-x)/columns;
    for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||yy<0||xx>=columns||yy>=rows)continue;const j=yy*columns+xx;
     if(grid[j]===tone){if(!seen[j]){seen[j]=1;cells.push(j);}}else border[grid[j]]++;}}
   if(cells.length>=minSize)continue;let pick=-1;for(let l=0;l<levels;l++)if(border[l]&&(pick<0||border[l]>border[pick]))pick=l;
   if(pick<0)continue;for(const i of cells)grid[i]=pick;changed=true;
  }
  if(!changed)break;
 }
 return grid;
}

export function isolatedStitches(p){
 let count=0;for(let r=0;r<p.rows;r++)for(let x=0;x<p.columns;x++){const c=p.cells[r][x];
  if(![[x-1,r],[x+1,r],[x,r-1],[x,r+1]].some(([xx,rr])=>p.cells[rr]?.[xx]===c))count++;}
 return count;
}

export function photoPattern(bytes,columns,rows,{scale=1,levels=3,balance=0,cleanup=1,detail=1,contrast=1,colors}={}){
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<4||columns>200||rows<4||rows>200)throw Error('目数・段数は4〜200で指定してください。');
 if(!Number.isInteger(scale)||scale<1||bytes.length!==columns*rows*scale*scale*4)throw Error('画像データの大きさが一致しません。');
 if(!PHOTO_LEVELS.includes(levels))throw Error('色数は2色か3色を選んでください。');
 if(!PHOTO_CLEANUP.includes(cleanup))throw Error('すっきり度は0〜3で指定してください。');
 if(!Number.isInteger(balance)||balance<-3||balance>3)throw Error('明るさのバランスは−3〜＋3で指定してください。');
 if(!PHOTO_DETAIL.includes(detail))throw Error('目鼻口の強調は0〜2で指定してください。');
 if(!PHOTO_CONTRAST.includes(contrast))throw Error('コントラストは0〜3で指定してください。');
 if(!Array.isArray(colors)||colors.length!==levels||!colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('毛糸の色を選んでください。');
 if(new Set(colors.map(c=>c.toLowerCase())).size!==levels)throw Error('毛糸にはそれぞれ違う色を選んでください。');
 const width=columns*scale,height=rows*scale,values=tones(bytes,width,height,scale,contrast,detail);
 // Positive balance moves thresholds down, so more stitches become the light yarn.
 const cuts=photoThresholds(values,levels).map(t=>Math.max(1,Math.min(255,t-balance*14)));
 const fine=Uint8Array.from(values,v=>levels-1-cuts.filter(t=>v>=t).length); // 0 = lightest
 let grid=new Uint8Array(columns*rows);const darkest=levels-1,need=DARK_SHARE[detail]*scale*scale;
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const count=new Array(levels).fill(0);
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)count[fine[(y*scale+dy)*width+x*scale+dx]]++;
  let pick=0;if(count[darkest]>=need)pick=darkest;else for(let l=1;l<levels;l++)if(count[l]>count[pick])pick=l;
  grid[y*columns+x]=pick;}
 // 1: single stray stitches only; higher levels also smooth outlines and merge small specks.
 for(let i=1;i<cleanup;i++)grid=majority(grid,columns,rows,levels);
 if(cleanup)grid=despeckle(grid,columns,rows,levels,[0,2,3,5][cleanup]);
 const p=blank(columns,rows);p.name='写真からの編み図';
 p.yarns=colors.map((color,id)=>({id,name:NAMES[levels][id],color}));
 p.cells=Array.from({length:rows},(_,r)=>Array.from(grid.subarray((rows-1-r)*columns,(rows-r)*columns)));
 return p;
}
