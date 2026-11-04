import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {reviewDailyOutput} from '../scripts/local/production-daily-review.mjs';import {records} from '../scripts/local/database.mjs';import {manager,hr,day,at} from './helpers/workflow-get-fixture.mjs';
const reviewer={login:'SYNTHETIC-ADMIN',isAdmin:true};
for(const timing of ['before review','before commit'])test(`daily review revalidates activation ${timing} and does not create warehouse or business audit`,()=>dailyFixture(async c=>{
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),input={action:'review',reportId:saved.report.id,approve:true,expectedVersion:1};let injected=false;
 const change=()=>c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.approved',0) WHERE entity='production_reporting_policy'").run();
 if(timing==='before review')await change();const before=await records(c.db),db=timing==='before commit'?new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;await change();}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}}):c.db;
 await assert.rejects(()=>reviewDailyOutput(db,input,reviewer),{status:409});assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 const business=rows=>rows.filter(r=>r.entity!=='production_reporting_policy');assert.deepEqual(business(await records(c.db)),business(before));
}));
test('missing preservation after declared cutover never falls back to legacy writes or recalculation',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_legacy_manifest'").run();const before=await records(c.db);
 await assert.rejects(()=>mutateProductionWorkflow(c.db,{action:'start',orderId:c.order.id,effectiveAt:at(day,'08:00'),employees:['SYNTHETIC'],count:1,requestIdempotency:crypto.randomUUID()},reviewer),e=>e.status===409&&/bảo toàn/.test(e.message));
 await assert.rejects(()=>mutateProductionWorkflow(c.db,{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['SYNTHETIC'],effectiveAt:at(day,'08:00'),endsAt:at(day,'09:00'),requestIdempotency:crypto.randomUUID()},hr),e=>e.status===409&&/bảo toàn/.test(e.message));
 assert.deepEqual(await records(c.db),before);
}));
