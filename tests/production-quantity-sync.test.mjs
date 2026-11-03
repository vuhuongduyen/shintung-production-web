import test from 'node:test';
import {assertRejectedRequestAudit} from './helpers/rejected-request-audit.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {createProductionExamples} from '../scripts/local/production-examples.mjs';
import {mutateProductionWorkflow,readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';

const actor={login:'quantity-manager@test',isAdmin:true,line:null};
const orderId='TEST-LSX-A01';
async function fixture(run){
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});
 const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/quantity-sync-')));
 try{
  await migrate(c.db);
  const examples=await createProductionExamples(c.db,actor,new Date('2026-10-16T01:00:00Z'));
  const at=time=>new Date(`${examples.examples.date}T${time}:00+07:00`).toISOString();
  for(const id of [orderId,'TEST-LSX-A02']){
   const stored=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(id).first();
   const row={...JSON.parse(stored.payload),planId:'TEST-SHARED-PLAN',sku:'TEST-SHARED-SKU',lsxQty:4000};
   await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify(row),id).run();
  }
  const p=await passwordRecord('1234');
  await c.db.batch([
   c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',actor.login,JSON.stringify({login:actor.login,role:'Super Admin',active:true}),actor.login,'fixture'),
   c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(actor.login,p.hash,p.salt,p.iterations,'fixture')
  ]);
  let cookie='';
  const call=async(path,body)=>{
   const response=await siteApi(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/json',origin:'https://test.invalid'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:c.db,FILES:c.bucket});
   const value=await response.json();return {status:response.status,body:value,headers:response.headers,response:Response.json(value,{status:response.status,headers:response.headers})};
  };
  const login=await call('/api/auth/login',{login:actor.login,password:'1234'});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  const quantities=async(completed,outstanding)=>{
   const response=await call('/api/in-transit');assert.equal(response.status,200);
   const order=response.body.rows.find(row=>row.id===orderId);
   assert.equal(order.completedQty,completed);assert.equal(order.inTransitQty,outstanding);
   const sibling=response.body.rows.find(row=>row.id==='TEST-LSX-A02');
   assert.equal(sibling.completedQty,0,'same Plan and SKU must not merge another LSX');assert.equal(sibling.inTransitQty,4000);
   const workflow=await readProductionWorkflow(c.db,actor);
   assert.equal(workflow.orders.find(row=>row.id===orderId).completedQty,completed);
   return order;
  };
  await run({db:c.db,at,call,quantities});
 }finally{await c.close();}
}

test('confirmed output synchronizes exact LSX cumulatively; pending, repeat and concurrent review never double count',()=>fixture(async({db,at,call,quantities})=>{
 const protectedRows=async()=>(await db.prepare("SELECT * FROM app_records WHERE entity IN ('capacity','production_plan') OR (entity='in_transit' AND record_key<>?) ORDER BY entity,record_key").bind(orderId).all()).results;
 const original=await protectedRows();
 const first=await mutateProductionWorkflow(db,{action:'complete',orderId,quantity:3000,effectiveAt:at('10:00'),requestIdempotency:'TEST-QUANTITY-REPORT-0001'},actor);
 const replay=await mutateProductionWorkflow(db,{action:'complete',orderId,quantity:3000,effectiveAt:at('10:00'),requestIdempotency:'TEST-QUANTITY-REPORT-0001'},actor);
 assert.equal(replay.replayed,true);assert.equal(replay.event.id,first.event.id);
 let order=await quantities(0,4000);assert.equal(order.pendingReportQty,3000);
 const review={action:'review',reportId:first.report.id,expectedVersion:0,approve:true};
 const approved=await call('/api/production-report',review);assert.equal(approved.status,200,JSON.stringify(approved.body));
 order=await quantities(3000,1000);assert.equal(order.pendingReportQty,0);assert.equal(order.actualCompletedAt,'');
 const saved=await records(db);
 const repeated=await call('/api/production-report',review);assert.equal(repeated.status,409);await assertRejectedRequestAudit({before:saved,after:await records(db),response:repeated.response,actorId:actor.login,route:'/api/production-report',body:review});
 const second=await mutateProductionWorkflow(db,{action:'complete',orderId,quantity:1000,effectiveAt:at('11:00')},actor);
 await quantities(3000,1000);
 const body={action:'review',reportId:second.report.id,expectedVersion:0,approve:true};
 const concurrent=await Promise.all([call('/api/production-report',body),call('/api/production-report',body)]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 order=await quantities(4000,0);assert.equal(order.actualCompletedAt,'2026-10-14');
 const state=await readProductionWorkflow(db,actor);
 assert.equal(state.reports.filter(r=>r.transitId===orderId&&r.kind==='completion').length,2);
 assert.equal(state.events.filter(e=>e.kind==='report-approval'&&e.sourceId===orderId).length,2);
 assert.equal((await db.prepare("SELECT count(*) AS count FROM app_records WHERE entity='warehouse_in'").first()).count,2);
 assert.deepEqual(await protectedRows(),original);
}));

test('confirmed quantity edit and cancellation recompute outstanding, retain history and refuse stale replays',()=>fixture(async({db,at,call,quantities})=>{
 const output=await mutateProductionWorkflow(db,{action:'complete',orderId,quantity:3000,effectiveAt:at('10:00')},actor);
 assert.equal((await call('/api/production-report',{action:'review',reportId:output.report.id,approve:true})).status,200);
 await quantities(3000,1000);
 const edit={eventId:output.event.id,version:0,operation:'adjust',changes:{quantity:2500},reason:'TEST quantity correction'};
 const preview=await correctProduction(db,{...edit,action:'preview'},actor);
 const request={...edit,action:'apply',expectedRevision:preview.expectedRevision};
 await correctProduction(db,request,actor);await quantities(2500,1500);
 const afterEdit=await records(db);await assert.rejects(()=>correctProduction(db,request,actor),{status:409});assert.deepEqual(await records(db),afterEdit);
 let state=await readProductionWorkflow(db,actor);
 const replacement=state.events.find(event=>event.correctedFrom===output.event.id);
 const cancel={eventId:replacement.id,version:replacement.version||0,operation:'cancel',reason:'TEST cancelled output'};
 const cancelPreview=await correctProduction(db,{...cancel,action:'preview'},actor);
 await correctProduction(db,{...cancel,action:'apply',expectedRevision:cancelPreview.expectedRevision},actor);
 await quantities(0,4000);
 state=await readProductionWorkflow(db,actor);
 const retained=state.reports.find(report=>report.id===output.report.id);
 assert.equal(retained.cancelled,true);assert.equal(retained.reviewStatus,'Đã hủy');assert.equal(retained.reportedQuantity,2500);
 assert.equal(state.events.filter(event=>['report-correction','report-cancel'].includes(event.kind)).length,2);
 const warehouse=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in' AND record_key=?").bind(`SX:${output.report.id}`).first()).payload);
 assert.equal(warehouse.status,'Đã hủy');
}));

test('rejection and failed confirmation keep quantity unchanged and do not create warehouse receipts',()=>fixture(async({db,at,call,quantities})=>{
 const output=await mutateProductionWorkflow(db,{action:'complete',orderId,quantity:3000,effectiveAt:at('10:00')},actor);
 const before=await records(db);
 const stale=await call('/api/production-report',{action:'review',reportId:output.report.id,approve:true,expectedVersion:99});
 assert.equal(stale.status,409);await assertRejectedRequestAudit({before,after:await records(db),response:stale.response,actorId:actor.login,route:'/api/production-report',body:{action:'review',reportId:output.report.id,approve:true,expectedVersion:99}});await quantities(0,4000);
 const rejected=await call('/api/production-report',{action:'review',reportId:output.report.id,approve:false,reason:'TEST reject quantity'});
 assert.equal(rejected.status,200);const order=await quantities(0,4000);assert.equal(order.pendingReportQty,0);
 assert.equal((await db.prepare("SELECT count(*) AS count FROM app_records WHERE entity='warehouse_in'").first()).count,0);
}));
