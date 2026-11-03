import {newDailyCapacity} from '../lib/capacity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {allocationSnapshot,allocationBlockers,readAllocationQueue,mutateAllocationQueue,assertLegacyAllocationWrite} from '../scripts/local/production-allocation-queue.mjs';
const now='2026-10-16T00:00:00.000Z',at=(hour)=>`2026-10-19T${hour}:00:00+07:00`;
const actor=group=>({login:`manager-${group}`,userId:`manager-${group}`,grants:['Quản lý sản xuất / Lịch SX thực tế / Sửa']});
const offer={action:'offer',reason:'Hỗ trợ kế hoạch tuần',sourceLine:'C',employees:['C1'],effectiveAt:at('08'),endsAt:at('17'),expectedRevision:0,requestId:'offer-request-00000001'};
const accept=(id,revision=1)=>({action:'allocate',offerId:id,employeeId:'C1',targetLine:'A',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:revision,requestId:'accept-request-00000001'});
async function withDb(fn){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'queue-test'}});
 const db=await mf.getD1Database('DB');
 await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 const put=(entity,key,value)=>db.prepare('INSERT OR REPLACE INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'TEST',now).run();
 try{for(const group of ['C','AB'])await put('users',`manager-${group}`,{login:`manager-${group}`,active:true,role:'USER'});await put('production_allocation_scope','global',{schemaVersion:1,enabled:true,managers:[{userId:'manager-C',group:'C'},{userId:'manager-AB',group:'AB'}]});await put('employees','C1',{name:'C One',line:'C',active:true});await put('employees','A1',{name:'A One',line:'A',active:true});const rows=['A','B'].map(line=>{const row=newDailyCapacity('2026-10-19',line,95);row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:line==='A'&&d.working?['A1']:[],ot:[]}));return row;});await put('capacity','2026-10-19',{schemaVersion:1,week:'2026-10-19',revision:1,rows});await fn(db,put);}finally{await mf.dispose();}
}
test('unconfigured/quick-line request fails before operational reads and writes',()=>withDb(async(db)=>{
 let reads=0;const guarded={prepare(sql){reads++;assert.match(sql,/production_allocation_scope/);return db.prepare(sql);}};
 await assert.rejects(()=>readAllocationQueue(guarded,{...actor('C'),userId:'stranger'},now),{status:403});assert.equal(reads,1);
 await assert.rejects(()=>mutateAllocationQueue(guarded,offer,{...actor('C'),authMode:'quick_line'},now),{status:403});assert.equal(reads,2);
}));
test('atomic offer/accept stores planning roster and audit without actual events, with durable idempotency',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);let snapshot=await allocationSnapshot(db);
 assert.equal(snapshot.records('production_event').length,0);
 const dto=await readAllocationQueue(db,actor('AB'),now);assert.equal(dto.pendingPeople,1);assert.deepEqual(dto.candidates.map(e=>e.id),['A1']);assert.equal(dto.offers[0].people[0].name,'C One');
 const received=await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);
 const replay=await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);assert.equal(replay.replayed,true);assert.equal(replay.allocationId,received.allocationId);
 snapshot=await allocationSnapshot(db);assert.equal(snapshot.records('production_event').length,0);assert.ok(snapshot.records('capacity')[0].rows.find(r=>r.line==='A').input.dailyRoster[0].hc.includes('C1'));assert.equal(snapshot.queue.revision,2);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,2);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_allocation_guard'").first()).n,0);
}));
test('two receivers and a racing withdrawal produce exactly one winning transaction',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now),a=accept(sent.offerId),b={...a,targetLine:'B',requestId:'accept-request-00000002'};
 const results=await Promise.allSettled([mutateAllocationQueue(db,a,actor('AB'),now),mutateAllocationQueue(db,b,actor('AB'),now),mutateAllocationQueue(db,{...a,action:'withdraw',reason:'Line nguồn cần nhân lực',requestId:'withdraw-request-00000001'},actor('C'),now)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===409));
 const snapshot=await allocationSnapshot(db);assert.equal(snapshot.queue.revision,2);assert.equal(snapshot.queue.audit.length,2);assert.ok(snapshot.records('production_event').length<=1);
}));
test('employee, scope, HR and Capacity changes between validation and transaction fail with no partial queue write',()=>withDb(async(db,put)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);
 for(const entity of ['employees','capacity','production_event','production_allocation_scope']){
  const before=await allocationSnapshot(db);let injected=false;
  const racing={prepare:sql=>db.prepare(sql),async batch(statements){if(!injected){injected=true;await put(entity,'racing-record',{id:'racing-record',counter:entity});}return db.batch(statements);}};
  await assert.rejects(()=>mutateAllocationQueue(racing,accept(sent.offerId),actor('AB'),now),{status:409});
  const after=await allocationSnapshot(db);assert.deepEqual(after.queue,before.queue);assert.equal(after.records('production_event').filter(e=>e.kind==='line-movement').length,0);
 }
}));
test('transaction rollback removes cursor, movement and queue changes if a Capacity insert fails',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now),before=await allocationSnapshot(db);
 await db.prepare("CREATE TRIGGER fail_queue_movement BEFORE INSERT ON app_records WHEN NEW.entity='capacity' BEGIN SELECT RAISE(ABORT,'TEST event failure'); END").run();
 await assert.rejects(()=>mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now));
 const after=await allocationSnapshot(db);assert.equal(after.serialized,before.serialized);
}));
test('accepted HR absence blocks; pending/cancelled absence does not; station assignments remain reserved while paused',()=>withDb(async(db,put)=>{
 const window={effectiveAt:at('08'),endsAt:at('17')};
 await put('production_event','hr',{id:'hr',kind:'line-absence',line:'C',employees:['C1'],effectiveAt:at('09'),endsAt:at('10'),approved:false});
 assert.equal(allocationBlockers(await allocationSnapshot(db),window).length,0);
 await put('production_event','hr',{id:'hr',kind:'line-absence',line:'C',employees:['C1'],effectiveAt:at('09'),endsAt:at('10'),approved:true});
 assert.ok(allocationBlockers(await allocationSnapshot(db),window).some(b=>b.employeeId==='C1'));
 await put('production_event','cancel',{id:'cancel',kind:'attendance-cancel',supersedes:'hr',approved:true});
 assert.equal(allocationBlockers(await allocationSnapshot(db),window).length,0);
 await put('production_event','start',{id:'start',kind:'start',line:'C',sourceId:'JOB',employees:['C1'],count:1,effectiveAt:at('08')});
 await put('production_event','pause',{id:'pause',kind:'pause',line:'C',sourceId:'JOB',effectiveAt:at('09')});
 const blockers=allocationBlockers(await allocationSnapshot(db),window);assert.ok(blockers.some(b=>b.employeeId==='C1'&&Date.parse(b.endsAt)===Date.parse(at('17'))));
}));
test('legacy writes cannot steal pending time or erase accepted allocation; target station entry stays allowed',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{kind:'line-movement',employees:['C1'],line:'C',destinationLine:'B',effectiveAt:at('09'),endsAt:at('10')}]),{status:409});
 const received=await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[{kind:'start',employees:['C1'],line:'A',effectiveAt:at('09')}]));
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{kind:'start',employees:['C1'],line:'B',effectiveAt:at('09')}]),{status:409});
 assert.equal(received.planning,true);assert.equal(received.movementId,undefined);
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[{kind:'pause',sourceId:'UNRELATED',effectiveAt:at('09')}]));
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[{kind:'line-absence',employees:['C1'],line:'A',effectiveAt:at('09'),endsAt:at('10')}])) ;
}));

test('corrections cannot cancel a release or delay final completion into pending time',()=>withDb(async(db,put)=>{
 await put('production_event','old-start',{id:'old-start',kind:'start',line:'C',sourceId:'JOB',employees:['C1'],count:1,effectiveAt:at('07')});
 const release={id:'release',kind:'reduce',line:'C',sourceId:'JOB',employees:['C1'],count:1,effectiveAt:at('08')};
 await put('production_event','release',release);
 await mutateAllocationQueue(db,offer,actor('C'),now);
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{...release,voided:true}]),{status:409});
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{...release,voided:true},{...release,id:'delayed',effectiveAt:at('09')}]),{status:409});
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{id:'replacement',kind:'start',line:'C',sourceId:'OTHER',employees:['C1'],count:1,effectiveAt:at('09')}]),{status:409});
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[{...release,id:'same-release',effectiveAt:at('08')}]));
}));
test('expired borrowing does not leave phantom actual station blockers on the next window',()=>withDb(async(db,put)=>{
 await put('production_event','move',{id:'move',kind:'line-movement',line:'C',destinationLine:'A',employees:['C1'],count:1,effectiveAt:at('08'),endsAt:at('12')});
 await put('production_event','start',{id:'start',kind:'start',line:'A',sourceId:'JOB',employees:['C1'],count:1,effectiveAt:at('09')});
 const blockers=allocationBlockers(await allocationSnapshot(db),{effectiveAt:at('12'),endsAt:at('17')});assert.ok(!blockers.some(b=>b.employeeId==='C1'));
}));

import {readAllocationScope,saveAllocationScope} from '../scripts/local/production-allocation-scope.mjs';
test('admin scope setup is explicit, validates existing accounts, preserves grants, and can disable revoked managers',()=>withDb(async(db,put)=>{
 const admin={login:'admin',userId:'admin',isAdmin:true};
 for(const group of ['C','AB']){await put('users',`manager-${group}`,{login:`manager-${group}`,name:group,active:true,role:'USER',department:'QLSX'});await put('permissions',`manager-${group}`,{active:true,permissionMode:'CUSTOM',permissions:'Quản lý sản xuất / Lịch SX thực tế / Sửa'});}
 const before=(await db.prepare("SELECT payload FROM app_records WHERE entity='permissions' ORDER BY record_key").all()).results;
 const view=await readAllocationScope(db,admin);assert.ok(view.users.every(u=>u.eligible));
 await assert.rejects(()=>readAllocationScope(db,actor('C')),{status:403});
 await assert.rejects(()=>saveAllocationScope(db,{expectedRevision:view.revision,enabled:true,managers:[null,null]},admin),{status:422});
 await assert.rejects(()=>saveAllocationScope(db,{expectedRevision:view.revision,enabled:true,managers:[{userId:'missing',group:'C'},{userId:'manager-AB',group:'AB'}]},admin),{status:422});
 const managers=[{userId:'manager-C',group:'C'},{userId:'manager-AB',group:'AB'}];
 await put('production_event','unrelated',{id:'unrelated',kind:'pause',effectiveAt:at('08')});
 await saveAllocationScope(db,{expectedRevision:view.revision,enabled:true,managers},admin);
 assert.deepEqual((await db.prepare("SELECT payload FROM app_records WHERE entity='permissions' ORDER BY record_key").all()).results,before);
 await put('users','manager-C',{login:'manager-C',active:false,role:'USER'});
 const revoked=await readAllocationScope(db,admin);assert.equal(revoked.users.find(u=>u.id==='manager-C'),undefined);
 await saveAllocationScope(db,{expectedRevision:revoked.revision,enabled:false,managers},admin);
 await assert.rejects(()=>readAllocationQueue(db,actor('AB'),now),{status:403});
}));

test('acceptance cannot reactivate an old receiving-line station without a new work entry',()=>withDb(async(db,put)=>{
 await put('production_event','old-move',{id:'old-move',kind:'line-movement',line:'C',destinationLine:'A',employees:['C1'],count:1,effectiveAt:at('08'),endsAt:at('10')});
 await put('production_event','old-start',{id:'old-start',kind:'start',line:'A',sourceId:'OLD-JOB',employees:['C1'],count:1,effectiveAt:at('09')});
 const sent=await mutateAllocationQueue(db,{...offer,effectiveAt:at('11'),endsAt:at('12')},actor('C'),now);
 await assert.rejects(()=>mutateAllocationQueue(db,{...accept(sent.offerId),effectiveAt:at('11'),endsAt:at('12')},actor('AB'),now),{status:409});
 const after=await allocationSnapshot(db);assert.equal(after.queue.revision,1);assert.equal(after.records('production_event').length,2);
 await assert.doesNotReject(()=>mutateAllocationQueue(db,{...accept(sent.offerId),targetLine:'B',effectiveAt:at('11'),endsAt:at('12')},actor('AB'),now));
}));

import {allocationSessionGroup} from '../scripts/local/production-allocation-queue.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
test('explicit queue-only capability grants no legacy production/HR permissions and revokes live',()=>withDb(async(db,put)=>{
 const queueOnly={...actor('C'),grants:[],allocationGroup:'AB'};
 assert.equal(await allocationSessionGroup(db,queueOnly),'C');
 assert.deepEqual((await readAllocationQueue(db,queueOnly,now)).candidates.map(p=>p.id),['C1']);
 const noReads={prepare(){assert.fail('Legacy denial must happen before operational data reads');}};
 await assert.rejects(()=>readProductionWorkflow(noReads,queueOnly),{status:403});
 await assert.rejects(()=>mutateProductionWorkflow(noReads,{action:'line-movement'},queueOnly),{status:403});
 await mutateAllocationQueue(db,offer,queueOnly,now);
 await put('production_allocation_scope','global',{schemaVersion:1,enabled:false,managers:[{userId:'manager-C',group:'C'},{userId:'manager-AB',group:'AB'}]});
 assert.equal(await allocationSessionGroup(db,queueOnly),null);
 await assert.rejects(()=>readAllocationQueue(db,queueOnly,now),{status:403});
 await assert.rejects(()=>mutateAllocationQueue(db,{...offer,expectedRevision:1,requestId:'new-request-00000002'},queueOnly,now),{status:403});
 await put('production_allocation_scope','global',{schemaVersion:1,enabled:true,managers:[{userId:'manager-C',group:'C'},{userId:'manager-AB',group:'AB'}]});
 await put('users','manager-C',{login:'manager-C',active:false,role:'USER'});
 assert.equal(await allocationSessionGroup(db,queueOnly),null);
 await assert.rejects(()=>readAllocationQueue(db,queueOnly,now),{status:403});
}));

import {mutateCapacity} from '../scripts/local/capacity.mjs';
test('Admin has explicit A/B/C allocation authority without replacing configured managers',()=>withDb(async(db)=>{
 await mutateAllocationQueue(db,offer,actor('C'),now);
 const admin={login:'admin',isAdmin:true};
 const view=await readAllocationQueue(db,admin,now);
 assert.equal(view.readOnly,false);assert.equal(view.group,'ADMIN');assert.deepEqual(view.sourceLines,['A','B','C']);assert.deepEqual(view.candidates.map(p=>p.id).sort(),['A1','C1']);
 assert.equal(view.offers.length,1);assert.ok(view.offers.every(o=>o.canAllocate&&o.canWithdraw));
 await mutateAllocationQueue(db,accept(view.offers[0].id),admin,now);
}));
test('locked confirmed planning week rejects acceptance without touching queue or actual events',()=>withDb(async(db,put)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);
 const capacity=(await allocationSnapshot(db)).records('capacity')[0];capacity.rows[0].status='Đã xác nhận';
 await put('capacity','2026-10-19',capacity);
 for(const who of [actor('AB'),{login:'ADMIN-ONE',isAdmin:true},{login:'ADMIN-TWO',isAdmin:true}])await assert.rejects(()=>mutateAllocationQueue(db,accept(sent.offerId),who,now),{status:409});
 const after=await allocationSnapshot(db);assert.equal(after.queue.revision,1);assert.equal(after.records('production_event').length,0);
}));
test('legacy planning cannot steal pending person and cannot erase accepted transfer',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now),admin={login:'admin',isAdmin:true};
 let state=(await allocationSnapshot(db)).records('capacity')[0],input=structuredClone(state.rows[0].input);
 input.dailyRoster[0].hc.push('C1');
 await assert.rejects(()=>mutateCapacity(db,{action:'save',week:state.week,revision:state.revision,lines:['A'],inputs:{A:input}},admin,()=>Date.parse(now)),{status:409});
 await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);
 state=(await allocationSnapshot(db)).records('capacity')[0];input=structuredClone(state.rows[0].input);input.staffTransfers=[];
 await assert.rejects(()=>mutateCapacity(db,{action:'save',week:state.week,revision:state.revision,lines:['A'],inputs:{A:input}},admin,()=>Date.parse(now)),{status:409});
}));
test('legacy Capacity CAS detects an offer inserted after its reservation snapshot',()=>withDb(async(db,put)=>{
 const state=(await allocationSnapshot(db)).records('capacity')[0],admin={login:'admin',isAdmin:true};let injected=false;
 const racing={prepare(sql){const stmt=db.prepare(sql);if(!sql.startsWith('UPDATE app_records SET payload='))return stmt;return {bind(...args){const bound=stmt.bind(...args);return {async run(){if(!injected){injected=true;await mutateAllocationQueue(db,offer,actor('C'),now);}return bound.run();}};}};}};
 await assert.rejects(()=>mutateCapacity(racing,{action:'save',week:state.week,revision:state.revision,lines:['A'],inputs:{A:state.rows[0].input}},admin,()=>Date.parse(now)),{status:409});
 const after=(await allocationSnapshot(db)).records('capacity')[0];assert.equal(after.revision,state.revision);
}));
test('old approved foreign roster remains a conflict while its draft is being changed',()=>withDb(async(db,put)=>{
 const state=(await allocationSnapshot(db)).records('capacity')[0],input=structuredClone(state.rows[0].input);input.dailyRoster[0].hc.push('C1');
 state.rows[0].history.push({action:'review',decision:'approve',request:{kind:'capacity'},after:input});
 await put('capacity','2026-10-19',state);
 await assert.rejects(()=>mutateAllocationQueue(db,offer,actor('C'),now),{status:409});
}));

const cancelBody=(sent,received,revision=2,extra={})=>({action:'cancel',offerId:sent.offerId,allocationId:received.allocationId,reason:'Nhu cầu Line nhận thay đổi',expectedRevision:revision,requestId:'cancel-request-00000001',...extra});
const withdrawBody=(sent,revision,extra={})=>({action:'withdraw',offerId:sent.offerId,employeeId:'C1',effectiveAt:at('08'),endsAt:at('12'),reason:'Line nguồn cần lại nhân lực',expectedRevision:revision,requestId:'withdraw-request-00000001',...extra});
async function sentAndReceived(db){const sent=await mutateAllocationQueue(db,offer,actor('C'),now),received=await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);return {sent,received};}

test('cancel with IDs only atomically restores pending and Capacity, retaining original and cancellation history',()=>withDb(async(db,put)=>{
 const before=(await allocationSnapshot(db)).records('capacity')[0];
 await put('production_event','unrelated',{id:'unrelated',kind:'pause',sourceId:'UNRELATED',effectiveAt:at('07')});
 await put('production_payroll','unchanged',{hours:42,marker:'TEST immutable actual payroll'});
 const actualBefore=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_event','production_payroll') ORDER BY entity,record_key").all()).results;
 const {sent,received}=await sentAndReceived(db),accepted=await allocationSnapshot(db),original=structuredClone(accepted.queue.offers[0].allocations[0]),body=cancelBody(sent,received);
 const result=await mutateAllocationQueue(db,body,actor('AB'),now),after=await allocationSnapshot(db);
 assert.equal(result.action,'cancel');assert.equal(result.allocationId,received.allocationId);assert.equal(after.queue.revision,3);
 assert.deepEqual(after.queue.offers[0].allocations[0],{...original,canceled:true,canceledBy:'manager-AB',canceledAt:now,cancellationReason:body.reason});
 const capacity=after.records('capacity')[0];
 const normalizedRoster=row=>row.input.dailyRoster.map(day=>({...day,hcWindows:day.hcWindows||{},otWindows:day.otWindows||{}}));
 assert.deepEqual(normalizedRoster(capacity.rows.find(r=>r.line==='A')),normalizedRoster(before.rows.find(r=>r.line==='A')));
 assert.equal(capacity.rows.find(r=>r.line==='A').input.staffTransfers.length,0);
 assert.equal(capacity.rows.find(r=>r.line==='A').history.at(-1).action,'staffAllocationCancel');
 assert.equal(capacity.rows.find(r=>r.line==='A').history.at(-1).reason,body.reason);
 const view=await readAllocationQueue(db,actor('AB'),now);assert.equal(view.offers[0].allocations[0].canCancel,false);
 assert.deepEqual(view.offers[0].people[0].pending,[{effectiveAt:new Date(at('08')).toISOString(),endsAt:new Date(at('17')).toISOString()}]);
 const audit=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit' AND record_key=?").bind(`allocation-${body.requestId}`).first()).payload);
 assert.equal(audit.reason,body.reason);assert.equal(audit.actorId,'manager-AB');assert.equal(audit.at,now);assert.equal(audit.employeeName,'C One');assert.equal(audit.sourceLine,'C');assert.equal(audit.targetLine,'A');
 assert.deepEqual(audit.window,{effectiveAt:original.effectiveAt,endsAt:original.endsAt});
 assert.deepEqual((await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_event','production_payroll') ORDER BY entity,record_key").all()).results,actualBefore);
 const replay=await mutateAllocationQueue(db,body,actor('AB'),at('13'));assert.equal(replay.replayed,true);
 assert.equal((await allocationSnapshot(db)).serialized,after.serialized);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,3);
 for(const changes of [{reason:'Lý do khác'},{allocationId:'missing-allocation'}])await assert.rejects(()=>mutateAllocationQueue(db,{...body,...changes},actor('AB'),now),{status:409});
}));

test('storage rejects missing/invalid reason, sender, scoped/quick-line Admin, quick-line and revoked receiver without writes',()=>withDb(async(db,put)=>{
 for(const reason of [undefined,null,'',' \n ',500,'x'.repeat(501)])await assert.rejects(()=>mutateAllocationQueue(db,{...offer,reason},actor('C'),now),{status:422});
 const {sent,received}=await sentAndReceived(db),body=cancelBody(sent,received),before=await allocationSnapshot(db);
 for(const reason of [undefined,null,'',' \n ',500,'x'.repeat(501)]){
  await assert.rejects(()=>mutateAllocationQueue(db,{...body,reason},actor('AB'),now),{status:422});
  await assert.rejects(()=>mutateAllocationQueue(db,withdrawBody(sent,2,{effectiveAt:at('12'),endsAt:at('13'),reason}),actor('C'),now),{status:422});
 }
 for(const user of [actor('C'),{login:'admin',isAdmin:true,line:'A'},{login:'admin',isAdmin:true,authMode:'quick_line'},{...actor('AB'),authMode:'quick_line'}])await assert.rejects(()=>mutateAllocationQueue(db,body,user,now),{status:403});
 const view=await readAllocationQueue(db,{login:'admin',isAdmin:true},now);assert.equal(view.offers[0].allocations[0].canCancel,true);
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
 await put('users','manager-AB',{login:'manager-AB',active:false});
 const revoked=await allocationSnapshot(db);
 await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now),{status:403});assert.equal((await allocationSnapshot(db)).serialized,revoked.serialized);
}));

test('cancellation and racing withdrawal/allocation have exactly one CAS winner with no partial rollback',()=>withDb(async(db)=>{
 const {sent,received}=await sentAndReceived(db);
 const outcomes=await Promise.allSettled([
  mutateAllocationQueue(db,cancelBody(sent,received),actor('AB'),now),
  mutateAllocationQueue(db,withdrawBody(sent,2,{effectiveAt:at('12'),endsAt:at('13')}),actor('C'),now),
  mutateAllocationQueue(db,{...accept(sent.offerId,2),effectiveAt:at('13'),endsAt:at('14'),targetLine:'B',requestId:'accept-request-00000002'},actor('AB'),now),
 ]);
 assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
 assert.ok(outcomes.filter(result=>result.status==='rejected').every(result=>result.reason.status===409));
 const snapshot=await allocationSnapshot(db),winner=outcomes.find(result=>result.status==='fulfilled').value.action;
 assert.equal(snapshot.queue.revision,3);assert.equal(snapshot.queue.audit.length,3);assert.equal(snapshot.records('production_event').length,0);
 const allocation=snapshot.queue.offers[0].allocations.find(a=>a.id===received.allocationId),transfers=snapshot.records('capacity')[0].rows.flatMap(r=>r.input.staffTransfers||[]);
 assert.equal(allocation.canceled===true,winner==='cancel');
 assert.equal(transfers.some(t=>t.allocationId===received.allocationId),winner!=='cancel');
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_allocation_guard'").first()).n,0);
}));

test('capacity/scope/actual changes during cancellation fail CAS without queue, roster or audit partial writes',()=>withDb(async(db,put)=>{
 const {sent,received}=await sentAndReceived(db),body=cancelBody(sent,received);
 for(const entity of ['capacity','production_event','production_allocation_scope','employees']){
  const before=await allocationSnapshot(db);let injected=false;
  const racing={prepare:sql=>db.prepare(sql),async batch(statements){if(!injected){injected=true;await put(entity,'cancel-racing',{id:'cancel-racing',counter:entity});}return db.batch(statements);}};
  await assert.rejects(()=>mutateAllocationQueue(racing,body,actor('AB'),now),{status:409});
  const after=await allocationSnapshot(db);assert.deepEqual(after.queue,before.queue);
  assert.deepEqual(after.records('capacity').find(r=>r.key==='2026-10-19'),before.records('capacity').find(r=>r.key==='2026-10-19'));
  assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,2);
 }
}));

test('failed Capacity cancellation write rolls back queue, cursor and audit atomically',()=>withDb(async(db)=>{
 const {sent,received}=await sentAndReceived(db),before=await allocationSnapshot(db);
 await db.prepare("CREATE TRIGGER fail_queue_cancel BEFORE INSERT ON app_records WHEN NEW.entity='capacity' BEGIN SELECT RAISE(ABORT,'TEST cancellation failure'); END").run();
 await assert.rejects(()=>mutateAllocationQueue(db,cancelBody(sent,received),actor('AB'),now));
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,2);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_allocation_guard'").first()).n,0);
}));

test('legacy actual, future actual station conflicts and past windows cannot be canceled through planning API',()=>withDb(async(db,put)=>{
 const {sent,received}=await sentAndReceived(db),body=cancelBody(sent,received),snapshot=await allocationSnapshot(db);
 for(const patch of [{planning:false,movementId:'actual-entry'},{planning:undefined},{movementId:'actual-entry'}]){
  const queue=structuredClone(snapshot.queue);Object.assign(queue.offers[0].allocations[0],patch);await put('production_allocation_queue','global',queue);
  const before=await allocationSnapshot(db);await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now),{status:409});assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
 }
 await put('production_allocation_queue','global',snapshot.queue);
 await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),at('09')),{status:409});
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,effectiveAt:at('09'),endsAt:at('10')},actor('AB'),now),{status:422});
 await put('production_event','actual-station',{id:'actual-station',kind:'start',sourceId:'JOB',line:'A',employees:['C1'],count:1,effectiveAt:at('09')});
 const actual=await allocationSnapshot(db);
 await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now),{status:409});assert.equal((await allocationSnapshot(db)).serialized,actual.serialized);
}));

test('cancelled reservations remain pending until withdrawn, then legacy movement and new offer are allowed',()=>withDb(async(db)=>{
 const {sent,received}=await sentAndReceived(db);
 await mutateAllocationQueue(db,cancelBody(sent,received),actor('AB'),now);
 const movement={id:'new-movement',kind:'line-movement',employees:['C1'],line:'C',destinationLine:'B',effectiveAt:at('09'),endsAt:at('10')};
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[movement]),{status:409});
 await mutateAllocationQueue(db,withdrawBody(sent,3),actor('C'),now);
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[movement]));
 await assert.doesNotReject(()=>mutateAllocationQueue(db,{...offer,endsAt:at('12'),expectedRevision:4,requestId:'offer-request-00000002'},actor('C'),now));
}));

test('cancelled reservation can be received into a different line without old allocation blockers',()=>withDb(async(db)=>{
 const {sent,received}=await sentAndReceived(db);
 await mutateAllocationQueue(db,cancelBody(sent,received),actor('AB'),now);
 const receivedAgain=await mutateAllocationQueue(db,{...accept(sent.offerId,3),targetLine:'B',requestId:'accept-request-00000002'},actor('AB'),now);
 const snapshot=await allocationSnapshot(db),offer=snapshot.queue.offers[0];
 assert.equal(offer.allocations.length,2);assert.equal(offer.allocations[0].canceled,true);assert.equal(offer.allocations[1].id,receivedAgain.allocationId);
 assert.ok(snapshot.records('capacity')[0].rows.find(r=>r.line==='B').input.staffTransfers.some(t=>t.allocationId===receivedAgain.allocationId));
 assert.equal(snapshot.records('production_event').length,0);
}));

test('receiver C can cancel A-to-C while read-only Admin exposes no nested cancel capability',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,{...offer,sourceLine:'A',employees:['A1']},actor('AB'),now);
 const received=await mutateAllocationQueue(db,{...accept(sent.offerId),employeeId:'A1',targetLine:'C'},actor('C'),now);
 const receiver=await readAllocationQueue(db,actor('C'),now),admin=await readAllocationQueue(db,{login:'admin',isAdmin:true},now);
 assert.equal(receiver.offers[0].allocations[0].canCancel,true);assert.equal(admin.offers[0].allocations[0].canCancel,true);
 await assert.rejects(()=>mutateAllocationQueue(db,cancelBody(sent,received),actor('AB'),now),{status:403});
 await mutateAllocationQueue(db,cancelBody(sent,received),actor('C'),now);
 const snapshot=await allocationSnapshot(db);
 assert.ok(snapshot.records('capacity')[0].rows.find(r=>r.line==='A').input.dailyRoster[0].hc.includes('A1'));
 assert.equal(snapshot.queue.offers[0].allocations[0].canceledBy,'manager-C');assert.equal(snapshot.records('production_event').length,0);
}));

test('independent allocation initializes an absent named calendar without a preliminary calendar Save; preserves existing weeks and never creates actual work',()=>withDb(async(db)=>{
 await db.prepare("DELETE FROM app_records WHERE entity='capacity'").run();
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);
 const received=await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now);
 const snap=await allocationSnapshot(db),week=snap.records('capacity').find(r=>r.key==='2026-10-19');
 assert.ok(week.rows.find(r=>r.line==='A').input.dailyRoster[0].hc.includes('C1'));assert.equal(week.rows[0].input.factor,95);assert.equal(week.rows[0].status,'Nháp');assert.equal(week.rows.some(r=>r.line==='C'),false);assert.equal(snap.records('production_event').length,0);
 const before=snap.serialized;assert.equal((await mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now)).replayed,true);assert.equal((await allocationSnapshot(db)).serialized,before);assert.equal(received.planning,true);
}));
test('independent allocation never saves supplied calendar input and leaves unrelated schedule settings intact',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now),before=await allocationSnapshot(db);
 await mutateAllocationQueue(db,{...accept(sent.offerId),inputs:{A:{factor:1}},week:'1999-01-04'},actor('AB'),now);
 const after=await allocationSnapshot(db),a=after.records('capacity')[0],b=before.records('capacity')[0];
 assert.equal(a.rows[0].input.factor,b.rows[0].input.factor);assert.deepEqual(a.rows[1],b.rows[1]);assert.equal(after.records('capacity').length,1);
}));
test('independent first allocation rolls back both new calendar and queue if the calendar write fails',()=>withDb(async(db)=>{
 await db.prepare("DELETE FROM app_records WHERE entity='capacity'").run();const sent=await mutateAllocationQueue(db,offer,actor('C'),now),before=(await allocationSnapshot(db)).serialized;
 await db.prepare("CREATE TRIGGER fail_first_calendar BEFORE INSERT ON app_records WHEN NEW.entity='capacity' BEGIN SELECT RAISE(ABORT,'TEST failure'); END").run();
 await assert.rejects(()=>mutateAllocationQueue(db,accept(sent.offerId),actor('AB'),now));assert.equal((await allocationSnapshot(db)).serialized,before);
}));

test('both Admin accounts can offer, allocate, cancel and withdraw both directions with own audit and unchanged manager/grant configuration',()=>withDb(async(db,put)=>{
 const admins=[{login:'ADMIN-ONE',userId:'ADMIN-ONE',isAdmin:true},{login:'ADMIN-TWO',userId:'ADMIN-TWO',isAdmin:true}];
 for(const a of admins)await put('users',a.userId,{active:true,role:'SUPER_ADMIN',login:a.login});
 await put('employees','B1',{name:'B One',line:'B',active:true});
 const initialCapacity=(await allocationSnapshot(db)).records('capacity')[0];for(const day of initialCapacity.rows.find(row=>row.line==='B').input.dailyRoster)if(day.date<='2026-10-24')day.hc=['B1'];await put('capacity','2026-10-19',initialCapacity);
 const config=(await allocationSnapshot(db)).scope;
 for(const [index,a] of admins.entries()){
  const reverseLine=index?'B':'A',reverseEmployee=reverseLine+'1';
  const prefix=`admin-${index}-request-`,read=()=>readAllocationQueue(db,a,now);
  let v=await read();assert.equal(v.readOnly,false);assert.deepEqual(v.sourceLines,['A','B','C']);
  const sent=await mutateAllocationQueue(db,{...offer,expectedRevision:v.revision,requestId:prefix+'offer'},a,now);v=await read();assert.equal(v.offers.at(-1).sourceGroup,'C');assert.equal(v.offers.at(-1).targetGroup,'AB');
  const body={...accept(sent.offerId,v.revision),targetLine:index?'B':'A',requestId:prefix+'allocate'};
  const allocated=await mutateAllocationQueue(db,body,a,now);const saved=await allocationSnapshot(db);await mutateAllocationQueue(db,body,a,now);assert.equal((await allocationSnapshot(db)).serialized,saved.serialized,'retry writes nothing');
  await assert.rejects(()=>mutateAllocationQueue(db,body,admins[1-index],now),{status:409});
  v=await read();assert.equal(v.offers.at(-1).allocations[0].canCancel,true);
  await mutateAllocationQueue(db,{action:'cancel',offerId:sent.offerId,allocationId:allocated.allocationId,expectedRevision:v.revision,requestId:prefix+'cancel',reason:'Đổi kế hoạch'},a,now);
  v=await read();await mutateAllocationQueue(db,{action:'withdraw',offerId:sent.offerId,employeeId:'C1',effectiveAt:at('08'),endsAt:at('17'),expectedRevision:v.revision,requestId:prefix+'withdraw',reason:'Kết thúc hỗ trợ'},a,now);
  v=await read();const reverse=await mutateAllocationQueue(db,{...offer,sourceLine:reverseLine,employees:[reverseEmployee],expectedRevision:v.revision,requestId:prefix+'reverse-offer'},a,now);v=await read();
  assert.equal(v.offers.at(-1).sourceGroup,'AB');assert.equal(v.offers.at(-1).targetGroup,'C');
  await mutateAllocationQueue(db,{...accept(reverse.offerId,v.revision),employeeId:reverseEmployee,targetLine:'C',requestId:prefix+'reverse-allocate'},a,now);
  v=await read();const last=v.offers.at(-1).allocations[0];await mutateAllocationQueue(db,{action:'cancel',offerId:reverse.offerId,allocationId:last.id,expectedRevision:v.revision,requestId:prefix+'reverse-cancel',reason:'Đổi lịch'},a,now);
  v=await read();await mutateAllocationQueue(db,{action:'withdraw',offerId:reverse.offerId,employeeId:reverseEmployee,effectiveAt:at('08'),endsAt:at('17'),expectedRevision:v.revision,requestId:prefix+'reverse-withdraw',reason:'Kết thúc'},a,now);
 }
 const result=await allocationSnapshot(db);assert.deepEqual(result.scope,config);assert.equal(result.records('production_event').length,0);assert.equal(result.queue.audit.length,16);assert.deepEqual(new Set(result.queue.audit.map(e=>e.actorId)),new Set(admins.map(a=>a.userId)));
 for(const group of ['C','AB'])assert.equal((await readAllocationQueue(db,actor(group),now)).group,group);
 for(const a of [{...admins[0],active:false},{...admins[0],line:'A'},{...admins[0],authMode:'quick_line'},{login:'stranger',isAdmin:false}])await assert.rejects(()=>readAllocationQueue(db,a,now),{status:403});
}));

test('batch acceptance commits all employees and rosters once; exact retries do not duplicate',()=>withDb(async(db,put)=>{
 await put('employees','C2',{name:'C Two',line:'C',active:true});
 const sent=await mutateAllocationQueue(db,{...offer,employees:['C1','C2']},actor('C'),now);
 const body={action:'allocate-many',selections:['C1','C2'].map(employeeId=>({offerId:sent.offerId,employeeId})),targetLine:'A',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:1,requestId:'batch-accept-request-000001'};
 const result=await mutateAllocationQueue(db,body,actor('AB'),now);assert.equal(result.count,2);
 const snap=await allocationSnapshot(db);assert.equal(snap.queue.offers[0].allocations.length,2);
 const roster=snap.records('capacity')[0].rows.find(r=>r.line==='A').input.dailyRoster[0].hc;
 assert.ok(roster.includes('C1'));assert.ok(roster.includes('C2'));assert.equal(snap.records('production_event').length,0);
 assert.equal((await mutateAllocationQueue(db,body,actor('AB'),now)).replayed,true);
 assert.equal((await allocationSnapshot(db)).serialized,snap.serialized);
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,targetLine:'B'},actor('AB'),now),{status:409});
}));
test('batch acceptance rolls back first employee if a later employee is blocked',()=>withDb(async(db,put)=>{
 await put('employees','C2',{name:'C Two',line:'C',active:true});
 const sent=await mutateAllocationQueue(db,{...offer,employees:['C1','C2']},actor('C'),now);
 await put('production_event','absence-c2',{kind:'absence',line:'C',employees:['C2'],effectiveAt:at('09'),endsAt:at('10')});
 const before=await allocationSnapshot(db);
 await assert.rejects(()=>mutateAllocationQueue(db,{action:'allocate-many',selections:['C1','C2'].map(employeeId=>({offerId:sent.offerId,employeeId})),targetLine:'A',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:1,requestId:'batch-block-request-000001'},actor('AB'),now),/C Two:/);
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
}));
test('batch acceptance rejects duplicate employees, wrong targets and stale revision without writes',()=>withDb(async(db)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now),before=await allocationSnapshot(db);
 const selection={offerId:sent.offerId,employeeId:'C1'},base={action:'allocate-many',selections:[selection],targetLine:'A',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:1,requestId:'batch-invalid-request-000001'};
 for(const change of [{selections:[selection,selection]},{targetLine:'C'},{expectedRevision:0}])await assert.rejects(()=>mutateAllocationQueue(db,{...base,...change},actor('AB'),now));
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
}));

test('batch across separate offers shares one target window; a racing batch cannot split the group',()=>withDb(async(db,put)=>{
 await put('employees','C2',{name:'C Two',line:'C',active:true});
 const first=await mutateAllocationQueue(db,offer,actor('C'),now);
 const second=await mutateAllocationQueue(db,{...offer,employees:['C2'],expectedRevision:1,requestId:'second-offer-request-000001'},actor('C'),now);
 const body={action:'allocate-many',selections:[{offerId:first.offerId,employeeId:'C1'},{offerId:second.offerId,employeeId:'C2'}],targetLine:'A',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:2,requestId:'batch-race-request-000001'};
 const results=await Promise.allSettled([mutateAllocationQueue(db,body,actor('AB'),now),mutateAllocationQueue(db,{...body,targetLine:'B',requestId:'batch-race-request-000002'},actor('AB'),now)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const snap=await allocationSnapshot(db),allocations=snap.queue.offers.flatMap(o=>o.allocations);assert.equal(allocations.length,2);assert.equal(new Set(allocations.map(a=>a.targetLine)).size,1);
}));

test('batch withdrawal is atomic, scoped and replay safe',()=>withDb(async(db,put)=>{
 await put('employees','C2',{name:'C Two',line:'C',active:true});
 const sent=await mutateAllocationQueue(db,{...offer,employees:['C1','C2']},actor('C'),now);
 const body={action:'withdraw-many',selections:['C1','C2'].map(employeeId=>({offerId:sent.offerId,employeeId})),effectiveAt:at('08'),endsAt:at('12'),expectedRevision:1,requestId:'batch-withdraw-request-001',reason:'Đổi lịch'};
 const before=(await allocationSnapshot(db)).serialized;
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,selections:[body.selections[0],{offerId:sent.offerId,employeeId:'missing'}]},actor('C'),now));
 assert.equal((await allocationSnapshot(db)).serialized,before);
 await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now));
 assert.equal((await allocationSnapshot(db)).serialized,before);
 const result=await mutateAllocationQueue(db,body,actor('C'),now);assert.equal(result.count,2);
 const after=await allocationSnapshot(db);assert.equal(after.queue.offers[0].withdrawals.length,2);
 assert.equal((await mutateAllocationQueue(db,body,actor('C'),now)).replayed,true);
 assert.equal((await allocationSnapshot(db)).serialized,after.serialized);
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,reason:'Khác'},actor('C'),now));
}));

test('edit allocation atomically moves roster, keeps old/new history and replays safely',()=>withDb(async db=>{
 const {sent,received}=await sentAndReceived(db);
 const body={action:'edit',offerId:sent.offerId,allocationId:received.allocationId,targetLine:'B',effectiveAt:at('09'),endsAt:at('11'),reason:'Sửa Line và thời gian',expectedRevision:2,requestId:'edit-allocation-000001'};
 const result=await mutateAllocationQueue(db,body,actor('AB'),now),snapshot=await allocationSnapshot(db);
 const [old,current]=snapshot.queue.offers[0].allocations;
 assert.equal(old.canceled,true);assert.equal(old.replacedBy,current.id);assert.equal(current.replaces,old.id);assert.equal(current.targetLine,'B');assert.equal(current.actorId,'manager-AB');assert.equal(current.previousAllocation.targetLine,'A');
 const rows=snapshot.records('capacity')[0].rows;
 assert.equal(rows.find(r=>r.line==='A').input.dailyRoster[0].hc.includes('C1'),false);
 assert.equal(rows.find(r=>r.line==='B').input.dailyRoster[0].hc.includes('C1'),true);
 assert.equal(snapshot.queue.audit.at(-1).action,'edit');assert.equal(snapshot.queue.revision,3);
 assert.equal(snapshot.records('production_event').length,0);
 const replay=await mutateAllocationQueue(db,body,actor('AB'),now);assert.equal(replay.replayed,true);assert.equal(replay.allocationId,result.allocationId);
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,targetLine:'A'},actor('AB'),now),{status:409});
 await mutateAllocationQueue(db,{action:'cancel',offerId:sent.offerId,allocationId:result.allocationId,reason:'Hủy sau sửa',expectedRevision:3,requestId:'cancel-edited-00000001'},actor('AB'),now);
 assert.equal((await allocationSnapshot(db)).queue.offers[0].allocations[1].canceled,true);
}));

test('edit rejects wrong receiver, occupied time, locked calendar and stale revision without partial reversal',()=>withDb(async(db,put)=>{
 const {sent,received}=await sentAndReceived(db);
 const body={action:'edit',offerId:sent.offerId,allocationId:received.allocationId,targetLine:'B',effectiveAt:at('09'),endsAt:at('11'),reason:'Sửa phân bổ',expectedRevision:2,requestId:'edit-reject-00000001'};
 const before=await allocationSnapshot(db);
 await assert.rejects(()=>mutateAllocationQueue(db,body,actor('C'),now),{status:403});
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,expectedRevision:1},actor('AB'),now),{status:409});
 await assert.rejects(()=>mutateAllocationQueue(db,{...body,endsAt:at('18')},actor('AB'),now));
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
 await put('production_event','absence-edit',{id:'absence-edit',kind:'line-absence',line:'A',employees:['C1'],effectiveAt:at('10'),endsAt:at('11'),approved:true});
 let snapshot=await allocationSnapshot(db);await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now));assert.equal((await allocationSnapshot(db)).serialized,snapshot.serialized);
 await db.prepare("DELETE FROM app_records WHERE entity='production_event'").run();
 const capacity=before.records('capacity')[0];capacity.rows.find(r=>r.line==='B').status='Đã xác nhận';await put('capacity','2026-10-19',capacity);
 snapshot=await allocationSnapshot(db);await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now),/khóa/);assert.equal((await allocationSnapshot(db)).serialized,snapshot.serialized);
}));

 test('accepted planning loan supports bounded onward transfer and receiving station without stealing time',()=>withDb(async(db,put)=>{
 const sent=await mutateAllocationQueue(db,offer,actor('C'),now);
 await mutateAllocationQueue(db,{...accept(sent.offerId),targetLine:'B',endsAt:at('17')},actor('AB'),now);
 const move={id:'onward',kind:'line-movement',line:'B',destinationLine:'A',employees:['C1'],effectiveAt:at('13'),endsAt:at('17')};
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[move]));
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{...move,line:'C'}]),{status:409});
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{...move,endsAt:at('18')}]),{status:409});
 await put('production_event',move.id,move);
 const start={id:'received-start',kind:'start',line:'A',sourceId:'JOB-A',employees:['C1'],count:1,effectiveAt:at('14')};
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[start]));
 await put('production_event',start.id,start);
 await assert.doesNotReject(()=>assertLegacyAllocationWrite(db,[{id:'pause-A',kind:'pause',line:'A',sourceId:'JOB-A',effectiveAt:at('15')}]));
 await assert.rejects(()=>assertLegacyAllocationWrite(db,[{...start,id:'wrong-line',line:'B',sourceId:'JOB-B'}]),{status:409});
 const snapshot=await allocationSnapshot(db);assert.equal(snapshot.queue.revision,2);
 }));

async function actualSaturday(db,put){
 const snap=await allocationSnapshot(db),record=snap.records('capacity')[0];
 for(const row of record.rows){row.status='Đã xác nhận';row.reviewStatus='approved';row.input.dailySchedule.find(d=>d.date==='2026-10-24').working=false;}
 await put('capacity','2026-10-19',record);
 const reference=record.rows.find(r=>r.line==='A').input.dailySchedule,days=structuredClone(reference);
 Object.assign(days.find(d=>d.date==='2026-10-24'),{working:true,hcStart:'08:00',hcEnd:'17:00'});
 await put('production_schedule','2026-10-19:A',{days,reference:{days:reference},version:2});
 return record;
}
const saturday={effectiveAt:'2026-10-24T08:00:00+07:00',endsAt:'2026-10-24T17:00:00+07:00'};
test('saved actual Saturday accepts two queued people atomically without unlocking or changing planned calendar',()=>withDb(async(db,put)=>{
 await actualSaturday(db,put);await put('employees','C2',{id:'C2',name:'C Two',line:'C',active:true});
 const original=(await allocationSnapshot(db)).rows.find(r=>r.entity==='capacity').raw;
 const sent=await mutateAllocationQueue(db,{...offer,...saturday,employees:['C1','C2']},actor('C'),now);
 const body={action:'allocate-many',selections:['C1','C2'].map(employeeId=>({offerId:sent.offerId,employeeId})),targetLine:'A',...saturday,expectedRevision:1,requestId:'actual-saturday-two-00001'};
 const result=await mutateAllocationQueue(db,body,actor('AB'),now);assert.equal(result.count,2);assert.equal(result.planning,false);
 const snapshot=await allocationSnapshot(db);assert.equal(snapshot.rows.find(r=>r.entity==='capacity').raw,original);
 assert.equal(snapshot.records('production_event').length,2);assert.ok(snapshot.records('production_event').every(e=>e.kind==='line-movement'&&e.destinationLine==='A'&&e.queueActual));
 assert.ok(snapshot.queue.offers[0].allocations.every(a=>!a.planning&&a.movementId));
 const {activeStaffMovement,isPresent}=await import('../lib/production-attendance.mjs');
 for(const id of ['C1','C2']){assert.equal(activeStaffMovement(snapshot.records('production_event'),id,Date.parse(saturday.effectiveAt)).destinationLine,'A');assert.equal(activeStaffMovement(snapshot.records('production_event'),id,Date.parse(saturday.endsAt)),undefined);assert.equal(isPresent({roster:[]},snapshot.records('production_event'),id,'A','2026-10-24',9*60),true);}
 assert.equal((await mutateAllocationQueue(db,body,actor('AB'),now)).replayed,true);assert.equal((await allocationSnapshot(db)).records('production_event').length,2);
}));
test('actual allocation rejects outside saved hours and leaves queue unchanged',()=>withDb(async(db,put)=>{
 await actualSaturday(db,put);const sent=await mutateAllocationQueue(db,{...offer,...saturday,endsAt:'2026-10-24T18:00:00+07:00'},actor('C'),now),before=await allocationSnapshot(db);
 await assert.rejects(()=>mutateAllocationQueue(db,{...accept(sent.offerId),...saturday,endsAt:'2026-10-24T18:00:00+07:00'},actor('AB'),now),/Line A, ngày 2026-10-24.*ngoài giờ/);
 assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
}));
test('actual allocation rechecks calendar race and rolls back failed movement write',()=>withDb(async(db,put)=>{
 await actualSaturday(db,put);const sent=await mutateAllocationQueue(db,{...offer,...saturday},actor('C'),now),body={...accept(sent.offerId),...saturday};
 const racing={prepare:sql=>db.prepare(sql),async batch(statements){await put('production_schedule','race',{version:1});return db.batch(statements);}};
 await assert.rejects(()=>mutateAllocationQueue(racing,body,actor('AB'),now),/vừa thay đổi/);assert.equal((await allocationSnapshot(db)).records('production_event').length,0);
 await db.prepare("CREATE TRIGGER fail_actual BEFORE INSERT ON app_records WHEN NEW.entity='production_event' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END").run();
 const before=await allocationSnapshot(db);await assert.rejects(()=>mutateAllocationQueue(db,body,actor('AB'),now));assert.equal((await allocationSnapshot(db)).serialized,before.serialized);
}));
