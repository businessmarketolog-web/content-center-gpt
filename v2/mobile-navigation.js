/* Content Center V2: iPhone-safe contextual back navigation.
 * Swipe right from left edge: form step -> active overlay -> previous section.
 * Never intercept native scrolling or edit gestures; no data writes.
 */
(function(root){
  'use strict';
  const EDGE_STANDALONE=76, EDGE_BROWSER=64, BROWSER_NATIVE_ZONE=24;
  const HORIZONTAL_THRESHOLD=82, VERTICAL_TOLERANCE=44;
  const BLOCKED='input,textarea,select,[contenteditable],[role="textbox"],[data-swipe-back-ignore],.menu,.media-filter-bar,.calendar-legend,.calendar-controls,.ccv2-handoff-options';
  const HISTORY_LIMIT=20;
  const history=[];
  let trackedClient=null;
  let returning=false;
  let start=null;
  let lastSwipeAt=0;
  const byId=id=>document.getElementById(id);
  const isOn=selector=>!!document.querySelector(selector);
  const isMobile=()=>root.innerWidth<=700;
  const standalone=()=>root.navigator?.standalone===true||root.matchMedia?.('(display-mode: standalone)')?.matches===true;

  function resetForClient(){
    const id=typeof state!=='undefined'?state.clientId:null;
    if(id!==trackedClient){history.length=0;trackedClient=id;}
  }
  function recordView(previous,next){
    resetForClient();
    if(returning||!previous||!next||previous===next)return;
    // One canonical previous section per step; a repeatedly chosen tab must not
    // create a phantom history entry.
    if(history[history.length-1]===next)history.pop();
    else{history.push(previous);if(history.length>HISTORY_LIMIT)history.shift();}
    updateButton();
  }
  function currentView(){
    return typeof state!=='undefined'&&state?state.view:'dashboard';
  }
  function hasOverlay(){
    return !!document.querySelector(
      '#clientManagerV9.on,#p2Modal.on,#contentDrawer.on,#contentModal.on,#mediaModal.on,#palette.on,.view.on #ccv2-handoff'
    );
  }
  function updateButton(){
    resetForClient();
    const button=byId('ccv2MobileSectionBack');
    if(!button)return;
    const visible=isMobile()&&history.length>0&&!hasOverlay()&&!(byId('authLayer')?.classList.contains('on'));
    button.hidden=!visible;
    button.setAttribute('aria-hidden',visible?'false':'true');
  }
  function changedDrawer(){
    const item=(typeof state!=='undefined'&&state?.content||[]).find(x=>x.id===state.selectedId);
    if(!item)return false;
    const pairs=[
      ['dTitle','title'],['dBrief','brief'],['dCaption','caption'],
      ['dStatus','status'],['dFormat','format'],['dChannel','channel']
    ];
    if(pairs.some(([id,key])=>byId(id)&&byId(id).value!==String(item[key]??'')))return true;
    const displayLocal=date=>typeof isoLocal==='function'?isoLocal(date):String(date??'');
    if(byId('dDate')&&byId('dDate').value!==displayLocal(item.scheduled_at))return true;
    if(byId('dDue')&&byId('dDue').value!==displayLocal(item.due_at))return true;
    if(byId('dAssignee')&&byId('dAssignee').value!==String(item.assignee??''))return true;
    if(byId('dTags')&&byId('dTags').value.trim()!==(Array.isArray(item.tags)?item.tags.join(', '):''))return true;
    const media=byId('dMedia');
    return !!(media&&media.value.trim()!==(
      Array.isArray(item.media_urls)?item.media_urls.join('\n'):''
    ).trim());
  }
  function changedNewContent(){
    return ['fTitle','fCaption','fMedia','fAssignee'].some(id=>byId(id)?.value?.trim())||
      !!byId('fDate')?.value||!!byId('fDue')?.value||
      !!byId('fPhotos')?.files?.length||
      !!(typeof state!=='undefined'&&state?.pendingFiles?.length);
  }
  function changedMedia(){
    return !!byId('assetName')?.value?.trim()||
      !!byId('assetUrl')?.value?.trim()||
      !!byId('assetFiles')?.files?.length||
      !!(typeof state!=='undefined'&&state?.libraryFiles?.length);
  }
  function changedClientForm(){
    const form=byId('clientFormV9');
    if(!form)return false;
    const current=typeof currentClient==='function'?currentClient():null;
    const edit=(byId('clientManagerTitleV9')?.textContent||'').includes('Настройки');
    return Array.from(form.querySelectorAll('input[id^="cm_"],textarea[id^="cm_"]')).some(node=>{
      const key=node.id.slice(3);
      const expected=edit&&current
        ?(key==='name'?current.name:key==='business_type'?current.business_type:current.brand_rules?.[key])
        :'';
      return node.value!==String(expected??'');
    });
  }
  function warn(message){
    return root.confirm(message);
  }
  function click(selector){
    const el=document.querySelector(selector);
    if(!el||el.disabled||el.hidden)return false;
    el.click();return true;
  }
  function back(){
    if(!isMobile()||byId('authLayer')?.classList.contains('on'))return false;
    // Higher z-index layers always take priority over cards behind them.
    if(isOn('#clientManagerV9.on')){
      const wizardBack=byId('ccv2WizardBack');
      if(wizardBack&&!wizardBack.hidden&&!wizardBack.disabled)return click('#ccv2WizardBack');
      if(changedClientForm()&&!warn('В настройках клиента есть несохранённые изменения. Выйти без сохранения?'))return false;
      return click('#clientManagerCloseV9');
    }
    if(isOn('#p2Modal.on')){
      const body=byId('p2Body');
      if(body&&Array.from(body.querySelectorAll('input,textarea')).some(n=>n.value?.trim())&&
        !warn('Есть введённые данные. Закрыть без сохранения?'))return false;
      if(typeof closeP2Modal==='function'){closeP2Modal();return true;}
      return false;
    }
    if(isOn('#contentDrawer.on')){
      if(changedDrawer()&&!warn('В карточке есть несохранённые правки. Вернуться без сохранения?'))return false;
      if(typeof closeDrawer==='function'){closeDrawer();return true;}
      return false;
    }
    if(isOn('#contentModal.on')){
      if(changedNewContent()&&!warn('Есть незавершённый материал. Закрыть форму? Сохранённый локальный черновик останется на устройстве.'))return false;
      if(typeof closeAdd==='function'){closeAdd();return true;}
      return false;
    }
    if(isOn('#mediaModal.on')){
      if(changedMedia()&&!warn('Есть несохранённые медиа. Закрыть форму?'))return false;
      if(typeof closeMediaModal==='function'){closeMediaModal();return true;}
      return false;
    }
    if(isOn('#palette.on')){
      if(typeof closePalette==='function'){closePalette();return true;}
      return false;
    }
    if(isOn('.view.on #ccv2-handoff')){
      return click('#ccv2-handoff .ccv2-close-check');
    }
    resetForClient();
    if(typeof show!=='function')return false;
    const previous=history.pop()||(currentView()!=='dashboard'?'dashboard':null);
    if(!previous){updateButton();return false;}
    returning=true;
    try{show(previous);}
    finally{returning=false;updateButton();}
    return true;
  }
  function horizontallyScrollable(node){
    for(let el=node;el&&el!==document.body&&el!==document.documentElement;el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+12){
        const style=root.getComputedStyle?.(el);
        if(style&&/auto|scroll/.test(style.overflowX))return true;
      }
    }
    return false;
  }
  function allowedStart(event){
    if(!isMobile()||!event.touches||event.touches.length!==1)return false;
    if(byId('authLayer')?.classList.contains('on'))return false;
    if(event.target?.closest?.(BLOCKED))return false;
    if(horizontallyScrollable(event.target))return false;
    const x=event.touches[0].clientX;
    return x>=(standalone()?0:BROWSER_NATIVE_ZONE)&&x<=(standalone()?EDGE_STANDALONE:EDGE_BROWSER);
  }
  function swipeValid(a,b,endedAt){
    if(!a||!b||endedAt-a.time>1100||endedAt-a.time<40)return false;
    const dx=b.x-a.x,dy=b.y-a.y;
    return dx>=HORIZONTAL_THRESHOLD&&Math.abs(dy)<=VERTICAL_TOLERANCE&&dx>Math.abs(dy)*1.65;
  }
  function onStart(event){
    start=allowedStart(event)
      ?{x:event.touches[0].clientX,y:event.touches[0].clientY,time:Date.now()}
      :null;
  }
  function onEnd(event){
    const original=start;start=null;
    if(!original||!event.changedTouches||event.changedTouches.length!==1)return;
    const at=Date.now();
    if(at-lastSwipeAt<450)return;
    const point={x:event.changedTouches[0].clientX,y:event.changedTouches[0].clientY};
    if(swipeValid(original,point,at)){
      if(back())lastSwipeAt=at;
    }
  }
  function init(){
    if(root.__ccMobileNavInstalled)return;
    root.__ccMobileNavInstalled=true;
    if(typeof root.show==='function'){
      const original=root.show;
      root.show=function(view){
        const previous=currentView();
        // record before re-rendering, so prior section is not lost.
        recordView(previous,view);
        const result=original.apply(this,arguments);
        updateButton();return result;
      };
    }
    const top=document.querySelector('.top-title');
    if(top&&!byId('ccv2MobileSectionBack')){
      const button=document.createElement('button');
      button.type='button';button.id='ccv2MobileSectionBack';
      button.className='ccv2-mobile-section-back';button.textContent='‹  Назад';
      button.setAttribute('aria-label','Вернуться к предыдущему разделу');
      button.hidden=true;
      button.addEventListener('click',back);
      top.insertBefore(button,top.firstChild);
    }
    const clientHead=document.querySelector('#clientManagerV9 .client-manager-head-v9');
    if(clientHead&&!byId('ccv2MobileClientBack')){
      const button=document.createElement('button');
      button.type='button';button.id='ccv2MobileClientBack';
      button.className='mobile-back ccv2-client-mobile-back';button.textContent='‹  Назад';
      button.addEventListener('click',back);
      clientHead.insertBefore(button,clientHead.firstChild);
    }
    // Capture existing inline back handlers to add unsaved-change protection.
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('.mobile-back');
      if(!button||button.id==='ccv2MobileClientBack'||!isMobile())return;
      if(!button.closest('#clientManagerV9,#p2Modal,#contentDrawer,#contentModal,#mediaModal,#palette'))return;
      event.preventDefault();event.stopImmediatePropagation();back();
    },true);
    document.addEventListener('touchstart',onStart,{passive:true});
    document.addEventListener('touchcancel',()=>{start=null;},{passive:true});
    document.addEventListener('touchend',onEnd,{passive:true});
    root.addEventListener('resize',updateButton,{passive:true});
    // Existing overlays are toggled by independent modules after asynchronous rendering.
    new MutationObserver(updateButton).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    updateButton();
  }
  root.CCMobileNav=Object.freeze({init,back,recordView,swipeValid,allowedStart});
  if(typeof document!=='undefined'&&typeof root.addEventListener==='function'&&
     !['v1','legacy'].includes(new URLSearchParams(root.location?.search||'').get('workspace')))init();
})(typeof window!=='undefined'?window:globalThis);
