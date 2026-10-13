'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const modelCode=fs.readFileSync(path.join(root,'v2/brand-dna-model.js'),'utf8');
const uiCode=fs.readFileSync(path.join(root,'v2/brand-dna-ui.js'),'utf8');
function model(){const scope={};vm.runInNewContext(modelCode,scope);return scope.CCV2BrandDNA;}
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const clients=[
 {id:A,name:'Семейный отдых',brand_rules:{
   audience:'Семьи с детьми',interests:'Отели с аквапарками',tone:'Дружелюбно',
   primary_font:'Museo Sans Cyrl',accent_font:'Evolventa',visual_style:'Натуральные цвета',
   overlay_rules:'Прозрачные подложки, лёгкое затемнение',
   content_mix:'Кейсы и экспертные сторис',approved_examples:'Короткий живой отзыв',
   owner_code:'PRIVATE_OWNER_CODE_SHOULD_NOT_LEAK',integration_secret:'NEVER_COPY_THIS_SECRET'
 }},
 {id:B,name:'Отраслевые новости',brand_rules:{
   audience:'Турагенты',tone:'Коротко по делу',primary_font:'Evolventa Bold',
   visual_style:'Сдержанная палитра',overlay_rules:'Без декоративных подложек'
 }}
];
test('profile strictly requires a matching valid selected client ID',()=>{
 const m=model();
 assert.equal(m.build(clients[0],B),null);
 assert.equal(m.build(null,A),null);
 assert.equal(m.build({...clients[0],id:'not-a-uuid'},'not-a-uuid'),null);
 assert.equal(m.build(clients[0],A).clientId,A);
});
test('copy prompt includes style and visual instructions only of the selected client',()=>{
 const m=model();const prompt=m.prompt(clients[0],A);
 assert.match(prompt,/Семьи с детьми/);
 assert.match(prompt,/Museo Sans Cyrl/);
 assert.match(prompt,/Отели с аквапарками/);
 assert.match(prompt,/Прозрачные подложки/);
 assert.match(prompt,/Короткий живой отзыв/);
 assert.doesNotMatch(prompt,/Турагенты|Evolventa Bold|PRIVATE_OWNER_CODE_SHOULD_NOT_LEAK|NEVER_COPY_THIS_SECRET/);
 assert.throws(()=>m.prompt(clients[0],B));
 const other=m.prompt(clients[1],B);
 assert.match(other,/Турагенты|Evolventa Bold/);
 assert.doesNotMatch(other,/Museo Sans Cyrl|Прозрачные подложки|Семьи с детьми/);
});
test('empty/invalid brand data are never treated as approved rules',()=>{
 const m=model();
 const d=m.build({id:A,name:'Новый клиент',brand_rules:{interests:['unexpected'],tone:123}},A);
 assert.equal(d.filled,0);assert.equal(d.fields.interests,'');assert.equal(d.fields.tone,'');
 assert.ok(d.missing.length>0);
 assert.doesNotMatch(m.prompt({id:A,name:'Новый клиент'},A),/unexpected/);
});
test('brand rules are bounds-limited and never include arbitrary metadata or API secrets',()=>{
 const m=model();
 const p=m.prompt({...clients[0],brand_rules:{audience:'X'.repeat(20000),unknown:'SHADOW_DATA',secret:'TOP_SECRET'}},A);
 assert.ok(p.length<3500);
 assert.doesNotMatch(p,/SHADOW_DATA|TOP_SECRET/);
});
test('brand dashboard is disabled for old legacy URL',()=>{
 const scope={window:{location:{search:''}},URLSearchParams,document:{querySelector(){throw Error('must not run')}},CCV2BrandDNA:model()};
 assert.doesNotThrow(()=>vm.runInNewContext(uiCode,scope));
});
test('Brand DNA uses only original owner editor and existing client record, with no database writes',()=>{
 assert.match(uiCode,/clientSettingsBtnV9/);
 assert.match(uiCode,/currentClient\(\)/);
 assert.match(uiCode,/state\.clientId===data\.clientId/);
 assert.doesNotMatch(uiCode,/\.insert\(|\.update\(|\.rpc\(|localStorage\.|fetch\(/);
 const clientForm=fs.readFileSync(path.join(root,'clients-v9.js'),'utf8');
 assert.match(clientForm,/const rules=\{\.\.\.original\}/);
 assert.match(clientForm,/owner_update_client/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 for(const file of ['v2/brand-dna-ui.js','v2/brand-dna-model.js','v2/brand-dna.css']){
  assert.ok(html.includes(file));assert.ok(sw.includes(file));
 }
});
