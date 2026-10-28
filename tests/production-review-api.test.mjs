import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {siteApi} from '../worker/site-api.mjs';import {tokenHash} from '../worker/password-auth.mjs';import {reviewSnapshot} from '../lib/production-review-selection.mjs';import {order,reports} from './fixtures/report-review-data.mjs';
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
 const refreshed=await read();for(const id of [reports[0].id,reports[3].id]){const r=refreshed.reports.find(r=>r.id===id);const response=await call('/api/production-report',{...body,reportId:id,expectedReview:reviewSnapshot(refreshed.progressOrders.find(o=>o.id===order.id),r)});assert.equal(response.status,200,JSON.stringify(await response.json()));}
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,1);const final=await read();assert.equal(final.reports.filter(r=>r.reviewStatus==='Đã xác nhận').length,2);assert.equal(final.reports.filter(r=>r.reviewStatus==='Chờ kiểm tra').length,2);assert.equal((await call('/api/production-report',body)).status,409);
 const remaining=final.reports.find(r=>r.id===reports[1].id);const rawOrder=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(order.id).first()).payload);
 requestDb={prepare:(...args)=>c.db.prepare(...args),batch:async statements=>{await put('in_transit',order.id,{...rawOrder,planEnd:'2026-10-20'});return c.db.batch(statements);}};
 const raced=await call('/api/production-report',{...body,reportId:remaining.id,expectedReview:reviewSnapshot(final.progressOrders.find(o=>o.id===order.id),remaining)});assert.equal(raced.status,409);requestDb=c.db;
 assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(remaining.id).first()).payload).reviewStatus,'Chờ kiểm tra');
 await put('users','TEST',{login:'TEST',active:true,role:'USER'});assert.equal((await call('/api/production-report',{...body,reportId:reports[1].id})).status,403);
 }finally{await c.close();}
});
