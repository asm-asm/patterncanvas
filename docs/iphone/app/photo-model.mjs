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

// Full-resolution tones (one value per source pixel, not per stitch) and the line-art mask.
function tones(bytes,width,height,scale,contrast,detail){
 let out=new Float64Array(width*height);
 for(let i=0;i<out.length;i++){const a=bytes[i*4+3]/255,over=c=>c*a+255*(1-a);out[i]=0.299*over(bytes[i*4])+0.587*over(bytes[i*4+1])+0.114*over(bytes[i*4+2]);}
 const original=out,radius=Math.max(1,Math.round(scale/2));out=bilateral(bilateral(out,width,height,radius),width,height,radius);
 // Auto levels on clipped percentiles, then an S-curve, so dull or backlit photos separate boldly.
 const hist=new Uint32Array(256);for(const v of out)hist[v<255?v|0:255]++;
 const at=q=>{let n=0;const want=q*(out.length-1);for(let i=0;i<256;i++){n+=hist[i];if(n>want)return i;}return 255;},lo=at(CLIP[contrast]),hi=at(1-CLIP[contrast])+1;
 out=out.map(v=>{if(hi-lo<1)return 128;const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return(t+(t*t*(3-2*t)-t)*CURVE[contrast])*255;});
 const fill=gaussBlur(out,width,height,.6*scale),line=new Uint8Array(width*height);
 if(LINE_SIGMA[detail]){const sigma=LINE_SIGMA[detail]*scale,inner=gaussBlur(out,width,height,sigma),outer=gaussBlur(out,width,height,1.6*sigma);for(let i=0;i<line.length;i++){const edge=inner[i]-.98*outer[i];line[i]=edge<LINE_EDGE[detail]&&(fill[i]<LIGHT||edge<STRONG)?1:0;}}
 // Catchlight score: how far a small point rises above its surround in the original photo (the highlight in a pupil).
 const glint=new Float64Array(width*height);
 if(detail&&scale>=3){const point=gaussBlur(original,width,height,.3*scale),around=gaussBlur(original,width,height,1.2*scale);for(let i=0;i<glint.length;i++)glint[i]=around[i]<150?point[i]-around[i]:0;}
 return{fill,line,glint};
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

// Line dots: a dark speck of a stitch or two that exists only because of the line art (a pore, a freckle, noise)
// and is surrounded by skin reads as a mole. Real dark shapes (nostrils, pupils) are dark in the fill and stay.
function dropLineDots(grid,fromLine,columns,rows,levels,maxSize){
 const darkest=levels-1,seen=new Uint8Array(grid.length);
 for(let start=0;start<grid.length;start++){
  if(seen[start]||grid[start]!==darkest)continue;const cells=[start],border=new Array(levels).fill(0);let lineOnly=true;seen[start]=1;
  for(let k=0;k<cells.length;k++){const i=cells[k],x=i%columns,y=(i-x)/columns;if(!fromLine[i])lineOnly=false;
   for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||yy<0||xx>=columns||yy>=rows)continue;const j=yy*columns+xx;
    if(grid[j]===darkest){if(!seen[j]){seen[j]=1;cells.push(j);}}else border[grid[j]]++;}}
  if(!lineOnly||cells.length>maxSize)continue;let pick=0;for(let l=1;l<darkest;l++)if(border[l]>border[pick])pick=l;
  for(const i of cells)grid[i]=pick;
 }
 return grid;
}

// Eyes: dark shapes of eye size, wider than tall, mostly bordered by lighter yarn. Lashes and hair strands often join
// an eye to the hair by a thin bridge, so shapes are found on the dark mask after a one-stitch erosion (bridges break,
// an iris survives). Hair masses stay larger or open to the edge. Each eye gets one light stitch where the photo's
// catchlight is strongest, if it has a clear one.
function eyeCatchlights(grid,best,columns,rows,levels){
 const darkest=levels-1,area=columns*rows,out=new Uint8Array(grid.length),core=new Uint8Array(grid.length),seen=new Uint8Array(grid.length);
 const dark=(x,y)=>x>=0&&y>=0&&x<columns&&y<rows&&grid[y*columns+x]===darkest;
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)core[y*columns+x]=dark(x,y)&&dark(x-1,y)&&dark(x+1,y)&&dark(x,y-1)&&dark(x,y+1)?1:0;
 const minEye=Math.max(2,Math.round(area/4000)),maxEye=Math.max(10,Math.round(area/90));
 for(let start=0;start<grid.length;start++){
  if(seen[start]||!core[start])continue;const cells=[start];let edge=false,x0=columns,x1=0,y0=rows,y1=0;seen[start]=1;
  for(let k=0;k<cells.length;k++){const i=cells[k],x=i%columns,y=(i-x)/columns;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<1||yy<1||xx>=columns-1||yy>=rows-1){edge=true;continue;}const j=yy*columns+xx;if(core[j]&&!seen[j]){seen[j]=1;cells.push(j);}}}
  const w=x1-x0+1,h=y1-y0+1;if(edge||cells.length<minEye||cells.length>maxEye||w<h*1.2)continue;
  let pick=-1;for(const i of cells)if(pick<0||best[i]>best[pick])pick=i;
  if(pick>=0&&best[pick]>25)out[pick]=1;
 }
 return out;
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
 const width=columns*scale,height=rows*scale,{fill:values,line,glint}=tones(bytes,width,height,scale,contrast,detail);
 // Positive balance moves thresholds down, so more stitches become the light yarn.
 const cuts=photoThresholds(values,levels).map((t,i)=>Math.max(1,Math.min(255,t-(i===0?DARK_SHIFT:0)-balance*14)));
 const fine=Uint8Array.from(values,v=>levels-1-cuts.filter(t=>v>=t).length); // 0 = lightest
 let grid=new Uint8Array(columns*rows);const need=Math.max(1,LINE_SHARE[detail]*scale*scale),fromLine=new Uint8Array(columns*rows),best=new Float64Array(columns*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const count=new Array(levels).fill(0);let lines=0,glints=0;
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const j=(y*scale+dy)*width+x*scale+dx;count[fine[j]]++;lines+=line[j];if(glint[j]>glints)glints=glint[j];}
  let pick=0;for(let l=1;l<levels;l++)if(count[l]>count[pick])pick=l;
  best[y*columns+x]=glints;if(lines>=need&&pick!==levels-1){pick=levels-1;fromLine[y*columns+x]=1;}
  grid[y*columns+x]=pick;}
 if(detail)grid=dropLineDots(grid,fromLine,columns,rows,levels,Math.max(2,Math.round(columns*rows/3000)));
 // Any tiny dark speck enclosed by lighter yarn reads as a mole on skin; nostrils and irises are larger.
 if(cleanup)grid=dropLineDots(grid,new Uint8Array(grid.length).fill(1),columns,rows,levels,Math.max(2,Math.round(columns*rows/1600)));
 const sparkle=detail?eyeCatchlights(grid,best,columns,rows,levels):new Uint8Array(grid.length);
 // 1: single stray stitches only; higher levels also smooth outlines and merge small specks.
 for(let i=1;i<cleanup;i++)grid=majority(grid,columns,rows,levels);
 if(cleanup)grid=despeckle(grid,columns,rows,levels,[0,2,3,5][cleanup]);
 // Cleanup must not erase catchlights, which are often a single stitch.
 for(let i=0;i<grid.length;i++)if(sparkle[i])grid[i]=0;
 const p=blank(columns,rows);p.name='写真からの編み図';
 p.yarns=colors.map((color,id)=>({id,name:NAMES[levels][id],color}));
 p.cells=Array.from({length:rows},(_,r)=>Array.from(grid.subarray((rows-1-r)*columns,(rows-r)*columns)));
 return p;
}
