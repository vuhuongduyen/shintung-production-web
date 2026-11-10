import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {records} from '../scripts/local/database.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {previewFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';
import {importLaborReferenceSnapshot} from '../scripts/local/production-labor-reference-import.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
const hostname='onspa-thu-nghiem.shintung-vn-4458.chatgpt.site';
const actor={isAdmin:true,login:'SYNTHETIC-REVIEWER',grants:[]};
const entity='production_labor_reference_snapshot',path='/api/labor-reference-snapshot-import';
const source=async db=>(await records(db)).filter(r=>r.entity!==entity);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
async function setup(c){
 const raw={id:'SYNTHETIC-LEGACY',transitId:c.order.id,kind:'completion',sku:c.order.sku,orderSnapshot:{id:c.order.id,sku:c.order.sku,line:'A'},line:'A',version:1,stageName:'FINAL',reviewStatus:'Đã xác nhận',approvedQuantity:100,reportedQuantity:100,completedAt:'2026-11-02T03:00:00Z',hours:{hc:3,ot:1,total:4}};
 await c.put('production_report',raw.id,raw);
 const call=await reviewer(c,(req,env)=>{const url=new URL(req.url);url.hostname=hostname;const headers=new Headers(req.headers);if(headers.has('origin'))headers.set('origin',url.origin);return siteApi(new Request(url, {...{method:req.method,headers},...(req.method==='POST'?{body:req.body,duplex:'half'}:{})}),env);});
 const w=await call('/api/production-workflow');assert.equal(w.status,200);
 const menu=await call('/api/records?entity=labor_hours');
 const preview=await previewFixedLaborReferences({reports:w.body.reports,orders:w.body.orders,menu:siteLaborHours(menu.body.records),observedAt:'2026-11-10T00:00:00Z'});
 const body={action:'preview',manifest:preview.manifest,omissions:[]};
 const p=await call(path,body);assert.equal(p.status,200,JSON.stringify(p.body));
 return {raw,call,body,apply:{...body,action:'apply',confirmDigest:body.manifest.digest,expectedSourceRevision:p.body.sourceRevision}};
}
test('QA Admin preview is read-only; apply appends one audited registry; retry and configuration rollback preserve source',()=>dailyFixture(async c=>{
 const f=await setup(c),before=await source(c.db);
 assert.equal((await f.call(path,f.body)).status,200);assert.deepEqual(await source(c.db),before);
 assert.equal((await records(c.db)).filter(r=>r.entity===entity).length,0);
 const applied=await f.call(path,f.apply);assert.equal(applied.status,200);assert.equal(applied.body.status,'stored');assert.equal(applied.body.activated,false);
 assert.deepEqual(await source(c.db),before);
 const saved=(await records(c.db)).filter(r=>r.entity===entity);assert.equal(saved.length,1);assert.equal(saved[0].updated_by,actor.login);assert.deepEqual(JSON.parse(saved[0].payload),f.body.manifest);
 const retry=await f.call(path,f.apply);assert.equal(retry.body.status,'already-present');assert.deepEqual((await records(c.db)).filter(r=>r.entity===entity),saved);
 // No automatic activation. Switching only the read configuration on/off never mutates records.
 const {readLaborReferences}=await import('../scripts/local/production-labor-reference.mjs');
 const w=await f.call('/api/production-workflow'),baseline=await records(c.db);
 const pinned=await readLaborReferences(c.db,w.body,undefined,f.body.manifest.digest);assert.equal(pinned.reports.find(r=>r.id===f.raw.id).laborReference.frozen,true);
 const restored=await readLaborReferences(c.db,w.body);assert.equal(restored.reports.find(r=>r.id===f.raw.id).laborReference.frozen,false);assert.deepEqual(await records(c.db),baseline);
}));
test('source version change after preview refuses even when selected rate is unchanged',()=>dailyFixture(async c=>{
 const f=await setup(c);await c.db.prepare("UPDATE app_records SET updated_at=? WHERE entity='labor_hours'").bind('2026-11-10T01:00:00Z').run();
 const before=await records(c.db),r=await f.call(path,f.apply);assert.equal(r.status,409);assert.match(r.body.error,/Phiên bản nguồn/);assert.deepEqual(await records(c.db),before);
}));
test('changed snapshot identity or rates cannot import an old or forged manifest',()=>dailyFixture(async c=>{
 const f=await setup(c),forged=structuredClone(f.body);forged.manifest.entries[0].reference.unit=987;
 // Rehashing malicious input does not make it equivalent to server resolution.
 const {digest,...content}=forged.manifest;forged.manifest.digest=await recordRevision(JSON.stringify(canonical(content)));
 assert.equal((await f.call(path,forged)).status,409);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...f.raw,orderSnapshot:{...f.raw.orderSnapshot,sku:'DIFFERENT'}}),f.raw.id).run();
 const before=await records(c.db);assert.equal((await f.call(path,f.apply)).status,409);assert.deepEqual(await records(c.db),before);
}));
for(const mutation of ['update','insert','delete'])test(`atomic guard rejects concurrent source ${mutation} before write`,()=>dailyFixture(async c=>{
 const f=await setup(c);let changed=false;
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{
  if(mutation==='update')await c.db.prepare("UPDATE app_records SET updated_at='RACE' WHERE entity='labor_hours'").run();
  if(mutation==='insert')await c.put('labor_hours_history','SYNTHETIC-RACE',{sku:c.order.sku,value:.3});
  if(mutation==='delete')await c.db.prepare("DELETE FROM app_records WHERE entity='labor_hours'").run();
  changed=true;return target.batch(statements);
 };const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(importLaborReferenceSnapshot(db,f.apply,actor,{hostname}),/Giao dịch nhập không hoàn tất/);assert.equal(changed,true);assert.equal((await records(c.db)).filter(r=>r.entity===entity).length,0);
 assert.deepEqual(JSON.parse((await records(c.db)).find(r=>r.entity==='production_report'&&r.record_key===f.raw.id).payload),f.raw);
}));
test('D1 batch failure after INSERT rolls back registry and leaves every original record intact',()=>dailyFixture(async c=>{
 const f=await setup(c),before=await records(c.db);
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return statements=>target.batch([...statements,target.prepare("SELECT json('SYNTHETIC_FAILURE')")]);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(importLaborReferenceSnapshot(db,f.apply,actor,{hostname}),/Giao dịch/);assert.deepEqual(await records(c.db),before);
}));
test('same-key conflicting payload is never overwritten',()=>dailyFixture(async c=>{
 const f=await setup(c);await c.put(entity,f.body.manifest.digest,{kind:'SYNTHETIC-CONFLICT'});const before=await records(c.db);
 assert.equal((await f.call(path,f.apply)).status,409);assert.deepEqual(await records(c.db),before);
}));
test('no authentication, ordinary user, Line Admin, MAIN, foreign origin and missing confirmation cannot write',()=>dailyFixture(async c=>{
 const f=await setup(c),before=await records(c.db);
 for(const user of [null,{login:'NORMAL',isAdmin:false},{...actor,line:'A'},{...actor,authMode:'quick_line'}])await assert.rejects(importLaborReferenceSnapshot(c.db,f.apply,user,{hostname}),e=>e.status===403);
 for(const host of ['sanxuat.shintung-vn-4458.chatgpt.site','test.invalid',hostname+'.evil'])await assert.rejects(importLaborReferenceSnapshot(c.db,f.apply,actor,{hostname:host}),e=>e.status===403);
 assert.equal((await siteApi(new Request('https://'+hostname+path,{method:'POST',headers:{origin:'https://'+hostname,'content-type':'application/json'},body:JSON.stringify(f.apply)}),{DB:c.db,FILES:c.bucket})).status,401);
 const token='e'.repeat(64);
 for(const origin of ['https://evil.invalid',null]){const headers={cookie:'__Host-onspa_session='+token,'content-type':'application/json'};if(origin)headers.origin=origin;const r=await siteApi(new Request('https://'+hostname+path,{method:'POST',headers,body:JSON.stringify(f.apply)}),{DB:c.db,FILES:c.bucket});assert.equal(r.status,403);}
 assert.equal((await f.call(path,{...f.apply,confirmDigest:'wrong'})).status,400);
 assert.deepEqual(await records(c.db),before);
}));
test('many source versions use bounded JSON guards without SQL variable explosion',()=>dailyFixture(async c=>{
 for(let i=0;i<140;i++)await c.put('labor_hours_history','SYNTHETIC-HISTORY-'+i,{sku:'OTHER',value:i,revision:i,note:'x'.repeat(5000)});
 await c.put('production_history_archive','SYNTHETIC-LARGE',{note:'Tiếng Việt 😀'.repeat(60000)});
 const f=await setup(c);assert.equal((await f.call(path,f.apply)).status,200);
}));

test('changed large Unicode payload is rejected atomically even with preserved length and timestamps',()=>dailyFixture(async c=>{
 await c.put('production_history_archive','SYNTHETIC-LARGE',{note:'Tiếng Việt 😀'.repeat(60000)});
 const f=await setup(c);
 const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{await c.db.prepare("UPDATE app_records SET payload=replace(payload,'Tiếng','tiếng') WHERE entity='production_history_archive'").run();return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(importLaborReferenceSnapshot(db,f.apply,actor,{hostname}),/Giao dịch/);assert.equal((await records(c.db)).filter(r=>r.entity===entity).length,0);
}));
test('server session role is authoritative; request body cannot grant Admin permission',()=>dailyFixture(async c=>{
 const f=await setup(c);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='users' AND record_key=?").bind(JSON.stringify({login:actor.login,role:'USER',active:true}),actor.login).run();
 const before=await records(c.db),r=await f.call(path,{...f.apply,isAdmin:true,actor});assert.equal(r.status,403);assert.deepEqual(await records(c.db),before);
}));
