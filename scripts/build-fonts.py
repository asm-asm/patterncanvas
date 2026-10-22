# Fonts for 「文字から編み図を作成」: free for commercial use, bundled so the app works offline.
# Downloads each source (checked against its SHA-256), keeps JIS X 0208 + ASCII (+ a few hearts and flowers),
# writes WOFF2 and the licence texts to docs/iphone/app/fonts/.
# Usage: pip install fonttools brotli && python scripts/build-fonts.py <download-cache-dir>
import hashlib, io, sys, urllib.request, zipfile
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
SOURCES = {
 'ZenMaruGothic-Bold.ttf': (GF + 'zenmarugothic/ZenMaruGothic-Bold.ttf', 'fe24426b9c8b5523a0146a8235c8674eccf0493af354a53ec895c3596d9eb745'),
 'ZenMaruGothic-OFL.txt': (GF + 'zenmarugothic/OFL.txt', '2a20cf7ce1909d8ee1e949095d340f7d7656705f7c810a2d6faf56800ad0cb3d'),
 'DelaGothicOne-Regular.ttf': (GF + 'delagothicone/DelaGothicOne-Regular.ttf', '4ff87a0965f1b0505e5a2c58424bc6ad3cff27e56a82f21c2fc9d6b0e3857ee2'),
 'DelaGothicOne-OFL.txt': (GF + 'delagothicone/OFL.txt', 'c0014792d4f4abc0508c295b277f2b17ae44465c8dc88d12af9cea48279b5fda'),
 'YuseiMagic-Regular.ttf': (GF + 'yuseimagic/YuseiMagic-Regular.ttf', '82098615f39ed9da6a8ccc674b9006e49c70dd5b775a7a1697f6bedd22ce25a2'),
 'YuseiMagic-OFL.txt': (GF + 'yuseimagic/OFL.txt', 'c74e8c47951ddd9c902f07097761cfa0457993e28d8e1e946e273c0250be77c9'),
 'Pacifico-Regular.ttf': (GF + 'pacifico/Pacifico-Regular.ttf', '5b6c0d5334a7bf77dea52b975c5a0c408878c0f7115ed5b6fb151f634b7bf701'),
 'Pacifico-OFL.txt': (GF + 'pacifico/OFL.txt', 'a47e5daeda73568969395c656823102678f2eefb0d7d7ecb47aac4cc17e42204'),
 'misaki_ttf_2021-05-05.zip': ('https://littlelimit.net/arc/misaki/misaki_ttf_2021-05-05.zip', 'c1851af85a0a010dd84f40803159c2d8a23feecb6c7e800cfeb5c6edc50da46e'),
 'PixelMplus-20130602.zip': ('https://github.com/itouhiro/PixelMplus/releases/download/v1.0.0/PixelMplus-20130602.zip', 'ca4b5eecc9cf869e85d480000084ecc0fb24c16fc8b37b4046145ecd642fae11'),
}

def fetch(cache, name):
 url, want = SOURCES[name]; path = cache / name
 if not path.exists(): path.write_bytes(urllib.request.urlopen(url).read())
 data = path.read_bytes(); got = hashlib.sha256(data).hexdigest()
 if got != want: raise SystemExit(f'{name}: SHA-256 {got} does not match {want} (source changed; review it before updating)')
 return data

def jis_text():
 chars = {chr(c) for c in range(0x20, 0x7f)}
 for a in range(0xa1, 0xff):
  for b in range(0xa1, 0xff):
   try: chars.add(bytes([a, b]).decode('euc_jp'))
   except UnicodeDecodeError: pass
 return ''.join(sorted(chars)) + '♡♥❤✿❀・ー〜～'

def write_woff2(data, out):
 font = TTFont(io.BytesIO(data), recalcTimestamp=False)
 opts = subset.Options(); opts.flavor = 'woff2'; opts.hinting = False; opts.layout_features = ['*']
 opts.drop_tables += ['EBDT', 'EBLC', 'EBSC', 'BDF ']  # embedded bitmaps: the canvas draws the outlines
 s = subset.Subsetter(opts); s.populate(text=jis_text()); s.subset(font)
 font.flavor = 'woff2'; font.save(out); print(f'{out.name}: {out.stat().st_size // 1024} KB')

cache = Path(sys.argv[1]); cache.mkdir(parents=True, exist_ok=True)
out = Path(__file__).resolve().parent.parent / 'docs/iphone/app/fonts'; out.mkdir(parents=True, exist_ok=True)
for name in ['ZenMaruGothic-Bold', 'DelaGothicOne-Regular', 'YuseiMagic-Regular', 'Pacifico-Regular']:
 write_woff2(fetch(cache, name + '.ttf'), out / (name + '.woff2'))
 lic = name.split('-')[0] + '-OFL.txt'; (out / lic).write_bytes(fetch(cache, lic))
misaki = zipfile.ZipFile(io.BytesIO(fetch(cache, 'misaki_ttf_2021-05-05.zip')))
write_woff2(misaki.read('misaki_gothic.ttf'), out / 'misaki_gothic.woff2')
text = misaki.read('misaki.txt').decode('utf-8-sig'); start = text.index('ライセンス'); end = text.index('制作履歴')
(out / 'misaki-LICENSE.txt').write_text('美咲フォント (https://littlelimit.net/misaki.htm)\nCopyright(C) 2002-2021 Num Kadoma\n' +text[start:end].rsplit('\n', 2)[0].strip() + '\n', encoding='utf-8')
pm = zipfile.ZipFile(io.BytesIO(fetch(cache, 'PixelMplus-20130602.zip')))
write_woff2(pm.read('PixelMplus-20130602/PixelMplus12-Bold.ttf'), out / 'PixelMplus12-Bold.woff2')
(out / 'PixelMplus-LICENSE.txt').write_bytes(pm.read('PixelMplus-20130602/mplus_bitmap_fonts/LICENSE_E'))
