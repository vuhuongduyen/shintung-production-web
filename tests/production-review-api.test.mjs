import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {siteApi} from '../worker/site-api.mjs';import {tokenHash} from '../worker/password-auth.mjs';import {reviewSnapshot} from '../lib/production-review-selection.mjs';import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {order,reports} from './fixtures/report-review-data.mjs';
test('isolated API: stale review rejects before confirmation; per-report audit and final-stage warehouse semantics',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'report-review-api-')));try{await migrate(c.db);const at='2026-10-28T00:00:00Z',token='a'.repeat(64),put=(e,k,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(e,k,JSON.stringify(p),'TEST',at).run();
 await put('users','TEST',{login:'TEST',active:true,role:'ADMIN'});await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,?,?)').bind('TEST','synthetic','synthetic',1,1,at).run();await c.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),'TEST',1,Date.now()+3600000,at).run();await put('in_transit',order.id,{...order,inTransitQty:200,lsxOpenedAt:"2026-10-24",status:'Đang sản xuất'});
 for(const r of reports)await put('production_report',r.id,{...r,manualHours:true});
 let requestDb=c.db;
 const call=(path,body,cookie=true)=>siteApi(new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{origin:'http://localhost','content-type':'application/json',...(cookie?{cookie:`__Host-onspa_session=${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:requestDb,FILES:c.bucket});
 const read=async()=>{const response=await call('/api/production-workflow');assert.equal(response.status,200);return response.json();};
 const initial=await read();assert.equal(initial.reports.length,4,JSON.stringify(initial.progressOrders));const currentOrder=initial.progressOrders.find(o=>o.id===order.id),report=initial.reports.find(r=>r.id===reports[0].id),body={action:'review',reportId:report.id,approve:true,expectedVersion:0,expectedReview:reviewSnapshot(currentOrder,report)};
 assert.equal((await call('/api/production-report',body,false)).status,401);
 // A warning can change without incrementing the report version or altering hours.
 for(const warning of [{estimatedStaffing:true},{unallocatedHours:0.5}]){
  await put('production_report',report.id,{...reports[0],manualHours:true,...warning});
  const rejected=await call('/api/production-report',body);assert.equal(rejected.status,409,JSON.stringify(await rejected.json()));
  const unchanged=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first()).payload);
  assert.equal(unchanged.version,0);assert.equal(unchanged.reviewStatus,'Chờ kiểm tra');assert.equal(unchanged.reviewedAt,undefined);
 }
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity IN ('warehouse_in','production_event')").first()).n,0);
 await put('production_report',report.id,{...reports[0],manualHours:true,hours:{...reports[0].hours,total:2}});
 const stale=await call('/api/production-report',body);assert.equal(stale.status,409,JSON.stringify(await stale.json()));assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 const refreshed=await read();
 const focused=await readProductionWorkflow(c.db,{login:'TEST',isAdmin:true},[],{reviewReportId:reports[0].id});
 assert.equal(reviewSnapshot(focused.progressOrders.find(o=>o.id===order.id),focused.reports.find(r=>r.id===reports[0].id)),reviewSnapshot(refreshed.progressOrders.find(o=>o.id===order.id),refreshed.reports.find(r=>r.id===reports[0].id)));
 for(const key of ['events','employees','payrollEmployees','actualSchedules','approvedSchedules'])assert.deepEqual(focused[key],[],key+' not needed for confirmation');
 const reads=new Map();
 requestDb=new Proxy(c.db,{get(db,key){if(key!=='prepare'){const value=db[key];return typeof value==='function'?value.bind(db):value;}return sql=>{const wrap=(statement,args=[])=>new Proxy(statement,{get(target,method){if(method==='bind')return (...values)=>wrap(target.bind(...values),values);if(method==='all')return async()=>{const key=JSON.stringify([sql,args]);reads.set(key,(reads.get(key)||0)+1);return target.all();};const value=target[method];return typeof value==='function'?value.bind(target):value;}});return wrap(db.prepare(sql));};}});
 for(const id of [reports[0].id,reports[3].id]){reads.clear();const r=refreshed.reports.find(r=>r.id===id);const response=await call('/api/production-report',{...body,reportId:id,expectedReview:reviewSnapshot(refreshed.progressOrders.find(o=>o.id===order.id),r)});assert.equal(response.status,200,JSON.stringify(await response.json()));
 for(const [key,count] of reads)if(key.includes('ORDER BY entity,record_key')&&(key.includes('production_report')||key.includes('production_event')))assert.equal(count,1,'read each shared page once');
 assert.ok([...reads.keys()].some(key=>key.includes('ORDER BY entity,record_key')&&key.includes('production_report')));
 }requestDb=c.db;
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,1);const final=await read();assert.equal(final.reports.filter(r=>r.reviewStatus==='Đã xác nhận').length,2);assert.equal(final.reports.filter(r=>r.reviewStatus==='Chờ kiểm tra').length,2);assert.equal((await call('/api/production-report',body)).status,409);
 const remaining=final.reports.find(r=>r.id===reports[1].id);const rawOrder=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(order.id).first()).payload);
 requestDb={prepare:(...args)=>c.db.prepare(...args),batch:async statements=>{await put('in_transit',order.id,{...rawOrder,planEnd:'2026-10-20'});return c.db.batch(statements);}};
 const raced=await call('/api/production-report',{...body,reportId:remaining.id,expectedReview:reviewSnapshot(final.progressOrders.find(o=>o.id===order.id),remaining)});assert.equal(raced.status,409);requestDb=c.db;
 assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(remaining.id).first()).payload).reviewStatus,'Chờ kiểm tra');
 await put('users','TEST',{login:'TEST',active:true,role:'USER'});assert.equal((await call('/api/production-report',{...body,reportId:reports[1].id})).status,403);
 }finally{await c.close();}
});
