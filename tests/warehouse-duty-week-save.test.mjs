import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowGetFixture,manager,hr,week,day} from './helpers/workflow-get-fixture.mjs';
import {activateDailyPolicy} from './helpers/activate-daily-policy.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {dutyDates,dutyRows} from '../lib/warehouse-duty.mjs';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
import {records} from '../scripts/local/database.mjs';
import {mergeProductionSavedResult} from '../lib/production-saved-result.mjs';
const body=(slots=1)=>({action:'warehouse-duty',week,line:'A',expectedId:null,requestIdempotency:crypto.randomUUID(),rows:dutyDates(week).flatMap(date=>Array.from({length:slots},(_,i)=>({date,rowId:`${date}-${i}`,employee:'SYNTHETIC-NV1',start:`08:${String(i*2).padStart(2,'0')}`,end:`08:${String(i*2+1).padStart(2,'0')}`})))});
async function fixture(run){const c=await workflowGetFixture(20);try{await activateDailyPolicy(c.db,{effectiveFrom:day});await run(c);}finally{await c.close();}}
const history=rows=>rows.filter(r=>['production_report','in_transit','capacity','production_history_import'].includes(r.entity));
test('whole week and 120 rows use one atomic batch, no order reads; ACK matches stored rows and replay never duplicates',()=>fixture(async c=>{
 const before=history(await records(c.db));let batches=0;
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{assert.doesNotMatch(sql,/entity='in_transit'/,'warehouse save needs no order payloads');return target.prepare(sql);};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const input=body(20),saved=await mutateProductionWorkflow(db,input,manager);assert.equal(saved.events.length,121);assert.equal(batches,1);
 const all=await records(c.db),events=all.filter(r=>r.entity==='production_event').map(r=>({...JSON.parse(r.payload),id:r.record_key}));
 const ack=mergeProductionSavedResult({events:[],orders:[],reports:[]},saved);
 assert.deepEqual(dutyRows(ack.events,week,'A',effectiveAttendance(ack.events,true)),dutyRows(events,week,'A',effectiveAttendance(events,true)));
 assert.equal((await mutateProductionWorkflow(db,input,manager)).replayed,true);assert.equal(batches,1);assert.deepEqual(history(await records(c.db)),before);
}));
test('invalid last row, wrong role/Line and concurrent weekly saves never partially commit',()=>fixture(async c=>{
 const invalid=body();invalid.rows.at(-1).end='07:00';await assert.rejects(()=>mutateProductionWorkflow(c.db,invalid,manager),/24h/);
 await assert.rejects(()=>mutateProductionWorkflow(c.db,body(),hr),{status:403});
 await assert.rejects(()=>mutateProductionWorkflow(c.db,body(),{...manager,line:'B'}),{status:403});
 const prior=await records(c.db);assert.equal(prior.filter(r=>r.entity==='production_event'&&JSON.parse(r.payload).kind==='warehouse-duty').length,0);
 const results=await Promise.allSettled([mutateProductionWorkflow(c.db,body(),manager),mutateProductionWorkflow(c.db,body(),manager)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
 const all=await records(c.db);assert.equal(all.filter(r=>r.entity==='production_event'&&JSON.parse(r.payload).kind==='warehouse-duty').length,1);assert.equal(all.filter(r=>r.entity==='production_event'&&JSON.parse(r.payload).absenceType==='Phụ kho').length,6);
}));
