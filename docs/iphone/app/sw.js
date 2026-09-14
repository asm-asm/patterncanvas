// Assets are cached for performance, never as proof of purchase. Every startup
// passes through bootstrap and verifies a recent license verification.
const CACHE='patterncanvas-iphone-v2-native-adapter-4';
const FILES=['./','./index.html','./app.css','./app.mjs','./platform.mjs','./bootstrap.mjs','./model.mjs','./draw.mjs','./manifest.webmanifest','./icon-192.png','./icon-512.png','../access/config.mjs','../access/product.mjs','../access/storage.mjs','../access/gate.mjs','../access/gate.css'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('patterncanvas-iphone-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!FILES.some(file=>new URL(file,self.location).pathname===url.pathname))return;event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));});
