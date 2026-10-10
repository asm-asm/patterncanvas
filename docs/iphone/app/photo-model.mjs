import {blank} from './model.mjs';

// Photo -> 2 or 3 brightness tones -> knittable chart. Deterministic and local; no colour sampling.
// Tones and line art are found at full resolution; each stitch then votes over its scale x scale block.
// bytes: RGBA raster of (columns*scale) x (rows*scale), top row first. Project rows start at the bottom.
export const PHOTO_LEVELS=[2,3],PHOTO_CLEANUP=[0,1,2,3],PHOTO_DETAIL=[0,1,2],PHOTO_CONTRAST=[0,1,2,3];
const NAMES={2:['明るい色','暗い色'],3:['明るい色','中間の色','暗い色']};

// Contrast 0-3: how hard to clip and S-curve the tones. Detail 0-2 (目鼻口の強調): XDoG line art (difference of
// Gaussians) drawn in the darkest yarn, so eyes, nose, mouth and the jaw read as an illustration instead of a blur.
// Line widths are in stitches; a stitch becomes a line when enough of its source pixels are on a line.
// Lines inside the lightest areas (pale hair, highlights) are dropped unless the edge is strong, so hair strands
// do not turn into black streaks; the darkest fill is kept for clearly dark tones so shadows stay soft.
const CLIP=[.02,.04,.06,.08],CURVE=[0,.4,.7,1],LINE_SIGMA=[0,.6,.5],LINE_EDGE=[0,-6,-4],LINE_SHARE=[1,.35,.25],LIGHT=170,STRONG=-16,DARK_SHIFT=18;
function gaussBlur(src,width,height,sigma){
 const radius=Math.max(1,Math.ceil(sigma*2.5)),kernel=[];let total=0;for(let i=-radius;i<=radius;i++){const v=Math.exp(-i*i/(2*sigma*sigma));kernel.push(v);total+=v;}
 const tmp=new Float64Array(src.length),out=new Float64Array(src.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let i=-radius;i<=radius;i++)sum+=src[y*width+Math.min(width-1,Math.max(0,x+i))]*kernel[i+radius];tmp[y*width+x]=sum/total;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let i=-radius;i<=radius;i++)sum+=tmp[Math.min(height-1,Math.max(0,y+i))*width+x]*kernel[i+radius];out[y*width+x]=sum/total;}
 return out;
}

// Edge-preserving smoothing: flattens skin, fur and sensor texture but keeps the outline of features.
function bilateral(src,width,height,radius){
 const range=new Float64Array(256),size=radius*2+1,space=new Float64Array(size*size);
 for(let d=0;d<256;d++)range[d]=Math.exp(-d*d/(2*18*18));
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)space[(dy+radius)*size+dx+radius]=Math.exp(-(dx*dx+dy*dy)/(2*radius*radius));
 const out=new Float64Array(src.length);
 for(let y=0;y<height;y++){const y0=Math.max(0,y-radius),y1=Math.min(height-1,y+radius);
  for(let x=0;x<width;x++){const centre=src[y*width+x],x0=Math.max(0,x-radius),x1=Math.min(width-1,x+radius);let sum=0,weight=0;
   for(let yy=y0;yy<=y1;yy++){const row=yy*width,k=(yy-y+radius)*size+radius-x;
    for(let xx=x0;xx<=x1;xx++){const v=src[row+xx],d=v>centre?v-centre:centre-v,w=space[k+xx]*range[d<255?d|0:255];sum+=v*w;weight+=w;}}
   out[y*width+x]=sum/weight;}}
 return out;
}

// Grayscale opening (min then max over a square): removes bright specks smaller than the square, such as the
// catchlight in a pupil, without moving larger shapes. Separable, so cost is linear in the radius.
function extreme(src,width,height,radius,pick){
 const tmp=new Float64Array(src.length),out=new Float64Array(src.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let v=src[y*width+x];for(let k=Math.max(0,x-radius);k<=Math.min(width-1,x+radius);k++)v=pick(v,src[y*width+k]);tmp[y*width+x]=v;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let v=tmp[y*width+x];for(let k=Math.max(0,y-radius);k<=Math.min(height-1,y+radius);k++)v=pick(v,tmp[k*width+x]);out[y*width+x]=v;}
 return out;
}
const opening=(src,width,height,radius)=>extreme(extreme(src,width,height,radius,Math.min),width,height,radius,Math.max);

// Full-resolution tones (one value per source pixel, not per stitch) and the line-art mask.
function tones(bytes,width,height,scale,contrast,detail){
 let out=new Float64Array(width*height);
 for(let i=0;i<out.length;i++){const a=bytes[i*4+3]/255,over=c=>c*a+255*(1-a);out[i]=0.299*over(bytes[i*4])+0.587*over(bytes[i*4+1])+0.114*over(bytes[i*4+2]);}
 const radius=Math.max(1,Math.round(scale/2));if(detail)out=opening(out,width,height,Math.max(1,Math.round(scale*.4)));out=bilateral(bilateral(out,width,height,radius),width,height,radius);
 // Auto levels on clipped percentiles, then an S-curve, so dull or backlit photos separate boldly.
 const hist=new Uint32Array(256);for(const v of out)hist[v<255?v|0:255]++;
 const at=q=>{let n=0;const want=q*(out.length-1);for(let i=0;i<256;i++){n+=hist[i];if(n>want)return i;}return 255;},lo=at(CLIP[contrast]),hi=at(1-CLIP[contrast])+1;
 out=out.map(v=>{if(hi-lo<1)return 128;const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return(t+(t*t*(3-2*t)-t)*CURVE[contrast])*255;});
 const fill=gaussBlur(out,width,height,.6*scale),line=new Uint8Array(width*height);
 if(LINE_SIGMA[detail]){const sigma=LINE_SIGMA[detail]*scale,inner=gaussBlur(out,width,height,sigma),outer=gaussBlur(out,width,height,1.6*sigma);for(let i=0;i<line.length;i++){const edge=inner[i]-.98*outer[i];line[i]=edge<LINE_EDGE[detail]&&(fill[i]<LIGHT||edge<STRONG)?1:0;}}
 return{fill,line};
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

// Catchlights: small lighter islands enclosed (mostly) by the darkest yarn, e.g. the highlight in a pupil, read as a
// hollow eye in yarn. Fill them with the darkest yarn. The size limit grows with the chart so big charts are covered too.
function fillCatchlights(grid,columns,rows,levels){
 const darkest=levels-1,maxSize=Math.max(2,Math.round(columns*rows/1200)),seen=new Uint8Array(grid.length);
 for(let start=0;start<grid.length;start++){
  if(seen[start]||grid[start]===darkest)continue;const cells=[start];let dark=0,other=0,edge=false;seen[start]=1;
  for(let k=0;k<cells.length&&cells.length<=maxSize;k++){const i=cells[k],x=i%columns,y=(i-x)/columns;
   for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||yy<0||xx>=columns||yy>=rows){edge=true;continue;}const j=yy*columns+xx;
    if(grid[j]===darkest)dark++;else if(!seen[j]){seen[j]=1;cells.push(j);}}}
  if(!edge&&cells.length<=maxSize&&dark>=.75*(dark+other))for(const i of cells)grid[i]=darkest;
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
 if(!PHOTO_DETAIL.includes(detail))throw Error('目・鼻・口の線は0〜2で指定してください。');
 if(!PHOTO_CONTRAST.includes(contrast))throw Error('コントラストは0〜3で指定してください。');
 if(!Array.isArray(colors)||colors.length!==levels||!colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('毛糸の色を選んでください。');
 if(new Set(colors.map(c=>c.toLowerCase())).size!==levels)throw Error('毛糸にはそれぞれ違う色を選んでください。');
 const width=columns*scale,height=rows*scale,{fill:values,line}=tones(bytes,width,height,scale,contrast,detail);
 // Positive balance moves thresholds down, so more stitches become the light yarn.
 const cuts=photoThresholds(values,levels).map((t,i)=>Math.max(1,Math.min(255,t-(i===0?DARK_SHIFT:0)-balance*14)));
 const fine=Uint8Array.from(values,v=>levels-1-cuts.filter(t=>v>=t).length); // 0 = lightest
 let grid=new Uint8Array(columns*rows);const need=Math.max(1,LINE_SHARE[detail]*scale*scale);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const count=new Array(levels).fill(0);let lines=0;
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const j=(y*scale+dy)*width+x*scale+dx;count[fine[j]]++;lines+=line[j];}
  let pick=0;if(lines>=need)pick=levels-1;else for(let l=1;l<levels;l++)if(count[l]>count[pick])pick=l;
  grid[y*columns+x]=pick;}
 // 1: single stray stitches only; higher levels also smooth outlines and merge small specks.
 if(detail)grid=fillCatchlights(grid,columns,rows,levels);
 for(let i=1;i<cleanup;i++)grid=majority(grid,columns,rows,levels);
 if(cleanup)grid=despeckle(grid,columns,rows,levels,[0,2,3,5][cleanup]);
 const p=blank(columns,rows);p.name='写真からの編み図';
 p.yarns=colors.map((color,id)=>({id,name:NAMES[levels][id],color}));
 p.cells=Array.from({length:rows},(_,r)=>Array.from(grid.subarray((rows-1-r)*columns,(rows-r)*columns)));
 return p;
}
