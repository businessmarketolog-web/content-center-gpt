'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('new iPhone installation starts V2 and original installed bare-root URL also activates V2',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.equal(manifest.start_url,'./?workspace=v2');
 assert.equal(manifest.scope,'./');
 assert.equal(manifest.display,'standalone');
 const source=read('v2/workspace.js');
 assert.match(source,/\['v1','legacy'\]\.includes\(new URLSearchParams/);
 assert.doesNotMatch(source,/get\('workspace'\)!==['"]v2['"]/);
 const html=read('index.html');
 assert.match(html,/manifest\.webmanifest\?v=20261013-v2default1/);
});
test('all V2 features share explicit legacy opt-out, no accidentally mixed content modes',()=>{
 for(const name of ['v2/workspace.js','v2/brand-dna-ui.js','v2/client-wizard-ui.js','v2/handoff-ui.js','v2/content-dedup-ui.js']){
  const src=read(name);
  assert.match(src,/\['v1','legacy'\]\.includes\(new URLSearchParams/,'legacy guard missing in '+name);
  assert.doesNotMatch(src,/get\('workspace'\)!==['"]v2['"]/,'old opt-in guard left in '+name);
 }
 const owner=read('clients-v9.js');
 assert.match(owner,/!\['v1','legacy'\]\.includes\(new URLSearchParams/);
});
test('new cache includes exact versioned default V2 scripts and manifest, protecting online update',()=>{
 const html=read('index.html'),sw=read('service-worker.js');
 assert.match(sw,/content-center-v23-20261013-ai-ease1/);
 for(const asset of [
 'clients-v9.js?v=20261013-v2default1',
 'v2/workspace.js?v=20261013-v2default1',
 'v2/brand-dna-ui.js?v=20261013-v2default1',
 'v2/client-wizard-ui.js?v=20261013-v2default1',
 'v2/handoff-ui.js?v=20261013-ai-ease1',
 'v2/content-dedup-ui.js?v=20261013-v2default1',
 'manifest.webmanifest?v=20261013-v2default1'
 ]){
  assert.ok(html.includes(asset),'HTML lacks '+asset);
  assert.ok(sw.includes(asset),'PWA CORE cache lacks '+asset);
 }
 assert.doesNotMatch(sw,/localStorage\.clear\(|sessionStorage\.clear\(/);
});
test('default V2 profile shares canonical owner editor and keeps emergency old mode available',()=>{
 const brand=read('v2/brand-dna-ui.js');
 assert.match(brand,/clientSettingsBtnV9/);
 assert.match(brand,/ccv2BrandNavTop/);
 assert.match(brand,/ccv2BrandNavMenu/);
 assert.doesNotMatch(brand,/\.insert\(|\.rpc\(|fetch\(/);
});
