import {colorAt,symbolAt,rowNumber} from './model.mjs';
import {stitchNumber} from './draw.mjs';
import {layoutPrint,printedProject,yarnGlyphs,yarnUsage,usedIncreases,pageRange,hasNoStitch} from './print-model.mjs';
import {buildPdf} from './pdf.mjs';

// Draws printable pages on canvases (millimetre layout from print-model) and packs them into a PDF.
const FONT='"Hiragino Sans", "Yu Gothic", sans-serif',INK='#222222',MUTED='#5b6358',NO_STITCH='#d6d6d6',REPEAT='#b0304a';
function contrast(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#000000':'#ffffff';}
// Enough resolution for print without exceeding the iOS canvas limit on A3.
export const printDpi=layout=>Math.min(300,Math.floor(Math.sqrt(9e6/((layout.pageW/25.4)*(layout.pageH/25.4)))));

/** Everything a page needs: the printed project, its layout and the yarn glyphs. */
export function preparePrint(p,options){
 const q=printedProject(p,options.oneRepeat),layout=layoutPrint(q,options),notePages=paginateNotes(layout);
 return {p:q,options,layout,notePages,glyphs:yarnGlyphs(q),usage:yarnUsage(q),increases:usedIncreases(q),noStitch:hasNoStitch(q),total:layout.pages.length+notePages.length};
}

// Row notes wrap to the page width; each page holds as many lines as fit.
const NOTE_FONT=3.2,NOTE_LINE=5,NOTE_INDENT=18;
function paginateNotes(L){
 if(!L.notes.length)return [];
 const c=document.createElement('canvas').getContext('2d');font(c,NOTE_FONT);const width=L.pageW-L.margin*2-NOTE_INDENT,perPage=Math.floor((L.pageH-L.margin*2-22)/NOTE_LINE);
 const lines=[];
 for(const note of L.notes){let line='',first=true;
  // Closing punctuation stays at the end of a line rather than starting the next one.
  for(const ch of note.text.replace(/\s+/g,' ')){if(c.measureText(line+ch).width>width&&line&&!'、。，．）」』！？・ー'.includes(ch)){lines.push({row:first?note.row:null,text:line});first=false;line='';}line+=ch;}
  lines.push({row:first?note.row:null,text:line});}
 const pages=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));return pages;
}

function pageCanvas(job,dpi){
 const {layout}=job,k=dpi/25.4,canvas=document.createElement('canvas');
 canvas.width=Math.round(layout.pageW*k);canvas.height=Math.round(layout.pageH*k);
 const c=canvas.getContext('2d');c.scale(k,k);c.fillStyle='#ffffff';c.fillRect(0,0,layout.pageW,layout.pageH);c.textBaseline='middle';
 return {canvas,c};
}
const font=(c,size,bold=false)=>{c.font=`${bold?'700 ':''}${size}px ${FONT}`;};

function header(job,c,index,subtitle){
 const {layout,p}=job,m=layout.margin;
 font(c,5,true);c.fillStyle=INK;c.textAlign='left';c.fillText(p.name||'編み図',m,m+3,layout.pageW-m*2-40);
 font(c,2.4);c.fillStyle=MUTED;c.textAlign='right';c.fillText('編みものノート',layout.pageW-m,m+3);
 font(c,3);c.textAlign='left';c.fillText(subtitle,m,m+9.5,layout.pageW-m*2);
 font(c,2.6);c.textAlign='center';c.fillText(`${index+1} / ${job.total}`,layout.pageW/2,layout.pageH-m/2);
}

function legend(job,c){
 const {layout,p,glyphs,usage,increases,options}=job,m=layout.margin,usable=layout.pageW-m*2,chip=46,perLine=Math.max(1,Math.floor(usable/chip));
 let y=m+15;const yarns=p.yarns.filter(yn=>glyphs.has(yn.id));
 yarns.forEach((yn,i)=>{const x=m+(i%perLine)*chip,yy=y+Math.floor(i/perLine)*6.5;
  c.fillStyle=options.mode==='mono'?'#ffffff':yn.color;c.fillRect(x,yy,5,5);c.strokeStyle='#666666';c.lineWidth=.2;c.strokeRect(x,yy,5,5);
  const g=glyphs.get(yn.id);if(options.mode!=='color'&&g){font(c,3.6,true);c.fillStyle=options.mode==='mono'?INK:contrast(yn.color);c.textAlign='center';c.fillText(g,x+2.5,yy+2.6);}
  font(c,2.8);c.fillStyle=INK;c.textAlign='left';c.fillText(`${yn.name}　${usage.get(yn.id)}目`,x+6.5,yy+2.6,chip-8);});
 y+=Math.ceil(Math.max(1,yarns.length)/perLine)*6.5;
 const notes=increases.map(inc=>[null,`${inc.code}：${inc.name}`]);if(job.noStitch)notes.push([NO_STITCH,'灰色のマス：目がない場所（まだ増やしていない目など）']);
 if(notes.length){const half=usable/2;font(c,2.6);c.textAlign='left';
  notes.forEach(([swatch,text],i)=>{const x=m+(i%2)*half,yy=y+1.5+Math.floor(i/2)*5;let tx=x;
   if(swatch){c.fillStyle=swatch;c.fillRect(x,yy-1.6,3.2,3.2);c.strokeStyle='#888888';c.lineWidth=.15;c.strokeRect(x,yy-1.6,3.2,3.2);tx=x+4.5;}
   c.fillStyle=MUTED;c.fillText(text,tx,yy,half-2-(tx-x));});}
}

function chart(job,c,page){
 const {layout:L,p,glyphs,options}=job,cell=L.cellMm,left=L.margin+L.gutter,top=L.chartTop+L.rail;
 const cols=page.x1-page.x0+1,rows=page.r1-page.r0+1,palette=new Map(p.yarns.map(y=>[y.id,y.color])),fromRight=options.numberFromRight;
 const stitch=x=>stitchNumber(x,L.columns,fromRight),rowNo=r=>rowNumber(p,r+1);
 for(let r=page.r0;r<=page.r1;r++)for(let x=page.x0;x<=page.x1;x++){
  const px=left+(x-page.x0)*cell,py=top+(page.r1-r)*cell,id=colorAt(p,x,r);
  if(id===null){c.fillStyle=NO_STITCH;c.fillRect(px,py,cell,cell);continue;}
  const color=palette.get(id)||'#ffffff';c.fillStyle=options.mode==='mono'?'#ffffff':color;c.fillRect(px,py,cell,cell);
  const g=options.mode==='color'?'':glyphs.get(id)||'',ink=options.mode==='mono'?INK:contrast(color),inc=symbolAt(p,x,r);
  c.fillStyle=ink;c.textAlign='center';
  if(inc){font(c,Math.min(cell*.42,3),true);c.fillText(inc,px+cell/2,py+cell*.58,cell*.92);if(g){font(c,cell*.34);c.textAlign='left';c.fillText(g,px+cell*.06,py+cell*.2);}}
  else if(g){font(c,cell*.7);c.fillText(g,px+cell/2,py+cell*.54);}
 }
 // Grid: hairlines per stitch, heavier every 10 stitches/rows by the printed numbers, repeat seams in red.
 c.strokeStyle='#8a8a8a';c.lineWidth=.12;c.beginPath();
 for(let i=0;i<=cols;i++){c.moveTo(left+i*cell,top);c.lineTo(left+i*cell,top+rows*cell);}
 for(let i=0;i<=rows;i++){c.moveTo(left,top+i*cell);c.lineTo(left+cols*cell,top+i*cell);}c.stroke();
 const line=(x0,y0,x1,y1,style,width)=>{c.strokeStyle=style;c.lineWidth=width;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();};
 for(let x=page.x0;x<=page.x1+1;x++){const edge=left+(x-page.x0)*cell,n=fromRight?L.columns-x:x;
  if(p.horizontalRepeats>1&&x>0&&x<L.columns&&x%p.columns===0)line(edge,top,edge,top+rows*cell,REPEAT,.5);else if(n%10===0&&n>0&&n<L.columns)line(edge,top,edge,top+rows*cell,'#333333',.3);}
 for(let r=page.r0;r<=page.r1+1;r++){const edge=top+(page.r1+1-r)*cell,n=p.topDown?L.rows-r:r;
  if(p.verticalRepeats>1&&r>0&&r<L.rows&&r%p.rows===0)line(left,edge,left+cols*cell,edge,REPEAT,.5);else if(n%10===0&&n>0&&n<L.rows)line(left,edge,left+cols*cell,edge,'#333333',.3);}
 c.strokeStyle='#333333';c.lineWidth=.35;c.strokeRect(left,top,cols*cell,rows*cell);
 // Numbers: rows on both sides, stitches above and below; thinned out when the cells are small.
 const rowFont=Math.min(cell*.62,3),every=(n,first)=>n===first||n%5===0;
 font(c,rowFont);c.fillStyle=MUTED;
 for(let r=page.r0;r<=page.r1;r++){const n=rowNo(r),y=top+(page.r1-r+.5)*cell;if(cell<3.5&&!every(n,1))continue;
  c.textAlign='right';c.fillText(String(n),left-1,y);c.textAlign='left';c.fillText(String(n),left+cols*cell+1,y);}
 const colFont=Math.min(cell*.55,2.6);font(c,colFont);c.textAlign='center';
 const fitsAll=c.measureText(String(L.columns)).width<=cell*.95;
 for(let x=page.x0;x<=page.x1;x++){const n=stitch(x);if(!fitsAll&&!every(n,1))continue;const cx=left+(x-page.x0+.5)*cell;
  c.fillText(String(n),cx,top-L.rail/2);c.fillText(String(n),cx,top+rows*cell+L.rail/2);}
}

/** Draws page `index` (chart pages first, then the row-note pages). */
export function renderPage(job,index,dpi){
 const {canvas,c}=pageCanvas(job,dpi),{layout:L,p}=job,size=`${L.columns}目 × ${L.rows}段${job.options.oneRepeat?'（1模様）':''}`;
 if(index<L.pages.length){const page=L.pages[index];header(job,c,index,`${size}　このページ：${pageRange(p,L,page,job.options.numberFromRight)}`);legend(job,c);chart(job,c,page);}
 else{header(job,c,index,`${size}　段メモ`);font(c,NOTE_FONT);c.textAlign='left';
  job.notePages[index-L.pages.length].forEach((line,i)=>{const y=L.margin+18+i*NOTE_LINE;if(line.row!==null){c.fillStyle=MUTED;c.fillText(`${line.row}段目`,L.margin,y);}c.fillStyle=INK;c.fillText(line.text,L.margin+NOTE_INDENT,y);});}
 return canvas;
}

const jpeg=canvas=>new Promise((ok,ng)=>canvas.toBlob(b=>b?b.arrayBuffer().then(a=>ok(new Uint8Array(a)),ng):ng(Error('画像を作れませんでした')),'image/jpeg',.92));

/** Builds the whole PDF. onProgress(done, total) is called after each page. */
export async function makePrintPdf(job,onProgress=()=>{}){
 const dpi=printDpi(job.layout),pages=[];
 for(let i=0;i<job.total;i++){const canvas=renderPage(job,i,dpi);
  pages.push({widthMm:job.layout.pageW,heightMm:job.layout.pageH,jpeg:await jpeg(canvas),pixelWidth:canvas.width,pixelHeight:canvas.height});
  canvas.width=canvas.height=0;onProgress(i+1,job.total);await new Promise(r=>setTimeout(r));}
 return buildPdf(pages,{title:job.p.name||'編み図'});
}
