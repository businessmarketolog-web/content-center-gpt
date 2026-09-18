
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


/* WORKFLOW COLLABORATION V1 */
state.comments=state.comments||[];
const DRAFT_NS='content-center-draft-v1';
const draftKeyNew=()=>DRAFT_NS+':new:'+state.clientId;
const draftKeyItem=id=>DRAFT_NS+':item:'+state.clientId+':'+id;
const safeJsonParse=v=>{try{return JSON.parse(v)}catch{return null}};
const currentAuthorLabel=()=>{const email=state.session?.user?.email||'';return email?email.split('@')[0]:'Участник'};
const dueLabel=v=>!v?'':new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const isOverdue=x=>Boolean(x?.due_at&&new Date(x.due_at)<new Date()&&x.status!=='published');

function setDraftIndicator(id,text,kind=''){const el=$(id);if(!el)return;el.textContent=text;el.className='autosave-state '+kind}
function saveNewLocalDraft(){
  if(!state.clientId||!$('contentModal')?.classList.contains('on'))return;
  localStorage.setItem(draftKeyNew(),JSON.stringify({
    title:$('fTitle')?.value||'',format:$('fFormat')?.value||'Reels',channel:$('fChannel')?.value||'Instagram',
    status:$('fStatus')?.value||'draft',date:$('fDate')?.value||'',caption:$('fCaption')?.value||'',
    media:$('fMedia')?.value||'',assignee:$('fAssignee')?.value||'',due:$('fDue')?.value||'',savedAt:new Date().toISOString()
  }));
  setDraftIndicator('newDraftState','Черновик сохранён на этом устройстве · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),'saved')
}
function restoreNewLocalDraft(){
  const d=safeJsonParse(localStorage.getItem(draftKeyNew()));if(!d)return false;
  const map={fTitle:'title',fFormat:'format',fChannel:'channel',fStatus:'status',fDate:'date',fCaption:'caption',fMedia:'media',fAssignee:'assignee',fDue:'due'};
  Object.entries(map).forEach(([id,k])=>{if($(id)&&d[k]!=null)$(id).value=d[k]});
  setDraftIndicator('newDraftState','Восстановлен локальный черновик','restored');return true
}
function clearNewLocalDraft(){if(state.clientId)localStorage.removeItem(draftKeyNew())}
function drawerDraftPayload(){
  if(!state.selectedId||!$('dTitle'))return null;
  return {title:$('dTitle').value,brief:$('dBrief').value,caption:$('dCaption').value,scheduled_at:$('dDate').value,
    format:$('dFormat').value,channel:$('dChannel').value,assignee:$('dAssignee')?.value||'',due_at:$('dDue')?.value||'',
    media:$('dMedia').value,savedAt:new Date().toISOString()}
}
function saveItemLocalDraft(id=state.selectedId){
  if(!id)return;const d=drawerDraftPayload();if(!d)return;
  localStorage.setItem(draftKeyItem(id),JSON.stringify(d));
  setDraftIndicator('drawerDraftState','Черновик сохранён локально · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),'saved')
}
function restoreItemLocalDraft(x){
  const d=safeJsonParse(localStorage.getItem(draftKeyItem(x.id)));if(!d)return false;
  if(x.updated_at&&d.savedAt&&new Date(d.savedAt)<=new Date(x.updated_at))return false;
  const map={dTitle:'title',dBrief:'brief',dCaption:'caption',dDate:'scheduled_at',dFormat:'format',dChannel:'channel',dAssignee:'assignee',dDue:'due_at',dMedia:'media'};
  Object.entries(map).forEach(([id,k])=>{if($(id)&&d[k]!=null)$(id).value=d[k]});
  setDraftIndicator('drawerDraftState','Восстановлен несохранённый черновик','restored');return true
}
function clearItemDraft(id){if(id)localStorage.removeItem(draftKeyItem(id))}
function bindDrawerAutosave(id){
  ['dTitle','dBrief','dCaption','dDate','dFormat','dChannel','dAssignee','dDue','dMedia'].forEach(fid=>{
    const el=$(fid);if(!el)return;el.addEventListener('input',()=>saveItemLocalDraft(id));el.addEventListener('change',()=>saveItemLocalDraft(id))
  })
}
function commentsFor(id){return state.comments.filter(x=>x.content_item_id===id)}
function historyFor(id){return state.syncEvents.filter(x=>x.content_item_id===id).slice(0,20)}
function historyActor(ev){
  if(ev.actor_id&&ev.actor_id===state.session?.user?.id)return 'Вы';
  if(ev.source==='backend')return 'Backend / ChatGPT';
  return ev.actor_id?'Участник':'Content Center'
}
function historySummary(ev){
  if(ev.event_type==='created')return 'Материал создан';
  if(ev.event_type==='deleted')return 'Материал удалён';
  const before=ev.payload?.before||{},after=ev.payload?.after||{};
  const labels={title:'Заголовок',format:'Формат',channel:'Канал',status:'Статус',scheduled_at:'Дата публикации',caption:'Текст',brief:'Описание',assignee:'Ответственный',due_at:'Дедлайн',media_count:'Медиа',tags:'Теги',archived_at:'Архив'};
  const changed=Object.keys(labels).filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null));
  return changed.length?changed.map(k=>labels[k]).join(' · '):'Материал обновлён'
}
function renderHistoryEvent(ev){
  return `<div class="history-event"><div><b>${esc(historySummary(ev))}</b><small>${esc(historyActor(ev))} · ${fmtDate(ev.created_at)}</small></div><span class="history-kind">${ev.event_type==='created'?'создано':'изменено'}</span></div>`
}
function renderComment(c){
  const mine=c.author_id&&c.author_id===state.session?.user?.id;
  return `<div class="comment ${mine?'mine':''}"><div class="comment-head"><b>${esc(mine?'Вы':(c.author_label||'Участник'))}</b><small>${fmtDate(c.created_at)}</small></div><p>${esc(c.body)}</p></div>`
}
async function addComment(id){
  const input=$('commentText');if(!input)return;const body=input.value.trim();if(!body)return toast('Введите комментарий',true);
  const r=await sb.from('content_comments').insert({client_id:state.clientId,content_item_id:id,author_id:state.session?.user?.id||null,author_label:currentAuthorLabel(),body});
  if(r.error)return toast(r.error.message,true);input.value='';toast('Комментарий добавлен');await loadClientData();openDrawer(id)
}

async function loadClientData(){
  const [c,i,a,n,s,cm]=await Promise.all([
    sb.from('content_items').select('*').eq('client_id',state.clientId).order('scheduled_at',{ascending:true,nullsFirst:false}),
    sb.from('client_integrations').select('*').eq('client_id',state.clientId).order('channel'),
    sb.from('assets').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}),
    sb.from('analytics_daily').select('*').eq('client_id',state.clientId).order('day',{ascending:false}).limit(30),
    sb.from('content_sync_events').select('id,content_item_id,event_type,source,actor_id,created_at,delivered_at,payload').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(120),
    sb.from('content_comments').select('*').eq('client_id',state.clientId).order('created_at',{ascending:true})
  ]);
  if(c.error)return toast(c.error.message,true);if(i.error)return toast(i.error.message,true);
  state.content=c.data||[];state.integrations=i.data||[];state.assets=a.error?[]:(a.data||[]);state.analytics=n.error?[]:(n.data||[]);
  state.syncEvents=s.error?[]:(s.data||[]);state.comments=cm.error?[]:(cm.data||[]);renderAll()
}
function startRealtime(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}
  if(!state.session||!state.clientId)return;
  realtimeChannel=sb.channel('content-center-'+state.clientId)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_items',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_sync_events',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_comments',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .subscribe()
}
function metaLine(x){
  const responsibility=[
    x.assignee?`<span class="meta-owner">👤 ${esc(x.assignee)}</span>`:'',
    x.due_at?`<span class="${isOverdue(x)?'meta-due overdue':'meta-due'}">◷ ${dueLabel(x.due_at)}</span>`:''
  ].filter(Boolean).join('<span class="meta-dot"></span>');
  return `<div class="content-meta"><span>${esc(x.format)}</span><span class="meta-dot"></span><span>${esc(x.channel)}</span><span class="meta-dot"></span><span>${fmtDate(x.scheduled_at)}</span><span class="meta-dot"></span><span>${mediaCount(x)} media</span>${responsibility?'<span class="meta-dot"></span>'+responsibility:''}</div>`
}
function openAdd(dateIso=null){
  $('contentModal').classList.add('on');restoreNewLocalDraft();
  if(dateIso){const d=new Date(dateIso);d.setHours(12,0,0,0);$('fDate').value=isoLocal(d.toISOString());saveNewLocalDraft()}
}
function closeAdd(discard=false){
  if(!discard)saveNewLocalDraft();$('contentModal').classList.remove('on');
  if(discard){clearNewLocalDraft();['fTitle','fDate','fCaption','fMedia','fAssignee','fDue'].forEach(id=>{if($(id))$(id).value=''});
    if($('fPhotos'))$('fPhotos').value='';state.pendingFiles=[];previewPendingPhotos();setDraftIndicator('newDraftState','')}
}
async function addContent(){
  const title=$('fTitle').value.trim();if(!title)return toast('Введите заголовок',true);
  const btn=$('saveAdd'),old=btn.textContent;btn.disabled=true;btn.textContent=state.pendingFiles.length?'Загружаю фото…':'Сохраняю…';
  try{
    const manual=$('fMedia').value.split('\n').map(x=>x.trim()).filter(Boolean),uploaded=await uploadPendingPhotos(),media=[...uploaded.urls,...manual];
    const scheduled=$('fDate').value?new Date($('fDate').value).toISOString():null,due=$('fDue').value?new Date($('fDue').value).toISOString():null;
    const r=await sb.from('content_items').insert({client_id:state.clientId,title,format:$('fFormat').value,channel:$('fChannel').value,
      status:$('fStatus').value,scheduled_at:scheduled,caption:$('fCaption').value.trim(),media_urls:media,
      assignee:$('fAssignee').value.trim()||null,due_at:due}).select('id').single();
    if(r.error)throw r.error;
    if(uploaded.assets.length){const rows=uploaded.assets.map(a=>({...a,metadata:{...a.metadata,content_item_id:r.data.id}}));const ar=await sb.from('assets').insert(rows);if(ar.error)console.warn(ar.error)}
    closeAdd(true);toast(media.length?`Материал добавлен · фото: ${uploaded.urls.length}`:'Материал добавлен');await loadClientData()
  }catch(e){toast(e.message||'Не удалось сохранить материал',true)}finally{btn.disabled=false;btn.textContent=old}
}

let draggedContentId=null;
function startTaskDrag(e,id){draggedContentId=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);e.currentTarget.classList.add('dragging')}
function endTaskDrag(e){e.currentTarget.classList.remove('dragging');document.querySelectorAll('.lane.drag-over').forEach(x=>x.classList.remove('drag-over'))}
function allowTaskDrop(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('drag-over')}
function leaveTaskDrop(e){if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove('drag-over')}
async function dropTask(e,status){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain')||draggedContentId;draggedContentId=null;
  const x=itemById(id);if(!x||x.status===status)return;await setStatus(id,status)
}
function renderProduction(){
  const cols=[['draft','Черновики'],['production','В работе'],['review','Согласование'],['approved','Готово']];
  $('production').innerHTML=`
    <div class="section"><div><h2>Производство</h2><p>Перетаскивайте карточки между этапами. На мобильном статус можно сменить внутри карточки.</p></div><button class="chip" onclick="openAdd()">＋ Материал</button></div>
    <div class="kanban">${cols.map(([s,n])=>{
      const items=state.content.filter(x=>x.status===s);
      return `<div class="lane" data-status="${s}" ondragover="allowTaskDrop(event)" ondragleave="leaveTaskDrop(event)" ondrop="dropTask(event,'${s}')"><div class="lane-head"><h3>${n}</h3><span class="lane-count">${items.length}</span></div>
        ${items.map(x=>`<div class="task" draggable="true" ondragstart="startTaskDrag(event,'${x.id}')" ondragend="endTaskDrag(event)" onclick="openDrawer('${x.id}')"><b>${esc(x.title)}</b><p>${esc(x.format)} · ${esc(x.channel)} · ${fmtDate(x.scheduled_at)}</p>${x.assignee||x.due_at?`<div class="task-responsibility">${x.assignee?`<span>👤 ${esc(x.assignee)}</span>`:''}${x.due_at?`<span class="${isOverdue(x)?'overdue':''}">◷ ${dueLabel(x.due_at)}</span>`:''}</div>`:''}</div>`).join('')||'<div class="empty">Пусто</div>'}
      </div>`;
    }).join('')}</div>`
}
function openDrawer(id){
  const x=itemById(id);if(!x)return;state.selectedId=id;const comments=commentsFor(id),history=historyFor(id);$('dHeading').textContent=x.title;$('drawerBody').className='drawer-body';
  $('drawerBody').innerHTML=`
    <div class="detail-meta">${statusBadge(x)}<span class="badge">${esc(x.format)}</span><span class="badge">${esc(x.channel)}</span>${x.assignee?`<span class="badge">👤 ${esc(x.assignee)}</span>`:''}${x.due_at?`<span class="badge ${isOverdue(x)?'due-overdue':''}">◷ ${dueLabel(x.due_at)}</span>`:''}</div>
    <div class="form">
      <label>Заголовок<input class="input" id="dTitle" value="${esc(x.title)}"></label>
      <label>Краткое описание<textarea class="textarea compact" id="dBrief" placeholder="Что должно быть в материале">${esc(x.brief||'')}</textarea></label>
      <label>Текст / caption<textarea class="textarea" id="dCaption" placeholder="Текст публикации">${esc(x.caption||'')}</textarea></label>
      <div class="cols"><label>Статус<select class="input" id="dStatus">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===x.status?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Дата публикации<input class="input" id="dDate" type="datetime-local" value="${isoLocal(x.scheduled_at)}"></label></div>
      <div class="cols"><label>Ответственный<input class="input" id="dAssignee" placeholder="Например: Наташа" value="${esc(x.assignee||'')}"></label>
        <label>Дедлайн подготовки<input class="input" id="dDue" type="datetime-local" value="${isoLocal(x.due_at)}"></label></div>
      <div class="cols"><label>Формат<select class="input" id="dFormat">${['Reels','Stories','Carousel','Post'].map(v=>`<option ${v===x.format?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Канал<select class="input" id="dChannel">${['Instagram','Telegram'].map(v=>`<option ${v===x.channel?'selected':''}>${v}</option>`).join('')}</select></label></div>
      <label>Media URL<textarea class="textarea compact" id="dMedia" placeholder="По одному URL на строку">${esc((Array.isArray(x.media_urls)?x.media_urls:[]).join('\n'))}</textarea></label>
    </div>
    <div class="autosave-state" id="drawerDraftState">Изменения автоматически сохраняются локально до нажатия «Сохранить».</div>
    <div class="detail-block"><div class="label">Публикационный ID</div><div class="sub">${esc(x.external_post_id||'Ещё не опубликовано')}</div></div>
    <div class="detail-actions"><button class="primary" onclick="saveDrawer()">Сохранить</button>
      ${x.status==='review'?`<button class="ghost" onclick="setStatus('${x.id}','approved')">✓ Одобрить</button>`:''}
      ${['approved','scheduled','failed'].includes(x.status)?`<button class="ghost" onclick="publishItem('${x.id}')">↗ Опубликовать</button>`:''}
      <button class="ghost" onclick="copyItemGPT('${x.id}')">✦ В ChatGPT</button></div>
    <section class="collab-section"><div class="collab-head"><div><div class="ey">COMMENTS</div><h3>Комментарии</h3></div><span class="badge">${comments.length}</span></div>
      <div class="comment-list">${comments.map(renderComment).join('')||'<div class="collab-empty">Комментариев пока нет</div>'}</div>
      <div class="comment-compose"><textarea class="textarea compact" id="commentText" placeholder="Напишите правку или комментарий…"></textarea><button class="primary" onclick="addComment('${id}')">Отправить</button></div></section>
    <details class="history-section"><summary><span><b>История изменений</b><small>${history.length} последних событий</small></span><span>＋</span></summary>
      <div class="history-list">${history.map(renderHistoryEvent).join('')||'<div class="collab-empty">История появится после изменений материала</div>'}</div></details>`;
  $('contentDrawer').classList.add('on');$('drawerBackdrop').classList.add('on');const restored=restoreItemLocalDraft(x);bindDrawerAutosave(id);
  if(!restored)setDraftIndicator('drawerDraftState','Изменения автоматически сохраняются локально до нажатия «Сохранить».')
}
function closeDrawer(){if(state.selectedId)saveItemLocalDraft(state.selectedId);$('contentDrawer').classList.remove('on');$('drawerBackdrop').classList.remove('on');state.selectedId=null}
async function saveDrawer(){
  const id=state.selectedId;if(!id)return;const media=$('dMedia').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const payload={title:$('dTitle').value.trim(),brief:$('dBrief').value.trim(),caption:$('dCaption').value.trim(),status:$('dStatus').value,
    format:$('dFormat').value,channel:$('dChannel').value,scheduled_at:$('dDate').value?new Date($('dDate').value).toISOString():null,
    assignee:$('dAssignee').value.trim()||null,due_at:$('dDue').value?new Date($('dDue').value).toISOString():null,media_urls:media};
  if(!payload.title)return toast('Заголовок не может быть пустым',true);const r=await sb.from('content_items').update(payload).eq('id',id);
  if(r.error)return toast(r.error.message,true);clearItemDraft(id);toast('Материал сохранён');await loadClientData();openDrawer(id)
}

if($('cancelAdd'))$('cancelAdd').onclick=()=>closeAdd(false);
if($('cancelAdd2'))$('cancelAdd2').onclick=()=>closeAdd(true);
['fTitle','fFormat','fChannel','fStatus','fDate','fCaption','fMedia','fAssignee','fDue'].forEach(id=>{
  if($(id)){$(id).addEventListener('input',saveNewLocalDraft);$(id).addEventListener('change',saveNewLocalDraft)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('contentModal')?.classList.contains('on'))saveNewLocalDraft()},true);



/* NEW CONTENT DRAFT RESTORE FOR ALL ENTRY POINTS */
if($('contentModal')){
  const draftModalObserver=new MutationObserver(()=>{
    if($('contentModal').classList.contains('on'))restoreNewLocalDraft()
  });
  draftModalObserver.observe($('contentModal'),{attributes:true,attributeFilter:['class']})
}



/* PRODUCTIVITY PACKAGE V2 */
state.templates=state.templates||[];
state.publishQueue=state.publishQueue||[];

function ensurePackage2Shell(){
  const actions=document.querySelector('.actions');
  if(actions&&!$('notifBtn')){
    const b=document.createElement('button');b.id='notifBtn';b.className='icon-btn notif-btn';b.title='Уведомления';
    b.innerHTML='🔔<span id="notifCount" class="notif-count">0</span>';b.onclick=openNotifications;
    const logout=$('logoutBtn');actions.insertBefore(b,logout||null)
  }
  if(!$('p2Modal')){
    document.body.insertAdjacentHTML('beforeend',`
      <div class="p2-modal" id="p2Modal">
        <div class="p2-dialog">
          <div class="p2-head"><button class="mobile-back" type="button" onclick="closeP2Modal()">‹ <span>Назад</span></button><div><div class="ey" id="p2Ey">WORKSPACE</div><h2 id="p2Title">Действие</h2></div><button class="xbtn" onclick="closeP2Modal()">×</button></div>
          <div class="p2-body" id="p2Body"></div>
        </div>
      </div>`)
  }
  ensureTemplateControls();updateNotifBadge()
}
function openP2Modal(title,ey,body){
  ensurePackage2Shell();$('p2Title').textContent=title;$('p2Ey').textContent=ey||'WORKSPACE';$('p2Body').innerHTML=body;$('p2Modal').classList.add('on')
}
function closeP2Modal(){$('p2Modal')?.classList.remove('on')}
function builtInTemplates(){
  return [
    {id:'builtin:hotel',name:'Reels · обзор отеля',format:'Reels',channel:'Instagram',title:'Обзор отеля',brief:'Короткий динамичный обзор: территория, номера, пляж, питание, кому подойдёт.',caption:'Хук → 3–5 сильных сторон → кому подойдёт → мягкий CTA.'},
    {id:'builtin:review',name:'Stories · отзыв клиента',format:'Stories',channel:'Instagram',title:'Отзыв клиента',brief:'Доверие: маршрут/задача клиента → детали поездки → эмоция/отзыв → CTA.',caption:'История клиента в 3–4 сторис. Без перегруза, с акцентом на реальный опыт.'},
    {id:'builtin:carousel',name:'Карусель · подборка',format:'Carousel',channel:'Instagram',title:'Подборка вариантов',brief:'Обложка → 3–5 вариантов → сравнение → вывод → CTA.',caption:'Короткий вводный текст, польза подборки и призыв сохранить.'},
    {id:'builtin:telegram',name:'Telegram · полезный пост',format:'Post',channel:'Telegram',title:'Полезный пост',brief:'Факт/новость → что это значит → кому важно → действие.',caption:'Заголовок\n\nКороткое объяснение без воды.\n\nЧто делать дальше / CTA.'}
  ]
}
function allTemplates(){return [...builtInTemplates(),...(state.templates||[])]}
function ensureTemplateControls(){
  const form=$('contentModal')?.querySelector('.form');if(!form||$('templateTools'))return;
  const box=document.createElement('div');box.id='templateTools';box.className='template-tools';
  box.innerHTML='<label>Шаблон<select class="input" id="fTemplate"><option value="">Без шаблона</option></select></label><button class="ghost" type="button" onclick="applyTemplateChoice()">Применить</button>';
  form.insertBefore(box,form.firstChild);refreshTemplateSelect()
}
function refreshTemplateSelect(){
  const sel=$('fTemplate');if(!sel)return;
  const val=sel.value;sel.innerHTML='<option value="">Без шаблона</option>'+allTemplates().map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');
  if([...sel.options].some(o=>o.value===val))sel.value=val
}
function applyTemplateChoice(){
  const id=$('fTemplate')?.value;if(!id)return;
  const t=allTemplates().find(x=>x.id===id);if(!t)return;
  $('fFormat').value=t.format||'Reels';$('fChannel').value=t.channel||'Instagram';
  if(t.title)$('fTitle').value=t.title;if(t.caption)$('fCaption').value=t.caption;
  if(Array.isArray(t.media_urls)&&t.media_urls.length)$('fMedia').value=t.media_urls.join('\n');
  saveNewLocalDraft();toast('Шаблон применён')
}
async function saveAsTemplate(id){
  const x=itemById(id);if(!x)return;const name=prompt('Название шаблона',x.title);if(!name?.trim())return;
  const r=await sb.from('content_templates').insert({client_id:state.clientId,name:name.trim(),format:x.format,channel:x.channel,title:x.title,brief:x.brief,caption:x.caption,media_urls:x.media_urls||[]});
  if(r.error)return toast(r.error.message,true);toast('Шаблон сохранён');await loadClientData();openDrawer(id)
}
async function duplicateItem(id){
  const x=itemById(id);if(!x)return;
  const r=await sb.from('content_items').insert({client_id:state.clientId,title:x.title+' — копия',format:x.format,channel:x.channel,status:'draft',
    scheduled_at:null,caption:x.caption,brief:x.brief,media_urls:x.media_urls||[],assignee:x.assignee||null,due_at:null}).select('id').single();
  if(r.error)return toast(r.error.message,true);toast('Создана копия материала');await loadClientData();openDrawer(r.data.id)
}

function buildNotifications(){
  const out=[],now=new Date(),day=86400000;
  state.content.forEach(x=>{
    if(isOverdue(x))out.push({kind:'danger',id:x.id,title:'Просрочен дедлайн',text:x.title+' · '+dueLabel(x.due_at)});
    if(x.status==='review')out.push({kind:'review',id:x.id,title:'Ждёт согласования',text:x.title});
    if(['review','approved','scheduled'].includes(x.status)&&mediaCount(x)===0)out.push({kind:'warn',id:x.id,title:'Нет медиа',text:x.title});
    if(x.scheduled_at&&['approved','scheduled'].includes(x.status)){
      const dt=new Date(x.scheduled_at)-now;if(dt>=0&&dt<=day)out.push({kind:'info',id:x.id,title:'Публикация в ближайшие 24 часа',text:x.title+' · '+fmtDate(x.scheduled_at)})
    }
    if(x.status==='failed')out.push({kind:'danger',id:x.id,title:'Ошибка публикации',text:x.title})
  });
  (state.publishQueue||[]).filter(q=>q.status==='failed').forEach(q=>{
    const x=itemById(q.content_item_id);out.push({kind:'danger',id:q.content_item_id,title:'Сбой в очереди публикации',text:(x?.title||'Материал')+(q.error?' · '+q.error:'')})
  });
  const seen=new Set();return out.filter(n=>{const k=n.title+'|'+n.id;if(seen.has(k))return false;seen.add(k);return true})
}
function updateNotifBadge(){
  const n=buildNotifications().length,c=$('notifCount');if(c){c.textContent=n>99?'99+':String(n);c.classList.toggle('zero',n===0)}
}
function openNotifications(){
  const list=buildNotifications();
  openP2Modal('Уведомления','ACTION CENTER',list.length?'<div class="notification-list">'+list.map(n=>`<button class="notification-item ${n.kind}" onclick="closeP2Modal();openDrawer('${n.id}')"><span class="notification-dot"></span><div><b>${esc(n.title)}</b><small>${esc(n.text)}</small></div><i>›</i></button>`).join('')+'</div>':'<div class="feature-empty"><b>Всё спокойно</b><span>Нет просроченных задач, ошибок и материалов, требующих внимания.</span></div>')
}

let calendarDraggedId=null,calendarHoldTimer=null;
function startCalendarDrag(e,id){calendarDraggedId=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id)}
function allowCalendarDrop(e){e.preventDefault();e.currentTarget.classList.add('calendar-drop')}
function leaveCalendarDrop(e){e.currentTarget.classList.remove('calendar-drop')}
async function dropCalendarDay(e,dateIso){
  e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('calendar-drop');
  const id=e.dataTransfer.getData('text/plain')||calendarDraggedId;calendarDraggedId=null;if(!id)return;
  await moveContentToDate(id,dateIso)
}
async function moveContentToDate(id,dateIso){
  const x=itemById(id);if(!x)return;
  const target=new Date(dateIso),old=x.scheduled_at?new Date(x.scheduled_at):null;
  target.setHours(old?old.getHours():12,old?old.getMinutes():0,0,0);
  const r=await sb.from('content_items').update({scheduled_at:target.toISOString()}).eq('id',id);
  if(r.error)return toast(r.error.message,true);toast('Дата перенесена: '+fmtDate(target));await loadClientData();renderCalendar()
}
function calendarPointerDown(e,id){
  if(!window.matchMedia('(max-width:520px)').matches)return;const el=e.currentTarget;clearTimeout(calendarHoldTimer);
  calendarHoldTimer=setTimeout(()=>{el.dataset.held='1';openMoveDate(id)},650)
}
function calendarPointerEnd(){clearTimeout(calendarHoldTimer)}
function calendarItemClick(e,id){
  e.stopPropagation();const el=e.currentTarget;if(el.dataset.held==='1'){delete el.dataset.held;return}openDrawer(id)
}
function openMoveDate(id){
  const x=itemById(id);if(!x)return;const value=x.scheduled_at?new Date(x.scheduled_at).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  openP2Modal('Перенести публикацию','CALENDAR',`<div class="feature-form"><p>${esc(x.title)}</p><label>Новая дата<input class="input" id="moveDateInput" type="date" value="${value}"></label><button class="primary" onclick="confirmMoveDate('${id}')">Перенести</button></div>`)
}
async function confirmMoveDate(id){const v=$('moveDateInput')?.value;if(!v)return toast('Выберите дату',true);closeP2Modal();await moveContentToDate(id,new Date(v+'T12:00:00').toISOString())}
function renderCalendar(){
  const cursor=state.calendarCursor,cells=monthCells(cursor),today=new Date(),month=cursor.getMonth(),year=cursor.getFullYear();
  const channelItems=state.content.filter(x=>state.calendarChannel==='all'||x.channel===state.calendarChannel);
  const selected=state.calendarSelected?new Date(state.calendarSelected):today;
  const selectedItems=channelItems.filter(x=>x.scheduled_at&&sameDay(x.scheduled_at,selected));
  $('calendar').innerHTML=`
    <div class="calendar-head"><div><div class="ey">CONTENT CALENDAR</div><h2>${new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(cursor)}</h2></div>
      <div class="calendar-controls"><button class="chip" onclick="shiftCalendar(-1)">←</button><button class="chip" onclick="calendarToday()">Сегодня</button><button class="chip" onclick="shiftCalendar(1)">→</button></div></div>
    <div class="calendar-legend"><button class="legend-filter ${state.calendarChannel==='all'?'on':''}" onclick="setCalendarChannel('all')"><span class="legend-both"><i class="channel-dot instagram"></i><i class="channel-dot telegram"></i></span>Все каналы</button>
      <button class="legend-filter ${state.calendarChannel==='Instagram'?'on':''}" onclick="setCalendarChannel('Instagram')"><i class="channel-dot instagram"></i>Instagram</button>
      <button class="legend-filter ${state.calendarChannel==='Telegram'?'on':''}" onclick="setCalendarChannel('Telegram')"><i class="channel-dot telegram"></i>Telegram</button><span class="legend-note">На web перетащите публикацию на другую дату</span></div>
    <div class="month-calendar">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<div class="month-weekday">${x}</div>`).join('')}
      ${cells.map(d=>{const items=channelItems.filter(x=>x.scheduled_at&&sameDay(x.scheduled_at,d)),outside=d.getMonth()!==month,isToday=sameDay(today,d),isSelected=sameDay(selected,d);
        return `<div class="month-day ${outside?'outside':''} ${isToday?'today':''} ${isSelected?'selected':''}" onclick="selectCalendarDay('${d.toISOString()}')" ondragover="allowCalendarDrop(event)" ondragleave="leaveCalendarDrop(event)" ondrop="dropCalendarDay(event,'${d.toISOString()}')">
          <div class="month-day-head"><b>${d.getDate()}</b>${isToday?'<span>сегодня</span>':''}<button title="Добавить материал" onclick="event.stopPropagation();openAdd('${d.toISOString()}')">＋</button></div>
          <div class="month-posts">${items.slice(0,2).map(x=>`<button class="month-post" draggable="true" ondragstart="startCalendarDrag(event,'${x.id}')" onpointerdown="calendarPointerDown(event,'${x.id}')" onpointerup="calendarPointerEnd(event)" onpointercancel="calendarPointerEnd(event)" onclick="calendarItemClick(event,'${x.id}')">${channelDot(x.channel)}<span>${esc(x.title)}</span></button>`).join('')}${items.length>2?`<small>+ ещё ${items.length-2}</small>`:''}</div></div>`}).join('')}</div>
    <div class="selected-day-panel card"><div class="selected-day-head"><div><div class="ey">ВЫБРАННЫЙ ДЕНЬ</div><h3>${new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(selected)}</h3></div><button class="primary" onclick="openAdd('${selected.toISOString()}')">＋ Материал</button></div>
      <div class="selected-day-list">${selectedItems.length?selectedItems.map(x=>`<div class="selected-day-item" onpointerdown="calendarPointerDown(event,'${x.id}')" onpointerup="calendarPointerEnd(event)" onclick="calendarItemClick(event,'${x.id}')">${channelDot(x.channel)}<div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${STATUS[x.status]} · ${fmtDate(x.scheduled_at)}</small></div><button class="move-date-btn" onclick="event.stopPropagation();openMoveDate('${x.id}')">Перенести</button></div>`).join(''):'<div class="empty compact-empty">На этот день публикаций нет.</div>'}</div></div>
    <div class="section"><div><h2>Материалы месяца</h2><p>Открывайте карточку для редактирования и согласования.</p></div><button class="chip" onclick="openPalette()">⌕ Поиск</button></div>
    <div class="content-list">${channelItems.filter(x=>x.scheduled_at&&new Date(x.scheduled_at).getMonth()===month&&new Date(x.scheduled_at).getFullYear()===year).map(x=>contentCard(x)).join('')||'<div class="card empty">В этом месяце пока нет материалов</div>'}</div>`
}

function queueStatus(q){return {queued:'В очереди',processing:'Отправляется',published:'Опубликовано',failed:'Ошибка',cancelled:'Отменено'}[q.status]||q.status}
async function publishItem(id){
  const x=itemById(id);if(!x)return;if(!confirm(`Опубликовать «${x.title}» сейчас?`))return;toast('Отправляю в публикацию…');
  try{
    const s=(await sb.auth.getSession()).data.session;
    const r=await fetch(SUPABASE_URL+'/functions/v1/publish-content',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+s.access_token},body:JSON.stringify({content_item_id:id})});
    const b=await r.json();if(!r.ok)throw new Error(b.error||'Ошибка публикации');toast('Материал опубликован');await loadClientData();if(state.selectedId===id)openDrawer(id)
  }catch(e){toast(e.message||'Ошибка публикации',true);await loadClientData()}
}
async function retryPublish(contentId){const x=itemById(contentId);if(!x)return;await publishItem(contentId)}
function renderPublishing(){
  const list=state.content.filter(x=>['approved','scheduled','failed','published'].includes(x.status)),queue=(state.publishQueue||[]).slice(0,30);
  $('publishing').innerHTML=`
    <div class="section"><div><h2>Публикации</h2><p>Готовый контент и технический журнал отправки в соцсети.</p></div><span class="badge">${list.filter(x=>x.status!=='published').length} в очереди</span></div>
    <div class="content-list">${list.map(x=>`<div class="content-card"><div class="content-card-head" onclick="openDrawer('${x.id}')"><div><div class="content-title">${esc(x.title)}</div>${metaLine(x)}</div><div class="content-card-actions">${statusBadge(x)}${['approved','scheduled','failed'].includes(x.status)?`<button class="mini-btn accent" onclick="event.stopPropagation();publishItem('${x.id}')">${x.status==='failed'?'Повторить':'Опубликовать'}</button>`:''}</div></div></div>`).join('')||'<div class="card empty">Нет материалов для публикации</div>'}</div>
    <div class="section"><div><h2>Журнал публикаций</h2><p>Последние попытки отправки через Supabase → Composio → соцсеть.</p></div><span class="badge">${queue.length}</span></div>
    <div class="publish-log">${queue.length?queue.map(q=>{const x=itemById(q.content_item_id);return `<div class="publish-log-row ${q.status}"><div><b>${esc(x?.title||'Материал')}</b><small>${esc(q.channel||x?.channel||'')} · ${fmtDate(q.requested_at)}</small></div><div class="publish-log-result"><span>${esc(queueStatus(q))}</span>${q.error?`<small title="${esc(q.error)}">${esc(q.error)}</small>`:''}</div>${q.status==='failed'?`<button class="mini-btn accent" onclick="retryPublish('${q.content_item_id}')">↻ Retry</button>`:''}</div>`}).join(''):'<div class="card empty">Журнал пока пуст.</div>'}</div>`
}

const AI_ACTIONS={
 improve:'Улучши текст: сделай его яснее, сильнее и естественнее, сохрани факты и тон бренда.',
 shorter:'Сократи текст примерно на 30–40%, сохрани ключевой смысл и CTA.',
 cta:'Предложи 5 небанальных CTA без давления и навязчивой продажи.',
 telegram:'Адаптируй этот материал для Telegram: сделай структуру удобной для чтения и не копируй Instagram-механику буквально.',
 hashtags:'Подбери релевантные хештеги. Не используй спамные и слишком общие теги.',
 stories:'На основе материала создай сценарий из 3–4 Stories: хук, раскрытие, доказательство/деталь, CTA.'
};
function aiPromptFor(id,action){
  const x=itemById(id),instruction=AI_ACTIONS[action];if(!x||!instruction)return '';
  return `Работаем только с клиентом ${currentClient()?.name}. Не смешивай данные других клиентов.\nЗадача: ${instruction}\nБренд-правила: ${JSON.stringify(currentClient()?.brand_rules||{})}\nМатериал: ${JSON.stringify({title:x.title,brief:x.brief,caption:x.caption,format:x.format,channel:x.channel})}\nВерни только готовый вариант и коротко перечисли, что изменил.`
}
function runAiAction(id,action){
  const p=aiPromptFor(id,action);if(!p)return;navigator.clipboard.writeText(p).then(()=>toast('AI-команда скопирована — вставьте её в ChatGPT')).catch(()=>toast('Не удалось скопировать команду',true))
}
function augmentDrawerP2(id){
  const x=itemById(id);if(!x)return;
  const actions=$('drawerBody')?.querySelector('.detail-actions');
  if(actions&&!actions.querySelector('.p2-duplicate')){
    actions.insertAdjacentHTML('beforeend',`<button class="ghost p2-duplicate" onclick="duplicateItem('${id}')">⧉ Дублировать</button><button class="ghost" onclick="saveAsTemplate('${id}')">▧ В шаблоны</button>`)
  }
  const comments=$('drawerBody')?.querySelector('.collab-section');
  if(comments&&!$('aiBlock')){
    comments.insertAdjacentHTML('beforebegin',`<section class="ai-block" id="aiBlock"><div class="collab-head"><div><div class="ey">AI ASSISTANT</div><h3>Помощник по материалу</h3></div><span class="badge">ChatGPT</span></div><div class="ai-actions">
      <button onclick="runAiAction('${id}','improve')">Улучшить текст</button><button onclick="runAiAction('${id}','shorter')">Сократить</button><button onclick="runAiAction('${id}','cta')">CTA</button><button onclick="runAiAction('${id}','telegram')">Версия для Telegram</button><button onclick="runAiAction('${id}','hashtags')">Хештеги</button><button onclick="runAiAction('${id}','stories')">Stories</button></div><p>Команда учитывает выбранного клиента и его бренд-правила. Результат не перезаписывает исходник автоматически.</p></section>`)
  }
}
const __p2OpenDrawerBase=openDrawer;
openDrawer=function(id){__p2OpenDrawerBase(id);augmentDrawerP2(id)};

function renderHistoryEvent(ev){
  const canRestore=ev.event_type==='updated'&&ev.payload?.before;
  return `<div class="history-event"><div><b>${esc(historySummary(ev))}</b><small>${esc(historyActor(ev))} · ${fmtDate(ev.created_at)}</small></div><div class="history-actions"><span class="history-kind">${ev.event_type==='created'?'создано':'изменено'}</span>${canRestore?`<button class="mini-btn" onclick="restoreHistoryVersion('${ev.id}')">↶ Восстановить</button>`:''}</div></div>`
}
async function restoreHistoryVersion(eventId){
  const ev=state.syncEvents.find(x=>x.id===eventId),b=ev?.payload?.before;if(!ev||!b)return toast('Эта версия недоступна для восстановления',true);
  const x=itemById(ev.content_item_id);if(!x)return;
  if(!confirm('Восстановить состояние материала до этого изменения? Текущее состояние останется в истории.'))return;
  const payload={};
  ['title','format','channel','status','scheduled_at','caption','brief','assignee','due_at','tags'].forEach(k=>{if(Object.prototype.hasOwnProperty.call(b,k))payload[k]=b[k]});
  if(Array.isArray(b.media_urls))payload.media_urls=b.media_urls;
  const r=await sb.from('content_items').update(payload).eq('id',x.id);if(r.error)return toast(r.error.message,true);
  clearItemDraft(x.id);toast('Предыдущая версия восстановлена');await loadClientData();openDrawer(x.id)
}

async function loadClientData(){
  const [c,i,a,n,s,cm,pq,tp]=await Promise.all([
    sb.from('content_items').select('*').eq('client_id',state.clientId).order('scheduled_at',{ascending:true,nullsFirst:false}),
    sb.from('client_integrations').select('*').eq('client_id',state.clientId).order('channel'),
    sb.from('assets').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}),
    sb.from('analytics_daily').select('*').eq('client_id',state.clientId).order('day',{ascending:false}).limit(30),
    sb.from('content_sync_events').select('id,content_item_id,event_type,source,actor_id,created_at,delivered_at,payload').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(160),
    sb.from('content_comments').select('*').eq('client_id',state.clientId).order('created_at',{ascending:true}),
    sb.from('publish_queue').select('*').eq('client_id',state.clientId).order('requested_at',{ascending:false}).limit(50),
    sb.from('content_templates').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false})
  ]);
  if(c.error)return toast(c.error.message,true);if(i.error)return toast(i.error.message,true);
  state.content=c.data||[];state.integrations=i.data||[];state.assets=a.error?[]:(a.data||[]);state.analytics=n.error?[]:(n.data||[]);
  state.syncEvents=s.error?[]:(s.data||[]);state.comments=cm.error?[]:(cm.data||[]);state.publishQueue=pq.error?[]:(pq.data||[]);state.templates=tp.error?[]:(tp.data||[]);
  renderAll();ensurePackage2Shell();refreshTemplateSelect();updateNotifBadge()
}
function startRealtime(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}if(!state.session||!state.clientId)return;
  realtimeChannel=sb.channel('content-center-'+state.clientId)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_items',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_sync_events',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_comments',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'publish_queue',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_templates',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .subscribe()
}
ensurePackage2Shell();



/* OPERATIONS PACKAGE V3 */
state.archivedContent=state.archivedContent||[];
state.contentLinks=state.contentLinks||[];
state.savedViews=state.savedViews||[];
state.recurringRules=state.recurringRules||[];

function tagsArray(v){
  if(Array.isArray(v))return v.filter(Boolean);
  return String(v||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,12)
}
function tagHtml(x){return (x.tags||[]).slice(0,3).map(t=>`<span class="content-tag">#${esc(t)}</span>`).join('')}
function readinessIssues(x){
  if(!x)return ['Материал не найден'];
  const issues=[];
  if(!String(x.title||'').trim())issues.push('Нет заголовка');
  if(!String(x.caption||x.brief||'').trim())issues.push('Нет текста или описания');
  if(!x.channel)issues.push('Не выбран канал');
  if(!x.format)issues.push('Не выбран формат');
  if(!x.scheduled_at)issues.push('Не назначена дата публикации');
  if(x.channel==='Instagram'&&mediaCount(x)===0)issues.push('Не добавлено медиа');
  return issues
}
function readinessWarnings(x){
  const w=[];
  if(!x.assignee)w.push('Не назначен ответственный');
  if(!x.due_at)w.push('Не указан дедлайн подготовки');
  return w
}
function readinessBlock(id,action='готовности'){
  const x=state.content.find(v=>v.id===id);if(!x)return false;
  const issues=readinessIssues(x);if(!issues.length)return false;
  openP2Modal('Материал не готов','READINESS CHECK',`<div class="readiness-card"><p>Перед ${esc(action)} нужно закрыть обязательные пункты:</p><div class="readiness-list">${issues.map(i=>`<div>✕ ${esc(i)}</div>`).join('')}</div><button class="primary" onclick="closeP2Modal();openDrawer('${id}')">Открыть материал</button></div>`);
  return true
}
async function setStatus(id,status){
  if(['approved','scheduled','published'].includes(status)&&readinessBlock(id,'переводом в «'+(STATUS[status]||status)+'»'))return;
  const r=await sb.from('content_items').update({status}).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  toast('Статус: '+STATUS[status]);await loadClientData();
  if(state.selectedId===id)openDrawer(id)
}
const __p3PublishBase=publishItem;
publishItem=async function(id){
  if(readinessBlock(id,'публикацией'))return;
  return __p3PublishBase(id)
};

function metaLine(x){
  const responsibility=[
    x.assignee?`<span class="meta-owner">👤 ${esc(x.assignee)}</span>`:'',
    x.due_at?`<span class="${isOverdue(x)?'meta-due overdue':'meta-due'}">◷ ${dueLabel(x.due_at)}</span>`:''
  ].filter(Boolean).join('<span class="meta-dot"></span>');
  const tags=tagHtml(x);
  return `<div class="content-meta"><span>${esc(x.format)}</span><span class="meta-dot"></span><span>${esc(x.channel)}</span><span class="meta-dot"></span><span>${fmtDate(x.scheduled_at)}</span><span class="meta-dot"></span><span>${mediaCount(x)} media</span>${responsibility?'<span class="meta-dot"></span>'+responsibility:''}${tags?'<span class="meta-tags">'+tags+'</span>':''}</div>`
}

function drawerDraftPayload(){
  if(!state.selectedId||!$('dTitle'))return null;
  return {title:$('dTitle').value,brief:$('dBrief').value,caption:$('dCaption').value,scheduled_at:$('dDate').value,
    format:$('dFormat').value,channel:$('dChannel').value,assignee:$('dAssignee')?.value||'',due_at:$('dDue')?.value||'',
    media:$('dMedia').value,tags:$('dTags')?.value||'',savedAt:new Date().toISOString()}
}
function restoreItemLocalDraft(x){
  const d=safeJsonParse(localStorage.getItem(draftKeyItem(x.id)));if(!d)return false;
  if(x.updated_at&&d.savedAt&&new Date(d.savedAt)<=new Date(x.updated_at))return false;
  const map={dTitle:'title',dBrief:'brief',dCaption:'caption',dDate:'scheduled_at',dFormat:'format',dChannel:'channel',dAssignee:'assignee',dDue:'due_at',dMedia:'media',dTags:'tags'};
  Object.entries(map).forEach(([id,k])=>{if($(id)&&d[k]!=null)$(id).value=d[k]});
  setDraftIndicator('drawerDraftState','Восстановлен несохранённый черновик','restored');return true
}
function bindDrawerAutosave(id){
  ['dTitle','dBrief','dCaption','dDate','dFormat','dChannel','dAssignee','dDue','dMedia','dTags'].forEach(fid=>{
    const el=$(fid);if(!el)return;el.addEventListener('input',()=>saveItemLocalDraft(id));el.addEventListener('change',()=>saveItemLocalDraft(id))
  })
}
async function saveDrawer(){
  const id=state.selectedId;if(!id)return;const media=$('dMedia').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const payload={title:$('dTitle').value.trim(),brief:$('dBrief').value.trim(),caption:$('dCaption').value.trim(),status:$('dStatus').value,
    format:$('dFormat').value,channel:$('dChannel').value,scheduled_at:$('dDate').value?new Date($('dDate').value).toISOString():null,
    assignee:$('dAssignee').value.trim()||null,due_at:$('dDue').value?new Date($('dDue').value).toISOString():null,
    media_urls:media,tags:tagsArray($('dTags')?.value)};
  if(!payload.title)return toast('Заголовок не может быть пустым',true);
  if(['approved','scheduled'].includes(payload.status)){
    const preview={...itemById(id),...payload};const issues=readinessIssues(preview);
    if(issues.length){openP2Modal('Материал не готов','READINESS CHECK',`<div class="readiness-card"><p>Статус не изменён. Заполните обязательные поля:</p><div class="readiness-list">${issues.map(i=>`<div>✕ ${esc(i)}</div>`).join('')}</div></div>`);return}
  }
  const r=await sb.from('content_items').update(payload).eq('id',id);
  if(r.error)return toast(r.error.message,true);clearItemDraft(id);toast('Материал сохранён');await loadClientData();openDrawer(id)
}

function linksFor(id){return state.contentLinks.filter(l=>l.from_content_id===id||l.to_content_id===id)}
function linkedOther(link,id){const oid=link.from_content_id===id?link.to_content_id:link.from_content_id;return state.content.find(x=>x.id===oid)||state.archivedContent.find(x=>x.id===oid)}
async function addContentLink(id){
  const target=$('linkTarget')?.value,relation=$('linkRelation')?.value||'sequence';if(!target)return toast('Выберите связанный материал',true);
  const r=await sb.from('content_links').insert({client_id:state.clientId,from_content_id:id,to_content_id:target,relation_type:relation});
  if(r.error)return toast(r.error.message.includes('duplicate')?'Такая связь уже существует':r.error.message,true);
  toast('Материалы связаны');await loadClientData();openDrawer(id)
}
async function removeContentLink(linkId,id){
  const r=await sb.from('content_links').delete().eq('id',linkId);if(r.error)return toast(r.error.message,true);
  toast('Связь удалена');await loadClientData();openDrawer(id)
}
async function archiveItem(id){
  const x=state.content.find(v=>v.id===id);if(!x)return;
  if(!confirm(`Архивировать «${x.title}»? Материал можно будет восстановить.`))return;
  const r=await sb.from('content_items').update({archived_at:new Date().toISOString(),archived_by:state.session?.user?.id||null}).eq('id',id);
  if(r.error)return toast(r.error.message,true);clearItemDraft(id);closeDrawer();toast('Материал перемещён в архив');await loadClientData()
}
async function restoreArchived(id){
  const r=await sb.from('content_items').update({archived_at:null,archived_by:null}).eq('id',id);
  if(r.error)return toast(r.error.message,true);toast('Материал восстановлен');await loadClientData();openArchive()
}
function openArchive(){
  openP2Modal('Архив','CONTENT ARCHIVE',state.archivedContent.length?`<div class="archive-list">${state.archivedContent.map(x=>`<div class="archive-row"><div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${esc(x.channel)} · архив ${fmtDate(x.archived_at)}</small></div><button class="mini-btn accent" onclick="restoreArchived('${x.id}')">Восстановить</button></div>`).join('')}</div>`:'<div class="feature-empty"><b>Архив пуст</b><span>Архивированные материалы будут храниться здесь и не попадут в рабочий календарь.</span></div>')
}

function augmentDrawerP3(id){
  const x=state.content.find(v=>v.id===id);if(!x)return;
  const form=$('drawerBody')?.querySelector('.form');
  if(form&&!$('dTags')){
    form.insertAdjacentHTML('beforeend',`<label>Теги<input class="input" id="dTags" placeholder="Например: отзывы, мальдивы, дети" value="${esc((x.tags||[]).join(', '))}"></label>`);
    const localTagDraft=safeJsonParse(localStorage.getItem(draftKeyItem(id)));if(localTagDraft?.tags&&(!x.updated_at||!localTagDraft.savedAt||new Date(localTagDraft.savedAt)>new Date(x.updated_at)))$('dTags').value=localTagDraft.tags;
    $('dTags').addEventListener('input',()=>saveItemLocalDraft(id))
  }
  const detailActions=$('drawerBody')?.querySelector('.detail-actions');
  if(detailActions&&!detailActions.querySelector('.p3-archive')){
    detailActions.insertAdjacentHTML('beforeend',`<button class="ghost p3-archive" onclick="archiveItem('${id}')">⌑ В архив</button>`)
  }
  const readiness=readinessIssues(x),warn=readinessWarnings(x);
  const auto=$('drawerDraftState');
  if(auto&&!$('readinessPanel')){
    auto.insertAdjacentHTML('afterend',`<section class="readiness-panel ${readiness.length?'not-ready':'ready'}" id="readinessPanel"><div><b>${readiness.length?'Не готов к публикации':'Готовность: обязательные пункты закрыты'}</b><small>${readiness.length?readiness.join(' · '):(warn.length?'Рекомендации: '+warn.join(' · '):'Можно передавать на согласование и публикацию.')}</small></div><span>${readiness.length?'!':'✓'}</span></section>`)
  }
  const comments=$('drawerBody')?.querySelector('.collab-section');
  if(comments&&!$('linksBlock')){
    const links=linksFor(id),targets=state.content.filter(v=>v.id!==id);
    comments.insertAdjacentHTML('beforebegin',`<section class="links-block" id="linksBlock"><div class="collab-head"><div><div class="ey">CONTENT CHAIN</div><h3>Связанные материалы</h3></div><span class="badge">${links.length}</span></div>
      <div class="linked-list">${links.map(l=>{const other=linkedOther(l,id);return other?`<div class="linked-row"><button onclick="openDrawer('${other.id}')"><b>${esc(other.title)}</b><small>${esc(l.relation_type)}</small></button><button class="link-remove" onclick="removeContentLink('${l.id}','${id}')">×</button></div>`:''}).join('')||'<div class="collab-empty">Связей пока нет. Объедините Reels, Stories и Telegram-пост в одну цепочку.</div>'}</div>
      <div class="link-compose"><select class="input" id="linkTarget"><option value="">Выберите материал…</option>${targets.map(v=>`<option value="${v.id}">${esc(v.title)}</option>`).join('')}</select><select class="input" id="linkRelation"><option value="sequence">Продолжение</option><option value="support">Поддерживает</option><option value="adaptation">Адаптация</option><option value="campaign">Одна кампания</option></select><button class="primary" onclick="addContentLink('${id}')">Связать</button></div></section>`)
  }
}
const __p3OpenDrawerBase=openDrawer;
openDrawer=function(id){__p3OpenDrawerBase(id);augmentDrawerP3(id)};

function builtInViews(){
  return [
    {id:'builtin:overdue',name:'Просрочено',filters:{kind:'overdue'}},
    {id:'builtin:review',name:'Нужно согласовать',filters:{status:'review'}},
    {id:'builtin:nomedia',name:'Без медиа',filters:{kind:'nomedia'}},
    {id:'builtin:mine',name:'Мои задачи',filters:{assignee:currentAuthorLabel()}},
    {id:'builtin:archive',name:'Архив',filters:{kind:'archive'}}
  ]
}
function viewResults(filters={}){
  if(filters.kind==='archive')return state.archivedContent;
  return state.content.filter(x=>{
    if(filters.kind==='overdue'&&!isOverdue(x))return false;
    if(filters.kind==='nomedia'&&mediaCount(x)!==0)return false;
    if(filters.status&&x.status!==filters.status)return false;
    if(filters.channel&&x.channel!==filters.channel)return false;
    if(filters.assignee&&!String(x.assignee||'').toLowerCase().includes(String(filters.assignee).toLowerCase()))return false;
    if(filters.tag&&!(x.tags||[]).some(t=>t.toLowerCase()===String(filters.tag).toLowerCase()))return false;
    return true
  })
}
function openSavedViews(){
  const all=[...builtInViews(),...(state.savedViews||[])];
  openP2Modal('Представления','SAVED VIEWS',`<div class="views-grid">${all.map(v=>`<button class="view-card" onclick="openViewResults('${v.id}')"><b>${esc(v.name)}</b><small>${viewResults(v.filters||{}).length} материалов</small></button>`).join('')}</div>
    <details class="new-view"><summary>＋ Сохранить новое представление</summary><div class="feature-form"><label>Название<input class="input" id="viewName" placeholder="Например: Telegram на согласовании"></label><div class="cols"><label>Статус<select class="input" id="viewStatus"><option value="">Любой</option>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label><label>Канал<select class="input" id="viewChannel"><option value="">Любой</option><option value="Instagram">Instagram</option><option value="Telegram">Telegram</option></select></label></div><label>Теги<input class="input" id="viewTag" placeholder="Например: отзывы,"></label><label>Ответственный<input class="input" id="viewAssignee" placeholder="Например: Наташа"></label><button class="primary" onclick="saveCurrentView()">Сохранить</button></div></details>`)
}
function findView(id){return [...builtInViews(),...(state.savedViews||[])].find(v=>v.id===id)}
function openViewResults(id){
  const v=findView(id);if(!v)return;const list=viewResults(v.filters||{});
  if(v.filters?.kind==='archive'){openArchive();return}
  openP2Modal(v.name,'SAVED VIEW',`<div class="view-result-list">${list.map(x=>`<button onclick="closeP2Modal();openDrawer('${x.id}')"><div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${esc(x.channel)} · ${STATUS[x.status]}</small></div>${tagHtml(x)}</button>`).join('')||'<div class="feature-empty"><b>Пусто</b><span>Под это представление сейчас ничего не попрадает.</span></div>'}</div>`)
}
async function saveCurrentView(){
  const name=$('viewName')?.value.trim();if(!name)return toast('Введите название',true);
  const filters={status:$('viewStatus')?.value||undefined,channel:$('viewChannel')?.value||undefined,tag:$('viewTag')?.value.trim()||undefined,assignee:$('viewAssignee')?.value.trim()||undefined};
  Object.keys(filters).forEach(k=>filters[k]===undefined&&delete filters[k]);
  const r=await sb.from('saved_views').insert({client_id:state.clientId,user_id:state.session?.user?.id,name,filters});
  if(r.error)return toast(r.error.message,true);toast('Представление сохранена');await loadClientData();openSavedViews()
}

function openRecurringRules(){
  openP2Modal('Повторяющиеся Рубрики','RECURRING CONTENT',`<div class="recurring-list">${(state.recurringRules||[]).map(r=>`<div class="recurring-row"><div><b>${esc(r.name)}</b><small>${r.frequency==='weekly'?'Еженедельно':'Ежемесячно'} · ${esc(r.format)} · ${esc(r.channel)} · ${String(r.time_of_day||'12:00').slice(0,5)}</small></div><button class="mini-btn accent" onclick="generateRecurring('${r.id}')">Создать ${r.occurrences}</button><button class="mini-btn" onclick="toggleRecurring('${r.id}',${!r.active})">${r.active?'Пауза':'Включить'}</button></div>`).join('')||'<div class="collab-empty">Рубрика пока нет</div>'}</div>
    <details class="new-view"><summary>＋ Новая рубрика</summary><div class="feature-form"><label>Название<input class="input" id="rrName" placeholder="Например: Отзыв каждую пятницу"></label><label>Заголовок заготовки<input class="input" id="rrTitle" placeholder="Отзыв клиента"></label><label>Текст / шаблон<textarea class="textarea compact" id="rrCaption"></textarea></label><div class="cols"><label>Формат<select class="input" id="rrFormat"><option>Reels</option><option>Stories</option><option>Carousel</option><option>Post</option></select></label><label>Канал<select class="input" id="rrChannel"><option>Instagram</option><option>Telegram</option></select></label></div><div class="cols"><label>Повтор<select class="input" id="rrFrequency" onchange="renderRecurringScheduleFields()"><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option></select></label><label>Время<input class="input" id="rrTime" type="time" value="12:00"></label></div><div id="rrScheduleField"><label>День недели<select class="input" id="rrWeekday">${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].map((d,i)=>`<option value="${i}" ${i===5?'selected':''}>${d}</option>`).join('')}</select></label></div><div class="cols"><label>Ответственный<input class="input" id="rrAssignee"></label><label>Сколько заготовок<input class="input" id="rrOccurrences" type="number" min="1" max="12" value="4"></label></div><button class="primary" onclick="createRecurringRule()">Сохранить рубрику</button></div></details>`)
}
function renderRecurringScheduleFields(){
  const f=$('rrFrequency')?.value,box=$('rrScheduleField');if(!box)return;
  box.innerHTML=f==='monthly'?'<label>День месяца<input class="input" id="rrDayOfMonth" type="number" min="1" max="28" value="1"></label>':`<label>День недели<select class="input" id="rrWeekday">${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].map((d,i)=>`<option value="${i}" ${i===5?'selected':''}>${d}</option>`).join('')}</select></label>`
}
async function createRecurringRule(){
  const name=$('rrName')?.value.trim(),title=$('rrTitle')?.value.trim();if(!name||!title)return toast('Заполните название рубрики и заголовок',true);
  const frequency=$('rrFrequency').value;
  const row={client_id:state.clientId,name,title_template:title,caption_template:$('rrCaption').value.trim()||null,format:$('rrFormat').value,channel:$('rrChannel').value,frequency,time_of_day:$('rrTime').value||'12:00',assignee:$('rrAssignee').value.trim()||null,occurrences:Math.max(1,Math.min(12,Number($('rrOccurrences').value)||4)),weekday:frequency==='weekly'?Number($('rrWeekday').value):null,day_of_month:frequency==='monthly'?Number($('rrDayOfMonth').value):null};
  const r=await sb.from('recurring_content_rules').insert(row);if(r.error)return toast(r.error.message,true);toast('Рубрика сохранена');await loadClientData();openRecurringRules()
}
function recurringDates(rule){
  const out=[],n=rule.occurrences||4,now=new Date(),time=String(rule.time_of_day||'12:00').split(':'),hh=Number(time[0])||12,mm=Number(time[1])||0;
  if(rule.frequency==='weekly'){
    let d=new Date(now);d.setHours(hh,mm,0,0);const target=Number(rule.weekday??1);let add=(target-d.getDay()+7)%7;if(add===0&&d<=now)add=7;d.setDate(d.getDate()+add);
    for(let i=0;i<n;i++){const x=new Date(d);x.setDate(d.getDate()+i*7);out.push(x)}
  }else{
    let y=now.getFullYear(),m=now.getMonth(),day=Number(rule.day_of_month||1);
    for(let guard=0;out.length<n&&guard<24;guard++,m++){const x=new Date(y,m,day,hh,mm,0,0);if(x>now)out.push(x)}
  }
  return out
}
async function generateRecurring(id){
  const rule=state.recurringRules.find(r=>r.id===id);if(!rule)return;if(!rule.active)return toast('Сначала включите рубрику',true);
  const rows=recurringDates(rule).map(d=>({client_id:state.clientId,title:rule.title_template,caption:rule.caption_template||'',format:rule.format,channel:rule.channel,status:'draft',scheduled_at:d.toISOString(),assignee:rule.assignee||null,tags:['рубрика',rule.name]})).filter(row=>!state.content.some(x=>x.title===row.title&&x.scheduled_at&&Math.abs(new Date(x.scheduled_at)-new Date(row.scheduled_at))<60000));
  if(!rows.length)return toast('Заготовки на эти даты уже существуют',true);
  const r=await sb.from('content_items').insert(rows);if(r.error)return toast(r.error.message,true);toast(`Создано заготовок: ${rows.length}`);await loadClientData();closeP2Modal();show('calendar')
}
async function toggleRecurring(id,active){
  const r=await sb.from('recurring_content_rules').update({active}).eq('id',id);if(r.error)return toast(r.error.message,true);await loadClientData();openRecurringRules()
}

function renderPalette(q){
  const query=q.toLowerCase().trim();
  const list=state.content.filter(x=>[x.title,x.brief,x.caption,x.format,x.channel,STATUS[x.status],...(x.tags||[])].join(' ').toLowerCase().includes(query)).slice(0,12);
  $('paletteResults').innerHTML=list.map(x=>`<div class="palette-item" onclick="closePalette();openDrawer('${x.id}')"><div><b>${esc(x.title)}</b><small>${esc(x.format)} · ${esc(x.channel)} · ${fmtDate(x.scheduled_at)} ${(x.tags||[]).slice(0,2).map(t=>'#'+t).join(' ')}</small></div>${statusBadge(x)}</div>`).join('')||'<div class="empty">Ничего не найдено</div>'
}

const __p3RenderDashboardBase=renderDashboard;
renderDashboard=function(){
  __p3RenderDashboardBase();
  const d=$('dashboard');if(!d||$('opsTools'))return;
  d.insertAdjacentHTML('beforeend',`<div class="card ops-tools" id="opsTools"><div class="ey">OPERATIONS</div><div class="section" style="margin-top:6px"><div><h2>Организация контента</h2><p>Представления, архив и регулярные рубрики.</p></div></div><div class="ops-grid"><button class="quick" onclick="openSavedViews()"><strong>◫ Представления</strong><span>Мои задачи, просрочено, без медиа и свои фильтры</span></button><button class="quick" onclick="openRecurringRules()"><strong>↻ Рубрики</strong><span>Создание серии контента по расписанию</span></button><button class="quick" onclick="openArchive()"><strong>⌑ Архив</strong><span>${state.archivedContent.length} материалов можно восстановить</span></button></div></div>`)
}

async function loadClientData(){
  const [c,i,a,n,s,cm,pq,tp,ln,sv,rr]=await Promise.all([
    sb.from('content_items').select('*').eq('client_id',state.clientId).order('scheduled_at',{ascending:true,nullsFirst:false}),
    sb.from('client_integrations').select('*').eq('client_id',state.clientId).order('channel'),
    sb.from('assets').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}),
    sb.from('analytics_daily').select('*').eq('client_id',state.clientId).order('day',{ascending:false}).limit(30),
    sb.from('content_sync_events').select('id,content_item_id,event_type,source,actor_id,created_at,delivered_at,payload').eq('client_id',state.clientId).order('created_at',{ascending:false}).limit(200),
    sb.from('content_comments').select('*').eq('client_id',state.clientId).order('created_at',{ascending:true}),
    sb.from('publish_queue').select('*').eq('client_id',state.clientId).order('requested_at',{ascending:false}).limit(50),
    sb.from('content_templates').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false}),
    sb.from('content_links').select('*').eq('client_id',state.clientId).order('created_at',{ascending:true}),
    sb.from('saved_views').select('*').eq('client_id',state.clientId).eq('user_id',state.session?.user?.id).order('created_at',{ascending:true}),
    sb.from('recurring_content_rules').select('*').eq('client_id',state.clientId).order('created_at',{ascending:false})
  ]);
  if(c.error)return toast(c.error.message,true);if(i.error)return toast(i.error.message,true);
  const all=c.data||[];state.content=all.filter(x=>!x.archived_at);state.archivedContent=all.filter(x=>x.archived_at);
  state.integrations=i.data||[];state.assets=a.error?[]:(a.data||[]);state.analytics=n.error?[]:(n.data||[]);state.syncEvents=s.error?[]:(s.data||[]);
  state.comments=cm.error?[]:(cm.data||[]);state.publishQueue=pq.error?[]:(pq.data||[]);state.templates=tp.error?[]:(tp.data||[]);
  state.contentLinks=ln.error?[]:(ln.data||[]);state.savedViews=sv.error?[]:(sv.data||[]);state.recurringRules=rr.error?[]:(rr.data||[]);
  renderAll();ensurePackage2Shell();refreshTemplateSelect();updateNotifBadge()
}
function startRealtime(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}if(!state.session||!state.clientId)return;
  realtimeChannel=sb.channel('content-center-'+state.clientId)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_items',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_sync_events',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_comments',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'publish_queue',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_templates',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'content_links',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'saved_views',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'recurring_content_rules',filter:`client_id=eq.${state.clientId}`},scheduleRealtimeReload)
    .subscribe()
}

