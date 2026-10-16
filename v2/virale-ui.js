/* Virale Studio — manual-first, client scoped, no paid or external scraping calls. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined'||
  ['v1','legacy'].includes(new URLSearchParams(location.search).get('workspace'))||
  typeof NAV==='undefined'||typeof show!=='function'||typeof CCV2ViraleCore==='undefined')return;
 const VIEW='virale', core=CCV2ViraleCore;
 let active=null;
 const $v=id=>document.getElementById(id);
 const el=(tag,cls,txt)=>{
  const x=document.createElement(tag);if(cls)x.className=cls;
  if(txt!==undefined)x.textContent=txt;return x;
 };
 const append=(node,tag,cls,text)=>{const x=el(tag,cls,text);node.appendChild(x);return x;};
 const canUse=()=>!!(state.session&&state.clientId);
 const brand=()=>typeof CCV2BrandDNA==='undefined'?null:
   CCV2BrandDNA.build(currentClient(),state.clientId);
 function notify(text,error){
  const x=$v('viraleMessage');
  if(x){x.className='virale-message'+(error?' virale-error':'');x.textContent=text;}
 }
 const markup=[
 '<header class="virale-intro"><div><div class="virale-eyebrow">CONTENT CENTER / ИДЕИ И РЕФЕРЕНСЫ</div>',
 '<h2>Virale Studio <span>β · бесплатно</span></h2>',
 '<p>Анализ референса, метрики и собственные Reels под бренд-ДНК каждого клиента. Без дублирования базы.</p></div>',
 '<div class="virale-quick">01 · Референс → 02 · Анализ → 03 · Сценарий → 04 · Материал</div></header>',
 '<div class="virale-grid"><form id="viraleForm" class="virale-panel" autocomplete="off">',
 '<h3>Разбор ролика</h3><p class="virale-muted">Ссылка не даёт доступ к видео автоматически. Опишите известные детали и метрики.</p>',
 '<label>Ссылка на Reels / Shorts / TikTok (необязательно)',
 '<input id="virale-url" type="url" class="input" maxlength="1200" placeholder="https://www.instagram.com/reel/…"></label>',
 '<label>Тема вашего ролика (обязательно)',
 '<input id="virale-topic" class="input" type="text" maxlength="150" required placeholder="Как выбрать семейный отель"></label>',
 '<label>Хук исходного ролика, если известен',
 '<input id="virale-hook" class="input" type="text" maxlength="260" placeholder="Первая фраза на экране"></label>',
 '<label>Что интересного в референсе',
 '<textarea id="virale-observation" class="input" rows="3" maxlength="700" placeholder="Монтаж, интрига, структура, CTA…"></textarea></label>',
 '<details class="virale-details"><summary>Показатели ролика, если известны</summary>',
 '<div class="virale-number-grid">',
 '<label>Просмотры<input id="virale-views" class="input" type="number" min="0" step="1"></label>',
 '<label>Лайки<input id="virale-likes" class="input" type="number" min="0" step="1"></label>',
 '<label>Комментарии<input id="virale-comments" class="input" type="number" min="0" step="1"></label>',
 '<label>Репосты<input id="virale-shares" class="input" type="number" min="0" step="1"></label>',
 '<label>Сохранения<input id="virale-saves" class="input" type="number" min="0" step="1"></label>',
 '<label>Подписчики автора<input id="virale-followers" class="input" type="number" min="0" step="1"></label>',
 '<label>Медиана просмотров аккаунта<input id="virale-median" class="input" type="number" min="0" step="1"></label>',
 '</div></details><div class="virale-actions">',
 '<button type="submit" class="primary">✦ Разобрать и создать идеи</button>',
 '<button type="button" class="ghost" id="viraleReset">Очистить</button></div>',
 '<p class="virale-message" id="viraleMessage" role="status">Начните с темы.</p></form>',
 '<aside class="virale-panel"><h3>Клиент и его стиль</h3>',
 '<strong id="viraleClient"></strong><p id="viraleBrand" class="virale-dna"></p>',
 '<p class="virale-muted">Используется бренд-ДНК только выбранного клиента. Прогноз охватов и скрытое получение данных не выполняются.</p>',
 '<p class="virale-muted">Перед публикацией проверьте факты, оригинальность и права на медиа.</p>',
 '</aside></div><section id="viraleResults" class="virale-results" aria-live="polite" hidden></section>'
 ].join('');
 function render(){
  const root=$v(VIEW);if(!root||!canUse())return;
  if(root.dataset.forClient!==state.clientId){
   root.innerHTML=markup;root.dataset.forClient=state.clientId;active=null;
   $v('viraleForm').addEventListener('submit',analyze);
   $v('viraleReset').addEventListener('click',()=>{
    $v('viraleForm').reset();active=null;
    $v('viraleResults').replaceChildren();$v('viraleResults').hidden=true;notify('Форма очищена.');
   });
  }
  const d=brand();
  $v('viraleClient').textContent=currentClient()?.name||'Клиент не выбран';
  $v('viraleBrand').textContent=d?
   'Бренд-ДНК: '+d.filled+' из '+d.total+' полей. Основной шрифт: '+
    (d.fields.primary_font||'не указан')+'. Манера: '+(d.fields.tone||'не указана')+'.':
    'Заполните бренд-ДНК клиента, чтобы получать индивидуальные сценарии.';
 }
 const val=key=>($v('virale-'+key)?.value||'').trim();
 function read(){
  const keys=['url','topic','hook','observation','views','likes','comments',
    'shares','saves','followers','median'];
  const result={};keys.forEach(k=>result[k]=val(k));return result;
 }
 function analyze(ev){
  ev.preventDefault();
  if(!canUse())return;
  const data=read();
  if(!data.topic){notify('Укажите тему.',true);return;}
  if(data.url&&!core.videoUrl(data.url)){
   notify('Укажите HTTPS-ссылку на Instagram Reel/Post, TikTok Video или YouTube Short.',true);return;
  }
  try{
   const clientId=state.clientId,d=brand(),metrics=core.performance(data),
     ideas=core.compose(data,d);
   active={clientId,data,brand:d,metrics,ideas};
   result(active);
   notify('Идеи готовы. Выберите сценарий и сохраните его в существующую карточку.');
  }catch(error){notify(error.message||'Ошибка разбора',true);}
 }
 function fmt(v,suf){return v===null?'Нет данных':
  (Math.round(v*100)/100).toLocaleString('ru-RU')+(suf||'');}
 function result(model){
  const target=$v('viraleResults');target.replaceChildren();target.hidden=false;
  append(target,'h2','','Результат анализа');
  const m=append(target,'div','virale-metrics');
  [
   ['Взвешенные взаимодействия',model.metrics.engagementRate,'%'],
   ['Просмотры / медиана',model.metrics.medianMultiple,'×'],
   ['Просмотры / подписчики',model.metrics.reachMultiple,'×']
  ].forEach(item=>{
   const box=append(m,'div','virale-metric');
   append(box,'small','',item[0]);append(box,'strong','',fmt(item[1],item[2]));
  });
  append(target,'p','virale-caveat',model.metrics.caveat);
  const notes=append(target,'ul','virale-notes');
  model.metrics.notes.forEach(note=>append(notes,'li','',note));
  const actions=append(target,'div','virale-actions');
  const prompt=append(actions,'button','primary','Скопировать задание в ChatGPT');
  prompt.type='button';prompt.addEventListener('click',()=>copyText(
    core.aiPrompt(model.data,model.brand,model.metrics)));
  const save=append(actions,'button','ghost','Сохранить референс в «Идеи»');
  save.type='button';save.disabled=!core.videoUrl(model.data.url);
  save.title=save.disabled?'Нужна ссылка на видео':'Сохраняется в существующей базе';
  save.addEventListener('click',()=>saveReference(model,save));
  append(target,'h3','virale-section-title','Три оригинальных сценария');
  const grid=append(target,'div','virale-ideas');
  model.ideas.forEach(idea=>{
   const card=append(grid,'article','virale-idea');
   append(card,'small','',idea.why);
   append(card,'h3','',idea.title);
   append(card,'p','virale-hook','Хук: '+idea.hook);
   append(card,'pre','virale-script',idea.caption);
   const actions=append(card,'div','virale-actions');
   const to=append(actions,'button','primary','→ Новый материал');
   to.type='button';to.addEventListener('click',()=>toDraft(model,idea));
   const copy=append(actions,'button','ghost','Скопировать');
   copy.type='button';copy.addEventListener('click',()=>copyText(idea.caption+
     '\n\n'+idea.context));
  });
  target.scrollIntoView?.({block:'start',behavior:'smooth'});
 }
 async function copyText(text){
  try{await navigator.clipboard.writeText(text);
   if(typeof toast==='function')toast('Скопировано. Вставьте текст в ChatGPT.');
  }catch{notify('Копирование заблокировано браузером. Проверьте доступ.',true);}
 }
 function toDraft(model,idea){
  if(!canUse()||state.clientId!==model.clientId){notify('Клиент изменился. Обновите анализ.',true);return;}
  if(typeof openAdd!=='function'){notify('Редактор недоступен.',true);return;}
  openAdd();
  if($v('fTitle'))$v('fTitle').value=idea.title.slice(0,160);
  if($v('fFormat'))$v('fFormat').value='Reels';
  if($v('fCaption'))$v('fCaption').value=(idea.caption+'\n\nБриф: '+idea.context+
    (core.videoUrl(model.data.url)?'\nРеференс: '+core.videoUrl(model.data.url):'')).slice(0,10000);
  if(typeof saveNewLocalDraft==='function')saveNewLocalDraft();
  if(typeof toast==='function')toast('Сценарий заполнен. Проверьте поля и нажмите «Сохранить».');
 }
 async function saveReference(model,button){
  if(!canUse()||state.clientId!==model.clientId){notify('Клиент изменился.',true);return;}
  const url=core.videoUrl(model.data.url);
  if(!url){notify('Добавьте ссылку на ролик.',true);return;}
  const already=(state.assets||[]).some(a=>a.client_id===model.clientId&&core.videoUrl(a.url)===url);
  if(already){notify('Референс уже сохранён у этого клиента.',true);return;}
  button.disabled=true;
  try{
   const note=[
    model.data.hook?'Хук: '+model.data.hook:'',
    model.data.observation?'Наблюдения: '+model.data.observation:'',
    'Идеи: '+model.ideas.map(x=>x.title).join('; ')
   ].filter(Boolean).join('\n').slice(0,1800);
   const r=await sb.from('assets').insert({
    client_id:model.clientId,name:core.safeText(model.data.topic,150),
    kind:'link',url,metadata:{source:'virale_studio',
     idea_note:note,idea_tags:['Reels','Virale']}
   });
   if(r.error)throw r.error;
   notify('Референс сохранён в существующей библиотеке «Идеи».');
   if(typeof loadClientData==='function')await loadClientData();
  }catch(e){notify(e.message||'Ошибка сохранения',true);}
  finally{button.disabled=false;}
 }
 if(!NAV.some(x=>x[0]===VIEW)){
  const i=NAV.findIndex(x=>x[0]==='ideas');
  NAV.splice(i<0?NAV.length:i+1,0,[VIEW,'✦','Virale Studio']);
 }
 if(!$v(VIEW)){
  const anchor=$v('ideas')||$v('library')||$v('dashboard');
  anchor?.insertAdjacentHTML('afterend','<section class="view" id="virale"></section>');
 }
 const oldShow=show;
 show=function(v){oldShow(v);if(v===VIEW)render();};
 const oldRender=renderAll;
 renderAll=function(){oldRender();if(state.view===VIEW)render();};
 if(typeof renderNav==='function')renderNav();
 if(state.view===VIEW)render();
})();
