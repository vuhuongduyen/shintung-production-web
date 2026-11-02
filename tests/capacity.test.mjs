// Positive confirmation fixtures explicitly acknowledge absent cleaning for the
// selected Lines. Missing/wrong-Line acknowledgement remains tested separately
// in capacity-cleaning-reminder.test.mjs; mutation helpers never add consent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {newCapacity,newDailyCapacity,calculateCapacity,capacitySummaryNumbers,capDays,aggregateCapacityInput,dailyParticipants} from '../lib/capacity.mjs';
import {readCapacity,latestCapacityWeek,mutateCapacity as mutateCapacityAtTime,capacityAdjustmentOpen,capacityPermissions,listCapacityRequests} from '../scripts/local/capacity.mjs';
import {readEmployees,saveEmployee,importEmployees} from '../scripts/local/employees.mjs';
import {getPlan,mutatePlan} from '../scripts/local/production-plan.mjs';
import {summary,weekEnd} from '../lib/production-plan.mjs';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
const week='2026-09-21',admin={login:'TEST-capacity',isAdmin:true,line:'A',canReopenPlan:true};
const mutateCapacity=(db,body,actor)=>mutateCapacityAtTime(db,{...(body.action==='requestChange'?{intendedChange:'Điều chỉnh lịch làm việc'}:{}),...body},actor,()=>Date.parse('2026-09-18T09:00:00+07:00'));
const input=()=>({...newCapacity(week,'A').input,leaveMode:'detailed',workers:15,otWorkers:15,otEnabled:true,otDays:capDays(week).map((_,i)=>({enabled:i===0,workers:null,hours:null}))});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('one summary layout preserves capacity arithmetic for old aggregate and daily weeks',()=>{
 const old={...newCapacity(week,'A').input,leaveMode:'aggregate',workers:12,otWorkers:12,otEnabled:true,hcLeaveTotal:8,otLeaveTotal:3.5};old.otDays[0].enabled=true;
 const daily=newDailyCapacity(week,'B').input;daily.workers=12;daily.otWorkers=12;daily.dailySchedule[0].ot=true;
 for(const input of [old,daily]){const result=calculateCapacity(input,week),n=capacitySummaryNumbers(input,result);near(n.hcGross-n.hcLeave-n.breaks-n.clean-n.otherHc,n.hcNet);near(n.otGross-n.otLeave-n.otherOt,n.otNet);near((n.hcNet+n.otNet)*input.factor/100,n.available);}
});
test('daily names and counts exclude full leave and retain partial leave',()=>{
 const p=newDailyCapacity(week,'A').input;
 p.dailyRoster=p.dailySchedule.map(d=>({date:d.date,hc:d.working?['A1','A2','A3']:[],ot:d.working?['A1','A2','A3']:[]}));
 p.dailySchedule[0].ot=true;
 p.dailyHcLeave=[{date:week,to:week,employees:['A1'],people:1,mode:'full',includeOt:true},{date:week,to:week,employees:['A2'],people:1,mode:'hours',start:'09:00',end:'10:00'}];
 p.dailyOtLeave=[{date:week,employees:['A3'],people:1,mode:'full'}];
 const shown=dailyParticipants(p,0);
 assert.deepEqual(shown.hc,['A2','A3']);assert.deepEqual(shown.ot,['A2']);
 assert.equal(shown.hcCount,2);assert.equal(shown.otCount,1);
 assert.equal(shown.partialHc[0].start,'09:00');
 assert.equal(dailyParticipants(p,6).hcCount,0);
});
test('calendar is Monday through Sunday independent of timezone; overtime 52.5 → 44 and extra workers',()=>{
 assert.equal(weekEnd(week),'2026-09-27');assert.equal(capDays(week).length,7);
 const p=input();near(calculateCapacity(p,week).otHours,52.5);
 p.otLeaves=[{employees:['e1','e2'],date:week,mode:'full'},{employees:['e3'],date:week,mode:'attended',hours:2}];
 near(calculateCapacity(p,week).otHours,44);
 p.otWorkers=18;near(calculateCapacity(p,week).otHours,54.5);
 p.otLeaves=[];p.otEnabled=false;near(calculateCapacity(p,week).otHours,0);
});
test('full-day leave excludes break/clean only once; holidays and non-working days contribute zero',()=>{
 const p=input();p.workers=1;p.otEnabled=false;p.hcLeaves=[{employees:['e1'],from:week,to:'2026-09-26',mode:'full'}];
 near(calculateCapacity(p,week).hcHours,0);
 p.hcLeaves=[];p.holidays=['2026-09-26'];near(calculateCapacity(p,week).hcHours,5*(8-1/3));
});
test('hourly leave merges overlaps with breaks and cleaning; no clock assumptions',()=>{
 const p=input();p.workers=1;p.otEnabled=false;p.workDays=[true,false,false,false,false,false,false];p.cleanDay=0;
 p.hcLeaves=[{employees:['e1'],from:week,to:week,mode:'hours',start:'09:00',end:'11:00'},{employees:['e1'],from:week,to:week,mode:'hours',start:'10:00',end:'12:00'}];
 assert.throws(()=>calculateCapacity(p,week),/khung giờ/);
 p.hcSlots='08:00-12:00,13:00-17:00';p.breakStart='10:00';p.cleanStart='11:00';
 near(calculateCapacity(p,week).hcHours,5); // three hours union, including break + cleaning
 p.breakMinutes=20.1;near(calculateCapacity(p,week).hcHours,5); // fractional minutes do not fail interval containment
 p.breakMinutes=20;
 p.hcLeaves.push({employees:['e1'],from:week,to:week,mode:'full'});near(calculateCapacity(p,week).hcHours,0);
});
test('overtime leave validates schedule, employees, duplicate full/partial and actual intervals',()=>{
 const p=input();p.otLeaves=[{employees:['e1'],date:week,mode:'full'},{employees:['e1'],date:week,mode:'attended',hours:2}];assert.throws(()=>calculateCapacity(p,week),/Duplicate/);
 p.otLeaves=[{employees:['e1'],date:week,mode:'interval',start:'19:00',end:'20:00'}];assert.throws(()=>calculateCapacity(p,week),/actual time/);
 p.otStart='18:00';near(calculateCapacity(p,week).otHours,51.5);
 p.otDays[0].enabled=false;assert.throws(()=>calculateCapacity(p,week),/Resolve/);
 p.otDays[0].enabled=true;p.otLeaves[0]={employees:['e1'],date:week,mode:'attended',hours:4};assert.throws(()=>calculateCapacity(p,week),/Invalid/);
 p.otLeaves=[];p.workers=-1;assert.throws(()=>calculateCapacity(p,week),/Invalid/);
});
async function isolated(fn){mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const path=mkdtempSync(resolve(root,'.local-data/tests/capacity-'));const c=await openDatabase(path);try{await migrate(c.db);await fn(c.db);}finally{await c.close();}}
const mutate=(db,action,revision,rest={})=>mutateCapacity(db,{action,week,revision,lines:['A','B'],...rest},admin);
async function review(db,line,decision='approve'){let state=await readCapacity(db,week,admin);let row=state.rows.find(r=>r.line===line);if(row.reviewStatus==='await-sync'){await mutate(db,'sync',state.revision,{lines:[line]});state=await readCapacity(db,week,admin);row=state.rows.find(r=>r.line===line);}return mutate(db,'review',state.revision,{lines:[line],requestAt:row.request.at,decision,reason:decision==='reject'?'Incorrect':'Approved'});}
test('Capacity opens newest saved week with permission checks and ignores deleted weeks',()=>isolated(async db=>{
 assert.equal(await latestCapacityWeek(db,admin),null);
 await assert.rejects(()=>latestCapacityWeek(db,{login:'guest'}),error=>error.status===403);
 await mutate(db,'create',0);
 assert.equal(await latestCapacityWeek(db,admin),week);
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-09-28',JSON.stringify({schemaVersion:1,week:'2026-09-28',rows:[],revision:1}),'TEST','test').run();
 assert.equal(await latestCapacityWeek(db,admin),'2026-09-28');
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-10-05',JSON.stringify({_deleted:true,week:'2026-10-05'}),'TEST','test').run();
 assert.equal(await latestCapacityWeek(db,admin),'2026-09-28');
}));
async function unlock(db,line,reason='Adjust capacity'){const s=await readCapacity(db,week,admin);await mutate(db,'requestChange',s.revision,{lines:[line],reason});return review(db,line);}

test('adjustment cutoff is Saturday before plan week in Vietnam; backend blocks every unlock path',()=>isolated(async db=>{
 assert.equal(capacityAdjustmentOpen(week,Date.parse('2026-09-19T23:59:59+07:00')),true);
 assert.equal(capacityAdjustmentOpen(week,Date.parse('2026-09-20T00:00:00+07:00')),false);
 await mutate(db,'create',0);await mutate(db,'confirm',1,{noCleaningAcknowledgedLines:['A'],lines:['A']});await review(db,'A');
 let state=await readCapacity(db,week,admin);
 const at=(action,extra,time)=>mutateCapacityAtTime(db,{action,week,revision:state.revision,lines:['A'],...(action==='requestChange'?{intendedChange:'Change work schedule'}:{}),...extra},admin,()=>Date.parse(time));
 await assert.rejects(()=>at('requestChange',{reason:'Late'},'2026-09-19T17:00:00Z'),e=>e.status===409);
 await at('requestChange',{reason:'Change schedule'},'2026-09-19T16:59:59Z');state=await readCapacity(db,week,admin);
 await assert.rejects(()=>at('review',{decision:'approve',requestAt:state.rows[0].request.at},'2026-09-19T17:00:00Z'),e=>e.status===409);
 await at('review',{decision:'approve',requestAt:state.rows[0].request.at},'2026-09-19T16:59:59Z');state=await readCapacity(db,week,admin);
 assert.equal(state.rows[0].status,'Nháp');assert.equal(state.rows[0].reviewStatus,'adjusting');
 await assert.rejects(()=>at('revoke',{reason:'Unnecessary'},'2026-09-19T16:59:59Z'),e=>e.status===409);
 await assert.rejects(()=>at('save',{inputs:{A:state.rows[0].input}},'2026-09-19T17:00:00Z'),e=>e.status===409);
 await assert.rejects(()=>at('confirm',{},'2026-09-19T17:00:00Z'),e=>e.status===409);
}));

test('durable A/B confirmation, KHSX approval, one-time adjustment and CAS',()=>isolated(async db=>{
 const empty=await readCapacity(db,week,admin);assert.equal(empty.revision,0);
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='capacity'").first()).n,0);
 await mutate(db,'create',0);
 const p=input(),b={...input(),workers:10,otWorkers:10};
 let s=await mutate(db,'save',1,{inputs:{A:p,B:b}});assert.equal(summary([],s.rows,week)[0].available,null);
 s=await mutate(db,'confirm',2,{noCleaningAcknowledgedLines:['A','B']});assert.equal(s.rows[0].version,1);assert.equal(s.rows[0].editCount,0);
 assert.equal(s.rows[0].reviewStatus,'await-sync');assert.equal((await listCapacityRequests(db,admin)).length,0);
 s=await mutate(db,'sync',s.revision);assert.equal((await listCapacityRequests(db,admin)).length,2);
 await assert.rejects(()=>mutate(db,'sync',s.revision,{lines:['A']}),e=>e.status===409);
 await assert.rejects(()=>mutate(db,'revoke',s.revision,{lines:['A'],reason:'Already synced'}),e=>e.status===409);
 await review(db,'A');await review(db,'B');s=await readCapacity(db,week,admin);
 assert.equal(s.rows[0].reviewStatus,'approved');assert.equal(s.rows[1].reviewStatus,'approved');
 await assert.rejects(()=>mutate(db,'revoke',s.revision,{lines:['A'],reason:'Unauthorized change'}),e=>e.status===409);
 await unlock(db,'A');s=await readCapacity(db,week,admin);assert.equal(s.rows[0].status,'Nháp');assert.equal(s.rows[0].reviewStatus,'adjusting');assert.equal(s.rows[0].unlockedBy,admin.login);assert.equal(s.rows[0].history.at(-1).action,'review');assert.equal(s.rows[1].status,'Đã xác nhận');
 p.workers=16;p.otWorkers=16;
 await mutate(db,'save',s.revision,{lines:['A'],inputs:{A:p}});s=await readCapacity(db,week,admin);
 await mutate(db,'save',s.revision,{lines:['A'],inputs:{A:p}});s=await readCapacity(db,week,admin);
 const old=s.revision;s=await mutate(db,'confirm',s.revision,{noCleaningAcknowledgedLines:['A'],lines:['A']});assert.equal(s.rows[0].editCount,1);assert.equal(s.rows[1].editCount,0);assert.equal(s.rows[0].version,2);
 assert.equal(s.rows[0].reviewStatus,'await-sync');assert.ok(s.rows[0].history.at(-1).changes.some(c=>c.field==='workers'&&c.old===15&&c.new===16));
 await assert.rejects(()=>mutate(db,'save',old,{lines:['B'],inputs:{B:b}}),e=>e.status===409);
 const both=await Promise.allSettled([mutate(db,'save',s.revision,{lines:['B'],inputs:{B:b}}),mutate(db,'save',s.revision,{lines:['B'],inputs:{B:b}})]);
 assert.equal(both.filter(r=>r.status==='fulfilled').length,0,'confirmed line cannot be edited');
 const nextWeek=await readCapacity(db,'2026-09-28',admin);assert.equal(nextWeek.revision,0);
}));
test('older adjustment approvals can be edited directly without a revoke',()=>isolated(async db=>{
 await mutate(db,'create',0);await mutate(db,'confirm',1,{noCleaningAcknowledgedLines:['A'],lines:['A']});await review(db,'A');
 let state=await readCapacity(db,week,admin);await mutate(db,'requestChange',state.revision,{lines:['A'],reason:'Change shift'});await review(db,'A');
 state=await readCapacity(db,week,admin);const legacy=structuredClone(state);delete legacy.permissions;delete legacy.employees;delete legacy.legacy;
 const row=legacy.rows.find(r=>r.line==='A');row.status='Đã xác nhận';row.reviewStatus='adjust-approved';row.editPermission={version:row.version,approvedAt:row.unlockedAt,approvedBy:row.unlockedBy,used:false};
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity' AND record_key=?").bind(JSON.stringify(legacy),week).run();
 state=await readCapacity(db,week,admin);const saved=await mutate(db,'save',state.revision,{lines:['A'],inputs:{A:state.rows[0].input}});
 assert.equal(saved.rows[0].status,'Nháp');assert.equal(saved.rows[0].reviewStatus,'adjusting');assert.equal(saved.rows[0].history.at(-1).action,'save');
}));
test('permission separation, employee without login, removal of overtime with leave must be explicit',()=>isolated(async db=>{
 const viewer={login:'view',grants:['Quản lý sản xuất / Capacity tuần / Xem']};assert.equal(capacityPermissions(viewer).confirm,false);
 await assert.rejects(()=>mutateCapacity(db,{action:'create',week,revision:0},viewer),e=>e.status===403);
 await mutate(db,'create',0);await mutateCapacity(db,{action:'employee',id:'e1',name:'Employee without login'},admin);
 const p=input();p.hcLeaves=[{employees:['e1'],from:week,to:week,mode:'full',otFull:true}];await mutate(db,'save',1,{lines:['A'],inputs:{A:p}});
 p.otDays[0].enabled=false;await assert.rejects(()=>mutate(db,'save',2,{lines:['A'],inputs:{A:p}}),/xử lý/);
 const confirmer={login:'approve',grants:['Quản lý sản xuất / Capacity tuần / Xem','Quản lý sản xuất / Capacity tuần / Xác nhận']};
 await assert.rejects(()=>mutateCapacity(db,{action:'confirm',week,revision:2,lines:['A'],inputs:{A:p}},confirmer),e=>e.status===403);
 const s=await mutateCapacity(db,{action:'confirm',week,revision:2,lines:['A'],noCleaningAcknowledgedLines:['A']},confirmer);assert.equal(s.rows[0].confirmedBy,'approve');
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='users'").first()).n,0);
}));
test('Plan waits for KHSX, preserves frozen basis, blocks new close while adjusting',()=>isolated(async db=>{
 await mutate(db,'create',0);await mutate(db,'save',1,{lines:['A'],inputs:{A:input()}});
 const row={id:'test-plan',sku:'TEST',week,line:'A',status:'DỰ KIẾN',plan:1,laborHour:1,start:week,end:'2026-09-22',sequence:1};
 const nextRow={...row,id:'next-plan',sku:'TEST-NEXT',sequence:2};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan',week,JSON.stringify({week,revision:1,rows:[row,nextRow]}),'TEST','test').run();
 const close=(revision)=>mutatePlan(db,{action:'close',week,revision,ids:[row.id]},admin);
 await assert.rejects(()=>close(1),e=>e.message==='capacityUnconfirmed');
 await mutate(db,'confirm',2,{noCleaningAcknowledgedLines:['A'],lines:['A']});await assert.rejects(()=>close(1),e=>e.message==='capacityUnconfirmed');
 await review(db,'A');await close(1);
 let plan=await getPlan(db,week);const basis=structuredClone(plan.rows[0].capacityBasis);assert.equal(basis.version,1);
 assert.equal(summary(plan.rows,plan.capacity,week)[0].available,basis.availableHours);
 await mutate(db,'requestChange',(await readCapacity(db,week,admin)).revision,{lines:['A'],reason:'Line staffing changed'});
 plan=await getPlan(db,week);assert.deepEqual(plan.rows[0].capacityBasis,basis);assert.equal(summary(plan.rows,plan.capacity,week)[0].available,null);assert.equal(plan.capacity[0].status,'Chờ điều chỉnh');
 await assert.rejects(()=>mutatePlan(db,{action:'close',week,revision:plan.revision,ids:[nextRow.id]},admin),e=>e.message==='capacityUnconfirmed');
 await review(db,'A');assert.equal((await readCapacity(db,week,admin)).rows[0].status,'Nháp');
 const p=input();p.workers=20;p.otWorkers=20;await mutate(db,'confirm',(await readCapacity(db,week,admin)).revision,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:p}});
 plan=await getPlan(db,week);assert.deepEqual(plan.rows[0].capacityBasis,basis);assert.equal(summary(plan.rows,plan.capacity,week)[0].available,null);assert.equal(plan.capacity[0].status,'Chờ điều chỉnh');
 await review(db,'A');plan=await getPlan(db,week);assert.notEqual(summary(plan.rows,plan.capacity,week)[0].available,basis.availableHours);assert.equal(plan.capacity[0].status,'Đã xác nhận');
 const newHours=plan.capacity[0].availableHours;await mutatePlan(db,{action:'close',week,revision:plan.revision,ids:[nextRow.id]},admin);
 plan=await getPlan(db,week);assert.equal(plan.rows.find(r=>r.id===nextRow.id).capacityBasis.availableHours,newHours);assert.equal(plan.rows.find(r=>r.id===row.id).capacityBasis.availableHours,basis.availableHours);
}));

test('aggregate leave deducts Line totals once, preserves detail and rejects negative/excess totals',()=>{
 const old=input();old.otLeaves=[{employees:['e1','e2'],date:week,mode:'full'},{employees:['e3'],date:week,mode:'attended',hours:2}];
 const p=aggregateCapacityInput(old,week);assert.equal(p.otLeaveTotal,8.5);assert.deepEqual(p.otLeaves,old.otLeaves);
 near(calculateCapacity(p,week).otHours,44); // preserved detail must not be subtracted again
 p.hcLeaveTotal=10;const base=calculateCapacity({...p,hcLeaveTotal:0},week);near(calculateCapacity(p,week).hcHours,base.hcHours-10);
 p.otLeaveTotal=53;assert.throws(()=>calculateCapacity(p,week),/Tổng giờ nghỉ tăng ca/);
 p.otLeaveTotal=-1;assert.throws(()=>calculateCapacity(p,week),/Invalid/);
 p.otLeaveTotal=8.5;p.otEnabled=false;assert.throws(()=>calculateCapacity(p,week),/Tổng giờ nghỉ tăng ca/);
});
test('aggregate leave saves without employees and retains total changes in confirmation history',()=>isolated(async db=>{
 await mutate(db,'create',0);const p={...input(),leaveMode:'aggregate',hcLeaveTotal:10,otLeaveTotal:8.5};
 await mutate(db,'confirm',1,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:p}});
 let s=await readCapacity(db,week,admin);near(s.rows[0].result.otHours,44);assert.equal(s.employees.length,0);
 await review(db,'A');await unlock(db,'A','Adjust total leave');p.otLeaveTotal=7;
 s=await mutate(db,'confirm',(await readCapacity(db,week,admin)).revision,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:p}});near(s.rows[0].result.otHours,45.5);assert.equal(s.rows[0].editCount,1);
 assert.ok(s.rows[0].history.at(-1).changes.some(c=>c.field==='otLeaveTotal'&&c.old===8.5&&c.new===7));
 const plan=await getPlan(db,week);near(plan.capacity[0].availableHours,s.rows[0].availableHours);
}));

test('headcount leave: one person Friday and one Saturday, excluding their breaks and cleaning',()=>{
 const p={...input(),leaveMode:'counted',hcLeaveMode:'rows',otLeaveMode:'rows',hcLeaveRows:[{people:1,from:'2026-09-25',to:'2026-09-25',mode:'full'},{people:1,from:'2026-09-26',to:'2026-09-26',mode:'full'}],otLeaveRows:[],otEnabled:false};
 const result=calculateCapacity(p,week);
 near(result.hcHours,15*8*6-2*8-(15*6-2)*20/60-14);
 near(result.days[4].hcNet,14*(8-20/60));near(result.days[5].hcNet,14*(8-20/60-1));
 p.hcLeaveRows=[{people:1,from:'2026-09-25',to:'2026-09-27',mode:'full'}];near(calculateCapacity(p,week).hcHours,result.hcHours); // Sunday has no regular work
});
test('headcount partial leave handles overlapping breaks/cleaning and validates counts, dates and slots',()=>{
 const p={...input(),leaveMode:'counted',hcLeaveMode:'rows',otLeaveMode:'rows',hcLeaveRows:[{people:1,from:'2026-09-26',to:'2026-09-26',mode:'hours',start:'15:30',end:'16:30'}],otLeaveRows:[],workDays:[false,false,false,false,false,true,false],otEnabled:false};
 assert.throws(()=>calculateCapacity(p,week),/khung giờ/);
 p.hcSlots='08:00-12:00,13:00-17:00';p.breakStart='10:00';p.cleanStart='16:00';
 near(calculateCapacity(p,week).hcHours,15*8-1-15*20/60-14.5);
 p.hcLeaveRows[0].start='10:00';p.hcLeaveRows[0].end='11:00';near(calculateCapacity(p,week).hcLeaveHours,40/60);
 p.hcLeaveRows[0].people=16;assert.throws(()=>calculateCapacity(p,week),/vượt nhân lực/);
 p.hcLeaveRows[0].people=1.5;assert.throws(()=>calculateCapacity(p,week),/số nguyên/);
 p.hcLeaveRows[0].people=1;p.hcLeaveRows[0].from='2026-09-28';assert.throws(()=>calculateCapacity(p,week),/trong tuần/);
});
test('headcount overtime permits full/partial groups and blank trailing rows without employee accounts',()=>{
 const p={...input(),leaveMode:'counted',hcLeaveMode:'rows',otLeaveMode:'rows',hcLeaveRows:[],otLeaveRows:[{people:2,from:week,to:week,mode:'full'},{people:1,from:week,to:week,mode:'attended',hours:2},{people:'',from:'',to:'',mode:'full',start:'',end:'',hours:'',note:''}]};
 near(calculateCapacity(p,week).otHours,44);p.otWorkers=18;near(calculateCapacity(p,week).otHours,54.5);
 p.otDays[0].enabled=false;assert.throws(()=>calculateCapacity(p,week),/không có ngày làm việc/);
});
test('counted leave rows persist, revise with history and update Plan; old totals remain until explicitly replaced',()=>isolated(async db=>{
 await mutate(db,'create',0);
 const p={...input(),leaveMode:'aggregate',hcLeaveTotal:10,otLeaveTotal:8.5};
 await mutate(db,'save',1,{lines:['A'],inputs:{A:p}});
 const detailed={...p,leaveMode:'counted',hcLeaveMode:'rows',otLeaveMode:'aggregate',hcLeaveRows:[{people:1,from:'2026-09-26',to:'2026-09-26',mode:'full'}],otLeaveRows:[]};
 let s=await mutate(db,'confirm',2,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:detailed}});near(s.rows[0].result.otHours,44);assert.equal(s.employees.length,0);
 assert.equal(s.rows[0].history.at(-1).before.hcLeaveTotal,10);assert.equal(s.rows[0].input.hcLeaveRows[0].people,1);
 await review(db,'A');await unlock(db,'A','More people absent');detailed.hcLeaveRows[0].people=2;
 s=await mutate(db,'confirm',(await readCapacity(db,week,admin)).revision,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:detailed}});assert.equal(s.rows[0].editCount,1);
 assert.ok(s.rows[0].history.at(-1).changes.some(c=>c.field==='hcLeaveRows.0.people'&&c.old===1&&c.new===2));
 near((await getPlan(db,week)).capacity[0].availableHours,s.rows[0].availableHours);
}));

test('daily schedule: overtime, additional staff, Saturday absence/cleaning and training',()=>{
 const p=newDailyCapacity(week,'A').input;p.workers=15;p.otWorkers=15;p.dailySchedule[0].ot=true;
 near(calculateCapacity(p,week).days[0].otNet,52.5);
 p.dailyOtLeave=[{date:week,people:2,mode:'full'},{date:week,people:1,mode:'attended',hours:2}];
 near(calculateCapacity(p,week).days[0].otNet,44);
 p.dailySchedule[0].otWorkers=18;near(calculateCapacity(p,week).days[0].otNet,54.5);
 const saturday='2026-09-26';p.dailyHcLeave=[{date:saturday,people:1,mode:'full'}];
 p.dailySchedule[5].cleaning=[{people:5,start:'16:00',end:'17:00'}];
 near(calculateCapacity(p,week).days[5].hcNet,15*8-8-14/3-5);
 p.otherTime=[{date:week,part:'hc',people:3,start:'08:00',end:'10:00',reason:'Đào tạo'}];
 near(calculateCapacity(p,week).days[0].otherHcHours,6);
 p.dailySchedule[5].working=false;assert.throws(()=>calculateCapacity(p,week),/ngày nghỉ có dữ liệu/);
 p.dailySchedule[5].working=true;p.dailySchedule[0].ot=false;assert.throws(()=>calculateCapacity(p,week),/không có lịch tăng ca/);
});
test('daily schedule: hourly absence at break is deducted once; concurrent staff cannot exceed attendance',()=>{
 const p=newDailyCapacity(week,'B').input;p.workers=2;p.otWorkers=2;
 p.dailyHcLeave=[{date:week,people:1,mode:'hours',start:'09:00',end:'10:10'}];
 const result=calculateCapacity(p,week).days[0];
 near(result.hcLeave,1);near(result.breakHours, 2*20/60);
 near(result.hcNet,16-1-2*20/60);
 p.dailySchedule[0].cleaning=[{people:1,start:'09:30',end:'10:00'}];near(calculateCapacity(p,week).days[0].cleanHours,.5);
 p.dailySchedule[0].cleaning[0].people=2;assert.throws(()=>calculateCapacity(p,week),/cùng thời điểm/);
 p.dailySchedule[0].cleaning=[];p.otherTime=[{date:week,people:1,part:'hc',start:'09:30',end:'10:00',reason:'Kiểm kê'}];assert.throws(()=>calculateCapacity(p,week),/thời gian khác trùng/);
});
test('numbered cleaning groups can overlap while their sum stays within attending HC staff',()=>{
 const p=newDailyCapacity(week,'A').input;
 p.workers=10;p.dailyRoster=p.dailySchedule.map(d=>({date:d.date,hc:d.working?Array.from({length:10},(_,i)=>`A${i}`):[],ot:[]}));
 p.dailyHcLeave=[{date:week,to:week,people:1,employees:['A0'],mode:'full'}];
 p.dailySchedule[0].cleaning=[{people:5,start:'16:00',end:'17:00'},{people:4,start:'16:30',end:'17:00'}];
 near(calculateCapacity(p,week).days[0].cleanHours,7);
 p.dailySchedule[0].cleaning[1].people=5;
 assert.throws(()=>calculateCapacity(p,week),/tổng số người vệ sinh vượt/);
 p.dailySchedule[0].cleaning[1].people=4;
 p.dailyHcLeave.push({date:week,to:week,people:1,employees:['A1'],mode:'hours',start:'16:30',end:'17:00'});
 assert.throws(()=>calculateCapacity(p,week),/cùng thời điểm/);
});
test('saving numbered cleaning validates daily attendance at the backend',()=>isolated(async db=>{
 await saveEmployee(db,{id:'A-001',name:'Nhân viên A',line:'A',startDate:'2026-01-01',active:true,version:0},admin);
 await saveEmployee(db,{id:'A-002',name:'Nhân viên B',line:'A',startDate:'2026-01-01',active:true,version:0},admin);
 const initial=await readCapacity(db,week,admin),inputs=Object.fromEntries(initial.rows.map(row=>[row.line,row.input]));
 inputs.A.dailySchedule[0].cleaning=[{people:1,start:'16:00',end:'17:00'},{people:1,start:'16:30',end:'17:00'}];
 const saved=await mutate(db,'save',initial.revision,{lines:['A'],inputs});
 assert.equal(saved.rows.find(row=>row.line==='A').result.days[0].cleanHours,1.5);
 inputs.A.dailySchedule[0].cleaning[1].people=2;
 await assert.rejects(()=>mutate(db,'save',saved.revision,{lines:['A'],inputs}),/tổng số người vệ sinh vượt/);
 const retained=await readCapacity(db,week,admin);
 assert.equal(retained.revision,saved.revision);
 assert.equal(retained.rows.find(row=>row.line==='A').input.dailySchedule[0].cleaning[1].people,1);
}));
test('KHSX rejection keeps approved Capacity locked; mismatched review request cannot overwrite decision',()=>isolated(async db=>{
 await mutate(db,'create',0);
 const p=newDailyCapacity(week,'A').input;p.workers=15;p.otWorkers=15;
 await mutate(db,'confirm',1,{noCleaningAcknowledgedLines:['A'],lines:['A'],inputs:{A:p}});
 let s=await readCapacity(db,week,admin);assert.equal(s.rows[0].request,null);await mutate(db,'sync',s.revision,{lines:['A']});s=await readCapacity(db,week,admin);const pending=s.rows[0].request;
 await assert.rejects(()=>mutate(db,'review',s.revision,{lines:['A'],requestAt:'stale',decision:'approve'}),e=>e.status===409);
 await review(db,'A');s=await readCapacity(db,week,admin);assert.equal(s.rows[0].khsxAcceptedBy,admin.login);
 await mutate(db,'requestChange',s.revision,{lines:['A'],reason:'Proposed revision'});
 await review(db,'A','reject');s=await readCapacity(db,week,admin);
 assert.equal(s.rows[0].reviewStatus,'approved');assert.equal(s.rows[0].request.status,'rejected');
 await assert.rejects(()=>mutate(db,'revoke',s.revision,{lines:['A'],reason:'Denied'}),e=>e.status===409);
 assert.equal((await listCapacityRequests(db,admin)).length,0);assert.equal(pending.kind,'capacity');
}));

test('daily leave range skips days without work; linked overtime leave is explicit and cannot double deduct',()=>{
 const p=newDailyCapacity(week,'A').input;p.workers=2;p.otWorkers=2;
 p.dailySchedule[4].ot=true;
 p.dailyHcLeave=[{date:'2026-09-25',to:'2026-09-27',people:1,mode:'full'}];
 const r=calculateCapacity(p,week);
 near(r.days[4].hcLeave,8);near(r.days[5].hcLeave,8);near(r.days[6].hcLeave,0);
 p.dailyHcLeave=[{date:'2026-09-25',to:'2026-09-25',people:1,mode:'full',includeOt:true}];
 near(calculateCapacity(p,week).days[4].otNet,3.5);
 p.dailyOtLeave=[{date:'2026-09-25',people:1,mode:'full'}];
 assert.throws(()=>calculateCapacity(p,week),/trừ hai lần/);
 p.dailyOtLeave=[];p.dailyHcLeave[0].to='2026-09-26';
 near(calculateCapacity(p,week).days[4].otLeave,3.5);
 p.dailySchedule[5].ot=true;p.dailyHcLeave[0].otFrom='2026-09-25';p.dailyHcLeave[0].otTo='2026-09-26';
 near(calculateCapacity(p,week).days[5].otLeave,3.5);
 p.dailyHcLeave[0].otFrom='2026-09-24';
 assert.throws(()=>calculateCapacity(p,week),/Khoảng nghỉ TC phải nằm/);
 p.dailyHcLeave=[{date:'2026-09-27',to:'2026-09-27',people:1,mode:'full'}];
 assert.throws(()=>calculateCapacity(p,week),/không có ngày làm việc/);
});

test('three HC leave days can link two OT days, edit OT hours, and persist without double deduction',()=>isolated(async db=>{
 for(let i=1;i<=2;i++)await saveEmployee(db,{id:`A-00${i}`,name:`Nhân viên A${i}`,line:'A',startDate:'2026-01-01',active:true,version:0},admin);
 const state=await readCapacity(db,week,admin),inputs=Object.fromEntries(state.rows.map(row=>[row.line,row.input])),p=inputs.A;
 for(let i=0;i<3;i++){p.dailySchedule[i].ot=true;p.dailyRoster[i].ot=[...p.dailyRoster[i].hc];}
 p.dailyHcLeave=[{date:week,to:'2026-09-23',people:1,employees:['A-001'],mode:'full',includeOt:true,otFrom:week,otTo:'2026-09-22',otMode:'hours',otStart:'18:00',otEnd:'20:00'}];
 assert.deepEqual([0,1,2].map(i=>calculateCapacity(p,week).days[i].otLeave),[2,2,0]);
 assert.deepEqual([0,1,2].map(i=>dailyParticipants(p,i).otCount),[2,2,2]);
 const saved=await mutate(db,'save',state.revision,{lines:['A'],inputs});
 assert.equal(saved.rows.find(row=>row.line==='A').input.dailyHcLeave[0].otTo,'2026-09-22');
 const next=structuredClone(saved.rows.find(row=>row.line==='A').input);
 next.dailyOtLeave=[{date:week,to:'2026-09-22',people:1,employees:['A-001'],mode:'full'}];
 await assert.rejects(()=>mutate(db,'save',saved.revision,{lines:['A'],inputs:{A:next}}),/trùng hoặc không có/);
 assert.equal((await readCapacity(db,week,admin)).revision,saved.revision);
}));

test('named cleaning groups may overlap for distinct staff; linked OT stays separate from another employee leave',()=>{
 const p=newDailyCapacity(week,'A').input;
 p.workers=3;p.otWorkers=3;
 p.dailyRoster=p.dailySchedule.map(d=>({date:d.date,hc:d.working?['A1','A2','A3']:[],ot:[]}));
 p.dailySchedule[0].cleaning=[{people:1,employees:['A1'],start:'16:00',end:'17:00'},{people:1,employees:['A2'],start:'16:30',end:'17:00'}];
 near(calculateCapacity(p,week).days[0].cleanHours,1.5);
 p.dailySchedule[0].cleaning[1].employees=['A1'];
 assert.throws(()=>calculateCapacity(p,week),/hai nhóm vệ sinh trùng giờ/);
 p.dailySchedule[0].cleaning[1].employees=['A2'];p.dailySchedule[0].ot=true;p.dailyRoster[0].ot=['A1','A2','A3'];
 p.dailyHcLeave=[{date:week,to:week,people:1,employees:['A3'],mode:'full',includeOt:true}];
 p.dailyOtLeave=[{date:week,people:1,employees:['A2'],mode:'full'}];
 near(calculateCapacity(p,week).days[0].otLeave,7);
 p.dailyOtLeave[0].employees=['A3'];assert.throws(()=>calculateCapacity(p,week),/trùng hoặc không có/);
});

test('employee directory retains the short ID and Line C without assigning Line C to Capacity A/B',()=>isolated(async db=>{
 const saved=await saveEmployee(db,{id:'S2024006',secondaryId:'389S',name:'Nhân viên Line C',line:'C',startDate:'2026-01-01',active:true,version:0},admin);
 assert.equal(saved.employee.secondaryId,'389S');
 assert.equal((await readEmployees(db,admin)).employees[0].line,'C');
 const capacity=await readCapacity(db,week,admin);
 assert.deepEqual(capacity.rows.map(row=>row.input.dailyRoster[0].hc),[[],[]]);
}));

test('Capacity viewing grant can read employees but cannot import; import is atomic and never replaces an existing ID',()=>isolated(async db=>{
 const viewer={login:'viewer',grants:['Quản lý sản xuất / Capacity tuần / Xem']};
 assert.equal((await readEmployees(db,viewer)).employees.length,0);
 const rows=[{startDate:'2026-01-01',id:'S001',secondaryId:'001S',name:'Nhân viên A',line:'A'},{startDate:'2026-01-01',id:'S002',secondaryId:'002S',name:'Nhân viên C',line:'C'}];
 await assert.rejects(()=>importEmployees(db,{rows},viewer),e=>e.status===403);
 assert.equal((await importEmployees(db,{rows},admin)).imported,2);
 assert.deepEqual((await importEmployees(db,{rows:[{...rows[0],name:'Không ghi đè'},{startDate:'2026-01-01',id:'S003',name:'Người mới',line:'B'}]},admin)).duplicates,['S001']);
 assert.equal((await readEmployees(db,admin)).employees.length,2);
 assert.equal((await readEmployees(db,admin)).employees[0].name,'Nhân viên A');
}));

test('new week uses 95%; employee roster, named time and first Save persist without a separate Create',()=>isolated(async db=>{
 await saveEmployee(db,{id:'A-001',name:'Nhân viên A',line:'A',startDate:'2026-01-01',active:true,version:0},admin);
 await saveEmployee(db,{id:'B-001',name:'Nhân viên B',line:'B',startDate:'2026-01-01',active:true,version:0},admin);
 assert.equal((await readEmployees(db,admin)).employees.length,2);
 const original=await readCapacity(db,week,admin);
 assert.equal(original.rows[0].input.factor,95);
 assert.deepEqual(original.rows[0].input.dailyRoster[0].hc,['A-001']);
 const inputs=Object.fromEntries(original.rows.map(row=>[row.line,row.input]));
 inputs.A.dailyRoster[0].hc=['B-001'];inputs.B.dailyRoster[0].hc=[];
 inputs.A.otherTime=[{date:week,part:'hc',people:1,employees:['B-001'],start:'08:00',end:'09:00',reason:'Đào tạo',description:'Huấn luyện PCCC'}];
 const saved=await mutateCapacity(db,{action:'save',week,revision:0,lines:['A','B'],inputs},admin);
 assert.equal(saved.rows[0].input.otherTime[0].description,'Huấn luyện PCCC');
 near(saved.rows[0].result.days[0].hcNet,6+2/3);
 const repeated=await readCapacity(db,week,admin);assert.equal(repeated.rows[0].input.factor,95);
 inputs.B.dailyRoster[0].hc=['B-001'];
 await assert.rejects(()=>mutateCapacity(db,{action:'save',week,revision:1,lines:['A','B'],inputs},admin),/cả Line A và B/);
 inputs.B.dailyRoster[0].hc=[];inputs.A.otherTime[0].description='';
 await assert.rejects(()=>mutateCapacity(db,{action:'save',week,revision:1,lines:['A'],inputs},admin),/nội dung thời gian khác/);
}));

test('unsynced revoke is allowed for cnphuong and ntnphung but synced versions remain locked for everyone',()=>isolated(async db=>{
 const owner={login:'admin-repair',isAdmin:true};const clock=()=>Date.parse('2026-09-18T07:00:00Z');
 let s=await mutateCapacityAtTime(db,{action:'create',week,revision:0},owner,clock);
 const act=async(action,extra={},actor=owner)=>s=await mutateCapacityAtTime(db,{action,week,revision:s.revision,lines:['A'],...extra},actor,clock);
 const users=['cnphuong','ntnphung'].map(permissionLogin=>({login:permissionLogin+'@example.test',permissionLogin,grants:['Quản lý sản xuất/Capacity tuần/Xem']}));
 for(const u of users){assert.equal(capacityPermissions(u).revoke,true);assert.equal(capacityPermissions(u).review,false);await act('confirm',{noCleaningAcknowledgedLines:['A'],inputs:{A:input()}});await act('revoke',{reason:'Sửa trước đồng bộ'},u);assert.equal(s.rows[0].status,'Nháp');assert.equal(s.rows[0].history.at(-1).actorId,u.permissionLogin);}
 assert.equal(capacityPermissions({login:'other',grants:[]}).revoke,false);
 await act('confirm',{noCleaningAcknowledgedLines:['A']});await act('sync');
 for(const u of [...users,owner])await assert.rejects(()=>act('revoke',{reason:'Không được bỏ qua'},u),e=>e.status===409);
 await act('review',{decision:'approve',requestAt:s.rows[0].request.at});
 for(const u of [...users,owner])await assert.rejects(()=>act('revoke',{reason:'Không được bỏ qua'},u),e=>e.status===409);
 await act('requestChange',{reason:'Change',intendedChange:'Change hours'});
 await act('review',{decision:'reject',reason:'Giữ lịch cũ',requestAt:s.rows[0].request.at});assert.equal(s.rows[0].status,'Đã xác nhận');
 await act('requestChange',{reason:'Change',intendedChange:'Change hours'});
 await act('review',{decision:'approve',requestAt:s.rows[0].request.at});assert.equal(s.rows[0].status,'Nháp');
 await act('save',{inputs:{A:input()}});await act('confirm',{noCleaningAcknowledgedLines:['A']});
 for(const u of users){await act('revoke',{reason:'Sửa bản điều chỉnh chưa đồng bộ'},u);assert.equal(s.rows[0].reviewStatus,'adjusting');await act('confirm',{noCleaningAcknowledgedLines:['A']});}
 await act('sync');await assert.rejects(()=>act('revoke',{reason:'Đã đồng bộ'}),e=>e.status===409);
}));

test('timed Line C imports persist with audit and reject simultaneous assignment at backend',()=>isolated(async db=>{
 const {transferCapacityStaff}=await import('../lib/capacity-transfers.mjs');
 await saveEmployee(db,{id:'C-001',name:'Kiểm thử Line C',line:'C',startDate:'2026-01-01',active:true,version:0},admin);
 const state=await readCapacity(db,week,admin);
 const changed=transferCapacityStaff(state.rows,state.employees,{ids:['C-001'],from:'C',to:'A',date:week,toDate:week,shift:'hc',start:'09:00',end:'11:00'});
 const inputs=Object.fromEntries(changed.rows.map(r=>[r.line,r.input]));
 await mutateCapacity(db,{action:'save',week,revision:0,lines:['A'],inputs},admin);
 const saved=await readCapacity(db,week,admin);near(saved.rows[0].result.hcHours,11/6);
 assert.deepEqual(saved.rows[0].input.dailyRoster[0].hcWindows['C-001'],[[540,660]]);
 assert.equal(saved.rows[0].history.at(-1).actor,admin.login);
 inputs.B.dailyRoster[0].hc=['C-001'];
 await assert.rejects(()=>mutateCapacity(db,{action:'save',week,revision:1,lines:['B'],inputs},admin),/trùng thời gian/);
 assert.equal((await readCapacity(db,week,admin)).revision,1);
}));
