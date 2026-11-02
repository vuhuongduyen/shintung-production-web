import test from 'node:test';
import assert from 'node:assert/strict';
import {getTransit} from '../scripts/local/in-transit.mjs';

test('In Transit reads pending history and reviewed overrides once, without modifying source records',async()=>{
 const order={id:'TEST-ORDER',lsxCode:'TEST-LSX',lsxQty:100,lsxOpenedAt:'2026-10-14',planStart:'2026-10-14',planEnd:'2026-10-15',line:'A',sku:'TEST-SKU',syncStatus:'ĐÃ ĐỒNG BỘ'};
 const report={id:'TEST-REPORT',transitId:order.id,kind:'completion',reviewStatus:'Lịch sử chờ đối chiếu',reportedQuantity:100,historicalImport:true,startedAt:'2026-10-14T08:00:00+07:00',hours:{total:7}};
 const records={in_transit:[order],production_history_import:[{id:'TEST-BATCH',reports:[report]}],production_report:[]};
 const before=JSON.stringify(records);
 const db={prepare(sql){assert.match(sql,/^SELECT /);return {bind(entity){return {async all(){return {results:(records[entity]||[]).map(value=>({record_key:value.id,payload:JSON.stringify(value),updated_by:'TEST',updated_at:'2026-10-14'}))};}};}};}};
 let result=(await getTransit(db)).rows[0];
 assert.equal(result.progressStatus,'CHỜ XÁC NHẬN HOÀN THÀNH');assert.equal(result.pendingReportQty,100);assert.equal(result.completedQty,0);assert.equal(result.actualStartedAt,'');assert.equal(JSON.stringify(records),before);
 records.production_report=[{...report,reviewStatus:'Đã xác nhận',approvedQuantity:100,completedAt:'2026-10-14T10:00:00+07:00'}];
 result=(await getTransit(db)).rows[0];assert.equal(result.completedQty,100);assert.equal(result.pendingReportQty,0);assert.equal(result.progressStatus,'HT SỚM');
 records.production_report=[{...report,reviewStatus:'Cần điều chỉnh'}];
 result=(await getTransit(db)).rows[0];assert.equal(result.completedQty,0);assert.equal(result.pendingReportQty,0);
});
