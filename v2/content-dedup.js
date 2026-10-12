/* V2 optional duplicate warning: never creates shadow records or writes to storage. */
(function(root){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru');
  function matches({clientId,title,format,channel,content}={}){
    if(!clientId||!normalize(title)||!normalize(format)||!normalize(channel))return [];
    return (Array.isArray(content)?content:[]).filter(item=>item&&
      item.client_id===clientId&&!item.archived_at&&
      normalize(item.title)===normalize(title)&&
      normalize(item.format)===normalize(format)&&
      normalize(item.channel)===normalize(channel));
  }
  root.CCV2Duplicate=Object.freeze({matches});
})(typeof globalThis==='undefined'?this:globalThis);
