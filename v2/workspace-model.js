/* Content Center v2: pure, read-only workspace model. No API calls or persistence. */
(function(root){
  'use strict';
  const PRIORITY=Object.freeze({failed:0,review:1,approved:2,scheduled:3,production:4,draft:5});
  const TERMINAL=new Set(['published','archived']);
  const day=24*60*60*1000;
  const safeDate=(value)=>{
    if(!value)return null;
    const n=new Date(value).getTime();
    return Number.isFinite(n)?n:null;
  };
  const escapeHtml=(value)=>String(value==null?'':value).replace(/[&<>"']/g,
    character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function buildWorkspaceModel({clientId,client,content,queue,now}={}){
    const moment=Number.isFinite(Number(now))?Number(now):Date.now();
    const items=(Array.isArray(content)?content:[]).filter(item=>
      item&&typeof item==='object'&&!item.archived_at&&
      (Boolean(clientId)&&item.client_id===clientId));
    const count=status=>items.filter(item=>item.status===status).length;
    const weekly=items.filter(item=>{
      const time=safeDate(item.scheduled_at);
      return time!==null && time>=moment && time<moment+7*day && !TERMINAL.has(item.status);
    });
    const pending=items.filter(item=>Object.prototype.hasOwnProperty.call(PRIORITY,item.status));
    const actions=pending.slice().sort((a,b)=>{
      const diff=PRIORITY[a.status]-PRIORITY[b.status];
      if(diff)return diff;
      const aDate=safeDate(a.due_at)||safeDate(a.scheduled_at)||Infinity;
      const bDate=safeDate(b.due_at)||safeDate(b.scheduled_at)||Infinity;
      return aDate-bDate||String(a.title||'').localeCompare(String(b.title||''),'ru');
    }).slice(0,7).map(item=>({
      id:String(item.id||''),title:String(item.title||'Без названия'),
      status:String(item.status||'draft'),format:String(item.format||''),
      channel:String(item.channel||''),dueAt:item.due_at||item.scheduled_at||null
    }));
    const recentQueue=(Array.isArray(queue)?queue:[]).filter(entry=>
      entry&&Boolean(clientId)&&entry.client_id===clientId);
    return {
      clientName:String(client&&client.name||'Клиент не выбран'),clientId:clientId||null,
      total:items.length,review:count('review'),approved:count('approved'),
      failed:count('failed'),production:count('production'),
      publishedByCard:count('published'),plannedWeek:weekly.length,
      actions,upcoming:weekly.slice().sort((a,b)=>safeDate(a.scheduled_at)-safeDate(b.scheduled_at)).slice(0,5).map(item=>({
        id:String(item.id||''),title:String(item.title||'Без названия'),
        status:String(item.status||''),scheduledAt:item.scheduled_at,channel:String(item.channel||'')
      })),queueAttempts:recentQueue.length
    };
  }
  root.CCV2Model=Object.freeze({buildWorkspaceModel,escapeHtml});
})(typeof globalThis==='undefined'?this:globalThis);
