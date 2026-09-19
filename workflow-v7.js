/* CONTENT CENTER WORKFLOW V7 */
(function(){
  const TODAY_VIEW='today';

  function isSameDayV7(a,b){
    if(!a||!b)return false;
    const x=new Date(a),y=new Date(b);
    return x.getFullYear()===y.getFullYear()&&x.getMonth()===y.getMonth()&&x.getDate()===y.getDate();
  }
  function itemIssuesV7(x){
    try{return typeof readinessIssues==='function'?readinessIssues(x):[]}catch{return []}
  }
  function workflowNextV7(x){
    if(!x)return '';
    if(x.status==='failed')return 'Исправить ошибку публикации';
    if(x.status==='draft')return 'Заполнить материал и перевести в работу';
    if(x.status==='production')return 'Завершить подготовку и отправить на согласование';
    if(x.status==='review')return 'Получить решение клиента';
    if(x.status==='approved')return x.scheduled_at?'Проверить дату и подготовить публикацию':'Назначить дату публикации';
    if(x.status==='scheduled')return 'Проверить готовность перед публикацией';
    if(x.status==='published')return 'Добавить результаты и при необходимости сделать новую версию';
    return 'Открыть материал';
  }
  function taskCardV7(x,label){
    const issues=itemIssuesV7(x);
    return '<article class="today-task" onclick="openDrawer(\''+x.id+'\')">'+
      '<div class="today-task-top"><div><small>'+esc(label)+'</small><b>'+esc(x.title||'Без названия')+'</b></div>'+
      '<span class="today-status">'+esc(STATUS[x.status]||x.status||'Материал')+'</span></div>'+
      '<div class="today-meta">'+esc(x.channel||'Без канала')+' · '+esc(x.format||'Без формата')+
      (x.scheduled_at?' · публикация '+esc(fmtDate(x.scheduled_at)):'')+
      (x.due_at?' · дедлайн '+esc(dueLabel(x.due_at)):'')+'</div>'+
      '<div class="today-next"><b>Следующий шаг:</b> '+esc(workflowNextV7(x))+'</div>'+
      (issues.length?'<div class="today-warning">Нужно исправить: '+issues.map(esc).join(', ')+'</div>':'')+
      '<button class="ghost today-open" type="button" onclick="event.stopPropagation();openDrawer(\''+x.id+'\')">Открыть материал</button>'+
    '</article>';
  }
  function todayCountV7(){
    const now=new Date();
    const failedIds=new Set((state.publishQueue||[]).filter(q=>q.status==='failed').map(q=>q.content_item_id));
    return (state.content||[]).filter(x=>
      (x.due_at&&new Date(x.due_at)<now&&x.status!=='published')||
      x.status==='review'||x.status==='failed'||failedIds.has(x.id)||
      isSameDayV7(x.scheduled_at,now)
    ).length;
  }

  if(!NAV.some(x=>x[0]===TODAY_VIEW))NAV.splice(1,0,[TODAY_VIEW,'Д','Сегодня']);
  const dashboard=document.getElementById('dashboard');
  if(dashboard&&!document.getElementById(TODAY_VIEW))dashboard.insertAdjacentHTML('afterend','<section class="view" id="today"></section>');

  const baseNavCountV7=navCount;
  navCount=function(v){if(v===TODAY_VIEW)return todayCountV7();return baseNavCountV7(v)};

  function renderTodayV7(){
    const root=document.getElementById(TODAY_VIEW);if(!root||!state.session||!state.clientId)return;
    const now=new Date();
    const items=state.content||[];
    const failedQueue=(state.publishQueue||[]).filter(q=>q.status==='failed');
    const failedIds=new Set(failedQueue.map(q=>q.content_item_id));
    const overdue=items.filter(x=>x.due_at&&new Date(x.due_at)<now&&x.status!=='published');
    const review=items.filter(x=>x.status==='review');
    const publishReady=items.filter(x=>['approved','scheduled'].includes(x.status)&&itemIssuesV7(x).length===0);
    const failed=items.filter(x=>x.status==='failed'||failedIds.has(x.id));
    const today=items.filter(x=>isSameDayV7(x.scheduled_at,now)&&!failed.some(f=>f.id===x.id));
    const syncPending=(state.syncEvents||[]).filter(x=>!x.delivered_at);
    const syncText=syncPending.length?
      'Есть '+syncPending.length+' изменений, которые ещё не отмечены как доставленные.':
      'Очередь изменений сейчас пуста.';
    const empty='<div class="today-empty">Сейчас здесь ничего нет.</div>';
    root.innerHTML=
      '<section class="today-hero"><div><div class="ey">РАБОЧИЙ ДЕНЬ</div><h2>Что нужно сделать сегодня</h2><p>Здесь собраны только действия, которые требуют внимания владельца.</p></div>'+
      '<div class="today-actions">'+
        '<button class="primary" onclick="openAdd()">Создать материал</button>'+
        '<button class="ghost" onclick="show(\'library\')">Открыть медиатеку</button>'+
        '<button class="ghost" onclick="show(\'approvals\')">Открыть согласование</button>'+
        '<button class="ghost" onclick="show(\'publishing\')">Открыть публикации</button>'+
      '</div></section>'+
      '<div class="today-summary">'+
        '<div><b>'+overdue.length+'</b><span>просрочено</span></div>'+
        '<div><b>'+review.length+'</b><span>ждёт согласования</span></div>'+
        '<div><b>'+publishReady.length+'</b><span>можно публиковать</span></div>'+
        '<div><b>'+failed.length+'</b><span>с ошибкой</span></div>'+
      '</div>'+
      '<div class="today-grid">'+
        '<section class="today-column urgent"><div class="today-column-head"><h3>Просрочено</h3><span>'+overdue.length+'</span></div>'+(overdue.map(x=>taskCardV7(x,'Требует внимания')).join('')||empty)+'</section>'+
        '<section class="today-column"><div class="today-column-head"><h3>Ждёт согласования</h3><span>'+review.length+'</span></div>'+(review.map(x=>taskCardV7(x,'Согласование')).join('')||empty)+'</section>'+
        '<section class="today-column"><div class="today-column-head"><h3>Можно публиковать</h3><span>'+publishReady.length+'</span></div>'+(publishReady.map(x=>taskCardV7(x,'Готово к публикации')).join('')||empty)+'</section>'+
        '<section class="today-column danger"><div class="today-column-head"><h3>Ошибка публикации</h3><span>'+failed.length+'</span></div>'+(failed.map(x=>taskCardV7(x,'Нужно исправить')).join('')||empty)+'</section>'+
      '</div>'+
      '<section class="today-lower">'+
        '<div class="card today-panel"><div class="ey">ПЛАН НА СЕГОДНЯ</div><h3>Публикации сегодня</h3>'+
          (today.length?today.map(x=>taskCardV7(x,'Сегодня')).join(''):empty)+'</div>'+
        '<div class="card today-panel"><div class="ey">CHATGPT</div><h3>Связь с чатом</h3><p>'+esc(syncText)+'</p>'+
          '<div class="today-panel-actions"><button class="primary" onclick="copyGPT()">Скопировать контекст для ChatGPT</button>'+
          '<button class="ghost" onclick="openSyncJournalV7()">Открыть журнал изменений</button></div>'+
          '<small>Автоматическая двусторонняя доставка считается подтверждённой только после реального сквозного теста.</small></div>'+
      '</section>';
  }

  const baseShowV7=show;
  show=function(v){baseShowV7(v);if(v===TODAY_VIEW)renderTodayV7()};

  const baseRenderAllV7=renderAll;
  renderAll=function(){baseRenderAllV7();renderTodayV7()};

  window.openSyncJournalV7=function(){
    const rows=(state.syncEvents||[]).slice(0,30);
    const body=rows.length?rows.map(x=>
      '<div class="sync-row"><div><b>'+esc(x.event_type||'Изменение')+'</b><span>'+esc(fmtDate(x.created_at))+'</span></div>'+
      '<span class="'+(x.delivered_at?'sync-ok':'sync-wait')+'">'+(x.delivered_at?'Доставлено':'Ожидает доставки')+'</span></div>'
    ).join(''):'<div class="today-empty">Изменений в журнале пока нет.</div>';
    openP2Modal('Журнал изменений','CHATGPT SYNC','<div class="sync-journal">'+body+'</div>');
  };

  window.createChannelVersionV7=async function(id,targetChannel){
    const x=itemById(id);if(!x)return;
    if(!confirm('Создать отдельную версию материала для '+targetChannel+'?'))return;
    const row={
      client_id:state.clientId,
      title:(x.title||'Материал')+' — '+targetChannel,
      format:x.format||'Post',
      channel:targetChannel,
      status:'draft',
      scheduled_at:null,
      caption:x.caption||'',
      brief:x.brief||null,
      media_urls:Array.isArray(x.media_urls)?x.media_urls:[],
      tags:Array.isArray(x.tags)?x.tags:[],
      priority:x.priority||'normal',
      campaign_id:x.campaign_id||null
    };
    const res=await sb.from('content_items').insert(row).select('id').single();
    if(res.error){toast(res.error.message,true);return}
    toast('Создана версия для '+targetChannel);
    await loadClientData();
    openDrawer(res.data.id);
  };

  function augmentDrawerV7(id){
    const body=document.getElementById('drawerBody');if(!body||body.querySelector('.reuse-v7'))return;
    const x=itemById(id);if(!x)return;
    const other=x.channel==='Telegram'?'Instagram':'Telegram';
    body.insertAdjacentHTML('beforeend',
      '<section class="drawer-section reuse-v7"><div class="ey">ПОВТОРНОЕ ИСПОЛЬЗОВАНИЕ</div><h3>Сделать версию для другой площадки</h3>'+
      '<p>Будет создан новый черновик с тем же исходным текстом и медиа. Исходный материал останется без изменений.</p>'+
      '<button class="ghost" onclick="createChannelVersionV7(\''+id+'\',\''+other+'\')">Создать версию для '+other+'</button></section>'
    );
  }
  const baseOpenDrawerV7=openDrawer;
  openDrawer=function(id){baseOpenDrawerV7(id);setTimeout(()=>augmentDrawerV7(id),0)};

  renderNav();
  renderTodayV7();
})();

/* DIRECT MEDIA UPLOAD V7 */
(function(){
  previewPendingPhotos=function(){
    const box=$('photoPreview');if(!box)return;
    box.innerHTML=state.pendingFiles.map((f,i)=>{
      const u=URL.createObjectURL(f);
      const preview=f.type.startsWith('video/')?'<video src="'+u+'" muted playsinline></video>':'<img src="'+u+'" alt="">';
      return '<div class="photo-preview">'+preview+'<button type="button" onclick="removePendingPhoto('+i+')">Удалить</button><span>'+esc(f.name)+'</span></div>';
    }).join('');
  };
  addPhotoFiles=function(files){
    const incoming=[...files].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
    const merged=[...state.pendingFiles];
    const tooLarge=[];
    incoming.forEach(f=>{
      const max=f.type.startsWith('video/')?52428800:15728640;
      if(f.size>max){tooLarge.push(f.name);return}
      if(!merged.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))merged.push(f);
    });
    state.pendingFiles=merged.slice(0,10);
    if(tooLarge.length)toast('Некоторые файлы слишком большие и не добавлены',true);
    previewPendingPhotos();
  };
  uploadPendingPhotos=async function(){
    const urls=[],assets=[];
    for(const file of state.pendingFiles){
      const safe=file.name.toLowerCase().replace(/[^a-z0-9а-яё._-]+/gi,'-').replace(/^-+|-+$/g,'');
      const path=state.clientId+'/'+Date.now()+'-'+crypto.randomUUID().slice(0,8)+'-'+safe;
      const up=await sb.storage.from('content-assets').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(up.error)throw up.error;
      const pub=sb.storage.from('content-assets').getPublicUrl(path);
      const url=pub.data.publicUrl;urls.push(url);
      assets.push({client_id:state.clientId,name:file.name,kind:file.type.startsWith('video/')?'video':'image',url,metadata:{storage_path:path,size:file.size,mime:file.type}});
    }
    return {urls,assets};
  };
})();
