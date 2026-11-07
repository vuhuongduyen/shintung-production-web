import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {activateQuantityCutover} from '../scripts/local/production-quantity-cutover.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {readDailyOutputPolicy} from '../scripts/local/production-daily-output.mjs';
import {records} from '../scripts/local/database.mjs';
import {siteApi} from '../worker/site-api.mjs';

const admin={login:'SYNTHETIC-COMMIT-GUARD',isAdmin:true};
async function setup(c){
 await c.db.prepare("DELETE FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation')").run();
 await activateQuantityCutover(c.db,{snapshotId:'SYNTHETIC-COMMIT-GUARD-SNAPSHOT'},admin,{sourceId:'a'.repeat(64)});
 return (await mutateProductionWorkflow(c.db,c.body(),actor)).report;
}
// Inject only into the cursor transaction, after every policy/source read and
// validation. HTTP action-audit INSERTs must not trigger this simulated race.
function beforeCursorCommit(db,change){
 const sqlFor=new WeakMap();let armed=false,injected=false,atCommit;
 const wrapped=new Proxy(db,{get(target,key){
  if(key==='prepare')return sql=>{
   const statement=target.prepare(sql);sqlFor.set(statement,sql);
   return new Proxy(statement,{get(stmt,name){
    if(name==='bind')return (...args)=>{const bound=stmt.bind(...args);sqlFor.set(bound,sql);return bound;};
    const value=stmt[name];return typeof value==='function'?value.bind(stmt):value;
   }});
  };
  if(key==='batch')return async statements=>{
   if(armed&&statements.some(s=>/^UPDATE app_records SET payload=/.test(sqlFor.get(s)||'')&&(sqlFor.get(s)||'').includes("entity='production_cursor'"))){
    armed=false;injected=true;await change();atCommit=await records(db);
   }
   return target.batch(statements);
  };
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 return {db:wrapped,arm(){armed=true;},get injected(){return injected;},get atCommit(){return atCommit;}};
}
const races={
 'missing activation':db=>db.prepare("DELETE FROM app_records WHERE entity='production_reporting_activation' AND record_key='global'").run(),
 'changed activation':db=>db.prepare("UPDATE app_records SET payload=json_set(payload,'$.syntheticRevision',1) WHERE entity='production_reporting_activation' AND record_key='global'").run(),
 'missing frozen source':db=>db.prepare("DELETE FROM app_records WHERE entity='production_quantity_source' AND record_key=(SELECT min(record_key) FROM app_records WHERE entity='production_quantity_source')").run(),
};
async function action(c,report,call,kind){
 if(kind==='approve'||kind==='reject')return {path:'/api/production-report',body:{action:'review',reportId:report.id,approve:kind==='approve',reason:kind==='reject'?'Synthetic rejection':'',expectedVersion:1}};
 const body={action:'apply',operation:kind==='edit'?'daily-output-edit':'daily-output-cancel',reportId:report.id,...(kind==='edit'?{quantity:250,productionDate:report.productionDate,productionLocalDateTime:report.productionLocalDateTime}:{}),reason:'Synthetic correction',requestIdempotency:crypto.randomUUID(),expectedVersion:1};
 const preview=await call('/api/production-correction',{...body,action:'preview'});assert.equal(preview.status,200,JSON.stringify(preview.body));
 return {path:'/api/production-correction',body:{...body,expectedRevision:preview.body.expectedRevision}};
}
for(const kind of ['approve','reject','edit','cancel'])for(const [race,change] of Object.entries(races))test(`${kind} rejects ${race} at the commit boundary; only the failed HTTP receipt may change`,()=>dailyFixture(async c=>{
 const report=await setup(c),probe=beforeCursorCommit(c.db,()=>change(c.db)),call=await reviewer(c,(request,env)=>siteApi(request,{...env,DB:probe.db}));
 const input=await action(c,report,call,kind),before=await records(c.db),oldAuditKeys=new Set(before.filter(r=>r.entity==='website_action_audit').map(r=>r.record_key));
 assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);probe.arm();
 const response=await call(input.path,input.body);assert.equal(probe.injected,true,'race must happen after validation, inside the actual cursor batch');assert.equal(response.status,409,JSON.stringify(response.body));
 const after=await records(c.db),newReceipts=after.filter(r=>r.entity==='website_action_audit'&&!oldAuditKeys.has(r.record_key));assert.equal(newReceipts.length,1);
 const receipt=JSON.parse(newReceipts[0].payload);assert.equal(receipt.actorId,'SYNTHETIC-REVIEWER');assert.equal(receipt.route,input.path);assert.equal(receipt.record,report.id);assert.equal(receipt.httpStatus,409);assert.equal(receipt.outcome,'failed');assert.equal(receipt.evidence,'server');
 const keep=row=>!(row.entity==='website_action_audit'&&row.record_key===newReceipts[0].record_key);
 assert.deepEqual(after.filter(keep),probe.atCommit.filter(keep),'report, cursor, orders, events, warehouse, old audit and remaining frozen bytes stay unchanged');
 assert.equal(after.filter(r=>r.entity==='warehouse_in').length,0);
 if(race!=='changed activation')assert.equal((await readDailyOutputPolicy(c.db)).policy.active,false);
}));
for(const kind of ['approve','reject','edit','cancel'])test(`${kind} still succeeds against unchanged receipt policy and frozen source`,()=>dailyFixture(async c=>{
 const report=await setup(c),call=await reviewer(c),input=await action(c,report,call,kind),before=await records(c.db),result=await call(input.path,input.body);assert.equal(result.status,200,JSON.stringify(result.body));
 const after=await records(c.db),stored=JSON.parse(after.find(r=>r.entity==='production_report'&&r.record_key===report.id).payload);
 if(kind==='approve'){assert.equal(stored.approvedQuantity,200);assert.equal(after.filter(r=>r.entity==='warehouse_in').length,1);}
 if(kind==='reject')assert.equal(stored.reviewStatus,'Cần điều chỉnh');
 if(kind==='edit')assert.equal(stored.reportedQuantity,250);
 if(kind==='cancel')assert.equal(stored.cancelled,true);
 assert.deepEqual(after.filter(r=>r.entity==='production_quantity_source'),before.filter(r=>r.entity==='production_quantity_source'));
 if(kind==='edit'||kind==='cancel'){
  const events=after.filter(r=>r.entity==='production_event'),replay=await call(input.path,input.body);assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.deepEqual((await records(c.db)).filter(r=>r.entity==='production_event'),events);
 }
}));
test('correction preview binds the activation payload, including a concurrent same-policy marker revision',()=>dailyFixture(async c=>{
 const report=await setup(c),call=await reviewer(c),input=await action(c,report,call,'edit');await races['changed activation'](c.db);
 const before=await records(c.db),result=await call(input.path,input.body);assert.equal(result.status,409,JSON.stringify(result.body));
 assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='website_action_audit'),before.filter(r=>r.entity!=='website_action_audit'));
}));

async function linkedAction(c,call,kind){
 const report=await setup(c),review=await call('/api/production-report',{action:'review',reportId:report.id,approve:true,expectedVersion:1});assert.equal(review.status,200,JSON.stringify(review.body));
 const current=review.body.payload,receiptId=`SX:${report.id}`,spreadsheetId='SYNTHETIC_SHEET_1234567890123456';
 const {sheetSetup,sheetBridge}=await import('../worker/warehouse-sheet.mjs');
 const req=body=>new Request('https://test.invalid/api/warehouse-sheet/bridge',{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify(body)});
 const connection=await (await sheetSetup(req({spreadsheetId}),{DB:c.db},admin)).json();
 const acknowledged=await sheetBridge(req({action:'ack',spreadsheetId,bridgeToken:connection.token,receiptId,reportId:report.id,sku:report.sku,sourceCompletedAt:report.productionDate}),{DB:c.db});assert.equal(acknowledged.status,200);
 if(kind!=='pending edit'){
  const {confirmSelectedWarehouse}=await import('../worker/warehouse-confirm.mjs');
  const preview=await confirmSelectedWarehouse(c.db,{action:'preview',ids:[receiptId]},admin);
  await confirmSelectedWarehouse(c.db,{action:'confirm',ids:[receiptId],revision:preview.revision,receivedAsProposed:true},admin);
 }
 const body={action:'apply',operation:kind==='pending edit'?'daily-output-edit':'daily-output-withdraw',reportId:report.id,reason:'Synthetic linked correction',requestIdempotency:crypto.randomUUID(),expectedVersion:current.version,...(kind==='pending edit'?{quantity:250,productionDate:current.productionDate,productionLocalDateTime:current.productionLocalDateTime}:{})};
 const preview=await call('/api/production-correction',{...body,action:'preview'});assert.equal(preview.status,200,JSON.stringify(preview.body));
 const input={path:'/api/production-correction',body:{...body,expectedRevision:preview.body.expectedRevision}};
 if(kind!=='withdrawal decision')return input;
 const request=await call(input.path,input.body);assert.equal(request.status,200,JSON.stringify(request.body));const id=request.body.request.id;
 const decision=await call('/api/warehouse-confirm',{action:'withdrawal-preview',withdrawalId:id});assert.equal(decision.status,200,JSON.stringify(decision.body));
 return {path:'/api/warehouse-confirm',body:{action:'withdrawal-approve',withdrawalId:id,checked:true,expectedRevision:decision.body.expectedRevision,requestIdempotency:crypto.randomUUID()}};
}
for(const kind of ['pending edit','withdrawal request','withdrawal decision'])for(const [race,change] of Object.entries(races))test(`${kind} binds the same ${race} fence and preserves queued/received stock`,()=>dailyFixture(async c=>{
 const probe=beforeCursorCommit(c.db,()=>change(c.db)),call=await reviewer(c,(request,env)=>siteApi(request,{...env,DB:probe.db})),input=await linkedAction(c,call,kind),before=await records(c.db),oldAuditKeys=new Set(before.filter(r=>r.entity==='website_action_audit').map(r=>r.record_key));
 assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);probe.arm();const result=await call(input.path,input.body);assert.equal(probe.injected,true);assert.equal(result.status,409,JSON.stringify(result.body));
 const after=await records(c.db),receipts=after.filter(r=>r.entity==='website_action_audit'&&!oldAuditKeys.has(r.record_key));assert.equal(receipts.length,1);const receipt=JSON.parse(receipts[0].payload);assert.equal(receipt.actorId,'SYNTHETIC-REVIEWER');assert.equal(receipt.route,input.path);assert.equal(receipt.evidence,'server');assert.equal(receipt.httpStatus,409);assert.equal(receipt.outcome,'failed');
 const keep=row=>!(row.entity==='website_action_audit'&&row.record_key===receipts[0].record_key);assert.deepEqual(after.filter(keep),probe.atCommit.filter(keep));assert.equal(after.filter(r=>r.entity==='warehouse_in').length,1);
}));
for(const kind of ['pending edit','withdrawal request','withdrawal decision'])test(`${kind} still commits once with unchanged policy/source`,()=>dailyFixture(async c=>{
 const call=await reviewer(c),input=await linkedAction(c,call,kind),before=await records(c.db),result=await call(input.path,input.body);assert.equal(result.status,200,JSON.stringify(result.body));
 const after=await records(c.db);assert.deepEqual(after.filter(r=>r.entity==='production_quantity_source'),before.filter(r=>r.entity==='production_quantity_source'));assert.equal(after.filter(r=>r.entity==='warehouse_in').length,1);
 const events=after.filter(r=>r.entity==='production_event'),repeat=await call(input.path,input.body);assert.equal(repeat.status,200);assert.equal(repeat.body.replayed,true);assert.deepEqual((await records(c.db)).filter(r=>r.entity==='production_event'),events);
}));
for(const kind of ['pending edit','withdrawal request','withdrawal decision'])test(`${kind} rejects an activation revision changed after preview`,()=>dailyFixture(async c=>{
 const call=await reviewer(c),input=await linkedAction(c,call,kind);await races['changed activation'](c.db);const before=await records(c.db),result=await call(input.path,input.body);assert.equal(result.status,409,JSON.stringify(result.body));assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='website_action_audit'),before.filter(r=>r.entity!=='website_action_audit'));
}));
test('review fails closed on a missing workflow cursor instead of recreating admission state and writing stock',()=>dailyFixture(async c=>{
 const report=await setup(c),call=await reviewer(c);await c.db.prepare("DELETE FROM app_records WHERE entity='production_cursor' AND record_key='global'").run();const before=await records(c.db);
 const response=await call('/api/production-report',{action:'review',reportId:report.id,approve:true,expectedVersion:1});assert.equal(response.status,409,JSON.stringify(response.body));
 assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='website_action_audit'),before.filter(r=>r.entity!=='website_action_audit'));
}));
