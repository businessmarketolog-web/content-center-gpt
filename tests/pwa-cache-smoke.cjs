'use strict';
/* Real Chromium service worker install/update against a strictly local server.
 * No owner code, live Supabase or real credentials. This checks that cache
 * updates do not delete independent browser storage and that required assets load.
 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const current='content-center-v24-20261013-free-ai1';
const next='content-center-v25-pwa-synthetic-qa';
assert.ok(source.includes(current),'Unexpected service worker version; update PWA smoke fixture');
let sw=source;
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const app=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__pwa_qa.html'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  return res.end('<!doctype html><title>PWA local test</title><h1 id="ready">Test</h1>');
 }
 if(url.pathname==='/service-worker.js'){
  res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store','Service-Worker-Allowed':'/'});
  return res.end(sw);
 }
 const f=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end('forbidden')}
 fs.readFile(f,(err,data)=>{
  if(err){res.writeHead(404);return res.end('missing')}
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
});
(async()=>{
 await new Promise(done=>app.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({serviceWorkers:'allow'});
  const page=await ctx.newPage();
  const origin='http://127.0.0.1:'+app.address().port;
  await page.goto(origin+'/__pwa_qa.html');
  const status=await page.evaluate(async()=>{
   localStorage.setItem('qa-session-preservation','owner-session-placeholder-not-credentials');
   sessionStorage.setItem('qa-unsaved-draft','safe-draft-not-actual-user-data');
   // Another application on this origin and a non-versioned personal cache must never be deleted.
   await caches.open('some-other-app-assets');
   await caches.open('content-center-user-drafts');
   const reg=await navigator.serviceWorker.register('/service-worker.js',{updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   return {scope:reg.scope,keys:await caches.keys()};
  });
  assert.equal(status.scope,origin+'/');
  assert.ok(status.keys.includes(current),'PWA assets were not cached on initial service worker install');
  assert.ok(status.keys.includes('some-other-app-assets'),'Must preserve unrelated app cache after SW install');
  assert.ok(status.keys.includes('content-center-user-drafts'),'Must preserve non-versioned user cache after SW install');
  const urls=await page.evaluate(async()=>{
   const c=await caches.open('content-center-v24-20261013-free-ai1');
   const all=await c.keys();return all.map(k=>new URL(k.url).pathname);
  });
  for(const required of ['/index.html','/v2/workspace.js','/v2/content-dedup-ui.js','/clients-v9.js','/v2/brand-dna-ui.js','/v2/brand-dna-model.js']){
   assert.ok(urls.includes(required),'Missing offline PWA asset '+required);
  }
  // New code pushed to server: automatic activation should remove old
  // cache but leave browser-managed session/draft storage untouched.
  sw=source.replaceAll(current,next);
  await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration('/');
   await registration.update();
  });
  await page.waitForFunction(async()=>{
   const names=await caches.keys();
   return names.includes('content-center-v25-pwa-synthetic-qa')&&!names.includes('content-center-v24-20261013-free-ai1');
  },null,{timeout:30000});
  await page.reload();
  const check=await page.evaluate(()=>({
   session:localStorage.getItem('qa-session-preservation'),
   draft:sessionStorage.getItem('qa-unsaved-draft')
  }));
  assert.equal(check.session,'owner-session-placeholder-not-credentials');
  assert.equal(check.draft,'safe-draft-not-actual-user-data');
  const retained=await page.evaluate(async()=>caches.keys());
  assert.ok(retained.includes('some-other-app-assets'),'Unrelated origin cache must survive CC PWA update');
  assert.ok(retained.includes('content-center-user-drafts'),'Non-versioned user cache must survive CC PWA update');
  console.log('PASS: real Chromium SW install, required V2 files cached, update removes old cache but preserves local/session storage');
  await ctx.close();
 }finally{
  await browser.close();
  await new Promise(resolve=>app.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
