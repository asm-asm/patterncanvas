import {blank} from './model.mjs';

// Photo -> 2 or 3 brightness tones -> knittable chart. Deterministic and local; no colour sampling.
// bytes: RGBA raster of (columns*scale) x (rows*scale), top row first. Project rows start at the bottom.
export const PHOTO_LEVELS=[2,3],PHOTO_CLEANUP=[0,1,2,3],PHOTO_DETAIL=[0,1,2];
const NAMES={2:['明るい色','暗い色'],3:['明るい色','中間の色','暗い色']};

function boxBlur(src,columns,rows,radius){
 const tmp=new Float64Array(src.length),out=new Float64Array(src.length);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){let sum=0,n=0;for(let k=Math.max(0,x-radius);k<=Math.min(columns-1,x+radius);k++){sum+=src[y*columns+k];n++;}tmp[y*columns+x]=sum/n;}
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){let sum=0,n=0;for(let k=Math.max(0,y-radius);k<=Math.min(rows-1,y+radius);k++){sum+=tmp[k*columns+x];n++;}out[y*columns+x]=sum/n;}
 return out;
}

function tones(bytes,columns,rows,scale,detail){
 const width=columns*scale,out=new Float64Array(columns*rows);
 for(let y=0;y<rows*scale;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,a=bytes[i+3]/255,over=c=>c*a+255*(1-a);
  out[Math.floor(y/scale)*columns+Math.floor(x/scale)]+=0.299*over(bytes[i])+0.587*over(bytes[i+1])+0.114*over(bytes[i+2]);
 }
 for(let i=0;i<out.length;i++)out[i]/=scale*scale;
 // Local contrast: compare each stitch with its surroundings so faces separate from similar-toned backgrounds.
 if(detail>0){const blur=boxBlur(boxBlur(out,columns,rows,Math.max(2,Math.round(Math.max(columns,rows)/8))),columns,rows,Math.max(2,Math.round(Math.max(columns,rows)/8)));for(let i=0;i<out.length;i++)out[i]=out[i]+detail*(out[i]-blur[i]);}
 // Auto levels on the 2nd-98th percentile so dull or backlit photos still separate.
 const sorted=[...out].sort((a,b)=>a-b),lo=sorted[Math.floor((sorted.length-1)*.02)],hi=sorted[Math.ceil((sorted.length-1)*.98)];
 return out.map(v=>hi-lo<1?128:Math.max(0,Math.min(255,(v-lo)/(hi-lo)*255)));
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

export function photoPattern(bytes,columns,rows,{scale=1,levels=3,balance=0,cleanup=1,detail=1,colors}={}){
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<4||columns>200||rows<4||rows>200)throw Error('目数・段数は4〜200で指定してください。');
 if(!Number.isInteger(scale)||scale<1||bytes.length!==columns*rows*scale*scale*4)throw Error('画像データの大きさが一致しません。');
 if(!PHOTO_LEVELS.includes(levels))throw Error('色数は2色か3色を選んでください。');
 if(!PHOTO_CLEANUP.includes(cleanup))throw Error('すっきり度は0〜3で指定してください。');
 if(!Number.isInteger(balance)||balance<-3||balance>3)throw Error('明るさのバランスは−3〜＋3で指定してください。');
 if(!PHOTO_DETAIL.includes(detail))throw Error('細部の強調は0〜2で指定してください。');
 if(!Array.isArray(colors)||colors.length!==levels||!colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('毛糸の色を選んでください。');
 if(new Set(colors.map(c=>c.toLowerCase())).size!==levels)throw Error('毛糸にはそれぞれ違う色を選んでください。');
 const values=tones(bytes,columns,rows,scale,detail);
 // Positive balance moves thresholds down, so more stitches become the light yarn.
 const cuts=photoThresholds(values,levels).map(t=>Math.max(1,Math.min(255,t-balance*14)));
 let grid=Uint8Array.from(values,v=>levels-1-cuts.filter(t=>v>=t).length); // 0 = lightest
 // 1: single stray stitches only; higher levels also smooth outlines and merge small specks.
 for(let i=1;i<cleanup;i++)grid=majority(grid,columns,rows,levels);
 if(cleanup)grid=despeckle(grid,columns,rows,levels,[0,2,3,5][cleanup]);
 const p=blank(columns,rows);p.name='写真からの編み図';
 p.yarns=colors.map((color,id)=>({id,name:NAMES[levels][id],color}));
 p.cells=Array.from({length:rows},(_,r)=>Array.from(grid.subarray((rows-1-r)*columns,(rows-r)*columns)));
 return p;
}
