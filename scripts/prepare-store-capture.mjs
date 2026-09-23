// Simulator-only fixture and UI driver. Never called by the distribution workflow.
import {readFile,writeFile} from 'node:fs/promises';
import {blank} from '../docs/iphone/app/model.mjs';
const p=blank(12,16);p.name='花の編み込み';p.cells=Array.from({length:16},(_,r)=>Array.from({length:12},(_,x)=>{const d=Math.abs(x-5.5)+Math.abs(r%8-3.5);return d<1.5?2:d<3?1:0;}));p.currentRow=5;p.completedRows=[1,2,3,4];p.flatKnitting=true;
const dir='ios/App/App/public/';
const original=await readFile(dir+'entry.mjs','utf8');
const seed=`localStorage.clear();localStorage.setItem('patterncanvas-iphone-v1',${JSON.stringify(JSON.stringify(p))});\n`;
const harness=await readFile('scripts/store-capture-driver.js','utf8');
await writeFile(dir+'entry.mjs',seed+original+'\n'+harness);
