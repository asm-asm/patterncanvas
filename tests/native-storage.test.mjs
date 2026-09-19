import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProjectStore} from '../native/src/storage.mjs';
import {blank,setSymbol} from '../docs/iphone/app/model.mjs';
function setup(){const files=new Map(),cache=new Map();return {files,cache,options:{read:async name=>files.get(name)||null,write:async(name,data)=>files.set(name,data),mirror:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)}}};}
const project=(time,row=1)=>JSON.stringify({...blank(2,3),updatedAt:time,currentRow:row});
test('native storage recovers from disk after WebView storage eviction',async()=>{
  const s=setup(),store=createProjectStore(s.options);await store.writeProject(project(1));s.cache.clear();assert.equal(await store.readProject(),project(1));
});
test('newer mirror survives interruption before disk save; corrupt newest copy falls back',async()=>{
  const s=setup();s.files.set('project.json',project(2));s.cache.set('patterncanvas-iphone-v1',project(3,2));
  const store=createProjectStore(s.options);assert.equal(await store.readProject(),project(3,2));
  s.cache.set('patterncanvas-iphone-v1','{"updatedAt":999}');assert.equal(await store.readProject(),project(2));
  s.files.set('project.previous.json',project(1));s.files.set('project.json','broken');assert.equal(await store.readProject(),project(1));
});
test('rapid saves are serialized and previous snapshot is kept',async()=>{
  const s=setup();const store=createProjectStore({...s.options,write:async(name,data)=>{await new Promise(r=>setTimeout(r,2));s.files.set(name,data);}});
  await Promise.all([store.writeProject(project(1)),store.writeProject(project(2,2)),store.writeProject(project(3,3))]);
  assert.equal(s.files.get('project.json'),project(3,3));assert.equal(s.files.get('project.previous.json'),project(2,2));
});
test('disk failure is reported and later writes can recover',async()=>{
  const s=setup();let failing=true;const store=createProjectStore({...s.options,write:async(name,data)=>{if(failing)throw Error('disk full');s.files.set(name,data);}});
  await assert.rejects(store.writeProject(project(1)));assert.equal(await store.readProject(),project(1));
  failing=false;await store.writeProject(project(2));assert.equal(s.files.get('project.json'),project(2));
});
test('all-invalid storage refuses to substitute or write a sample',async()=>{
  const s=setup();s.files.set('project.json','bad');const store=createProjectStore(s.options);await assert.rejects(store.readProject());assert.equal(s.files.get('project.json'),'bad');
});
test('an unreadable backup does not hide a valid project; unavailable empty storage is not treated as new',async()=>{
  const s=setup();s.cache.set('patterncanvas-iphone-v1',project(5));
  const store=createProjectStore({...s.options,read:async()=>{throw Error('access denied');}});
  assert.equal(await store.readProject(),project(5));s.cache.clear();await assert.rejects(store.readProject());
});

test('increase symbols survive native disk recovery after cache eviction',async()=>{
 const s=setup(),store=createProjectStore(s.options),p=blank(2,3);setSymbol(p,1,0,'M1LP');
 await store.writeProject(JSON.stringify(p));s.cache.clear();
 assert.deepEqual(JSON.parse(await createProjectStore(s.options).readProject()),p);
});
