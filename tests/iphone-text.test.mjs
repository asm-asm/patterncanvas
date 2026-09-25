import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textPattern} from '../docs/iphone/app/text-model.mjs';
import {renameYarn,validate,colorAt,rowAtVisual} from '../docs/iphone/app/model.mjs';
test('text bitmap is preserved cell for cell, bottom-up, through save and rename',()=>{
 const mask=Array.from({length:96},(_,i)=>i===1||i===95);
 const p=textPattern(mask,12,8,'あみもの','#123456','#ffffff');
 for(let y=0;y<8;y++)for(let x=0;x<12;x++)assert.equal(colorAt(p,x,rowAtVisual(p,y)),Number(mask[y*12+x]));
 const cells=JSON.stringify(p.cells);renameYarn(p,1,'  毛糸 A・20番  ');
 const saved=validate(JSON.parse(JSON.stringify(p)));
 assert.equal(saved.yarns[1].name,'毛糸 A・20番');assert.equal(saved.yarns[1].color,'#123456');assert.equal(JSON.stringify(saved.cells),cells);
 assert.throws(()=>renameYarn(p,1,' '));assert.throws(()=>renameYarn(p,1,'a'.repeat(101)));
 assert.throws(()=>textPattern(mask,12,8,'x','#ffffff','#ffffff'));
});
