import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';import {records} from '../scripts/local/database.mjs';
test('workflow GET exposes read-only dated comparison for old confirmed output and never backfills records',()=>dailyFixture(async c=>{
 const sku=c.order.sku;await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,version:1,laborHour:.016,updatedAt:'2026-10-16T03:00:00Z'}),sku).run();
 await c.put('production_report','SYNTHETIC-OLD',{id:'SYNTHETIC-OLD',transitId:c.order.id,kind:'completion',line:'A',sku,reviewStatus:'Đã xác nhận',reportedQuantity:100,approvedQuantity:100,completedAt:'2026-11-05T03:00:00Z',hours:{hc:3,ot:1,total:4}});
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
