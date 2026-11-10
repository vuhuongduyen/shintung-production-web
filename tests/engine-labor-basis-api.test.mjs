import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {saveEngine} from '../scripts/local/engine.mjs';
const actor={login:'SYNTHETIC-PLANNER'};
const body=(sku,week)=>({payload:{week,rows:[{id:'ROW',sku,suggested:1000}],metrics:[['ROW',{standardHours:99,laborBasis:{value:99}}]]}});
async function setup(c,value){await c.put('sku',c.order.sku,{code:c.order.sku,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku:c.order.sku,version:1,laborHour:value,updatedAt:'2000-01-01T00:00:00Z'}),c.order.sku).run();}
const read=async(db,key)=>JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_engine' AND record_key=?").bind(key).first()).payload);
for(const week of ['2026-11-09','2027-01-04'])test(`new Engine ${week} captures current dated menu rate and reload preserves it after master changes`,()=>dailyFixture(async c=>{
 await setup(c,.016);const first=await saveEngine(c.db,body(c.order.sku,week),actor),metric=first.payload.metrics[0][1];assert.equal(metric.standardHours,.016);assert.equal(metric.laborBasis.value,.016);assert.equal(metric.laborBasis.validFrom,'2000-01-01');assert.equal(metric.laborBasisStatus,'resolved');const stored=await read(c.db,first.key);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku:c.order.sku,version:2,laborHour:.025,updatedAt:'2001-01-01T00:00:00Z'}),c.order.sku).run();
 const second=await saveEngine(c.db,body(c.order.sku,week),actor);assert.equal(second.payload.metrics[0][1].standardHours,.025);assert.deepEqual(await read(c.db,first.key),stored);assert.notEqual(second.key,first.key);
}));
for(const value of [0,null])test(`Engine stores ${value===0?'valid zero':'missing evidence'} without trusting client values`,()=>dailyFixture(async c=>{
 await setup(c,value);const result=await saveEngine(c.db,body(c.order.sku,'2026-11-09'),actor);assert.equal(result.payload.metrics[0][1].standardHours,value);assert.equal(result.payload.metrics[0][1].laborBasisStatus,value===0?'resolved':'missing');
}));
test('future-only source is not applied early and source race creates no Engine',()=>dailyFixture(async c=>{
 await setup(c,.016);await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku:c.order.sku,laborHour:.03,version:1,updatedAt:'2999-01-01T00:00:00Z'}),c.order.sku).run();const result=await saveEngine(c.db,body(c.order.sku,'2027-01-04'),actor);assert.equal(result.payload.metrics[0][1].standardHours,null);
 const before=(await c.db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_engine','production_engine_snapshot','admin_audit') ORDER BY entity,record_key").all()).results;
 const race={prepare:sql=>c.db.prepare(sql),batch:async statements=>{await c.db.prepare("UPDATE app_records SET updated_at='changed' WHERE entity='labor_hours'").run();return c.db.batch(statements);}};
 await assert.rejects(()=>saveEngine(race,body(c.order.sku,'2027-01-04'),actor),/Giờ công vừa thay đổi/);
 assert.deepEqual((await c.db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_engine','production_engine_snapshot','admin_audit') ORDER BY entity,record_key").all()).results,before);
}));
