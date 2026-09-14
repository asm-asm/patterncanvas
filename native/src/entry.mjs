// Paid download: all functionality is included. No account or external unlock.
try{
  await import('./app.mjs');
  document.documentElement.classList.remove('access-pending');
}catch{
  document.body.replaceChildren();
  const panel=document.createElement('main');panel.className='settings-card';
  const title=document.createElement('h1');title.textContent='起動できませんでした';
  const message=document.createElement('p');message.textContent='保存済みの作品は削除していません。一度アプリを閉じて、もう一度お試しください。';
  const button=document.createElement('button');button.textContent='再読み込み';button.onclick=()=>location.reload();
  panel.append(title,message,button);document.body.append(panel);
}
