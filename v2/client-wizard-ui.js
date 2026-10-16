/* Six-step presentation of the existing owner client form. All saving stays in clients-v9.js via the same owner RPC. */
(function(){
 'use strict';
 if(typeof window==='undefined'||!window.location||['v1','legacy'].includes(new URLSearchParams(window.location.search).get('workspace'))||
    typeof document==='undefined'||typeof CCV2ClientWizard==='undefined')return;
 const M=CCV2ClientWizard;
 const form=document.getElementById('clientFormV9');
 const dialog=document.getElementById('clientManagerV9');
 const save=document.getElementById('clientManagerSaveV9');
 if(!form||!dialog||!save||form.dataset.ccv2Wizard==='1')return;
 const read=key=>document.getElementById('cm_'+key)?.value??'';
 const labels=[];
 for(const step of M.STEPS)for(const key of step.fields){
  const input=document.getElementById('cm_'+key);
  if(!input||!input.closest('label'))return;
  labels.push([key,input.closest('label')]);
 }
 const footer=save.closest('.client-manager-footer-v9');
 if(!footer)return;
 form.dataset.ccv2Wizard='1';
 const progress=document.createElement('div');progress.className='ccv2-client-progress';progress.setAttribute('aria-live','polite');
 form.parentNode.insertBefore(progress,form);
 const pages=M.STEPS.map((step,index)=>{
  const page=document.createElement('section');page.className='ccv2-client-step';page.hidden=index!==0;
  page.setAttribute('aria-label','Шаг '+(index+1)+': '+step.title);
  const title=document.createElement('h3');title.textContent=step.title;page.appendChild(title);
  for(const key of step.fields)page.appendChild(labels.find(pair=>pair[0]===key)[1]);
  form.insertBefore(page,footer);return page;
 });
 const summary=pages[5];
 const back=document.createElement('button');back.type='button';back.id='ccv2WizardBack';back.className='ghost';back.textContent='← Назад';
 const next=document.createElement('button');next.type='button';next.className='primary';next.textContent='Продолжить →';
 footer.insertBefore(back,save);footer.insertBefore(next,save);
 let current=0;
 function showError(error){if(typeof toast==='function')toast(String(error?.message||error),true);}
 function renderSummary(){
  summary.replaceChildren();
  const title=document.createElement('h3');title.textContent='Проверьте настройки перед сохранением';summary.appendChild(title);
  const list=document.createElement('dl');list.className='ccv2-client-summary';
  for(const entry of M.summarize(read)){
   const name=document.createElement('dt');name.textContent=entry.label;
   const value=document.createElement('dd');value.textContent=entry.value;
   list.appendChild(name);list.appendChild(value);
  }
  summary.appendChild(list);
  const note=document.createElement('p');note.textContent='Создаётся или редактируется единственная запись клиента. Данные сохраняются через действующую защищённую форму.';
  note.className='ccv2-client-note';summary.appendChild(note);
 }
 function paint(){
  pages.forEach((page,index)=>{page.hidden=index!==current;});
  back.hidden=current===0;next.hidden=current===5;save.hidden=current!==5;
  progress.textContent='Шаг '+(current+1)+' из '+M.STEPS.length+' · '+M.STEPS[current].title;
  if(current===5)renderSummary();
 }
 function goNext(){
  try{M.validateStep(current,read);if(current<M.STEPS.length-1)current++;paint();}
  catch(error){showError(error);}
 }
 next.addEventListener('click',goNext);
 back.addEventListener('click',()=>{current=Math.max(0,current-1);paint();});
 form.addEventListener('submit',event=>{
  if(current!==5){event.preventDefault();event.stopImmediatePropagation();goNext();return;}
  try{M.validateStep(0,read);}catch(error){event.preventDefault();event.stopImmediatePropagation();current=0;paint();showError(error);}
 },true);
 document.addEventListener('click',event=>{
  if(!event.target?.closest)return;
  if(event.target.closest('#clientCreateBtnV9,#clientSettingsBtnV9,#workflowNewClientV9,#workflowClientSettingsV9')){
   current=0;paint();
  }
 });
 paint();
})();
