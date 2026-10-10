import {blank,editInKnittingOrder,stitchCount,totalRows,INCREASES} from './model.mjs';

// Top-down round yoke: one repeat (a wedge that widens from the neck), shown K times around.
// Increases are placed with the regular, tested stitch editor, so their cells, "no stitch" slots and symbols behave
// exactly like hand-made increases. Increase rounds are spread evenly over the depth, increases evenly across a repeat.
export function yokePlan({neck,bottom,repeats,rows,rounds}){
 const int=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(`${label}は${min}〜${max}の整数で入力してください。`);return v;};
 int(neck,8,1000,'首回りの目数');int(bottom,8,2000,'裾の目数');int(repeats,1,40,'模様の数');int(rows,4,200,'ヨークの段数');int(rounds,1,20,'増し目の回数');
 if(bottom<=neck)throw Error('裾の目数は、首回りより多くしてください。');
 if(neck%repeats||bottom%repeats)throw Error(`首回り${neck}目と裾${bottom}目を、どちらも${repeats}模様で割り切れる数にしてください。`);
 const w0=neck/repeats,w1=bottom/repeats,add=w1-w0;
 if(w1>200)throw Error('1模様の幅は200目までです。模様の数を増やしてください。');
 if(rounds>add)throw Error(`1模様で増える目は${add}目なので、増し目の回数は${add}回以下にしてください。`);
 if(rounds>=rows)throw Error('増し目の回数は、ヨークの段数より少なくしてください。');
 const at=Array.from({length:rounds},(_,i)=>Math.round((i+1)*rows/(rounds+1)));
 if(new Set(at).size!==rounds||at[0]<1)throw Error('段数に対して増し目の回数が多すぎます。');
 const steps=at.map((row,i)=>({row,perRepeat:Math.floor(add*(i+1)/rounds)-Math.floor(add*i/rounds)}));
 return {w0,w1,steps};
}

export function yokePattern({neck,bottom,repeats,rows,rounds,symbol='M1L'}){
 if(!INCREASES.some(s=>s.code===symbol))throw Error('増し目記号を選んでください。');
 const {w0,steps}=yokePlan({neck,bottom,repeats,rows,rounds});
 const p=blank(w0,rows);p.topDown=true;p.showDividers=false;p.name=`丸ヨーク ${neck}目→${bottom}目`;
 let width=w0;
 for(const {row,perRepeat} of steps){
  // Right to left, so the positions computed on this row's width stay valid while inserting.
  for(let j=perRepeat;j>=1;j--)editInKnittingOrder(p,'stitches',{fromRow:row,action:'add',count:1,edge:'position',position:Math.round(j*width/(perRepeat+1))+1,symbol});
  width+=perRepeat;
 }
 // Top-down: knitting row 1 (the neck) is the last stored row.
 p.horizontalRepeats=repeats;p.currentRow=totalRows(p);p.completedRows=[];p.notes={};
 // Notes are keyed by stored row; in top-down order knitting row r is stored row rows+1-r.
 for(const {row,perRepeat} of steps)p.notes[rows+1-row]=`増し目の段：1模様に${perRepeat}目（全体で${perRepeat*repeats}目）増やす。`;
 return p;
}

// Stitch count around the yoke in knitting order (row 1 = neck), for summaries and tests.
export const yokeStitches=(p,row)=>stitchCount(p,p.topDown?p.rows*p.verticalRepeats+1-row:row);
