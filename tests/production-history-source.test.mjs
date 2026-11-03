import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileHistorySource} from '../lib/production-history-source.mjs';
import {progressReviewSummary,progressOrderStatus} from '../lib/production-progress-review.mjs';
test('12.90 hours per person times five preserves 64.50 labor hours and five people',()=>{
 const r={historicalImport:true,transitId:'a',sourceCount:5,sourceCumulativeHours:12.9,completedAt:'2026-10-09T02:02:00Z',hours:{perEmployee:Array.from({length:10},(_,i)=>({id:String(i),hc:3,ot:0,total:3}))}};
 const [out]=reconcileHistorySource([r]);assert.equal(out.count,5);assert.equal(out.employees.length,5);assert.equal(out.hours.total,64.5);assert.equal(out.hours.perEmployee.reduce((s,p)=>s+p.total,0),15);assert.equal(out.unallocatedHours,49.5);assert.deepEqual(reconcileHistorySource([out]),[out]);
});
test('second output uses cumulative difference and insufficient allocation stays explicit',()=>{
 const rows=[12.52,20.85].map((v,i)=>({historicalImport:true,transitId:'a',sourceCount:5,sourceCumulativeHours:v,completedAt:`2026-10-0${5+i}T09:00:00Z`,hours:{perEmployee:[{id:'a',hc:1,ot:0,total:1}]}}));
 const result=reconcileHistorySource(rows);assert.ok(Math.abs(result[1].hours.total-41.65)<1e-9);assert.equal(result[1].hours.perEmployee[0].total,1);assert.ok(result[1].unallocatedHours>7);
});
test('pending full quantity supplies actual finish without approving output',()=>{
 const order={id:'a',lsxQty:500,planEnd:'2026-10-09'};
 const reports=[{kind:'completion',transitId:'a',reportedQuantity:500,reviewStatus:'Lịch sử chờ đối chiếu',historicalImport:true,startedAt:'2026-10-07T06:08:53Z',completedAt:'2026-10-09T02:02:00Z'}];
 const s=progressReviewSummary(order,reports);assert.equal(s.qty,0);assert.equal(s.pendingQty,500);assert.equal(s.completedAt,reports[0].completedAt);assert.equal(progressOrderStatus(s,{known:false,running:false}).label,'Chờ xác nhận HT');
 const partial=progressReviewSummary({...order,lsxQty:1000},reports);assert.equal(partial.completedAt,'');assert.equal(progressOrderStatus(partial,{known:false,running:false}).label,'Đang SX');
});
