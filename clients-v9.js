/* Content Center: one canonical project/client record, owner-only client management */
(function(){
'use strict';
const fields=[
 ['name','Название клиента','text','Например: Новое турагентство',160],
 ['business_type','Сфера деятельности','text','Например: Турагентство',120],
 ['instagram','Instagram','text','Ссылка или имя аккаунта',250],
 ['telegram','Telegram','text','Ссылка на канал или имя аккаунта',250],
 ['description','Чем занимается компания','textarea','Краткое описание бизнеса',1500],
 ['audience','Целевая аудитория','textarea','Кому адресован контент',1500],
 ['goals','Цели контента','textarea','Для чего ведём соцсети',1500],
 ['tone','Стиль общения','text','Например: тёплый, экспертный',200],
 ['primary_font','Основной шрифт','text','Если указан в брендбуке',120],
 ['accent_font','Акцентный шрифт','text','Если указан в брендбуке',120]
];
let mode='create';
let saving=false;
function el(id){return document.getElementById(id);}
function showError(error){
 const msg=String(error?.message||error||'Не удалось сохранить проект');
 if(msg.includes('client_already_exists'))return 'Клиент с таким названием уже есть в вашем кабинете. Выберите его в списке, чтобы не создавать дубль.';
 if(msg.includes('owner_access_required')||msg.includes('permission denied'))return 'Управлять клиентами может только владелец. Войдите по коду владельца.';
 if(msg.includes('invalid_client_name'))return 'Название должно содержать от 2 до 160 символов.';
 if(msg.includes('invalid_brand_rules'))return 'Описание клиента слишком длинное или содержит некорректные данные.';
 return msg;
}
function close(){
 if(saving)return;
 const dialog=el('clientManagerV9');
 if(dialog)dialog.classList.remove('on');
 document.body.classList.remove('client-manager-open');
}
function start(edit){
 if(!state.session)return toast('Сначала войдите по коду владельца',true);
 const client=currentClient();
 if(edit&&!client)return toast('Выберите клиента для редактирования',true);
 mode=edit?'edit':'create';
 const form=el('clientFormV9');form.reset();
 const rules=edit?(client.brand_rules||{}):{};
 for(const [key] of fields){
  const input=el('cm_'+key);if(!input)continue;
  if(key==='name')input.value=edit?client.name||'':'';
  else if(key==='business_type')input.value=edit?client.business_type||'':'';
  else input.value=edit?String(rules[key]||''):'';
 }
 el('clientManagerTitleV9').textContent=edit?'Настройки клиента':'Новый клиент';
 el('clientManagerDescriptionV9').textContent=edit?
  'Изменения сохраняются в существующем проекте. Материалы и их история останутся на месте.':
  'Клиент создаётся один раз. Затем все его материалы, задачи по ним и ссылки будут храниться в этом проекте.';
 el('clientManagerSaveV9').textContent=edit?'Сохранить настройки':'Создать клиента';
 el('clientManagerV9').classList.add('on');
 document.body.classList.add('client-manager-open');
 el('cm_name').focus();
}
async function save(event){
 event.preventDefault();
 if(saving||!state.session)return;
 const name=el('cm_name').value.trim();
 const business=el('cm_business_type').value.trim();
 if(name.length<2)return toast('Введите название клиента от 2 символов',true);
 if(mode==='create'&&(state.clients||[]).some(c=>String(c.name).trim().toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))
  return toast('Такой клиент уже есть. Выберите его в списке, не создавайте дубль.',true);
 const original=mode==='edit'?(currentClient()?.brand_rules||{}):{};
 const rules={...original};
 for(const [key] of fields){
  if(key==='name'||key==='business_type')continue;
  const value=el('cm_'+key).value.trim();
  if(value)rules[key]=value;
  else delete rules[key];
 }
 saving=true;
 const button=el('clientManagerSaveV9');
 button.disabled=true;button.textContent='Сохраняю…';
 try{
  if(mode==='edit'&&!currentClient())throw new Error('Клиент не найден');
  const rpc=mode==='create'?'owner_create_client':'owner_update_client';
  const params={p_name:name,p_business_type:business||null,p_brand_rules:rules};
  if(mode==='edit')params.p_client_id=state.clientId;
  const result=await sb.rpc(rpc,params);
  if(result.error)throw result.error;
  if(mode==='create'&&!result.data)throw new Error('Сервер не подтвердил создание клиента');
  if(mode==='create')state.clientId=result.data;
  el('clientManagerV9').classList.remove('on');
  document.body.classList.remove('client-manager-open');
  await loadClients();
  if(mode==='create'){
   show('dashboard');
   toast('Клиент создан. Выберите «Материал» для его первой публикации.');
  }else{
   toast('Настройки клиента обновлены без создания нового проекта.');
   show(state.view);
  }
 }catch(error){toast(showError(error),true);}
 finally{saving=false;button.disabled=false;button.textContent=mode==='edit'?'Сохранить настройки':'Создать клиента';}
}
function help(){
 const root=el('instructions');if(!root||!state.session||!state.clientId)return;
 if(root.querySelector('#clientWorkflowV9'))return;
 root.insertAdjacentHTML('afterbegin',
 '<section class="client-workflow-v9"><h2>Как работать без повторного ввода</h2>'+
 '<p>В Content Center хранится единственная рабочая версия каждого клиента и материала. В ChatGPT вы ставите мне задачи, обсуждаете идеи и готовите тексты. Из чата изменения не попадают в кабинет сами собой.</p>'+
 '<div class="client-workflow-grid-v9">'+
 '<article><h3>1. Добавить клиента</h3><p><b>Где:</b> Content Center → «Новый клиент» рядом с выбором проекта. Создайте проект один раз и заполните данные компании.</p><p><b>В чате:</b> можно попросить меня помочь собрать описание и правила бренда, но не заводить второй проект.</p></article>'+
 '<article><h3>2. Редактировать сведения</h3><p><b>Где:</b> выберите клиента → «Настройки клиента». Изменяйте существующую карточку, не создавая нового клиента.</p><p><b>В чате:</b> обсуждайте предлагаемые правки. Они не считаются сохранёнными, пока не внесены в кабинет.</p></article>'+
 '<article><h3>3. Создать и поправить материал</h3><p><b>Где:</b> Content Center → «Материал». Один пост или Reels — одна карточка. Текст, фото, срок и статус изменяйте в ней.</p><p><b>В чате:</b> просите написать текст или сценарий для выбранного клиента. После согласования перенесите результат в существующую карточку; не создавайте второй материал для той же публикации.</p></article>'+
 '<article><h3>4. Поставить задачу</h3><p><b>Где:</b> в карточке материала заполните бриф, чек-лист и дедлайн. Контроль выполнения и согласование ведите там же.</p><p><b>В чате:</b> формулируйте поручение для меня: «Подготовь сценарий для материала…». Это не отдельная рабочая задача в кабинете.</p></article>'+
 '<article><h3>5. Согласовать и опубликовать</h3><p><b>Где:</b> Content Center → карточка материала → согласование по ссылке, проверка готовности, календарь и публикация.</p><p><b>В чате:</b> можно обсудить правки или попросить проверить содержание, но итоговый статус проверяйте только в карточке.</p></article>'+
 '<article><h3>6. Получить результаты</h3><p><b>Где:</b> после публикации вносите её статистику в карточку, затем формируйте отчёт клиенту из сохранённых данных.</p><p><b>Важно:</b> автоматическая двусторонняя синхронизация с ChatGPT пока не подтверждена. Не считайте сообщение в чате подтверждением сохранения материала.</p></article>'+
 '</div><div class="client-workflow-actions-v9"><button type="button" class="primary" id="workflowNewClientV9">Новый клиент</button><button type="button" class="ghost" id="workflowClientSettingsV9">Настройки клиента</button><button type="button" class="ghost" id="workflowNewMaterialV9">Создать материал</button></div></section>');
 el('workflowNewClientV9').addEventListener('click',()=>start(false));
 el('workflowClientSettingsV9').addEventListener('click',()=>start(true));
 el('workflowNewMaterialV9').addEventListener('click',()=>openAdd());
}
function init(){
 const select=el('client');
 if(!select)return;
 if(!el('clientCreateBtnV9')){
  select.insertAdjacentHTML('afterend',
   '<button type="button" id="clientCreateBtnV9" class="client-header-btn-v9" title="Добавить нового клиента">+ Новый клиент</button>'+
   '<button type="button" id="clientSettingsBtnV9" class="client-header-btn-v9" title="Редактировать выбранного клиента">Настройки клиента</button>');
 }
 const markup='<div class="client-manager-overlay-v9" id="clientManagerV9" role="dialog" aria-modal="true" aria-labelledby="clientManagerTitleV9">'+
 '<div class="client-manager-dialog-v9"><div class="client-manager-head-v9"><div><h2 id="clientManagerTitleV9">Новый клиент</h2><p id="clientManagerDescriptionV9"></p></div><button id="clientManagerCloseV9" type="button" class="ghost" aria-label="Закрыть">Закрыть</button></div>'+
 '<form id="clientFormV9" class="client-manager-form-v9">'+
 fields.map(f=>'<label class="client-field-v9"><span>'+f[1]+'</span>'+
  (f[2]==='textarea'?'<textarea class="input" id="cm_'+f[0]+'" maxlength="'+f[4]+'" rows="3" placeholder="'+f[3]+'"></textarea>':
   '<input class="input" id="cm_'+f[0]+'" type="text" maxlength="'+f[4]+'" placeholder="'+f[3]+'" '+(f[0]==='name'?'required':'')+'>')+'</label>').join('')+
 '<div class="client-manager-footer-v9"><p>Сохраните данные один раз. Материалы и задачи создаются только внутри выбранного клиента.</p><button type="submit" class="primary" id="clientManagerSaveV9">Создать клиента</button></div></form></div></div>';
 document.body.insertAdjacentHTML('beforeend',markup);
 el('clientCreateBtnV9').addEventListener('click',()=>start(false));
 el('clientSettingsBtnV9').addEventListener('click',()=>start(true));
 el('clientManagerCloseV9').addEventListener('click',close);
 el('clientFormV9').addEventListener('submit',save);
 el('clientManagerV9').addEventListener('click',e=>{if(e.target===el('clientManagerV9'))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el('clientManagerV9')?.classList.contains('on'))close();});
 el('logoutBtn')?.addEventListener('click',()=>{saving=false;close();});
 const priorRenderInstructions=renderInstructions;
 renderInstructions=function(){priorRenderInstructions();help();};
 if(state.session&&state.clientId&&state.view==='instructions')help();
}
init();
})();
