import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {storeFile} from '../lib/file-store.mjs';
import {mutateCapacity} from '../scripts/local/capacity.mjs';
import {getTransit,mutateTransit} from '../scripts/local/in-transit.mjs';
import {readWebsiteTestLog} from '../lib/website-test-log.mjs';
const actor={login:'TEST-audit-user',userId:'TEST-user-id',isAdmin:true};
async function isolated(fn){const path=mkdtempSync(join(tmpdir(),'onspa-test-audit-'));const c=await openDatabase(path);try{await migrate(c.db);await fn(c);}finally{await c.close();rmSync(path,{recursive:true,force:true});}}
const logs=async db=>(await readWebsiteTestLog(db)).entries;
const count=async(db,entity)=>(await db.prepare('SELECT count(*) AS n FROM app_records WHERE entity=?').bind(entity).first()).n;

test('file metadata and audit commit together, without bytes or credentials; reads do not log',()=>isolated(async({db,bucket})=>{
 const input={module:'attachments',name:'test.txt',recordId:'TEST-record',base64:btoa('PRIVATE_FILE_CONTENT'),token:'PRIVATE_CREDENTIAL'};
 const file=await storeFile(db,bucket,input,actor.login);
 const entries=await logs(db);assert.equal(entries.length,1);const entry=entries[0];assert.equal(entry.entity,'file_objects');assert.equal(entry.action,'add');assert.equal(entry.actorId,actor.login);assert.equal(entry.after.file_id,file.file_id);assert.equal(entry.after.size,20);
 const audit=(await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").first()).payload;assert.doesNotMatch(audit,/PRIVATE_FILE_CONTENT|PRIVATE_CREDENTIAL|base64|token/);
 await bucket.get(file.object_key);await logs(db);assert.equal(await count(db,'admin_audit'),1);
 await assert.rejects(()=>storeFile(db,bucket,{...input,base64:''},actor.login));assert.equal(await count(db,'admin_audit'),1);
}));

test('file D1 audit failure rolls metadata back and preserves object for reconciliation',()=>isolated(async({db,bucket})=>{
 await db.prepare("CREATE TRIGGER reject_test_audit BEFORE INSERT ON app_records WHEN NEW.entity='admin_audit' BEGIN SELECT RAISE(ABORT,'TEST audit failure'); END").run();
 await assert.rejects(()=>storeFile(db,bucket,{module:'attachments',name:'test.txt',recordId:'TEST-record',base64:btoa('fixture')},actor.login));
 assert.equal((await db.prepare('SELECT count(*) AS n FROM file_objects').first()).n,0);assert.equal(await count(db,'admin_audit'),0);assert.equal((await bucket.list()).objects.length,1);
}));

test('legacy Capacity employee addition has one atomic history and duplicate failure adds none',()=>isolated(async({db})=>{
 const body={action:'employee',id:'TEST-E1',name:'Test Employee'};
 await mutateCapacity(db,body,actor);let entries=await logs(db);assert.equal(entries.length,1);assert.equal(entries[0].entity,'employees');assert.equal(entries[0].action,'add');assert.equal(entries[0].actorId,actor.userId);assert.deepEqual(entries[0].after,{id:body.id,name:body.name});
 await assert.rejects(()=>mutateCapacity(db,body,actor),e=>e.status===409);assert.equal((await logs(db)).length,1);
}));

test('draft LSX audits changes, suppresses normalized noops, and rejects stale replay',()=>isolated(async({db})=>{
 const base={id:'TEST-draft',planId:'TEST-plan',week:'2026-10-12',sku:'TEST-sku',planQty:100,syncStatus:'CHƯA ĐỒNG BỘ'};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',base.id,JSON.stringify(base),'TEST-seed','2026-10-12').run();
 const current=async()=>(await getTransit(db)).rows[0];const first=await current();
 const saved=await mutateTransit(db,{action:'draft-lsx',id:base.id,expectedRevision:first.revision,changes:{lsxQty:25}},actor);assert.equal(saved.history.action,'draft-lsx');assert.equal(await count(db,'in_transit_audit'),1);
 const next=await current();const noop=await mutateTransit(db,{action:'draft-lsx',id:base.id,expectedRevision:next.revision,changes:{lsxQty:'25'}},actor);assert.equal(noop.unchanged,true);assert.equal((await current()).revision,next.revision);assert.equal(await count(db,'in_transit_audit'),1);
 await assert.rejects(()=>mutateTransit(db,{action:'draft-lsx',id:base.id,expectedRevision:first.revision,changes:{lsxQty:30}},actor),e=>e.status===409);assert.equal(await count(db,'in_transit_audit'),1);
 const entry=(await logs(db))[0];assert.equal(entry.entity,'in_transit');assert.equal(entry.operation,'draft-lsx');assert.equal(entry.after.lsxQty,25);assert.equal(entry.before.lsxQty,null);
}));

test('draft LSX audit failure rolls mutation back',()=>isolated(async({db})=>{
 const base={id:'TEST-draft',planId:'TEST-plan',week:'2026-10-12',sku:'TEST-sku',planQty:100,syncStatus:'CHƯA ĐỒNG BỘ'};const payload=JSON.stringify(base);
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',base.id,payload,'TEST-seed','2026-10-12').run();
 await db.prepare("CREATE TRIGGER reject_transit_audit BEFORE INSERT ON app_records WHEN NEW.entity='in_transit_audit' BEGIN SELECT RAISE(ABORT,'TEST audit failure'); END").run();
 const row=(await getTransit(db)).rows[0];await assert.rejects(()=>mutateTransit(db,{action:'draft-lsx',id:base.id,expectedRevision:row.revision,changes:{lsxQty:25}},actor));assert.equal((await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit'").first()).payload,payload);assert.equal(await count(db,'in_transit_audit'),0);
}));
