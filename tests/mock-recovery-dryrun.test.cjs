/* Synthetic recovery rehearsal ONLY. No Supabase credentials, endpoints or production data. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

const required=['clients','content_items','work_items','assets','content_backups'];
const mock={
  schema:'content-center/mock-recovery-v1',
  tables:{
    clients:[{id:'client-one',name:'Fictional Travel'},{id:'client-two',name:'Fictional Furniture'}],
    content_items:[{id:'post-1',client_id:'client-one',title:'Travel story',status:'draft',caption:'Synthetic text'},{id:'post-2',client_id:'client-two',title:'Furniture brief',status:'review'}],
    work_items:[{id:'task-1',client_id:'client-one',title:'Mock schedule'}],
    assets:[{id:'asset-1',client_id:'client-two',name:'Mock reference',url:'https://invalid.example/fake.jpg'}],
    content_backups:[{id:'backup-1',client_id:'client-one',source:'test',snapshot:{caption:'Old synthetic draft'}}]
  }
};
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function verify(snapshot){
  if(!snapshot||snapshot.schema!=='content-center/mock-recovery-v1')throw Error('Unexpected snapshot format');
  if(!snapshot.tables||typeof snapshot.tables!=='object')throw Error('Missing mock tables');
  for(const key of required)if(!Array.isArray(snapshot.tables[key]))throw Error('Incomplete mock backup: '+key);
  const clients=new Set();
  for(const c of snapshot.tables.clients){
    if(!c.id||clients.has(c.id))throw Error('Duplicate/missing client ID');
    clients.add(c.id);
  }
  for(const key of required.filter(k=>k!=='clients')){
    const ids=new Set();
    for(const row of snapshot.tables[key]){
      if(!row.id||ids.has(row.id))throw Error('Duplicate/missing row ID in '+key);
      ids.add(row.id);
      if(!clients.has(row.client_id))throw Error('Orphan or cross-client record in '+key);
    }
  }
  return true;
}
function simulateIsolatedRecovery(serialized,expectedDigest){
  const parsed=JSON.parse(serialized);
  if(digest(parsed)!==expectedDigest)throw Error('Backup checksum mismatch');
  verify(parsed);
  const staging=structuredClone(parsed); // separate in-memory staging object, no DB access
  if(digest(staging)!==expectedDigest)throw Error('Restore verification mismatch');
  return staging;
}
test('synthetic clients, materials, tasks, assets and backups survive serialization and isolated recovery',()=>{
  verify(mock);
  const baseline=digest(mock);
  const staging=simulateIsolatedRecovery(JSON.stringify(mock),baseline);
  assert.deepEqual(staging,mock);
  assert.notEqual(staging,mock);
  staging.tables.content_items[0].caption='Changed ONLY in staging';
  assert.equal(mock.tables.content_items[0].caption,'Synthetic text');
  assert.equal(digest(mock),baseline);
});
test('reject incomplete snapshots without creating a partial restored state',()=>{
  const bad=structuredClone(mock);delete bad.tables.work_items;
  assert.throws(()=>simulateIsolatedRecovery(JSON.stringify(bad),digest(bad)),/Incomplete mock backup/);
});
test('reject orphan client references in material and backup rows',()=>{
  for(const key of ['content_items','work_items','assets','content_backups']){
    const bad=structuredClone(mock);bad.tables[key][0].client_id='foreign-client';
    assert.throws(()=>simulateIsolatedRecovery(JSON.stringify(bad),digest(bad)),/Orphan or cross-client/);
  }
});
test('reject tampered serialization by SHA-256 integrity check',()=>{
  const original=digest(mock);const changed=structuredClone(mock);changed.tables.clients[0].name='Tampered';
  assert.throws(()=>simulateIsolatedRecovery(JSON.stringify(changed),original),/checksum mismatch/);
});
test('reject duplicate client and content IDs',()=>{
  const bad=structuredClone(mock);bad.tables.clients.push({...bad.tables.clients[0]});
  assert.throws(()=>simulateIsolatedRecovery(JSON.stringify(bad),digest(bad)),/Duplicate/);
  const badContent=structuredClone(mock);badContent.tables.content_items.push({...badContent.tables.content_items[0]});
  assert.throws(()=>simulateIsolatedRecovery(JSON.stringify(badContent),digest(badContent)),/Duplicate/);
});
