import {blank,totalRows,stitchCount} from './model.mjs';

// Top-down round yoke designed from gauge and finished measurements, charted the way published colourwork yokes are:
// one repeat is a fixed set of stitch columns. At the neck only the centre block is live; the "no stitch" slots sit at
// both edges, and each increase round opens one column on each side (M1R on the left edge, M1L on the right edge), so
// existing stitches never shift and any motif drawn in the repeat stays upright. Increases are denser near the neck,
// like most yoke charts, and stop a few rows before the split.

// Size presets: Craft Yarn Council women's body sizes with ease. 「標準」 is a classic fitted yoke, 「ゆったり」 an
// oversized, deep yoke.
const BODY=[['XS',76,25,16],['S',86,26,17],['M',96,28,18],['L',106,30.5,20],['XL',117,34.5,21],['2XL',127,39.5,22],['3XL',137,43,24],['4XL',147,47,25],['5XL',157,49.5,26]];
export const YOKE_FITS={standard:{label:'標準',ease:8,armEase:4,depthAdd:4},relaxed:{label:'ゆったり（深めのヨーク）',ease:22,armEase:8,depthAdd:12}};
export function yokeSize(name,fit='standard'){
 const b=BODY.find(s=>s[0]===name),f=YOKE_FITS[fit];if(!b||!f)throw Error('サイズを選んでください。');
 const [,chest,arm,armhole]=b,i=BODY.indexOf(b);
 return {chest:chest+f.ease,arm:Math.round((arm+f.armEase)*2)/2,neck:48+i,depth:Math.min(38,armhole+f.depthAdd)};
}
export const YOKE_SIZE_NAMES=BODY.map(b=>b[0]);

const check=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error(`${label}は${min}〜${max}で入力してください。`);};

// Whole-garment stitch counts from gauge (per 10 cm) and finished measurements (cm).
export function yokeDesign({gaugeSts,gaugeRows,chest,arm,neck,depth,motif=30}){
 check(gaugeSts,8,50,'ゲージの目数');check(gaugeRows,8,70,'ゲージの段数');check(chest,50,220,'出来上がり胸囲');check(arm,15,90,'二の腕');check(neck,30,90,'首回り');check(depth,10,50,'ヨーク丈');check(motif,8,60,'1模様の目数');
 const per=cm=>cm*gaugeSts/10,body=2*Math.round(per(chest)/2),underarm=Math.max(2,2*Math.round(body*.08/2)),sleeve=Math.round(per(arm));
 if(sleeve<=underarm)throw Error('二の腕の目数が脇の作り目より少なくなります。二の腕を大きくしてください。');
 const yokeIdeal=body-2*underarm+2*(sleeve-underarm),neckIdeal=Math.round(per(neck));
 if(yokeIdeal<neckIdeal*1.6)throw Error('首回りに対して胸囲・二の腕が小さすぎます。寸法を見直してください。');
 // Repeats: hem width per repeat close to the wanted motif width; hem and neck rounded to multiples, neck kept even per repeat.
 let best=null;
 for(let k=4;k<=40;k++){const w1=Math.round(yokeIdeal/k),w0=Math.round(neckIdeal/k);if(w1>200||w0<3||w1-w0<2)continue;
  const add=w1-w0,w1e=w0+add-(add%2),score=Math.abs(w1e-motif)+Math.abs(k*w1e-yokeIdeal)*.5+Math.abs(k*w0-neckIdeal)*.5;if(!best||score<best.score)best={k,w0,w1:w1e,score};}
 if(!best)throw Error('この寸法とゲージでは模様に分けられません。1模様の目数を変えてください。');
 const rows=Math.round(depth*gaugeRows/10);if(rows<8||rows>200)throw Error('ヨークの段数が8〜200段になるように、ヨーク丈かゲージを見直してください。');
 const yokeSts=best.k*best.w1,neckSts=best.k*best.w0,diff=yokeSts-yokeIdeal;
 // Rounding goes to the sleeves (odd stitch to the back) so the body stays at the chest measurement.
 const half=(body-2*underarm)/2,sleeveLive=sleeve-underarm+Math.trunc(diff/2),back=half+(diff%2);
 return {gaugeSts,gaugeRows,body,underarm,sleeve,neckSts,yokeSts,neckIdeal,yokeIdeal,repeats:best.k,w0:best.w0,w1:best.w1,rows,
  neckCm:neckSts*10/gaugeSts,yokeCm:yokeSts*10/gaugeSts,split:{back,front:half,sleeve:sleeveLive,underarm,body:back+half+2*underarm}};
}

// Increase rows for (w1-w0)/2 mirrored pairs: from about 3% of the depth, denser near the neck, last at about 85%.
export function yokeSchedule(rows,pairs){
 const first=Math.max(2,Math.round(rows*.03)),last=Math.max(first+pairs-1,Math.round(rows*.85)),out=[];
 for(let i=0;i<pairs;i++){const t=pairs===1?0:i/(pairs-1);let r=Math.round(first+(last-first)*t**1.25);if(out.length&&r<=out.at(-1))r=out.at(-1)+1;out.push(r);}
 if(out.at(-1)>rows-1)throw Error('ヨーク丈に対して増し目が多すぎます。ヨーク丈を深くするか、1模様の目数を減らしてください。');
 return out;
}

export function yokePattern(input){
 const d=yokeDesign(input),w=d.w1,pairs=(d.w1-d.w0)/2,rows=d.rows,at=yokeSchedule(rows,pairs),start=pairs;
 // open[x]: first knitting row on which column x has a stitch. Centre block from the neck; pair i opens columns
 // start-1-i (left) and start+w0+i (right).
 const open=new Array(w).fill(1),incs=[];
 at.forEach((row,i)=>{const l=start-1-i,r=start+d.w0+i;open[l]=open[r]=row;incs.push({row,x:l,sym:'M1R'},{row,x:r,sym:'M1L'});});
 const p=blank(w,rows);p.topDown=true;p.showDividers=false;p.format='patterncanvas-web-3';p.name=`丸ヨーク ${d.neckSts}目→${d.yokeSts}目`;
 p.cells=Array.from({length:rows},(_,i)=>{const r=rows-i;return Array.from({length:w},(_,x)=>r>=open[x]?0:null);});
 p.symbols=p.cells.map(row=>row.map(()=>null));for(const {row,x,sym} of incs)p.symbols[rows-row][x]=sym;
 p.horizontalRepeats=d.repeats;p.currentRow=totalRows(p);p.completedRows=[];p.notes={};
 for(const row of at)p.notes[rows+1-row]=`増し目の段：1模様の両端に1目ずつ（全体で${2*d.repeats}目）増やす。`;
 const note=(r,t)=>{p.notes[r]=p.notes[r]?`${t} ${p.notes[r]}`:t;};
 note(rows,`作り目${d.neckSts}目（首回り約${d.neckCm.toFixed(1)}cm）を輪にして、1段目から編む。${d.w0}目×${d.repeats}模様。`);
 const s=d.split;note(1,`ヨーク完成：${d.yokeSts}目。次の段で身頃と袖を分ける：後ろ身頃${s.back}目、袖${s.sleeve}目（休み目）、前身頃${s.front}目、袖${s.sleeve}目（休み目）。脇で${s.underarm}目ずつ作り目し、身頃は${s.body}目。`);
 return {pattern:p,design:d,schedule:at};
}

// Stitch count around the yoke in knitting order (row 1 = neck), for summaries and tests.
export const yokeStitches=(p,row)=>stitchCount(p,p.topDown?p.rows*p.verticalRepeats+1-row:row);
