const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const dataSrc=fs.readFileSync(path.join(root,'v2/content-dedup.js'),'utf8');
const uiSrc=fs.readFileSync(path.join(root,'v2/content-dedup-ui.js'),'utf8');
const model={};vm.runInNewContext(dataSrc,model);
const client='owner-client';
const item={id:'one',client_id:client,title:'  НОВИНКИ  Таиланда ',format:'Reels',channel:'Instagram',status:'draft'};
test('same client/title/format/channel is a possible duplicate after whitespace and case normalization',()=>{
 const result=model.CCV2Duplicate.matches({clientId:client,title:'новинки таиланда',format:'reels',channel:'Instagram',content:[item]});
 assert.equal(result.length,1);assert.equal(result[0].id,'one');
});
test('cross-client, archived and different channel or format never trigger duplicate warning',()=>{
 const variants=[{...item,client_id:'someone-else'}, {...item,archived_at:'2026-09-27'},
   {...item,format:'Stories'}, {...item,channel:'Telegram'}];
 assert.equal(model.CCV2Duplicate.matches({clientId:client,title:'новинки таиланда',format:'Reels',channel:'Instagram',content:variants}).length,0);
 assert.equal(model.CCV2Duplicate.matches({clientId:'',title:item.title,format:'Reels',channel:'Instagram',content:[item]}).length,0);
});
function scene({enabled=true,allow=false}={}){
 const fields={fTitle:{value:'Новинки Таиланда'},fFormat:{value:'Reels'},fChannel:{value:'Instagram'},saveAdd:{onclick:null}};
 let saves=0,questions=0;const scope={URLSearchParams,
  window:{location:{search:enabled?'?workspace=v2':'?workspace=v1'},confirm(){questions++;return allow;}},
  state:{session:{},clientId:client,content:[item]},CCV2Duplicate:model.CCV2Duplicate,
  addContent(){saves++;return Promise.resolve('saved');},$:id=>fields[id]||null,toast(){}};
 fields.saveAdd.onclick=scope.addContent; // matches the real app's early assignment
 vm.runInNewContext(uiSrc,scope);return {scope,stats:()=>({saves,questions})};
}
test('V2 duplicate warning stops accidental save when owner declines',async()=>{
 const s=scene();await s.scope.$('saveAdd').onclick();assert.equal(s.stats().saves,0);assert.equal(s.stats().questions,1);
});
test('explicit confirmation allows intentional similar recurring material',async()=>{
 const s=scene({allow:true});await s.scope.$('saveAdd').onclick();assert.equal(s.stats().saves,1);assert.equal(s.stats().questions,1);
});
test('non-V2 application keeps the original save routine unchanged',async()=>{
 const s=scene({enabled:false});await s.scope.$('saveAdd').onclick();assert.equal(s.stats().saves,1);assert.equal(s.stats().questions,0);
});
test('V2 assets are declared and refreshed in HTML and PWA cache',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 for(const name of ['content-dedup.js','content-dedup-ui.js']){
  assert.match(html,new RegExp(name.replace('.','\\.')));
  assert.match(worker,new RegExp(name.replace('.','\\.')));
 }
 assert.match(worker,/content-center-v25-20261016-virale1/);
});
