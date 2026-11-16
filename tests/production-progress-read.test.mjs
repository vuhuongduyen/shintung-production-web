import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {records} from '../scripts/local/database.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {reviewSnapshot} from '../lib/production-review-selection.mjs';
import {progressReviewSummary} from '../lib/production-progress-review.mjs';
import {productionRuntime} from '../lib/production-runtime.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';

test('progress preserves totals, review fingerprints and line scope while removing audit transport; full disclosure remains intact',()=>dailyFixture(async c=>{
 const bulky='x'.repeat(560000);
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic product',processes:['CUT','PACK'],history:[bulky]});
 await c.put('in_transit','LINE-B',{...c.order,id:'LINE-B',line:'B',lsxCode:'LSX-B'});
 for(let i=0;i<16;i++)await c.put('production_report','R'+i,{id:'R'+i,kind:'completion',transitId:c.order.id,line:'A',sku:c.order.sku,stageName:'PACK',stageReporting:true,reportedQuantity:10,approvedQuantity:i%2?10:0,reviewStatus:i%2?'Đã xác nhận':'Chờ kiểm tra',startedAt:'2026-11-02T08:00:00+07:00',completedAt:'2026-11-02T09:00:00+07:00',hours:{hc:1,ot:0,total:1},laborNotes:[{text:'Keep review context'}],sourceSnapshot:{audit:bulky},history:[bulky]});
 await c.put('production_event','START',{id:'START',kind:'start',sourceId:c.order.id,line:'A',employees:[],effectiveAt:'2026-11-02T08:00:00+07:00',sourceSnapshot:{audit:bulky}});
 await c.put('production_history_import','IMPORT',{reports:[{id:'LEGACY-B',kind:'completion',transitId:'LINE-B',line:'B',reportedQuantity:12,reviewStatus:'Đã xác nhận',hours:{total:2},sourceSnapshot:{audit:bulky},laborNotes:[{text:'Keep legacy context'}]}]});
 let timing;const call=await reviewer(c,async(req,env)=>{timing=observeReadDatabase(env.DB);return siteApi(req,{...env,DB:timing.database});});
 const before=await records(c.db),full=await call('/api/production-workflow'),fullCalls=timing.summary().calls;
 const compact=await call('/api/production-workflow?view=progress'),compactCalls=timing.summary().calls;
 assert.equal(full.status,200);assert.equal(compact.status,200);
 assert.deepEqual(compact.body.orders.map(o=>o.id),full.body.orders.map(o=>o.id));
 for(const order of full.body.orders){
  const projected=compact.body.orders.find(o=>o.id===order.id);
  assert.deepEqual(projected.processes,order.processes);
  const a=progressReviewSummary(order,full.body.reports),b=progressReviewSummary(projected,compact.body.reports);
  for(const key of ['qty','pendingQty','startedAt','completedAt','timing'])assert.deepEqual(b[key],a[key],key);
  assert.deepEqual(productionRuntime(projected,compact.body.events),productionRuntime(order,full.body.events));
 }
 for(const report of full.body.reports){const projected=compact.body.reports.find(r=>r.id===report.id);const order=full.body.orders.find(o=>o.id===report.transitId);assert.equal(reviewSnapshot(order,projected),reviewSnapshot(order,report));assert.equal(projected.sourceSnapshot,undefined);}
 assert.equal(full.body.reports[0].sourceSnapshot.audit.length,bulky.length);
 assert.ok(JSON.stringify(compact.body).length<JSON.stringify(full.body).length/10);
 assert.ok(compactCalls<fullCalls,`${fullCalls} -> ${compactCalls}`);
 console.log(`Progress fixture DB reads: ${fullCalls} -> ${compactCalls}; bytes: ${JSON.stringify(full.body).length} -> ${JSON.stringify(compact.body).length}`);
 const line=await readProductionWorkflow(c.db,{login:'LINE_A',line:'A',isAdmin:true},[],{progressRead:true,includeDerivedHours:false,includeJournalHours:false});
 assert.ok(line.orders.every(o=>o.line==='A'));assert.ok(line.reports.every(r=>r.line==='A'));
 await assert.rejects(readProductionWorkflow(c.db,{login:'DENIED',grants:[]},[],{progressRead:true}),e=>e.status===403);
 assert.deepEqual(await records(c.db),before);
}));

test('default progress loads active orders only; completed/cancelled history requires an explicit scope and pending zero-output remains active',()=>dailyFixture(async c=>{
 const old={...c.order,id:'DONE',lsxCode:'DONE',lsxQty:100,completedQty:100,actualCompletedAt:'2026-11-02'};
 await c.put('in_transit','DONE',old);await c.put('in_transit','CANCEL',{...c.order,id:'CANCEL',lsxCode:'CANCEL',status:'HỦY',cancelReason:'Synthetic cancelled'});
 await c.put('in_transit','PENDING',{...old,id:'PENDING',lsxCode:'PENDING'});
 for(const id of ['DONE','CANCEL','PENDING'])await c.put('production_report','APPROVED-'+id,{id:'APPROVED-'+id,kind:'completion',transitId:id,line:'A',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',completedAt:'2026-11-02T10:00:00+07:00',hours:{total:1},sourceSnapshot:{audit:'x'.repeat(100000)}});
 await c.put('production_report','ZERO',{id:'ZERO',kind:'completion',transitId:'PENDING',line:'A',reportedQuantity:0,reviewStatus:'Chờ kiểm tra',hours:{total:1}});
 const call=await reviewer(c),before=await records(c.db);
 const active=await call('/api/production-workflow?view=progress');assert.equal(active.status,200);
 assert.ok(active.body.progressOrders.some(o=>o.id===c.order.id));assert.ok(active.body.progressOrders.some(o=>o.id==='PENDING'));
 for(const id of ['DONE','CANCEL']){assert.equal(active.body.progressOrders.some(o=>o.id===id),false);assert.equal(active.body.reports.some(r=>r.transitId===id),false);}
 const history=await call('/api/production-workflow?view=progress&scope=all');assert.equal(history.status,200);
 for(const id of ['DONE','CANCEL'])assert.ok(history.body.progressOrders.some(o=>o.id===id));
 const invalid=await call('/api/production-workflow?view=progress&scope=invalid');assert.equal(invalid.status,422);
 assert.deepEqual(await records(c.db),before);
}));
