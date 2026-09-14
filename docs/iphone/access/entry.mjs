import config from './config.mjs';
if(config.enabled){
 // Landing-page content is preserved for rollback, but is not a bypass route.
 for(const child of [...document.body.children])if(child.tagName!=='SCRIPT')child.hidden=true;
 document.documentElement.classList.add('access-pending');
 const {mountGate}=await import('./gate.mjs');
 await mountGate({page:'entry'});
}
