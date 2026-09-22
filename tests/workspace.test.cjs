const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const modelSrc=fs.readFileSync(path.join(root,'v2/workspace-model.js'),'utf8');
const uiSrc=fs.readFileSync(path.join(root,'v2/workspace.js'),'utf8');
function model(){const scope={};vm.runInNewContext(modelSrc,scope);return scope.CCV2Model;}
const now=Date.UTC(2026,8,23,12);
const same=(status,title='Тест',date=now+86400000)=>({id:status+title,client_id:'one',status,title,scheduled_at:new Date(date).toISOString()});
test('read-only model strictly isolates each client, including empty ID',()=>{
  const content=[same('review','А'),{...same('failed','Чужой'),client_id:'two'}];
  const original=JSON.stringify(content);
  const one=model().buildWorkspaceModel({clientId:'one',content,now});
  assert.equal(one.total,1);assert.equal(one.failed,0);assert.equal(one.review,1);
  assert.equal(one.actions.length,1);assert.equal(one.actions[0].title,'А');
  assert.equal(model().buildWorkspaceModel({content,now}).total,0);
  assert.equal(JSON.stringify(content),original);
});
test('priority order, status counts and upcoming week are derived from cards',()=>{
  const content=[same('draft','С'),same('review','Б'),same('approved','В'),
    same('failed','А'),same('scheduled','Д',now+2*86400000),same('published','Е'),
    same('approved','За пределами недели',now+9*86400000)];
  const out=model().buildWorkspaceModel({clientId:'one',content,now});
  assert.equal(out.total,7);assert.equal(out.failed,1);assert.equal(out.review,1);
  assert.equal(out.approved,2);assert.equal(out.plannedWeek,5);
  assert.equal(out.actions[0].status,'failed');assert.equal(out.actions[1].status,'review');
  assert.equal(out.actions.some(x=>x.status==='published'),false);
});
test('invalid dates do not leak into schedule',()=>{
  const content=[{...same('approved'),scheduled_at:'not-a-date'}];
  const out=model().buildWorkspaceModel({clientId:'one',content,now});
  assert.equal(out.plannedWeek,0);assert.equal(out.upcoming.length,0);
});
test('HTML escaping covers markup and attribute injection',()=>{
  assert.equal(model().escapeHtml('<img src=x onerror="boom">'),
    '&lt;img src=x onerror=&quot;boom&quot;&gt;');
  assert.equal(model().escapeHtml("Tom & O'Neil"),'Tom &amp; O&#39;Neil');
});
test('new workspace stays opt-in and does not change default live UI',()=>{
  const baseline=function baseline(){};
  const scope={window:{location:{search:''}},URLSearchParams,renderDashboard:baseline,CCV2Model:model(),document:{}};
  vm.runInNewContext(uiSrc,scope);
  assert.equal(scope.renderDashboard,baseline);
});
test('preview renders selected client only, with escaped title and honest publication note',()=>{
  const dashboard={innerHTML:'',querySelectorAll(){return []},querySelector(){return null}};
  const scope={window:{location:{search:'?workspace=v2'}},
    URLSearchParams,document:{documentElement:{classList:{add(){}}}},
    state:{session:{user:{id:'owner'}},clientId:'one',content:[
      {...same('review','<script>alert(1)</script>')},
      {...same('failed','Чужой клиент'),client_id:'two'}],publishQueue:[]},
    CCV2Model:model(),renderDashboard(){},$:id=>id==='dashboard'?dashboard:null,
    currentClient(){return {name:'Тестовый клиент'}},show(){},openDrawer(){},openAdd(){},console};
  vm.runInNewContext(uiSrc,scope);
  assert.match(dashboard.innerHTML,/Тестовый клиент/);
  assert.match(dashboard.innerHTML,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(dashboard.innerHTML,/<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(dashboard.innerHTML,/Чужой клиент/);
  assert.match(dashboard.innerHTML,/Фактическую отправку/);
});
