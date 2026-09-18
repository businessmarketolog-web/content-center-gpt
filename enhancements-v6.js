
/* CONTENT CENTER ENHANCEMENTS V6 */
const __v6ChecklistForBase=checklistFor;
checklistFor=function(x){
  let list=(Array.isArray(x?.checklist)&&x.checklist.length?x.checklist:defaultChecklist(x||{})).map(i=>({...i}));
  const briefOk=Boolean(x?.brief_data&&Object.values(x.brief_data).some(v=>String(v||'').trim()));
  return list.map(i=>{
    if(i.id==='brief'&&briefOk)return {...i,done:true};
    if(i.id==='media'&&mediaCount(x)>0)return {...i,done:true};
    if((i.id==='caption'||i.id==='text')&&String(x?.caption||x?.brief||'').trim())return {...i,done:true};
    if(i.id==='approval'&&x?.client_approval_status==='approved')return {...i,done:true};
    return i;
  });
};
toggleChecklist=async function(id,index,done){
  const x=state.content.find(v=>v.id===id);if(!x)return;
  const list=checklistFor(x).map((i,n)=>n===index?{...i,done}:i);
  const open=list.filter(i=>i.required!==false&&!i.done);
  let status=x.status;
  if(!open.length&&['draft','production'].includes(status))status='review';
  if(open.length&&['review','approved'].includes(status))status='production';
  const r=await sb.from('content_items').update({checklist:list,status}).eq('id',id);
  if(r.error)return toast(r.error.message,true);
  toast(!open.length&&status==='review'?'Чек-лист завершён · материал передан на согласование':'Чек-лист обновлён');
  await loadClientData();openDrawer(id);
};

openBulkActions=function(){
  state.bulkSelected=new Set();
  openP2Modal('Массовые действия','BULK ACTIONS',
    '<div class="bulk-toolbar"><button class="ghost" onclick="bulkSelectAll()">Выбрать все</button><span id="bulkCount">0 выбрано</span></div>'+
    '<div class="bulk-list">'+bulkItems().map(x=>'<label class="bulk-row"><input type="checkbox" onchange="toggleBulk(\''+x.id+'\',this.checked)"><div><b>'+esc(x.title)+'</b><small>'+esc(x.format)+' · '+esc(x.channel)+' · '+esc(STATUS[x.status]||x.status)+'</small></div></label>').join('')+'</div>'+
    '<div class="bulk-controls">'+
      '<label>Статус<select class="input" id="bulkStatus"><option value="">Не менять</option>'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label>'+
      '<label>Канал<select class="input" id="bulkChannel"><option value="">Не менять</option><option>Instagram</option><option>Telegram</option></select></label>'+
      '<label>Дата и время публикации<input class="input" id="bulkDate" type="datetime-local"></label>'+
      '<label>Ответственный<input class="input" id="bulkAssignee" placeholder="Оставьте пустым, чтобы не менять"></label>'+
      '<label>Добавить тег<input class="input" id="bulkTag" placeholder="Например: акция"></label>'+
      '<label class="bulk-archive"><input type="checkbox" id="bulkArchive"> Переместить выбранные в архив</label>'+
      '<button class="primary" onclick="applyBulkActions()">Применить</button>'+
    '</div>');
};
applyBulkActions=async function(){
  const ids=[...state.bulkSelected];if(!ids.length)return toast('Выберите материалы',true);
  const status=$('bulkStatus')?.value||'',channel=$('bulkChannel')?.value||'',date=$('bulkDate')?.value||'',assignee=$('bulkAssignee')?.value.trim(),tag=$('bulkTag')?.value.trim(),archive=$('bulkArchive')?.checked;
  if(status&&['approved','scheduled'].includes(status)){
    const bad=ids.map(id=>state.content.find(x=>x.id===id)).filter(Boolean).filter(x=>readinessIssues({...x,status}).length);
    if(bad.length)return openP2Modal('Не все материалы готовы','READINESS CHECK','<div class="readiness-list">'+bad.map(x=>'<div>• '+esc(x.title)+' — '+esc(readinessIssues({...x,status}).join(', '))+'</div>').join('')+'</div>');
  }
  const update={};
  if(status)update.status=status;
  if(channel)update.channel=channel;
  if(date)update.scheduled_at=new Date(date).toISOString();
  if(assignee)update.assignee=assignee;
  if(archive){update.archived_at=new Date().toISOString();update.archived_by=state.session?.user?.id||null}
  if(Object.keys(update).length){const r=await sb.from('content_items').update(update).in('id',ids);if(r.error)return toast(r.error.message,true)}
  if(tag){
    for(const id of ids){
      const x=state.content.find(v=>v.id===id);if(!x)continue;
      const tags=[...new Set([...(x.tags||[]),tag])];
      const r=await sb.from('content_items').update({tags}).eq('id',id);if(r.error)return toast(r.error.message,true);
    }
  }
  closeP2Modal();toast('Массовое действие выполнено');await loadClientData();
};

let v6DeferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();v6DeferredInstallPrompt=e;injectEnhancementsV6()});
window.addEventListener('appinstalled',()=>{v6DeferredInstallPrompt=null;toast('Content Center установлен')});
function openInstallHelp(){
  const canPrompt=Boolean(v6DeferredInstallPrompt);
  const html='<div class="install-help">'+
    '<div class="install-device"><b>iPhone / iPad</b><span>Откройте Content Center в Safari → «Поделиться» → «На экран “Домой”» → «Добавить».</span></div>'+
    '<div class="install-device"><b>Android / компьютер</b><span>'+(canPrompt?'Браузер готов установить приложение прямо сейчас.':'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».')+'</span></div>'+
    (canPrompt?'<button class="primary" onclick="promptInstallV6()">Установить Content Center</button>':'')+
    '<p class="sub">После установки кабинет открывается в отдельном окне без адресной строки и быстрее запускается повторно.</p></div>';
  openP2Modal('Установить Content Center','PWA / APP',html);
}
async function promptInstallV6(){
  if(!v6DeferredInstallPrompt)return openInstallHelp();
  v6DeferredInstallPrompt.prompt();
  try{await v6DeferredInstallPrompt.userChoice}catch{}
  v6DeferredInstallPrompt=null;closeP2Modal();
}
function injectEnhancementsV6(){
  const dash=$('dashboard');
  if(dash&&!$('installQuickV6')){
    const q=dash.querySelector('.quick-grid');
    if(q)q.insertAdjacentHTML('beforeend','<button class="quick" id="installQuickV6" onclick="openInstallHelp()"><strong>▣ Установить</strong><span>Добавить Content Center на экран iPhone / Android</span></button>');
  }
  const inst=$('instructions');
  if(inst&&!$('installGuideV6'))inst.insertAdjacentHTML('afterbegin','<div class="card install-guide" id="installGuideV6"><div><div class="ey">PWA / MOBILE APP</div><h2>Установка на телефон</h2><p>Content Center можно открыть как отдельное приложение без адресной строки браузера.</p></div><button class="primary" onclick="openInstallHelp()">Как установить</button></div>');
}
const __v6RenderAllBase=renderAll;
renderAll=function(){__v6RenderAllBase();injectEnhancementsV6()};
setTimeout(injectEnhancementsV6,0);
