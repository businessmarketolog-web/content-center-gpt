/* Manual handoff from ChatGPT into an existing material. Never stores credentials or writes to an API. */
(function(root){
  'use strict';
  const SCHEMA='content-center-handoff/1';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ALLOWED=new Set(['title','brief','caption']);
  function fail(message){throw new Error(message);}
  function assertId(id){if(typeof id!=='string'||!UUID.test(id))fail('Некорректный идентификатор материала или клиента');}
  function snapshot(item){return JSON.stringify([
    String(item?.title??''),String(item?.brief??''),String(item?.caption??''),
    String(item?.status??''),String(item?.updated_at??'')]);}
  function buildRequest({client,item,requestId}){
    if(!client||!item||client.id!==item.client_id)fail('Материал относится к другому клиенту');
    assertId(client.id);assertId(item.id);assertId(requestId);
    if(item.archived_at||!['draft','production'].includes(item.status))fail('Материал в архиве, согласовании или публикации нельзя изменять через импорт');
    const ticket={schema:SCHEMA,request_id:requestId,client_id:client.id,content_item_id:item.id};
    const original={title:String(item.title??''),brief:String(item.brief??''),caption:String(item.caption??'')};
    const prompt='Ты готовишь правки ТОЛЬКО к существующему материалу Content Center. Не создавай нового клиента или материала. '+
      'Клиент: '+String(client.name||'')+'. Действующий материал: '+JSON.stringify(original)+'. '+
      'Верни только JSON без Markdown и пояснений в формате '+JSON.stringify({...ticket,changes:{title:'Новое название (если меняется)',brief:'Новый бриф (если меняется)',caption:'Новый текст (если меняется)'}})+
      '. В changes включай только действительно изменённые поля, не добавляй статус, цены от себя, URL медиа или идентификаторы других материалов. '+
      'Проверь факты и помечай неподтверждённое в тексте для ручной проверки.';
    return {ticket,baseline:snapshot(item),prompt};
  }
  function parseReply(input,{ticket,baseline,clientId,item}){
    if(typeof input!=='string'||input.length>28000)fail('Размер ответа превышает допустимый предел');
    const text=input.trim().replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```\s*$/,'');
    let reply;try{reply=JSON.parse(text);}catch{fail('Ответ должен быть корректным JSON');}
    if(!reply||typeof reply!=='object'||Array.isArray(reply))fail('Ожидается JSON-объект');
    const required=['schema','request_id','client_id','content_item_id','changes'];
    if(Object.keys(reply).some(key=>!required.includes(key))||required.some(key=>!Object.hasOwn(reply,key)))fail('В ответе есть недопустимые или отсутствующие поля');
    if(reply.schema!==SCHEMA||reply.request_id!==ticket?.request_id)fail('Ответ относится к другой задаче');
    if(!clientId||reply.client_id!==clientId||reply.client_id!==ticket.client_id||reply.content_item_id!==ticket.content_item_id||reply.content_item_id!==item?.id||item.client_id!==clientId)fail('Клиент или материал не совпадает с открытой карточкой');
    if(item.archived_at||!['draft','production'].includes(item.status))fail('Материал больше не является активным черновиком или материалом в производстве');
    if(snapshot(item)!==baseline)fail('Материал изменился после подготовки задания. Создайте новый запрос в ChatGPT');
    const changes=reply.changes;
    if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!ALLOWED.has(key)))fail('Разрешены только изменённые поля title, brief, caption');
    const normalized={};
    for(const [key,value] of Object.entries(changes)){
      const limit=key==='title'?240:16000;
      if(typeof value!=='string'||value.length>limit)fail('Неверный тип или размер поля '+key);
      const next=value.trim();
      if(key==='title'&&!next)fail('Название материала не может быть пустым');
      if(next!==String(item[key]??'').trim())normalized[key]=next;
    }
    if(!Object.keys(normalized).length)fail('В ответе нет изменений относительно текущей версии');
    return Object.freeze({clientId,contentId:item.id,baseline,changes:Object.freeze(normalized)});
  }
  root.CCV2Handoff=Object.freeze({buildRequest,parseReply,snapshot});
})(typeof globalThis==='undefined'?this:globalThis);
