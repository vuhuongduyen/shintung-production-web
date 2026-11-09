import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {confirmSelectedWarehouse,confirmWarehouse} from '../worker/warehouse-confirm.mjs';
const kho={login:'SYNTHETIC-KHO',grants:['Quản lý kho / Nhập kho / Xác nhận']};
const raw=(db,e,k)=>db.prepare('SELECT * FROM app_records WHERE entity=? AND record_key=?').bind(e,k).first();
const receiptBody=(id,revision)=>({action:'confirm',ids:[id],revision,receivedAsProposed:true});
async function approved(c){
 const call=await reviewer(c),saved=await mutateProductionWorkflow(c.db,c.body({quantity:200}),actor);
 const correction={action:'preview',operation:'daily-output-edit',reportId:saved.report.id,expectedVersion:1,quantity:250,productionDate:'2026-11-02',productionLocalDateTime:'2026-11-02T09:00',reason:'Synthetic quantity correction',requestIdempotency:crypto.randomUUID()};
 const preview=await call('/api/production-correction',correction);assert.equal(preview.status,200);
 const changed=await call('/api/production-correction',{...correction,action:'apply',expectedRevision:preview.body.expectedRevision});assert.equal(changed.status,200);
 const review=await call('/api/production-report',{action:'review',reportId:saved.report.id,approve:true,expectedVersion:changed.body.report.version});assert.equal(review.status,200);
 return {call,report:review.body.payload,id:'SX:'+saved.report.id};
}
test('Web warehouse confirmation commits receipt and daily status together, leaves production quantity/rate/version intact and never repeats stock',()=>dailyFixture(async c=>{
 const a=await approved(c),before=JSON.parse((await raw(c.db,'production_report',a.report.id)).payload),p=await confirmSelectedWarehouse(c.db,{action:'preview',ids:[a.id]},kho);
 const result=await confirmSelectedWarehouse(c.db,receiptBody(a.id,p.revision),kho);assert.equal(result.confirmed,1);
 const after=JSON.parse((await raw(c.db,'production_report',a.report.id)).payload),receipt=JSON.parse((await raw(c.db,'warehouse_in',a.id)).payload);
 assert.equal(receipt.receivedQuantity,250);assert.equal(receipt.status,'Đã xác nhận');assert.equal(after.warehouseStatus,'Đã xác nhận');assert.deepEqual({...after,warehouseStatus:before.warehouseStatus},before);
 const view=await a.call('/api/production-workflow');assert.equal(view.status,200);assert.equal(view.body.reports.find(r=>r.id===a.report.id).warehouseStatus,'Đã xác nhận');
 const reportRaw=await raw(c.db,'production_report',a.report.id),receiptRaw=await raw(c.db,'warehouse_in',a.id);
 await assert.rejects(()=>confirmSelectedWarehouse(c.db,receiptBody(a.id,p.revision),kho),{status:409});assert.deepEqual(await raw(c.db,'production_report',a.report.id),reportRaw);assert.deepEqual(await raw(c.db,'warehouse_in',a.id),receiptRaw);
}));
test('pre-fix confirmed receipt corrects the authorized read view without migrating a historical report or disclosing warehouse identity',()=>dailyFixture(async c=>{
 const a=await approved(c),r=await raw(c.db,'warehouse_in',a.id),p=JSON.parse(r.payload);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='warehouse_in' AND record_key=?").bind(JSON.stringify({...p,status:'Đã xác nhận',confirmation_status:'Đã xác nhận',receivedQuantity:250,confirmedBy:'SYNTHETIC-PRIVATE-KHO-IDENTITY',confirmedAt:'2026-11-09T01:00:00Z'}),a.id).run();
 const original=await raw(c.db,'production_report',a.report.id);assert.equal(JSON.parse(original.payload).warehouseStatus,'Chờ Kho xác nhận');
 const view=await a.call('/api/production-workflow');assert.equal(view.status,200);assert.equal(view.body.reports.find(r=>r.id===a.report.id).warehouseStatus,'Đã xác nhận');assert.doesNotMatch(JSON.stringify(view.body),/SYNTHETIC-PRIVATE-KHO-IDENTITY/);assert.deepEqual(await raw(c.db,'production_report',a.report.id),original);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.sku','SYNTHETIC-WRONG-SKU') WHERE entity='warehouse_in' AND record_key=?").bind(a.id).run();const mismatched=await a.call('/api/production-workflow');assert.notEqual(mismatched.body.reports.find(r=>r.id===a.report.id).warehouseStatus,'Đã xác nhận');
}));
test('preview binds daily source changes as well as receipt revisions',()=>dailyFixture(async c=>{
 const a=await approved(c),p=await confirmSelectedWarehouse(c.db,{action:'preview',ids:[a.id]},kho),receipt=await raw(c.db,'warehouse_in',a.id);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.note','SYNTHETIC source changed') WHERE entity='production_report' AND record_key=?").bind(a.report.id).run();const changed=await raw(c.db,'production_report',a.report.id);
 await assert.rejects(()=>confirmSelectedWarehouse(c.db,receiptBody(a.id,p.revision),kho),{status:409});assert.deepEqual(await raw(c.db,'warehouse_in',a.id),receipt);assert.deepEqual(await raw(c.db,'production_report',a.report.id),changed);
}));
for(const race of ['source','duplicate'])test('confirmation rejects commit-time '+race+' drift without partial stock/report writes',()=>dailyFixture(async c=>{
 const a=await approved(c),p=await confirmSelectedWarehouse(c.db,{action:'preview',ids:[a.id]},kho),receipt=await raw(c.db,'warehouse_in',a.id),report=await raw(c.db,'production_report',a.report.id);let injected=false;
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;if(race==='source')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.note','SYNTHETIC concurrent') WHERE entity='production_report' AND record_key=?").bind(a.report.id).run();else await target.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('warehouse_in',a.id+'-DUP',receipt.payload,'SYNTHETIC','SYNTHETIC').run();}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const result=await confirmSelectedWarehouse(db,receiptBody(a.id,p.revision),kho);assert.equal(injected,true);assert.equal(result.confirmed,0);assert.deepEqual(result.skippedIds,[a.id]);assert.deepEqual(await raw(c.db,'warehouse_in',a.id),receipt);
 if(race==='duplicate')assert.deepEqual(await raw(c.db,'production_report',a.report.id),report);else assert.equal(JSON.parse((await raw(c.db,'production_report',a.report.id)).payload).warehouseStatus,'Chờ Kho xác nhận');
}));
test('a blocked report update rolls back the receipt too; it cannot leave stock confirmed with a waiting report',()=>dailyFixture(async c=>{
 const a=await approved(c),p=await confirmSelectedWarehouse(c.db,{action:'preview',ids:[a.id]},kho),receipt=await raw(c.db,'warehouse_in',a.id),report=await raw(c.db,'production_report',a.report.id);
 await c.db.exec("CREATE TRIGGER synthetic_block_status BEFORE UPDATE ON app_records WHEN OLD.entity='production_report' BEGIN SELECT RAISE(IGNORE); END;");
 await assert.rejects(()=>confirmSelectedWarehouse(c.db,receiptBody(a.id,p.revision),kho));assert.deepEqual(await raw(c.db,'warehouse_in',a.id),receipt);assert.deepEqual(await raw(c.db,'production_report',a.report.id),report);
}));
test('bulk Admin confirmation preserves the legacy row while synchronizing daily status and returning receipt counts only',()=>dailyFixture(async c=>{
 const a=await approved(c);await c.put('production_report','SYNTHETIC-LEGACY',{kind:'completion',warehouseStatus:'Legacy untouched',hours:{total:7}});await c.put('warehouse_in','SYNTHETIC-LEGACY-WAREHOUSE',{source:'Sản xuất',status:'Chờ xác nhận',proposedQuantity:10,receivedQuantity:null,reportId:'SYNTHETIC-LEGACY'});const old=await raw(c.db,'production_report','SYNTHETIC-LEGACY');
 const admin={login:'SYNTHETIC-ADMIN',isAdmin:true},p=await confirmWarehouse(c.db,{action:'confirm-preview'},admin),done=await confirmWarehouse(c.db,{action:'confirm',revision:p.revision,receivedAsProposed:true},admin);assert.equal(done.confirmed,2);assert.equal(JSON.parse((await raw(c.db,'production_report',a.report.id)).payload).warehouseStatus,'Đã xác nhận');assert.deepEqual(await raw(c.db,'production_report','SYNTHETIC-LEGACY'),old);
}));
test('authenticated synthetic Sheet confirmation keeps partial receipt quantity/reason and synchronizes daily status once',()=>dailyFixture(async c=>{
 const a=await approved(c),{sheetSetup,sheetBridge}=await import('../worker/warehouse-sheet.mjs'),origin='https://test.invalid',spreadsheetId='SYNTHETIC_SHEET_1234567890123456',request=body=>new Request(origin+'/api/warehouse-sheet/bridge',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),setup=await sheetSetup(request({spreadsheetId}),{DB:c.db},{login:'SYNTHETIC-ADMIN',isAdmin:true}),configuration=await setup.json(),bridge=body=>sheetBridge(request({spreadsheetId,bridgeToken:configuration.token,...body}),{DB:c.db});
 const common={receiptId:a.id,reportId:a.report.id,sku:a.report.sku,sourceCompletedAt:a.report.productionDate};assert.equal((await bridge({...common,action:'ack'})).status,200);
 const body={...common,action:'confirm',proposedQuantity:250,receivedQuantity:240,confirmedBy:'SYNTHETIC-KHO',confirmedAt:'2026-11-09T01:00:00Z',differenceReason:'Synthetic short receipt'};const result=await bridge(body);assert.equal(result.status,200,await result.text());const stored=await raw(c.db,'production_report',a.report.id),report=JSON.parse(stored.payload),receipt=JSON.parse((await raw(c.db,'warehouse_in',a.id)).payload);assert.equal(report.warehouseStatus,'Đã xác nhận');assert.equal(report.approvedQuantity,250);assert.equal(receipt.receivedQuantity,240);assert.equal(receipt.difference,-10);assert.equal(receipt.differenceReason,body.differenceReason);assert.equal((await (await bridge(body)).json()).duplicate,true);assert.deepEqual(await raw(c.db,'production_report',a.report.id),stored);
}));

test('a raced daily source is skipped while an unrelated selected receipt still commits once',()=>dailyFixture(async c=>{
 const a=await approved(c),other='SYNTHETIC-OTHER-RECEIPT';await c.put('warehouse_in',other,{source:'Sản xuất',status:'Chờ xác nhận',proposedQuantity:7});
 const ids=[a.id,other],p=await confirmSelectedWarehouse(c.db,{action:'preview',ids},kho);let injected=false;
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.note','SYNTHETIC concurrent') WHERE entity='production_report' AND record_key=?").bind(a.report.id).run();}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const result=await confirmSelectedWarehouse(db,{...receiptBody(a.id,p.revision),ids},kho);assert.equal(result.ok,false);assert.equal(result.confirmed,1);assert.deepEqual(result.confirmedIds,[other]);assert.deepEqual(result.skippedIds,[a.id]);assert.equal(JSON.parse((await raw(c.db,'warehouse_in',other)).payload).receivedQuantity,7);assert.equal(JSON.parse((await raw(c.db,'warehouse_in',a.id)).payload).receivedQuantity,null);assert.equal(JSON.parse((await raw(c.db,'production_report',a.report.id)).payload).warehouseStatus,'Chờ Kho xác nhận');
}));

test('500 selected daily receipts retain one atomic batch, bounded source reads and receipt-only counts',()=>dailyFixture(async c=>{
 const a=await approved(c),templateReport=JSON.parse((await raw(c.db,'production_report',a.report.id)).payload),templateReceipt=JSON.parse((await raw(c.db,'warehouse_in',a.id)).payload),ids=[a.id];let inserts=[];
 for(let i=1;i<500;i++){const id='SYNTHETIC-SCALE-'+i,receiptId='SX:'+id;ids.push(receiptId);for(const [entity,key,value] of [['production_report',id,{...templateReport,id}],['warehouse_in',receiptId,{...templateReceipt,reportId:id,sourceReportId:id,id:receiptId}]])inserts.push(c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'SYNTHETIC','2026-11-09'));if(inserts.length>=80){await c.db.batch(inserts);inserts=[];}}
 if(inserts.length)await c.db.batch(inserts);
 let sourceReads=0,batchSizes=[];const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(sql.startsWith('SELECT record_key,CASE WHEN'))sourceReads++;return target.prepare(sql);};if(key==='batch')return statements=>{batchSizes.push(statements.length);return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const started=performance.now(),p=await confirmSelectedWarehouse(db,{action:'preview',ids},kho),result=await confirmSelectedWarehouse(db,{...receiptBody(a.id,p.revision),ids},kho),elapsed=performance.now()-started;
 assert.equal(result.confirmed,500);assert.equal(result.ok,true);assert.deepEqual(result.skippedIds,[]);assert.equal(batchSizes.length,1);assert.ok(batchSizes[0]<600,JSON.stringify(batchSizes));assert.equal(sourceReads,14);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_report' AND json_extract(payload,'$.warehouseStatus')='Đã xác nhận'").first()).n,500);assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='warehouse_in' AND json_extract(payload,'$.receivedQuantity')=250").first()).n,500);
 console.info('Synthetic local Miniflare warehouse preview+confirm, no hosted D1/network latency:',JSON.stringify({receipts:500,sourceReads,batchStatements:batchSizes[0],batches:batchSizes.length,elapsedMs:Math.round(elapsed)}));
}));
