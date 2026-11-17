import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {activateDailyPolicy} from './helpers/activate-daily-policy.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {records} from '../scripts/local/database.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {workspaceDisplayWorkflow} from '../scripts/local/production-progress-read.mjs';

test('workspace retains V1/V2/missing bases and every calculated field; audit detail remains available and GET never writes',()=>dailyFixture(async c=>{
 const bulky='Synthetic audit '.repeat(30000);
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic product',processes:['PACK'],history:[bulky]});
 for(const [id,unit,date] of [['V1',.1,'2026-10-31'],['V2',.2,'2026-11-02'],['MISSING',null,'2026-10-31']]){
  await c.put('production_report',id,{id,kind:'completion',transitId:c.order.id,line:'A',sku:c.order.sku,stageName:'PACK',stageReporting:true,reportedQuantity:10,approvedQuantity:10,reviewStatus:'Đã xác nhận',completedAt:date+'T09:00:00+07:00',productionDate:date,hours:{hc:1,ot:0,total:1},standardUnit:unit,sourceSnapshot:{audit:bulky},laborNotes:[{text:'Keep historical evidence'}],history:[{action:'Synthetic approval'}]});
 }
 await activateDailyPolicy(c.db);
 const call=await reviewer(c),before=await records(c.db);
 const full=await call('/api/production-workflow'),workspace=await call('/api/production-workflow?view=workspace');
 assert.equal(full.status,200);assert.equal(workspace.status,200);
 assert.deepEqual(workspace.body,workspaceDisplayWorkflow(full.body));
 assert.equal(full.body.reports.find(r=>r.id==='V1').standardUnit,.1);
 assert.equal(workspace.body.reports.find(r=>r.id==='V1').legacyEarnedBasis.status,'resolved');
 assert.equal(workspace.body.reports.find(r=>r.id==='V2').standardUnit,.2);
 assert.notEqual(workspace.body.reports.find(r=>r.id==='MISSING').legacyEarnedBasis.status,'resolved');
 assert.ok(full.body.reports[0].sourceSnapshot.audit.length>100000);
 assert.ok(workspace.body.reports.every(r=>!r.sourceSnapshot));
 assert.ok(JSON.stringify(workspace.body).length<JSON.stringify(full.body).length/5);
 const actor={login:'SYNTHETIC-REVIEWER',isAdmin:true};
 const raw=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false,includeJournalHours:true});
 const compact=await readProductionWorkflow(c.db,actor,[],{compactAudit:true,includeDerivedHours:false,includeJournalHours:true});
 assert.deepEqual(compact,workspaceDisplayWorkflow(raw));
 await assert.rejects(readProductionWorkflow(c.db,{login:'DENIED',grants:[]},[],{compactAudit:true}),e=>e.status===403);
 assert.deepEqual(await records(c.db),before);
 console.log(`Workspace synthetic response bytes: ${JSON.stringify(full.body).length} -> ${JSON.stringify(workspace.body).length}`);
}));

test('workspace defers only calculated time-journal totals; explicit journal and full detail preserve them',()=>dailyFixture(async c=>{
 const from='2026-11-02T08:00:00+07:00',to='2026-11-02T10:00:00+07:00';
 await c.put('production_event','START',{id:'START',kind:'start',sourceId:c.order.id,line:'A',count:1,employees:['P1'],effectiveAt:from,recordedAt:from});
 await c.put('production_event','PAUSE',{id:'PAUSE',kind:'pause',sourceId:c.order.id,line:'A',effectiveAt:to,recordedAt:to});
 const call=await reviewer(c),before=await records(c.db);
 const full=await call('/api/production-workflow'),compact=await call('/api/production-workflow?view=workspace'),journal=await call('/api/production-workflow?view=journal');
 assert.equal(compact.status,200);assert.equal(journal.status,200);
 assert.deepEqual(journal.body,workspaceDisplayWorkflow(full.body));
 assert.ok(Object.hasOwn(journal.body.events.find(e=>e.id==='PAUSE'),'cumulativeLaborHours'));
 assert.equal(Object.hasOwn(compact.body.events.find(e=>e.id==='PAUSE'),'cumulativeLaborHours'),false);
 const withoutTotals=value=>({...value,events:value.events.map(({cumulativeLaborHours,...event})=>event)});
 assert.deepEqual(withoutTotals(compact.body),withoutTotals(journal.body));
 assert.deepEqual(await records(c.db),before);
}));
