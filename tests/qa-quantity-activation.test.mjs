import test from 'node:test';
import assert from 'node:assert/strict';
import {qaQuantityActivation,qaQuantityIdentity as identity,qaQuantityLimits} from '../worker/qa-quantity-activation.mjs';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {records} from '../scripts/local/database.mjs';
import {readDailyOutputPolicy} from '../scripts/local/production-daily-output.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
const sourceId='a'.repeat(64),nonce='SYNTHETIC-QUANTITY-NONCE';
const context={hosting:{project_id:identity.projectId,d1:'DB',r2:'FILES'},metadata:{projectId:identity.projectId,snapshotId:sourceId}};
const path='/api/qa-quantity-activation';
const action=(extra={})=>({action:'prepare',requestIdempotency:nonce,...extra});
async function fixture(run){return dailyFixture(async c=>{
 // This only removes helper policy in a fresh synthetic local DB.
 await c.db.prepare("DELETE FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation')").run();
 const call=await reviewer(c,(request,env)=>qaQuantityActivation(new Request(identity.origin+new URL(request.url).pathname,{method:request.method,headers:{...Object.fromEntries(request.headers),...(request.method==='POST'?{origin:identity.origin}:{})},...(request.method==='POST'?{body:request.body,duplex:'half'}:{})}),env,context));
 const rawCall=async(body,options={})=>{const r=await qaQuantityActivation(new Request((options.origin||identity.origin)+(options.path||path),{method:body?'POST':'GET',headers:{cookie:'__Host-onspa_session='+'e'.repeat(64),...(body?{origin:options.csrf||identity.origin,'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:options.db||c.db,FILES:c.bucket},options.context||context);return r&&{status:r.status,body:await r.json()};};
 await run({...c,call,rawCall});
 });}
const doActivate=(call,p,extra={})=>call(path,action({action:'activate',expectedRevision:p.body.revision,acknowledge:true,...extra}));
test('hosted receipt candidate prepares only, freezes exact sources atomically, and replays the original activation body',()=>fixture(async c=>{
 const before=await records(c.db),p=await c.call(path,action());assert.equal(p.status,200,JSON.stringify(p));assert.equal(p.body.records,2);assert.equal(p.body.state,'prepared');
 assert.equal((await readDailyOutputPolicy(c.db)).policy?.active===true,false);
 const a=await doActivate(c.call,p);assert.equal(a.status,200,JSON.stringify(a));assert.equal(a.body.model,'server-receipt-quantity-v1');assert.equal(a.body.state,'active');assert.ok(Date.parse(a.body.receivedAt)>=Date.parse(p.body.preparedAt));
 const rows=await records(c.db);assert.deepEqual(rows.filter(r=>before.some(b=>b.entity===r.entity&&b.record_key===r.record_key)),before);
 const frozen=rows.filter(r=>r.entity==='production_quantity_source');assert.equal(frozen.length,2);for(const r of frozen){const [,entity,key]=JSON.parse(r.record_key);assert.equal(r.payload,before.find(b=>b.entity===entity&&b.record_key===key).payload);}
 const replay=await doActivate(c.call,p);assert.equal(replay.status,200,JSON.stringify(replay));assert.equal(replay.body.replayed,true);assert.deepEqual(await records(c.db),rows);
 assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);
}));
test('same-count/same-byte-length source changes between prepare and activation fail CAS with zero partial activation',()=>fixture(async c=>{
 const p=await c.call(path,action());await c.db.prepare("UPDATE app_records SET payload=replace(payload,'Synthetic product','Synthetic PRODUCT') WHERE entity='in_transit'").run();const before=await records(c.db);
 const a=await doActivate(c.call,p);assert.equal(a.status,409,JSON.stringify(a));assert.deepEqual(await records(c.db),before);
 assert.equal((await readDailyOutputPolicy(c.db)).policy?.active===true,false);
}));
test('live sources are rechecked inside commit, not just during preflight',()=>fixture(async c=>{
 const p=await c.call(path,action());let armed=true;
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(armed){armed=false;await c.put('production_history_import','SYNTHETIC-LATE',{reports:[]});}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const a=await c.rawCall(action({action:'activate',expectedRevision:p.body.revision,acknowledge:true}),{db});assert.equal(a.status,409,JSON.stringify(a));assert.equal((await readDailyOutputPolicy(c.db)).policy?.active===true,false);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_quantity_source'").first()).n,0);
}));
test('source identity, Admin scope, client overrides, CSRF, revisions and retired routes are guarded',()=>fixture(async c=>{
 for(const ctx of [{...context,metadata:{...context.metadata,snapshotId:'invalid'}},{...context,hosting:{...context.hosting,project_id:'MAIN'}},{...context,metadata:{...context.metadata,projectId:'MAIN'}}])assert.equal((await c.rawCall(action(),{context:ctx})).status,403);
 assert.equal((await c.rawCall(action(),{origin:'https://main.invalid'})).status,403);assert.equal((await c.rawCall(action(),{csrf:'https://other.invalid'})).status,403);
 for(const extra of [{sourceId},{effectiveFrom:'2026-01-01'},{receivedAt:'2026-01-01'}])assert.equal((await c.call(path,action(extra))).status,422);
 assert.equal((await c.call('/api/qa-daily-output',action())).status,410);assert.equal((await c.call('/_qa/daily-output')).status,410);
 const p=await c.call(path,action());assert.equal((await doActivate(c.call,p,{acknowledge:false})).status,422);assert.equal((await doActivate(c.call,p,{expectedRevision:'stale'})).status,409);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.line','A') WHERE entity='users' AND record_key='SYNTHETIC-REVIEWER'").run();assert.equal((await doActivate(c.call,p)).status,403);
}));
test('non-admin sessions and absent sessions cannot stage data',()=>fixture(async c=>{
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.role','USER') WHERE entity='users' AND record_key='SYNTHETIC-REVIEWER'").run();const before=await records(c.db);assert.equal((await c.call(path,action())).status,403);assert.deepEqual(await records(c.db),before);
 const response=await qaQuantityActivation(new Request(identity.origin+path),{DB:c.db},context);assert.equal(response.status,403);
}));
test('old QA leases, old policy, and changed old operation cannot be silently superseded',()=>fixture(async c=>{
 await c.put('qa_daily_activation_operation','global',{leaseUntil:Date.now()+90000});assert.equal((await c.call(path,action())).status,409);
 await c.db.prepare("UPDATE app_records SET payload='{}' WHERE entity='qa_daily_activation_operation'").run();const p=await c.call(path,action());assert.equal(p.status,200,JSON.stringify(p));
 await c.db.prepare("UPDATE app_records SET payload='{\"changed\":true}' WHERE entity='qa_daily_activation_operation'").run();assert.equal((await doActivate(c.call,p)).status,409);
}));
test('old activation contract is not accepted as PR9 readiness',()=>fixture(async c=>{
 await c.put('production_reporting_policy','global',{mode:'daily-finished-v1',approved:true,effectiveFrom:'2026-11-07',legacySnapshotId:'OLD-QA-SNAPSHOT'});const before=await records(c.db);assert.equal((await c.call(path,action())).status,409);assert.deepEqual(await records(c.db),before);
}));
test('all four source entities, approved/pending/new output and warehouse remain additive after activation/replay',()=>fixture(async c=>{
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.completedQty',400) WHERE entity='in_transit' AND record_key=?").bind(c.order.id).run();
 const legacy={id:'SYNTHETIC-PENDING',transitId:c.order.id,lsxCode:c.order.lsxCode,sku:c.order.sku,line:'A',kind:'completion',reportedQuantity:200,reviewStatus:'Chờ kiểm tra',version:1,startedAt:'2026-10-30T01:00:00Z',completedAt:'2026-10-30T02:00:00Z',hours:{hc:1,ot:0,total:1}};
 await c.put('production_report',legacy.id,legacy);await c.put('production_history_import','SYNTHETIC-IMPORT',{reports:[]});await c.put('warehouse_in','SYNTHETIC-EXISTING',{reportId:'SYNTHETIC-ALREADY-APPROVED',quantity:400,status:'Chờ Kho xác nhận'});
 for(let n=0;n<5;n++){await c.put('qa_deferred_file','SYNTHETIC-FILE-'+n,{pending:true});await c.bucket.put('SYNTHETIC-FILE-'+n,'SYNTHETIC-CONTENT');}
 const p=await c.call(path,action());assert.equal(p.body.records,5);assert.equal((await doActivate(c.call,p)).status,200);
 const row=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first();const daily=await mutateProductionWorkflow(c.db,c.body({quantity:300,expectedOrderRevision:await recordRevision(row.payload)}),actor);
 assert.equal(await c.rawCall(undefined,{path:'/api/production-report'}),null);
 const {siteApi}=await import('../worker/site-api.mjs');const api=async body=>{const r=await siteApi(new Request(identity.origin+'/api/production-report',{method:'POST',headers:{cookie:'__Host-onspa_session='+'e'.repeat(64),origin:identity.origin,'content-type':'application/json'},body:JSON.stringify(body)}),{DB:c.db,FILES:c.bucket});return {status:r.status,body:await r.json()};};
 assert.equal((await api({action:'review',reportId:legacy.id,approve:true,expectedVersion:1})).status,200);
 let raw=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first()).payload);assert.equal(raw.completedQty,600);assert.equal(raw.pendingReportQty,300);
 assert.equal((await api({action:'review',reportId:daily.report.id,approve:true,expectedVersion:1})).status,200);
 raw=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first()).payload);assert.equal(raw.completedQty,900);assert.equal(raw.pendingReportQty,0);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,3);
 const before=await records(c.db);assert.equal((await doActivate(c.call,p)).body.replayed,true);assert.deepEqual(await records(c.db),before);
 for(let n=0;n<5;n++)assert.equal(await (await c.bucket.get('SYNTHETIC-FILE-'+n)).text(),'SYNTHETIC-CONTENT');
}));
test('large capture uses all rows beyond the old 2500 atomic budget, no truncation or historical labor reads',()=>fixture(async c=>{
 const payload=JSON.stringify({synthetic:true,padding:'x'.repeat(1024)});await c.db.batch(Array.from({length:6000},(_,i)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_history_import','SYNTHETIC-LARGE-'+i,payload,'SYNTHETIC','SYNTHETIC')));
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{assert.doesNotMatch(sql,/labor_hours|production_legacy_basis|production_legacy_month/);return target.prepare(sql);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const p=await c.rawCall(action(),{db});assert.equal(p.status,200,JSON.stringify(p));assert.equal(p.body.records,6002);assert.ok(p.body.bytes>4*1024*1024);
 assert.equal((await c.rawCall(action({action:'activate',expectedRevision:p.body.revision,acknowledge:true}),{db})).status,200);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_quantity_source'").first()).n,6002);assert.equal(qaQuantityLimits.records,10000);
}));
test('oversized raw row aborts preparation with no partial staging or policy',()=>fixture(async c=>{
 await c.put('production_history_import','SYNTHETIC-OVERSIZE',{padding:'x'.repeat(qaQuantityLimits.rowBytes)});const before=await records(c.db);assert.equal((await c.call(path,action())).status,409);assert.deepEqual(await records(c.db),before);
}));
test('concurrent preparation/activation and injected transaction failure leave one intact snapshot',()=>fixture(async c=>{
 const results=await Promise.all([c.call(path,action()),c.call(path,action({requestIdempotency:'SYNTHETIC-OTHER-NONCE'}))]);assert.equal(results.filter(r=>r.status===200).length,1);const p=results[0].status===200?results[0]:results[1];const winningNonce=results[0].status===200?nonce:'SYNTHETIC-OTHER-NONCE';
 const before=await records(c.db);const db=new Proxy(c.db,{get(target,key){if(key==='batch')return statements=>target.batch([...statements,target.prepare("INSERT INTO app_records VALUES('SYNTHETIC',NULL,'{}','SYNTHETIC','SYNTHETIC')")]);const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const body=action({action:'activate',requestIdempotency:winningNonce,expectedRevision:p.body.revision,acknowledge:true});assert.equal((await c.rawCall(body,{db})).status,409);assert.deepEqual(await records(c.db),before);
 const activated=await Promise.all([c.rawCall(body),c.rawCall(body)]);assert.ok(activated.some(r=>r.status===200));assert.equal((await c.rawCall(body)).body.replayed,true);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_quantity_source'").first()).n,2);
}));
test('raw row count and nested report count are enforced without truncating an import batch',()=>fixture(async c=>{
 await c.put('production_history_import','SYNTHETIC-MANY-REPORTS',{reports:Array.from({length:10001},(_,i)=>({id:'SYNTHETIC-'+i}))});let before=await records(c.db);assert.equal((await c.call(path,action())).status,409);assert.deepEqual(await records(c.db),before);
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_history_import'").run();
 await c.db.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<10001) INSERT INTO app_records SELECT 'production_history_import','SYNTHETIC-COUNT-'||i,'{}','SYNTHETIC','SYNTHETIC' FROM n").run();
 before=await records(c.db);assert.equal((await c.call(path,action())).status,409);assert.deepEqual(await records(c.db),before);
}));
test('the original request size ceiling and source binding stay enforced on replay',()=>fixture(async c=>{
 assert.equal((await c.call(path,action({padding:'x'.repeat(1024)}))).status,413);
 const p=await c.call(path,action());assert.equal((await doActivate(c.call,p)).status,200);
 assert.equal((await c.rawCall(action({action:'activate',expectedRevision:p.body.revision,acknowledge:true}),{context:{...context,metadata:{...context.metadata,snapshotId:'b'.repeat(64)}}})).status,409);
 const before=await records(c.db);await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();const broken=await records(c.db);assert.equal((await doActivate(c.call,p)).status,409);assert.equal((await c.call(path)).status,409);assert.deepEqual(await records(c.db),broken);assert.ok(before.length>broken.length);
}));
test('total raw byte budget is enforced even when each row and record count are within bounds',()=>fixture(async c=>{
 await c.db.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<80) INSERT INTO app_records SELECT 'production_history_import','SYNTHETIC-BYTES-'||i,json_object('padding',replace(hex(zeroblob(225000)),'0','x')),'SYNTHETIC','SYNTHETIC' FROM n").run();
 const query="SELECT count(*) n,sum(length(CAST(payload AS BLOB))) bytes,max(length(CAST(payload AS BLOB))) rowBytes FROM app_records WHERE entity='production_history_import'";
 const before=await c.db.prepare(query).first();assert.ok(before.bytes>qaQuantityLimits.bytes);assert.ok(before.rowBytes<qaQuantityLimits.rowBytes);assert.ok(before.n<qaQuantityLimits.records);
 assert.equal((await c.call(path,action())).status,409);assert.deepEqual(await c.db.prepare(query).first(),before);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity IN ('qa_quantity_activation_operation','qa_quantity_prepared_source','production_reporting_activation','production_quantity_source','production_reporting_policy')").first()).n,0);
}));

test('prepare replay after activation verifies committed policy and frozen source before returning active',async()=>{
 for(const entity of ['production_reporting_policy','production_reporting_activation','production_quantity_source'])await fixture(async c=>{
  const prepared=await c.call(path,action());assert.equal(prepared.status,200);
  assert.equal((await doActivate(c.call,prepared)).status,200);
  await c.db.prepare('DELETE FROM app_records WHERE entity=?').bind(entity).run();
  const broken=await records(c.db),result=await c.call(path,action());
  assert.equal(result.status,409,`${entity}: prepare must not claim active for an incomplete activation`);
  assert.deepEqual(await records(c.db),broken,'replay must not recreate or change any records');
 });
});

test('valid prepare replay after activation remains read-only and does not recapture new output',()=>fixture(async c=>{
 const prepared=await c.call(path,action());assert.equal((await doActivate(c.call,prepared)).status,200);
 const before=await records(c.db),result=await c.call(path,action());
 assert.equal(result.status,200);assert.equal(result.body.state,'active');assert.equal(result.body.replayed,true);
 assert.deepEqual(await records(c.db),before);
}));
