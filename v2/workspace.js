/* CC V2 is opt-in on a separate review branch. Existing owner auth and editor stay intact. */
(function(){
  'use strict';
  if(typeof window==='undefined'||!window.location||
     new URLSearchParams(window.location.search).get('workspace')!=='v2')return;
  if(typeof renderDashboard!=='function'||typeof CCV2Model==='undefined')return;
  document.documentElement.classList.add('cc-v2');
  const oldDashboard=renderDashboard;
  const e=CCV2Model.escapeHtml;
  const labels={failed:'Требует внимания',review:'На согласовании',approved:'Одобрено',scheduled:'Запланировано',production:'В работе',draft:'Черновик'};
  function formatDate(raw){
    const date=new Date(raw||'');
    if(!raw||Number.isNaN(date.getTime()))return 'Дата не назначена';
    return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
  }
  function metric(label,value,view,accent){
    return '<button type="button" class="ccv2-metric '+(accent||'')+'" data-ccv2-view="'+e(view)+'">'+
      '<span class="ccv2-metric-value">'+Number(value)+'</span><span class="ccv2-metric-label">'+e(label)+'</span></button>';
  }
  function action(item){
    return '<li class="ccv2-action"><div class="ccv2-action-body">'+
      '<span class="ccv2-stage ccv2-stage-'+e(item.status)+'">'+e(labels[item.status]||item.status)+'</span>'+
      '<h3>'+e(item.title)+'</h3><p>'+e([item.format,item.channel,formatDate(item.dueAt)].filter(Boolean).join(' · '))+'</p></div>'+
      '<div class="ccv2-action-controls"><button type="button" class="ccv2-check" data-ccv2-check="'+e(item.id)+'" aria-label="Предпроверка материала '+e(item.title)+'">Проверить</button>'+
      '<button type="button" class="ccv2-open" data-ccv2-open="'+e(item.id)+'" aria-label="Открыть материал '+e(item.title)+'">Открыть <span aria-hidden="true">↗</span></button></div></li>';
  }
  function upcoming(item){
    return '<li class="ccv2-upcoming"><span class="ccv2-upcoming-time">'+e(formatDate(item.scheduledAt))+'</span>'+
      '<span class="ccv2-upcoming-title">'+e(item.title)+'</span><span class="ccv2-upcoming-channel">'+e(item.channel)+'</span></li>';
  }
  function render(model){
    return '<div class="ccv2-shell">'+
      '<header class="ccv2-header"><div><div class="ccv2-eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО · V2</div>'+
      '<h2>Сегодня в работе</h2><p>Клиент: <strong>'+e(model.clientName)+'</strong>. Действия по текущему проекту без дублирования карточек.</p></div>'+
      '<button class="ccv2-create" type="button" data-ccv2-create>+ Новый материал</button></header>'+
      '<section class="ccv2-stats" aria-label="Сводка по материалам">'+
      metric('Требуют внимания',model.failed,'publishing','ccv2-urgent')+
      metric('На согласовании',model.review,'approvals','')+
      metric('Готовы к публикации',model.approved,'publishing','')+
      metric('В плане на 7 дней',model.plannedWeek,'calendar','')+'</section>'+
      '<div class="ccv2-columns"><section class="ccv2-panel" aria-labelledby="ccv2-actions-heading">'+
      '<div class="ccv2-panel-head"><div><div class="ccv2-eyebrow">СЛЕДУЮЩИЕ ДЕЙСТВИЯ</div><h2 id="ccv2-actions-heading">Очередь производства</h2></div><button type="button" class="ccv2-link" data-ccv2-view="production">Все материалы →</button></div>'+
      (model.actions.length?'<ol class="ccv2-actions">'+model.actions.map(action).join('')+'</ol>':
       '<p class="ccv2-empty">Сейчас нет материалов, требующих действий. Создайте материал или откройте календарь.</p>')+
      '<section id="ccv2-check-panel" class="ccv2-check-panel" aria-live="polite" aria-label="Результаты предпроверки" hidden></section>'+
      '</section><aside class="ccv2-sidepanels"><section class="ccv2-panel" aria-labelledby="ccv2-plan-heading">'+
      '<div class="ccv2-panel-head"><div><div class="ccv2-eyebrow">БЛИЖАЙШИЕ 7 ДНЕЙ</div><h2 id="ccv2-plan-heading">План публикаций</h2></div><button type="button" class="ccv2-link" data-ccv2-view="calendar">Календарь →</button></div>'+
      (model.upcoming.length?'<ol class="ccv2-upcoming-list">'+model.upcoming.map(upcoming).join('')+'</ol>':
       '<p class="ccv2-empty">На ближайшие семь дней публикаций не запланировано.</p>')+'</section>'+
      '<section class="ccv2-panel ccv2-integrity" aria-labelledby="ccv2-integrity-heading">'+
      '<div class="ccv2-eyebrow">КОНТРОЛЬ РЕЗУЛЬТАТА</div><h2 id="ccv2-integrity-heading">Публикация ≠ статус карточки</h2>'+
      '<p>Сводка выше отражает данные карточек. Фактическую отправку в Instagram или Telegram следует подтверждать ответом площадки и ссылкой на публикацию. Автосинхронизация с ChatGPT пока не подтверждена сквозным тестом.</p>'+
      '<button class="ccv2-link" type="button" data-ccv2-view="publishing">Открыть журнал публикаций →</button></section></aside></div></div>';
  }
  function bind(root){
    root.querySelectorAll('[data-ccv2-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.ccv2View)));
    root.querySelectorAll('[data-ccv2-open]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.ccv2Open;
      if(id&&state.content.some(item=>String(item.id)===id&&item.client_id===state.clientId))openDrawer(id);
    }));
    root.querySelectorAll('[data-ccv2-check]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.ccv2Check;
      const item=state.content.find(x=>String(x.id)===id&&x.client_id===state.clientId);
      const panel=root.querySelector('#ccv2-check-panel');
      if(!item||!panel||typeof CCV2Preflight==='undefined')return;
      const report=CCV2Preflight.evaluate(item);
      const notes=report.findings.length
        ?'<ul class="ccv2-check-list">'+report.findings.map(f=>'<li class="ccv2-check-'+e(f.level)+'">'+e(f.message)+'</li>').join('')+'</ul>'
        :'<p class="ccv2-check-note">Технические замечания не обнаружены. Это не подтверждение достоверности контента.</p>';
      panel.innerHTML='<div class="ccv2-panel-head"><div><div class="ccv2-eyebrow">ПРЕДПРОВЕРКА · БЕЗ ИЗМЕНЕНИЯ МАТЕРИАЛА</div>'+
        '<h3>'+e(item.title||'Материал без названия')+'</h3></div><button type="button" class="ccv2-close-check" aria-label="Закрыть предпроверку">×</button></div>'+
        notes+'<p class="ccv2-check-note">Факты, права на медиа, одобрение актуальной версии и результат отправки требуют отдельного подтверждения.</p>';
      panel.hidden=false;
      panel.querySelector('.ccv2-close-check').addEventListener('click',()=>{panel.hidden=true;panel.innerHTML='';});
      panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    }));
    const create=root.querySelector('[data-ccv2-create]');
    if(create)create.addEventListener('click',()=>openAdd());
  }
  renderDashboard=function(){
    const root=$('dashboard');
    if(!root||!state.session||!state.clientId){oldDashboard();return;}
    try{
      const model=CCV2Model.buildWorkspaceModel({clientId:state.clientId,client:currentClient(),content:state.content,queue:state.publishQueue});
      root.innerHTML=render(model);bind(root);
    }catch(error){console.error('CC V2 dashboard fallback',error);oldDashboard();}
  };
  if(state.session&&state.clientId)renderDashboard();
})();
