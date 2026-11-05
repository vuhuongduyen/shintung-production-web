import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor as lineA} from './helpers/daily-output-fixture.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {getTransit,mutateTransit} from '../scripts/local/in-transit.mjs';
import {reviewDailyOutput} from '../scripts/local/production-daily-review.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {records} from '../scripts/local/database.mjs';
import {permissionProfiles} from '../lib/user-permission-profiles.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
import {capturePlanLeadtime} from '../lib/transit-leadtime.mjs';
const planner={login:'SYNTHETIC-KHSX',isAdmin:true},rowId='SYNTHETIC-PLAN-ROW';
async function source(c,extra={}){
 const order={...c.order,planRowId:rowId,planQty:2000,planLaborBasis:{status:'resolved',value:.1,segments:[]},planLeadtimeBasis:capturePlanLeadtime({id:rowId,sku:c.order.sku,plan:2000},[{sku:c.order.sku,leadTime:2}],[],'2026-11-02T00:00:00Z','SYNTHETIC-KHSX'),...extra};
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify(order),order.id).run();return order;
}
const add=(id,line='B')=>({action:'add-lsx',id,planStart:'2026-11-05',planEnd:'2026-11-06',line,priority:'THƯỜNG',sequence:2});
const rawOrder=(db,id)=>db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(id).first();

test('additional LSX retains the Plan basis but starts with no copied pending output, then reports/approves only its own quantity',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-06T03:00:00Z')});try{await dailyFixture(async c=>{
  const original=await source(c),raw=await rawOrder(c.db,original.id),saved=await mutateProductionWorkflow(c.db,c.body({quantity:200,productionDate:'2026-11-05',expectedOrderRevision:await recordRevision(raw.payload)}),lineA);
  assert.equal(saved.report.reportedQuantity,200);const projected=(await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.id===original.id);assert.equal(projected.pendingReportQty,200);
  const originalRaw=await rawOrder(c.db,original.id),extra=(await mutateTransit(c.db,add(original.id),planner)).row;
  assert.equal(extra.completedQty,0);assert.equal(extra.pendingReportQty||0,0,'a projection of another LSX is not this LSX\'s history');assert.equal(extra.lsxCode,'');assert.equal(extra.lsxQty,null);assert.equal(extra.productionReceivedAt,'');
  assert.deepEqual(extra.planLaborBasis,original.planLaborBasis);assert.deepEqual(extra.planLeadtimeBasis,original.planLeadtimeBasis);assert.equal(extra.planRowId,original.planRowId);assert.deepEqual(await rawOrder(c.db,original.id),originalRaw);
  let row=(await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.id===extra.id);
  await mutateTransit(c.db,{action:'draft-lsx',id:row.id,expectedRevision:row.revision,changes:{lsxCode:'SYNTHETIC-ADDITIONAL',lsxQty:400,lsxOpenedAt:'2026-11-05'}},planner);
  row=(await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.id===extra.id);await mutateTransit(c.db,{action:'sync',id:row.id,expectedRevision:row.revision},planner);
  const current=await rawOrder(c.db,extra.id),body=c.body({orderId:extra.id,quantity:400,productionDate:'2026-11-05',expectedOrderRevision:await recordRevision(current.payload)}),before=await records(c.db);
  await assert.rejects(()=>mutateProductionWorkflow(c.db,body,lineA),e=>e.status===403);assert.deepEqual(await records(c.db),before);
  const lineB={...lineA,login:'LINE_B',line:'B'},daily=await mutateProductionWorkflow(c.db,body,lineB);assert.equal(daily.report.reportedQuantity,400);assert.equal(daily.report.legacyCompletedBaseline,0);assert.equal(daily.report.rateBasis.value,.2);assert.equal(daily.report.hours,undefined);assert.equal(daily.report.stageName,undefined);
  const replay=await mutateProductionWorkflow(c.db,body,lineB);assert.equal(replay.replayed,true);assert.equal(replay.report.id,daily.report.id);
  const reviewer={login:'SYNTHETIC-QLSX',grants:permissionProfiles.QLSX.grants};await reviewDailyOutput(c.db,{action:'review',reportId:daily.report.id,approve:true,expectedVersion:1,delayReason:'Synthetic delayed review'},reviewer);
  const final=(await getTransit(c.db,{},[],{includeHistory:false})).rows,sourceRow=final.find(r=>r.id===original.id),newRow=final.find(r=>r.id===extra.id);assert.equal(sourceRow.pendingReportQty,200);assert.equal(sourceRow.completedQty,0);assert.equal(newRow.completedQty,400);assert.equal(newRow.pendingReportQty,0);
  const all=await records(c.db),reports=all.filter(r=>r.entity==='production_report').map(r=>JSON.parse(r.payload)),warehouse=all.filter(r=>r.entity==='warehouse_in').map(r=>JSON.parse(r.payload));assert.equal(warehouse.length,1);assert.equal(warehouse[0].reportId,daily.report.id);assert.equal(warehouse[0].proposedQuantity,400);assert.equal(warehouse[0].receivedQuantity,null);
  const earned=monthlyEarnedOrders(final,reports,'2026-11','B',new Map([[original.sku,99]]),true);assert.equal(earned.reduce((n,r)=>n+r.earned,0),80,'actual daily rate is independent of the frozen .1 planning rate');assert.deepEqual(await rawOrder(c.db,original.id),originalRaw);
 });}finally{t.mock.timers.reset();}
});

test('new additional LSX does not inherit imported LSX aliases or the historical-import budget exemption',()=>dailyFixture(async c=>{
 const columns=Array(39).fill('');Object.assign(columns,{0:c.order.planId,1:c.order.sku,5:'SYNTHETIC-OLD-IMPORT',13:2000,14:1000,15:'2026-11-01',16:'ĐÃ MỞ LSX',17:100});
 const original=await source(c,{columns,historicalImport:true,productionState:'Hoàn thành sản xuất',productionReceivedAt:'2026-11-02T00:00:00Z',delayReason:'Synthetic old delay'}),before=await rawOrder(c.db,original.id);
 const extra=(await mutateTransit(c.db,add(original.id,'A'),planner)).row;assert.equal(extra.lsxCode,'');assert.equal(extra.lsxQty,null);assert.equal(extra.lsxOpenedAt,'');assert.notEqual(extra.historicalImport,true);assert.equal(extra.productionState,'');assert.equal(extra.productionReceivedAt,'');assert.equal(extra.delayReason,'');assert.equal(extra.planQty,2000);assert.deepEqual(extra.planLeadtimeBasis,original.planLeadtimeBasis);assert.deepEqual(await rawOrder(c.db,original.id),before);
}));

test('additional-LSX creation reads only its source reference, never report, event, Leadtime or audit history',()=>dailyFixture(async c=>{
 const original=await source(c),blocked=new Set(['production_report','production_event','production_history_import','leadtime','leadtime_versions','in_transit_audit']);let selects=0,batches=0;
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^\s*SELECT\b/i.test(sql))selects++;const statement=target.prepare(sql);return new Proxy(statement,{get(s,k){if(k==='bind')return(...args)=>{assert.ok(!args.some(a=>blocked.has(a)),'creation must not fetch unrelated history');return s.bind(...args);};const v=s[k];return typeof v==='function'?v.bind(s):v;}});};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const result=await mutateTransit(db,add(original.id),planner);assert.equal(result.row.planRowId,rowId);assert.equal(selects,1);assert.equal(batches,1);
}));

test('an old source without a proven Plan basis stays unchanged; its new LSX keeps missing basis rather than current masters',()=>dailyFixture(async c=>{
 const original=await source(c);await c.db.prepare("UPDATE app_records SET payload=json_remove(payload,'$.planLeadtimeBasis','$.planLaborBasis') WHERE entity='in_transit' AND record_key=?").bind(original.id).run();await c.put('leadtime',original.sku,{sku:original.sku,leadTime:99});
 const before=await rawOrder(c.db,original.id),extra=(await mutateTransit(c.db,add(original.id),planner)).row,view=(await getTransit(c.db,{},[],{includeHistory:false})).rows;
 assert.equal(view.find(r=>r.id===extra.id).standardLeadtime,null,'new history cannot claim the current master was effective on an unknown Plan close day');
 assert.equal(extra.planLeadtimeBasis,null);assert.equal(extra.planLaborBasis.status,'missing');assert.equal(extra.planQty,2000);assert.equal(view.find(r=>r.id===original.id).standardLeadtime,99,'legacy source read contract is not silently rewritten');assert.deepEqual(await rawOrder(c.db,original.id),before);
 await c.put('production_reporting_activation','global',{id:'SYNTHETIC-PERMANENT-MARKER',effectiveFrom:'2026-11-01'});await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();
 const protectedExtra=(await mutateTransit(c.db,add(original.id),planner)).row;assert.equal(protectedExtra.planLeadtimeBasis,null);assert.equal(protectedExtra.planLaborBasis.status,'missing','removing policy after activation must not reopen a current-rate fallback');assert.deepEqual(await rawOrder(c.db,original.id),before);
}));

test('before the new reporting cutover, legacy additional-LSX lookup remains unchanged',()=>dailyFixture(async c=>{
 const original=await source(c);await c.db.prepare("UPDATE app_records SET payload=json_remove(payload,'$.planLeadtimeBasis','$.planLaborBasis') WHERE entity='in_transit' AND record_key=?").bind(original.id).run();await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();await c.put('leadtime',original.sku,{sku:original.sku,leadTime:99});
 const before=await rawOrder(c.db,original.id),extra=(await mutateTransit(c.db,add(original.id),planner)).row;assert.equal(Object.hasOwn(extra,'planLeadtimeBasis'),false);assert.equal(Object.hasOwn(extra,'planLaborBasis'),false);assert.equal((await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.id===extra.id).standardLeadtime,99);assert.deepEqual(await rawOrder(c.db,original.id),before);
}));

for(const fault of ['change','delete','policy','activation'])test(`a source ${fault} immediately before the creation batch cannot leave an LSX or orphan audit`,()=>dailyFixture(async c=>{
 const original=await source(c);let expected,injected=false;
 const raced=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{assert.equal(injected,false);injected=true;
  if(fault==='change')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.cancelReason','SYNTHETIC CONCURRENT CANCEL') WHERE entity='in_transit' AND record_key=?").bind(original.id).run();
  else if(fault==='delete')await target.prepare("DELETE FROM app_records WHERE entity='in_transit' AND record_key=?").bind(original.id).run();
  else if(fault==='policy')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.approved',json('false')) WHERE entity='production_reporting_policy' AND record_key='global'").run();
  else await target.prepare("INSERT INTO app_records VALUES('production_reporting_activation','global','{\"id\":\"SYNTHETIC-CONCURRENT-MARKER\"}','SYNTHETIC','now')").run();
  expected=await records(target);return target.batch(statements);
 };const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>mutateTransit(raced,add(original.id),planner),e=>e.status===409);assert.equal(injected,true);assert.deepEqual(await records(c.db),expected);
}));
