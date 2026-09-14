// Web implementation. The App Store build supplies its own native adapter.
export const native=false;
export const readProject=()=>localStorage.getItem('patterncanvas-iphone-v1');
export const writeProject=data=>localStorage.setItem('patterncanvas-iphone-v1',data);
export const readLock=()=>localStorage.getItem('patterncanvas-chart-locked')==='true';
export const writeLock=value=>localStorage.setItem('patterncanvas-chart-locked',String(value));
export const rowCompleted=()=>{};
export async function exportProject(data,name){
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function prepareOffline(){
  const status=document.getElementById('offline-state');
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{status.textContent='✓ オフラインで使う準備ができました。';}).catch(()=>{status.textContent='オフラインの準備ができませんでした。通信できる状態で使ってください。';});
  else status.textContent='このブラウザーではオフライン機能を使えません。';
}
