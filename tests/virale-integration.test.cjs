const {test}=require('node:test');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const ui=fs.readFileSync('v2/virale-ui.js','utf8');
test('Virale Studio loads after Brand DNA and is cached for iPhone PWA',()=>{
 assert.ok(html.indexOf('v2/brand-dna-ui.js')<html.indexOf('v2/virale-core.js'));
 assert.ok(html.indexOf('v2/virale-core.js')<html.indexOf('v2/virale-ui.js'));
 for(const path of ['v2/virale-core.js','v2/virale-ui.js','v2/virale.css']){
  assert.ok(html.includes(path),path);
  assert.ok(sw.includes(path),path);
 }
 assert.ok(sw.includes('content-center-v25-20261016-virale1'));
});
test('Virale uses existing Ideas and manual draft, never direct paid APIs',()=>{
 assert.ok(!ui.includes('api.apify.com'));
 assert.ok(!ui.includes('api.openai.com'));
 assert.ok(!ui.includes('service_role'));
 assert.ok(ui.includes('state.clientId!==model.clientId'));
 assert.ok(ui.includes("sb.from('assets').insert"));
 assert.ok(ui.includes('openAdd()'));
 assert.ok(ui.includes('Проверьте поля и нажмите'));
});
