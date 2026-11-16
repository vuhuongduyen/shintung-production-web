import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {siteApi} from '../worker/site-api.mjs';
test('actual Quick Line login can read its quantity pages and detail, cannot cross Line, export or write through the read route',()=>dailyFixture(async c=>{
 const origin='https://test.invalid',env={DB:c.db,FILES:c.bucket};
 const call=(path,cookie='',body)=>siteApi(new Request(origin+path,{method:body?'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 await c.put('in_transit','SYNTHETIC-B',{...c.order,id:'SYNTHETIC-B',lsxCode:'SYNTHETIC-B',line:'B'});
 const sessions={};for(const line of ['A','B']){
  await c.put('users','LINE_'+line,{login:'LINE_'+line,line,authMode:'quick_line',active:true,role:'USER'});
  await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,?,?)').bind('LINE_'+line,'QUICK_LINE','',0,1,'SYNTHETIC').run();
  const r=await call('/api/auth/line-login','',{line});assert.equal(r.status,200);sessions[line]=r.headers.get('set-cookie').split(';')[0];
 }
 assert.equal((await call('/api/production-order-pages')).status,401);
 for(const line of ['A','B']){
  const cookie=sessions[line],id=line==='A'?c.order.id:'SYNTHETIC-B',foreign=line==='A'?'SYNTHETIC-B':c.order.id,other=line==='A'?'B':'A';
  const response=await call('/api/production-order-pages?page=1&sort=due&line='+line,cookie);assert.equal(response.status,200);const page=await response.json();assert.equal(page.supported,true);assert.equal(page.rights.work,true);assert.equal(page.rights.export,false);assert.ok(page.orders.length>0);assert.ok(page.orders.every(o=>o.line===line));
  const all=await(await call('/api/production-order-pages?line=all',cookie)).json();assert.ok(all.orders.every(o=>o.line===line));
  assert.equal((await call('/api/production-order-pages?line='+other,cookie)).status,403);
  assert.equal((await call('/api/production-order-pages?orderId='+id,cookie)).status,200);
  assert.equal((await call('/api/production-order-pages?orderId='+foreign,cookie)).status,403);
  assert.equal((await call('/api/production-order-pages?format=csv',cookie)).status,403);
  assert.equal((await call('/api/production-order-pages',cookie,{action:'daily-output',orderId:id,quantity:200})).status,403);
  assert.equal((await call('/api/records?entity=users',cookie)).status,403);
 }
 const body=c.body();const saved=await call('/api/production-workflow',sessions.A,body);assert.equal(saved.status,200);const data=await saved.json();assert.equal(data.report.reportedQuantity,200);
 const retry=await(await call('/api/production-workflow',sessions.A,body)).json();assert.equal(retry.report.id,data.report.id);
 assert.equal((await call('/api/production-workflow',sessions.B,c.body())).status,403);
}));
