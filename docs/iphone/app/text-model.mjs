import {blank} from './model.mjs';

// Raster rows start at the top; project rows start at the bottom.
export function textPattern(mask,width,height,text,foreground,background){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||width>200||height<8||height>200||mask.length!==width*height)throw Error('目数・段数は8〜200で指定してください。');
 if(!text.trim())throw Error('文字を入力してください。');
 if(!/^#[0-9a-f]{6}$/i.test(foreground)||!/^#[0-9a-f]{6}$/i.test(background)||foreground.toLowerCase()===background.toLowerCase())throw Error('文字と背景に異なる色を選んでください。');
 const p=blank(width,height);p.name=text.trim().replace(/\s+/g,' ').slice(0,100);
 p.yarns=[{id:0,name:'背景の毛糸',color:background},{id:1,name:'文字の毛糸',color:foreground}];
 p.cells=Array.from({length:height},(_,r)=>Array.from({length:width},(_,x)=>mask[(height-1-r)*width+x]?1:0));
 return p;
}
