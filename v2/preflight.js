/* CC V2 preflight: deterministic, read-only warnings. Not factual verification. */
(function(root){
  'use strict';
  const LABELS=Object.freeze({
    missing_title:'Нет названия материала',
    missing_media:'Нет прикреплённого медиа для визуального формата',
    missing_text:'Не указан текст публикации — проверьте, нужен ли он для этой площадки',
    missing_schedule:'Не указаны дата и время запланированной публикации',
    invalid_media_url:'Один из адресов медиа не использует HTTPS',
    placeholder:'В тексте обнаружен возможный незаполненный шаблон',
    verify_claims:'Проверьте актуальность дат, цен и условий по первоисточнику',
    approval_proof:'Перед публикацией подтвердите одобрение именно текущей версии материала',
    publishing_proof:'Статус карточки сам по себе не подтверждает доставку на площадку'
  });
  function evaluate(item){
    const findings=[];
    if(!item||typeof item!=='object')return {findings:[{code:'missing_item',message:'Материал не найден',level:'attention'}],automatedFactCheck:false};
    const title=String(item.title||'').trim();
    const body=String(item.caption||'').trim();
    const brief=String(item.brief||'').trim();
    const media=Array.isArray(item.media_urls)?item.media_urls.filter(x=>typeof x==='string'&&x.trim()):[];
    const format=String(item.format||'').toLowerCase();
    const status=String(item.status||'').toLowerCase();
    const channel=String(item.channel||'').toLowerCase();
    const add=(code,level='attention')=>findings.push({code,message:LABELS[code],level});
    if(!title)add('missing_title');
    if(/reels|stories|carousel|карусел|рилс|сторис/.test(format)&&media.length===0)add('missing_media');
    if(!body&&(channel.includes('telegram')||channel.includes('instagram')))add('missing_text','review');
    if(status==='scheduled'&&!Number.isFinite(new Date(item.scheduled_at||'').getTime()))add('missing_schedule');
    if(media.some(url=>!/^https:\/\//i.test(url)))add('invalid_media_url');
    if(/\b(?:TODO|TBD|LOREM|INSERT HERE)\b|\[(?:встав|указать|добав|цена|дата)[^\]]{0,45}\]|\{\{[^{}]{1,80}\}\}/i.test(title+' '+body+' '+brief))add('placeholder');
    if(/(?:\b20\d{2}\b|\b\d[\d\s.,]*\s*(?:₽|руб(?:лей|ля|\.)?|\$|€|USD|EUR)|\b(?:безвиз|скидка|акция|открыти[ея]|гарантир|бесплатн)\w*)/i.test(title+' '+body+' '+brief))add('verify_claims','review');
    if(['approved','scheduled'].includes(status))add('approval_proof','review');
    if(status==='published')add('publishing_proof','review');
    return {findings,automatedFactCheck:false};
  }
  root.CCV2Preflight=Object.freeze({evaluate,LABELS});
})(typeof globalThis==='undefined'?this:globalThis);
