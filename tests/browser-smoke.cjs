/* Network-isolated browser smoke test of the REAL V2 page, without production login or DB writes. */
'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const engine=process.env.BROWSER_ENGINE==='webkit'?'webkit':'chromium';
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
function server(){
 return http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const p=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(p,(err,data)=>{
   if(err){res.writeHead(404);res.end('not found: '+url.pathname);return;}
   res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
 });
}
function mockSupabase(){
 const clientId='11111111-1111-4111-8111-111111111111';
 const itemId='22222222-2222-4222-8222-222222222222';
 const demo={clients:[{id:clientId,name:'Демо Агентство',business_type:'Турагентство',brand_rules:{audience:'Исходный клиент — деловые поездки',primary_font:'Только Первый Бренд'},active:true}],
   content_items:[{id:itemId,client_id:clientId,title:'Обзор Пхукета',format:'Reels',channel:'Instagram',status:'draft',brief:'Обзор пляжей',caption:'Первый текст',media_urls:[],scheduled_at:null,created_at:'2026-10-01T10:00:00Z'}],writes:[],rpcs:[]};
 window.__testStore=demo;
 function chain(table){
  const filters=[];let action='select',payload=null,returnSingle=false;
  const query={
   select(){return query;},eq(k,v){filters.push([k,v]);return query;},in(){return query;},order(){return query;},limit(){return query;},
   maybeSingle(){returnSingle=true;return query;},single(){returnSingle=true;return query;},
   insert(data){action='insert';payload=data;return query;},update(data){action='update';payload=data;return query;},
   upsert(data){action='upsert';payload=data;return query;},delete(){action='delete';return query;},
   then(resolve,reject){
    let result;
    if(action==='select'){
     let data=(demo[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));
     result={data:returnSingle?(data[0]||null):data,error:null};
    }else{
     demo.writes.push({table,action,payload,filters});
     if(action==='insert'&&table==='content_items'){
      const rows=Array.isArray(payload)?payload:[payload];
      const newRows=rows.map((row,i)=>({id:'33333333-3333-4333-8333-33333333333'+i,...row}));
      demo.content_items.push(...newRows);result={data:returnSingle?newRows[0]:newRows,error:null};
     }else result={data:null,error:null};
    }
    return Promise.resolve(result).then(resolve,reject);
   }
  };
  return query;
 }
 function rpc(name,params){
  demo.rpcs.push({name,params});
  if(name==='owner_create_client'){
   const id='44444444-4444-4444-8444-444444444444';
   demo.clients.push({id,name:params.p_name,business_type:params.p_business_type,brand_rules:params.p_brand_rules,active:true});
   return Promise.resolve({data:id,error:null});
  }
  if(name==='owner_update_client'){
   const target=demo.clients.find(c=>c.id===params.p_client_id);
   if(!target)return Promise.resolve({data:null,error:{message:'client not found'}});
   Object.assign(target,{name:params.p_name,business_type:params.p_business_type,brand_rules:params.p_brand_rules});
   return Promise.resolve({data:params.p_client_id,error:null});
  }
  return Promise.resolve({data:null,error:{message:'unexpected rpc: '+name}});
 }
 const session={user:{id:'55555555-5555-4555-8555-555555555555',email:'owner@content-center.local',app_metadata:{role:'content_center_owner'}},access_token:'fake-non-functional-token'};
 const client={auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:chain,rpc,channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){},
  storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'https://invalid.example/fixture.png'}})})}};
 window.supabase={createClient:()=>client};
}
async function main(){
 const app=server();await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+app.address().port+'/?workspace=v2';
 const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}: {})});
 const outcomes=[];
 try{
  for(const kind of ['desktop','mobile']){
   const context=await browser.newContext({viewport:kind==='mobile'?{width:390,height:844}:{width:1300,height:900},serviceWorkers:'block'});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(mockSupabase);
   await page.route('**/*', async(route)=>{
    const requested=route.request().url();
    if(requested.includes('cdn.jsdelivr.net/npm/@supabase/'))return route.fulfill({status:200,contentType:'text/javascript',body:'/* Supabase is injected with in-memory fixtures */'});
    if(requested.startsWith('http://127.0.0.1:'))return route.continue();
    return route.abort('blockedbyclient');
   });
   // Explicit emergency fallback stays legacy. Do not risk current owner's installed PWA data.
   await page.goto(url.replace('?workspace=v2','?workspace=v1'),{waitUntil:'load'});
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.clients?.length>0);
   const legacy=await page.evaluate(()=>({
     enabled:document.documentElement.classList.contains('cc-v2'),
     v2Shell:!!document.querySelector('#dashboard .ccv2-shell'),
     clientWizard:document.querySelector('#clientFormV9')?.dataset.ccv2Wizard==='1',
     unexpectedWrites:window.__testStore.writes.length,
     unexpectedRpcs:window.__testStore.rpcs.length
   }));
   assert.equal(legacy.enabled,false,'Explicit ?workspace=v1 must keep legacy mode');
   assert.equal(legacy.v2Shell,false,'Fallback must not activate the V2 dashboard');
   assert.equal(legacy.clientWizard,false,'Fallback must not replace the legacy client form');
   assert.equal(legacy.unexpectedWrites,0,'No automatic writes during legacy boot');
   assert.equal(legacy.unexpectedRpcs,0,'No automatic RPCs during legacy boot');
   assert.equal(await page.locator('#ccv2BrandNavTop').count(),0,'Legacy fallback must not show V2 Brand DNA');
   assert.equal(await page.locator('#ccv2BrandNavMenu').count(),0,'Legacy fallback menu untouched');
   // Old home-screen icon launches the bare root. It MUST now display V2 + Brand DNA.
   await page.goto(url.replace('/?workspace=v2','/'),{waitUntil:'load'});
   await page.locator('#dashboard .ccv2-shell').waitFor({timeout:15000});
   await page.locator('#ccv2-brand-dna').waitFor();
   assert.equal(await page.locator('#ccv2BrandNavTop').count(),1,'Old icon root must show Brand DNA in top bar');
   assert.equal(await page.locator('#ccv2BrandNavMenu').count(),1,'Old icon root must show Brand DNA in sidebar');
   const rootBoot=await page.evaluate(()=>({
     v2:document.documentElement.classList.contains('cc-v2'),
     writes:window.__testStore.writes.length,
     rpcs:window.__testStore.rpcs.length
   }));
   assert.equal(rootBoot.v2,true,'Bare home-screen root must activate V2');
   assert.equal(rootBoot.writes,0,'Activating V2 must not write materials');
   assert.equal(rootBoot.rpcs,0,'Activating V2 must not call owner RPC');
   // The explicit V2 deep link remains compatible as well.
   await page.goto(url,{waitUntil:'load'});
   await page.locator('#dashboard .ccv2-shell').waitFor({timeout:15000});
   await page.locator('#ccv2-brand-dna').waitFor();
   assert.match(await page.locator('#ccv2-brand-dna').innerText(),/Только Первый Бренд/);
   assert.equal(await page.locator('#ccv2BrandNavTop').count(),1,'One top Brand DNA button required');
   assert.equal(await page.locator('#ccv2BrandNavMenu').count(),1,'One sidebar Brand DNA item required');
   await page.evaluate(()=>show('calendar'));
   await page.locator('#ccv2BrandNavTop').click();
   assert.equal(await page.locator('#dashboard').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'ccv2-brand-dna','Top button must focus actual Brand DNA panel');
   await page.evaluate(()=>show('production'));
   await page.locator('#ccv2BrandNavMenu').evaluate(button=>button.click());
   assert.equal(await page.locator('#dashboard').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'ccv2-brand-dna','Sidebar button must focus panel');
   assert.equal(await page.locator('#ccv2BrandNavTop').count(),1,'No duplicate top button after view switching');
   assert.equal(await page.locator('#ccv2BrandNavMenu').count(),1,'No duplicate sidebar menu entry');
   const context1=await page.evaluate(()=>CCV2BrandDNA.prompt(currentClient(),state.clientId));
   assert.match(context1,/Исходный клиент — деловые поездки/);
   // Exercise the real V2 drawer: a locally edited deadline must survive GPT handoff.
   const handoffButton=page.locator('[data-ccv2-handoff]').first();
   await handoffButton.waitFor();
   const handoffId=await handoffButton.getAttribute('data-ccv2-handoff');
   const handoffClient=await page.locator('#client').inputValue();
   await handoffButton.click();
   assert.equal(await page.locator('#ccv2-handoff-mode').inputValue(),'text','simple text mode should be the default');
   assert.equal(await page.locator('#ccv2-handoff-field').inputValue(),'caption');
   const plainPrompt=await page.locator('#ccv2-handoff textarea[readonly]').inputValue();
   assert.match(plainPrompt,/готовую подпись/);
   assert.match(plainPrompt,/Исходный клиент — деловые поездки/,'current client brand context required');
   await page.locator('#ccv2-handoff textarea:not([readonly])').fill('Безопасно улучшенный текст');
   await page.locator('#ccv2-handoff button',{hasText:'Проверить ответ'}).click();
   assert.equal(await page.locator('#ccv2-handoff button',{hasText:'Перенести в редактор'}).isEnabled(),true);
   assert.match(await page.locator('#ccv2-handoff .ccv2-handoff-diff').innerText(),/Безопасно улучшенный текст/);
   // The original strict JSON multi-field contract stays available on request.
   await page.locator('#ccv2-handoff-mode').selectOption('json');
   assert.equal(await page.locator('#ccv2-handoff button',{hasText:'Перенести в редактор'}).isDisabled(),true);
   const handoffPrompt=await page.locator('#ccv2-handoff textarea[readonly]').inputValue();
   const requestId=handoffPrompt.match(/"request_id":"([0-9a-f-]+)"/i)?.[1];
   assert.ok(requestId,'JSON handoff request ID must be present');
   await page.locator('#ccv2-handoff textarea:not([readonly])').fill(JSON.stringify({
    schema:'content-center-handoff/1',request_id:requestId,client_id:handoffClient,
    content_item_id:handoffId,changes:{caption:'Безопасно улучшенный JSON текст'}
   }));
   await page.locator('#ccv2-handoff button',{hasText:'Проверить ответ'}).click();
   assert.equal(await page.locator('#ccv2-handoff button',{hasText:'Перенести в редактор'}).isEnabled(),true);
   await page.evaluate(id=>{openDrawer(id);document.getElementById('dDue').value='2026-10-19T15:00';},handoffId);
   await page.evaluate(()=>document.querySelector('#ccv2-handoff button.ccv2-create').click());
   assert.match(await page.locator('#ccv2-handoff .ccv2-handoff-message').innerText(),/несохранённые правки/i);
   assert.equal(await page.locator('#dDue').inputValue(),'2026-10-19T15:00');
   await page.evaluate(()=>closeDrawer());
   assert.equal(await page.locator('#authLayer.on').count(),0,kind+' should use fake signed-in session');
   assert.equal(await page.locator('#clientCreateBtnV9').count(),1);
   assert.ok((await page.locator('#dashboard').innerText()).includes('Демо Агентство'));
   await page.locator('#clientCreateBtnV9').click();
   await page.locator('#cm_name').fill('Новый тестовый клиент');
   await page.locator('#cm_business_type').fill('Туризм');
   const next=page.locator('#clientManagerV9 .ccv2-client-progress');
   assert.match(await next.innerText(),/Шаг 1 из 6/);
   for(let step=1;step<=5;step++){
    if(step===3)await page.locator('#cm_interests').fill('Аквапарки и семейные отели QA');
    if(step===4){
      await page.locator('#cm_tone').fill('Экспертный дружелюбный QA');
      await page.locator('#cm_writing_rules').fill('Короткие фразы QA, без канцелярита');
      await page.locator('#cm_content_mix').fill('80% экспертный контент QA');
    }
    if(step===5){
      await page.locator('#cm_primary_font').fill('Museo QA');
      await page.locator('#cm_overlay_rules').fill('Матовая полупрозрачная подложка QA');
    }
    await page.locator('#clientManagerV9 button', {hasText:'Продолжить'}).click();
    assert.match(await next.innerText(),new RegExp('Шаг '+(step+1)+' из 6'));
   }
   assert.equal((await page.evaluate(()=>window.__testStore.rpcs.length)),0,'no client API before final confirmation');
   page.once('dialog',d=>d.dismiss());
   await page.locator('#clientManagerSaveV9').click();
   await page.waitForFunction(()=>window.__testStore.rpcs.some(x=>x.name==='owner_create_client'));
   assert.equal(await page.evaluate(()=>window.__testStore.rpcs.filter(x=>x.name==='owner_create_client').length),1);
   await page.locator('#clientManagerV9.on').waitFor({state:'hidden'});
   const brandRpc=await page.evaluate(()=>window.__testStore.rpcs.find(x=>x.name==='owner_create_client').params.p_brand_rules);
   assert.equal(brandRpc.primary_font,'Museo QA');
   assert.equal(brandRpc.overlay_rules,'Матовая полупрозрачная подложка QA');
   assert.equal(await page.locator('#client option').count(),2,'created one new canonical client');
   assert.equal((await page.evaluate(()=>window.__testStore.writes.length)),0,'onboarding must not insert content on its own');
   await page.waitForFunction(()=>document.querySelector('#ccv2-brand-dna')?.innerText.includes('Museo QA'));
   assert.match(await page.locator('#ccv2-brand-dna').innerText(),/Матовая полупрозрачная подложка QA/);
   // Edit the original canonical client through owner_update_client (no duplicates).
   await page.locator('#clientSettingsBtnV9').click();
   for(let n=0;n<3;n++)await page.locator('#clientManagerV9 button',{hasText:'Продолжить'}).click();
   await page.locator('#cm_writing_rules').fill('Новый утверждённый стиль QA');
   for(let n=0;n<2;n++)await page.locator('#clientManagerV9 button',{hasText:'Продолжить'}).click();
   await page.locator('#clientManagerSaveV9').click();
   await page.locator('#clientManagerV9.on').waitFor({state:'hidden'});
   const updates=await page.evaluate(()=>window.__testStore.rpcs.filter(x=>x.name==='owner_update_client'));
   assert.equal(updates.length,1);
   assert.equal(updates[0].params.p_brand_rules.writing_rules,'Новый утверждённый стиль QA');
   assert.equal(await page.locator('#client option').count(),2,'DNA update must not duplicate client');
   const newClientId=await page.locator('#client').inputValue();
   await page.locator('#client').selectOption('11111111-1111-4111-8111-111111111111');
   await page.waitForFunction(()=>document.querySelector('#ccv2-brand-dna')?.innerText.includes('Только Первый Бренд'));
   assert.doesNotMatch(await page.locator('#ccv2-brand-dna').innerText(),/Museo QA|Матовая полупрозрачная подложка QA/);
   await page.locator('#client').selectOption(newClientId);
   await page.waitForFunction(()=>document.querySelector('#ccv2-brand-dna')?.innerText.includes('Museo QA'));
   // First material lives inside the newly created client; reject an accidental duplicate.
   const createdClientId=await page.locator('#client').inputValue();
   const materialTitle='Тест первого материала '+engine+' '+kind;
   await page.locator('#addBtn').click();
   await page.locator('#fTitle').fill(materialTitle);
   await page.locator('#fFormat').selectOption('Post');
   await page.locator('#fChannel').selectOption('Telegram');
   await page.locator('#fCaption').fill('Демонстрационный текст');
   await page.locator('#saveAdd').click();
   await page.waitForFunction(title=>window.__testStore.content_items.some(x=>x.title===title),materialTitle);
   assert.equal(await page.evaluate(title=>window.__testStore.content_items.filter(x=>x.title===title).length,materialTitle),1);
   assert.equal(await page.evaluate(title=>window.__testStore.content_items.find(x=>x.title===title)?.client_id,materialTitle),createdClientId);
   await page.locator('#addBtn').click();
   await page.locator('#fTitle').fill(materialTitle);
   await page.locator('#fFormat').selectOption('Post');
   await page.locator('#fChannel').selectOption('Telegram');
   page.once('dialog',dialog=>dialog.dismiss());
   await page.locator('#saveAdd').click();
   assert.equal(await page.evaluate(title=>window.__testStore.content_items.filter(x=>x.title===title).length,materialTitle),1,'declining duplicate must not create a second record');
   // Owner may deliberately approve a recurring item; it must stay with the same client.
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('#saveAdd').click();
   await page.waitForFunction(title=>window.__testStore.content_items.filter(x=>x.title===title).length===2,materialTitle);
   assert.equal(await page.evaluate(title=>window.__testStore.content_items.filter(x=>x.title===title).every(x=>x.client_id===state.clientId),materialTitle),true,'intentional duplicate must stay client-scoped');
   await page.locator('#client').selectOption('11111111-1111-4111-8111-111111111111');
   await page.waitForFunction(id=>state.clientId===id,'11111111-1111-4111-8111-111111111111');
   assert.equal(await page.evaluate(title=>state.content.some(x=>x.title===title),materialTitle),false,'foreign client must not see newly created material');
   assert.equal(errors.length,0,kind+' page errors: '+errors.join(' | '));
   outcomes.push(kind+': login stub, V2 workspace, 6-step client form, one owner RPC and no duplicate content OK');
   await context.close();
  }
  console.log(outcomes.join('\n'));
 }finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
