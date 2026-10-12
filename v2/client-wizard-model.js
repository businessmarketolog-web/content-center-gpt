/* V2 owner onboarding model for the existing canonical client form. No API or duplicate records. */
(function(root){
 'use strict';
 const STEPS=Object.freeze([
  {title:'Компания',fields:['name','business_type','description']},
  {title:'Соцсети',fields:['instagram','telegram']},
  {title:'Аудитория',fields:['audience']},
  {title:'Цели и голос',fields:['goals','tone']},
  {title:'Фирменный стиль',fields:['primary_font','accent_font']},
  {title:'Проверка',fields:[]}
 ].map(x=>Object.freeze({...x,fields:Object.freeze(x.fields)})));
 const LABELS=Object.freeze({name:'Название клиента',business_type:'Сфера деятельности',description:'Описание компании',instagram:'Instagram',telegram:'Telegram',audience:'Аудитория',goals:'Цели',tone:'Тон общения',primary_font:'Основной шрифт',accent_font:'Акцентный шрифт'});
 const MAX=Object.freeze({name:160,business_type:120,description:1500,instagram:250,telegram:250,audience:1500,goals:1500,tone:200,primary_font:120,accent_font:120});
 const clean=value=>String(value??'').trim();
 function validateStep(step,read){
  if(!Number.isInteger(step)||step<0||step>=STEPS.length||typeof read!=='function')throw Error('Неверный шаг настройки клиента');
  for(const key of STEPS[step].fields){
   const value=clean(read(key));
   if(value.length>MAX[key])throw Error('Превышена допустимая длина поля «'+LABELS[key]+'»');
   if(key==='name'&&(value.length<2||value.length>160))throw Error('Название клиента должно содержать от 2 до 160 символов');
  }
  return true;
 }
 function summarize(read){
  if(typeof read!=='function')throw Error('Невозможно прочитать настройки клиента');
  return Object.entries(LABELS).map(([key,label])=>({key,label,value:clean(read(key))||'Не указано'}));
 }
 root.CCV2ClientWizard=Object.freeze({STEPS,LABELS,validateStep,summarize});
})(typeof globalThis==='undefined'?this:globalThis);
