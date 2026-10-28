import {totalRows,totalColumns,colorAt,symbolAt,rowNumber,INCREASES} from './model.mjs';

// Printing a chart: paper, page tiling and the per-yarn symbols that keep the colours readable in black and white.
// All sizes are in millimetres; nothing here touches the DOM so it can be tested in Node.
export const PAPERS=Object.freeze({A4:{label:'A4',w:210,h:297},B5:{label:'B5',w:182,h:257},A3:{label:'A3',w:297,h:420},Letter:{label:'レター',w:215.9,h:279.4}});
export const PRINT_MODES=Object.freeze({color:'カラー',colorSymbols:'カラー＋記号',mono:'白黒（記号のみ）'});
export const CELL_SIZES=Object.freeze({fit:'1ページに収める',small:'小（4mm）',medium:'中（5mm）',large:'大（6mm）'});
const CELL_MM={small:4,medium:5,large:6},FIT_MAX=8,FIT_MIN=2.5,MARGIN=10,MAX_PAGES=60;
// The most-used yarn stays blank so the chart is not crowded; the rest get distinct shapes, then numbers.
export const YARN_GLYPHS=Object.freeze(['','●','×','▲','■','◆','○','△','□','◇','★','☆','＋','／','＼','＝','◎','▼','▽','♥']);

/** The project as printed: with 「1模様だけ」 the repeats are dropped, so row numbers count within one repeat. */
export const printedProject=(p,oneRepeat)=>oneRepeat?{...p,horizontalRepeats:1,verticalRepeats:1}:p;

/** Stitches per yarn in the printed area. */
export function yarnUsage(p){
 const w=totalColumns(p),h=totalRows(p),count=new Map(p.yarns.map(y=>[y.id,0]));
 for(let r=0;r<h;r++)for(let x=0;x<w;x++){const id=colorAt(p,x,r);if(id!==null)count.set(id,(count.get(id)||0)+1);}
 return count;
}

/** yarn id → glyph. Unused yarns get none; ties keep the yarn order so the result is stable. */
export function yarnGlyphs(p){
 const usage=yarnUsage(p),used=p.yarns.filter(y=>usage.get(y.id)>0).sort((a,b)=>usage.get(b.id)-usage.get(a.id)||p.yarns.indexOf(a)-p.yarns.indexOf(b));
 return new Map(used.map((y,i)=>[y.id,i<YARN_GLYPHS.length?YARN_GLYPHS[i]:String(i-YARN_GLYPHS.length+1)]));
}

/** Increase symbols that appear in the printed area, in the app's order. */
export function usedIncreases(p){
 const w=totalColumns(p),h=totalRows(p),seen=new Set();
 for(let r=0;r<h;r++)for(let x=0;x<w;x++){const s=symbolAt(p,x,r);if(s)seen.add(s);}
 return INCREASES.filter(i=>seen.has(i.code));
}

/** Row notes for the printed rows, in knitting-row order: [{row (as numbered), text}]. */
export function printedNotes(p){
 const h=totalRows(p),out=[];
 for(let physical=1;physical<=h;physical++){const text=String(p.notes?.[physical]??'').trim();if(text)out.push({row:rowNumber(p,physical),text});}
 return out.sort((a,b)=>a.row-b.row);
}

/** Whether the chart has cells with no stitch yet (yoke wedges, shaping), shown grey. */
export function hasNoStitch(p){for(const row of p.cells)if(row.includes(null))return true;return false;}

/** Height of the header + legend block, so the chart area can be sized before drawing. */
export function legendHeight(p,pageW){
 const glyphs=yarnGlyphs(p),inc=usedIncreases(p);
 const usable=pageW-MARGIN*2,chip=46,perLine=Math.max(1,Math.floor(usable/chip)),lines=Math.ceil(Math.max(1,glyphs.size)/perLine);
 const blank=hasNoStitch(p)?1:0;
 return 15+lines*6.5+(inc.length+blank?Math.ceil((inc.length+blank)/2)*5+1:0)+3;
}

/**
 * Lays the chart of the printed project (see printedProject) out on pages.
 * options: {paper, landscape, cell: 'fit'|'small'|'medium'|'large', notes, numberFromRight}
 * Returns {pageW, pageH, cellMm, colsPerPage, rowsPerPage, pages:[{x0,x1,r0,r1}], chartTop, gutter, notesPages}
 * Columns x and rows r are 0-based project coordinates (r = 0 is the first row from the bottom).
 */
export function layoutPrint(p,options){
 const paper=PAPERS[options.paper];if(!paper)throw Error('用紙を選んでください。');
 const pageW=options.landscape?paper.h:paper.w,pageH=options.landscape?paper.w:paper.h;
 const columns=totalColumns(p),rows=totalRows(p);
 const digits=String(Math.max(rows,columns)).length,gutter=2+digits*2.1,rail=4.5;
 const chartTop=MARGIN+legendHeight(p,pageW),footer=6;
 const availW=pageW-MARGIN*2-gutter*2,availH=pageH-chartTop-MARGIN-footer-rail*2;
 if(availW<20||availH<20)throw Error('毛糸の色が多く、表を入れる場所がありません。用紙を大きくするか横向きにしてください。');
 let cellMm=CELL_MM[options.cell];
 if(options.cell==='fit')cellMm=Math.max(FIT_MIN,Math.min(FIT_MAX,availW/columns,availH/rows));
 if(!cellMm)throw Error('マスの大きさを選んでください。');
 const colsPerPage=Math.max(1,Math.floor(availW/cellMm+1e-9)),rowsPerPage=Math.max(1,Math.floor(availH/cellMm+1e-9));
 const colBlocks=Math.ceil(columns/colsPerPage),rowBlocks=Math.ceil(rows/rowsPerPage);
 if(colBlocks*rowBlocks>MAX_PAGES)throw Error(`${colBlocks*rowBlocks}ページになるため作成できません（${MAX_PAGES}ページまで）。マスを小さくするか、「1模様だけ」を選んでください。`);
 // Knitting order: the first rows first; across a row, start from the side stitch 1 is on.
 const pages=[];
 for(let rb=0;rb<rowBlocks;rb++)for(let k=0;k<colBlocks;k++){
  // Blocks are counted from row 1 and stitch 1 (top for top-down), so only the last page of a band is partial.
  const r0=p.topDown?Math.max(0,rows-(rb+1)*rowsPerPage):rb*rowsPerPage,r1=p.topDown?rows-1-rb*rowsPerPage:Math.min(rows,r0+rowsPerPage)-1;
  if(options.numberFromRight){const x1=columns-1-k*colsPerPage;pages.push({x0:Math.max(0,x1-colsPerPage+1),x1,r0,r1});}
  else{const x0=k*colsPerPage;pages.push({x0,x1:Math.min(columns,x0+colsPerPage)-1,r0,r1});}
 }
 const notes=options.notes?printedNotes(p):[];
 return {pageW,pageH,margin:MARGIN,cellMm,colsPerPage,rowsPerPage,columns,rows,pages,chartTop,gutter,rail,notes};
}

/** 「1〜40目・1〜60段」 for a page, using the numbering printed on it. */
export function pageRange(p,layout,page,numberFromRight){
 const stitch=x=>numberFromRight?layout.columns-x:x+1,a=stitch(page.x0),b=stitch(page.x1);
 const rowA=rowNumber(p,page.r0+1),rowB=rowNumber(p,page.r1+1);
 return `${Math.min(a,b)}〜${Math.max(a,b)}目・${Math.min(rowA,rowB)}〜${Math.max(rowA,rowB)}段`;
}
