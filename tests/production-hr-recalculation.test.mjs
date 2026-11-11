import test,{beforeEach,afterEach,mock} from 'node:test';
// Fixed business date plus an explicit tick per mutation preserves event ordering.
// Do not change the production deadline or use a wall-clock-dependent fixture.
beforeEach(()=>mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-09T09:00:00Z')}));
afterEach(()=>mock.timers.reset());
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {mutateProductionWorkflow as mutateAtTime,readProductionWorkflow as read} from '../scripts/local/production-workflow.mjs';
import {calculateErpStage,erpScheduleDay,erpFallbackDay} from '../lib/production-erp-stage.mjs';
const mutate=(...args)=>{mock.timers.tick(1);return mutateAtTime(...args);};
const admin={login:'TEST-ADMIN',isAdmin:true},hr={login:'TEST-HR',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
const id='S2017002',other='TEST-OTHER',at=(day,time)=>`2026-10-${day}T${time}:00+07:00`;
async function fixture(fn){const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-hr-recalc-')));try{await migrate(c.db);
 const put=(entity,key,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(p),'TEST','2026-10-24T00:00:00Z').run();
 const days=Array.from({length:7},(_,i)=>erpFallbackDay(`2026-10-${19+i}`));
 await put('capacity','2026-10-19',{rows:['A','B'].map(line=>({line,version:1,status:'Đã xác nhận',reviewStatus:'approved',input:{workers:2,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:line==='B'?[id,other]:[],ot:[]}))}}))});
 await put('employees',id,{id,name:'Trầm Thuận Phát',line:'C',active:true});await put('employees',other,{id:other,name:'Nhân viên đối chiếu',line:'B',active:true});
 const order={id:'ORDER',planId:'PLAN',lsxCode:'510-26101604',sku:'TEST-SKU',line:'B',lsxQty:100,week:'2026-10-19',syncStatus:'ĐÃ ĐỒNG BỘ'};await put('in_transit',order.id,order);
 const report={id:'ERP-STAGE:TEST',kind:'completion',erpStageImport:true,historicalImport:true,sourceVerified:true,transitId:order.id,orderSnapshot:order,lsxCode:order.lsxCode,sku:order.sku,line:'B',stageName:'B-ASSY',startedAt:at('22','15:19'),completedAt:at('23','10:20'),employees:[id,other],count:2,stageQuantity:100,reportedQuantity:0,approvedQuantity:0,reviewStatus:'Đã xác nhận',reviewedBy:'TEST-QLSX',reviewedAt:'2026-10-24T00:00:00Z',pauses:[],overlapWarnings:[{retained:true}],version:1};
 report.hours=calculateErpStage(report,Object.fromEntries(days.map(d=>[d.date,erpScheduleDay(d)])));await put('production_report',report.id,report);await put('warehouse_in','KEEP',{receivedQuantity:55,warehouseStatus:'Đã xác nhận'});
 const move={id:'MOVE',kind:'line-movement',line:'C',destinationLine:'B',employees:[id],effectiveAt:at('19','08:00'),endsAt:at('23','17:00'),approved:true};await put('production_event',move.id,move);
 const raw=async()=> (await c.db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_report','warehouse_in') ORDER BY entity,record_key").all()).results;
 await fn({db:c.db,put,report,raw});
 }finally{await c.close();}}
const leave={action:'line-absence',attendanceScope:'employee',line:'C',employees:[id],absenceType:'Nghỉ',effectiveAt:at('23','08:00'),endsAt:at('23','17:00')};
const saved=async db=>(await read(db,admin)).reports.find(r=>r.id==='ERP-STAGE:TEST');
const person=(r,id)=>r.hours.perEmployee.find(p=>p.id===id)?.total||0;
test('HR late entry edits and cancellation update confirmed ERP for borrowed Phat without rewriting source or warehouse',()=>fixture(async({db,report,raw})=>{
 const baseline=await raw();const result=await mutate(db,leave,hr);assert.equal(result.pendingHours,false);
 let r=await saved(db);assert.ok(person(r,id)<person(report,id));assert.equal(person(r,other),person(report,other));assert.equal(person(r,id),1.6833);
 const edited=await mutate(db,{...leave,action:'attendance-edit',attendanceId:result.event.id,effectiveAt:at('23','09:00'),reason:'Sửa giờ nghỉ'},hr);r=await saved(db);assert.equal(person(r,id),2.6833);
 await mutate(db,{action:'attendance-cancel',attendanceId:edited.event.id,reason:'Hủy nhập nhầm'},hr);r=await saved(db);assert.equal(person(r,id),person(report,id));assert.deepEqual(await raw(),baseline);
 const audits=(await read(db,admin)).events.filter(e=>e.kind==='hours-adjustment');assert.equal(audits.length,3);assert.ok(audits.every(e=>e.line==='B'));assert.equal(r.reviewStatus,'Đã xác nhận');assert.deepEqual(r.overlapWarnings,[{retained:true}]);
}));
test('QLSX other work immediately adjusts ERP and retains role boundaries',()=>fixture(async({db,report})=>{
 const body={action:'line-absence',line:'B',employees:[other],absenceType:'CV khác',reason:'Đóng gói thử',effectiveAt:at('23','08:00'),endsAt:at('23','09:00')};
 await assert.rejects(()=>mutate(db,body,hr),{status:403});const result=await mutate(db,body,admin);assert.equal(result.pendingHours,false);assert.equal(person(report,other)-person(await saved(db),other),1);
}));
test('backfill previews changes, rejects stale preview, preserves raw records and is idempotent',()=>fixture(async({db,put,report,raw})=>{
 await put('production_event','MISSED',{...leave,id:'MISSED',kind:'line-absence',approved:true,sourceId:null,recordedAt:'2026-10-25T00:00:00Z'});
 const body={action:'recalculate-attendance-hours',month:'2026-10',mode:'preview'};
 await assert.rejects(()=>mutate(db,body,hr),{status:403});const before=await raw(),p=await mutate(db,body,admin);assert.equal(p.changes.length,1);assert.ok(p.changes[0].after<p.changes[0].before);
 await assert.rejects(()=>mutate(db,{...body,mode:'apply',revision:'stale'},admin),{status:409});
 const applied=await mutate(db,{...body,mode:'apply',revision:p.revision},admin);assert.equal(applied.updated,1);assert.deepEqual(await raw(),before);assert.equal(person(await saved(db),id),1.6833);
 assert.equal((await mutate(db,body,admin)).changes.length,0);
}));
test('transfer to another line subtracts only its bounded interval and cancellation restores it',()=>fixture(async({db,report})=>{
 const move=await mutate(db,{action:'line-movement',line:'B',destinationLine:'A',employees:[other],effectiveAt:at('23','08:00'),endsAt:at('23','09:00'),reason:'Điều chuyển thử'},admin);
 assert.equal(person(report,other)-person(await saved(db),other),1);
 await mutate(db,{action:'attendance-cancel',attendanceId:move.event.id,reason:'Hủy chuyển thử'},admin);assert.equal(person(await saved(db),other),person(report,other));
}));
test('saving actual work hours automatically recalculates confirmed ERP, preserves sources, rejects stale save',()=>fixture(async({db,raw})=>{
 const state=await read(db,admin),before=await saved(db),baseline=await raw();
 const approved=state.approvedSchedules.find(s=>s.key==='2026-10-19:B');
 const days=approved.days.map(d=>d.date==='2026-10-23'?{...d,hcStart:'09:00'}:d);
 const body={action:'schedule',week:'2026-10-19',line:'B',version:0,approvedVersion:approved.version,days,reason:'Điều chỉnh giờ bắt đầu làm việc'};
 await assert.rejects(()=>mutate(db,body,hr),{status:403});
 const result=await mutate(db,body,admin);assert.equal(result.affected,1);
 const after=await saved(db);assert.equal(person(before,id)-person(after,id),1);assert.equal(person(before,other)-person(after,other),1);assert.equal(after.reviewStatus,'Đã xác nhận');assert.deepEqual(await raw(),baseline);
 await assert.rejects(()=>mutate(db,body,admin),{status:409});
 const replay=await mutate(db,{...body,version:1},admin);assert.equal(replay.unchanged,true);
 const restored=await mutate(db,{...body,version:1,days:approved.days,reason:'Khôi phục giờ bắt đầu'},admin);assert.equal(restored.affected,1);assert.equal(person(await saved(db),id),person(before,id));
 const audits=(await read(db,admin)).events.filter(e=>e.kind==='hours-adjustment');assert.equal(audits.length,2);
}));

test('HR create/edit/cancel close exactly at midnight GMT+7 and rejected calls preserve every record',()=>fixture(async({db})=>{
 mock.timers.setTime(Date.parse('2026-11-10T16:59:59.998Z'));
 const created=await mutate(db,leave,hr); // explicit tick reaches the final permitted millisecond
 assert.ok(created.event.id);
 const snapshot=async()=>(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const before=await snapshot();
 for(const body of [leave,{...leave,action:'attendance-edit',attendanceId:created.event.id,effectiveAt:at('23','09:00'),reason:'Boundary edit'},
  {action:'attendance-cancel',attendanceId:created.event.id,reason:'Boundary cancellation'}]){
  await assert.rejects(mutate(db,body,hr),error=>error.status===409&&/hết hạn.*2026-10/.test(error.message));
  assert.deepEqual(await snapshot(),before,'deadline rejection must not rewrite data/history');
 }
}));
