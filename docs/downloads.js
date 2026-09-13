// GitHub records asset downloads, including direct links and repeat downloads.
// No click tracking, visitor identifier, cookies, or client-side credentials.
(async function () {
  const container = document.querySelector('.download-action');
  if (!container) return;
  const panel = document.createElement('div');
  panel.className = 'download-count';
  const value = document.createElement('p');
  value.setAttribute('role', 'status');
  value.textContent = 'ダウンロード数を確認中…';
  const note = document.createElement('small');
  note.textContent = 'v0.2.0のAPK取得回数（GitHub集計）。再取得や確認用の取得も含み、利用者数・インストール数とは異なります。';
  panel.append(value, note);
  container.append(panel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.github.com/repos/asm-asm/patterncanvas/releases/tags/v0.2.0', {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Statistics unavailable');
    const release = await response.json();
    const asset = release.assets?.find(item => item.name === 'PatternCanvas-0.2.0-debug.apk');
    if (!Number.isSafeInteger(asset?.download_count) || asset.download_count < 0) throw new Error('Invalid count');
    value.textContent = `${asset.download_count.toLocaleString('ja-JP')} 回ダウンロード`;
    const time = document.createElement('small');
    time.textContent = `取得日時：${new Date().toLocaleString('ja-JP')}（集計の反映に遅れが出る場合があります）`;
    panel.append(time);
  } catch {
    value.textContent = 'ダウンロード数は現在取得できません';
    note.textContent = '時間をおいてページを開き直してください。APKのダウンロードはそのまま利用できます。';
  } finally {
    clearTimeout(timeout);
  }
})();
