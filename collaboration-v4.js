
/* COLLABORATION PACKAGE V4 */
state.approvalLinks=state.approvalLinks||[];
state.notificationSettings=state.notificationSettings||null;
state.notificationOutbox=state.notificationOutbox||[];
state.bulkSelected=state.bulkSelected||new Set();

const V4_BRIEF_FIELDS=[
  ['goal','Цель контента','Например: повысить доверие / получить сохранения'],
  ['audience','Целевая аудитория','Кому адресован материал'],
  ['offer','Оффер / главный посыл','Что именно предлагаем или хотим донести'],
  ['key_points','Обязательные тезисы','Что обязательно должно прозвучать'],
  ['references','Референсы','Ссылки, примеры, ориентиры'],
  ['cta','CTA','Какое действие ожидаем'],
  ['shoot_deadline','Дедлайн съёмки','Дата / комментарий'],
  ['producer','Кто снимает / готовит','Ответственный за производство'],
  ['editor','Кто монтирует / оформляет','Ответственный за финальную сборку']
];

function v4DefaultChecklist(x){
  if(x.channel==='Telegram'){
    return [
      {id:'caption',label:'Финальный текст готов',done:false,required:true},
      {id:'proof',label:'Проверены факты и опечатки',done:false,required:true},
      {id:'links',label:'Проверены ссылки и CTA',done:false,required:true},
      {id:'approval',label:'Согласование получено',done:false,required:true}
    ];
  }
  const base=[
    {id:'brief',label:'Бриф заполнен',done:false,required:true},
    {id:'script',label:'Сценарий / структура готовы',done:false,required:true},
    {id:'media',label:'Съёмка / исходники готовы',done:false,required:true},
    {id:'edit',label:'Монтаж / дизайн готовы',done:false,required:true},
    {id:'caption',label:'Текст публикации готов',done:false,required:true},
    {id:'approval',label:'Согласование получено',done:false,required:true}
  ];
  if(String(x.format||'').toLowerCase().includes('reel'))base.splice(4,0,{id:'subtitles',label:'Субтитры проверены',done:false,required:true});
  if(!String(x.format||'').toLowerCase().includes('stories'))base.splice(base.length-1,0,{id:'cover',label:'Обложка готова',done:false,required:false});
  return base;
}
function v4ChecklistFor(x){
  let list=Array.isArray(x?.checklist)&&x.checklist.length?x.checklist:v4DefaultChecklist(x||{});
  list=list.map(i=>({...i}));
  const briefOk=Boolean(x?.brief_data&&Object.values(x.brief_data).some(v=>String(v||'').trim()));
  return list.map(i=>{
    if(i.id==='brief'&&briefOk)return {...i,done:true};
    if(i.id==='media'&&mediaCount(x)>0)return {...i,done:true};
    if(i.id==='caption'&&String(x?.caption||x?.brief||'').trim())return {...i,done:true};
    if(i.id==='approval'&&x?.client_approval_status==='approved')return {...i,done:true};
    return i;
  });
}
function v4ChecklistStats(x){
  const c=v4ChecklistFor(x),done=c.filter(i=>i.done).length;
  return {done,total:c.length,requiredOpen:c.filter(i=>i.required!==false&&!i.done)};
}
function v4ApprovalLabel(v){return {not_sent:'Не отправлено',sent:'Отправлено клиенту',viewed:'Клиент открыл',approved:'Клиент одобрил',changes:'Нужны правки'}[v]||v||'Не отправлено'}
function v4ApprovalClass(v){return v==='approved'?'ok':v==='changes'?'bad':v==='viewed'?'info':''}

const __v4ReadinessBase=readinessIssues;
readinessIssues=function(x){
  const out=__v4ReadinessBase(x);
  const open=v4ChecklistFor(x).filter(i=>i.required!==false&&!i.done);
  if(open.length)out.push('Чек-лист производства не завершён: '+open.length);
  return [...new Set(out)];
};

function v4BriefDataFromDrawer(){
  const out={};
  V4_BRIEF_FIELDS.forEach(([k])=>{const el=$('bd_'+k);if(el&&el.value.trim())out[k]=el.value.trim()});
  return out;
}
function v4BriefHtml(x){
  const b=x.brief_data||{};
  return '<details class="brief-section" open><summary><span><b>Контент-бриф</b><small>Цель, аудитория, тезисы и производство</small></span><span>＋</span></summary><div class="brief-grid">'+
    V4_BRIEF_FIELDS.map(([k,l,p])=>'<label>'+l+(['key_points','references'].includes(k)?'<textarea class="textarea compact" id="bd_'+k+'" placeholder="'+esc(p)+'">'+esc(b[k]||'')+'</textarea>':'<input class="input" id="bd_'+k+'" placeholder="'+esc(p)+'" value="'+esc(b[k]||'')+'">')+'</label>').join('')+
    '</div></details>';
}
function v4ChecklistHtml(x){
  const list=v4ChecklistFor(x),s=v4ChecklistStats(x);
  return '<section class="checklist-section"><div class="collab-head"><div><div class="ey">PRODUCTION CHECKLIST</div><h3>Чек-лист производства</h3></div><span class="badge">'+s.done+'/'+s.total+'</span></div>'+
    '<div class="checklist-progress"><i style="width:'+(s.total?Math.round(s.done/s.total*100):0)+'%"></i></div>'+
    '<div class="checklist-list">'+list.map((i,n)=>'<label class="check-item '+(i.done?'done':'')+'"><input type="checkbox" '+(i.done?'checked':'')+' onchange="v4ToggleChecklist(\''+x.id+'\','+n+',this.checked)"><span>'+esc(i.label)+(i.required===false?' <small>необязательно</small>':'')+'</span></label>').join('')+'</div>'+
    '<div class="checklist-add"><input class="input" id="newCheckItem" placeholder="Добавить свой пункт"><button class="ghost" onclick="v4AddChecklistItem(\''+x.id+'\')">＋ Добавить</button></div></section>';
}
async function v4ToggleChecklist(id,index,done){
  const x=state.content.find(v=>v.id===id);if(!x)return;
  let list=v4ChecklistFor(x).map((i,n)=>n===index?{...i,done}:i);
  const requiredOpen=list.filter(i=>i.required!==false&&!i.done);
  let nextStatus=x.status;
  if(!requiredOpen.length&&['draft','production'].includes(x.status))nextStatus='review';
  if(requiredOpen.length&&['review','approved'].includes(x.status))nextStatus='production';
  const r=await sb.from('content_items').update({checklist:list,status:nextStatus}).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  toast(!requiredOpen.length&&nextStatus==='review'?'Чек-лист завершён · материал передан на согласование':'Чек-лист обновлён');
  await loadClientData();openDrawer(id);
}
async function v4AddChecklistItem(id){
  const el=$('newCheckItem'),label=el?.value.trim();if(!label)return;
  const x=state.content.find(v=>v.id===id);if(!x)return;
  const list=v4ChecklistFor(x).concat({id:'custom_'+Date.now(),label,done:false,required:false});
  const r=await sb.from('content_items').update({checklist:list}).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  await loadClientData();openDrawer(id);
}

function v4ApprovalLinksFor(id){return state.approvalLinks.filter(x=>x.content_item_id===id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function v4ApprovalHtml(x){
  const latest=v4ApprovalLinksFor(x.id)[0],st=x.client_approval_status||'not_sent';
  const extra=latest?'<small>Последняя ссылка: '+fmtDate(latest.created_at)+(latest.last_opened_at?' · открыта '+fmtDate(latest.last_opened_at):'')+'</small>':'<small>Ссылка ещё не создавалась</small>';
  return '<section class="approval-block"><div class="collab-head"><div><div class="ey">CLIENT APPROVAL</div><h3>Согласование с клиентом</h3></div><span class="approval-status '+v4ApprovalClass(st)+'">'+esc(v4ApprovalLabel(st))+'</span></div>'+
    (x.client_feedback?'<div class="client-feedback"><b>Комментарий клиента</b><p>'+esc(x.client_feedback)+'</p></div>':'')+
    '<div class="approval-actions"><button class="primary" onclick="v4CreateApprovalLink(\''+x.id+'\')">🔗 Создать ссылку</button></div><p class="approval-note">Ссылка открывает только этот материал. Клиент может одобрить его или отправить правки без входа в Content Center.</p>'+extra+'</section>';
}
async function v4CreateApprovalLink(id){
  const s=(await sb.auth.getSession()).data.session;if(!s)return toast('Нужно войти заново',true);
  toast('Создаю ссылку…');
  const r=await fetch(SUPABASE_URL+'/functions/v1/create-approval-link',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+s.access_token},body:JSON.stringify({content_item_id:id})});
  const b=await r.json();if(!r.ok)return toast(b.error||'Не удалось создать ссылку',true);
  try{await navigator.clipboard.writeText(b.url);toast('Ссылка для клиента скопирована')}catch{
    openP2Modal('Ссылка для клиента','CLIENT APPROVAL','<div class="feature-form"><input class="input" value="'+esc(b.url)+'" readonly><p>Скопируйте ссылку и отправьте клиенту.</p></div>');
  }
  await loadClientData();openDrawer(id);
}

function v4AugmentDrawer(id){
  const x=state.content.find(v=>v.id===id);if(!x)return;
  const form=$('drawerBody')?.querySelector('.form'),draft=$('drawerDraftState');
  if(form&&!$('briefV4'))form.insertAdjacentHTML('afterend','<div id="briefV4">'+v4BriefHtml(x)+'</div>');
  if(draft&&!$('checklistV4'))draft.insertAdjacentHTML('afterend','<div id="checklistV4">'+v4ChecklistHtml(x)+v4ApprovalHtml(x)+'</div>');
}
const __v4OpenDrawerBase=openDrawer;
openDrawer=function(id){__v4OpenDrawerBase(id);v4AugmentDrawer(id)};

async function saveDrawer(){
  const id=state.selectedId;if(!id)return;
  const media=$('dMedia').value.split('\n').map(x=>x.trim()).filter(Boolean),x=state.content.find(v=>v.id===id);
  const payload={title:$('dTitle').value.trim(),brief:$('dBrief').value.trim(),caption:$('dCaption').value.trim(),status:$('dStatus').value,
    format:$('dFormat').value,channel:$('dChannel').value,scheduled_at:$('dDate').value?new Date($('dDate').value).toISOString():null,
    assignee:$('dAssignee').value.trim()||null,due_at:$('dDue').value?new Date($('dDue').value).toISOString():null,
    media_urls:media,tags:tagsArray($('dTags')?.value),brief_data:v4BriefDataFromDrawer(),checklist:x?.checklist||null};
  if(!payload.title)return toast('Заголовок не может быть пустым',true);
  if(['approved','scheduled'].includes(payload.status)){
    const issues=readinessIssues({...x,...payload});
    if(issues.length){openP2Modal('Материал не готов','READINESS CHECK','<div class="readiness-card"><p>Перед переводом в готовый статус закройте обязательные пункты:</p><div class="readiness-list">'+issues.map(i=>'<div>• '+esc(i)+'</div>').join('')+'</div></div>');return}
  }
  const r=await sb.from('content_items').update(payload).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  clearItemDraft(id);toast('Материал сохранён');await loadClientData();openDrawer(id);
}

function v4BulkItems(){return state.content.filter(x=>!x.archived_at)}
function v4OpenBulk(){
  state.bulkSelected=new Set();
  openP2Modal('Массовые действия','BULK ACTIONS',
    '<div class="bulk-toolbar"><button class="ghost" onclick="v4BulkSelectAll()">Выбрать все</button><span id="bulkCount">0 выбрано</span></div>'+
    '<div class="bulk-list">'+v4BulkItems().map(x=>'<label class="bulk-row"><input type="checkbox" onchange="v4ToggleBulk(\''+x.id+'\',this.checked)"><div><b>'+esc(x.title)+'</b><small>'+esc(x.format)+' · '+esc(x.channel)+' · '+esc(STATUS[x.status]||x.status)+'</small></div></label>').join('')+'</div>'+
    '<div class="bulk-controls"><label>Статус<select class="input" id="bulkStatus"><option value="">Не менять</option>'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label>'+
    '<label>Канал<select class="input" id="bulkChannel"><option value="">Не менять</option><option>Instagram</option><option>Telegram</option></select></label>'+
    '<label>Дата и время публикации<input class="input" id="bulkDate" type="datetime-local"></label>'+
    '<label>Ответственный<input class="input" id="bulkAssignee" placeholder="Оставьте пустым, чтобы не менять"></label>'+
    '<label>Добавить тег<input class="input" id="bulkTag" placeholder="Например: акция"></label>'+
    '<label class="bulk-archive"><input type="checkbox" id="bulkArchive"> Переместить выбранные в архив</label>'+
    '<button class="primary" onclick="v4ApplyBulk()">Применить</button></div>');
}
function v4ToggleBulk(id,on){on?state.bulkSelected.add(id):state.bulkSelected.delete(id);if($('bulkCount'))$('bulkCount').textContent=state.bulkSelected.size+' выбрано'}
function v4BulkSelectAll(){state.bulkSelected=new Set(v4BulkItems().map(x=>x.id));document.querySelectorAll('.bulk-row input').forEach(x=>x.checked=true);if($('bulkCount'))$('bulkCount').textContent=state.bulkSelected.size+' выбрано'}
async function v4ApplyBulk(){
  const ids=[...state.bulkSelected];if(!ids.length)return toast('Выберите материалы',true);
  const status=$('bulkStatus')?.value||'',channel=$('bulkChannel')?.value||'',date=$('bulkDate')?.value||'',assignee=$('bulkAssignee')?.value.trim(),tag=$('bulkTag')?.value.trim(),archive=$('bulkArchive')?.checked;
  if(status&&['approved','scheduled'].includes(status)){
    const bad=ids.map(id=>state.content.find(x=>x.id===id)).filter(Boolean).filter(x=>readinessIssues({...x,status}).length);
    if(bad.length)return openP2Modal('Не все материалы готовы','READINESS CHECK','<div class="readiness-list">'+bad.map(x=>'<div>• '+esc(x.title)+' — '+esc(readinessIssues({...x,status}).join(', '))+'</div>').join('')+'</div>');
  }
  const simple={};if(status)simple.status=status;if(channel)simple.channel=channel;if(date)simple.scheduled_at=new Date(date).toISOString();if(assignee)simple.assignee=assignee;if(archive){simple.archived_at=new Date().toISOString();simple.archived_by=state.session?.user?.id||null}
  if(Object.keys(simple).length){const r=await sb.from('content_items').update(simple).in('id',ids);if(r.error)return toast(r.error.message,true)}
  if(tag){for(const id of ids){const x=state.content.find(v=>v.id===id);if(!x)continue;const tags=[...new Set([...(x.tags||[]),tag])];const r=await sb.from('content_items').update({tags}).eq('id',id);if(r.error)return toast(r.error.message,true)}}
  closeP2Modal();toast('Массовое действие выполнено');await loadClientData();
}

function v4TelegramIntegration(){return state.integrations.find(x=>x.channel==='Telegram')}
function v4TelegramEvents(){return [['review','Материал ждёт согласования'],['deadline_today','Дедлайн сегодня'],['publish_failed','Ошибка публикации'],['client_comment','Комментарий / правки клиента'],['client_decision','Клиент одобрил материал']]}
function v4OpenTelegram(){
  const s=state.notificationSettings||{},i=v4TelegramIntegration(),events=Array.isArray(s.events)?s.events:['review','deadline_today','publish_failed','client_comment','client_decision'];
  const pending=state.notificationOutbox.filter(x=>['pending','failed'].includes(x.status)).length;
  openP2Modal('Telegram-уведомления','NOTIFICATIONS',
    '<div class="telegram-settings"><div class="integration-state '+(i?.enabled?'ok':'bad')+'"><b>'+(i?.enabled?'Telegram подключён':'Telegram не подключён для этого клиента')+'</b><small>'+(i?.connected_account_id?esc(i.connected_account_id):'Сначала подключите Telegram во вкладке «Интеграции»')+'</small></div>'+
    '<label class="switch-row"><input type="checkbox" id="tgNotifyEnabled" '+(s.telegram_enabled?'checked':'')+'><span>Включить рабочие уведомления</span></label>'+
    '<label>Chat ID<input class="input" id="tgNotifyChat" value="'+esc(s.telegram_chat_id||i?.external_target||i?.metadata?.chat_id||'')+'" placeholder="Например: -1001234567890"></label>'+
    '<div class="event-settings">'+v4TelegramEvents().map(([k,l])=>'<label><input type="checkbox" class="tg-event" value="'+k+'" '+(events.includes(k)?'checked':'')+'> '+l+'</label>').join('')+'</div>'+
    '<div class="telegram-actions"><button class="primary" onclick="v4SaveTelegram()">Сохранить</button><button class="ghost" onclick="v4TestTelegram()">Отправить тест</button><button class="ghost" onclick="v4DispatchTelegram(true)">Отправить накопившиеся ('+pending+')</button></div>'+
    '<div class="sub">События сохраняются в очереди даже если Telegram временно недоступен.</div></div>');
}
async function v4SaveTelegram(){
  const events=[...document.querySelectorAll('.tg-event:checked')].map(x=>x.value);
  const row={client_id:state.clientId,telegram_enabled:Boolean($('tgNotifyEnabled')?.checked),telegram_chat_id:$('tgNotifyChat')?.value.trim()||null,events,updated_by:state.session?.user?.id||null};
  const r=await sb.from('notification_settings').upsert(row,{onConflict:'client_id'});
  if(r.error)return toast(r.error.message,true);
  toast('Настройки уведомлений сохранены');await loadClientData();v4OpenTelegram();
}
async function v4NotifyEdge(action){
  const s=(await sb.auth.getSession()).data.session;if(!s)throw new Error('Нужно войти заново');
  const r=await fetch(SUPABASE_URL+'/functions/v1/dispatch-telegram-notifications',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+s.access_token},body:JSON.stringify({client_id:state.clientId,action})});
  const b=await r.json();if(!r.ok)throw new Error(b.error||'Ошибка Telegram');return b;
}
async function v4TestTelegram(){try{await v4NotifyEdge('test');toast('Тестовое уведомление отправлено')}catch(e){const m=String(e.message||e);toast(m==='COMPOSIO_API_KEY_not_configured'?'Для серверной отправки Telegram нужно один раз настроить backend-ключ Composio':m,true)}}
async function v4DispatchTelegram(showResult=false){try{const b=await v4NotifyEdge('dispatch');if(showResult)toast('Отправлено: '+(b.sent||0)+(b.failed?' · ошибок: '+b.failed:''))}catch(e){if(showResult)toast(String(e.message||e),true)}}
function v4MaybeDispatchTelegram(){
  if(!state.notificationSettings?.telegram_enabled)return;
  const k='cc-v4-tg-dispatch:'+state.clientId,last=Number(localStorage.getItem(k)||0);
  if(Date.now()-last<300000)return;
  localStorage.setItem(k,String(Date.now()));v4DispatchTelegram(false);
}

function v4InjectTools(){
  const prod=$('production');
  if(prod&&!$('bulkActionsBtn')){const sec=prod.querySelector('.section');if(sec){const b=document.createElement('button');b.id='bulkActionsBtn';b.className='chip';b.textContent='☑ Массовые действия';b.onclick=v4OpenBulk;sec.appendChild(b)}}
  const ints=$('integrations');
  if(ints&&!$('tgNotificationCard'))ints.insertAdjacentHTML('afterbegin','<div class="card tg-notify-card" id="tgNotificationCard"><div><div class="ey">TEAM NOTIFICATIONS</div><h2>Telegram-уведомления</h2><p>Согласования, дедлайны, ошибки публикации и комментарии клиента.</p></div><button class="primary" onclick="v4OpenTelegram()">Настроить</button></div>');
  const dash=$('dashboard');
  if(dash&&!$('bulkQuickV4')){const q=dash.querySelector('.quick-grid');if(q)q.insertAdjacentHTML('beforeend','<button class="quick" id="bulkQuickV4" onclick="v4OpenBulk()"><strong>☑ Массово</strong><span>Статусы, дата, теги, ответственный, архив</span></button><button class="quick" onclick="v4OpenTelegram()"><strong>🔔 Telegram</strong><span>Рабочие уведомления команды</span></button>')}
}
const __v4RenderAllBase=renderAll;
renderAll=function(){__v4RenderAllBase();v4InjectTools()};

const __v4LoadClientDataBase=loadClientData;
loadClientData=async function(){
  await __v4LoadClientDataBase();
  const [al,ns,no]=await Promise.all([
    sb.from('client_approval_links').select('id,client_id,content_item_id,expires_at,revoked_at,created_at,last_opened_at,decision,decision_comment,decided_at').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(100),
    sb.from('notification_settings').select('*').eq('client_id',state.clientId).maybeSingle(),
    sb.from('notification_outbox').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(50)
  ]);
  state.approvalLinks=al.error?[]:(al.data||[]);
  state.notificationSettings=ns.error?null:(ns.data||null);
  state.notificationOutbox=no.error?[]:(no.data||[]);
  v4InjectTools();v4MaybeDispatchTelegram();
};

startRealtime=function(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}
  if(!state.session||!state.clientId)return;
  realtimeChannel=sb.channel('content-center-'+state.clientId)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_items',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_sync_events',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_comments',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'publish_queue',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_templates',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_links',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'saved_views',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'recurring_content_rules',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'client_approval_links',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'notification_settings',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'notification_outbox',filter:'client_id=eq.'+state.clientId},scheduleRealtimeReload)
    .subscribe();
};
