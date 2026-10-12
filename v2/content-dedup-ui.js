/* V2 only: warn before creating a similar content card, never silently block intentional series. */
(function(){
  'use strict';
  if(typeof window==='undefined'||!window.location||
     new URLSearchParams(window.location.search).get('workspace')!=='v2'||
     typeof addContent!=='function'||typeof CCV2Duplicate==='undefined')return;
  const original=addContent;
  addContent=async function(...args){
    if(!state?.session||!state.clientId)return original.apply(this,args);
    const title=$('fTitle')?.value;
    const format=$('fFormat')?.value;
    const channel=$('fChannel')?.value;
    const duplicates=CCV2Duplicate.matches({clientId:state.clientId,title,format,channel,content:state.content});
    if(duplicates.length){
      const proceed=window.confirm('У этого клиента уже есть '+duplicates.length+
        ' похожий материал (то же название, формат и канал). Проверьте существующую карточку, чтобы не создавать дубль. Создать ещё один материал намеренно?');
      if(!proceed){
        if(typeof toast==='function')toast('Создание отменено. Найдите существующую карточку в материалах.');
        return;
      }
    }
    return original.apply(this,args);
  };
})();
