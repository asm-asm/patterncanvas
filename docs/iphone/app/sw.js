// Retire only this app's offline cache. Never touch saved projects.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await Promise.all((await caches.keys()).filter(k=>k.startsWith('patterncanvas-iphone-')).map(k=>caches.delete(k)));
 await self.clients.claim();
 const tabs=await self.clients.matchAll({type:'window'});
 await Promise.all(tabs.filter(c=>c.url.startsWith(self.registration.scope)).map(c=>c.navigate(self.registration.scope)));
 await self.registration.unregister();
})()));
