import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Haptics,ImpactStyle} from '@capacitor/haptics';
import {createProjectStore} from './storage.mjs';
export const native=true;
const directory=Directory.Data,encoding=Encoding.UTF8;
// Keep a previous disk snapshot if the application is interrupted while saving.
async function diskRead(path){
  try{return (await Filesystem.readFile({path,directory,encoding})).data;}
  catch(e){if(e.code==='OS-PLUG-FILE-0008'||/does not exist|not found|no such file/i.test(e.message||''))return null;throw e;}
}
const store=createProjectStore({read:diskRead,write:(path,data)=>Filesystem.writeFile({path,data,directory,encoding}),mirror:localStorage});
export const readProject=store.readProject;
export const writeProject=store.writeProject;
export async function readLock(){
  try{const cached=localStorage.getItem('patterncanvas-chart-locked');if(cached!==null)return cached==='true';}catch{}
  return (await diskRead('chart-lock.txt'))==='true';
}
export async function writeLock(value){
  try{localStorage.setItem('patterncanvas-chart-locked',String(value));}catch{}
  await Filesystem.writeFile({path:'chart-lock.txt',data:String(value),directory,encoding});
}
export async function exportProject(data,name){
  const path=`share/${name}`;
  await Filesystem.writeFile({path,data,directory:Directory.Cache,encoding,recursive:true});
  const {uri}=await Filesystem.getUri({path,directory:Directory.Cache});
  await Share.share({title:'編み図を保存・共有',files:[uri],dialogTitle:'作品を書き出す'});
}
export function rowCompleted(){Haptics.impact({style:ImpactStyle.Light}).catch(()=>{});}
export function prepareOffline(){document.getElementById('offline-state').textContent='✓ 初回からオフラインで使えます。作品はこの端末に保存します。';}
