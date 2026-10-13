/* V2 owner onboarding model for the existing canonical client form. No API or duplicate records. */
(function(root){
 'use strict';
 const STEPS=Object.freeze([
  {title:'Компания',fields:['name','business_type','description','positioning']},
  {title:'Соцсети',fields:['instagram','telegram','format_rules']},
  {title:'Аудитория',fields:['audience','interests','pain_points']},
  {title:'Тексты и стратегия',fields:['goals','tone','writing_rules','taboo_phrases','cta_style','content_pillars','content_mix','approved_examples']},
  {title:'Фирменный визуал',fields:['primary_font','accent_font','brand_colors','typography_rules','visual_style','overlay_rules']},
  {title:'Проверка',fields:[]}
 ].map(x=>Object.freeze({...x,fields:Object.freeze(x.fields)})));
 const LABELS=Object.freeze({
  name:'Название клиента',business_type:'Сфера деятельности',description:'Описание компании',
  positioning:'Позиционирование',instagram:'Instagram',telegram:'Telegram',format_rules:'Правила форматов',
  audience:'Аудитория',interests:'Интересы аудитории',pain_points:'Боли и возражения',
  goals:'Цели',tone:'Тон общения',writing_rules:'Правила текстов',taboo_phrases:'Запрещённые фразы',
  cta_style:'Призывы к действию',content_pillars:'Рубрики контента',content_mix:'Распределение контента',
  approved_examples:'Утверждённые примеры',primary_font:'Основной шрифт',accent_font:'Акцентный шрифт',
  brand_colors:'Цвета бренда',typography_rules:'Правила типографики',visual_style:'Визуальный стиль',
  overlay_rules:'Текст на сторис и подложки'
 });
 const MAX=Object.freeze({
  name:160,business_type:120,description:1500,positioning:900,
  instagram:250,telegram:250,format_rules:1500,audience:1500,interests:1200,pain_points:1200,
  goals:1500,tone:200,writing_rules:1400,taboo_phrases:900,cta_style:600,
  content_pillars:1200,content_mix:1000,approved_examples:1400,
  primary_font:120,accent_font:120,brand_colors:350,typography_rules:1100,visual_style:1400,overlay_rules:1100
 });
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
