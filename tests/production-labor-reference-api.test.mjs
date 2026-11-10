import {siteApi} from '../worker/site-api.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';import {records} from '../scripts/local/database.mjs';
for(const completion of ['2026-10-25','2026-11-05'])test(`workflow GET exposes dated comparison on ${completion} without backfilling records`,()=>dailyFixture(async c=>{
 const sku=c.order.sku;await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,version:1,laborHour:.016,updatedAt:'2026-10-16T03:00:00Z'}),sku).run();
 await c.put('production_report','SYNTHETIC-OLD',{id:'SYNTHETIC-OLD',transitId:c.order.id,kind:'completion',line:'A',sku,reviewStatus:'Đã xác nhận',reportedQuantity:100,approvedQuantity:100,completedAt:completion+'T03:00:00Z',hours:{hc:3,ot:1,total:4}});
 const call=await reviewer(c),before=await records(c.db),r=await call('/api/production-workflow');assert.equal(r.status,200,JSON.stringify(r.body));const report=r.body.reports.find(r=>r.id==='SYNTHETIC-OLD');assert.equal(report.laborReference.basis.value,.016);assert.equal(report.laborReference.basis.validFrom,'2026-10-16');assert.equal(report.laborReference.frozen,false);assert.deepEqual(report.hours,{hc:3,ot:1,total:4});assert.equal(report.rateBasis,undefined);assert.deepEqual(await records(c.db),before);
}));
test('standards API preserves outer update metadata and distinguishes valid zero from missing',()=>dailyFixture(async c=>{
 const sku=c.order.sku;
 for(const laborHour of [.012,0,null]){
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,version:1,laborHour}),sku).run();
  const call=c.call||(c.call=await reviewer(c)),before=await records(c.db),menu=await call('/api/records?entity=labor_hours'),standards=await call('/api/production-standards');
  assert.equal(menu.status,200);assert.equal(standards.status,200);
  const read=response=>response.body.records.find(r=>r.key===sku).payload.laborHour;
  assert.equal(read(menu),laborHour);assert.equal(read(standards),laborHour);assert.deepEqual(await records(c.db),before);
 }
}));

test('workflow omission policy matches exact business keys and never writes reports',()=>dailyFixture(async c=>{
 await c.put('production_report','SYNTHETIC-MISSING',{id:'SYNTHETIC-MISSING',transitId:c.order.id,kind:'completion',line:'A',sku:c.order.sku,reviewStatus:'Đã xác nhận',reportedQuantity:7,approvedQuantity:7,completedAt:'2026-10-02T03:00:00Z',hours:{hc:3,ot:1,total:4}});
 const policy=JSON.stringify([{orderCode:c.order.lsxCode,sku:c.order.sku,date:'2026-10-02'}]);
 let config=policy;
 const call=await reviewer(c,(request,env)=>siteApi(request,{...env,LABOR_RATE_OMISSIONS_JSON:config}));
 const before=await records(c.db),result=await call('/api/production-workflow');assert.equal(result.status,200);
 const report=result.body.reports.find(r=>r.id==='SYNTHETIC-MISSING');
 assert.equal(report.laborRateOmission?.kind,'explicit-missing-rate-omission-v1');assert.deepEqual(report.hours,{hc:3,ot:1,total:4});assert.equal(report.approvedQuantity,7);assert.equal(report.rateBasis,undefined);
 config='{invalid';const invalid=await call('/api/production-workflow');assert.equal(invalid.body.reports.find(r=>r.id==='SYNTHETIC-MISSING').laborRateOmission,undefined);
 assert.deepEqual(await records(c.db),before);
}));
