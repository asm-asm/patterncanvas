import config from '../access/config.mjs';
// The existing editor is deliberately untouched. This is its only entry point.
if(!config.enabled){
 await import('./app.mjs');
 document.documentElement.classList.remove('access-pending');
}else{
 navigator.serviceWorker?.register('./sw.js').catch(()=>{});
 const {mountGate}=await import('../access/gate.mjs');
 await mountGate({page:'app',onGranted:()=>import('./app.mjs')});
}
