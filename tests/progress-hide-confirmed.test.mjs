import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWorkQuantity,fullyConfirmedProgressOrder,progressReviewSummary} from '../lib/production-progress-review.mjs';
const order={id:'TEST',lsxQty:100,planEnd:'2026-10-20'};
const report={id:'R1',kind:'completion',transitId:'TEST',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',completedAt:'2026-10-14T02:00:00Z'};
test('completed quantity uses aggregate without double counting detailed approved reports',()=>{
 const summary=progressReviewSummary(order,[report,{...report,id:'P',reportedQuantity:50,reviewStatus:'Chờ kiểm tra'}]);
 assert.equal(completedWorkQuantity({...order,completedQty:100},summary),150);
 assert.equal(completedWorkQuantity({...order,completedQty:400},summary),450);
});
test('hide completed-confirmed only; retain partial/running/pending and correction',()=>{
 const hidden=(reports,running=false)=>fullyConfirmedProgressOrder(order,progressReviewSummary(order,reports),{running});
 assert.equal(hidden([report]),true);
 assert.equal(hidden([{...report,reportedQuantity:40,approvedQuantity:40}]),false);
 assert.equal(hidden([report],true),false);
 assert.equal(hidden([report,{...report,id:'P',reviewStatus:'Chờ kiểm tra',reportedQuantity:20}]),false);
 assert.equal(hidden([report,{...report,id:'E',reviewStatus:'Cần điều chỉnh'}]),false);
 assert.equal(hidden([]),false);
});
