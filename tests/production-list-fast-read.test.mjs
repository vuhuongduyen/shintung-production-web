import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {productionOrderPage,productionOrderScope,readProductionPageCatalog} from '../scripts/local/production-order-pages.mjs';
import {getTransit} from '../scripts/local/in-transit.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {records} from '../scripts/local/database.mjs';
const admin={login:'SYNTHETIC',isAdmin:true};
test('order-only catalog retains live overrides, deleted and unusual identifiers without unrelated payloads',()=>dailyFixture(async c=>{
 for(const [key,code] of [['SYNTHETIC-SKU','SYNTHETIC-SKU'],['UNRELATED','UNRELATED'],['SYNTHETIC-OTHER','SYNTHETIC-OTHER'],['UNICODE','MÃ ĐẶC BIỆT']])await c.put('sku',key,{code,name:'Synthetic '+key,_deleted:key==='SYNTHETIC-SKU',history:'x'.repeat(1000)});
 const before=await records(c.db),all=await readProductionPageCatalog(c.db),scoped=await readProductionPageCatalog(c.db,{ordersOnly:true});
 assert.deepEqual(scoped.find(r=>r.key==='SYNTHETIC-SKU'),all.find(r=>r.key==='SYNTHETIC-SKU'));
 assert.ok(scoped.some(r=>r.key==='UNICODE'));assert.ok(!scoped.some(r=>r.key==='UNRELATED'));
 assert.deepEqual(await productionOrderPage(c.db,admin,new URLSearchParams(),scoped),await productionOrderPage(c.db,admin,new URLSearchParams(),all));
 await c.put('in_transit','COMPLEX',{...c.order,id:'COMPLEX',lsxCode:'COMPLEX',sku:'\tSYNTHETIC-OTHER\t'});
 const complex=await readProductionPageCatalog(c.db,{ordersOnly:true});assert.ok(complex.some(r=>r.key==='SYNTHETIC-OTHER'));
 await c.db.prepare("DELETE FROM app_records WHERE entity='in_transit' AND record_key='COMPLEX'").run();assert.deepEqual(await records(c.db),before);
}));
test('pending-only import scope preserves legacy totals and rows while discarding approved source copies before projection',()=>dailyFixture(async c=>{
 const imported=[];for(let i=0;i<1400;i++)imported.push({id:'IMPORT-'+i,transitId:c.order.id,line:'A',kind:'completion',reportedQuantity:1,approvedQuantity:i<1398?1:0,reviewStatus:i<1398?'Đã xác nhận':'Chờ kiểm tra',sourceSnapshot:{evidence:'x'.repeat(4096)},legacyEarnedBasis:{version:i%2+1}});
 for(let i=0;i<imported.length;i+=100)await c.put('production_history_import','HISTORY-'+i,{reports:imported.slice(i,i+100)});
 const before=await records(c.db),slow=observeReadDatabase(c.db),fast=observeReadDatabase(c.db);
 const options={includeHistory:false,includeProductionSummary:true,skipLeadtime:true};
 const old=await getTransit(productionOrderScope(slow.database,[c.order]),{},[],options);
 const current=await getTransit(productionOrderScope(fast.database,[c.order],{summary:true}),{},[],options);
 assert.deepEqual(current,old);assert.deepEqual(await records(c.db),before);
 const sql="SELECT payload FROM app_records WHERE entity='production_history_import'";
 const original=(await productionOrderScope(c.db,[c.order]).prepare(sql).all()).results;
 const compact=(await productionOrderScope(c.db,[c.order],{summary:true}).prepare(sql).all()).results;
 assert.equal(compact.flatMap(r=>JSON.parse(r.payload).reports).length,2);assert.ok(JSON.stringify(compact).length<JSON.stringify(original).length/100);
 console.log('synthetic history DB ms (original/filtered):',Math.round(slow.summary().dbMs),Math.round(fast.summary().dbMs));
}));
test('unsynchronized plans do not create summary windows; authorized rows/totals remain unchanged',()=>dailyFixture(async c=>{
 const before=await productionOrderPage(c.db,admin,new URLSearchParams());
 for(let i=0;i<220;i++)await c.put('in_transit','PLAN-'+i,{...c.order,id:'PLAN-'+i,lsxCode:'PLAN-'+i,syncStatus:['CHƯA ĐỒNG BỘ','CÓ THAY ĐỔI','LỖI ĐỒNG BỘ'][i%3]});
 const stored=await records(c.db),observation=observeReadDatabase(c.db),after=await productionOrderPage(observation.database,admin,new URLSearchParams());
 assert.deepEqual(after,before);assert.equal(observation.summary().in_transitCalls,1,'one directory window, not three unsynchronized windows');
 const line=await productionOrderPage(c.db,actor,new URLSearchParams(),()=>readProductionPageCatalog(c.db,{ordersOnly:true}));assert.ok(line.orders.every(o=>o.line==='A'));
 assert.deepEqual(await records(c.db),stored);
}));
test('directory keeps legacy column statuses and normalized synced spellings',()=>dailyFixture(async c=>{
 const columns=[];columns[29]='ĐÃ ĐỒNG BỘ';
 for(const [id,syncStatus] of [['COLUMN',''],['SPACES','  ĐÃ ĐỒNG BỘ  '],['LOWER','đã đồng bộ'],['ASCII','DA DONG BO']])await c.put('in_transit',id,{...c.order,id,lsxCode:id,syncStatus,columns});
 const result=await productionOrderPage(c.db,admin,new URLSearchParams());
 for(const id of ['COLUMN','SPACES','LOWER','ASCII'])assert.ok(result.orders.some(o=>o.id===id),id);
}));
