import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {productionOrderPage} from '../scripts/local/production-order-pages.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {records} from '../scripts/local/database.mjs';
const admin={login:'SYNTHETIC',isAdmin:true};
test('synced labels on incomplete plans do not cause production-summary scans or change visible orders',()=>dailyFixture(async c=>{
 const before=await productionOrderPage(c.db,admin,new URLSearchParams());
 const invalid=[{lsxCode:''},{lsxQty:0},{lsxQty:'0'},{lsxQty:null},{lsxQty:''},{lsxOpenedAt:''}];
 for(let i=0;i<240;i++)await c.put('in_transit','INCOMPLETE-'+i,{...c.order,id:'INCOMPLETE-'+i,lsxCode:'INCOMPLETE-'+i,...invalid[i%invalid.length]});
 const stored=await records(c.db),measured=observeReadDatabase(c.db);
 const current=await productionOrderPage(measured.database,admin,new URLSearchParams());
 assert.deepEqual(current,before);assert.equal(measured.summary().in_transitCalls,1);assert.deepEqual(await records(c.db),stored);
}));
test('legacy column fallbacks and nonstandard positive quantities remain eligible',()=>dailyFixture(async c=>{
 const columns=[];columns[5]='COLUMN-ORDER';columns[14]=25;columns[15]='01/11/2026';columns[29]='ĐÃ ĐỒNG BỘ';
 await c.put('in_transit','COLUMN-ORDER',{...c.order,id:'COLUMN-ORDER',lsxCode:'',lsxQty:null,lsxOpenedAt:'',syncStatus:'',columns});
 await c.put('in_transit','FALSY-COLUMN',{...c.order,id:'FALSY-COLUMN',lsxCode:0,lsxQty:25,lsxOpenedAt:0,columns});
 await c.put('in_transit','FORMATTED',{...c.order,id:'FORMATTED',lsxCode:'FORMATTED',lsxQty:'1,000',lsxOpenedAt:'01/11/2026'});
 const stored=await records(c.db),current=await productionOrderPage(c.db,admin,new URLSearchParams());
 for(const id of ['COLUMN-ORDER','FALSY-COLUMN','FORMATTED'])assert.ok(current.orders.some(o=>o.id===id),id);
 assert.deepEqual(await records(c.db),stored);
}));

// A real list may contain mostly finished LSX; skipping incomplete plans alone
// does not reduce those reads. Keep their shared status calculation intact.
test('completed candidates are summarized in bounded windows without hiding pending or legacy orders',()=>dailyFixture(async c=>{
 const baseline=await productionOrderPage(c.db,admin,new URLSearchParams());
 for(let i=0;i<501;i++){
  const id='FINISHED-'+String(i).padStart(3,'0');
  await c.put('in_transit',id,{...c.order,id,lsxCode:id,completedQty:1000,actualCompletedAt:'2026-11-02'});
 }
 await c.put('in_transit','PENDING-FINAL',{...c.order,id:'PENDING-FINAL',lsxCode:'PENDING-FINAL'});
 await c.put('production_report','PENDING-FINAL-REPORT',{id:'PENDING-FINAL-REPORT',transitId:'PENDING-FINAL',kind:'completion',quantityOnly:true,reportingModel:'daily-finished-v1',reportedQuantity:1000,reviewStatus:'Chờ kiểm tra',productionDate:'2026-11-02'});
 const stored=await records(c.db),measured=observeReadDatabase(c.db);
 const current=await productionOrderPage(measured.database,admin,new URLSearchParams());
 assert.equal(current.total,baseline.total+1);
 for(const row of baseline.orders)assert.deepEqual(current.orders.find(r=>r.id===row.id),row);
 const pending=current.orders.find(r=>r.id==='PENDING-FINAL');
 assert.equal(pending.serverSummary.badge.tone,'review');assert.equal(pending.serverSummary.totals.pending,1000);
 assert.equal(measured.summary().in_transitCalls,2);
 const completed=await productionOrderPage(c.db,admin,new URLSearchParams('field=Trạng thái&status=completed&page=51'));
 assert.equal(completed.total,501);assert.equal(completed.orders.length,1);assert.equal(completed.orders[0].id,'FINISHED-500');
 assert.deepEqual(await records(c.db),stored);
}));
