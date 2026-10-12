const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'v2/client-wizard-model.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'v2/client-wizard-ui.js'),'utf8');
const modelScope={};vm.runInNewContext(source,modelScope);
const w=modelScope.CCV2ClientWizard;
const values={name:'  Travel Gallery  ',business_type:'Туризм',description:'Семейные поездки',instagram:'@travelgallery',telegram:'',audience:'Путешественники',goals:'Заявки',tone:'Спокойный',primary_font:'Evolventa',accent_font:'Liana'};
const read=key=>values[key];
test('six steps cover each existing client profile field exactly once',()=>{
 assert.equal(w.STEPS.length,6);
 const names=w.STEPS.flatMap(x=>Array.from(x.fields));
 assert.equal(new Set(names).size,10);
 assert.equal(names.length,10);
 assert.deepEqual(JSON.parse(JSON.stringify(names.sort())),Object.keys(values).sort());
});
test('valid owner client configuration passes without building any shadow record',()=>{
 for(let step=0;step<6;step++)assert.equal(w.validateStep(step,read),true);
 assert.equal(w.summarize(read).find(x=>x.key==='name').value,'Travel Gallery');
 assert.equal(w.summarize(read).find(x=>x.key==='telegram').value,'Не указано');
});
test('blank and oversized business identity cannot pass initial step',()=>{
 assert.throws(()=>w.validateStep(0,key=>key==='name'?' ':values[key]),/Название клиента/);
 assert.throws(()=>w.validateStep(0,key=>key==='name'?'a'.repeat(161):values[key]),/длина|Название клиента/);
 assert.throws(()=>w.validateStep(0,key=>key==='description'?'b'.repeat(1501):values[key]),/длина/);
});
test('invalid step and unknown read function reject instead of silently continuing',()=>{
 assert.throws(()=>w.validateStep(-1,read));
 assert.throws(()=>w.validateStep(7,read));
 assert.throws(()=>w.validateStep(0,null));
});
test('wizard UI is inactive without V2 opt-in and does not mutate original behavior',()=>{
 const fake={window:{location:{search:''}},URLSearchParams,CCV2ClientWizard:w,document:{getElementById(){throw Error('should never enter DOM')}}};
 assert.doesNotThrow(()=>vm.runInNewContext(ui,fake));
});
test('onboarding uses existing owner form, confirmation and submit rather than a new Supabase record',()=>{
 assert.match(ui,/clientFormV9/);
 assert.match(ui,/clientManagerSaveV9/);
 assert.match(ui,/stopImmediatePropagation/);
 assert.doesNotMatch(ui,/sb\.rpc|\.insert\(|fetch\(/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 for(const name of ['v2/client-wizard-model.js','v2/client-wizard-ui.js']){
  assert.ok(html.includes(name));assert.ok(worker.includes(name));
 }
});
