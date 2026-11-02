import test from 'node:test';
import assert from 'node:assert/strict';
import {reportRequiresDelayReason as required,reportDelayReasonError as error} from '../lib/production-progress-review.mjs';
const order={id:'order',lsxCode:'LSX-1',planEnd:'2026-10-23',lsxQty:2000,delayReason:'old reason'};
const report={id:'r',transitId:'order',lsxCode:'LSX-1',kind:'completion',stageReporting:true,stageCode:'FINAL',reportedQuantity:2000,completedAt:'2026-10-23T17:00:00Z'};
test('late final output including partial requires reason, using VN calendar date',()=>{
 assert.equal(required(order,report),true);
 assert.equal(required(order,{...report,stageCode:'CUT',reportedQuantity:0},[report]),false);
 assert.equal(required(order,{...report,reportedQuantity:100}),true);
 assert.equal(required(order,{...report,reportedQuantity:1000},[{...report,id:'prior',reportedQuantity:1000,reviewStatus:'Chờ kiểm tra'}]),true);
 assert.equal(required(order,{...report,reportedQuantity:1000},[{...report,id:'prior',reportedQuantity:1000,voided:true}]),true);
 assert.equal(required(order,{...report,completedAt:'2026-10-23T16:59:59Z'}),false);
 assert.equal(required(order,{...report,completedAt:'2026-10-23'}),false);
});
test('empty submitted reason cannot fall back to old report/order reason',()=>{
 assert.match(error(order,report,''),/LSX-1 · Công đoạn FINAL/);
 assert.ok(error(order,report,'   '));
 assert.ok(error(order,{...report,delayReason:'stored'},''));
 assert.equal(error(order,report,'Thiếu nguyên vật liệu'),'');
});
