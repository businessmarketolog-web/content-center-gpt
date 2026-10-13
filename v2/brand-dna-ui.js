/* V2-only Brand DNA dashboard panel. Existing owner client editor remains canonical. */
(function(){
 'use strict';
 if(typeof window==='undefined'||!window.location||
    ['v1','legacy'].includes(new URLSearchParams(window.location.search).get('workspace'))||
    typeof document==='undefined'||typeof CCV2BrandDNA==='undefined'||
    typeof renderDashboard!=='function')return;
 const previousRender=renderDashboard;
 const previousRenderNav=typeof renderNav==='function'?renderNav:null;
 const mk=(tag,klass,value)=>{
  const el=document.createElement(tag);
  if(klass)el.className=klass;
  if(value!==undefined)el.textContent=value;
  return el;
 };
 function renderPanel(){
  const shell=document.querySelector('#dashboard .ccv2-shell');
  if(!shell||!state.session||!state.clientId)return;
  const data=CCV2BrandDNA.build(currentClient(),state.clientId);
  if(!data)return;
  shell.querySelector('#ccv2-brand-dna')?.remove();
  const card=mk('section','ccv2-brand-dna');card.id='ccv2-brand-dna';
  card.setAttribute('aria-label','Бренд-ДНК выбранного клиента');
  const titleLine=mk('div','ccv2-brand-head');
  const names=mk('div','');
  names.append(mk('span','ccv2-brand-kicker','ПРОФИЛЬ БРЕНДА · '+data.name));
  names.append(mk('h2','','Бренд-ДНК клиента'));
  names.append(mk('p','ccv2-brand-sub','Правила принадлежат только выбранному клиенту и используются в заданиях ChatGPT.'));
  const actions=mk('div','ccv2-brand-actions');
  const edit=mk('button','ccv2-open','Изменить правила');edit.type='button';
  edit.addEventListener('click',()=>{
   if(state.clientId!==data.clientId)return;
   document.getElementById('clientSettingsBtnV9')?.click();
  });
  const copy=mk('button','ccv2-check','Скопировать контекст ChatGPT');copy.type='button';
  copy.addEventListener('click',async()=>{
   if(state.clientId!==data.clientId)return;
   try{
    const prompt=CCV2BrandDNA.prompt(currentClient(),state.clientId);
    await navigator.clipboard.writeText(prompt);
    if(state.clientId===data.clientId)toast('Бренд-ДНК этого клиента скопирована для ChatGPT.');
   }catch{if(state.clientId===data.clientId)toast('Не удалось скопировать. Проверьте разрешение браузера.',true);}
  });
  actions.append(edit,copy);titleLine.append(names,actions);card.append(titleLine);
  const meter=mk('p','ccv2-brand-progress','Заполнено '+data.filled+' из '+data.total+' правил. Незаполненные правила не подменяются догадками.');
  card.append(meter);
  const cols=mk('div','ccv2-brand-highlights');
  const keys=[['audience','Целевая аудитория'],['tone','Манера написания'],
              ['primary_font','Основной шрифт'],['accent_font','Акцентный шрифт'],
              ['visual_style','Визуальный стиль'],['overlay_rules','Сторис и подложки'],
              ['content_pillars','Контент-рубрики'],['content_mix','Баланс контента']];
  for(const [key,label] of keys){
   const field=mk('div','ccv2-brand-highlight');
   field.append(mk('strong','',label));
   field.append(mk('p','',data.fields[key]||'Не указано'));
   cols.append(field);
  }
  card.append(cols);
  card.append(mk('p','ccv2-brand-note','Шрифты здесь — точные инструкции, но их визуальное применение требует подключённых лицензионных файлов. Профиль не публикуется автоматически.'));
  shell.querySelector('.ccv2-header')?.after(card);
 }
 function openBrandPanel(){
  if(!state.session||!state.clientId){
   if(typeof toast==='function')toast('Сначала войдите и выберите клиента',true);
   return;
  }
  // The header entry is available even when Calendar, Production or another view is open.
  if(typeof show==='function')show('dashboard');
  if(typeof renderDashboard==='function')renderDashboard();
  const panel=document.getElementById('ccv2-brand-dna');
  if(!panel){
   if(typeof toast==='function')toast('Профиль не загрузился. Обновите страницу V2.',true);
   return;
  }
  panel.setAttribute('tabindex','-1');
  try{panel.focus({preventScroll:true});}catch{panel.focus();}
  panel.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 function ensureBrandNavigation(){
  const settings=document.getElementById('clientSettingsBtnV9');
  if(settings&&!document.getElementById('ccv2BrandNavTop')){
   const entry=mk('button','client-header-btn-v9 ccv2-brand-nav-top','✦ Бренд-ДНК');
   entry.type='button';entry.id='ccv2BrandNavTop';
   entry.setAttribute('aria-label','Открыть Бренд-ДНК выбранного клиента');
   entry.addEventListener('click',openBrandPanel);
   settings.after(entry);
  }
  const menu=document.getElementById('menu');
  if(menu&&!document.getElementById('ccv2BrandNavMenu')){
   const entry=mk('button','nav ccv2-brand-nav-menu');
   entry.id='ccv2BrandNavMenu';entry.type='button';
   entry.setAttribute('aria-label','Открыть Бренд-ДНК выбранного клиента');
   entry.append(mk('span','ni','✦'),mk('span','','Бренд-ДНК'));
   entry.addEventListener('click',openBrandPanel);
   const first=menu.querySelector('[data-v="dashboard"]');
   if(first)first.after(entry);else menu.append(entry);
  }
 }
 renderDashboard=function(){previousRender();renderPanel();};
 if(previousRenderNav){
  renderNav=function(){previousRenderNav();ensureBrandNavigation();};
 }
 ensureBrandNavigation();
 if(state.session&&state.clientId)renderPanel();
})();
