// Isolated from patterncanvas-iphone-v1. Never clear the editor's storage.
const DB='patterncanvas-license-v1';
async function open(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('access');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
async function access(key,value,write){
  const db=await open();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('access',write?'readwrite':'readonly');const store=tx.objectStore('access');
    const req=write?(value===null?store.delete(key):store.put(value,key)):store.get(key);
    tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export const load=key=>access(key,undefined,false);
export const save=(key,value)=>access(key,value,true);
export function offlineValid(record,now=Date.now()){
  return !!record?.license&&record.valid===true&&record.status==='active'&&Number.isFinite(record.verifiedAt)&&Number.isFinite(record.offlineUntil)&&now>=record.verifiedAt&&now<record.offlineUntil;
}
