import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {records} from '../scripts/local/database.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
const at=time=>`2026-11-02T${time}:00+07:00`;
test('active daily policy restores old journal projections without refreshing pending reports or writing records',()=>dailyFixture(async c=>{
 const week='2026-11-02',input=newDailyCapacity(week,'A',100).input;
 input.dailySchedule=input.dailySchedule.map(d=>({...d,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00'}));
 input.dailyRoster=input.dailySchedule.map(d=>({date:d.date,hc:['SYNTHETIC-P'],ot:[]}));
 await c.put('capacity',week,{week,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input}]});
 await c.put('employees','SYNTHETIC-P',{id:'SYNTHETIC-P',line:'A',active:true,startDate:'2020-01-01'});
 const events=[];
 for(const stage of ['CUT','ASSY']){
  let prior={status:'waiting',people:[]};
  for(const [action,time,status] of [['start','08:00','running'],['pause','09:00','paused'],['resume','09:30','running'],['add','10:00','running'],['complete','11:00','partial'],['resume','13:00','running'],['complete','14:00','done']]){
   const id=`SYNTHETIC-${stage}-${action}-${time}`,next={status,startedAt:at('08:00'),people:status==='running'?['SYNTHETIC-P']:prior.people};
   const e={id,kind:'stage-work',stageReporting:true,stageAction:action,sourceId:c.order.id,line:'A',stageName:stage,stageBefore:prior,stageAfter:next,effectiveAt:at(time),recordedAt:at(time)};events.push(e);await c.put('production_event',id,e);prior=next;
  }
 }
 const unfinished={...events[0],id:'SYNTHETIC-UNFINISHED',sourceId:'OTHER-LSX'};await c.put('production_event',unfinished.id,unfinished);
 const cancelled={...events[0],id:'SYNTHETIC-VOIDED',voided:true};await c.put('production_event',cancelled.id,cancelled);
 const pending={id:'SYNTHETIC-PENDING',kind:'completion',stageReporting:true,transitId:c.order.id,line:'A',stageName:'CUT',startedAt:at('08:00'),completedAt:at('11:00'),reportedQuantity:100,reviewStatus:'Chờ kiểm tra',hours:{hc:71,ot:2,total:73}};
 await c.put('production_report',pending.id,pending);
 const call=await reviewer(c),before=await records(c.db),actor={login:'SYNTHETIC-REVIEWER',isAdmin:true};
 const old=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:true});
 const protectedRead=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false});
 const restored=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false,includeJournalHours:true});
 const hours=x=>x.events.map(e=>[e.id,e.cumulativeLaborHours]);
 assert.deepEqual(hours(restored),hours(old));assert.deepEqual(restored.reports,protectedRead.reports);
 assert.equal(restored.reports.find(r=>r.id===pending.id).hours.total,73);
 assert.notEqual(old.reports.find(r=>r.id===pending.id).hours.total,73,'fixture proves broad derived flag would refresh pending report');
 const cut=restored.events.filter(e=>e.stageName==='CUT'&&!e.voided&&e.sourceId===c.order.id);
 assert.equal(cut.find(e=>e.stageAction==='start').cumulativeLaborHours,null);
 for(const action of ['pause','resume','add','complete'])assert.ok(cut.filter(e=>e.stageAction===action).every(e=>typeof e.cumulativeLaborHours==='number'));
 assert.ok(cut.find(e=>e.stageAction==='pause').cumulativeLaborHours>0);
 assert.equal(cut.find(e=>e.stageAction==='pause').cumulativeLaborHours,cut.find(e=>e.stageAction==='resume').cumulativeLaborHours);
 const completions=cut.filter(e=>e.stageAction==='complete');assert.ok(completions[1].cumulativeLaborHours>completions[0].cumulativeLaborHours);
 assert.equal(restored.events.find(e=>e.id===unfinished.id).cumulativeLaborHours,null);
 const api=await call('/api/production-workflow');assert.equal(api.status,200);assert.deepEqual(hours(api.body),hours(restored));assert.equal(api.body.reports.find(r=>r.id===pending.id).hours.total,73);
 const compact=await call('/api/production-workflow?view=work');assert.ok(compact.body.events.every(e=>e.cumulativeLaborHours===undefined));
 assert.deepEqual(await records(c.db),before);
}));
