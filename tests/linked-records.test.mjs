import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {commitLinkedRecords} from '../scripts/local/linked-records.mjs';
import {recordRevision} from '../lib/record-revision.mjs';

const context=async()=>{const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const connection=await openDatabase(mkdtempSync(resolve(base,'linked-')));await migrate(connection.db);return connection;};
const row=async(db,entity,key)=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();
const count=async(db,entity)=>(await db.prepare('SELECT count(*) AS n FROM app_records WHERE entity=?').bind(entity).first()).n;
const actor={login:'test-admin'};
const save=(db,kind,operations,catalog=[])=>commitLinkedRecords(db,{kind,operations},actor,{catalog});

test('BOM confirmation saves change and BOM together and rejects a stale source with no partial commit',async()=>{
 const c=await context();try{
  const catalog=[{key:'SKU-1',payload:{code:'SKU-1',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}}];
  const original={sku:'SKU-1',items:[],status:'Nháp'};
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('bom','SKU-1',JSON.stringify(original),'fixture','fixture').run();
  const revision=await recordRevision(JSON.stringify(original));
  const operations=[{entity:'bom_change',key:'CHANGE-1',payload:{id:'CHANGE-1',sku:'SKU-1',status:'Đã xác nhận'},expectedRevision:null},{entity:'bom',key:'SKU-1',payload:{...original,status:'Đã xác nhận',changeDocument:'CHANGE-1'},expectedRevision:revision}];
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='SKU-1'").bind(JSON.stringify({...original,items:[{sku:'CHANGED'}]})).run();
  await assert.rejects(save(c.db,'bom-change',operations,catalog),error=>error.status===409);
  assert.equal(await row(c.db,'bom_change','CHANGE-1'),null);
  assert.equal(await count(c.db,'admin_audit'),0);
  operations[1].expectedRevision=await recordRevision((await row(c.db,'bom','SKU-1')).payload);
  const result=await save(c.db,'bom-change',operations,catalog);
  assert.equal(result.records.length,2);
  assert.equal(JSON.parse((await row(c.db,'bom','SKU-1')).payload).changeDocument,'CHANGE-1');
  assert.equal(await count(c.db,'admin_audit'),2);
  assert.equal(await count(c.db,'linked_write_guard'),0);
  await assert.rejects(save(c.db,'bom-change',operations,catalog),error=>error.status===409);
  assert.equal(await count(c.db,'admin_audit'),2);
 }finally{await c.close();}
});

test('Leadtime transition and audit commit together, including concurrent conflict',async()=>{
 const c=await context();try{
  const catalog=[{key:'SKU-1',payload:{code:'SKU-1',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}}];
  const draft={id:'LT-1',sku:'SKU-1',status:'Chờ xác nhận',leadTime:4};
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('leadtime_versions','LT-1',JSON.stringify(draft),'fixture','fixture').run();
  const revisions=await recordRevision(JSON.stringify(draft));
  const body=[{entity:'leadtime_versions',key:'LT-1',payload:{...draft,status:'Đang áp dụng'},expectedRevision:revisions,audit:{action:'Xác nhận'}},{entity:'leadtime_versions',key:'LT-2',payload:{id:'LT-2',sku:'SKU-1',leadTime:5,status:'Hết hiệu lực'},expectedRevision:null,audit:{action:'Hết hiệu lực'}}];
  const results=await Promise.allSettled([save(c.db,'leadtime',body,catalog),save(c.db,'leadtime',body,catalog)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
  assert.equal(await count(c.db,'leadtime_audit'),2);
  assert.equal(await count(c.db,'admin_audit'),2);
  assert.equal(await count(c.db,'linked_write_guard'),0);
 }finally{await c.close();}
});

test('Safety group transaction rejects stale linked rule without changing confirmation or history',async()=>{
 const c=await context();try{
  const linked={id:'S-1',status:'Đang áp dụng'};
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('safety_rules','S-1',JSON.stringify(linked),'fixture','fixture').run();
  const ops=[{entity:'safety_rule_groups',key:'S-1',payload:{id:'S-1',status:'Đang áp dụng'},expectedRevision:null,audit:{type:'Xác nhận'}},{entity:'safety_rules',key:'S-1',payload:{...linked,status:'Hết hiệu lực'},expectedRevision:'stale',audit:{type:'Kết thúc'}}];
  await assert.rejects(save(c.db,'safety-group',ops),error=>error.status===409);
  assert.equal(await row(c.db,'safety_rule_groups','S-1'),null);
  assert.equal(await count(c.db,'safety_rule_audit'),0);
  ops[1].expectedRevision=await recordRevision(JSON.stringify(linked));
  await save(c.db,'safety-group',ops);
  assert.equal(await count(c.db,'safety_rule_audit'),2);
 }finally{await c.close();}
});
