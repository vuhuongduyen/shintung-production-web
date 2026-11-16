import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {productionOrderScope,productionOrderPage} from '../scripts/local/production-order-pages.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
test('history scope excludes empty unrelated import envelopes before metadata pagination, retaining matching pending quantity',()=>dailyFixture(async c=>{
 for(let start=0;start<1050;start+=50)await c.db.batch(Array.from({length:50},(_,i)=>{const id='UNRELATED-'+(start+i);return c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_history_import',id,JSON.stringify({reports:[{id,transitId:id,kind:'completion',reportedQuantity:99,reviewStatus:'Chờ kiểm tra'}]}),'SYNTHETIC','2026-11-01');}));
 await c.put('production_history_import','MATCHED',{reports:[{id:'MATCHED-REPORT',transitId:c.order.id,kind:'completion',reportedQuantity:200,reviewStatus:'Chờ kiểm tra'}]});
 const scope=productionOrderScope(c.db,[c.order]),rows=await readRecordPages(scope,{where:'entity=?',args:['production_history_import']});assert.equal(rows.length,1,'unrelated empty report arrays must not consume transport/metadata pages');assert.equal(rows[0].record_key,'MATCHED');assert.equal(JSON.parse(rows[0].payload).reports[0].reportedQuantity,200);
 const result=await productionOrderPage(c.db,{isAdmin:true,login:'SYNTHETIC'},new URLSearchParams('field=LSX&query=SYNTHETIC-LSX'));assert.equal(result.total,1);assert.equal(result.totals.pending,200);assert.equal(result.orders[0].serverSummary.totals.pending,200);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_history_import'").first()).n,1051);
}));
