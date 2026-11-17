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
