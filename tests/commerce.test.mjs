import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import Stripe from 'stripe';
import {createWorker} from '../worker/src/index.mjs';
import {normalizeLicense} from '../worker/src/crypto.mjs';
import {offlineValid} from '../docs/iphone/access/storage.mjs';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']}]}));
const DB=await mf.getD1Database('DB');
const sql=await readFile(new URL('../worker/migrations/0001_licenses.sql',import.meta.url),'utf8');
await DB.exec(sql.replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
await DB.exec((await readFile(new URL('../worker/migrations/0002_checkout_price_snapshot.sql',import.meta.url),'utf8')).replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
after(()=>mf.dispose());
const env={DB,ENVIRONMENT:'test',STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_WEBHOOK_SECRET:'whsec_test',LICENSE_HASH_SECRET:'a'.repeat(64),LICENSE_ENCRYPTION_SECRET:'b'.repeat(64),FRONTEND_URL:'https://asm-asm.github.io/patterncanvas/iphone/',STRIPE_PRICE_ID_TEST:'price_test'};
const sessions=new Map();let creates=0;
const real=new Stripe('sk_test_mock');
const worker=createWorker(()=>({
  webhooks:real.webhooks,
  prices:{retrieve:async()=>({active:true,type:'one_time',currency:'jpy',unit_amount:980,livemode:false})},
  checkout:{sessions:{create:async(params)=>{const id=`cs_test_order${++creates}`;const s={...params,id,url:'https://checkout.stripe.com/c/pay/test',status:'open',payment_status:'unpaid',livemode:false,amount_total:980,currency:'jpy',payment_intent:`pi_${creates}`,customer:'cus_test',customer_details:{email:'alice@example.com'},created:Math.floor(Date.now()/1000),line_items:{has_more:false,data:[{price:{id:'price_test'},quantity:1}]}};sessions.set(id,s);return s;},retrieve:async id=>sessions.get(id)}}
}));
async function call(path,data,origin='https://asm-asm.github.io'){
  return worker.fetch(new Request(`https://api.example${path}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)}),env);
}
async function event(type,object,id=crypto.randomUUID(),valid=true){
  const payload=JSON.stringify({id,type,livemode:false,data:{object}});
  const signature=real.webhooks.generateTestHeaderString({payload,secret:valid?env.STRIPE_WEBHOOK_SECRET:'wrong'});
  return worker.fetch(new Request('https://api.example/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}),env);
}
let code,session;
test('checkout: origin, price and idempotency; pending session grants nothing',async()=>{
  assert.equal((await call('/create-checkout',{claimToken:'a'.repeat(64)},'https://evil.test')).status,403);
  assert.equal((await call('/create-checkout',{claimToken:'bad'})).status,400);
  const r=await call('/create-checkout',{claimToken:'a'.repeat(64)});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  await call('/create-checkout',{claimToken:'a'.repeat(64)});assert.equal(creates,1);
  session=sessions.get('cs_test_order1');assert.equal(session.mode,'payment');assert.equal(session.customer_creation,'always');
  assert.equal((await call('/claim-license',{sessionId:session.id,claimToken:'a'.repeat(64)})).status,202);
  assert.equal((await call('/claim-license',{sessionId:session.id,claimToken:'b'.repeat(64)})).status,404);
});
test('signature and unpaid check; verified webhook issues one encrypted license',async()=>{
  assert.equal((await event('checkout.session.completed',session,'bad-signature',false)).status,400);
  assert.equal((await event('checkout.session.completed',session,'unpaid')).status,400);
  session.payment_status='paid';session.status='complete';
  assert.equal((await event('checkout.session.completed',session,'paid')).status,200);
  assert.equal((await event('checkout.session.completed',session,'paid')).status,200);
  assert.equal((await event('checkout.session.completed',session,'paid-again')).status,200);
  const result=await (await call('/claim-license',{sessionId:session.id,claimToken:'a'.repeat(64)})).json();code=result.license;assert.equal(normalizeLicense(code),code);
  assert.equal((await (await call('/claim-license',{sessionId:session.id,claimToken:'a'.repeat(64)})).json()).license,code);
  const record=await DB.prepare('SELECT * FROM licenses').first();assert(!JSON.stringify(record).includes(code));
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n,1);
});
test('verification, masked email, offline grace and invalid license',async()=>{
  const r=await (await call('/verify-license',{license:code})).json();assert.equal(r.valid,true);assert.equal(r.email,'a***@example.com');
  assert.equal(r.offlineUntil-r.verifiedAt,7*86400000);assert(offlineValid({...r,license:code},r.verifiedAt));
  assert(!offlineValid({...r,license:code},r.offlineUntil));assert(!offlineValid({...r,license:code},r.verifiedAt-1));
  assert.equal((await (await call('/verify-license',{license:"' OR 1=1 --"})).json()).valid,false);
});
test('refund survives completion replay and payment failures',async()=>{
  assert.equal((await event('charge.refunded',{payment_intent:session.payment_intent},'refund')).status,200);
  await event('payment_intent.payment_failed',{id:session.payment_intent},'failure');
  await event('checkout.session.completed',session,'replay-after-refund');
  assert.equal((await (await call('/verify-license',{license:code})).json()).valid,false);
  assert.equal((await call('/claim-license',{sessionId:session.id,claimToken:'a'.repeat(64)})).status,403);
  assert.equal((await DB.prepare('SELECT status FROM licenses').first()).status,'refunded');
});
test('refund before completed never activates; revoked status preserved',async()=>{
  await call('/create-checkout',{claimToken:'b'.repeat(64)});const s=sessions.get('cs_test_order2');s.payment_status='paid';
  await event('charge.refunded',{payment_intent:s.payment_intent},'early-refund');
  await event('checkout.session.completed',s,'late-completed');
  assert.equal((await DB.prepare('SELECT status FROM licenses WHERE stripe_session_id=?').bind(s.id).first()).status,'refunded');
  await DB.prepare("UPDATE licenses SET status='revoked' WHERE stripe_session_id=?").bind(s.id).run();
  await event('checkout.session.completed',s,'replay-revoked');
  assert.equal((await DB.prepare('SELECT status FROM licenses WHERE stripe_session_id=?').bind(s.id).first()).status,'revoked');
});
test('wrong product/price/amount rejected; concurrent completion creates one license',async()=>{
  await call('/create-checkout',{claimToken:'c'.repeat(64)});const s=sessions.get('cs_test_order3');s.payment_status='paid';
  const original=s.metadata.product_id;s.metadata.product_id='other';assert.equal((await event('checkout.session.completed',s)).status,400);s.metadata.product_id=original;
  s.line_items.data[0].price.id='price_other';assert.equal((await event('checkout.session.completed',s)).status,400);s.line_items.data[0].price.id='price_test';
  s.amount_total=1;assert.equal((await event('checkout.session.completed',s)).status,400);s.amount_total=980;
  const results=await Promise.all([event('checkout.session.completed',s,'parallel-a'),event('checkout.session.completed',s,'parallel-b')]);
  assert(results.every(r=>r.status===200));
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM licenses WHERE stripe_session_id=?').bind(s.id).first()).n,1);
  const result=await(await call('/claim-license',{sessionId:s.id,claimToken:'c'.repeat(64)})).json();assert(normalizeLicense(result.license));
});
test('mode mismatch is fail-closed and rate limiting applies',async()=>{
  const bad={...env,ENVIRONMENT:'live'};
  assert.equal((await worker.fetch(new Request('https://api.example/verify-license',{method:'POST',headers:{origin:'https://asm-asm.github.io'}}),bad)).status,503);
  let response;for(let i=0;i<65;i++)response=await call('/verify-license',{license:'bad'});assert.equal(response.status,429);
});
