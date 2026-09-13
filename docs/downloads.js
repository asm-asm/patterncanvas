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
  note.textContent = '旧名称・旧版を含むAPKの累計取得回数（GitHub集計）。再取得や確認用の取得も含み、利用者数・インストール数とは異なります。';
  panel.append(value, note);
  container.append(panel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let count = 0;
    for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/asm-asm/patterncanvas/releases?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Statistics unavailable');
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid releases');
    for (const release of releases) for (const asset of release.assets || []) {
      if (!asset.name?.toLowerCase().endsWith('.apk')) continue;
      if (!Number.isSafeInteger(asset.download_count) || asset.download_count < 0) throw new Error('Invalid count');
      count += asset.download_count;
    }
    if (releases.length < 100) break;
    }
    value.textContent = `${count.toLocaleString('ja-JP')} 回ダウンロード`;
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
