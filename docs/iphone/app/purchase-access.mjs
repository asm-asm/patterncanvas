import * as Platform from './platform.mjs';
const TRIAL='jp.amimononote.ios.trial7',FULL='jp.amimononote.ios.lifetime';
let status={state:Platform.native?'checking':'purchased',products:[]},receivedAt=performance.now(),busy=false,refreshing=false,pendingProducts=false,onChange=()=>{};
const $=id=>document.getElementById(id);
export function canUse(){
 if(['legacy','purchased'].includes(status.state))return true;
 return status.state==='trial'&&Number.isFinite(status.expiresAt)&&Math.max(Date.now(),status.now+Math.max(0,performance.now()-receivedAt))<status.expiresAt;
}
export const accessState=()=>status.state;
export function requireUse(){if(canUse())return true;openPurchase();return false;}
let lastAllowed=canUse(),lastState=status.state;
function notifyAccess(){const allowed=canUse();if(allowed===lastAllowed&&status.state===lastState)return;lastAllowed=allowed;lastState=status.state;document.querySelectorAll('[data-purchase-disabled]').forEach(el=>{el.disabled=el.dataset.purchaseDisabled==='true';delete el.dataset.purchaseDisabled;});onChange();}
function accept(next){status=next;receivedAt=performance.now();draw();notifyAccess();notice();}
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
 if($('access-dialog')?.open&&noticeKind){fillNotice();const want=noticeAction===TRIAL?trial:full;$('access-primary').disabled=busy||!want||!status.canPurchase;$('access-restore').disabled=$('access-later').disabled=busy;}
 $('purchase-price').textContent=full?`体験後も編集・カウンターを使う場合は${full.price}の買い切りです。`:'体験後も編集・カウンターを使う場合は3,000円の買い切りです。購入価格はAppleの確認画面にも表示されます。';
}
export function restrictControls(){
 if(canUse())return;
 const ids=['complete','previous','choose-row','row-go','memo-save','direction-bottom','direction-top','knitting-mode-save','name','dividers','apply-repeats','padding-open','padding-apply','add-color','new-project','text-open','text-apply','image-file','image-convert','photo-file','photo-apply','import','flip-h','flip-v','clear','copy','move','undo','redo','stitch-edit','structure-apply'];
 for(const id of ids){const el=$(id);if(el){if(el.dataset.purchaseDisabled===undefined)el.dataset.purchaseDisabled=String(el.disabled);el.disabled=true;}}
 document.querySelectorAll('#tools button,#palette button,#yarn-list button').forEach(el=>{if(el.dataset.purchaseDisabled===undefined)el.dataset.purchaseDisabled=String(el.disabled);el.disabled=true;});
}
async function refresh(loadProducts=false){
 if(refreshing){pendingProducts ||= loadProducts;return;}refreshing=true;
 try{accept(await timed(Platform.getPurchaseStatus({loadProducts})));}
 catch{if(!['legacy','purchased','trial'].includes(status.state))accept({state:'unavailable',products:[]});$('purchase-error').textContent='購入情報を取得できません。ネット接続とApple Accountを確認し「再確認」または「購入を復元」をお試しください。作品の閲覧・書き出しはできます。';}
 finally{refreshing=false;draw();if(pendingProducts){pendingProducts=false;void refresh(true);}}
}
// One-time notices: a welcome that states the trial terms before it starts (App Review 3.1.1), a reminder in the
// last 24 hours, and a notice when the trial ends. Each is shown once (the welcome at most once a day).
const SEEN='patterncanvas-purchase-notices',DAY=86400000;let noticeAction=null,noticeKind=null;
const seen=()=>{try{return JSON.parse(localStorage.getItem(SEEN)||'{}');}catch{return {};}};
const mark=(key,value)=>{try{localStorage.setItem(SEEN,JSON.stringify({...seen(),[key]:value}));}catch{}};
const price=()=>status.products?.find(p=>p.id===FULL&&!p.isFree)?.price||'3,000円';
function notice(){
 const dialog=$('access-dialog');if(!Platform.native||!dialog||dialog.open||$('purchase-dialog')?.open||status.state==='checking')return;
 const now=Math.max(Date.now(),status.now+Math.max(0,performance.now()-receivedAt)),left=status.expiresAt-now,s=seen(),today=new Date(now).toDateString();
 let kind=null;
 if(status.state==='notStarted'&&s.welcome!==today)kind='welcome';
 else if(status.state==='trial'&&left>0&&left<DAY&&s.reminder!==status.expiresAt)kind='reminder';
 else if((status.state==='expired'||status.state==='trial'&&left<=0)&&s.expired!==(status.expiresAt||'expired'))kind='expired';
 if(!kind)return;
 mark(kind,kind==='welcome'?today:status.expiresAt||'expired');showNotice(kind);
}
function fillNotice(){
 const kind=noticeKind,left=status.expiresAt-Math.max(Date.now(),status.now+Math.max(0,performance.now()-receivedAt)),pts=$('access-points');pts.replaceChildren();
 const set=(title,points,terms,primary,later)=>{$('access-title').textContent=title;for(const t of points){const li=document.createElement('li');li.textContent=t;pts.append(li);}$('access-terms').textContent=terms;$('access-primary').textContent=primary;$('access-later').textContent=later;};
 const forever=`${price()}の買い切り（1回のみ）`;
 if(kind==='welcome')set('7日間、すべての機能を無料で試せます',[`その後は${forever}`,'自動課金・月額料金はありません','体験後も作品の閲覧・書き出しはできます'],'編み図づくり・写真から編み図・編み地プレビュー・段数カウンターを、すべてお試しいただけます。体験後に編集・段数カウンターを続ける場合だけ購入が必要です。','7日間の無料体験をはじめる','あとで');
 else if(kind==='reminder')set(`無料体験は残り約${Math.max(1,Math.ceil(left/3600000))}時間です`,[`${new Date(status.expiresAt).toLocaleString('ja-JP')}まで全機能をご利用いただけます。`],`続けて編集・段数カウンターを使う場合は${forever}で永久解除できます。自動課金はありません。`,`${price()}で永久解除`,'あとで');
 else set('無料体験が終了しました',['作品はそのまま残っています。','閲覧・拡大縮小・書き出しは引き続きできます。'],`編集・段数カウンターを続けるには${forever}で永久解除できます。自動課金はありません。`,`${price()}で永久解除`,'あとで（閲覧のみ）');
 $('access-restore').hidden=kind==='reminder';
}
function showNotice(kind){noticeKind=kind;noticeAction=kind==='welcome'?TRIAL:FULL;$('access-error').textContent='';fillNotice();$('access-dialog').showModal();void refresh(true);}
export function openPurchase(){if(!$('purchase-dialog'))return;if(!$('purchase-dialog').open)$('purchase-dialog').showModal();void refresh(true);}
export function setupPurchases(changed){
 onChange=changed;if(!Platform.native)return;
 $('purchase-card').hidden=false;
 $('purchase-open').onclick=$('purchase-banner').onclick=openPurchase;
 $('purchase-close').onclick=()=>$('purchase-dialog').close();
 $('purchase-refresh').onclick=()=>{void refresh(true);};
 async function act(action,out='purchase-error'){
  if(busy)return;busy=true;$(out).textContent='';draw();
  try{const next=await action();accept(next);$(out).textContent=next.action==='pending'?'購入の承認待ちです。承認されると利用可能になります。':next.action==='cancelled'?'購入をキャンセルしました。請求はありません。':canUse()?'利用状況を確認しました。全機能をご利用いただけます。':'購入状況を確認しました。';}
  catch(e){$(out).textContent=e.message||'処理できませんでした。もう一度お試しください。';}
  finally{busy=false;draw();}
 }
 $('purchase-trial').onclick=()=>act(()=>Platform.purchaseProduct(TRIAL));
 $('access-later').onclick=()=>$('access-dialog').close();
 $('access-primary').onclick=async()=>{await act(()=>Platform.purchaseProduct(noticeAction),'access-error');if(canUse())$('access-dialog').close();};
 $('access-restore').onclick=async()=>{await act(()=>Platform.restorePurchases(),'access-error');if(canUse())$('access-dialog').close();};
 $('purchase-full').onclick=()=>act(()=>Platform.purchaseProduct(FULL));
 $('purchase-restore').onclick=()=>act(()=>Platform.restorePurchases());
 Platform.onPurchaseChange?.(accept);
 for(const event of ['pageshow','patterncanvas-resume'])window.addEventListener(event,()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{draw();notifyAccess();notice();},1000);
 setInterval(()=>{if(!document.hidden)void refresh();},60000);
 void refresh();
}
