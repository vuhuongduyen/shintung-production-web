import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {sheetBridge,sheetSetup,REAL_SHEET} from '../worker/warehouse-sheet.mjs';
test('scoped bridge: auth, isolation, queue, difference, confirmation retry and conflict',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'warehouse-sheet-')));try{await migrate(c.db);const env={DB:c.db},host='https://test.invalid';
 const req=(body,token='')=>new Request(host+'/api/warehouse-sheet/bridge',{method:'POST',headers:{authorization:'Bearer '+token,origin:host,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await sheetBridge(req({action:'pull'}),env)).status,401);
 await assert.rejects(()=>sheetSetup(req({spreadsheetId:REAL_SHEET}),env,{isAdmin:true,login:'ADMIN'}),/thử/);
 assert.equal((await sheetSetup(req({}),env,{isAdmin:false})).status,403);
 const spreadsheetId='test_sheet_1234567890123456';const config=await(await sheetSetup(req({spreadsheetId}),env,{isAdmin:true,login:'ADMIN'})).json();
 const put=(k,p)=>c.db.prepare("INSERT INTO app_records VALUES('warehouse_in',?,?,?,?)").bind(k,JSON.stringify(p),'TEST',new Date().toISOString()).run();
 const p={id:'SX:r',source:'Sản xuất',reportId:'r',sku:'sku',proposedQuantity:10,status:'Chờ xác nhận',sheetSync:{status:'pending'}};await put('SX:r',p);await put('old',{...p,id:'old',sheetSync:undefined});
 const call=b=>sheetBridge(req({spreadsheetId,...b},config.token),env);
 assert.equal((await(await call({action:'pull'})).json()).receipts.length,1);
 await assert.rejects(()=>call({action:'pull',spreadsheetId:REAL_SHEET}),/Sai file/);
 const b={action:'confirm',receiptId:'SX:r',reportId:'r',sku:'sku',proposedQuantity:10,receivedQuantity:8,confirmedBy:'warehouse@example.test',confirmedAt:'2026-10-24T02:00:00Z'};
 await assert.rejects(()=>call(b),/lý do/);
 assert.equal((await call({...b,differenceReason:'Thiếu 2'})).status,200);
 assert.equal((await(await call({...b,differenceReason:'Thiếu 2'})).json()).duplicate,true);
 await assert.rejects(()=>call({...b,receivedQuantity:9,differenceReason:'Khác'}),/thông tin khác/);
 const saved=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE record_key='SX:r' AND entity='warehouse_in'").first()).payload);assert.equal(saved.receivedQuantity,8);assert.equal(saved.confirmedBy,b.confirmedBy);assert.equal(saved.status,'Đã xác nhận');
 assert.equal((await(await call({action:'pull'})).json()).receipts.length,0);
 await c.db.prepare("INSERT INTO app_records VALUES('production_report','r',?,'TEST','now')").bind(JSON.stringify({completedAt:'2026-10-25T08:00:00+07:00'})).run();
 const changed=(await(await call({action:'pull'})).json()).receipts;assert.equal(changed.length,1);assert.equal(changed[0].sourceCompletedAt,'2026-10-25T08:00:00+07:00');
 await assert.rejects(()=>call({action:'ack',receiptId:'SX:r',reportId:'r',sku:'sku',sourceCompletedAt:'old'}),/vừa thay đổi/);
 await call({action:'ack',receiptId:'SX:r',reportId:'r',sku:'sku',sourceCompletedAt:changed[0].sourceCompletedAt});
 const after=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE record_key='SX:r' AND entity='warehouse_in'").first()).payload);assert.equal(after.confirmedBy,b.confirmedBy);assert.equal(after.receivedQuantity,8);assert.equal(after.confirmedAt,b.confirmedAt);
 assert.equal((await(await call({action:'pull'})).json()).receipts.length,0);
 }finally{await c.close();}
});

test('connection state and body credentials: ping, missing/invalid keys, rotation, disable',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'warehouse-auth-')));try{
 await migrate(c.db);const env={DB:c.db},host='https://test.invalid',actor={isAdmin:true,login:'ADMIN'},spreadsheetId='test_sheet_1234567890123456';
 const req=b=>new Request(host+'/api/warehouse-sheet/bridge',{method:'POST',headers:{origin:host,'Content-Type':'application/json'},body:JSON.stringify(b)});
 const setup=b=>sheetSetup(req(b),env,actor);
 const call=b=>sheetBridge(req({spreadsheetId,action:'ping',...b}),env);
 assert.equal((await(await call({})).json()).code,'NOT_CONFIGURED');
 const config=await(await setup({spreadsheetId})).json();assert.equal(config.enabled,true);assert.equal(config.configured,true);
 assert.equal((await(await call({})).json()).code,'TOKEN_MISSING');
 assert.equal((await(await call({bridgeToken:'wrong'.repeat(10)})).json()).code,'TOKEN_INVALID');
 const ping=await(await call({bridgeToken:config.token})).json();assert.equal(ping.connected,true);assert.ok(ping.lastContactAt);assert.equal(ping.receipts,undefined);
 const state=await(await sheetSetup(new Request(host+'/api/warehouse-sheet/setup'),env,actor)).json();assert.equal(state.lastContactAt,ping.lastContactAt);assert.equal(state.token,undefined);
 await setup({spreadsheetId});assert.equal((await(await call({bridgeToken:config.token})).json()).code,'TOKEN_INVALID');
 const disabled=await(await setup({action:'disable'})).json();assert.equal(disabled.enabled,false);assert.equal(disabled.configured,true);
 assert.equal((await(await call({bridgeToken:config.token})).json()).code,'DISABLED');
 }finally{await c.close();}
});

test('historical queue is date scoped, approved only, race guarded and idempotent',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'warehouse-backfill-')));try{
 await migrate(c.db);const env={DB:c.db},host='https://test.invalid',actor={isAdmin:true,login:'ADMIN'},spreadsheetId='test_sheet_1234567890123456';
 const req=b=>new Request(host+'/api/warehouse-sheet/setup',{method:'POST',headers:{origin:host,'Content-Type':'application/json'},body:JSON.stringify(b)});
 const setup=b=>sheetSetup(req(b),env,actor);
 const config=await(await setup({spreadsheetId})).json();await sheetBridge(req({action:'ping',bridgeToken:config.token,spreadsheetId}),env);
 const put=(e,k,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,\'TEST\',\'now\')').bind(e,k,JSON.stringify(p)).run();
 for(const [id,date,status] of [['a','2026-10-22T08:00:00','Đã xác nhận'],['b','2026-10-23T08:00:00','Đã xác nhận'],['c','2026-10-21T08:00:00','Đã xác nhận'],['d','2026-10-22T08:00:00','Chờ xác nhận']]){await put('production_report',id,{id,completedAt:date,reviewStatus:status,sku:'sku',approvedQuantity:10});await put('warehouse_in','SX:'+id,{id:'SX:'+id,reportId:id,source:'Sản xuất',sku:'sku',proposedQuantity:10,status:'Chờ xác nhận'});}
 const body={from:'2026-10-22',to:'2026-10-23'};
 const preview=await(await setup({...body,action:'backfill-preview'})).json();assert.equal(preview.receipts.length,2);assert.equal(preview.blocked.length,1);
 await assert.rejects(()=>setup({...body,action:'backfill-queue',revision:'old'}),/vừa thay đổi/);
 const result=await(await setup({...body,action:'backfill-queue',revision:preview.revision})).json();assert.equal(result.queued,2);
 const again=await(await setup({...body,action:'backfill-preview'})).json();assert.equal((await(await setup({...body,action:'backfill-queue',revision:again.revision})).json()).queued,0);
 const pull=await(await sheetBridge(req({action:'pull',spreadsheetId,bridgeToken:config.token}),env)).json();assert.equal(pull.receipts.length,2);assert.ok(pull.receipts.every(x=>x.status==='Chờ xác nhận'));
 assert.equal((await sheetSetup(req({...body,action:'backfill-queue'}),env,{isAdmin:false})).status,403);
 }finally{await c.close();}
});

test('corrected receipt must acknowledge current quantity/revision before Sheet confirmation',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'warehouse-corrected-')));try{await migrate(c.db);const env={DB:c.db},host='https://test.invalid',spreadsheetId='test_sheet_1234567890123456';
 const req=b=>new Request(host+'/api/warehouse-sheet/bridge',{method:'POST',headers:{origin:host,'Content-Type':'application/json'},body:JSON.stringify(b)});
 const setup=await(await sheetSetup(req({spreadsheetId}),env,{isAdmin:true,login:'ADMIN'})).json();
 const call=b=>sheetBridge(req({spreadsheetId,bridgeToken:setup.token,...b}),env);
 const p={id:'SX:r',source:'Sản xuất',reportId:'r',sku:'sku',proposedQuantity:60,status:'Chờ xác nhận',sourceCompletedAt:'2026-10-30T03:00:00Z',sheetSync:{status:'pending',correctionRevision:'rev2',exportedCorrectionRevision:'rev1'}};
 await c.db.prepare("INSERT INTO app_records VALUES('warehouse_in','SX:r',?,'TEST','now')").bind(JSON.stringify(p)).run();
 const ack={action:'ack',receiptId:p.id,reportId:'r',sku:'sku',sourceCompletedAt:p.sourceCompletedAt};
 await assert.rejects(()=>call(ack),/điều chỉnh số lượng/);await assert.rejects(()=>call({...ack,proposedQuantity:100,correctionRevision:'rev2'}),/điều chỉnh số lượng/);
 const confirmation={action:'confirm',receiptId:p.id,reportId:'r',sku:'sku',proposedQuantity:60,receivedQuantity:60,confirmedAt:'2026-10-31T04:00:00Z',confirmedBy:'KHO'};
 await assert.rejects(()=>call(confirmation),/đồng bộ lại/);
 await call({...ack,proposedQuantity:60,correctionRevision:'rev2'});assert.equal((await call(confirmation)).status,200);
 }finally{await c.close();}
});
