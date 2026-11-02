import test from 'node:test';
import assert from 'node:assert/strict';
import {productionOrderIndex} from '../lib/production-order-index.mjs';
import {progressReviewSummary} from '../lib/production-progress-review.mjs';
const now='2026-10-31T02:00:00Z';
test('indexed summaries preserve output, pending, cancellation and transfer history',()=>{
 const orders=[{id:'a',lsxQty:100,planEnd:'2026-10-31'},{id:'b',lsxQty:100,planEnd:'2026-11-01'}];
 const reports=[{id:'r',transitId:'a',kind:'completion',reportedQuantity:20,reviewStatus:'Chờ kiểm tra',startedAt:'2026-10-30T01:00:00Z',completedAt:'2026-10-30T02:00:00Z'},{id:'r2',transitId:'b',kind:'completion',reportedQuantity:100,reviewStatus:'Đã xác nhận',cancelled:true}];
 const events=[{kind:'start',sourceId:'a',effectiveAt:'2026-10-30T01:00:00Z'},{kind:'transfer',sourceId:'a',destinationId:'b',effectiveAt:'2026-10-30T03:00:00Z'},{kind:'start',sourceId:'b',destinationId:'b',voided:true,effectiveAt:'2026-10-29T01:00:00Z'}];
 const index=productionOrderIndex(orders,reports,events,now);
 for(const o of orders)assert.deepEqual(index.summaryFor(o),progressReviewSummary(o,reports,events,now));
 assert.equal(index.eventsByOrder.get('b').length,2);
 assert.equal(index.summaryFor(orders[0]),index.summaryFor(orders[0]));
 const changed={...orders[0],actualStartedAt:'2026-10-29'};assert.equal(index.summaryFor(changed).startedAt,'2026-10-29');
});
test('large order list summary parity and local calculation timing',t=>{
 const orders=Array.from({length:600},(_,i)=>({id:String(i),lsxQty:100,planEnd:'2026-11-01'}));
 const reports=Array.from({length:6000},(_,i)=>({id:String(i),transitId:String(i%600),kind:'completion',reportedQuantity:1,reviewStatus:'Chờ kiểm tra',startedAt:now,completedAt:now}));
 const events=Array.from({length:6000},(_,i)=>({sourceId:String(i%600),kind:'start',effectiveAt:now}));
 const a=performance.now();const expected=orders.map(o=>progressReviewSummary(o,reports,events,now));const b=performance.now();const index=productionOrderIndex(orders,reports,events,now);const c=performance.now();
 assert.deepEqual(orders.map(o=>index.summaryFor(o)),expected);t.diagnostic(`Local synthetic calculation: whole-list scans ${(b-a).toFixed(1)} ms; indexed ${(c-b).toFixed(1)} ms`);
});
