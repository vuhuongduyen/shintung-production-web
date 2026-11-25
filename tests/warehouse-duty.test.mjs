import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {mutateProductionWorkflow,readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {warehouseHelperNames,dutyDates,dutyRows} from '../lib/warehouse-duty.mjs';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
const manager={login:'vthduyen',isAdmin:true},week='2026-10-19';
async function fixture(fn){mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const conn=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/duty-')));try{await migrate(conn.db);const db=conn.db,put=(entity,key,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'TEST','2026-10-18').run();for(const [i,name] of warehouseHelperNames.entries())await put('employees',`NV${i}`,{name,line:'A',active:true});await put('employees','OTHER',{name:'Người khác',line:'A',active:true});await put('employees','OTHER-LINE',{name:'Nhân viên Line B',line:'B',active:true});const days=[...dutyDates(week),'2026-10-25'].map(date=>({date,working:date!=='2026-10-25',hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false}));await put('capacity',week,{schemaVersion:1,week,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:3,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:['NV0','NV1','NV2'],ot:[]}))}}]});await fn(db);}finally{await conn.close();}}
const payload=()=>({action:'warehouse-duty',week,line:'A',expectedId:null,requestIdempotency:crypto.randomUUID(),rows:dutyDates(week).map(date=>({date,employee:'NV0',start:'',end:''}))});
test('weekly plan, substitute, open interval, completion persist atomically and retry does not duplicate',()=>fixture(async db=>{
 const body=payload();body.rows[2].employee='NV1';let result=await mutateProductionWorkflow(db,body,manager);assert.equal(result.events.length,1);const first=result.event;
 let state=await readProductionWorkflow(db,manager);assert.equal(state.events.filter(e=>e.kind==='line-absence').length,0);assert.equal(dutyRows(state.events,week,'A',effectiveAttendance(state.events,true))[2].employee,'NV1');
 body.expectedId=first.id;body.requestIdempotency=crypto.randomUUID();body.rows[0].start='08:00';result=await mutateProductionWorkflow(db,body,manager);assert.equal(result.events.length,1);
 body.expectedId=result.event.id;body.requestIdempotency=crypto.randomUUID();body.rows[0].end='09:00';result=await mutateProductionWorkflow(db,body,manager);assert.equal(result.events.length,2);assert.equal(result.events[1].effectiveAt,'2026-10-19T01:00:00.000Z');assert.equal(result.events[1].endsAt,'2026-10-19T02:00:00.000Z');assert.equal(result.events[1].approved,true);
 const repeated=await mutateProductionWorkflow(db,body,manager);assert.equal(repeated.replayed,true);state=await readProductionWorkflow(db,manager);assert.equal(state.events.filter(e=>e.kind==='line-absence').length,1);assert.equal(state.events.find(e=>e.id===result.event.id).actorId,'vthduyen');
 body.expectedId=result.event.id;body.requestIdempotency=crypto.randomUUID();body.rows[0].end='10:00';await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),/Dùng Sửa/);
 const event=result.events[1];await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:event.id,reason:'Nhập nhầm',requestIdempotency:crypto.randomUUID()},manager);state=await readProductionWorkflow(db,manager);assert.equal(dutyRows(state.events,week,'A',effectiveAttendance(state.events,true))[0].start,'');
}));
test('permissions, allowed people, invalid time, stale version and overlap reject without partial writes',()=>fixture(async db=>{
 const body=payload();await assert.rejects(()=>mutateProductionWorkflow(db,body,{login:'haquyen',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']}),{status:403});
 body.rows[0].employee='OTHER-LINE';await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),/thuộc Line A/);body.rows[0].employee='NV0';body.rows[0].start='24:00';await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),/24h/);body.rows[0].start='';body.expectedId='stale';await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),{status:409});body.expectedId=null;
 await mutateProductionWorkflow(db,{action:'line-absence',line:'A',absenceType:'Phụ kho',employees:['NV0'],effectiveAt:'2026-10-20T01:00:00Z',endsAt:'2026-10-20T02:00:00Z'},manager);
 body.rows[0].start='08:00';body.rows[0].end='09:00';body.rows[1].start='08:30';body.rows[1].end='09:30';await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),/trùng khoảng/);const state=await readProductionWorkflow(db,manager);assert.equal(state.events.filter(e=>e.kind==='warehouse-duty').length,0);assert.equal(state.events.filter(e=>e.kind==='line-absence').length,1);
}));

test('missing approved schedule blocks both advance planning and actual hours without writes',()=>fixture(async db=>{
 await db.prepare("DELETE FROM app_records WHERE entity='capacity'").run();
 const before=(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 for(const complete of [false,true]){const body=payload();if(complete){body.rows[0].start='08:00';body.rows[0].end='09:00';}
 await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),e=>e.status===409&&/chưa có lịch/.test(e.message));}
 assert.deepEqual((await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,before);
}));

test('multiple intervals on one day persist separately and reject overlapping additions',()=>fixture(async db=>{
 const body=payload();body.rows[0].start='08:00';body.rows[0].end='09:00';
 body.rows.splice(1,0,{date:week,rowId:'second-slot',employee:'NV0',start:'14:00',end:'15:00'});
 const result=await mutateProductionWorkflow(db,body,manager);assert.equal(result.events.length,3);
 let state=await readProductionWorkflow(db,manager);const saved=dutyRows(state.events,week,'A',effectiveAttendance(state.events,true));
 assert.deepEqual(saved.filter(r=>r.date===week).map(r=>[r.start,r.end]),[['08:00','09:00'],['14:00','15:00']]);
 body.rows=saved;body.expectedId=result.event.id;body.requestIdempotency=crypto.randomUUID();
 body.rows.push({date:week,rowId:'third-slot',employee:'NV0',start:'14:30',end:'16:00'});
 await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),/trùng khoảng/);
 state=await readProductionWorkflow(db,manager);assert.equal(state.events.filter(e=>e.kind==='line-absence').length,2);
}));

test('any active employee of the selected Line may be planned, without the historical name whitelist',()=>fixture(async db=>{const body=payload();body.rows[0].employee='OTHER';const result=await mutateProductionWorkflow(db,body,manager);assert.equal(result.event.rows[0].employee,'OTHER');assert.equal(result.events.length,1);const saved=await readProductionWorkflow(db,manager);assert.equal(saved.events.find(e=>e.id===result.event.id).rows[0].employee,'OTHER');}));

for(const variant of ['moved','inactive','removed','deleted','cancelled'])test(`unchanged incomplete historical duty survives directory change: ${variant}`,()=>fixture(async db=>{
 const original=payload();original.rows[0].start='08:00';const first=await mutateProductionWorkflow(db,original,manager);
 if(variant==='removed')await db.prepare("DELETE FROM app_records WHERE entity='employees' AND record_key='NV0'").run();
 else{const field={moved:'line',inactive:'active',deleted:'_deleted',cancelled:'cancelled'}[variant],value={moved:'B',inactive:false,deleted:true,cancelled:true}[variant];await db.prepare("UPDATE app_records SET payload=json_set(payload,?,json(?)) WHERE entity='employees' AND record_key='NV0'").bind('$.'+field,JSON.stringify(value)).run();}
 const next={...original,expectedId:first.event.id,requestIdempotency:crypto.randomUUID(),rows:original.rows.map(r=>({...r}))};next.rows[1].employee='NV1';
 const result=await mutateProductionWorkflow(db,next,manager);assert.equal(result.events.length,1,'incomplete plans never deduct actual hours');assert.equal(result.event.rows[0].employee,'NV0');assert.equal(result.event.rows[0].start,'08:00');assert.equal(result.event.rows[0].end,'');assert.equal(result.event.rows[1].employee,'NV1');
 const state=await readProductionWorkflow(db,manager);assert.deepEqual(state.events.find(e=>e.id===first.event.id).rows,first.event.rows,'original plan history is retained');assert.equal(state.events.filter(e=>e.kind==='line-absence').length,0);
}));
test('historical eligibility retention cannot authorize changed times, new assignments or copied new rows',()=>fixture(async db=>{
 const original=payload();original.rows.forEach((r,i)=>r.employee=i===0?'NV0':'NV1');original.rows[0].start='08:00';const first=await mutateProductionWorkflow(db,original,manager);
 await db.prepare("UPDATE app_records SET payload=json_set(payload,'$.active',json('false')) WHERE entity='employees' AND record_key='NV0'").run();
 for(const change of ['start','end','assignment','new-row']){const next={...original,expectedId:first.event.id,requestIdempotency:crypto.randomUUID(),rows:original.rows.map(r=>({...r}))};
  if(change==='start')next.rows[0].start='08:30';if(change==='end')next.rows[0].end='09:00';if(change==='assignment')next.rows[1].employee='NV0';if(change==='new-row')next.rows.push({date:week,rowId:'NEW-HISTORICAL-COPY',employee:'NV0',start:'',end:''});
  await assert.rejects(()=>mutateProductionWorkflow(db,next,manager),{status:422});
 }
 const state=await readProductionWorkflow(db,manager);assert.equal(state.events.filter(e=>e.kind==='warehouse-duty').length,1);assert.equal(state.events.filter(e=>e.kind==='line-absence').length,0);
}));
test('unchanged recorded duty and its employee attribution remain intact after an employee becomes inactive',()=>fixture(async db=>{
 const original=payload();original.rows.forEach((r,i)=>r.employee=i===0?'NV0':'NV1');original.rows[0].start='08:00';original.rows[0].end='09:00';const first=await mutateProductionWorkflow(db,original,manager);
 await db.prepare("UPDATE app_records SET payload=json_set(payload,'$.active',json('false')) WHERE entity='employees' AND record_key='NV0'").run();
 const state=await readProductionWorkflow(db,manager),next={...original,expectedId:first.event.id,requestIdempotency:crypto.randomUUID(),rows:dutyRows(state.events,week,'A',effectiveAttendance(state.events,true)).map(r=>({...r,employee:r.date==='2026-10-20'?'NV1':r.employee}))};
 const result=await mutateProductionWorkflow(db,next,manager);assert.equal(result.events.length,1);assert.equal(result.event.rows[0].attendanceId,first.events[1].id);assert.equal(result.event.rows[0].employee,'NV0');
 const after=await readProductionWorkflow(db,manager);assert.deepEqual(after.events.find(e=>e.id===first.events[1].id),state.events.find(e=>e.id===first.events[1].id));
}));

test('a draft Capacity, another week or another Line cannot authorize a warehouse save',()=>fixture(async db=>{
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='capacity' AND record_key=?").bind(week).first();
 const original=JSON.parse(row.payload);
 for(const variant of ['draft','pending','other-line','other-week']){
  const capacity=structuredClone(original);const body=payload();
  if(variant==='draft'){capacity.rows[0].status='Nháp';capacity.rows[0].reviewStatus='draft';}
  if(variant==='pending')capacity.rows[0].reviewStatus='pending';
  if(variant==='other-line')capacity.rows[0].line='B';
  if(variant==='other-week'){body.week='2026-10-26';body.rows=dutyDates(body.week).map(date=>({date,employee:'NV0',start:'',end:''}));}
  await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity' AND record_key=?").bind(JSON.stringify(capacity),week).run();
  const before=(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
  await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),e=>e.status===409&&/chưa có lịch/.test(e.message));
  assert.deepEqual((await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,before);
 }
}));
