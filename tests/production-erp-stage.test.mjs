import {reportReviewBlocker} from '../lib/production-progress-review.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {productionHistoryImport} from '../scripts/local/production-history-import.mjs';import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {erpOverlaps,calculateErpStage,erpFallbackDay,erpScheduleDay} from '../lib/production-erp-stage.mjs';
const actor={login:'TEST',isAdmin:true};
const stage=(doc,stageName='A-FINAL')=>({document:doc,lsxCode:'LSX',sku:'SKU',line:'A',stageCode:'A01',stageName,startedAt:'2026-10-15T08:00:00+07:00',actualStartedAt:'2026-10-15T08:00:00+07:00',completedAt:'2026-10-15T17:00:00+07:00',quantity:100,employees:[{id:'NV',name:'Nhân viên'}],pauses:[]});
const input=()=>({erpStages:[stage('D401-20261015001','A-CUT'),stage('D401-20261015002')],erpEvents:[],confirmSourceReports:true,preserveOverlaps:true,fallbackCalendar:'HC_MON_SAT_0800_1700_NO_OT',from:'2026-09-01',to:'2026-10-20'});
test('calendar subtracts lunch/breaks and source pause exactly once',()=>{const r={...stage('D401-1'),id:'r',employees:['NV'],pauses:[['2026-10-15T11:30:00+07:00','2026-10-15T13:30:00+07:00']]};const h=calculateErpStage(r,{'2026-10-15':erpScheduleDay(erpFallbackDay('2026-10-15'))});assert.ok(Math.abs(h.total-6.6667)<0.0001);});
test('atomic replace, final-only output, retained overlaps, idempotent replay and scope',async()=>{const c=await openDatabase(mkdtempSync(join(tmpdir(),'erp-stage-')));try{await migrate(c.db);const o={id:'o',planId:'PLAN',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:100,week:'2026-10-12',planStart:'2026-10-15',planEnd:'2026-10-15',syncStatus:'ĐÃ ĐỒNG BỘ'},old={id:'old',kind:'completion',historicalImport:true,transitId:'o',planId:'PLAN',lsxCode:'LSX',sku:'SKU',line:'A',reportedQuantity:100,approvedQuantity:100,completedAt:'2026-10-15T17:00:00+07:00',reviewStatus:'Đã xác nhận',hours:{total:80,hc:80,ot:0}};for(const [entity,key,payload]of [['in_transit','o',o],['production_report','old',old],['warehouse_in','warehouse',{receivedQuantity:100}]])await c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'TEST','TEST').run();const text=JSON.stringify(input()),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);assert.equal(p.batch.summary.blocking,0);assert.equal(p.batch.summary.replaced,1);assert.ok(p.batch.summary.overlaps>0);assert.equal(p.batch.reports.reduce((s,r)=>s+r.approvedQuantity,0),100);assert.ok(p.batch.reports.every(r=>r.hours.total>7));await assert.rejects(()=>productionHistoryImport(c.db,{action:'save',text,revision:'stale'},actor,[]),{status:409});await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);const state=await readProductionWorkflow(c.db,actor,[]);assert.equal(state.reports.filter(r=>!r.cancelled).length,2);assert.equal(state.reports.find(r=>r.id==='old').cancelled,true);assert.equal((await productionHistoryImport(c.db,{action:'save',text},actor,[])).replayed,true);assert.equal((await readProductionWorkflow(c.db,{...actor,line:'B'},[])).reports.length,0);assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").first()).payload).receivedQuantity,100);}finally{await c.close();}});

test('incremental merge keeps unrelated reports, resolves exact prior start and backfills FINAL once',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'erp-merge-')));try{
 await migrate(c.db);
 const put=(entity,key,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(p),'TEST','TEST').run();
 await put('in_transit','o',{id:'o',planId:'PLAN',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:100,week:'2026-10-12',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const original={...stage('D401-20261015001','A-CUT'),id:'ERP-STAGE:D401-20261015001',kind:'completion',transitId:'o',sourceDocument:'D401-20261015001',employees:['NV'],reviewStatus:'Đã xác nhận',approvedQuantity:0,reportedQuantity:0};
 await put('production_report',original.id,original);
 await put('production_report','unrelated',{...original,id:'unrelated',sourceDocument:'D401-20261015009'});
 const data={...input(),updateMode:'merge-documents',from:'2026-10-15',erpStages:[{...stage('D401-20261015001','A-CUT'),startedAt:null},stage('D401-20261015002')]};
 const text=JSON.stringify(data),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);
 assert.equal(p.batch.summary.replaced,1);assert.equal(p.batch.summary.warehouseCreated,1);assert.equal(p.batch.summary.blocking,0);
 await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);
 const rows=(await c.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='production_report'").all()).results;
 assert.equal(rows.length,3);assert.ok(rows.every(r=>!JSON.parse(r.payload).cancelled));
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,1);
 assert.equal((await productionHistoryImport(c.db,{action:'save',text},actor,[])).replayed,true);
 const bad={...data,erpStages:[{...stage('D401-20261015999'),startedAt:null}]};const bp=await productionHistoryImport(c.db,{action:'preview',text:JSON.stringify(bad)},actor,[]);assert.equal(bp.batch.summary.blocking,1);
 }finally{await c.close();}
});

test('pending ERP import resolves stored starts, preserves approved duplicate, writes no warehouse or transit totals',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'erp-pending-')));try{
 await migrate(c.db);const put=(entity,key,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(p),'TEST','TEST').run();
 const o={id:'o',planId:'PLAN',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:100,week:'2026-10-12',syncStatus:'ĐÃ ĐỒNG BỘ',completedQty:0};await put('in_transit','o',o);
 const prior={...stage('D401-20261015001','A-CUT'),id:'ERP-STAGE:D401-20261015001',kind:'completion',transitId:'o',employees:['NV'],stageQuantity:100,reportedQuantity:0,approvedQuantity:0,reviewStatus:'Đã xác nhận',reviewedBy:'QLSX'};await put('production_report',prior.id,prior);
 await put('production_event','start',{id:'start',sourceVerified:true,sourceTimeLog:true,sourceId:'o',line:'A',stageName:'A-FINAL',sourceOperation:'Nhập trạm',effectiveAt:'2026-10-15T08:00:00+07:00'});
 const data={...input(),updateMode:'merge-documents',confirmSourceReports:false,from:'2026-10-15',erpStages:[stage('D401-20261015001','A-CUT'),{...stage('D401-20261015002'),startedAt:null,actualStartedAt:null}]};
 const text=JSON.stringify(data),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);
 assert.equal(p.batch.summary.blocking,0);assert.equal(p.batch.summary.skippedExisting,1);assert.equal(p.batch.reports.length,1);assert.equal(p.batch.pendingReview,true);assert.equal(p.batch.summary.warehouseCreated,0);
 const report=p.batch.reports[0];assert.equal(report.reviewStatus,'Chờ kiểm tra');assert.equal(report.approvedQuantity,0);assert.equal(report.reportedQuantity,100);assert.equal(report.reviewedBy,undefined);assert.equal(report.startedAt,'2026-10-15T08:00:00+07:00');assert.ok(report.hours.total>7);assert.equal(reportReviewBlocker(report),'');assert.match(reportReviewBlocker({...report,hours:{...report.hours,perEmployee:[]}}),/phân bổ/);
 await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);
 const read=async(e,k)=>JSON.parse((await c.db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(e,k).first()).payload);
 assert.deepEqual(await read('in_transit','o'),o);assert.deepEqual(await read('production_report',prior.id),prior);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 assert.equal((await readProductionWorkflow(c.db,actor,[])).reports.find(r=>r.id===report.id).reviewStatus,'Chờ kiểm tra');
 assert.equal((await productionHistoryImport(c.db,{action:'save',text},actor,[])).replayed,true);
 const broken={...await read('production_report',report.id),hours:{...report.hours,perEmployee:[]}};
 await c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=?').bind(JSON.stringify(broken),'production_report',report.id).run();
 const repairText=JSON.stringify({...data,repairPendingHours:true});
 const rp=await productionHistoryImport(c.db,{action:'preview',text:repairText},actor,[]);
 assert.equal(rp.batch.summary.updatedReports,1);assert.equal(rp.batch.summary.skippedExisting,1);assert.equal(rp.batch.summary.newReports,0);
 assert.equal(reportReviewBlocker(rp.batch.reports[0]),'');assert.equal(rp.batch.reports[0].hours.total,broken.hours.total);
 await productionHistoryImport(c.db,{action:'save',text:repairText,revision:rp.revision},actor,[]);
 const fixed=await read('production_report',report.id);assert.equal(fixed.reviewStatus,'Chờ kiểm tra');assert.equal(fixed.approvedQuantity,0);assert.equal(fixed.version,2);assert.equal(fixed.reportedBy,broken.reportedBy);assert.equal(fixed.hours.perEmployee.length,1);
 assert.deepEqual(await read('production_report',prior.id),prior);assert.deepEqual(await read('in_transit','o'),o);
 }finally{await c.close();}
});

test('unnamed line cleaning does not discard explicitly named ERP hour allocations',()=>{
 const r={...stage('D401-1'),id:'r',startedAt:'2026-10-15T14:53:09+07:00',completedAt:'2026-10-15T16:10:54+07:00',employees:['NV1','NV2','NV3'],pauses:[]};
 const day=erpFallbackDay('2026-10-15');day.cleaning=[{start:'16:00',end:'17:00',people:2,employees:[]}];
 const h=calculateErpStage(r,{'2026-10-15':erpScheduleDay(day)});
 assert.equal(h.perEmployee.length,3);assert.ok(Math.abs(h.total-h.perEmployee.reduce((s,p)=>s+p.total,0))<0.0004);assert.ok(Math.abs(h.total-3.3875)<0.0001);
 day.cleaning[0].employees=['NV1'];day.cleaning[0].people=1;
 const named=calculateErpStage(r,{'2026-10-15':erpScheduleDay(day)});
 assert.ok(named.perEmployee.find(p=>p.id==='NV1').total<named.perEmployee.find(p=>p.id==='NV2').total);
});
