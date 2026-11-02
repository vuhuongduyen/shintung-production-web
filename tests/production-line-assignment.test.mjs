import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assignmentOverview} from '../lib/production-assignment-overview.mjs';
import {unassignedAlerts} from '../lib/production-unassigned-alert.mjs';
import {stageEmployeeChoices} from '../lib/production-stage-staff.mjs';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {mutateProductionWorkflow as mutate,readProductionWorkflow as read,recalculateProductionReport as recalc} from '../scripts/local/production-workflow.mjs';
const date='2026-10-28',at=t=>`${date}T${t}:00+07:00`,ms=t=>Date.parse(at(t));
const employees=[{id:'FAKE1',name:'Nhân viên thử 1',line:'A',active:true}];
const orders=['A','B'].map(line=>({id:line,lsxCode:`TEST-${line}`,sku:line,planId:line,line,lsxQty:100,lsxOpenedAt:date,week:'2026-10-26',syncStatus:'ĐÃ ĐỒNG BỘ',processes:['ASSY','FINAL']}));
const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',ot:false,lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}]};
const schedules=['A','B'].map(line=>({key:`2026-10-26:${line}`,line,days:[day],roster:[{date,hc:line==='A'?['FAKE1']:[],ot:[]}]}));
const move={id:'loan',kind:'line-movement',line:'A',destinationLine:'B',employees:['FAKE1'],effectiveAt:at('09:00'),endsAt:at('11:00'),approved:true};
const start={id:'start',kind:'stage-work',sourceId:'A',line:'A',stageName:'ASSY',stageReporting:true,stageAction:'start',effectiveAt:at('08:00'),stageAfter:{people:['FAKE1'],status:'running',at:at('08:00'),startedAt:at('08:00'),admittedQuantity:100,completed:0}};
const overview=(time,events=[start,move],line='all')=>assignmentOverview({orders,employees,events,line,now:ms(time)});
test('source transfer row and receiving waiting row are scoped and counted as one person; return waits',()=>{
 const rows=overview('09:20');assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.id)).size,1);assert.ok(rows.every(r=>!r.conflict));
 assert.equal(rows.find(r=>r.line==='A').status,'Đang chuyển Line');assert.equal(rows.find(r=>r.line==='A').destinationLine,'B');assert.equal(rows.find(r=>r.line==='B').status,'Đang chờ phân bổ');
 for(const line of ['A','B'])assert.ok(overview('09:20',undefined,line).every(r=>r.line===line));
 assert.equal(overview('08:59')[0].status,'Đang làm');assert.equal(overview('11:00').length,1);assert.equal(overview('11:00')[0].status,'Đang chờ phân bổ');
});
test('receiving assignment expires, completed source never resumes, later loan does not reactivate receiver',()=>{
 const receiver={...start,id:'receive',sourceId:'B',line:'B',effectiveAt:at('09:05'),stageAfter:{...start.stageAfter,startedAt:at('09:05'),at:at('09:05'),lineAssignments:{FAKE1:{movementId:'loan'}}}};
 const events=[start,move,receiver];assert.equal(unassignedAlerts({orders,employees,schedules,events,now:ms('09:20')}).length,0);assert.equal(overview('09:20',events).find(r=>r.line==='B').status,'Đang làm');assert.equal(overview('11:00',events)[0].status,'Đang chờ phân bổ');
 assert.equal(overview('14:10',[...events,{...move,id:'loan2',effectiveAt:at('14:00'),endsAt:at('16:00')}]).find(r=>r.line==='B').status,'Đang chờ phân bổ');
 assert.equal(overview('11:00',[...events,{...start,id:'finished',effectiveAt:at('10:30'),stageAfter:{...start.stageAfter,people:[],status:'done',completed:100,at:at('10:30')}}])[0].status,'Đang chờ phân bổ');
});
test('edit/cancel use effective version and roster selection respects half-open interval',()=>{
 const edited={...move,id:'edit',supersedes:'loan',effectiveAt:at('09:30'),endsAt:at('11:30')};assert.equal(overview('09:15',[start,move,edited])[0].status,'Đang làm');assert.equal(overview('09:40',[start,move,edited])[0].status,'Đang chuyển Line');assert.equal(overview('09:40',[start,move,{id:'cancel',kind:'attendance-cancel',supersedes:'loan',approved:true}])[0].status,'Đang làm');
 for(const [time,line,count] of [['08:59','A',1],['09:00','A',0],['09:00','B',1],['11:00','A',1]])assert.equal(stageEmployeeChoices({employees,events:[start,move],schedules,line,effectiveAt:at(time)}).length,count);
});
test('waiting starts at arrival and return, survives reopening and excludes breaks',()=>{
 const check=(time,events=[start,move])=>unassignedAlerts({orders,employees,schedules,events,now:ms(time)});
 assert.equal(check('09:10').length,0);const received=check('09:11')[0];assert.equal(received.line,'B');assert.equal(received.since,ms('09:00'));assert.deepEqual(check('09:11'),check('09:11'));
 assert.equal(check('11:10').length,0);const returned=check('11:11')[0];assert.equal(returned.line,'A');assert.equal(returned.since,ms('11:00'));assert.notEqual(received.key,returned.key);
 const aroundBreak={...move,effectiveAt:at('09:55')};assert.equal(check('10:15',[start,aroundBreak]).length,0);assert.equal(check('10:16',[start,aroundBreak])[0].minutes,11);
});
test('isolated DB: accept receiving entry, forbid source, preserve source history, require explicit reallocation after return',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-line-assignment-')));try{await migrate(c.db);const put=(e,k,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'FAKE',at('08:00')).run();
 const days=Array.from({length:7},(_,i)=>({...day,date:new Date(Date.parse('2026-10-26T00:00:00Z')+i*86400000).toISOString().slice(0,10)}));
 await put('capacity','2026-10-26',{rows:['A','B'].map(line=>({line,status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:1,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:line==='A'?['FAKE1']:[],ot:[]}))}}))});
 for(const o of orders)await put('in_transit',o.id,o);await put('employees','FAKE1',employees[0]);await put('production_event','start',start);await put('production_event','loan',move);
 const admin={login:'FAKE-ADMIN',isAdmin:true},catalog=orders.map(o=>({code:o.sku,processes:o.processes}));
 const send=(line,time,action='start',stage='ASSY')=>mutate(c.db,{action,orderId:line,effectiveAt:at(time),stageEntries:[{stage,people:['FAKE1']}],requestIdempotency:crypto.randomUUID()},{...admin,line},catalog);
 await assert.rejects(()=>send('A','09:05','start','FINAL'),/đang chuyển Line B/);await send('B','09:05');let w=await read(c.db,admin,catalog);assert.equal(w.events.filter(e=>e.sourceId==='A').length,1);
 assert.equal(assignmentOverview({...w,now:ms('09:20')}).find(r=>r.line==='B').status,'Đang làm');assert.equal(assignmentOverview({...w,now:ms('11:00')})[0].status,'Đang chờ phân bổ');
 await send('A','11:10','add');w=await read(c.db,admin,catalog);assert.equal(assignmentOverview({...w,now:ms('11:11')})[0].status,'Đang làm');
 const hours=await Promise.all(['A','B'].map(line=>recalc(c.db,w.events,{stageReporting:true,transitId:line,line,stageName:'ASSY',startedAt:at('08:00'),completedAt:at('12:00')})));
 assert.ok(Math.abs(hours[0].hours.total-(1+50/60))<0.0002);assert.ok(Math.abs(hours[1].hours.total-1.75)<0.0002);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);assert.deepEqual(w.events.find(e=>e.id==='start').stageAfter,start.stageAfter);
 }finally{await c.close();}
});
