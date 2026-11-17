import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {readTransitSummary,transitSummaryEntities} from '../scripts/local/transit-summary-read.mjs';
import {transitProductionPayload} from '../scripts/local/transit-production-read.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
import {getTransit} from '../scripts/local/in-transit.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {records} from '../scripts/local/database.mjs';
test('combined summary is identical to all entity readers, with fewer round trips and no stored changes',()=>dailyFixture(async c=>{
 const id=c.order.id;
 await c.put('production_report','APPROVED',{id:'APPROVED',transitId:id,kind:'completion',reportedQuantity:20,approvedQuantity:20,reviewStatus:'Đã xác nhận',legacyEarnedBasis:{version:1}});
 await c.put('production_event','START',{id:'START',sourceId:id,kind:'start',effectiveAt:'2026-11-02T08:00:00+07:00',count:1,employees:['SYNTHETIC']});
 await c.put('production_history_import','IMPORT',{reports:[{id:'PENDING',transitId:id,kind:'completion',reportedQuantity:5,reviewStatus:'Chờ kiểm tra',voided:false,version:2,hours:{details:'x'.repeat(600000)}}]});
 const before=await records(c.db),old=observeReadDatabase(c.db),expected=new Map();
 for(const entity of transitSummaryEntities){const expression=transitProductionPayload(entity);expected.set(entity,(await readRecordPages(old.database,{where:'entity=?',args:[entity],payloadExpression:expression})).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||a.record_key.localeCompare(b.record_key)));}
 const measured=observeReadDatabase(c.db),actual=await readTransitSummary(measured.database);
 assert.deepEqual(actual,expected);assert.equal(measured.summary().calls,2);assert.ok(old.summary().calls>=8);
 const combined=await getTransit(c.db,{},[],{includeHistory:false,includeProductionSummary:true}),individual=await getTransit(c.db,{},[],{includeHistory:false});
 assert.deepEqual(combined.rows,individual.rows);assert.deepEqual(combined.history,individual.history);assert.deepEqual(await records(c.db),before);
}));
