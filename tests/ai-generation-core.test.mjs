import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODEL, BRAND_KEYS, validate, snapshot, eligible, promptFor, getOutputText, statusCode } from '../supabase/functions/generate-content-draft/core.mjs';
const cid='11111111-1111-4111-8111-111111111111';
const iid='22222222-2222-4222-8222-222222222222';
const rid='44444444-4444-4444-8444-444444444444';
const client={id:cid,active:true,name:'Max Way',business_type:'Турагентство',
  brand_rules:{audience:'Семьи с детьми',tone:'Дружелюбный эксперт',primary_font:'Evolventa',
    overlay_rules:'Полупрозрачная подложка',api_key:'NEVER_SEND_SECRET',owner_code:'NEVER_SEND_SECRET'}};
const item={id:iid,client_id:cid,title:'Семейный отпуск',brief:'Отели с бассейном',
  caption:'Первоначальный текст',status:'draft',updated_at:'2026-10-13T13:00:00+00:00',
  archived_at:null,channel:'Instagram',format:'Reels',
  brief_data:{key_points:'Инфраструктура для детей',secret:'NEVER_SEND_SECRET'}};
const input={client_id:cid,content_item_id:iid,request_id:rid,field:'caption',baseline:snapshot(item)};
test('strict bounded request payload accepts only original client/material/nonce/field/baseline',()=>{
 assert.equal(validate(input)?.field,'caption');
 assert.equal(validate({...input,field:'status'}),null);
 assert.equal(validate({...input,client_id:'not-a-uuid'}),null);
 assert.equal(validate({...input,secret:'token'}),null);
 assert.equal(validate({...input,baseline:'x'.repeat(40001)}),null);
 assert.equal(validate([input]),null);
});
test('only owner or editor may generate selected active draft whose snapshot matches',()=>{
 const req=validate(input);
 assert.equal(eligible(client,item,'owner',req),true);
 assert.equal(eligible(client,item,'editor',req),true);
 assert.equal(eligible(client,item,'viewer',req),false);
 assert.equal(eligible({...client,id:'33333333-3333-4333-8333-333333333333'},item,'owner',req),false);
 assert.equal(eligible(client,{...item,client_id:'33333333-3333-4333-8333-333333333333'},'owner',req),false);
 assert.equal(eligible(client,{...item,status:'published'},'owner',req),false);
 assert.equal(eligible(client,{...item,caption:'Конкурент изменил'},'owner',req),false);
 assert.equal(eligible(client,{...item,updated_at:'2026-10-13T13:01:00+00:00'},'owner',req),false);
 assert.equal(eligible(client,{...item,archived_at:'2026-10-13T13:02:00+00:00'},'owner',req),false);
 assert.equal(eligible({...client,active:false},item,'owner',req),false);
});
test('server creates one selected client brand prompt and never includes unknown secret keys',()=>{
 for(const field of ['title','brief','caption']){
  const prompt=promptFor(client,item,field);
  assert.match(prompt,/Max Way|Evolventa|Полупрозрачная подложка/);
  assert.match(prompt,/Отели с бассейном/);
  assert.doesNotMatch(prompt,/NEVER_SEND_SECRET|owner_code|api_key/);
 }
 assert.ok(BRAND_KEYS.includes('primary_font'));
 assert.equal(MODEL,'@cf/google/gemma-4-26b-a4b-it');
});
test('Workers AI returns only valid model response under free allocation',()=>{
 const data={success:true,result:{response:'Готовая подпись\n#отдых'},errors:[]};
 assert.equal(getOutputText(data),'Готовая подпись\n#отдых');
 assert.throws(()=>getOutputText({...data,success:false}));
 assert.throws(()=>getOutputText({success:true,result:{response:''}}));
 assert.throws(()=>getOutputText({success:true,result:{response:'x'.repeat(16001)}}));
 assert.throws(()=>getOutputText({success:true,result:{unsafe:'no text'}}));
});
test('server remains disabled until verified Workers Free account and never writes content directly',()=>{
 const source=readFileSync(new URL('../supabase/functions/generate-content-draft/index.ts',import.meta.url),'utf8');
 assert.match(source,/CONTENT_AI_ENABLED/);
 assert.match(source,/CLOUDFLARE_AI_TOKEN/);
 assert.match(source,/CLOUDFLARE_ACCOUNT_ID/);
 assert.match(source,/CLOUDFLARE_WORKERS_FREE_CONFIRMED/);
 assert.match(source,/api.cloudflare.com\/client\/v4\/accounts/);
 assert.doesNotMatch(source,/api.openai.com|OPENAI_API_KEY|gemini-api|paid_model/i);
 assert.match(source,/Deno\.env\.get\('CONTENT_AI_ENABLED'\)!=='true'/);
 assert.match(source,/Deno\.env\.get\('CLOUDFLARE_WORKERS_FREE_CONFIRMED'\)!=='true'/);
 assert.match(source,/db\.auth\.getUser\(token\)/);
 assert.match(source,/client_members/);
 assert.match(source,/reserve_content_ai_quota/);
 assert.match(source,/max_tokens:800/);
 assert.match(source,/AbortSignal\.timeout\(22000\)/);
 assert.doesNotMatch(source,/\.update\(|\.insert\(|service_role|SERVICE_ROLE_KEY/);
 assert.equal(statusCode('not_configured'),503);
 assert.equal(statusCode('rate_limited'),429);
 assert.equal(statusCode('forbidden'),403);
});
test('quota SQL is atomic, RLS enabled and authenticated-only; no access to rows',()=>{
 const source=readFileSync(new URL('../supabase/migrations/20261013230100_content_ai_quota.sql',import.meta.url),'utf8');
 assert.match(source,/enable row level security/i);
 assert.match(source,/revoke all on table public\.content_ai_quota from public, anon, authenticated/i);
 assert.match(source,/on conflict \(user_id,utc_day\) do update/i);
 assert.match(source,/requests<8/);
 assert.match(source,/30 seconds/);
 assert.match(source,/grant execute on function public\.reserve_content_ai_quota\(\) to authenticated/i);
});
