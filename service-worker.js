const CACHE='content-center-v13-20260923-v2b';
const CORE=['./','./index.html','./app.css?v=20260919-management6','./app.js?v=20260922-authfix1','./owner-code-rotate.js?v=20260922-ownerreset1','./enhancements-v6.css?v=20260919-v6b','./enhancements-v6.js?v=20260919-v6b','./workflow-v7.css?v=20260919-v7b','./workflow-v7.js?v=20260919-v7b','./ideas-v8.css?v=20260919-ideas1','./ideas-v8.js?v=20260919-ideas1','./clients-v9.css?v=20260919-owner1','./clients-v9.js?v=20260919-owner1','./v2/workspace.css?v=20260923-v2b','./v2/workspace-model.js?v=20260923-v2a','./v2/preflight.js?v=20260923-v2b','./v2/workspace.js?v=20260923-v2b','./approval.html','./manifest.webmanifest?v=20260919-pwa6','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==location.origin)return;
 if(e.request.mode==='navigate'){
   e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
   return;
 }
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r})));
});
