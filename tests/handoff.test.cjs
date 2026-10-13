const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../v2/handoff-contract.js'),'utf8');
function create(){const scope={};vm.runInNewContext(src,scope);return scope.CCV2Handoff;}
const CLIENT='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const REQUEST='44444444-4444-4444-8444-444444444444';
const client={id:CLIENT,name:'Max Way'};
const card={id:ITEM,client_id:CLIENT,status:'draft',updated_at:'2026-09-23T00:00:00Z',title:'Исходное название',brief:'Первый бриф',caption:'Исходный текст'};
function start(item=card){const h=create();const request=h.buildRequest({client,item,requestId:REQUEST});return {h,request};}
function makeReply(request,changes={caption:'Новый текст'},extra={}){return JSON.stringify({...request.ticket,changes,...extra});}
function parse({h,request,item=card,input=makeReply(request)}){return h.parseReply(input,{ticket:request.ticket,baseline:request.baseline,clientId:CLIENT,item});}
test('handoff prompt is scoped to one existing material, without secrets or additional records',()=>{
 const {request}=start();assert.match(request.prompt,/Не создавай нового клиента или материала/);
 assert.match(request.prompt,/Max Way/);assert.match(request.prompt,/Исходное название/);
 assert.match(request.prompt,new RegExp(ITEM));assert.doesNotMatch(request.prompt,/service_role|owner_code|auth_token/);
 assert.equal(request.ticket.client_id,CLIENT);assert.equal(request.ticket.content_item_id,ITEM);
});
test('accept only changed, bounded draft text for same client, request and material',()=>{
 const {h,request}=start();const result=parse({h,request,input:makeReply(request,{title:'  Новая тема  ',caption:'Новый текст'})});
 assert.equal(result.contentId,ITEM);assert.equal(result.clientId,CLIENT);assert.equal(result.changes.title,'Новая тема');
 assert.equal(result.changes.caption,'Новый текст');assert.equal(Object.keys(result.changes).length,2);
 assert.equal(card.title,'Исходное название');assert.equal(card.caption,'Исходный текст');
});
test('reject another client, material, schema or request nonce',()=>{
 const {h,request}=start();for(const field of ['client_id','content_item_id','request_id','schema']){
  const invalid=makeReply(request,{caption:'Правка'},{[field]:field==='schema'?'unsafe':OTHER});
  assert.throws(()=>parse({h,request,input:invalid}),/другой|не совпадает/);
 }
});
test('reject status, media, unexpected nested fields, empty changes and invalid JSON',()=>{
 const {h,request}=start();const invalid=[
  makeReply(request,{caption:'Текст',status:'published'}),
  makeReply(request,{media_urls:['https://example.com/abc.jpg']}),
  makeReply(request,{}),
  makeReply(request,{title:''}),
  makeReply(request,{caption:4}),
  makeReply(request,{caption:'Новый текст'},{access_token:'danger'}),
  '{unclosed'
 ];
 for(const input of invalid)assert.throws(()=>parse({h,request,input}));
});
test('stale, missing, archived, review, published and switched client are all rejected',()=>{
 const {h,request}=start();for(const changed of [
  {...card,caption:'Обновлено другим пользователем'},
  {...card,updated_at:'2026-09-23T00:01:00Z'},
  {...card,status:'review'},
  {...card,status:'published'},
  {...card,archived_at:'2026-09-23T00:01:00Z'},
  {...card,client_id:OTHER},
  null
 ])assert.throws(()=>parse({h,request,item:changed}));
 assert.throws(()=>h.buildRequest({client,item:{...card,status:'approved'},requestId:REQUEST}));
 assert.throws(()=>h.buildRequest({client,item:{...card,client_id:OTHER},requestId:REQUEST}));
});
test('Markdown fenced JSON is handled, but unknown fields never enter the editor',()=>{
 const {h,request}=start();const raw='```json\n'+makeReply(request,{brief:'Исправленный бриф'})+'\n```';
 const value=parse({h,request,input:raw});assert.equal(value.changes.brief,'Исправленный бриф');
 assert.throws(()=>parse({h,request,input:makeReply(request,{__proto__:null,caption:'Новый текст'},{client:'Новый клиент'})}));
});
test('no-op responses and oversize payloads fail safely',()=>{
 const {h,request}=start();assert.throws(()=>parse({h,request,input:makeReply(request,{title:'Исходное название'})}));
 assert.throws(()=>parse({h,request,input:makeReply(request,{caption:'x'.repeat(16001)})}));
 assert.throws(()=>parse({h,request,input:'x'.repeat(28001)}));
});
test('new prompt for same card invalidates older request, preventing accidental reuse',()=>{
 const {h,request}=start();const next=h.buildRequest({client,item:card,requestId:OTHER});
 assert.throws(()=>h.parseReply(makeReply(request),{ticket:next.ticket,baseline:next.baseline,clientId:CLIENT,item:card}),/другой/);
});

test('ChatGPT prompt includes only selected client brand profile and task brief, never unknown secrets',()=>{
 const richClient={...client,business_type:'Турагентство',brand_rules:{
  audience:'Семьи с детьми',goals:'Запросы на подбор тура',tone:'Тёплый и экспертный',
  primary_font:'Evolventa',accent_font:'Liana',interests:'Выбирать пляжные отели',
  writing_rules:'Короткие экспертные абзацы',overlay_rules:'Полупрозрачная тёмная подложка',
  content_pillars:'Обзоры отелей',visual_style:'Без неона',api_secret:'LEAK_ME_NEVER',owner_code:'LEAK_ME_NEVER'
 }};
 const richItem={...card,brief_data:{goal:'Поддержать продажи',key_points:'Пляж и инфраструктура',cta:'Написать менеджеру',token:'LEAK_ME_NEVER'}};
 const handoff=create().buildRequest({client:richClient,item:richItem,requestId:REQUEST});
 assert.match(handoff.prompt,/Семьи с детьми/);
 assert.match(handoff.prompt,/Тёплый и экспертный/);
 assert.match(handoff.prompt,/Evolventa/);
 assert.match(handoff.prompt,/Полупрозрачная тёмная подложка|Обзоры отелей|Без неона/);
 assert.match(handoff.prompt,/Пляж и инфраструктура/);
 assert.match(handoff.prompt,/Написать менеджеру/);
 assert.doesNotMatch(handoff.prompt,/LEAK_ME_NEVER|owner_code|api_secret/);
 assert.equal(handoff.ticket.client_id,CLIENT);
});
test('brand context is length bounded and ignores arrays or unrelated metadata',()=>{
 const rich={...client,brand_rules:{audience:'Т'.repeat(20000),extra:'UNAPPROVED_EXTRA'},business_type:'Турагентство'};
 const out=create().buildRequest({client:rich,item:card,requestId:REQUEST});
 assert.ok(out.prompt.length<7000,'prompt must remain bounded');
 assert.doesNotMatch(out.prompt,/UNAPPROVED_EXTRA/);
 assert.match(out.prompt,/Турагентство/);
});

test('plain text prompt contains selected client Brand DNA and no API credentials',()=>{
 const rich={...client,brand_rules:{audience:'Семьи с детьми',tone:'Тёплый',
  primary_font:'Evolventa',overlay_rules:'Полупрозрачная подложка',
  owner_code:'DO_NOT_SEND_THIS',api_key:'DO_NOT_SEND_THIS'}};
 const {textPrompts}=create().buildRequest({client:rich,item:card,requestId:REQUEST});
 for(const key of ['caption','brief','title']){
  assert.match(textPrompts[key],/Семьи с детьми/);
  assert.match(textPrompts[key],/Полупрозрачная подложка/);
  assert.doesNotMatch(textPrompts[key],/DO_NOT_SEND_THIS|owner_code|api_key/);
 }
 assert.match(textPrompts.caption,/готовую подпись/);
 assert.match(textPrompts.brief,/краткий бриф/);
 assert.match(textPrompts.title,/один готовый заголовок/);
});
test('ordinary ChatGPT text maps to only one specified same-client field',()=>{
 const {h,request}=start();
 for(const field of ['caption','brief','title']){
  const result=h.parseTextReply('  Нормальный текст для публикации  ',{ticket:request.ticket,baseline:request.baseline,clientId:CLIENT,item:card,field});
  assert.equal(result.changes[field],'Нормальный текст для публикации');
  assert.equal(Object.keys(result.changes).length,1);
  assert.equal(card[field],field==='caption'?'Исходный текст':field==='brief'?'Первый бриф':'Исходное название');
 }
});
test('ordinary text reuses stale draft/status/client ID/nonce safety gates, without new writes',()=>{
 const {h,request}=start();
 const options={ticket:request.ticket,baseline:request.baseline,clientId:CLIENT,item:card,field:'caption'};
 assert.throws(()=>h.parseTextReply('',options));
 assert.throws(()=>h.parseTextReply('   ',options));
 assert.throws(()=>h.parseTextReply('x'.repeat(16001),options));
 assert.throws(()=>h.parseTextReply('Неправильное поле',{...options,field:'status'}));
 assert.throws(()=>h.parseTextReply('Подмена',{...options,clientId:OTHER}));
 assert.throws(()=>h.parseTextReply('Устарел',{...options,item:{...card,caption:'Сохранено позднее'}}));
 assert.throws(()=>h.parseTextReply('В архиве',{...options,item:{...card,archived_at:'2026-10-01'}}));
 assert.throws(()=>h.parseTextReply('Завершено',{...options,item:{...card,status:'approved'}}));
 assert.equal(card.caption,'Исходный текст');
});
