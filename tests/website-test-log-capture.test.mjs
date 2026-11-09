import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {mutateInventoryImport} from '../scripts/local/inventory-import.mjs';
import {saveEngine} from '../scripts/local/engine.mjs';
import {engineSourceRevisions} from '../lib/engine-effective-basis.mjs';
import {readWebsiteTestLog} from '../lib/website-test-log.mjs';
const actor={login:'TEST-OPERATOR',userId:'TEST-ID'},week='2026-10-12';
const upload={action:'upload',sourceFile:'TEST.xlsx',rows:[{sku:'SKU1',name:'Test product',warehouse:'TP',qty:3}]};
async function fixture(){const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'mutation-capture-')));await migrate(c.db);return c;}
const count=async(db,entity)=>(await db.prepare('SELECT count(*) AS n FROM app_records WHERE entity=?').bind(entity).first()).n;
const logs=async db=>(await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").all()).results.map(r=>JSON.parse(r.payload));
async function seedEngine(c){await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku','SKU1',JSON.stringify({code:'SKU1',name:'Test',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}),'fixture','fixture').run();return{sourceRevisions:await engineSourceRevisions(c.db),payload:{week,rows:[{id:'row1',sku:'SKU1'}],metrics:[['row1',{}]]}};}
test('inventory upload/cancel logs committed before/after once; rejected repeat does not log',async()=>{
 const c=await fixture();try{
  const result=await mutateInventoryImport(c.db,upload,actor);let entries=await logs(c.db);assert.equal(entries.length,1);assert.equal(entries[0].before,null);assert.equal(entries[0].after.status,'Chờ chốt');assert.equal(entries[0].actorId,'TEST-ID');
  await mutateInventoryImport(c.db,{action:'cancel',key:result.record.key},actor);entries=await logs(c.db);assert.equal(entries.length,2);const cancellation=entries.find(e=>e.action==='cancel');assert.equal(cancellation.before.status,'Chờ chốt');assert.equal(cancellation.after._deleted,true);
  await assert.rejects(()=>mutateInventoryImport(c.db,{action:'cancel',key:result.record.key},actor));assert.equal((await logs(c.db)).length,2);
  const visible=await readWebsiteTestLog(c.db);assert.deepEqual(new Set(visible.entries.map(e=>e.action)),new Set(['add','delete']));
 }finally{await c.close();}
});
test('inventory commit logs both real records and replacement; duplicate commit creates no events',async()=>{
 const c=await fixture();try{
  const first=await mutateInventoryImport(c.db,upload,actor);const committed=await mutateInventoryImport(c.db,{action:'commit',key:first.record.key,week},actor);
  assert.equal((await logs(c.db)).length,3);await assert.rejects(()=>mutateInventoryImport(c.db,{action:'commit',key:first.record.key,week},actor));assert.equal((await logs(c.db)).length,3);
  const opened={...committed.snapshot,status:'Đã mở chốt'};await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='inventory_snapshot' AND record_key=?").bind(JSON.stringify(opened),opened.id).run();
  const second=await mutateInventoryImport(c.db,upload,actor);await mutateInventoryImport(c.db,{action:'commit',key:second.record.key,week},actor);const entries=await logs(c.db);assert.equal(entries.length,7);const replace=entries.find(e=>e.action==='replace');assert.equal(replace.before.status,'Đã mở chốt');assert.equal(replace.after.status,'Đã thay thế bằng phiên bản mới');
 }finally{await c.close();}
});
test('inventory conflict produces no phantom commit audit; failed audit rolls back uploaded data',async()=>{
 const c=await fixture();try{
  const first=await mutateInventoryImport(c.db,upload,actor),before=await logs(c.db);
  const race={prepare:sql=>c.db.prepare(sql),batch:async statements=>{await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='inventory' AND record_key=?").bind(JSON.stringify({...first.record,status:'Changed concurrently'}),first.record.key).run();return c.db.batch(statements);}};
  await assert.rejects(()=>mutateInventoryImport(race,{action:'commit',key:first.record.key,week},actor));assert.equal(await count(c.db,'inventory_snapshot'),0);assert.deepEqual(await logs(c.db),before);
  await c.db.prepare("CREATE TRIGGER deny_audit BEFORE INSERT ON app_records WHEN NEW.entity='admin_audit' BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END").run();const oldCount=await count(c.db,'inventory');await assert.rejects(()=>mutateInventoryImport(c.db,upload,actor));assert.equal(await count(c.db,'inventory'),oldCount);
 }finally{await c.close();}
});
test('engine logs one creation for paired persisted snapshots; status transition logs only once',async()=>{
 const c=await fixture();try{
  const body=await seedEngine(c);const first=await mutateInventoryImport(c.db,upload,actor);const committed=await mutateInventoryImport(c.db,{action:'commit',key:first.record.key,week},actor);body.payload.snapshotId=committed.snapshot.id;
  const a=await saveEngine(c.db,body,actor);const b=await saveEngine(c.db,body,actor);assert.notEqual(a.key,b.key,'existing API intentionally creates a fresh run each call');
  const entries=(await logs(c.db)).filter(e=>e.entity==='production_engine');assert.equal(entries.length,2);assert.equal(await count(c.db,'production_engine'),2);assert.equal(await count(c.db,'production_engine_snapshot'),2);assert.equal(await count(c.db,'inventory_snapshot_audit'),1);assert.equal(entries[0].before,null);assert.equal(entries[0].after.rows[0].sku,'SKU1');
  const before=await count(c.db,'admin_audit');await assert.rejects(()=>saveEngine(c.db,{payload:{...body.payload,snapshotId:'MISSING'}},actor));assert.equal(await count(c.db,'admin_audit'),before);
 }finally{await c.close();}
});
test('engine concurrent snapshot change has no audit or phantom engine creation',async()=>{
 const c=await fixture();try{
  const body=await seedEngine(c);const first=await mutateInventoryImport(c.db,upload,actor);const committed=await mutateInventoryImport(c.db,{action:'commit',key:first.record.key,week},actor);body.payload.snapshotId=committed.snapshot.id;const before=await logs(c.db);
  const race={prepare:sql=>c.db.prepare(sql),batch:async statements=>{await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='inventory_snapshot' AND record_key=?").bind(JSON.stringify({...committed.snapshot,status:'Đã mở chốt'}),committed.snapshot.id).run();return c.db.batch(statements);}};
  await assert.rejects(()=>saveEngine(race,body,actor));assert.equal(await count(c.db,'production_engine'),0);assert.equal(await count(c.db,'production_engine_snapshot'),0);assert.equal(await count(c.db,'inventory_snapshot_audit'),0);assert.deepEqual(await logs(c.db),before);
 }finally{await c.close();}
});
