import config from './config.mjs';
import product from './product.mjs';
import {load,save,offlineValid} from './storage.mjs';
const base=new URL('../',import.meta.url);
const href=path=>new URL(path,base).href;
async function api(path,data){
  if(!config.apiBase)throw Error('通信先が未設定です。');
  const response=await fetch(`${config.apiBase.replace(/\/$/,'')}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
  if(!response.ok){const e=Error('確認できませんでした。時間をおいて再度お試しください。');e.status=response.status;throw e;}
  return response.json();
}
const links=()=>`<nav class="access-links"><a href="${href('legal/terms.html')}">利用規約</a><a href="${href('legal/privacy.html')}">プライバシー</a><a href="${href('legal/tokusho.html')}">特定商取引法に基づく表記</a></nav>`;
export async function mountGate({page,onGranted}){
  let current,opened=false,timer,busy=false;
  const panel=document.createElement('section');panel.className='access-panel';panel.setAttribute('aria-label','ライセンス');document.body.prepend(panel);
  const bar=document.createElement('div');bar.className='access-account';bar.hidden=true;document.body.prepend(bar);
  const message=text=>{const el=panel.querySelector('[role=status]');if(el)el.textContent=text;};
  function lock(){document.documentElement.classList.remove('access-pending');document.documentElement.classList.add('access-locked');panel.hidden=false;bar.hidden=true;}
  function backup(){
    const raw=localStorage.getItem('patterncanvas-iphone-v1');if(!raw){message('このブラウザには保存済み作品がありません。');return;}
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='amimono-note-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function purchase(reason=''){
    lock();
    panel.innerHTML=`<small>編みものノート for iPhone</small><h1>思い描いた模様を、<br>ひと目ずつ。</h1><p>編み図・編み地プレビュー・段数カウンターを、いつものiPhoneで。</p><p class="access-price">買い切り ${new Intl.NumberFormat('ja-JP',{style:'currency',currency:product.currency,maximumFractionDigits:0}).format(product.amount)}</p><p>月額料金なし。会員登録なし。</p>${config.mode==='test'?'<p>テスト決済モードです。実際の請求は発生しません。</p>':''}<label class="consent"><input id="consent" type="checkbox">利用規約・プライバシーポリシー・販売条件を確認しました</label><button id="buy">購入する</button><h2>すでに購入済みの方</h2><form id="license-form"><label for="license">ライセンスコード</label><input id="license" name="license" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="100" placeholder="PC-IOS-…" required><button>確認する</button></form><p role="status" aria-live="polite" class="access-error"></p><small>コードを紛失した場合の自動再送は準備中です。購入時のコードを大切に保管してください。作品データはこの端末に残ります。</small><button id="backup" class="secondary">保存済み作品をバックアップ</button>${links()}`;
    message(reason);
    panel.querySelector('#backup').onclick=backup;
    panel.querySelector('#buy').onclick=async()=>{
      if(!panel.querySelector('#consent').checked){message('購入前に販売条件をご確認ください。');return;}
      if(config.mode==='live'&&!config.legalReady){message('販売準備中です。');return;}
      const button=panel.querySelector('#buy');button.disabled=true;
      try{
        let token=await load('checkout-token');
        if(!token){token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');await save('checkout-token',token);}
        let result;
        try{result=await api('/create-checkout',{claimToken:token});}catch(e){if(e.status===409)await save('checkout-token',null);throw e;}
        const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('決済先を確認できませんでした。');
        location.assign(url.href);
      }catch(e){message(e.message);button.disabled=false;}
    };
    panel.querySelector('#license-form').onsubmit=async event=>{
      event.preventDefault();const button=panel.querySelector('#license-form button');button.disabled=true;
      try{
        const license=panel.querySelector('#license').value.trim().toUpperCase();
        const result=await api('/verify-license',{license});
        if(!result.valid){message('ライセンスを確認できませんでした。入力内容をご確認ください。');return;}
        current={...result,license};await save('license',current);await grant();
      }catch{message('インターネット接続と端末の保存設定を確認して、もう一度お試しください。');}finally{button.disabled=false;}
    };
  }
  function info(){
    panel.hidden=false;
    panel.innerHTML=`<h1>ライセンス情報</h1><p>ライセンス：有効</p><p id="email"></p><p id="verified"></p><label>他のiPhoneで使用するコード<input id="saved-code" readonly></label><button id="copy">コードをコピー</button><button id="close-info" class="secondary">編みものノートに戻る</button><button id="forget" class="secondary">この端末のライセンス登録を解除</button><p role="status" aria-live="polite"></p>${links()}`;
    panel.querySelector('#email').textContent=`購入メール：${current.email||'登録なし'}`;
    panel.querySelector('#verified').textContent=`ライセンス確認：${new Date(current.verifiedAt).toLocaleString('ja-JP')}`;
    panel.querySelector('#saved-code').value=current.license;
    panel.querySelector('#copy').onclick=()=>navigator.clipboard.writeText(current.license).then(()=>message('コピーしました。'),()=>message('コードを長押ししてコピーしてください。'));
    panel.querySelector('#close-info').onclick=()=>panel.hidden=true;
    panel.querySelector('#forget').onclick=async()=>{await save('license',null);current=null;purchase('ライセンス登録を解除しました。作品は保持しています。');};
  }
  async function grant(){
    if(page==='entry'){location.replace(href('app/'));return;}
    if(page==='success')return;
    document.documentElement.classList.remove('access-pending','access-locked');panel.hidden=true;
    if(!opened){await onGranted();opened=true;}
    bar.hidden=false;bar.innerHTML='<span>ライセンス：有効</span><button>ライセンス情報</button>';bar.querySelector('button').onclick=info;
  }
  async function check(){
    if(busy)return;busy=true;
    try{
      current=await load('license');
      if(!current?.license){purchase();return;}
      try{
        const result=await api('/verify-license',{license:current.license});
        if(!result.valid){await save('license',null);current=null;purchase('ライセンスを確認できませんでした。入力内容をご確認ください。');return;}
        current={...result,license:current.license};await save('license',current);
      }catch(e){
        if((e.status&&e.status<500)||!offlineValid(current)){purchase('ライセンス確認のため一度インターネットに接続してください。作品は保持しています。');return;}
      }
      await grant();
    }catch{purchase('端末にライセンスを保存できません。Safariの保存設定をご確認ください。');}finally{busy=false;}
  }
  if(page==='success'){
    lock();panel.innerHTML='<h1>購入を確認しています</h1><p>決済完了の通知を待っています。この画面を閉じずにお待ちください。</p><p role="status" aria-live="polite"></p><button id="retry">もう一度確認</button>'+links();
    let attempts=0;
    const claim=async()=>{
      if(busy)return;busy=true;
      try{
        const token=await load('checkout-token');if(!token)throw Error('購入したSafariでこのページを開いてください。ライセンスが手元にあれば入力画面から登録できます。');
        const result=await api('/claim-license',{sessionId:new URL(location.href).searchParams.get('session_id'),claimToken:token});
        if(result.pending){if(++attempts<20)timer=setTimeout(claim,2000);else message('決済通知を待っています。しばらくして「もう一度確認」を押してください。');return;}
        const verified=await api('/verify-license',{license:result.license});if(!verified.valid)throw Error('ライセンスを確認できませんでした。');
        await save('license',{...verified,license:result.license});
        panel.innerHTML=`<h1>購入が完了しました</h1><label>あなたのライセンス<input id="issued" readonly></label><p>このコードを大切に保管してください。別のiPhoneでも利用できます。</p><button id="copy">コードをコピー</button><a class="access-button" href="${href('app/')}">編みものノートを開く</a><p role="status" aria-live="polite"></p>${links()}`;
        panel.querySelector('#issued').value=result.license;
        panel.querySelector('#copy').onclick=()=>navigator.clipboard.writeText(result.license).then(()=>message('コピーしました。'),()=>message('コードを長押ししてコピーしてください。'));
      }catch(e){message(e.message);}finally{busy=false;}
    };
    panel.querySelector('#retry').onclick=()=>{clearTimeout(timer);attempts=0;claim();};await claim();
  }else{
    await check();
    setInterval(()=>{if(current)check();},product.recheckMinutes*60000);
    addEventListener('online',()=>check());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  }
}
