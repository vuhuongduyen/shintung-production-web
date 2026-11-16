import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
import {transitProductionPayload} from '../scripts/local/transit-production-read.mjs';
import {mergeProduction,normalizeTransit} from '../lib/in-transit.mjs';
import {getTransit} from '../scripts/local/in-transit.mjs';
const order={id:'SYNTHETIC-LSX',planId:'TEST',lsxCode:'TEST-LSX',sku:'TEST-SKU',line:'A',lsxQty:1000,syncStatus:'ĐÃ ĐỒNG BỘ'};
async function fixture(run){const c=await openDatabase(mkdtempSync(join(tmpdir(),'transit-memory-')));try{await migrate(c.db);await run(c);}finally{await c.close();}}
const put=(db,entity,key,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'SYNTHETIC','2026-11-01').run();
test('quantity/state projection preserves legacy baseline, daily approved/pending and stage transitions without audit trees',()=>fixture(async({db})=>{
 const bulky={sourceSnapshot:{attendance:[{employees:['TEST-PERSON']}],audit:'x'.repeat(200000)},history:[{audit:'y'.repeat(200000)}],laborNotes:[{text:'Original employee note'}],sourceRow:{privateImport:'original'}};
 const reports=[{id:'old',kind:'legacy',transitId:order.id,completedQty:400,...bulky},{id:'new',kind:'completion',quantityOnly:true,reportingModel:'daily-finished-v1',transitId:order.id,line:'A',reportedQuantity:300,approvedQuantity:300,legacyCompletedBaseline:400,productionDate:'2026-11-02',reviewStatus:'Đã xác nhận',...bulky},{id:'pending',kind:'completion',transitId:order.id,reportedQuantity:200,reviewStatus:'Chờ kiểm tra',...bulky}];
 const events=[{id:'start',kind:'start',sourceId:order.id,effectiveAt:'2026-11-02T08:00:00+07:00',...bulky},{id:'pause',kind:'pause',sourceId:order.id,effectiveAt:'2026-11-02T09:00:00+07:00',...bulky}];
 for(const r of reports)await put(db,'production_report',r.id,r);for(const e of events)await put(db,'production_event',e.id,e);
 const before=await records(db),read=async entity=>(await readRecordPages(db,{where:'entity=?',args:[entity],payloadExpression:transitProductionPayload(entity)})).map(r=>JSON.parse(r.payload));
 const projected=mergeProduction(normalizeTransit(order),await read('production_report'),await read('production_event'));
 assert.deepEqual(projected,mergeProduction(normalizeTransit(order),reports,events));assert.equal(projected.completedQty,700);assert.equal(projected.pendingReportQty,200);assert.equal(projected.productionState,'Tạm ngưng');assert.deepEqual(await records(db),before);
}));
test('array-shaped reports and history pending reports retain IDs/quantities, and live In Transit totals do not truncate',()=>fixture(async({db})=>{
 await put(db,'in_transit',order.id,order);
 const pending={id:'pending',transitId:order.id,kind:'completion',reportedQuantity:200,reviewStatus:'Chờ kiểm tra',sourceSnapshot:{audit:'x'.repeat(600000)}};
 await put(db,'production_report','batch',{rows:[{...pending,id:'approved',reportedQuantity:400,approvedQuantity:400,reviewStatus:'Đã xác nhận'}]});
 await put(db,'production_history_import','history',{reports:[pending],timeEvents:[{audit:'y'.repeat(600000)}]});
 const before=await records(db),state=await getTransit(db,{},[],{includeHistory:false});assert.equal(state.rows.length,1);assert.equal(state.rows[0].completedQty,400);assert.equal(state.rows[0].pendingReportQty,200);assert.deepEqual(await records(db),before);
}));
test('large synthetic summary reads retain every row while excluding bulky display copies at SQL boundary',()=>fixture(async({db})=>{
 const count=1600,audit='x'.repeat(10000);
 for(let start=0;start<count;start+=50)await db.batch(Array.from({length:Math.min(50,count-start)},(_,i)=>{const id='TEST-'+String(start+i).padStart(5,'0');return db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_report',id,JSON.stringify({id,transitId:order.id,kind:'completion',reportedQuantity:1,reviewStatus:'Đã xác nhận',sourceSnapshot:{audit},history:[audit]}),'SYNTHETIC','2026-11-01');}));
 const projected=await readRecordPages(db,{where:'entity=?',args:['production_report'],payloadExpression:transitProductionPayload('production_report')});
 assert.equal(projected.length,count);assert.equal(new Set(projected.map(r=>r.record_key)).size,count);assert.equal(projected.reduce((n,r)=>n+JSON.parse(r.payload).reportedQuantity,0),count);
 const bytes=projected.reduce((n,r)=>n+Buffer.byteLength(r.payload),0);assert.ok(bytes<400000);assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE json_extract(payload,'$.sourceSnapshot.audit')=?").bind(audit).first()).n,count);
}));
