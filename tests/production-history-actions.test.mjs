import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {historicalWorkContinuation,productionWorkActions} from '../lib/production-work-actions.mjs';
const order={id:'history-order',planId:'SYNTHETIC',lsxCode:'SYNTHETIC-LSX',sku:'SYNTHETIC-SKU',line:'B',lsxQty:4000,lsxOpenedAt:'2026-09-21',inTransitQty:1000,completedQty:3000,week:'2026-09-21',planStart:'2026-09-21',planEnd:'2026-09-26',syncStatus:'ĐÃ ĐỒNG BỘ'};
const report={id:'history-report',kind:'completion',historicalImport:true,transitId:order.id,lsxCode:order.lsxCode,sku:order.sku,line:'B',reportedQuantity:3000,approvedQuantity:3000,reviewStatus:'Đã xác nhận',startedAt:'2026-09-23T01:00:00Z',completedAt:'2026-09-24T09:00:00Z',actualStartedAt:'2026-09-23',sourceCount:12,sourceCumulativeHours:22.85,hours:{hc:274.2,ot:0,total:274.2,perEmployee:[]}};
const idle={known:false,running:false},running={known:true,running:true};
test('confirmed partial history continues as running without another entry',()=>{
 const a=productionWorkActions(order,[report],[],idle);assert.ok(a.allowed.includes('complete'));assert.ok(a.allowed.includes('pause'));assert.ok(!a.allowed.includes('start'));
 assert.deepEqual(productionWorkActions(order,[report],[],{known:true,running:false}).allowed,['resume','incident']);
});
test('unconfirmed history and fully completed orders stay locked, cancelled history does not lock',()=>{
 for(const reviewStatus of ['Chờ kiểm tra','Lịch sử chờ đối chiếu','Cần điều chỉnh'])assert.deepEqual(productionWorkActions(order,[{...report,reviewStatus}],[],running).allowed,[]);
 assert.deepEqual(productionWorkActions({...order,inTransitQty:0},[report],[],running).allowed,[]);
 assert.ok(productionWorkActions({...order,completedQty:0},[{...report,reviewStatus:'Lịch sử chờ đối chiếu',cancelled:true}],[],idle).allowed.includes('start'));
});
const actor={login:'synthetic-line-b',line:'B',isAdmin:false,grants:['Quản lý sản xuất / Thêm','Quản lý sản xuất / Xem','Quản lý sản xuất / Xác nhận']};
async function fixture(run,reviewStatus='Đã xác nhận'){
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-history-actions-')));
 try{await migrate(c.db);const put=async(entity,key,value)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'synthetic','2026-09-20').run();
 await put('in_transit',order.id,{...order,completedQty:0,inTransitQty:4000});
 await put('production_report',report.id,{...report,reviewStatus,approvedQuantity:reviewStatus==='Đã xác nhận'?3000:0});
 await put('production_history_import','synthetic-batch',{reports:[report]});
 const dailySchedule=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}));
 await put('capacity','2026-09-21',{schemaVersion:1,week:'2026-09-21',rows:[{line:'B',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule}}]});
 await run(c.db);
 }finally{await c.close();}
}
const start={action:'start',orderId:order.id,count:2,effectiveAt:'2026-09-25T01:00:00Z'};
test('confirmed historical running order pauses, resumes and exits without fake entry or hours',()=>fixture(async db=>{
 const current=(await readProductionWorkflow(db,actor)).orders.find(r=>r.id===order.id);
 assert.equal(current.inTransitQty,1000);
 const original=(await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first()).payload;
 await assert.rejects(()=>mutateProductionWorkflow(db,start,actor),/đã nhập trạm/);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'pause',reason:'pause',orderId:order.id,effectiveAt:'2026-09-25T01:15:00Z'},{...actor,line:'A'}),{status:403});
 await mutateProductionWorkflow(db,{action:'pause',reason:'Synthetic pause',orderId:order.id,effectiveAt:'2026-09-25T01:15:00Z'},actor);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'complete',orderId:order.id,quantity:1000,effectiveAt:'2026-09-25T01:20:00Z'},actor),/chưa làm hoặc đang tạm ngưng/);
 await mutateProductionWorkflow(db,{action:'resume',orderId:order.id,effectiveAt:'2026-09-25T01:30:00Z'},actor);
 const exited=await mutateProductionWorkflow(db,{action:'complete',orderId:order.id,quantity:1000,effectiveAt:'2026-09-25T02:00:00Z'},actor);
 assert.equal(exited.report.reportedQuantity,1000);assert.equal(exited.event.finalCompletion,true);assert.equal(exited.report.hours,null);
 const read=(await readProductionWorkflow(db,actor)).reports.find(r=>r.id===exited.report.id);assert.equal(read.hours,null,'read must not replace unknown labor with zero');
 assert.equal((await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first()).payload,original);
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_event' AND json_extract(payload,'$.kind')='start'").first()).n,0);
}));
test('pending history cannot create a new live entry',()=>fixture(async db=>{
 await assert.rejects(()=>mutateProductionWorkflow(db,start,actor),/xác nhận báo công lịch sử/);
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_event'").first()).n,0);
},'Lịch sử chờ đối chiếu'));

test('latest history completion compares instants across timezone offsets',()=>{
 const a={...report,completedAt:'2026-09-24T16:00:00+07:00'},b={...report,id:'later',completedAt:'2026-09-24T10:00:00Z'};
 assert.equal(historicalWorkContinuation(order,[a,b]).lastCompletedAt,b.completedAt);
});

test('date-only running order with no output accepts pause and exit with explicitly supplied start, preserves unknown labor',()=>fixture(async db=>{
 await db.prepare("DELETE FROM app_records WHERE entity IN ('production_report','production_history_import')").run();
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify({...order,completedQty:0,inTransitQty:4000,actualStartedAt:'2026-09-23',productionState:'Đang sản xuất'}),order.id).run();
 await assert.rejects(()=>mutateProductionWorkflow(db,start,actor),/đã nhập trạm/);
 const preview=await mutateProductionWorkflow(db,{action:'preview-report',orderId:order.id,effectiveAt:'2026-09-25T02:00:00Z'},actor);assert.equal(preview.needsStartedAt,true);
 const result=await mutateProductionWorkflow(db,{action:'complete',orderId:order.id,quantity:1000,startedAt:'2026-09-23T01:00:00Z',effectiveAt:'2026-09-25T02:00:00Z'},actor);
 assert.equal(result.report.hours,null);assert.equal(result.report.reportedBy,actor.login);assert.equal(result.event.finalCompletion,false);
 const read=await readProductionWorkflow(db,actor);assert.equal(read.reports.find(r=>r.id===result.report.id).hours,null);
}));
