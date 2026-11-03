import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeProduction,normalizeTransit} from '../lib/in-transit.mjs';
import {productionDailyAbsences} from '../lib/production-daily-absences.mjs';
import {vnMoment} from '../lib/production-attendance.mjs';
import {productionProgressDisplay} from '../lib/production-progress-display.mjs';

const order=normalizeTransit({id:'TEST-ORDER',lsxCode:'TEST-LSX',lsxQty:100,lsxOpenedAt:'2026-10-14',planEnd:'2026-10-15'});
const pending={id:'TEST-REPORT',kind:'completion',transitId:order.id,historicalImport:true,reviewStatus:'Lịch sử chờ đối chiếu',reportedQuantity:100,startedAt:'2026-10-14T08:00:00+07:00',completedAt:'2026-10-14T10:00:00+07:00'};
test('pending historical output has a review label without approved output or warehouse completion',()=>{
 const result=mergeProduction(order,[pending]);
 assert.equal(result.pendingReportQty,100);assert.equal(result.completedQty,0);assert.equal(result.inTransitQty,100);assert.equal(result.actualCompletedAt,'');
 assert.equal(result.progressStatus,'CHỜ XÁC NHẬN HOÀN THÀNH');assert.equal(productionProgressDisplay(result.progressStatus).tone,'review');
 assert.equal(mergeProduction(order,[{...pending,reportedQuantity:30}]).progressStatus,'BÁO CÔNG CHỜ XÁC NHẬN');
 for(const report of [{...pending,cancelled:true},{...pending,voided:true},{...pending,reviewStatus:'Cần điều chỉnh'},{...pending,transitId:'OTHER'}])assert.equal(mergeProduction(order,[report]).pendingReportQty||0,0);
 const approved=mergeProduction(order,[{...pending,reviewStatus:'Đã xác nhận',approvedQuantity:100}]);
 assert.equal(approved.completedQty,100);assert.equal(approved.pendingReportQty,0);assert.equal(approved.progressStatus,'HT SỚM');
});
const employees=[{id:'TEST-A',name:'Nhân viên giả A',line:'A'},{id:'TEST-B',name:'Nhân viên giả B',line:'B'}];
const absence={id:'LEAVE',kind:'line-absence',line:'A',employees:['TEST-A'],absenceType:'Nghỉ',effectiveAt:'2026-10-13T16:00:00+07:00',endsAt:'2026-10-14T10:00:00+07:00'};
test('attendance disclosure clips to Vietnam day, scopes lines and preserves pending/late facts',()=>{
 assert.equal(vnMoment('2026-10-13T18:00:00Z').date,'2026-10-14');
 const events=[absence,{...absence,id:'LATE',line:'B',employees:['TEST-B'],absenceType:'Đi trễ',effectiveAt:'2026-10-14T08:00:00+07:00',openArrival:true,approved:false},{...absence,id:'VOID',voided:true},{...absence,id:'OLD',endsAt:'2026-10-14T00:00:00+07:00'}];
 const result=productionDailyAbsences({date:'2026-10-14',events,employees});
 assert.equal(result.length,2);assert.equal(result[0].start,'00:00');assert.equal(result[0].end,'10:00');assert.match(result[0].names[0],/Nhân viên giả A/);
 assert.equal(result[1].pending,true);assert.equal(result[1].openArrival,true);
 assert.equal(productionDailyAbsences({date:'2026-10-14',events,employees,line:'B'}).length,1);
 assert.equal(productionDailyAbsences({date:'2026-10-14',events:[absence,{...absence,id:'CANCEL',kind:'attendance-cancel',supersedes:'LEAVE'}],employees}).length,0);
 assert.deepEqual(events[0],absence);
});
