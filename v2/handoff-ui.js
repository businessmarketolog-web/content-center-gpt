/* Manual ChatGPT handoff for an existing owner's draft; no direct API/database writes. */
(function(){
  'use strict';
  if(typeof window==='undefined'||!window.location||
    ['v1','legacy'].includes(new URLSearchParams(window.location.search).get('workspace'))||
    typeof CCV2Handoff==='undefined'||typeof renderDashboard!=='function')return;
  const oldDashboard=renderDashboard;
  let active=null;
  const byId=id=>state.content.find(x=>String(x.id)===String(id)&&x.client_id===state.clientId);
  function element(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function add(parent,...children){children.forEach(child=>parent.appendChild(child));return parent;}
  function message(node,content,isError=false){node.textContent=content;node.className='ccv2-handoff-message'+(isError?' ccv2-handoff-error':'');}
  // Do not replace a visible editor containing unsaved changes, even for another material.
  function editorHasUnsavedChanges(){
    const drawer=$('contentDrawer');
    if(!drawer||!drawer.classList||!drawer.classList.contains('on'))return false;
    const opened=byId(state.selectedId);
    if(!opened)return true;
    const scheduled=typeof isoLocal==='function'?isoLocal(opened.scheduled_at):null;
    if(scheduled===null)return true;
    const expected={
      dTitle:String(opened.title??''),dBrief:String(opened.brief??''),
      dCaption:String(opened.caption??''),dStatus:String(opened.status??''),
      dDate:scheduled,dFormat:String(opened.format??''),dChannel:String(opened.channel??''),
      dAssignee:String(opened.assignee??''),dDue:typeof isoLocal==='function'?isoLocal(opened.due_at):'',
      dMedia:(Array.isArray(opened.media_urls)?opened.media_urls:[]).join('\n'),
      dTags:(Array.isArray(opened.tags)?opened.tags:[]).join(', ')
    };
    if(Object.entries(expected).some(([id,value])=>{
      const field=$(id);
      return !field||field.value!==value;
    }))return true;
    // The existing V4 editor also contains structured production brief inputs.
    // Fail closed when any of these values are missing or different from the saved material.
    const brief=opened.brief_data&&typeof opened.brief_data==='object'&&!Array.isArray(opened.brief_data)?opened.brief_data:{};
    const keys=['goal','audience','offer','key_points','references','cta','shoot_deadline','producer','editor'];
    return keys.some(key=>{
      const field=$('bd_'+key);
      return !field||field.value!==String(brief[key]??'');
    });
  }
  function renderPanel(item,request){
    const shell=$('dashboard')?.querySelector('.ccv2-shell');
    if(!shell)return;
    const existing=shell.querySelector('#ccv2-handoff');if(existing)existing.remove();
    const panel=element('section','ccv2-handoff-panel');panel.id='ccv2-handoff';
    panel.setAttribute('aria-label','Передача правок из ChatGPT');
    const head=element('div','ccv2-handoff-heading');
    const heading=element('h2','', 'ИИ-редактор материала');
    const close=element('button','ccv2-close-check','×');close.type='button';close.setAttribute('aria-label','Закрыть передачу правок');
    close.addEventListener('click',()=>{active=null;panel.remove();});
    const chat=element('button','ccv2-check ccv2-chat-open','Открыть ChatGPT');
    chat.type='button';chat.setAttribute('aria-label','Открыть ChatGPT в новой вкладке');
    chat.addEventListener('click',()=>{window.open('https://chatgpt.com/','_blank','noopener,noreferrer');});
    add(head,heading,chat,close);
    const generate=element('button','ccv2-check ccv2-generate-button','✦ Создать с ИИ');
    generate.type='button';generate.id='ccv2GenerateButton';
    generate.setAttribute('aria-label','Подготовить текст автоматически для выбранного материала и клиента');
    head.appendChild(generate);
    const intro=element('p','ccv2-handoff-help','Клиент: '+String(currentClient()?.name||'')+'. Материал: «'+String(item.title||'Без названия')+'». ИИ берёт Бренд-ДНК этого клиента с сервера, предлагает черновик, а сохранение всегда выполняете вы. Без серверного API-ключа доступен ручной режим.');
    const promptLabel=element('label','ccv2-handoff-label','1. Скопируйте задание с Бренд-ДНК в ChatGPT');
    const prompt=element('textarea','ccv2-handoff-textarea');prompt.readOnly=true;prompt.value=request.textPrompts.caption;prompt.rows=5;promptLabel.appendChild(prompt);
    const copy=element('button','ccv2-check','Скопировать задание');copy.type='button';
    const replyLabel=element('label','ccv2-handoff-label','2. Вставьте готовый текст от ChatGPT');
    const reply=element('textarea','ccv2-handoff-textarea');reply.placeholder='Вставьте обычный готовый текст. Формат JSON больше не обязателен.';reply.maxLength=28000;reply.rows=5;replyLabel.appendChild(reply);
    const choices=element('div','ccv2-handoff-options');
    const modeWrap=element('span','ccv2-handoff-option');
    const modeTitle=element('span','','Формат ответа');
    const mode=element('select','ccv2-handoff-select');mode.id='ccv2-handoff-mode';
    mode.setAttribute('aria-label','Формат ответа ChatGPT');
    for(const [value,label] of [['text','Обычный текст'],['json','JSON · несколько полей']]){
      const option=element('option','',label);option.value=value;mode.appendChild(option);
    }
    mode.value='text';add(modeWrap,modeTitle,mode);
    const fieldWrap=element('span','ccv2-handoff-option');
    const fieldTitle=element('span','','Куда перенести');
    const field=element('select','ccv2-handoff-select');field.id='ccv2-handoff-field';
    field.setAttribute('aria-label','Поле для переноса ответа');
    for(const [value,label] of [['caption','Текст публикации'],['brief','Бриф'],['title','Заголовок']]){
      const option=element('option','',label);option.value=value;field.appendChild(option);
    }
    field.value='caption';add(fieldWrap,fieldTitle,field);
    add(choices,modeWrap,fieldWrap);replyLabel.appendChild(choices);
    const check=element('button','ccv2-check','Проверить ответ');check.type='button';
    const status=element('p','ccv2-handoff-message','Внесённые здесь правки ещё не сохранены в Content Center.');status.setAttribute('role','status');
    const diff=element('div','ccv2-handoff-diff');
    const transfer=element('button','ccv2-create','Перенести в редактор');transfer.type='button';transfer.disabled=true;
    add(panel,head,intro,promptLabel,copy,replyLabel,check,status,diff,transfer);
    shell.appendChild(panel);panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    function resetValidation(){
      transfer.disabled=true;diff.replaceChildren();
      message(status,'После изменения текста или выбора поля выполните проверку ещё раз.');
    }
    function updatePrompt(){
      const json=mode.value==='json';
      fieldWrap.hidden=json;
      reply.placeholder=json?'Вставьте JSON-ответ с идентификаторами из задания':'Вставьте обычный готовый текст, без JSON';
      prompt.value=json?request.prompt:request.textPrompts[field.value];
      reply.value='';
      resetValidation();
    }
    mode.addEventListener('change',updatePrompt);
    field.addEventListener('change',updatePrompt);
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(prompt.value);message(status,'Задание скопировано. Откройте ChatGPT, вставьте его и затем верните ответ в поле ниже.');}
      catch{prompt.focus();prompt.select();message(status,'Скопируйте выделенный текст задания вручную.');}
    });
    const resolve=()=>{
      if(!active||active.request.ticket.request_id!==request.ticket.request_id)throw Error('Задание больше не активно');
      const current=byId(item.id);
      const params={ticket:request.ticket,baseline:request.baseline,clientId:state.clientId,item:current};
      return mode.value==='json'
        ?CCV2Handoff.parseReply(reply.value,params)
        :CCV2Handoff.parseTextReply(reply.value,{...params,field:field.value});
    };
    reply.addEventListener('input',()=>{transfer.disabled=true;diff.replaceChildren();message(status,'После изменения ответа выполните проверку ещё раз.');});
    check.addEventListener('click',()=>{
      try{
        const result=resolve();diff.replaceChildren();
        for(const [key,value] of Object.entries(result.changes)){
          const names={title:'Название',brief:'Бриф',caption:'Текст публикации'};
          const block=element('div','ccv2-handoff-change');
          const name=element('strong','',names[key]);
          const before=element('p','ccv2-handoff-before','Было: '+String(item[key]||''));
          const after=element('p','ccv2-handoff-after','Станет: '+value);
          add(block,name,before,after);diff.appendChild(block);
        }
        transfer.disabled=false;message(status,'Проверьте изменения. Перенос только заполнит поля редактора — сохранение выполняется отдельно.');
      }catch(error){transfer.disabled=true;diff.replaceChildren();message(status,error.message||'Не удалось проверить ответ',true);}
    });
    generate.addEventListener('click',async()=>{
      if(generate.disabled)return;
      if(!state.session?.access_token){
        message(status,'Сессия истекла. Войдите в Content Center ещё раз.',true);return;
      }
      if(mode.value!=='text'){
        message(status,'Для автоматической генерации переключите формат ответа на «Обычный текст».',true);return;
      }
      if(reply.value.trim()){
        message(status,'В поле уже есть текст. Скопируйте его и очистите поле перед новой генерацией, чтобы не потерять правки.',true);return;
      }
      const current=byId(item.id);
      if(!current||state.clientId!==request.ticket.client_id||
         !active||active.request.ticket.request_id!==request.ticket.request_id||
         CCV2Handoff.snapshot(current)!==request.baseline){
        message(status,'Карточка изменилась. Откройте ИИ-редактор заново.',true);return;
      }
      const target=field.value;
      generate.disabled=true;generate.textContent='Генерация…';
      message(status,'Проверяем подключение ИИ, права клиента и дневной лимит. Материал не изменяется.');
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),26000);
      try{
        const res=await fetch(SUPABASE_URL+'/functions/v1/generate-content-draft',{
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,
            'Authorization':'Bearer '+state.session.access_token},
          signal:controller.signal,
          body:JSON.stringify({
            client_id:request.ticket.client_id,content_item_id:request.ticket.content_item_id,
            request_id:request.ticket.request_id,field:target,baseline:request.baseline
          })
        });
        let data=null;
        try{data=await res.json();}catch{}
        if(!res.ok||!data?.ok)throw Error(data?.message||
          'Генерация сейчас недоступна. Используйте кнопку «Скопировать задание».');
        if(!active||active.request.ticket.request_id!==request.ticket.request_id||
           state.clientId!==request.ticket.client_id||field.value!==target||
           mode.value!=='text'||reply.value.trim()||
           data.client_id!==request.ticket.client_id||
           data.content_item_id!==request.ticket.content_item_id||
           data.request_id!==request.ticket.request_id||data.field!==target||
           data.baseline!==request.baseline||
           CCV2Handoff.snapshot(byId(item.id))!==request.baseline)
          throw Error('Карточка или режим изменились во время генерации. Текст не перенесён.');
        CCV2Handoff.parseTextReply(data.text,{
          ticket:request.ticket,baseline:request.baseline,
          clientId:state.clientId,item:byId(item.id),field:target
        });
        reply.value=data.text;
        reply.dispatchEvent(new Event('input',{bubbles:true}));
        check.click();
        if(!transfer.disabled)message(status,'Черновик готов. Сравните с исходным текстом, проверьте факты и нажмите «Перенести в редактор». Сохранение отдельно.');
      }catch(error){
        message(status,error?.name==='AbortError'?
          'Время ожидания ИИ истекло. Проверьте подключение и повторите позже.':
          error.message||'Не удалось создать текст. Используйте ручной режим.',true);
      }finally{
        clearTimeout(timeout);
        generate.disabled=false;generate.textContent='✦ Создать с ИИ';
      }
    });
    transfer.addEventListener('click',()=>{
      try{
        if(transfer.disabled)return;
        const result=resolve();
        if(editorHasUnsavedChanges())throw Error('В открытом редакторе есть несохранённые правки. Сохраните или отмените их перед переносом.');
        if(!window.confirm('Перенести проверенные поля в редактор этого материала?'))return;
        if(editorHasUnsavedChanges())throw Error('Редактор изменился. Сначала сохраните существующие правки.');
        openDrawer(result.contentId);
        if(state.selectedId!==result.contentId)throw Error('Редактор открыл другой материал. Перенос отменён.');
        const current=byId(result.contentId);
        if(!current||CCV2Handoff.snapshot(current)!==result.baseline)throw Error('Карточка изменилась. Подготовьте новый запрос.');
        const fields={title:'dTitle',brief:'dBrief',caption:'dCaption'};
        for(const [key,fieldId] of Object.entries(fields)){
          if(!Object.hasOwn(result.changes,key))continue;
          const input=$(fieldId);
          if(!input||input.value!==String(current[key]??''))throw Error('В редакторе уже есть несохранённые правки. Сохраните их отдельно, затем повторите перенос.');
        }
        for(const [key,value] of Object.entries(result.changes)){
          const input=$(fields[key]);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
        }
        transfer.disabled=true;
        message(status,'Поля перенесены в редактор. Проверьте текст и нажмите «Сохранить» в карточке. Перед публикацией проверьте факты и согласование.');
      }catch(error){transfer.disabled=true;message(status,error.message||'Перенос не выполнен',true);}
    });
  }
  function open(id){
    if(!state.session||!state.clientId)return;
    const item=byId(id),client=currentClient();
    if(!item||!client)return;
    try{
      const request=CCV2Handoff.buildRequest({client,item,requestId:crypto.randomUUID()});
      active={request,clientId:state.clientId,contentId:item.id};
      renderPanel(item,request);
    }catch(error){toast(error.message||'Нельзя подготовить задание для этой карточки',true);}
  }
  function enhance(){
    const dashboard=$('dashboard');if(!dashboard||!state.session||!state.clientId)return;
    if(active&&active.clientId!==state.clientId)active=null;
    dashboard.querySelectorAll('[data-ccv2-open]').forEach(button=>{
      const controls=button.parentElement,id=button.dataset.ccv2Open;
      if(!controls||controls.querySelector('[data-ccv2-handoff]'))return;
      const create=element('button','ccv2-check','ChatGPT → карточка');
      create.type='button';create.dataset.ccv2Handoff=id;
      create.setAttribute('aria-label','Подготовить правки через ChatGPT для материала');
      create.addEventListener('click',()=>open(id));controls.prepend(create);
    });
  }
  renderDashboard=function(){oldDashboard();enhance();};
  if(state.session&&state.clientId)enhance();
})();
