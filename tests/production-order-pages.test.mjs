import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor as lineActor} from './helpers/daily-output-fixture.mjs';
import {productionOrderPage,productionPageQuery,readProductionPageCatalog} from '../scripts/local/production-order-pages.mjs';
import {records} from '../scripts/local/database.mjs';
const admin={login:'SYNTHETIC-ADMIN',isAdmin:true};
test('server pages filter before returning rows and totals cover every matching order, not the current page',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='in_transit'").run();
 for(let i=0;i<31;i++){const id='TEST-'+String(i).padStart(3,'0');await c.put('in_transit',id,{...c.order,id,lsxCode:id,line:i===30?'B':'A',lsxQty:100,planEnd:'2026-12-01',week:'2026-11-02',completedQty:i<2?100:0,actualCompletedAt:i<2?'2026-11-02':''});}
 const before=await records(c.db),q=new URLSearchParams('line=A&field=Line&page=2');
 const result=await productionOrderPage(c.db,admin,q);assert.equal(result.total,30);assert.equal(result.orders.length,10);assert.equal(result.page,2);assert.equal(result.totals.quantity,3000);assert.equal(result.totals.approved,200);assert.ok(result.orders.every(o=>o.line==='A'));assert.equal(result.orders[0].id,'TEST-010');
 const far=await productionOrderPage(c.db,admin,new URLSearchParams('line=A&field=Line&page=99'));assert.equal(far.page,3);assert.equal(far.orders.length,10);assert.equal(far.orders[0].id,'TEST-020');
 const active=await productionOrderPage(c.db,admin,new URLSearchParams('line=A'));assert.equal(active.total,28);assert.ok(active.orders.every(o=>o.serverSummary.totals.approved<100));
 assert.deepEqual(await records(c.db),before);
}));
test('approved legacy plus daily, real pending and reserved correction stay distinct; bulky source copies never leave the list',()=>dailyFixture(async c=>{
 const bulk='x'.repeat(600000);const old={id:'OLD',transitId:c.order.id,kind:'completion',line:'A',reportedQuantity:400,approvedQuantity:400,reviewStatus:'Đã xác nhận',sourceSnapshot:{bulk}};
 const daily={...old,id:'DAILY',quantityOnly:true,reportingModel:'daily-finished-v1',legacyCompletedBaseline:400,productionDate:'2026-11-02',reportedQuantity:300,approvedQuantity:300,pendingQuantityReservation:100};
 const pending={...old,id:'PENDING',reportedQuantity:200,approvedQuantity:0,reviewStatus:'Chờ kiểm tra'};
 for(const r of [old,daily,pending])await c.put('production_report',r.id,r);
 const result=await productionOrderPage(c.db,admin,new URLSearchParams('field=LSX&query=SYNTHETIC-LSX'));
 assert.equal(result.total,1);const row=result.orders[0];assert.deepEqual(row.serverSummary.totals,{approved:700,pending:200,reserved:100,reported:900});assert.equal(JSON.stringify(result).includes(bulk),false);assert.equal(result.totals.approved,700);assert.equal(result.totals.pending,200);
}));
test('Line restriction and literal code search apply on the server; denied filters cannot read production context',()=>dailyFixture(async c=>{
 await c.put('in_transit','B-ORDER',{...c.order,id:'B-ORDER',line:'B',lsxCode:'B-ORDER'});
 assert.throws(()=>productionPageQuery(new URLSearchParams('line=B'),lineActor),e=>e.status===403);
 const result=await productionOrderPage(c.db,lineActor,new URLSearchParams('field=Line&line=all'));assert.ok(result.orders.every(o=>o.line==='A'));assert.equal(JSON.stringify(result).includes('B-ORDER'),false);
 const noMatch=await productionOrderPage(c.db,admin,new URLSearchParams('field=LSX&query=%25'));assert.equal(noMatch.total,0);
 assert.throws(()=>productionPageQuery(new URLSearchParams('page=-1'),admin),e=>e.status===422);
}));
test('export streams all matching rows across server pages and never treats a spreadsheet formula as executable data',()=>dailyFixture(async c=>{
 for(let i=0;i<24;i++){const id='CSV-'+i;await c.put('in_transit',id,{...c.order,id,lsxCode:id,planningNote:'=SYNTHETIC()',week:'2026-11-02'});}
 const response=await productionOrderPage(c.db,admin,new URLSearchParams('field=LSX&query=CSV-&page=2&format=csv'));
 assert.ok(response instanceof Response);const text=await response.text();assert.equal(text.split('\r\n').filter(Boolean).length,25);assert.ok(text.includes("'=SYNTHETIC()"));assert.ok(text.includes('CSV-23'));assert.equal(text.includes('OTHER-LSX'),false);
}));
test('detail loads only one authorized order and one report/event page, deduplicates imported IDs, preserves stored rates and raw records',()=>dailyFixture(async c=>{
 const bulky='x'.repeat(600000);
 for(let i=0;i<43;i++){const id='DETAIL-'+String(i).padStart(3,'0');await c.put('production_report',id,{id,transitId:c.order.id,lsxCode:c.order.lsxCode,line:'A',kind:'completion',reportedQuantity:1,approvedQuantity:1,reviewStatus:'Đã xác nhận',productionDate:'2026-11-02',quantityOnly:true,reportingModel:'daily-finished-v1',rateBasis:{value:.1},sourceSnapshot:{bulky},history:[bulky]});}
 await c.put('production_history_import','OLD',{reports:[{id:'DETAIL-000',transitId:c.order.id,line:'A',reportedQuantity:999},{id:'IMPORTED',transitId:c.order.id,line:'A',kind:'completion',reportedQuantity:2,reviewStatus:'Chờ kiểm tra'}],timeEvents:[{id:'OLD-EVENT',sourceId:c.order.id,line:'A',sourceOperation:'Nhập trạm',effectiveAt:'2026-11-02T08:00:00+07:00'}]});
 for(let i=0;i<23;i++){const id='EVENT-'+i;await c.put('production_event',id,{id,sourceId:c.order.id,line:'A',kind:'note',recordedAt:'2026-11-02',before:{bulky},after:{bulky}});}
 await c.put('production_report','OTHER-LINE',{id:'OTHER-LINE',transitId:'OTHER-LSX',line:'B',reportedQuantity:777});
 const before=await records(c.db),first=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id,page:'1'}));assert.equal(first.total,44);assert.equal(first.reports.length,20);assert.equal(JSON.stringify(first).includes(bulky),false);assert.equal(JSON.stringify(first).includes('OTHER-LINE'),false);
 const second=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id,page:'2'}));assert.equal(second.reports.length,20);assert.equal(new Set([...first.reports,...second.reports].map(r=>r.id)).size,40);assert.equal(first.reports.filter(r=>r.id==='DETAIL-000').length<=1,true);
 assert.ok([...first.reports,...second.reports].filter(r=>r.id.startsWith('DETAIL-')).every(r=>r.rateBasis.value===.1));
 const events=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id,kind:'events',page:'2'}));assert.equal(events.total,24);assert.equal(events.events.length,4);assert.equal(events.reports.length,0);assert.equal(JSON.stringify(events).includes(bulky),false);
 await c.put('in_transit','FOREIGN',{...c.order,id:'FOREIGN',line:'B'});await assert.rejects(()=>productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:'FOREIGN'})),e=>e.status===403);
 await c.db.prepare("DELETE FROM app_records WHERE entity='in_transit' AND record_key='FOREIGN'").run();assert.deepEqual(await records(c.db),before);
}));
test('a concurrent production commit rejects the mixed list rather than returning inconsistent totals',()=>dailyFixture(async c=>{
 let read=0;const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{const prepared=target.prepare(sql);if(sql.includes("entity='production_cursor' AND record_key='global'"))return new Proxy(prepared,{get(s,k){if(k==='first')return async()=>{const r=await s.first();read++;if(read===2)return {payload:JSON.stringify({version:999,token:'SYNTHETIC-CONCURRENT'})};return r;};const v=s[k];return typeof v==='function'?v.bind(s):v;}});return prepared;};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>productionOrderPage(db,admin,new URLSearchParams()),e=>e.status===409);assert.equal(read,2);
}));
test('legacy links preserve Unicode/whitespace normalization and empty-code fallback in both summaries and detail pages',()=>dailyFixture(async c=>{
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.lsxCode','Đơn A') WHERE entity='in_transit' AND record_key=?").bind(c.order.id).run();
 await c.put('production_report','UNICODE',{id:'UNICODE',orderCode:'don  a',kind:'completion',line:'A',reportedQuantity:50,approvedQuantity:50,reviewStatus:'Đã xác nhận'});
 await c.put('production_report','FALLBACK',{id:'FALLBACK',lsxCode:'',orderCode:'DON A',kind:'completion',line:'A',reportedQuantity:25,approvedQuantity:25,reviewStatus:'Đã xác nhận'});
 const list=await productionOrderPage(c.db,lineActor,new URLSearchParams('field=LSX&query=Đơn'));assert.equal(list.total,1);assert.equal(list.totals.approved,75);
 const detail=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id}));assert.equal(detail.total,2);assert.deepEqual(new Set(detail.reports.map(r=>r.id)),new Set(['UNICODE','FALLBACK']));
}));
test('detail Line boundary also checks frozen order identity and redacts foreign transfer identities',()=>dailyFixture(async c=>{
 await c.put('production_report','WRONG-SNAPSHOT',{id:'WRONG-SNAPSHOT',transitId:c.order.id,line:'A',kind:'completion',reportedQuantity:20,orderSnapshot:{line:'B',lsxCode:'PRIVATE-B-LSX'}});
 await c.put('production_event','TRANSFER',{id:'TRANSFER',kind:'transfer',sourceId:'PRIVATE-B-ORDER',destinationId:c.order.id,line:'B',destinationLine:'A',employees:['SYNTHETIC-P'],reason:'PRIVATE-B-LSX',effectiveAt:'2026-11-02T08:00:00+07:00'});
 const report=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id}));assert.equal(report.total,0);assert.equal(JSON.stringify(report).includes('PRIVATE-B-LSX'),false);
 const event=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id,kind:'events'}));assert.equal(event.total,1);assert.equal(event.events[0].sourceId,null);assert.equal(event.events[0].reason,'Chuyển Line');assert.equal(JSON.stringify(event).includes('PRIVATE-B-ORDER'),false);
}));
test('legacy column-shaped orders and non-Monday week inputs stay visible with correct server filters',()=>dailyFixture(async c=>{
 const columns=[];Object.assign(columns,{0:'LEGACY-PLAN',1:'LEGACY-SKU',2:'Sản phẩm cũ',4:'Line A',5:'LEGACY-LSX',6:'03/11/2026',7:'30/11/2026',14:100,15:'01/11/2026',29:'ĐÃ ĐỒNG BỘ'});
 await c.put('in_transit','LEGACY-ROW',{columns});
 const result=await productionOrderPage(c.db,lineActor,new URLSearchParams('field=Tuần kế hoạch&query=2026-11-05'));assert.ok(result.orders.some(o=>o.id==='LEGACY-ROW'));assert.equal(result.filters.query,'2026-11-02');
 const exact=await productionOrderPage(c.db,lineActor,new URLSearchParams('field=SKU&query=LEGACY-SKU'));assert.equal(exact.total,1);assert.equal(exact.orders[0].lsxCode,'LEGACY-LSX');
 const detail=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:'LEGACY-ROW'}));assert.equal(detail.orders[0].line,'A');
}));
test('pending correction keeps the confirmed amount until ACK, separate from actual pending quantity',()=>dailyFixture(async c=>{
 await c.put('production_report','CONFIRMED',{id:'CONFIRMED',transitId:c.order.id,line:'A',kind:'completion',quantityOnly:true,reportingModel:'daily-finished-v1',reportedQuantity:200,approvedQuantity:200,reviewStatus:'Đã xác nhận',productionDate:'2026-11-02',pendingQuantityReservation:100,pendingCorrection:{status:'pending',quantity:300}});
 const result=await productionOrderPage(c.db,lineActor,new URLSearchParams('field=LSX&query=SYNTHETIC-LSX'));assert.equal(result.totals.approved,200);assert.equal(result.totals.pending,0);assert.equal(result.totals.reserved,100);assert.equal(result.orders[0].serverSummary.totals.reported,200);
}));
test('detail timeline does not resurrect imported events superseded by an ERP stage snapshot',()=>dailyFixture(async c=>{
 const event={id:'OLD-TIME',sourceId:c.order.id,line:'A',effectiveAt:'2026-11-02T08:00:00+07:00',sourceOperation:'Nhập trạm'};
 await c.put('production_history_import','OLD-SNAPSHOT',{timeEvents:[event],reports:[]});await c.put('production_history_import','ERP-SNAPSHOT',{erpStageImport:true,scope:{orderIds:[c.order.id],from:'2026-11-01',to:'2026-11-03'},reports:[],timeEvents:[{...event,id:'ERP-TIME',erpStageImport:true}]});
 const result=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id,kind:'events'}));assert.equal(result.total,1);assert.equal(result.events[0].id,'ERP-TIME');
}));
test('detail ordering uses production time with GMT+7 offsets, not the date a backfilled report was received',()=>dailyFixture(async c=>{
 const base={transitId:c.order.id,line:'A',kind:'completion',reportedQuantity:1,reviewStatus:'Chờ kiểm tra'};
 for(const r of [{...base,id:'NEWER',quantityOnly:true,reportingModel:'daily-finished-v1',productionAt:'2026-11-02T01:00:00Z',productionDate:'2026-11-02',reportedAt:'2026-11-03'}, {...base,id:'OLDER',completedAt:'2026-11-02T07:30:00+07:00',reportedAt:'2026-11-16'}, {...base,id:'BACKFILL',quantityOnly:true,reportingModel:'daily-finished-v1',productionDate:'2026-10-30',reportedAt:'2026-11-16'}])await c.put('production_report',r.id,r);
 const detail=await productionOrderPage(c.db,lineActor,new URLSearchParams({orderId:c.order.id}));assert.deepEqual(detail.reports.map(r=>r.id),['NEWER','OLDER','BACKFILL']);
}));
test('CSV enforces the existing exact export grant on the server; view, sibling/group grants and Quick Line cannot expand export access',()=>dailyFixture(async c=>{
 const csv=new URLSearchParams('format=csv');
 for(const viewer of [lineActor,{login:'VIEW',grants:['Quản lý sản xuất / Báo công sản xuất / Xem']},{login:'SIBLING',grants:['Quản lý sản xuất / Báo công sản xuất / Xem','Quản lý sản xuất / Tiến độ sản xuất / Xuất dữ liệu']},{login:'GROUP',grants:['Quản lý sản xuất / Xem','Quản lý sản xuất / Xuất dữ liệu']}])await assert.rejects(()=>productionOrderPage(c.db,viewer,csv),e=>e.status===403);
 const allowed={login:'EXPORT-A',line:'A',grants:['Quản lý sản xuất / Báo công sản xuất / Xem','Quản lý sản xuất / Báo công sản xuất / Xuất dữ liệu']};
 await c.put('in_transit','PRIVATE-B-EXPORT',{...c.order,id:'PRIVATE-B-EXPORT',line:'B',lsxCode:'PRIVATE-B-EXPORT'});
 const text=await(await productionOrderPage(c.db,allowed,csv)).text();assert.equal(text.includes('PRIVATE-B-EXPORT'),false);assert.equal((await productionOrderPage(c.db,lineActor,new URLSearchParams())).rights.export,false);
}));
test('a changed or inconsistent order identity cannot silently disappear from page counts',()=>dailyFixture(async c=>{
 await c.put('in_transit','BAD-KEY',{...c.order,id:'DIFFERENT-ID',lsxCode:'INCONSISTENT'});
 await assert.rejects(()=>productionOrderPage(c.db,admin,new URLSearchParams('field=LSX&query=INCONSISTENT')),e=>e.status===409);
}));

test('paged SKU metadata excludes bulky audit fields and list/detail never reads leadtime tables',()=>dailyFixture(async c=>{
 await c.put('sku','SYNTHETIC-CATALOG',{code:'SYNTHETIC-CATALOG',name:'Tên từ SKU',specification:'Quy cách',unit:'Cái',group:'Nhóm',line:'A',history:'x'.repeat(650000)});
 const before=await records(c.db),catalog=await readProductionPageCatalog(c.db);const sku=catalog.find(r=>r.key==='SYNTHETIC-CATALOG');assert.equal(sku.payload.name,'Tên từ SKU');assert.equal(sku.payload.specification,'Quy cách');assert.equal(sku.payload.history,undefined);
 const db={prepare(sql){const stmt=c.db.prepare(sql);if(sql.includes('entity=?'))return new Proxy(stmt,{get(target,key){if(key==='bind')return (...args)=>{assert.ok(!['leadtime','leadtime_versions'].includes(args[0]),'paged view does not use leadtime');return target.bind(...args);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});return stmt;}};
 const page=await productionOrderPage(db,admin,new URLSearchParams(),catalog);assert.ok(page.supported);await productionOrderPage(db,admin,new URLSearchParams({orderId:c.order.id}),catalog);assert.deepEqual(await records(c.db),before);
}));
