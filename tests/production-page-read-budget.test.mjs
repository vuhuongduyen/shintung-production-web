import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {productionOrderPage} from '../scripts/local/production-order-pages.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';

test('126 orders keep exact page/totals with a bounded read budget and unchanged stored records',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='in_transit'").run();
 const imports=[];
 for(let i=0;i<126;i++){
  const id='BUDGET-'+String(i).padStart(3,'0');
  await c.put('in_transit',id,{...c.order,id,lsxCode:id,planId:id,line:i<101?'A':'B',lsxQty:100,week:'2026-11-02'});
  imports.push({id:'REPORT-'+i,transitId:id,lsxCode:id,kind:'completion',line:i<101?'A':'B',reportedQuantity:20,approvedQuantity:20,reviewStatus:'Đã xác nhận'});
 }
 for(const report of imports)await c.put('production_report',report.id,report);
 await c.put('production_history_import','UNRELATED',{reports:[{id:'UNRELATED-REPORT',transitId:'UNRELATED',kind:'completion',reportedQuantity:99999}]});
 const before=(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const observation=observeReadDatabase(c.db);
 const result=await productionOrderPage(observation.database,{login:'ADMIN',isAdmin:true},new URLSearchParams('page=11'));
 assert.equal(result.total,126);assert.equal(result.orders.length,10);assert.equal(result.orders[0].id,'BUDGET-100');assert.equal(result.totals.approved,2520);assert.equal(result.totals.quantity,12600);
 const stats=observation.summary();console.log('126-order list DB calls:',stats.calls);assert.ok(stats.calls<=25,`read budget exceeded: ${stats.calls}`);
 const line=await productionOrderPage(c.db,{login:'LINE_A',isAdmin:true,line:'A'},new URLSearchParams('page=99'));
 assert.equal(line.total,101);assert.equal(line.page,11);assert.equal(line.orders.length,1);assert.equal(line.orders[0].id,'BUDGET-100');assert.equal(line.totals.approved,2020);
 assert.deepEqual((await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,before);
}));
