/* Content Center V8: owner-only ideas, project-scoped and stored in existing assets */
(function(){
'use strict';
const VIEW='ideas';
let search='';
function items(){return (state.assets||[]).filter(a=>a.client_id===state.clientId&&a.kind==='link');}
function idea(id){return items().find(a=>a.id===id);}
function safeUrl(u){try{const a=new URL(u);return ['http:','https:'].includes(a.protocol)?a.href:'';}catch{return '';}}
function card(a){
 const note=typeof a.metadata?.idea_note==='string'?a.metadata.idea_note:'';
 const tags=Array.isArray(a.metadata?.idea_tags)?a.metadata.idea_tags:[];
 const href=safeUrl(a.url),host=href?new URL(href).hostname:'Недоступная ссылка';
 return '<article class="idea-card"><small>'+esc(host)+'</small><h3>'+esc(a.name||'Без названия')+'</h3>'+
 (note?'<p>'+esc(note)+'</p>':'<p class="sub">Добавьте заметку к следующему референсу.</p>')+
 '<div class="idea-tags">'+tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>'+
 '<div class="idea-buttons">'+
 (href?'<button type="button" class="ghost" data-ref-open="'+esc(a.id)+'">Открыть ссылку</button>':'')+
 '<button type="button" class="primary" data-ref-draft="'+esc(a.id)+'">Создать материал</button></div></article>';
}
function cards(){
 const root=document.getElementById('ideaCardsV8');if(!root)return;
 const q=search.toLocaleLowerCase('ru').trim();
 const filtered=items().filter(a=>[a.name,a.url,a.metadata?.idea_note,...(Array.isArray(a.metadata?.idea_tags)?a.metadata.idea_tags:[])].join(' ').toLocaleLowerCase('ru').includes(q));
 root.innerHTML=filtered.map(card).join('')||'<div class="card idea-empty">Идей пока нет. Добавьте первую ссылку.</div>';
 document.getElementById('ideaCountV8').textContent='Найдено: '+filtered.length;
 root.querySelectorAll('[data-ref-open]').forEach(b=>b.addEventListener('click',()=>openIdeaV8(b.dataset.refOpen)));
 root.querySelectorAll('[data-ref-draft]').forEach(b=>b.addEventListener('click',()=>ideaToDraftV8(b.dataset.refDraft)));
}
function render(){
 const root=document.getElementById(VIEW);if(!root||!state.session||!state.clientId)return;
 root.innerHTML='<div class="idea-hero"><h2>Идеи и референсы</h2><p>Сохраняйте ссылки и заметки отдельно для каждого проекта. Из любой идеи можно создать материал.</p></div>'+
 '<form id="ideaFormV8" class="card idea-form">'+
 '<label>Название идеи<input id="ideaTitleV8" class="input" maxlength="160" required placeholder="Обзор отеля за 30 секунд"></label>'+
 '<label>Ссылка<input id="ideaUrlV8" class="input" type="url" required placeholder="https://..."></label>'+
 '<label>Что использовать<textarea id="ideaNoteV8" class="input" maxlength="2000" rows="3" placeholder="Структура, кадры, текст, призыв"></textarea></label>'+
 '<label>Теги через запятую<input id="ideaTagsV8" class="input" maxlength="250" placeholder="Reels, отель, семья"></label>'+
 '<button id="ideaSaveV8" class="primary" type="submit">Сохранить идею</button></form>'+
 '<div class="idea-search"><h3>Сохранённые ссылки</h3><input id="ideaSearchV8" class="input" type="search" placeholder="Найти идею"><small id="ideaCountV8"></small></div>'+
 '<div id="ideaCardsV8" class="idea-grid"></div>';
 document.getElementById('ideaFormV8').addEventListener('submit',save);
 const field=document.getElementById('ideaSearchV8');field.value=search;field.addEventListener('input',e=>{search=e.target.value;cards();});
 cards();
}
async function save(e){
 e.preventDefault();
 if(!state.session||!state.clientId)return;
 const btn=document.getElementById('ideaSaveV8');
 const name=document.getElementById('ideaTitleV8').value.trim();
 const url=safeUrl(document.getElementById('ideaUrlV8').value.trim());
 const note=document.getElementById('ideaNoteV8').value.trim();
 const tags=document.getElementById('ideaTagsV8').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12);
 if(!name||!url)return toast('Укажите название и корректную ссылку',true);
 btn.disabled=true;btn.textContent='Сохраняю…';
 try{
  const result=await sb.from('assets').insert({client_id:state.clientId,name,kind:'link',url,metadata:{source:'idea_library',idea_note:note,idea_tags:tags}});
  if(result.error)throw result.error;
  toast('Идея сохранена');await loadClientData();
 }catch(err){toast(err.message||'Не удалось сохранить идею',true);}
 finally{btn.disabled=false;btn.textContent='Сохранить идею';}
}
window.openIdeaV8=function(id){const a=idea(id),url=a&&safeUrl(a.url);if(url)window.open(url,'_blank','noopener,noreferrer');else toast('Ссылка недоступна',true);};
window.ideaToDraftV8=function(id){
 const a=idea(id);if(!a)return toast('Идея не найдена',true);
 openAdd();
 if($('fTitle'))$('fTitle').value=a.name||'Материал по идее';
 if($('fCaption'))$('fCaption').value=(a.metadata?.idea_note||'')+'\n\nРеференс: '+a.url;
 if(typeof saveNewLocalDraft==='function')saveNewLocalDraft();
 toast('Черновик подготовлен. Проверьте поля и сохраните материал.');
};
if(!NAV.some(x=>x[0]===VIEW)){
 const i=NAV.findIndex(x=>x[0]==='library');
 NAV.splice(i<0?NAV.length:i+1,0,[VIEW,'И','Идеи']);
}
const anchor=document.getElementById('today')||document.getElementById('dashboard');
if(anchor&&!document.getElementById(VIEW))anchor.insertAdjacentHTML('afterend','<section class="view" id="ideas"></section>');
const baseShow=show;
show=function(v){baseShow(v);if(v===VIEW)render();};
const baseRender=renderAll;
renderAll=function(){baseRender();if(state.view===VIEW)render();};
const baseSearch=renderPalette;
renderPalette=function(q){
 baseSearch(q);
 if(!q||!String(q).trim()||!$('paletteResults'))return;
 const value=String(q).toLocaleLowerCase('ru');
 const found=items().filter(a=>[a.name,a.url,a.metadata?.idea_note,...(Array.isArray(a.metadata?.idea_tags)?a.metadata.idea_tags:[])].join(' ').toLocaleLowerCase('ru').includes(value)).slice(0,5);
 if(!found.length)return;
 const root=$('paletteResults'),empty=root.querySelector('.empty');if(empty)empty.remove();
 const container=document.createElement('div');container.className='idea-search-matches';
 container.innerHTML='<small>Референсы</small>'+found.map(a=>'<button class="idea-search-item" type="button" data-idea-id="'+esc(a.id)+'">'+esc(a.name||a.url)+'</button>').join('');
 root.appendChild(container);
 container.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{search=(idea(btn.dataset.ideaId)||{}).name||'';closePalette();show(VIEW);}));
};
renderNav();
})();
