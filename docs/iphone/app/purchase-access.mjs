import * as Platform from './platform.mjs';
const TRIAL='jp.amimononote.ios.trial7',FULL='jp.amimononote.ios.lifetime';
let status={state:Platform.native?'checking':'purchased',products:[]},receivedAt=performance.now(),busy=false,refreshing=false,onChange=()=>{};
const $=id=>document.getElementById(id);
export function canUse(){
 if(['legacy','purchased'].includes(status.state))return true;
 return status.state==='trial'&&Number.isFinite(status.expiresAt)&&Math.max(Date.now(),status.now+Math.max(0,performance.now()-receivedAt))<status.expiresAt;
}
export function requireUse(){if(canUse())return true;openPurchase();return false;}
let lastAllowed=canUse(),lastState=status.state;
function notifyAccess(){const allowed=canUse();if(allowed===lastAllowed&&status.state===lastState)return;lastAllowed=allowed;lastState=status.state;document.querySelectorAll('[data-purchase-disabled]').forEach(el=>{el.disabled=el.dataset.purchaseDisabled==='true';delete el.dataset.purchaseDisabled;});onChange();}
function accept(next){status=next;receivedAt=performance.now();draw();notifyAccess();}
function timed(promise){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('通信状態を確認して、もう一度お試しください。')),20000))]);}
function draw(){
 if(!$('purchase-card'))return;
 const active=canUse(),expired=status.state==='expired'||status.state==='trial'&&!active;
 const labels={checking:'購入情報を確認中…',legacy:'購入済み · 全機能をご利用いただけます',purchased:'永久解除済み',notStarted:'7日間、全機能を無料で体験できます',unavailable:'購入情報を確認できません'};
 let label=expired?'無料体験が終了しました':labels[status.state]||'購入情報を確認中…';
 if(status.state==='trial'&&active)label=`無料体験中 · ${new Date(status.expiresAt).toLocaleString('ja-JP')}まで`;
 $('purchase-status').textContent=label;$('purchase-summary').textContent=label;
 $('purchase-banner').hidden=active||status.state==='checking';
 const trial=status.products?.find(p=>p.id===TRIAL&&p.isFree),full=status.products?.find(p=>p.id===FULL&&!p.isFree);
 $('purchase-trial').hidden=status.state!=='notStarted';$('purchase-trial').disabled=busy||!trial||!status.canPurchase;
 $('purchase-full').hidden=['legacy','purchased'].includes(status.state);$('purchase-full').disabled=busy||!full||!status.canPurchase;
 $('purchase-full').textContent=full?`${full.price}で永久解除（買い切り）`:'購入価格を確認中';
 $('purchase-restore').disabled=busy;$('purchase-refresh').disabled=busy;
 $('purchase-price').textContent=full?`体験後も編集・カウンターを使う場合は${full.price}の買い切りです。`:'体験後も編集・カウンターを使う場合は3,000円の買い切りです。購入価格はAppleの確認画面にも表示されます。';
}
export function restrictControls(){
 if(canUse())return;
 const ids=['complete','previous','choose-row','row-go','memo-save','direction-bottom','direction-top','knitting-mode-save','name','dividers','apply-repeats','padding-open','padding-apply','add-color','new-project','text-open','text-apply','image-file','image-convert','import','flip-h','flip-v','clear','copy','move','undo','redo','stitch-edit','structure-apply'];
 for(const id of ids){const el=$(id);if(el){if(el.dataset.purchaseDisabled===undefined)el.dataset.purchaseDisabled=String(el.disabled);el.disabled=true;}}
 document.querySelectorAll('#tools button,#palette button,#yarn-list button').forEach(el=>{if(el.dataset.purchaseDisabled===undefined)el.dataset.purchaseDisabled=String(el.disabled);el.disabled=true;});
}
async function refresh(loadProducts=false){
 if(refreshing)return;refreshing=true;
 try{accept(await timed(Platform.getPurchaseStatus({loadProducts})));}
 catch{if(!['legacy','purchased','trial'].includes(status.state))accept({state:'unavailable',products:[]});$('purchase-error').textContent='購入情報を取得できません。ネット接続とApple Accountを確認し「再確認」または「購入を復元」をお試しください。作品の閲覧・書き出しはできます。';}
 finally{refreshing=false;draw();}
}
export function openPurchase(){if(!$('purchase-dialog'))return;if(!$('purchase-dialog').open)$('purchase-dialog').showModal();void refresh(true);}
export function setupPurchases(changed){
 onChange=changed;if(!Platform.native)return;
 $('purchase-card').hidden=false;
 $('purchase-open').onclick=$('purchase-banner').onclick=openPurchase;
 $('purchase-close').onclick=()=>$('purchase-dialog').close();
 $('purchase-refresh').onclick=()=>{void refresh(true);};
 async function act(action){
  if(busy)return;busy=true;$('purchase-error').textContent='';draw();
  try{const next=await action();accept(next);$('purchase-error').textContent=next.action==='pending'?'購入の承認待ちです。承認されると利用可能になります。':next.action==='cancelled'?'購入をキャンセルしました。請求はありません。':canUse()?'利用状況を確認しました。全機能をご利用いただけます。':'購入状況を確認しました。';}
  catch(e){$('purchase-error').textContent=e.message||'処理できませんでした。もう一度お試しください。';}
  finally{busy=false;draw();}
 }
 $('purchase-trial').onclick=()=>act(()=>Platform.purchaseProduct(TRIAL));
 $('purchase-full').onclick=()=>act(()=>Platform.purchaseProduct(FULL));
 $('purchase-restore').onclick=()=>act(()=>Platform.restorePurchases());
 Platform.onPurchaseChange?.(accept);
 for(const event of ['pageshow','patterncanvas-resume'])window.addEventListener(event,()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{draw();notifyAccess();},1000);
 setInterval(()=>{if(!document.hidden)void refresh();},60000);
 void refresh();
}
