import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {importTransitHistory,restoreTransitHistoryRemovals} from '../scripts/local/transit-history-import.mjs';
import {parseTransitHistory} from '../lib/transit-history-import.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
const input='28092026-SKU-A\tSKU\tA\t29/09/2026\t02/10/2026\t510-1\t2000\t2000\t28/09/2026\t2000\t29/09/2026\t01/10/2026';
const catalog=[{payload:{code:'SKU',name:'Product',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}}];
test('historical parser preserves requested week, identifiers and completion dates; rejects incomplete data',()=>{
 const [r]=parseTransitHistory(input,'2026-09-28');assert.equal(r.completedQty,2000);assert.equal(r.actualCompletedAt,'2026-10-01');assert.equal(r.week,'2026-09-28');
 assert.throws(()=>parseTransitHistory(input.replace('01/10/2026',''),'2026-09-28'));
 assert.throws(()=>parseTransitHistory(input+'\n'+input,'2026-09-28'));
});
test('atomic historical import retains removed records, logs actor, rejects duplicates, stale revisions and unauthorized imports',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/transit-history-')));
 try{await migrate(c.db);const payload=JSON.stringify({id:'old',week:'2026-09-14',planId:'OLD',sku:'SKU',lsxCode:'OLD-LSX'});await c.db.prepare("INSERT INTO app_records VALUES('in_transit','old',?,'fixture','fixture')").bind(payload).run();
 const request={text:input,week:'2026-09-28',remove:[{id:'old',revision:await recordRevision(payload)}]},actor={login:'admin',isAdmin:true};
 await assert.rejects(()=>importTransitHistory(c.db,request,{login:'viewer'},catalog));
 await assert.rejects(()=>importTransitHistory(c.db,{...request,remove:[{id:'old',revision:'stale'}]},actor,catalog));
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='in_transit'").first()).n,1);
 const result=await importTransitHistory(c.db,request,actor,catalog);assert.equal(result.inserted,1);assert.equal(result.removed,1);
 assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE record_key='old'").first()).payload)._deleted,true);
 const audit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_audit'").first()).payload);assert.equal(audit.actor,'admin');assert.deepEqual(audit.removed,['old']);
 await assert.rejects(()=>importTransitHistory(c.db,{...request,remove:[]},actor,catalog));
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='in_transit'").first()).n,2);
 const restored=await restoreTransitHistoryRemovals(c.db,{batchId:audit.id},actor);assert.equal(restored.restored,1);assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE record_key='old'").first()).payload)._deleted,false);
 }finally{await c.close();}
});

test('extended import updates matching plan without losing hidden dates, handles unopened/new rows and rejects live production',async()=>{
 const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/transit-update-')));
 try{await migrate(c.db);const prior={planRowId:'linked-plan',planId:'PLAN',sku:'SKU',line:'A',week:'2026-10-05',planStart:'2026-10-02',planEnd:'2026-10-09',planQty:2000};const payload=JSON.stringify(prior);
 await c.db.prepare("INSERT INTO app_records VALUES('in_transit','plan',?,'fixture','fixture')").bind(payload).run();
 const row=['PLAN','SKU','A','','','LSX',2000,4000,'06/10/2026',0,'','','Kế hoạch tuần','THƯỜNG - GỐI ĐẦU',2,'Product',''].join('\t');
 const unopened=['NEW','SKU','B','','','',300,'','','','','','Kế hoạch tuần','',3,'Product',''].join('\t');
 await c.db.prepare("INSERT INTO app_records VALUES('production_report','unrelated',?,'fixture','fixture')").bind(JSON.stringify({kind:'completion',transitId:'another'})).run();
 const request={text:row+'\n'+unopened,week:'2026-10-05',updateExisting:true,updateRevisions:[{id:'plan',revision:await recordRevision(payload)}]},actor={login:'admin',isAdmin:true};
 assert.equal(parseTransitHistory(request.text,request.week).length,2);
 await assert.rejects(()=>importTransitHistory(c.db,{...request,updateRevisions:[]},actor,catalog));
 const result=await importTransitHistory(c.db,request,actor,catalog);assert.equal(result.updated,1);assert.equal(result.inserted,1);
 const stored=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='plan'").first();const updated=JSON.parse(stored.payload);
 assert.equal(updated.id,'plan');assert.equal(updated.planStart,prior.planStart);assert.equal(updated.planRowId,'linked-plan');assert.equal(updated.planQty,2000);assert.equal(updated.lsxQty,4000);
 await c.db.prepare("INSERT INTO app_records VALUES('production_event','event',?,'fixture','fixture')").bind(JSON.stringify({transitId:'plan',lsxCode:'LSX'})).run();
 await assert.rejects(async()=>importTransitHistory(c.db,{...request,text:row,updateRevisions:[{id:'plan',revision:await recordRevision(stored.payload)}]},actor,catalog),/báo công/);
 }finally{await c.close();}
});
