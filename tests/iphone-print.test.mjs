import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,repeats,setSymbol} from '../docs/iphone/app/model.mjs';
import {layoutPrint,printedProject,yarnGlyphs,yarnUsage,usedIncreases,printedNotes,pageRange,YARN_GLYPHS} from '../docs/iphone/app/print-model.mjs';
import {buildPdf} from '../docs/iphone/app/pdf.mjs';

const base={paper:'A4',landscape:false,cell:'medium',notes:true,numberFromRight:true};
function chart(w=30,h=40){const p=blank(w,h);for(let r=0;r<h;r++)for(let x=0;x<w;x++)p.cells[r][x]=(x+r)%7===0?1:(x*r)%11===0?2:0;return p;}

test('yarn glyphs: most-used yarn blank, the rest distinct, unused yarns none',()=>{
 const p=chart(),g=yarnGlyphs(p),u=yarnUsage(p);
 assert.equal(g.get(0),'');assert.equal(g.has(3),false,'charcoal is not used');
 assert.equal(new Set([...g.values()]).size,g.size);assert(u.get(0)>u.get(1)&&u.get(0)>u.get(2));
 const many=blank(30,1);many.yarns=Array.from({length:25},(_,id)=>({id,name:`色${id}`,color:'#'+String(id*37%1000).padStart(6,'0')}));many.cells[0]=Array.from({length:30},(_,x)=>x%25);
 const all=[...yarnGlyphs(many).values()];assert.equal(new Set(all).size,25);assert(all.includes(YARN_GLYPHS.at(-1))&&all.includes('1'),'numbers after the shapes run out');
});

test('pages tile the whole chart once, in knitting order, within the page',()=>{
 const p=chart(120,150),L=layoutPrint(p,base);
 assert(L.pages.length>1);
 const seen=new Set();for(const pg of L.pages)for(let r=pg.r0;r<=pg.r1;r++)for(let x=pg.x0;x<=pg.x1;x++){const k=`${x},${r}`;assert(!seen.has(k));seen.add(k);}
 assert.equal(seen.size,120*150);
 assert.equal(L.pages[0].r0,0,'first page starts at row 1');assert.equal(L.pages[0].x1,119,'stitch 1 is on the right, so the right block comes first');
 assert(L.margin*2+L.gutter*2+L.colsPerPage*L.cellMm<=L.pageW+1e-6);assert(L.chartTop+L.rail*2+L.rowsPerPage*L.cellMm<=L.pageH-L.margin+1e-6);
 assert.equal(pageRange(p,L,L.pages[0],true),`1〜${L.colsPerPage}目・1〜${L.rowsPerPage}段`);
 const left=layoutPrint(p,{...base,numberFromRight:false});assert.equal(left.pages[0].x0,0);
});

test('fit puts a small chart on one page with cells between 2.5 and 8 mm; huge charts are refused',()=>{
 const small=layoutPrint(chart(24,20),{...base,cell:'fit'});assert.equal(small.pages.length,1);assert(small.cellMm<=8&&small.cellMm>=2.5);
 const tall=layoutPrint(chart(60,200),{...base,cell:'fit'});assert.equal(tall.cellMm,2.5);
 const landscape=layoutPrint(chart(24,20),{...base,landscape:true});assert(landscape.pageW>landscape.pageH);
 assert.throws(()=>layoutPrint(chart(400,1000),{...base,cell:'large'}),/60ページまで/);
});

test('one repeat drops repeats; notes, increases and top-down numbering follow the printed project',()=>{
 const p=chart(10,8);repeats(p,4,3);setSymbol(p,2,3,'M1L');p.notes={2:'ここから模様',30:'  ',5:'色替え'};
 assert.equal(layoutPrint(p,base).columns,40);
 const one=printedProject(p,true);assert.equal(layoutPrint(one,base).columns,10);assert.equal(p.horizontalRepeats,4,'the project itself is untouched');
 assert.deepEqual(usedIncreases(one).map(i=>i.code),['M1L']);
 assert.deepEqual(printedNotes(p),[{row:2,text:'ここから模様'},{row:5,text:'色替え'}]);
 const down={...p,topDown:true};assert.deepEqual(printedNotes(down).map(n=>n.row),[20,23]);
 assert.equal(layoutPrint(p,{...base,notes:false}).notes.length,0);assert.equal(layoutPrint(p,base).notes.length,2);
 const td=layoutPrint({...chart(10,120),topDown:true},base);assert.equal(td.pages[0].r1,119,'top-down starts at the top (row 1)');assert(td.pages.at(-1).r0===0);
});

test('PDF: header, one page object per page, xref offsets point at each object',()=>{
 const jpeg=new Uint8Array([0xff,0xd8,1,2,3,0xff,0xd9]);
 const bytes=buildPdf([{widthMm:210,heightMm:297,jpeg,pixelWidth:20,pixelHeight:28},{widthMm:297,heightMm:210,jpeg,pixelWidth:28,pixelHeight:20}],{title:'ノルディック 🧶'});
 const text=new TextDecoder('latin1').decode(bytes);
 assert(text.startsWith('%PDF-1.4'));assert(text.trimEnd().endsWith('%%EOF'));
 assert.equal((text.match(/\/Type \/Page /g)||[]).length,2);assert.match(text,/\/Count 2/);assert.match(text,/\/MediaBox \[0 0 595\.28 841\.89\]/);
 const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert(text.slice(xref).startsWith('xref'));
 const offsets=text.slice(xref).split('\n').slice(3).filter(l=>/^\d{10} 00000 n/.test(l)).map(l=>Number(l.slice(0,10)));
 offsets.forEach((o,i)=>assert(text.slice(o).startsWith(`${i+1} 0 obj`),`object ${i+1}`));
 assert.match(text,/\/Title <FEFF/);
 assert.throws(()=>buildPdf([]));
});
