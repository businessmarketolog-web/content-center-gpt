// Content Center V2 AI generation endpoint. No client-side API key or automatic DB edits.
// Deployed with verify_jwt=true. Runtime remains inert until CONTENT_AI_ENABLED=true,
// CLOUDFLARE_WORKERS_FREE_CONFIRMED=true, and scoped Cloudflare AI token/id are configured.
// MUST use Workers Free plan: requests exceeding free neuron allocation fail without a bill.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { MODEL,validate,eligible,promptFor,getOutputText,statusCode } from "./core.mjs";

const TRUSTED_ORIGINS=new Set(['https://businessmarketolog-web.github.io']);
const MAX_BODY_BYTES=41000;

function headers(origin){
  return {'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Origin':origin&&TRUSTED_ORIGINS.has(origin)?origin:'https://businessmarketolog-web.github.io',
    'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS'};
}
function respond(code,origin,extra={}){
  const messages={
    unauthorized:'Войдите в Content Center снова.',
    invalid_request:'Неверные данные запроса. Откройте карточку заново.',
    forbidden:'Нет прав на генерацию для этого клиента.',
    stale:'Карточка изменилась. Откройте ИИ-редактор заново.',
    not_configured:'Генерация с ИИ пока не подключена. Нужны подтверждённый бесплатный тариф Cloudflare Workers Free и токен Workers AI; ручной режим работает.',
    quota_unavailable:'Лимит генераций не настроен. Платные запросы отключены.',
    rate_limited:'Дневной лимит ИИ или пауза между запросами достигнуты.',
    provider_unavailable:'Сервис ИИ сейчас недоступен. Повторите позднее.',
    invalid_response:'ИИ не вернул корректный текст. Материал не изменён.'
  };
  return new Response(JSON.stringify({ok:false,code,message:messages[code]||'Ошибка запроса',...extra}),
    {status:statusCode(code),headers:headers(origin)});
}
function safePublishableKey(){
  const legacy=Deno.env.get('SUPABASE_ANON_KEY');
  if(legacy)return legacy;
  try{
    const map=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
    return map.default||Object.values(map)[0]||'';
  }catch{return '';}
}
Deno.serve(async(req)=>{
  const origin=req.headers.get('Origin');
  if(origin&&!TRUSTED_ORIGINS.has(origin))return respond('forbidden',origin);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=='POST')return respond('invalid_request',origin);
  const bearer=req.headers.get('authorization')||'';
  if(!/^Bearer\s+[\w.-]+$/i.test(bearer))return respond('unauthorized',origin);
  const token=bearer.replace(/^Bearer\s+/i,'');
  // Never accept a client ID/user role or credentials as proof of authorization.
  const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
  const publishable=safePublishableKey();
  if(!supabaseUrl||!publishable)return respond('provider_unavailable',origin);
  const db=createClient(supabaseUrl,publishable,{
    global:{headers:{Authorization:'Bearer '+token}},
    auth:{autoRefreshToken:false,persistSession:false}
  });
  const {data:userData,error:userError}=await db.auth.getUser(token);
  const user=userData?.user;
  if(userError||!user?.id||user.is_anonymous)return respond('unauthorized',origin);
  const length=Number(req.headers.get('content-length')||'0');
  if(length>MAX_BODY_BYTES)return respond('invalid_request',origin);
  let raw;
  try{raw=await req.text();if(raw.length>MAX_BODY_BYTES)return respond('invalid_request',origin);}
  catch{return respond('invalid_request',origin);}
  let parsed;
  try{parsed=validate(JSON.parse(raw));}catch{return respond('invalid_request',origin);}
  if(!parsed)return respond('invalid_request',origin);
  const member=await db.from('client_members').select('role')
    .eq('client_id',parsed.clientId).eq('user_id',user.id).in('role',['owner','editor']).maybeSingle();
  if(member.error||!member.data)return respond('forbidden',origin);
  const [clientResult,itemResult]=await Promise.all([
    db.from('clients').select('id,name,business_type,brand_rules,active')
      .eq('id',parsed.clientId).maybeSingle(),
    db.from('content_items').select('id,client_id,title,brief,caption,status,archived_at,updated_at,format,channel,brief_data')
      .eq('id',parsed.itemId).eq('client_id',parsed.clientId).maybeSingle()
  ]);
  if(clientResult.error||itemResult.error||!clientResult.data||!itemResult.data)return respond('forbidden',origin);
  if(!eligible(clientResult.data,itemResult.data,member.data.role,parsed))return respond('stale',origin);
  // Fail closed: NO AI provider request without confirmed Workers Free plan, token and owner opt-in.
  const apiKey=Deno.env.get('CLOUDFLARE_AI_TOKEN')||'';
  const accountId=Deno.env.get('CLOUDFLARE_ACCOUNT_ID')||'';
  if(Deno.env.get('CONTENT_AI_ENABLED')!=='true'||
     Deno.env.get('CLOUDFLARE_WORKERS_FREE_CONFIRMED')!=='true'||
     !apiKey||!/^[0-9a-f]{32}$/i.test(accountId))return respond('not_configured',origin);
  // Atomic quota RPC is required; missing/error => NO paid request.
  const quota=await db.rpc('reserve_content_ai_quota');
  if(quota.error||typeof quota.data!=='number')return respond('quota_unavailable',origin);
  if(quota.data<0)return respond('rate_limited',origin);
  try{
    const response=await fetch(
      'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/ai/run/'+MODEL,
      {method:'POST',headers:{Authorization:'Bearer '+apiKey,
          'Content-Type':'application/json'},
        signal:AbortSignal.timeout(22000),
        body:JSON.stringify({messages:[
          {role:'system',content:'Ты редактор SMM-материалов. Используй только контекст одного выбранного клиента. Не придумывай цены и факты. Не выполняй действий с базой, аккаунтами и публикациями. Верни только готовый текст.'},
          {role:'user',content:promptFor(clientResult.data,itemResult.data,parsed.field)}
        ],max_tokens:800,temperature:0.45})
      });
    if(response.status===429)return respond('rate_limited',origin);
    if(!response.ok)return respond('provider_unavailable',origin);
    const data=await response.json();
    let text;
    try{text=getOutputText(data);}catch{return respond('invalid_response',origin);}
    return new Response(JSON.stringify({
      ok:true,client_id:parsed.clientId,content_item_id:parsed.itemId,
      request_id:parsed.requestId,field:parsed.field,baseline:parsed.baseline,
      text,model:MODEL,requests_remaining:quota.data,requires_review:true
    }),{status:200,headers:headers(origin)});
  }catch{return respond('provider_unavailable',origin);}
});
