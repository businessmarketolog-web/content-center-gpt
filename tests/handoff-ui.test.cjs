const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const uiSource=fs.readFileSync(path.join(root,'v2/handoff-ui.js'),'utf8');
const contractSource=fs.readFileSync(path.join(root,'v2/handoff-contract.js'),'utf8');
const contractScope={};vm.runInNewContext(contractSource,contractScope);
const clientId='11111111-1111-4111-8111-111111111111';
const itemId='22222222-2222-4222-8222-222222222222';
const foreignId='33333333-3333-4333-8333-333333333333';
function el(tag){return {tag,children:[],dataset:{},value:'',addEventListener(name,callback){this.listeners??={};this.listeners[name]=callback;},setAttribute(){},appendChild(child){this.children.push(child);child.parentElement=this;},prepend(child){this.children.unshift(child);child.parentElement=this;},remove(){this.removed=true;},querySelector(){return null;},replaceChildren(){this.children=[];},dispatchEvent(event){this.dispatched??=[];this.dispatched.push(event.type);},scrollIntoView(){},focus(){},select(){}};}
function env({enabled=true,signedIn=true,selected='one'}={}){
 const control=el('div');control.querySelector=selector=>selector==='[data-ccv2-handoff]'?control.children.find(child=>child.dataset?.ccv2Handoff)||null:null;const cardButton=el('button');cardButton.dataset.ccv2Open=selected==='foreign'?foreignId:itemId;cardButton.parentElement=control;
 const shell=el('section');
 const dashboard={querySelectorAll(selector){return selector==='[data-ccv2-open]'?[cardButton]:[];},querySelector(selector){return selector==='.ccv2-shell'?shell:null;}};
 const state={session:signedIn?{user:{id:'owner'}}:null,clientId:signedIn?clientId:null,content:[
  {id:itemId,client_id:clientId,status:'draft',title:'Пост',brief:'',caption:'Текст'},
  {id:foreignId,client_id:'99999999-9999-4999-8999-999999999999',status:'draft',title:'Секрет'}]};
 const fields={dTitle:el('input'),dBrief:el('textarea'),dCaption:el('textarea')};fields.dTitle.value=state.content[0].title;fields.dBrief.value=state.content[0].brief;fields.dCaption.value=state.content[0].caption;
 const scope={window:{location:{search:enabled?'?workspace=v2':''},confirm(){return true}},URLSearchParams,CCV2Handoff:contractScope.CCV2Handoff,
  state,currentClient(){return {id:clientId,name:'Клиент'}},renderDashboard(){},
  $:id=>id==='dashboard'?dashboard:fields[id]||null,document:{createElement:el},crypto:{randomUUID:()=> '44444444-4444-4444-8444-444444444444'},
  Event:class{constructor(type){this.type=type;}},openDrawer(id){state.selectedId=id;},
  toast(){},console,navigator:{clipboard:{writeText:async()=>{}}}};
 return {scope,control,cardButton,dashboard,shell,fields};
}
test('new UI is opt-in and does not modify default dashboard',()=>{
 const v=env({enabled:false});const original=v.scope.renderDashboard;
 vm.runInNewContext(uiSource,v.scope);
 assert.equal(v.scope.renderDashboard,original);assert.equal(v.control.children.length,0);
});
test('owner card gains one manual handoff button, without duplication on rerender',()=>{
 const v=env();vm.runInNewContext(uiSource,v.scope);assert.equal(v.control.children.length,1);
 assert.match(v.control.children[0].textContent,/ChatGPT/);
 v.scope.renderDashboard();assert.equal(v.control.children.length,1);
});
test('unsigned user and foreign client cannot open a handoff',()=>{
 const unsigned=env({signedIn:false});vm.runInNewContext(uiSource,unsigned.scope);
 assert.equal(unsigned.control.children.length,0);
 const foreign=env({selected:'foreign'});vm.runInNewContext(uiSource,foreign.scope);
 assert.equal(foreign.control.children.length,1);
 foreign.control.children[0].listeners.click();
 assert.equal(foreign.shell.children.length,0);
});
test('opening own draft builds in-memory transfer UI without any database call',()=>{
 const v=env();vm.runInNewContext(uiSource,v.scope);
 const button=v.control.children[0];button.listeners.click();
 assert.equal(v.shell.children.length,1);
 const panel=v.shell.children[0];assert.equal(panel.id,'ccv2-handoff');
 assert.equal(panel.children[0].children[0].textContent,'Правки через ChatGPT');
 assert.equal(v.scope.state.content[0].caption,'Текст');
});

test('validated GPT reply only stages text in existing editor and never saves on behalf of owner',()=>{
 const v=env();vm.runInNewContext(uiSource,v.scope);
 v.control.children[0].listeners.click();
 const panel=v.shell.children[0];
 const reply=panel.children[4].children[0];
 reply.value=JSON.stringify({schema:'content-center-handoff/1',
  request_id:'44444444-4444-4444-8444-444444444444',client_id:clientId,
  content_item_id:itemId,changes:{caption:'Текст после ChatGPT'}});
 panel.children[5].listeners.click();
 const transfer=panel.children[8];assert.equal(transfer.disabled,false);
 transfer.listeners.click();
 assert.equal(v.fields.dCaption.value,'Текст после ChatGPT');
 assert.equal(v.scope.state.content[0].caption,'Текст');
 assert.equal(v.scope.state.selectedId,itemId);
 assert.match(panel.children[6].textContent,/нажмите «Сохранить»/);
});
