import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {activateQuantityCutover} from '../scripts/local/production-quantity-cutover.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctDailyOutput} from '../scripts/local/production-daily-correction.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {records} from '../scripts/local/database.mjs';
const admin={login:'SYNTHETIC-ADMIN',isAdmin:true};
const raw=async c=>JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first()).payload);
async function setup(c,extra=false){
 const order={...c.order,completedQty:400};await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify(order),order.id).run();
 const legacy={id:'SYNTHETIC-LEGACY',kind:'completion',transitId:order.id,lsxCode:order.lsxCode,sku:order.sku,line:'A',reportedQuantity:200,approvedQuantity:0,reviewStatus:'Chờ kiểm tra',version:1,startedAt:'2026-11-02T01:00:00Z',completedAt:'2026-11-02T03:00:00Z',hours:{hc:2,ot:0,total:2}};await c.put('production_report',legacy.id,legacy);
 await c.db.prepare("DELETE FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation')").run();await activateQuantityCutover(c.db,{snapshotId:'SYNTHETIC-PENDING-STATE'},admin,{sourceId:'a'.repeat(64)});
 const save=async quantity=>mutateProductionWorkflow(c.db,c.body({quantity,expectedOrderRevision:await recordRevision(JSON.stringify(await raw(c)))}),actor);
 const daily=(await save(300)).report,other=extra?(await save(100)).report:null,call=await reviewer(c);
 const review=async(r,approve=true)=>{const result=await call('/api/production-report',{action:'review',reportId:r.id,expectedVersion:1,approve,...(!approve?{reason:'Synthetic rejection'}:{})});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.pendingReportQty,(await raw(c)).pendingReportQty);return result.body.payload;};
 const state=async(completed,pending)=>{const stored=await raw(c);assert.equal(stored.completedQty,completed);assert.equal(stored.pendingReportQty,pending);const get=(await call('/api/production-workflow?view=work')).body.orders.find(o=>o.id===order.id);assert.equal(get.completedQty,completed);assert.equal(get.pendingReportQty,pending);};
 return {legacy,daily,other,call,review,state,save};
}
for(const dailyFirst of [false,true])test(`raw pending reaches zero after mixed legacy/daily review (${dailyFirst?'daily first':'legacy first'})`,()=>dailyFixture(async c=>{
 const f=await setup(c);assert.equal((await raw(c)).completedQty,400);
 const first=await f.review(dailyFirst?f.daily:f.legacy);assert.equal(first.completedQty,dailyFirst?700:600);await f.state(dailyFirst?700:600,dailyFirst?200:300);
 const last=await f.review(dailyFirst?f.legacy:f.daily);assert.equal(last.completedQty,900);await f.state(900,0);
 const warehouses=(await records(c.db)).filter(r=>r.entity==='warehouse_in').map(r=>JSON.parse(r.payload));assert.deepEqual(warehouses.map(r=>r.proposedQuantity).sort((a,b)=>a-b),[200,300]);
 const before=(await records(c.db)).filter(r=>r.entity!=='website_action_audit');assert.equal((await f.call('/api/production-report',{action:'review',reportId:f.daily.id,expectedVersion:1,approve:true})).status,409);assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='website_action_audit'),before);await f.state(900,0);
}));
test('real remaining pending survives each review; rejection clears only its own quantity',()=>dailyFixture(async c=>{
 const f=await setup(c,true);await f.review(f.legacy);await f.state(600,400);await f.review(f.daily);await f.state(900,100);await f.review(f.other,false);await f.state(900,0);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,2);
}));
test('competing review and order CAS cannot leave stale or partial pending',()=>dailyFixture(async c=>{
 const f=await setup(c);await f.review(f.legacy);await f.state(600,300);let armed=true;
 const wrapped=new Proxy(c.db,{get(db,key){if(key==='batch')return async statements=>{if(armed){armed=false;await db.prepare("UPDATE app_records SET payload=json_set(payload,'$.planningNote','SYNTHETIC-RACE') WHERE entity='in_transit' AND record_key=?").bind(c.order.id).run();}return db.batch(statements);};const v=db[key];return typeof v==='function'?v.bind(db):v;}});
 const {siteApi}=await import('../worker/site-api.mjs');
 const handler=async body=>{const response=await siteApi(new Request('https://test.invalid/api/production-report',{method:'POST',headers:{cookie:'__Host-onspa_session='+'e'.repeat(64),origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify(body)}),{DB:wrapped,FILES:c.bucket});return {status:response.status,body:await response.json()};};
 const body={action:'review',reportId:f.daily.id,expectedVersion:1,approve:true},before=(await records(c.db)).filter(r=>!['in_transit','website_action_audit'].includes(r.entity));assert.equal((await handler(body)).status,409);assert.deepEqual((await records(c.db)).filter(r=>!['in_transit','website_action_audit'].includes(r.entity)),before);await f.state(600,300);assert.equal((await raw(c)).planningNote,'SYNTHETIC-RACE');
 const results=await Promise.all([f.call('/api/production-report',body),f.call('/api/production-report',body)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await f.state(900,0);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,2);
}));
test('edit/cancel of an unapproved receipt refreshes raw pending in the same write',()=>dailyFixture(async c=>{
 const f=await setup(c);await f.review(f.legacy);await f.state(600,300);
 const change=async(operation,version,quantity)=>{const body={action:'preview',operation,reportId:f.daily.id,quantity,productionDate:f.daily.productionDate,productionLocalDateTime:f.daily.productionLocalDateTime,reason:'Synthetic correction',requestIdempotency:crypto.randomUUID(),expectedVersion:version},p=await correctDailyOutput(c.db,body,admin);return correctDailyOutput(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},admin);};
 const edited=await change('daily-output-edit',1,250);assert.equal(edited.report.reportedQuantity,250);await f.state(600,250);await change('daily-output-cancel',2);await f.state(600,0);
}));
test('new receipt updates an existing raw pending projection without including reservations',()=>dailyFixture(async c=>{
 const f=await setup(c);await f.review(f.legacy);await f.state(600,300);const extra=(await f.save(50)).report;await f.state(600,350);await f.review(f.daily);await f.state(900,50);await f.review(extra,false);await f.state(900,0);
}));
