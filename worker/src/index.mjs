import Stripe from 'stripe';
import product from '../../commerce/product.json' with {type:'json'};
import {digest,randomLicense,normalizeLicense,seal,unseal} from './crypto.mjs';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(status)=>Object.assign(new Error('Request failed'),{status});
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const licenseHash=(env,code)=>digest(env.LICENSE_HASH_SECRET,`${env.ENVIRONMENT}:license:${code}`);
const claimHash=(env,token)=>digest(env.LICENSE_HASH_SECRET,`${env.ENVIRONMENT}:claim:${token}`);
const mask=email=>typeof email==='string'?email.replace(/^(.).*(@.*)$/,'$1***$2'):'';
function claimToken(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw fail(400);return value;}
function configured(env){
  if(!['test','live'].includes(env.ENVIRONMENT))throw fail(503);
  const prefix=env.ENVIRONMENT==='live'?'sk_live_':'sk_test_';
  if(!env.STRIPE_SECRET_KEY?.startsWith(prefix))throw fail(503);
  const url=new URL(env.FRONTEND_URL);
  if(url.href!=='https://asm-asm.github.io/patterncanvas/iphone/'&&!(env.ENVIRONMENT==='test'&&env.LOCAL_DEVELOPMENT==='true'&&['localhost','127.0.0.1'].includes(url.hostname)))throw fail(503);
}
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415);
  const text=await request.text();if(text.length>4096)throw fail(413);
  try{const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw 0;return data;}catch{throw fail(400);}
}
async function rateLimit(request,env,path){
  // CF supplies this header in production; store only a keyed hash, never raw IP.
  const minute=Math.floor(Date.now()/60000);
  const key=await digest(env.LICENSE_HASH_SECRET,`rate:${request.headers.get('CF-Connecting-IP')||'local'}:${path}:${minute}`);
  const result=await stmt(env,'INSERT INTO rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',key,minute+2).first();
  await stmt(env,'DELETE FROM rate_limits WHERE expires_at < ?',minute).run();
  if(result.count>(path==='/create-checkout'?10:60))throw fail(429);
}
async function checkout(data,env,stripe){
  const hash=await claimHash(env,claimToken(data.claimToken));
  const priceId=env.ENVIRONMENT==='live'?env.STRIPE_PRICE_ID_LIVE:env.STRIPE_PRICE_ID_TEST;
  if(!/^price_[A-Za-z0-9]+$/.test(priceId||''))throw fail(503);
  const price=await stripe.prices.retrieve(priceId);
  if(!price.active||price.type!=='one_time'||price.currency!==product.currency||price.unit_amount!==product.amount||price.livemode!==(env.ENVIRONMENT==='live'))throw fail(503);
  await stmt(env,'INSERT OR IGNORE INTO checkout_requests(claim_hash,price_id,environment,amount,currency) VALUES(?,?,?,?,?)',hash,priceId,env.ENVIRONMENT,price.unit_amount,price.currency).run();
  const existing=await stmt(env,'SELECT * FROM checkout_requests WHERE claim_hash=?',hash).first();
  if(existing.stripe_session_id){
    const session=await stripe.checkout.sessions.retrieve(existing.stripe_session_id);
    if(session.status!=='open'||!session.url)throw fail(409);
    return json({url:session.url});
  }
  const session=await stripe.checkout.sessions.create({
    mode:'payment',payment_method_types:['card'],customer_creation:'always',
    line_items:[{price:existing.price_id,quantity:1}],
    success_url:`${env.FRONTEND_URL}payment-success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:env.FRONTEND_URL,
    metadata:{product_id:product.id,claim_hash:hash},
    payment_intent_data:{metadata:{product_id:product.id}},
  },{idempotencyKey:`${env.ENVIRONMENT}-${hash}`});
  await stmt(env,'UPDATE checkout_requests SET stripe_session_id=? WHERE claim_hash=? AND stripe_session_id IS NULL',session.id,hash).run();
  return json({url:session.url});
}
async function webhook(request,env,stripe){
  let event;
  try{
    const raw=await request.text();if(raw.length>1024*1024)throw 0;
    event=await stripe.webhooks.constructEventAsync(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());
  }catch{throw fail(400);}
  if(event.livemode!==(env.ENVIRONMENT==='live'))throw fail(400);
  if(await stmt(env,'SELECT id FROM stripe_events WHERE id=?',event.id).first())return json({received:true});
  const object=event.data.object;
  const statements=[];
  if(event.type==='checkout.session.completed'){
    // A signed completion alone isn't proof of a paid, matching order.
    const session=await stripe.checkout.sessions.retrieve(object.id,{expand:['line_items']});
    const hash=session.metadata?.claim_hash;
    const order=await stmt(env,'SELECT * FROM checkout_requests WHERE claim_hash=? AND environment=?',hash||'',env.ENVIRONMENT).first();
    const lines=session.line_items;
    if(!order||session.metadata?.product_id!==product.id||session.mode!=='payment'||session.payment_status!=='paid'||session.livemode!==event.livemode||session.amount_total!==order.amount||session.currency!==order.currency||lines?.has_more||lines?.data?.length!==1||lines.data[0].price.id!==order.price_id||lines.data[0].quantity!==1||!session.payment_intent||!session.customer_details?.email)throw fail(400);
    if(order.stripe_session_id&&order.stripe_session_id!==session.id)throw fail(400);
    const code=randomLicense();
    const encrypted=await seal(env.LICENSE_ENCRYPTION_SECRET,code,`${env.ENVIRONMENT}:${session.id}`);
    statements.push(stmt(env,'UPDATE checkout_requests SET stripe_session_id=? WHERE claim_hash=? AND stripe_session_id IS NULL',session.id,hash));
    statements.push(stmt(env,`INSERT OR IGNORE INTO licenses(license_hash,license_ciphertext,email,stripe_customer_id,stripe_session_id,stripe_payment_intent_id,product_id,environment,status,purchased_at)
      VALUES(?,?,?,?,?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM payment_status WHERE payment_intent_id=? AND status='refunded') THEN 'refunded' ELSE 'active' END,?)`,
      await licenseHash(env,code),encrypted,session.customer_details.email,session.customer||null,session.id,session.payment_intent,product.id,env.ENVIRONMENT,session.payment_intent,new Date(session.created*1000).toISOString()));
  }else if(event.type==='charge.refunded'||event.type==='payment_intent.payment_failed'){
    const payment=event.type==='charge.refunded'?object.payment_intent:object.id;
    const state=event.type==='charge.refunded'?'refunded':'failed';
    if(typeof payment!=='string'||!payment.startsWith('pi_'))throw fail(400);
    // Any refund (including partial) revokes access. A failure cannot undo a refund.
    statements.push(stmt(env,`INSERT INTO payment_status(payment_intent_id,status) VALUES(?,?) ON CONFLICT(payment_intent_id) DO UPDATE SET status=CASE WHEN payment_status.status='refunded' THEN 'refunded' ELSE excluded.status END,updated_at=CURRENT_TIMESTAMP`,payment,state));
    if(state==='refunded')statements.push(stmt(env,"UPDATE licenses SET status='refunded' WHERE stripe_payment_intent_id=?",payment));
  }
  statements.push(stmt(env,'INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)',event.id,event.type));
  await env.DB.batch(statements);
  return json({received:true});
}
async function verify(data,env){
  const code=normalizeLicense(data.license);if(!code)return json({valid:false});
  const record=await stmt(env,'SELECT * FROM licenses WHERE license_hash=? AND environment=? AND product_id=?',await licenseHash(env,code),env.ENVIRONMENT,product.id).first();
  if(!record||record.status!=='active')return json({valid:false});
  const verifiedAt=Date.now();
  await stmt(env,'UPDATE licenses SET last_verified_at=? WHERE id=?',new Date(verifiedAt).toISOString(),record.id).run();
  return json({valid:true,status:'active',email:mask(record.email),verifiedAt,offlineUntil:verifiedAt+product.offlineGraceDays*86400000});
}
async function claim(data,env){
  if(typeof data.sessionId!=='string'||!/^cs_[A-Za-z0-9_]{5,250}$/.test(data.sessionId))throw fail(400);
  const hash=await claimHash(env,claimToken(data.claimToken));
  const order=await stmt(env,'SELECT * FROM checkout_requests WHERE claim_hash=? AND stripe_session_id=? AND environment=?',hash,data.sessionId,env.ENVIRONMENT).first();
  if(!order)throw fail(404);
  const record=await stmt(env,'SELECT * FROM licenses WHERE stripe_session_id=? AND environment=?',data.sessionId,env.ENVIRONMENT).first();
  if(!record)return json({pending:true},202);
  if(record.status!=='active')throw fail(403);
  return json({license:await unseal(env.LICENSE_ENCRYPTION_SECRET,record.license_ciphertext,`${env.ENVIRONMENT}:${data.sessionId}`)});
}
// Injection is only for tests. Deployed entry always uses Stripe's HTTPS client.
export function createWorker(stripeFactory=key=>new Stripe(key,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2})){
  return {async fetch(request,env){
    const path=new URL(request.url).pathname;
    const origin=request.headers.get('origin');
    const allowed=origin==='https://asm-asm.github.io'||(env.ENVIRONMENT==='test'&&env.LOCAL_DEVELOPMENT==='true'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||''));
    const cors=response=>{
      if(allowed){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','POST, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type');}
      return response;
    };
    try{
      configured(env);
      if(path!=='/stripe/webhook'&&!allowed)throw fail(403);
      if(request.method==='OPTIONS')return cors(new Response(null,{status:204}));
      if(request.method!=='POST')throw fail(405);
      if(path==='/stripe/webhook')return await webhook(request,env,stripeFactory(env.STRIPE_SECRET_KEY));
      if(!['/create-checkout','/claim-license','/verify-license'].includes(path))throw fail(404);
      await rateLimit(request,env,path);
      const data=await body(request);
      const response=path==='/create-checkout'?await checkout(data,env,stripeFactory(env.STRIPE_SECRET_KEY)):path==='/claim-license'?await claim(data,env):await verify(data,env);
      return cors(response);
    }catch(error){return cors(json({error:'リクエストを処理できませんでした。時間をおいて再度お試しください。'},error.status||503));}
  }};
}
export default createWorker();
