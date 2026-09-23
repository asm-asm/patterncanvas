// Runs solely in the unsigned simulator capture bundle, after the real app loads.
const fs=window.Capacitor.Plugins.Filesystem;
const write=(path,data)=>fs.writeFile({path,data:JSON.stringify(data),directory:'DATA',encoding:'utf8'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const click=s=>{const e=document.querySelector(s);if(!e)throw Error(s);e.click();};
const scroll=s=>{const e=document.querySelector(s);window.scrollTo(0,Math.max(0,window.scrollY+e.getBoundingClientRect().top-76));};
function tap(x,y){const c=document.querySelector('#chart'),b=c.getBoundingClientRect();const e={clientX:b.left+x,clientY:b.top+y,pointerId:1,preventDefault(){}};const old=c.setPointerCapture;c.setPointerCapture=()=>{};try{c.onpointerdown(e);c.onpointerup(e);}finally{c.setPointerCapture=old;}}
let last='';
await sleep(2000);await write('capture-ready.json',{ready:true});
setInterval(async()=>{
 try{
 const {data}=await fs.readFile({path:'capture-command.json',directory:'DATA',encoding:'utf8'});const cmd=JSON.parse(data);if(cmd.id===last)return;last=cmd.id;
 if(cmd.action==='view'){click(`[data-view="${cmd.view}"]`);await sleep(400);if(cmd.view==='preview')window.scrollTo(0,0);else if(cmd.scroll)scroll(cmd.scroll);if(cmd.view==='preview'||cmd.view==='both')click('#preview-fit');}
 if(cmd.action==='lock'){click('#chart-lock');scroll('#chart-panel');}
 if(cmd.action==='tap')tap(cmd.x,cmd.y);
 if(cmd.action==='complete'){click('#complete');scroll('.counter');}
 if(cmd.action==='design'){
 click('[data-view="both"]');scroll('#chart-panel');await sleep(4500);click('#palette button:nth-child(3)');tap(180,160);await sleep(4500);click('#undo');await sleep(4500);click('[data-view="preview"]');scroll('#preview-panel');await sleep(7000);
 }
 if(cmd.action==='knit'){
 click('[data-view="both"]');scroll('.counter');await sleep(4500);click('#complete');await sleep(4500);click('#complete');await sleep(4500);scroll('#chart-panel');await sleep(7000);
 }
 if(cmd.action==='count'){
 click('[data-view="chart"]');scroll('#chart-panel');await sleep(4500);tap(84,40);await sleep(4500);tap(180,64);await sleep(4500);tap(156,136);await sleep(7000);
 }
 await sleep(500);await write('capture-result.json',{id:cmd.id,ok:true,run:document.querySelector('#run-count').textContent});
 }catch(e){if(!/does not exist|not found|no such file/i.test(e.message||''))await write('capture-error.json',{message:String(e)});}
},200);
