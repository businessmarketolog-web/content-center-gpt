const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../v2/preflight.js'),'utf8');
function preflight(){const scope={};vm.runInNewContext(source,scope);return scope.CCV2Preflight;}
const codes=report=>Array.from(report.findings,x=>x.code);
test('preflight gives specific actionable warnings, does not mutate card',()=>{
  const item={title:'',caption:'Цена [указать дату] 250 000 ₽',format:'Reels',channel:'Instagram',status:'scheduled',
    media_urls:['http://example.com/image.png'],scheduled_at:null};
  const before=JSON.stringify(item);
  const report=preflight().evaluate(item);
  assert.deepEqual(codes(report),['missing_title','missing_schedule','invalid_media_url','placeholder','verify_claims','approval_proof']);
  assert.equal(report.automatedFactCheck,false);
  assert.equal(JSON.stringify(item),before);
});
test('visual formats require media; textual post does not',()=>{
  const check=preflight();
  const visual=check.evaluate({title:'Обзор отеля',caption:'Описание',format:'Stories',channel:'Instagram',media_urls:[],status:'draft'});
  const text=check.evaluate({title:'Новости',caption:'Текст',format:'Post',channel:'Telegram',media_urls:[],status:'draft'});
  assert.ok(codes(visual).includes('missing_media'));
  assert.ok(!codes(text).includes('missing_media'));
});
test('approved card warns about approval version; published card warns delivery is unproven',()=>{
  const check=preflight();
  const base={title:'Проверка',caption:'Описание',format:'Post',channel:'Telegram',media_urls:[]};
  assert.ok(codes(check.evaluate({...base,status:'approved'})).includes('approval_proof'));
  assert.ok(codes(check.evaluate({...base,status:'published'})).includes('publishing_proof'));
});
test('empty successful technical check never claims to verify factual accuracy',()=>{
  const report=preflight().evaluate({title:'Обзор',caption:'Привет!',format:'Post',channel:'Telegram',status:'draft',media_urls:[]});
  assert.equal(report.findings.length,0);
  assert.equal(report.automatedFactCheck,false);
});
test('missing or malformed item cannot be marked safe',()=>{
  const result=preflight().evaluate(null);
  assert.equal(result.findings[0].code,'missing_item');
  assert.equal(result.automatedFactCheck,false);
});
