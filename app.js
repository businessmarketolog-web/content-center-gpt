
const SUPABASE_URL='https://kywxggukoqalzhuykhmx.supabase.co';
const SUPABASE_KEY='sb_publishable_ZrC415NRTShLSkSEuRAgLA_FF-57qBd';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});

const NAV=[
  ['dashboard','⌂','Главная'],
  ['calendar','◫','Календарь'],
  ['approvals','✓','Согласование'],
  ['production','◌','Производство'],
  ['publishing','↗','Публикации'],
  ['library','▦','Медиатека'],
  ['integrations','⚙','Интеграции'],
  ['instructions','?','Инструкции']
];
const STATUS={
  draft:'Черновик',production:'В работе',review:'Согласование',
  approved:'Одобрено',scheduled:'Запланировано',published:'Опубликовано',failed:'Ошибка'
};
let state={
  session:null,clients:[],clientId:null,content:[],integrations:[],assets:[],analytics:[],syncEvents:[],
  view:'dashboard',selectedId:null,filters:{q:'',status:'all',channel:'all'},calendarCursor:new Date(new Date().getFullYear(),new Date().getMonth(),1),calendarChannel:'all',calendarSelected:null,pendingFiles:[],libraryFilter:'all',libraryFiles:[]
};
let realtimeChannel=null,realtimeReloadTimer=null;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const currentClient=()=>state.clients.find(x=>x.id===state.clientId);
const itemById=id=>state.content.find(x=>x.id===id);
const fmtDate=v=>!v?'Без даты':new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const fmtDay=v=>new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(v).replace('.','');
const isoLocal=v=>{
  if(!v)return '';
  const d=new Date(v),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const mediaCount=x=>Array.isArray(x.media_urls)?x.media_urls.length:0;

function toast(msg,err=false){
  const t=$('toast');t.textContent=msg;t.className='toast on'+(err?' err':'');
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.className='toast',4300);
}
function navCount(v){
  if(v==='approvals')return state.content.filter(x=>x.status==='review').length;
  if(v==='publishing')return state.content.filter(x=>['approved','scheduled','failed'].includes(x.status)).length;
  return 0;
}
function renderNav(){
  $('menu').innerHTML=NAV.map(x=>{
    const n=navCount(x[0]);
    return `<button class="nav ${x[0]===state.view?'on':''}" data-v="${x[0]}"><span class="ni">${x[1]}</span><span>${x[2]}</span>${n?`<span class="count">${n}</span>`:''}</button>`;
  }).join('');
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.v));
}
function show(v){
  state.view=v;
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id===v));
  const navItem=NAV.find(x=>x[0]===v);
  $('title').textContent=navItem?.[2]||'Главная';
  $('crumb').textContent='Контент‑центр · '+(currentClient()?.name||'');
  renderNav();
  if(v==='calendar')renderCalendar();
  if(v==='approvals')renderApprovals();
  if(v==='production')renderProduction();
  if(v==='publishing')renderPublishing();
  if(v==='library')renderLibrary();
  if(v==='integrations')renderIntegrations();
  if(v==='instructions')renderInstructions();
}


function scheduleRealtimeReload(){
  clearTimeout(realtimeReloadTimer);
  realtimeReloadTimer=setTimeout(async()=>{
    if(state.session&&state.clientId)await loadClientData();
  },350);
}
function startRealtime(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}
  if(!state.session||!state.clientId)return;
  realtimeChannel=sb.channel('content-center-'+state.clientId)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_items',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_sync_events',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .subscribe();
}

async function boot(){
  const s=await sb.auth.getSession();
  state.session=s.data.session;
  if(!state.session){$('authLayer').classList.add('on');return}
  $('authLayer').classList.remove('on');
  await loadClients();
}
async function claim(){
  const code=$('setupCode').value.trim();
  if(!code)return toast('Введите код доступа владельца',true);
  $('claimBtn').disabled=true;
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/claim-owner-v2',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({code})
    });
    const b=await r.json();
    if(!r.ok)throw new Error(b.error||'Ошибка входа');
    const verified=await sb.auth.verifyOtp({token_hash:b.token_hash,type:'magiclink'});
    if(verified.error)throw verified.error;
    state.session=verified.data.session;
    $('authLayer').classList.remove('on');
    toast('Вход выполнен');
    await loadClients();
  }catch(e){toast(e.message,true)}
  finally{$('claimBtn').disabled=false}
}
async function loadClients(){
  const q=await sb.from('clients').select('*').order('name');
  if(q.error)return toast(q.error.message,true);
  state.clients=q.data||[];
  if(!state.clients.length)return toast('Нет доступных клиентов',true);
  if(!state.clientId||!state.clients.some(x=>x.id===state.clientId))state.clientId=state.clients[0].id;
  $('client').innerHTML=state.clients.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.business_type||'')}</option>`).join('');
  $('client').value=state.clientId;
  await loadClientData();
  startRealtime();
  renderNav();show(state.view);
}
async function loadClientData(){
  const [c,i,a,n,s]=await Promise.all([
    sb.from('content_items').select('*').eq('client_id',state.clientId).order('scheduled_at',{ascending:true,nullsFirst:false}),
    sb.from('client_integrations').select('*').eq('client_id',state.clientId).order('channel'),
    sb.from('assets').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}),
    sb.from('analytics_daily').select('*').eq('client_id',state.clientId).order('day',{ascending:false}).limit(30),
    sb.from('content_sync_events').select('id,event_type,source,created_at,delivered_at,payload').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(50)
  ]);
  if(c.error)return toast(c.error.message,true);
  if(i.error)return toast(i.error.message,true);
  state.content=c.data||[];
  state.integrations=i.data||[];
  state.assets=a.error?[]:(a.data||[]);
  state.analytics=n.error?[]:(n.data||[]);
  state.syncEvents=s.error?[]:(s.data||[]);
  renderAll();
}
function renderAll(){
  renderDashboard();renderCalendar();renderApprovals();renderProduction();renderPublishing();renderLibrary();renderIntegrations();renderInstructions();
  $('crumb').textContent='Контент‑центр · '+(currentClient()?.name||'');
  renderNav();
}

function statusBadge(x){return `<span class="status ${x.status}">${STATUS[x.status]||x.status}</span>`}
function metaLine(x){
  return `<div class="content-meta"><span>${esc(x.format)}</span><span class="meta-dot"></span><span>${esc(x.channel)}</span><span class="meta-dot"></span><span>${fmtDate(x.scheduled_at)}</span><span class="meta-dot"></span><span>${mediaCount(x)} media</span></div>`;
}
function contentCard(x,expanded=false){
  const body=esc(x.brief||x.caption||'Описание пока не добавлено.');
  return `<article class="content-card ${expanded?'open':''}" id="cc-${x.id}">
    <div class="content-card-head" onclick="toggleCard('${x.id}')">
      <div><div class="content-title" title="${esc(x.title)}">${esc(x.title)}</div>${metaLine(x)}</div>
      <div class="content-card-actions">${statusBadge(x)}<button class="mini-btn" onclick="event.stopPropagation();openDrawer('${x.id}')">Открыть</button></div>
    </div>
    <div class="content-expand"><div class="content-expand-inner">
      <p>${body}</p>
      <div class="inline-actions">
        <button class="mini-btn" onclick="openDrawer('${x.id}')">Детали</button>
        ${x.status==='review'?`<button class="mini-btn accent" onclick="setStatus('${x.id}','approved')">Одобрить</button>`:''}
        ${['approved','scheduled','failed'].includes(x.status)?`<button class="mini-btn accent" onclick="publishItem('${x.id}')">Опубликовать</button>`:''}
        <button class="mini-btn" onclick="copyItemGPT('${x.id}')">В ChatGPT</button>
      </div>
    </div></div>
  </article>`;
}
function toggleCard(id){
  const el=$('cc-'+id);
  if(el)el.classList.toggle('open');
}

function getThisWeek(){
  const now=new Date(),end=new Date(now);end.setDate(now.getDate()+7);
  return state.content.filter(x=>x.scheduled_at&&new Date(x.scheduled_at)>=now&&new Date(x.scheduled_at)<end);
}
function renderDashboard(){
  const c=currentClient(),a=state.content;
  const review=a.filter(x=>x.status==='review'),ready=a.filter(x=>x.status==='approved'),week=getThisWeek(),published=a.filter(x=>x.status==='published');
  const work=a.filter(x=>['draft','production','review'].includes(x.status)).length;
  const progress=Math.min(96,Math.max(14,Math.round(((published.length+ready.length)/(Math.max(1,a.length)))*100)));
  const stage=review.length?'Нужно согласование':ready.length?'Готово к публикации':work?'Контент в работе':'Планирование';
  $('dashboard').innerHTML=`
    <div class="hero-grid">
      <div class="card hero-main glow">
        <div class="hero-top"><div><div class="ey">CURRENT WORKFLOW</div><div class="stage">${esc(stage)}</div></div><span class="badge">● ${progress}% цикла</span></div>
        <p class="sub">${esc(c?.name)} · единый рабочий экран для планирования, согласования и публикации.</p>
        <div class="bar"><i style="width:${progress}%"></i></div>
        <div class="metrics">
          <div class="metric"><b>${a.length}</b><small>всего материалов</small></div>
          <div class="metric"><b>${work}</b><small>в производстве</small></div>
          <div class="metric"><b>${published.length}</b><small>опубликовано</small></div>
        </div>
      </div>
      <div class="focus-grid">
        <div class="focus-card" onclick="show('approvals')"><div class="focus-icon">✓</div><div class="focus-num">${review.length}</div><div class="focus-label">ждут согласования</div></div>
        <div class="focus-card" onclick="show('publishing')"><div class="focus-icon">↗</div><div class="focus-num">${ready.length}</div><div class="focus-label">готовы к публикации</div></div>
        <div class="focus-card" onclick="show('calendar')"><div class="focus-icon">◫</div><div class="focus-num">${week.length}</div><div class="focus-label">запланировано на 7 дней</div></div>
      </div>
    </div>

    ${renderMiniCalendar14()}

    <div class="dashboard-grid">
      <div>
        <div class="section"><div><h2>Ближайший контент</h2><p>Нажмите на карточку — она раскроется. «Открыть» показывает полный материал.</p></div><button class="chip" onclick="show('calendar')">Весь календарь →</button></div>
        <div class="content-list">${a.slice(0,6).map(x=>contentCard(x)).join('')||'<div class="card empty">Материалов пока нет</div>'}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="ey">QUICK ACTIONS</div>
          <div class="section" style="margin-top:6px"><div><h2>Рабочие действия</h2><p>Частые операции без лишних переходов.</p></div></div>
          <div class="quick-grid">
            <button class="quick" onclick="$('contentModal').classList.add('on')"><strong>＋ Новый материал</strong><span>Добавить пост, Reels или Stories</span></button>
            <button class="quick" onclick="show('approvals')"><strong>✓ Проверить</strong><span>Очередь согласования</span></button>
            <button class="quick" onclick="openPalette()"><strong>⌕ Найти</strong><span>Поиск по всему контенту</span></button>
            <button class="quick" onclick="copyGPT()"><strong>✦ ChatGPT</strong><span>Передать контекст клиента</span></button>
          </div>
        </div>
        <div class="card">
          <div class="ey">BRAND CONTEXT</div>
          <div class="section" style="margin-top:6px"><div><h2>Как говорить от имени бренда</h2><p>Короткая памятка без технических полей.</p></div></div>
          ${renderBrandContext(c)}
        </div>
      </div>
    </div>
    ${renderWorkBlocks()}`;
}



function next14Days(){
  const out=[],today=new Date();today.setHours(0,0,0,0);
  for(let i=0;i<14;i++){const d=new Date(today);d.setDate(today.getDate()+i);out.push(d)}
  return out;
}
function goCalendarDay(iso){
  const d=new Date(iso);
  state.calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  state.calendarSelected=d.toISOString();
  show('calendar');
}
function renderMiniCalendar14(){
  const days=next14Days(),now=new Date();now.setHours(0,0,0,0);
  const end=new Date(now.getTime()+14*86400000);
  const items=state.content.filter(x=>x.scheduled_at&&new Date(x.scheduled_at)>=now&&new Date(x.scheduled_at)<end);
  let cells='';
  days.forEach((d,i)=>{
    const dayItems=state.content.filter(x=>x.scheduled_at&&sameDay(x.scheduled_at,d));
    const ig=dayItems.filter(x=>x.channel==='Instagram').length;
    const tg=dayItems.filter(x=>x.channel==='Telegram').length;
    let dots='';
    for(let n=0;n<Math.min(ig,2);n++)dots+='<i class="channel-dot instagram"></i>';
    for(let n=0;n<Math.min(tg,2);n++)dots+='<i class="channel-dot telegram"></i>';
    const weekday=new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(d).replace('.','');
    cells+='<button class="mini-day '+(i===0?'today ':'')+(dayItems.length?'has-posts':'')+'" onclick="goCalendarDay(\''+d.toISOString()+'\')">'+
      '<span class="mini-weekday">'+weekday+'</span>'+
      '<b>'+d.getDate()+'</b>'+
      '<span class="mini-dots">'+dots+'</span>'+
      '<small>'+(dayItems.length||'')+'</small>'+
    '</button>';
  });
  return '<div class="mini-cal-card">'+
    '<div class="mini-cal-head">'+
      '<div><div class="ey">БЛИЖАЙШИЕ 14 ДНЕЙ</div><h2>План публикаций</h2><p>'+items.length+' публикаций запланировано</p></div>'+
      '<div class="mini-cal-legend"><span><i class="channel-dot instagram"></i> Instagram</span><span><i class="channel-dot telegram"></i> Telegram</span><button class="chip" onclick="show(\'calendar\')">Открыть календарь →</button></div>'+
    '</div>'+
    '<div class="mini-cal-grid">'+cells+'</div>'+
  '</div>';
}

function humanBrandValue(key,value){
  const maps={
    focus:{'trust/reviews':'Делать акцент на доверии, отзывах и реальных поездках клиентов'},
    segment:{'premium furniture':'Премиальная мебель на заказ'}
  };
  return maps[key]?.[String(value)]||String(value??'');
}
function renderBrandContext(c){
  const r=c?.brand_rules||{};
  const rows=[];
  if(r.focus)rows.push(['Главный смысл',humanBrandValue('focus',r.focus),'Контент должен в первую очередь вызывать доверие и показывать реальный опыт клиентов.']);
  if(r.segment)rows.push(['Позиционирование',humanBrandValue('segment',r.segment),'Держим уровень подачи и визуала в соответствии с сегментом.']);
  if(r.primary_font)rows.push(['Основной шрифт',r.primary_font,'Использовать для основного текста и информационных блоков.']);
  if(r.accent_font)rows.push(['Акцентный шрифт',r.accent_font,'Только для коротких акцентов, не для больших текстов.']);
  if(r.instagram)rows.push(['Instagram','@'+String(r.instagram).replace(/^@/,''),'Основной аккаунт клиента — не смешивать с другими проектами.']);
  const known=new Set(['focus','segment','primary_font','accent_font','instagram']);
  Object.entries(r).filter(([k])=>!known.has(k)).forEach(([k,v])=>rows.push([k.replaceAll('_',' '),humanBrandValue(k,v),'']));
  if(!rows.length)return '<div class="sub">Правила бренда ещё не заполнены.</div>';
  return `<div class="brand-context">${rows.map(([title,value,note])=>`<div class="brand-rule"><div class="brand-rule-label">${esc(title)}</div><b>${esc(value)}</b>${note?`<p>${esc(note)}</p>`:''}</div>`).join('')}</div>`;
}
function renderWorkBlocks(){
  const a=state.content;
  const missingMedia=a.filter(x=>!Array.isArray(x.media_urls)||!x.media_urls.length).length;
  const missingText=a.filter(x=>!String(x.caption||x.brief||'').trim()).length;
  const noDate=a.filter(x=>!x.scheduled_at&&!['published','failed'].includes(x.status)).length;
  const overdue=a.filter(x=>x.scheduled_at&&new Date(x.scheduled_at)<new Date()&&!['published','failed'].includes(x.status)).length;
  const soon=a.filter(x=>{if(!x.scheduled_at||['published','failed'].includes(x.status))return false;const d=new Date(x.scheduled_at)-new Date();return d>=0&&d<=3*86400000}).length;
  const ig=a.filter(x=>x.channel==='Instagram').length,tg=a.filter(x=>x.channel==='Telegram').length,total=Math.max(1,ig+tg);
  return `<div class="section"><div><h2>Рабочий контроль</h2><p>Что требует внимания до публикации.</p></div></div>
  <div class="work-blocks">
    <div class="card work-block"><div class="work-icon">◎</div><div><span>Качество карточек</span><b>${missingMedia+missingText+noDate}</b><small>${missingMedia} без фото · ${missingText} без текста · ${noDate} без даты</small></div></div>
    <div class="card work-block ${overdue?'attention':''}"><div class="work-icon">◷</div><div><span>Дедлайн‑радар</span><b>${overdue+soon}</b><small>${overdue} просрочено · ${soon} в ближайшие 3 дня</small></div></div>
    <div class="card work-block"><div class="work-icon">◐</div><div><span>Баланс каналов</span><b>${ig} / ${tg}</b><small><i class="channel-dot instagram"></i> Instagram ${Math.round(ig/total*100)}% · <i class="channel-dot telegram"></i> Telegram ${Math.round(tg/total*100)}%</small></div></div>
  </div>`;
}

function sameDay(a,b){
  const x=new Date(a);return x.getFullYear()===b.getFullYear()&&x.getMonth()===b.getMonth()&&x.getDate()===b.getDate();
}
function filteredContent(){
  const q=state.filters.q.toLowerCase().trim();
  return state.content.filter(x=>{
    const hay=[x.title,x.brief,x.caption,x.format,x.channel,STATUS[x.status]].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(state.filters.status==='all'||x.status===state.filters.status)&&(state.filters.channel==='all'||x.channel===state.filters.channel);
  });
}
function setFilter(k,v){state.filters[k]=v;renderCalendar()}
function setCalendarChannel(v){state.calendarChannel=v;renderCalendar()}
function shiftCalendar(n){state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+n,1);state.calendarSelected=null;renderCalendar()}
function calendarToday(){const d=new Date();state.calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);state.calendarSelected=d.toISOString();renderCalendar()}
function selectCalendarDay(iso){state.calendarSelected=iso;renderCalendar()}
function openAdd(dateIso=null){
  $('contentModal').classList.add('on');
  if(dateIso){
    const d=new Date(dateIso);d.setHours(12,0,0,0);
    $('fDate').value=isoLocal(d.toISOString());
  }
}
function monthCells(cursor){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),start=new Date(first);
  const mondayOffset=(first.getDay()+6)%7;start.setDate(first.getDate()-mondayOffset);
  return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
}
function channelDot(ch){return `<i class="channel-dot ${ch==='Instagram'?'instagram':'telegram'}"></i>`}
function renderCalendar(){
  const cursor=state.calendarCursor,cells=monthCells(cursor),today=new Date(),month=cursor.getMonth(),year=cursor.getFullYear();
  const channelItems=state.content.filter(x=>state.calendarChannel==='all'||x.channel===state.calendarChannel);
  const selected=state.calendarSelected?new Date(state.calendarSelected):today;
  const selectedItems=channelItems.filter(x=>x.scheduled_at&&sameDay(x.scheduled_at,selected));
  $('calendar').innerHTML=`
    <div class="calendar-head">
      <div><div class="ey">CONTENT CALENDAR</div><h2>${new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(cursor)}</h2></div>
      <div class="calendar-controls">
        <button class="chip" onclick="shiftCalendar(-1)">←</button>
        <button class="chip" onclick="calendarToday()">Сегодня</button>
        <button class="chip" onclick="shiftCalendar(1)">→</button>
      </div>
    </div>
    <div class="calendar-legend">
      <button class="legend-filter ${state.calendarChannel==='all'?'on':''}" onclick="setCalendarChannel('all')"><span class="legend-both"><i class="channel-dot instagram"></i><i class="channel-dot telegram"></i></span>Все каналы</button>
      <button class="legend-filter ${state.calendarChannel==='Instagram'?'on':''}" onclick="setCalendarChannel('Instagram')"><i class="channel-dot instagram"></i>Instagram</button>
      <button class="legend-filter ${state.calendarChannel==='Telegram'?'on':''}" onclick="setCalendarChannel('Telegram')"><i class="channel-dot telegram"></i>Telegram</button>
      <span class="legend-note">Точка показывает канал публикации</span>
    </div>
    <div class="month-calendar">
      ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<div class="month-weekday">${x}</div>`).join('')}
      ${cells.map(d=>{
        const items=channelItems.filter(x=>x.scheduled_at&&sameDay(x.scheduled_at,d));
        const outside=d.getMonth()!==month,isToday=sameDay(today,d),isSelected=sameDay(selected,d);
        return `<div class="month-day ${outside?'outside':''} ${isToday?'today':''} ${isSelected?'selected':''}" onclick="selectCalendarDay('${d.toISOString()}')">
          <div class="month-day-head"><b>${d.getDate()}</b>${isToday?'<span>сегодня</span>':''}<button title="Добавить материал" onclick="event.stopPropagation();openAdd('${d.toISOString()}')">＋</button></div>
          <div class="month-posts">${items.slice(0,2).map(x=>`<button class="month-post" onclick="event.stopPropagation();openDrawer('${x.id}')">${channelDot(x.channel)}<span>${esc(x.title)}</span></button>`).join('')}${items.length>2?`<small>+ ещё ${items.length-2}</small>`:''}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="selected-day-panel card">
      <div class="selected-day-head"><div><div class="ey">ВЫБРАННЫЙ ДЕНЬ</div><h3>${new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(selected)}</h3></div><button class="primary" onclick="openAdd('${selected.toISOString()}')">＋ Материал</button></div>
      <div class="selected-day-list">${selectedItems.length?selectedItems.map(x=>`<div class="selected-day-item" onclick="openDrawer('${x.id}')">${channelDot(x.channel)}<div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${STATUS[x.status]} · ${fmtDate(x.scheduled_at)}</small></div></div>`).join(''):'<div class="empty compact-empty">На этот день публикаций нет.</div>'}</div>
    </div>
    <div class="section"><div><h2>Материалы месяца</h2><p>Открывайте карточку для редактирования и согласования.</p></div><button class="chip" onclick="openPalette()">⌕ Поиск</button></div>
    <div class="content-list">${channelItems.filter(x=>x.scheduled_at&&new Date(x.scheduled_at).getMonth()===month&&new Date(x.scheduled_at).getFullYear()===year).map(x=>contentCard(x)).join('')||'<div class="card empty">В этом месяце пока нет материалов</div>'}</div>`;
}

function renderApprovals(){
  const pending=state.content.filter(x=>x.status==='review'),done=state.content.filter(x=>x.status==='approved').slice(0,8);
  $('approvals').innerHTML=`
    <div class="section"><div><h2>Очередь согласования</h2><p>Фокус только на материалах, которым нужно решение.</p></div><span class="badge">${pending.length} ожидают</span></div>
    <div class="approval-grid">
      <div class="content-list">
        ${pending.map(x=>`<div class="content-card open">
          <div class="content-card-head" onclick="openDrawer('${x.id}')"><div><div class="content-title">${esc(x.title)}</div>${metaLine(x)}</div>${statusBadge(x)}</div>
          <div class="content-expand" style="max-height:420px;opacity:1"><div class="content-expand-inner"><p>${esc(x.brief||x.caption||'Материал готов к проверке.')}</p>
            <div class="inline-actions"><button class="mini-btn accent" onclick="setStatus('${x.id}','approved')">✓ Одобрить</button><button class="mini-btn" onclick="openDrawer('${x.id}')">Открыть полностью</button><button class="mini-btn" onclick="setStatus('${x.id}','production')">Вернуть в работу</button></div>
          </div></div>
        </div>`).join('')||'<div class="card empty">Очередь пуста — всё согласовано.</div>'}
      </div>
      <div class="approval-side">
        <div class="card approval-summary"><div class="ey">PENDING</div><b>${pending.length}</b><span>материалов требуют решения</span></div>
        <div class="card"><div class="ey">RECENTLY APPROVED</div>${done.map(x=>`<div class="day-post" onclick="openDrawer('${x.id}')"><b>${esc(x.title)}</b><small>${fmtDate(x.scheduled_at)}</small></div>`).join('')||'<div class="sub">Пока нет</div>'}</div>
      </div>
    </div>`;
}
function renderProduction(){
  const cols=[['draft','Черновики'],['production','В работе'],['review','Согласование'],['approved','Готово']];
  $('production').innerHTML=`
    <div class="section"><div><h2>Производство</h2><p>Канбан показывает состояние контента от идеи до готовности.</p></div><button class="chip" onclick="$('contentModal').classList.add('on')">＋ Материал</button></div>
    <div class="kanban">${cols.map(([s,n])=>{
      const items=state.content.filter(x=>x.status===s);
      return `<div class="lane"><div class="lane-head"><h3>${n}</h3><span class="lane-count">${items.length}</span></div>
        ${items.map(x=>`<div class="task" onclick="openDrawer('${x.id}')"><b>${esc(x.title)}</b><p>${esc(x.format)} · ${esc(x.channel)} · ${fmtDate(x.scheduled_at)}</p></div>`).join('')||'<div class="empty">Пусто</div>'}
      </div>`;
    }).join('')}</div>`;
}
function renderPublishing(){
  const list=state.content.filter(x=>['approved','scheduled','failed','published'].includes(x.status));
  $('publishing').innerHTML=`
    <div class="section"><div><h2>Публикации</h2><p>Одобренный контент можно отправить в соцсеть из детальной карточки или прямо отсюда.</p></div><span class="badge">${list.filter(x=>x.status!=='published').length} в очереди</span></div>
    <div class="content-list">${list.map(x=>`<div class="content-card"><div class="content-card-head" onclick="openDrawer('${x.id}')"><div><div class="content-title">${esc(x.title)}</div>${metaLine(x)}</div><div class="content-card-actions">${statusBadge(x)}${['approved','scheduled','failed'].includes(x.status)?`<button class="mini-btn accent" onclick="event.stopPropagation();publishItem('${x.id}')">Опубликовать</button>`:''}</div></div></div>`).join('')||'<div class="card empty">Нет материалов для публикации</div>'}</div>`;
}
function allMedia(){
  const map=new Map();
  state.content.forEach(x=>(Array.isArray(x.media_urls)?x.media_urls:[]).forEach((url,i)=>{
    const kind=/\.(mp4|mov|m4v|webm)(\?|$)/i.test(url)?'video':/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)?'image':'image';
    map.set(url,{id:`${x.id}-${i}`,name:x.title,url,kind,content_id:x.id,created_at:x.created_at,source:'content'});
  }));
  state.assets.forEach(a=>map.set(a.url,{id:a.id,name:a.name,url:a.url,kind:a.kind||'asset',content_id:a.metadata?.content_item_id||null,created_at:a.created_at,source:'library'}));
  return [...map.values()];
}
function setLibraryFilter(v){state.libraryFilter=v;renderLibrary()}
function openMediaModal(){$('mediaModal').classList.add('on');setTimeout(()=>$('assetName').focus(),50)}
function closeMediaModal(){
  $('mediaModal').classList.remove('on');
  $('assetName').value='';$('assetUrl').value='';$('assetFiles').value='';
  state.libraryFiles=[];renderAssetPreview();
}
function renderAssetPreview(){
  const box=$('assetPreview');if(!box)return;
  box.innerHTML=state.libraryFiles.map((f,i)=>{
    const u=URL.createObjectURL(f),isVideo=f.type.startsWith('video/');
    return `<div class="media-pick">${isVideo?`<video src="${u}" muted></video>`:`<img src="${u}">`}<button type="button" onclick="removeLibraryFile(${i})">×</button><span>${esc(f.name)}</span><small>${Math.max(.1,f.size/1024/1024).toFixed(1)} МБ</small></div>`;
  }).join('');
}
function addLibraryFiles(files){
  const accepted=[...files].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
  const merged=[...state.libraryFiles];
  accepted.forEach(f=>{if(!merged.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))merged.push(f)});
  const tooLarge=merged.filter(f=>f.size>52428800);
  state.libraryFiles=merged.filter(f=>f.size<=52428800).slice(0,20);
  if(tooLarge.length)toast('Файлы больше 50 МБ пропущены',true);
  renderAssetPreview();
}
function removeLibraryFile(i){state.libraryFiles.splice(i,1);renderAssetPreview()}
async function saveLibraryAssets(){
  const btn=$('mediaSave'),old=btn.textContent,name=$('assetName').value.trim(),link=$('assetUrl').value.trim();
  if(!state.libraryFiles.length&&!link)return toast('Добавьте файл или ссылку',true);
  if(link&&!/^https?:\/\//i.test(link))return toast('Ссылка должна начинаться с http:// или https://',true);
  btn.disabled=true;btn.textContent='Сохраняю…';
  try{
    const rows=[];
    for(const file of state.libraryFiles){
      const safe=file.name.toLowerCase().replace(/[^a-z0-9а-яё._-]+/gi,'-').replace(/^-+|-+$/g,'')||'asset';
      const path=`${state.clientId}/library/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
      const up=await sb.storage.from('content-assets').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(up.error)throw up.error;
      const pub=sb.storage.from('content-assets').getPublicUrl(path);
      rows.push({
        client_id:state.clientId,
        name:name&&state.libraryFiles.length===1?name:file.name,
        kind:file.type.startsWith('video/')?'video':'image',
        url:pub.data.publicUrl,
        metadata:{storage_path:path,size:file.size,mime:file.type,source:'media_library'}
      });
    }
    if(link){
      let defaultName='Ссылка';
      try{defaultName=new URL(link).hostname.replace(/^www\./,'')}catch{}
      rows.push({client_id:state.clientId,name:name||defaultName,kind:'link',url:link,metadata:{source:'media_library'}});
    }
    const ins=await sb.from('assets').insert(rows);
    if(ins.error)throw ins.error;
    closeMediaModal();toast(`Добавлено в медиатеку: ${rows.length}`);await loadClientData();show('library');
  }catch(e){toast(e.message||'Не удалось добавить в медиатеку',true)}
  finally{btn.disabled=false;btn.textContent=old}
}
function libraryAssetHtml(m){
  const clickable=m.content_id?`onclick="openDrawer('${m.content_id}')"`:m.url?`onclick="window.open('${esc(m.url)}','_blank','noopener')"`:'';
  const preview=m.kind==='image'?`<img src="${esc(m.url)}" loading="lazy" onerror="this.parentElement.innerHTML='▧'">`
    :m.kind==='video'?`<video src="${esc(m.url)}" muted preload="metadata"></video><span class="video-badge">▶</span>`
    :`<div class="link-preview">↗<small>${esc((()=>{try{return new URL(m.url).hostname}catch{return 'ссылка'}})())}</small></div>`;
  const label=m.kind==='image'?'Фото':m.kind==='video'?'Видео':m.kind==='link'?'Ссылка':m.kind;
  return `<div class="asset media-asset" ${clickable}>
    <div class="asset-preview">${preview}</div>
    <div class="asset-meta"><b>${esc(m.name||'Без названия')}</b><small>${label}</small></div>
  </div>`;
}
function renderLibrary(){
  const all=allMedia();
  const media=state.libraryFilter==='all'?all:all.filter(m=>m.kind===state.libraryFilter);
  const counts={
    all:all.length,
    image:all.filter(m=>m.kind==='image').length,
    video:all.filter(m=>m.kind==='video').length,
    link:all.filter(m=>m.kind==='link').length
  };
  $('library').innerHTML=`
    <div class="section media-library-head">
      <div><div class="ey">MEDIA LIBRARY</div><h2>Медиатека</h2><p>Фото, видео, ссылки и материалы выбранного клиента.</p></div>
      <button class="primary" onclick="openMediaModal()">＋ Добавить</button>
    </div>
    <div class="media-filter-bar">
      <button class="chip ${state.libraryFilter==='all'?'on':''}" onclick="setLibraryFilter('all')">Все <span>${counts.all}</span></button>
      <button class="chip ${state.libraryFilter==='image'?'on':''}" onclick="setLibraryFilter('image')">Фото <span>${counts.image}</span></button>
      <button class="chip ${state.libraryFilter==='video'?'on':''}" onclick="setLibraryFilter('video')">Видео <span>${counts.video}</span></button>
      <button class="chip ${state.libraryFilter==='link'?'on':''}" onclick="setLibraryFilter('link')">Ссылки <span>${counts.link}</span></button>
    </div>
    <div class="library-grid">${media.map(libraryAssetHtml).join('')||'<div class="card empty media-empty"><b>Здесь пока пусто</b><span>Нажмите «＋ Добавить», чтобы загрузить фото, видео или сохранить ссылку.</span></div>'}</div>`;
}


function guideSample(){
  const item=state.content.find(x=>x.title)||null;
  const photo=allMedia().find(x=>x.kind==='image')?.url||'';
  return {item,photo};
}
function guidePhotoVisual(title='Пример фото'){
  const {photo}=guideSample();
  return `<div class="guide-photo">${photo?`<img src="${esc(photo)}" alt="${esc(title)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('fallback')">`:''}<div class="guide-photo-fallback">▧<small>${esc(title)}</small></div></div>`;
}
function guideMock(type){
  const {item}=guideSample(),title=esc(item?.title||'Пример материала');
  if(type==='dashboard')return `<div class="guide-mock"><div class="gm-top"><i></i><i></i><i></i></div><div class="gm-kpis"><b>4</b><b>2</b><b>7</b></div><div class="gm-line"></div><div class="gm-card">${title}</div></div>`;
  if(type==='calendar')return `<div class="guide-calendar-mock">${Array.from({length:14},(_,i)=>`<div class="${[2,5,9].includes(i)?'busy':''}"><b>${i+1}</b>${i===2?'<span class="channel-dot instagram"></span>':''}${i===5?'<span class="channel-dot telegram"></span>':''}${i===9?'<span class="channel-dot instagram"></span><span class="channel-dot telegram"></span>':''}</div>`).join('')}</div>`;
  if(type==='approval')return `<div class="guide-mock"><div class="gm-row"><span class="status review">Согласование</span><b>${title}</b></div><div class="gm-actions"><i>Вернуть</i><i class="okbtn">Одобрить</i></div></div>`;
  if(type==='production')return `<div class="guide-kanban"><div><small>Черновик</small><b>${title}</b></div><div><small>В работе</small><b>Reels · монтаж</b></div><div><small>Согласование</small><b>Stories · отзыв</b></div></div>`;
  if(type==='publishing')return `<div class="guide-mock"><div class="gm-row"><span class="channel-dot instagram"></span><b>${title}</b></div><div class="gm-row"><span class="status approved">Одобрено</span><span class="guide-date">20 сен · 18:00</span></div><div class="gm-button">Опубликовать</div></div>`;
  if(type==='integrations')return `<div class="guide-integrations"><div><b>IG</b><span>● подключено</span></div><div><b>TG</b><span>● бот подключён</span></div><div><b>GPT</b><span>● sync active</span></div></div>`;
  return `<div class="guide-mock"><div class="gm-card">${title}</div></div>`;
}
function renderInstructions(){
  const c=currentClient(),sample=guideSample().item;
  const sampleTitle=esc(sample?.title||'Reels: пример материала');
  $('instructions').innerHTML=`
    <div class="guide-hero">
      <div><div class="ey">HELP CENTER</div><h2>Как работать с Content Center</h2><p>Короткие инструкции для ${esc(c?.name||'выбранного клиента')}. Открывайте нужный пункт — внутри есть действия, визуальный пример и правила.</p></div>
      <div class="guide-hero-actions"><button class="primary" onclick="openAdd()">＋ Создать материал</button><button class="ghost" onclick="show('integrations')">Проверить интеграции</button></div>
    </div>
    <div class="guide-quick">
      <div><b>1</b><span>Выберите клиента</span></div><i>→</i><div><b>2</b><span>Создайте материал</span></div><i>→</i><div><b>3</b><span>Проведите через статусы</span></div><i>→</i><div><b>4</b><span>Запланируйте / опубликуйте</span></div>
    </div>
    <div class="guide-grid">
      <details class="guide-item" open><summary><span class="guide-num">01</span><div><b>Главная</b><small>Что требует внимания сегодня</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Сначала выберите клиента вверху.</li><li>Проверьте «Рабочий контроль»: нет ли материалов без фото, текста или даты.</li><li>Мини‑календарь показывает ближайшие 14 дней.</li></ol><p><b>Пример:</b> если стоит «2 без фото» — откройте карточки и добавьте медиа.</p><button class="guide-go" onclick="show('dashboard')">Открыть Главную →</button></div>${guideMock('dashboard')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">02</span><div><b>Создание материала</b><small>Текст, фото, канал, дата и статус</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Нажмите «＋ Материал».</li><li>Введите заголовок, выберите формат и канал.</li><li>Добавьте текст, фото и при необходимости дату.</li><li>Сохраните как «Черновик», если работа ещё не закончена.</li></ol><p><b>Пример:</b> «${sampleTitle}» → Reels → Instagram → 20 сентября → «В работе».</p><button class="guide-go" onclick="openAdd()">Создать материал →</button></div>${guidePhotoVisual('Фото для нового материала')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">03</span><div><b>Календарь</b><small>План публикаций по датам и каналам</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Розовая точка — Instagram, синяя — Telegram.</li><li>Нажмите на день, чтобы увидеть публикации этой даты.</li><li>Нажмите «＋» у даты, чтобы создать материал на этот день.</li><li>Фильтры сверху оставляют нужный канал.</li></ol><p><b>Пример:</b> две точки в одном дне означают публикации сразу в двух каналах.</p><button class="guide-go" onclick="show('calendar')">Открыть календарь →</button></div>${guideMock('calendar')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">04</span><div><b>Согласование</b><small>Финальная проверка перед публикацией</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Сюда попадают материалы со статусом «Согласование».</li><li>Проверьте текст, фото, канал и дату.</li><li>Если всё готово — «Одобрить». Если нужны правки — вернуть в работу.</li></ol><p><b>Правило:</b> перед публикацией материал должен пройти финальную проверку.</p><button class="guide-go" onclick="show('approvals')">Открыть согласование →</button></div>${guideMock('approval')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">05</span><div><b>Производство</b><small>Где находится каждый материал</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Используйте этапы: Черновик → В работе → Согласование → Одобрено.</li><li>Открывайте карточку, чтобы изменить текст, дату или статус.</li><li>Не оставляйте готовый материал в «Черновике».</li></ol><p><b>Пример:</b> сценарий готов, видео ещё монтируется → «В работе».</p><button class="guide-go" onclick="show('production')">Открыть производство →</button></div>${guideMock('production')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">06</span><div><b>Публикации</b><small>Готовые, запланированные и опубликованные материалы</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Перед публикацией проверьте выбранного клиента и канал.</li><li>Статус «Одобрено» означает готовность к отправке.</li><li>После отправки проверьте результат и статус.</li></ol><p><b>Важно:</b> аккаунты соцсетей закреплены за конкретным клиентом.</p><button class="guide-go" onclick="show('publishing')">Открыть публикации →</button></div>${guideMock('publishing')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">07</span><div><b>Медиатека</b><small>Фото, видео, ссылки и референсы</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Нажмите «＋ Добавить».</li><li>Загрузите фото/видео или вставьте ссылку.</li><li>Используйте фильтры «Фото / Видео / Ссылки».</li><li>Файлы сохраняются только у выбранного клиента.</li></ol><p><b>Лимит:</b> до 50 МБ на файл в медиатеке.</p><button class="guide-go" onclick="show('library')">Открыть медиатеку →</button></div>${guidePhotoVisual('Пример из медиатеки')}</div></details>
      <details class="guide-item"><summary><span class="guide-num">08</span><div><b>Интеграции</b><small>Instagram, Telegram и ChatGPT Sync</small></div><span class="guide-plus">＋</span></summary><div class="guide-body"><div class="guide-copy"><ol><li>Проверьте подключения выбранного клиента.</li><li>Для Telegram укажите правильный @channelusername или chat_id.</li><li>ChatGPT Sync показывает ожидающие передачи изменения.</li></ol><p><b>Правило:</b> подключение одного клиента нельзя использовать для другого.</p><button class="guide-go" onclick="show('integrations')">Открыть интеграции →</button></div>${guideMock('integrations')}</div></details>
    </div>
    <div class="section"><div><div class="ey">CHATGPT SYNC</div><h2>Как устроена синхронизация</h2><p>Supabase — единая рабочая база между кабинетом и ChatGPT.</p></div></div>
    <div class="sync-guide">
      <div class="sync-path"><div class="sync-node"><span>ChatGPT</span><b>Вы даёте явную команду</b><small>«Добавь», «измени», «перенеси», «поставь статус»</small></div><div class="sync-arrow"><b>→</b><small>запись сразу</small></div><div class="sync-node core"><span>Supabase</span><b>Единая база</b><small>Материалы, даты, статусы, медиа</small></div><div class="sync-arrow"><b>→</b><small>Realtime</small></div><div class="sync-node"><span>Content Center</span><b>Экран обновляется автоматически</b><small>Открытый кабинет подтягивает изменения без F5</small></div></div>
      <div class="sync-path reverse"><div class="sync-node"><span>Content Center</span><b>Вы меняете материал</b><small>Создание, статус, текст, дата</small></div><div class="sync-arrow"><b>→</b><small>сразу в журнал</small></div><div class="sync-node core"><span>Sync Events</span><b>Фиксируется изменение</b><small>С клиентом и изменёнными полями</small></div><div class="sync-arrow"><b>→</b><small>раз в час</small></div><div class="sync-node"><span>ChatGPT</span><b>Получает уведомление</b><small>Или читает изменения сразу по вашему запросу</small></div></div>
    </div>
    <div class="guide-rules"><div class="ey">ПРАВИЛА СИНХРОНИЗАЦИИ</div><div class="rules-grid">
      <div><b>01</b><p><strong>Всегда называйте клиента.</strong> Например: «Для Max Way перенеси Reels на 21 сентября».</p></div>
      <div><b>02</b><p><strong>Текст в чате сам не сохраняется.</strong> Чтобы он попал в Content Center, скажите: «сохрани», «добавь» или «измени».</p></div>
      <div><b>03</b><p><strong>Один материал — один клиент.</strong> Контент, медиатека и соцсети разделены между проектами.</p></div>
      <div><b>04</b><p><strong>ChatGPT → Center идёт через Supabase.</strong> Открытая страница получает изменения через Realtime.</p></div>
      <div><b>05</b><p><strong>Center → ChatGPT фиксируется сразу, уведомление — до часа.</strong> Для мгновенной проверки попросите «покажи последние изменения».</p></div>
      <div><b>06</b><p><strong>Перед публикацией проверьте:</strong> клиент, канал, дату и финальный текст/медиа.</p></div>
    </div></div>
    <div class="guide-mobile-note"><b>На iPhone:</b> нижнее меню прокручивается пальцем. Проведите влево, чтобы открыть «Медиатеку», «Интеграции» и «Инструкции».</div>
  `;
}

function renderIntegrations(){
  const by=ch=>state.integrations.find(x=>x.channel===ch),ig=by('Instagram'),tg=by('Telegram');
  $('integrations').innerHTML=`
    <div class="section"><div><h2>Интеграции</h2><p>Подключения закреплены за конкретным клиентом и не смешиваются.</p></div></div>
    <div class="ints">
      <div class="int"><div style="display:flex;gap:11px;align-items:center"><div class="logo">IG</div><div><b>Instagram</b><div class="sub">${esc(ig?.metadata?.username||'не указан')}</div></div></div><span class="${ig?.enabled?'ok':'need'}">${ig?.enabled?'● подключено':'● нужно подключить'}</span></div>
      <div class="int"><div style="display:flex;gap:11px;align-items:center"><div class="logo">TG</div><div><b>Telegram</b><div class="sub">${esc(tg?.external_target||'канал не указан')}</div></div></div><span class="${tg?.enabled?'ok':'need'}">${tg?.enabled?'● бот подключён':'● нужно подключить'}</span></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="ey">TELEGRAM TARGET</div><div class="section" style="margin-top:6px"><div><h2>Канал публикации</h2><p>Укажите @channelusername или числовой chat_id.</p></div></div><div class="cols"><input class="input" id="tgTarget" value="${esc(tg?.external_target||'')}" placeholder="@channelusername или -100..."><button class="primary" onclick="saveTelegramTarget()">Сохранить</button></div></div>
    <div class="card" style="margin-top:12px">
      <div class="ey">CHATGPT SYNC</div>
      ${(()=>{
        const pending=state.syncEvents.filter(e=>e.source==='content_center'&&!e.delivered_at).length;
        const delivered=state.syncEvents.filter(e=>e.delivered_at).sort((a,b)=>new Date(b.delivered_at)-new Date(a.delivered_at))[0];
        return `<div class="section" style="margin-top:6px"><div><h2>Двусторонняя синхронизация</h2><p>Изменения из Content Center попадают в журнал и проверяются ChatGPT автоматически.</p></div><span class="${pending?'need':'ok'}">${pending?`● ждёт передачи: ${pending}`:'● синхронизация активна'}</span></div>
        <div class="sub">${delivered?`Последняя передача: ${fmtDate(delivered.delivered_at)}`:'Переданных изменений пока нет'} · автоматическая проверка — раз в час.</div>`;
      })()}
    </div>
    <div class="card" style="margin-top:12px"><div class="ey">SERVER CONNECTION</div><p class="sub">Публикация из кабинета проходит через Supabase Edge Function → Composio → соцсеть. Секреты не хранятся во фронтенде.</p><button class="ghost" onclick="copyConnectCommand()">Скопировать команду подключения</button></div>`;
}

function openDrawer(id){
  const x=itemById(id);if(!x)return;
  state.selectedId=id;
  $('dHeading').textContent=x.title;
  $('drawerBody').className='drawer-body';
  $('drawerBody').innerHTML=`
    <div class="detail-meta">${statusBadge(x)}<span class="badge">${esc(x.format)}</span><span class="badge">${esc(x.channel)}</span></div>
    <div class="form">
      <label>Заголовок<input class="input" id="dTitle" value="${esc(x.title)}"></label>
      <label>Краткое описание<textarea class="textarea compact" id="dBrief" placeholder="Что должно быть в материале">${esc(x.brief||'')}</textarea></label>
      <label>Текст / caption<textarea class="textarea" id="dCaption" placeholder="Текст публикации">${esc(x.caption||'')}</textarea></label>
      <div class="cols">
        <label>Статус<select class="input" id="dStatus">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===x.status?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Дата<input class="input" id="dDate" type="datetime-local" value="${isoLocal(x.scheduled_at)}"></label>
      </div>
      <div class="cols">
        <label>Формат<select class="input" id="dFormat">${['Reels','Stories','Carousel','Post'].map(v=>`<option ${v===x.format?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Канал<select class="input" id="dChannel">${['Instagram','Telegram'].map(v=>`<option ${v===x.channel?'selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <label>Media URL<textarea class="textarea compact" id="dMedia" placeholder="По одному URL на строку">${esc((Array.isArray(x.media_urls)?x.media_urls:[]).join('\n'))}</textarea></label>
    </div>
    <div class="detail-block"><div class="label">Публикационный ID</div><div class="sub">${esc(x.external_post_id||'Ещё не опубликовано')}</div></div>
    <div class="detail-actions">
      <button class="primary" onclick="saveDrawer()">Сохранить</button>
      ${x.status==='review'?`<button class="ghost" onclick="setStatus('${x.id}','approved')">✓ Одобрить</button>`:''}
      ${['approved','scheduled','failed'].includes(x.status)?`<button class="ghost" onclick="publishItem('${x.id}')">↗ Опубликовать</button>`:''}
      <button class="ghost" onclick="copyItemGPT('${x.id}')">✦ В ChatGPT</button>
    </div>`;
  $('contentDrawer').classList.add('on');$('drawerBackdrop').classList.add('on');
}
function closeDrawer(){$('contentDrawer').classList.remove('on');$('drawerBackdrop').classList.remove('on');state.selectedId=null}
async function saveDrawer(){
  const id=state.selectedId;if(!id)return;
  const media=$('dMedia').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const payload={
    title:$('dTitle').value.trim(),
    brief:$('dBrief').value.trim(),
    caption:$('dCaption').value.trim(),
    status:$('dStatus').value,
    format:$('dFormat').value,
    channel:$('dChannel').value,
    scheduled_at:$('dDate').value?new Date($('dDate').value).toISOString():null,
    media_urls:media
  };
  if(!payload.title)return toast('Заголовок не может быть пустым',true);
  const r=await sb.from('content_items').update(payload).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  toast('Материал сохранён');await loadClientData();openDrawer(id);
}
async function setStatus(id,status){
  const r=await sb.from('content_items').update({status}).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  toast('Статус: '+STATUS[status]);await loadClientData();
  if(state.selectedId===id)openDrawer(id);
}
async function saveTelegramTarget(){
  const tg=state.integrations.find(x=>x.channel==='Telegram');if(!tg)return toast('Telegram интеграция не создана',true);
  const target=$('tgTarget').value.trim();
  const r=await sb.from('client_integrations').update({external_target:target}).eq('id',tg.id);
  if(r.error)return toast(r.error.message,true);
  toast('Telegram target сохранён');await loadClientData();
}
async function publishItem(id){
  const x=itemById(id);if(!x)return;
  if(!confirm(`Опубликовать «${x.title}» сейчас?`))return;
  toast('Отправляю в публикацию…');
  try{
    const s=(await sb.auth.getSession()).data.session;
    const r=await fetch(SUPABASE_URL+'/functions/v1/publish-content',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+s.access_token},
      body:JSON.stringify({content_item_id:id})
    });
    const b=await r.json();if(!r.ok)throw new Error(b.error||'Ошибка публикации');
    toast('Материал опубликован');await loadClientData();if(state.selectedId===id)openDrawer(id);
  }catch(e){toast(e.message,true);await loadClientData()}
}
function previewPendingPhotos(){
  const box=$('photoPreview');if(!box)return;
  box.innerHTML=state.pendingFiles.map((f,i)=>`<div class="photo-preview"><img src="${URL.createObjectURL(f)}"><button type="button" onclick="removePendingPhoto(${i})">×</button><span>${esc(f.name)}</span></div>`).join('');
}
function addPhotoFiles(files){
  const incoming=[...files].filter(f=>f.type.startsWith('image/'));
  const merged=[...state.pendingFiles];
  incoming.forEach(f=>{if(!merged.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))merged.push(f)});
  state.pendingFiles=merged.slice(0,10).filter(f=>f.size<=15728640);
  if(incoming.some(f=>f.size>15728640))toast('Файл больше 15 МБ пропущен',true);
  previewPendingPhotos();
}
function removePendingPhoto(i){state.pendingFiles.splice(i,1);previewPendingPhotos()}
async function uploadPendingPhotos(){
  const urls=[],assets=[];
  for(const file of state.pendingFiles){
    const safe=file.name.toLowerCase().replace(/[^a-z0-9а-яё._-]+/gi,'-').replace(/^-+|-+$/g,'');
    const path=`${state.clientId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
    const up=await sb.storage.from('content-assets').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(up.error)throw up.error;
    const pub=sb.storage.from('content-assets').getPublicUrl(path);
    const url=pub.data.publicUrl;urls.push(url);
    assets.push({client_id:state.clientId,name:file.name,kind:'image',url,metadata:{storage_path:path,size:file.size,mime:file.type}});
  }
  return {urls,assets};
}
async function addContent(){
  const title=$('fTitle').value.trim();if(!title)return toast('Введите заголовок',true);
  const btn=$('saveAdd'),old=btn.textContent;btn.disabled=true;btn.textContent=state.pendingFiles.length?'Загружаю фото…':'Сохраняю…';
  try{
    const manual=$('fMedia').value.split('\\n').map(x=>x.trim()).filter(Boolean);
    const uploaded=await uploadPendingPhotos();
    const media=[...uploaded.urls,...manual];
    const scheduled=$('fDate').value?new Date($('fDate').value).toISOString():null;
    const r=await sb.from('content_items').insert({
      client_id:state.clientId,title,format:$('fFormat').value,channel:$('fChannel').value,
      status:$('fStatus').value,scheduled_at:scheduled,caption:$('fCaption').value.trim(),media_urls:media
    }).select('id').single();
    if(r.error)throw r.error;
    if(uploaded.assets.length){
      const rows=uploaded.assets.map(a=>({...a,metadata:{...a.metadata,content_item_id:r.data.id}}));
      const ar=await sb.from('assets').insert(rows);if(ar.error)console.warn(ar.error);
    }
    closeAdd();toast(media.length?`Материал добавлен · фото: ${uploaded.urls.length}`:'Материал добавлен');await loadClientData();
  }catch(e){toast(e.message||'Не удалось сохранить материал',true)}
  finally{btn.disabled=false;btn.textContent=old}
}
function closeAdd(){
  $('contentModal').classList.remove('on');
  ['fTitle','fDate','fCaption','fMedia'].forEach(id=>$(id).value='');
  if($('fPhotos'))$('fPhotos').value='';
  state.pendingFiles=[];previewPendingPhotos();
}

function openPalette(){
  $('palette').classList.add('on');$('paletteInput').value='';renderPalette('');setTimeout(()=>$('paletteInput').focus(),50);
}
function closePalette(){$('palette').classList.remove('on')}
function renderPalette(q){
  const query=q.toLowerCase().trim();
  const list=state.content.filter(x=>[x.title,x.brief,x.caption,x.format,x.channel,STATUS[x.status]].join(' ').toLowerCase().includes(query)).slice(0,12);
  $('paletteResults').innerHTML=list.map(x=>`<div class="palette-item" onclick="closePalette();openDrawer('${x.id}')"><div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${esc(x.channel)} · ${fmtDate(x.scheduled_at)}</small></div>${statusBadge(x)}</div>`).join('')||'<div class="empty">Ничего не найдено</div>';
}
function copyGPT(){
  const payload={client:currentClient(),content:state.content,integrations:state.integrations.map(x=>({channel:x.channel,enabled:x.enabled,external_account_id:x.external_account_id,external_target:x.external_target,metadata:x.metadata}))};
  navigator.clipboard.writeText('Работаем только с клиентом '+currentClient().name+'. Не смешивай данные других клиентов. Контекст: '+JSON.stringify(payload)).then(()=>toast('Контекст клиента скопирован'));
}
function copyItemGPT(id){
  const x=itemById(id);if(!x)return;
  navigator.clipboard.writeText('Работаем только с клиентом '+currentClient().name+'. Вот конкретный материал: '+JSON.stringify(x)+'. Помоги доработать его, сохраняя бренд-правила клиента: '+JSON.stringify(currentClient()?.brand_rules||{})).then(()=>toast('Материал скопирован для ChatGPT'));
}
function copyConnectCommand(){
  navigator.clipboard.writeText('Подключи в Composio отдельные Instagram и Telegram аккаунты для клиента '+currentClient().name+' и сохрани их connection IDs в Content Center. Не используй аккаунты других клиентов.').then(()=>toast('Команда скопирована'));
}

$('claimBtn').onclick=claim;
$('client').onchange=async e=>{state.clientId=e.target.value;state.selectedId=null;closeDrawer();await loadClientData();startRealtime();show(state.view)};
$('addBtn').onclick=()=>openAdd();
$('cancelAdd').onclick=closeAdd;$('cancelAdd2').onclick=closeAdd;$('saveAdd').onclick=addContent;
$('photoDrop').onclick=e=>{if(e.target.closest('.photo-preview button'))return;$('fPhotos').click()};
$('fPhotos').onchange=e=>addPhotoFiles(e.target.files);
$('photoDrop').ondragover=e=>{e.preventDefault();$('photoDrop').classList.add('drag')};
$('photoDrop').ondragleave=()=>$('photoDrop').classList.remove('drag');
$('photoDrop').ondrop=e=>{e.preventDefault();$('photoDrop').classList.remove('drag');addPhotoFiles(e.dataTransfer.files)};
$('mediaClose').onclick=closeMediaModal;$('mediaCancel').onclick=closeMediaModal;$('mediaSave').onclick=saveLibraryAssets;
$('assetDrop').onclick=e=>{if(e.target.closest('.media-pick button'))return;$('assetFiles').click()};
$('assetFiles').onchange=e=>addLibraryFiles(e.target.files);
$('assetDrop').ondragover=e=>{e.preventDefault();$('assetDrop').classList.add('drag')};
$('assetDrop').ondragleave=()=>$('assetDrop').classList.remove('drag');
$('assetDrop').ondrop=e=>{e.preventDefault();$('assetDrop').classList.remove('drag');addLibraryFiles(e.dataTransfer.files)};
$('drawerClose').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;
$('globalSearchBtn').onclick=openPalette;
$('palette').onclick=e=>{if(e.target===$('palette'))closePalette()};
$('paletteInput').oninput=e=>renderPalette(e.target.value);
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}
  if(e.key==='Escape'){closePalette();closeDrawer();closeMediaModal();$('contentModal').classList.remove('on')}
});
boot();
