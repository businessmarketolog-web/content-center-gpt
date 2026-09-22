/* Manual ChatGPT handoff for an existing owner's draft; no direct API/database writes. */
(function(){
  'use strict';
  if(typeof window==='undefined'||!window.location||
    new URLSearchParams(window.location.search).get('workspace')!=='v2'||
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
  function renderPanel(item,request){
    const shell=$('dashboard')?.querySelector('.ccv2-shell');
    if(!shell)return;
    const existing=shell.querySelector('#ccv2-handoff');if(existing)existing.remove();
    const panel=element('section','ccv2-handoff-panel');panel.id='ccv2-handoff';
    panel.setAttribute('aria-label','Передача правок из ChatGPT');
    const head=element('div','ccv2-handoff-heading');
    const heading=element('h2','', 'Правки через ChatGPT');
    const close=element('button','ccv2-close-check','×');close.type='button';close.setAttribute('aria-label','Закрыть передачу правок');
    close.addEventListener('click',()=>{active=null;panel.remove();});add(head,heading,close);
    const intro=element('p','ccv2-handoff-help','Работаем только с существующей карточкой «'+String(item.title||'Без названия')+'». Создание нового материала и автоматическая синхронизация здесь не выполняются.');
    const promptLabel=element('label','ccv2-handoff-label','1. Скопируйте задание в ChatGPT');
    const prompt=element('textarea','ccv2-handoff-textarea');prompt.readOnly=true;prompt.value=request.prompt;prompt.rows=5;promptLabel.appendChild(prompt);
    const copy=element('button','ccv2-check','Скопировать задание');copy.type='button';
    const replyLabel=element('label','ccv2-handoff-label','2. Вставьте ответ ChatGPT в формате JSON');
    const reply=element('textarea','ccv2-handoff-textarea');reply.placeholder='Ответ в формате JSON, без новых ID и статусов';reply.maxLength=28000;reply.rows=5;replyLabel.appendChild(reply);
    const check=element('button','ccv2-check','Проверить ответ');check.type='button';
    const status=element('p','ccv2-handoff-message','Внесённые здесь правки ещё не сохранены в Content Center.');status.setAttribute('role','status');
    const diff=element('div','ccv2-handoff-diff');
    const transfer=element('button','ccv2-create','Перенести в редактор');transfer.type='button';transfer.disabled=true;
    add(panel,head,intro,promptLabel,copy,replyLabel,check,status,diff,transfer);
    shell.appendChild(panel);panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(request.prompt);message(status,'Задание скопировано. Верните ответ ChatGPT в поле ниже.');}
      catch{prompt.focus();prompt.select();message(status,'Скопируйте выделенный текст задания вручную.');}
    });
    const resolve=()=>{
      if(!active||active.request.ticket.request_id!==request.ticket.request_id)throw Error('Задание больше не активно');
      const current=byId(item.id);
      return CCV2Handoff.parseReply(reply.value,{ticket:request.ticket,baseline:request.baseline,clientId:state.clientId,item:current});
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
    transfer.addEventListener('click',()=>{
      try{
        if(transfer.disabled)return;
        const result=resolve();
        if(!window.confirm('Перенести проверенные поля в редактор этого материала? Существующие несохранённые правки в редакторе нельзя заменять.'))return;
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
