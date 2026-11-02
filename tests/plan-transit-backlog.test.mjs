import test from 'node:test';import assert from 'node:assert/strict';
import {planTransitBacklog,combinePlanBacklog,backlogLineSummary,planSummaryWithBacklog,remainingPlanWithTransitSummary} from '../lib/plan-transit-backlog.mjs';
import {planDailyLoad} from '../lib/plan-daily-load.mjs';import {newDailyCapacity} from '../lib/capacity.mjs';
const week='2026-10-26',labor=[{sku:'SKU',laborHour:2}];
const order=(id,extra={})=>({id,planRowId:'p'+id,planId:'plan'+id,lsxCode:'LSX-'+id,sku:'SKU',name:'SP',line:'A',week:'2026-10-19',planStart:'2026-10-19',planEnd:week,lsxQty:100,completedQty:70,status:'ĐÃ MỞ LSX',...extra});
test('includes only unfinished due-week orders, estimates remaining quantity, separates older weeks and preserves each additional LSX',()=>{
 const a=order('a'),rows=[a,a,order('b',{planId:a.planId,isAdditionalLsx:true,lsxQty:10,completedQty:0}),order('cancel',{status:'HỦY'}),order('done',{completedQty:100}),order('done-date',{actualCompletedAt:week}),order('before',{planEnd:'2026-10-25'}),order('after',{planStart:'2026-11-02',planEnd:'2026-11-02'}),order('current',{week,lsxQty:5,completedQty:0}),order('notopen',{lsxCode:'',lsxQty:null,planQty:8,completedQty:0})];
 const b=planTransitBacklog(rows,week,labor);assert.equal(b.rows.length,4);assert.equal(b.rows.find(r=>r.transitId==='a').remaining,30);assert.equal(b.rows.find(r=>r.transitId==='a').hours,60);assert.equal(b.rows[0].start,week);
 const summary=backlogLineSummary(b,'A');assert.equal(summary.backlogHours,106);assert.equal(summary.previousBacklogHours,96);
});
test('replaces original transferred plans, keeps additional orders, reserves backlog first and warns with quantity details',()=>{
 const old=order('a'),b=planTransitBacklog([old,order('cancel',{status:'HỦY'})],week,labor);
 const plans=[{id:old.planRowId,planId:old.planId,plan:100,laborHour:2,line:'A',start:week,end:week,status:'ĐÃ CHUYỂN'},{id:'pcancel',planId:'plancancel',plan:100,laborHour:2,line:'A',start:week,end:week,status:'ĐÃ CHUYỂN'},{id:'new',sku:'NEW',plan:30,laborHour:1,line:'A',start:week,end:week,status:'DỰ KIẾN'}];
 const combined=combinePlanBacklog(plans,b);assert.equal(combined.length,2);
 const c=newDailyCapacity(week,'A',100);Object.assign(c,{status:'Đã xác nhận',reviewStatus:'approved',syncedAt:'yes',khsxAcceptedAt:'yes'});c.input.workers=10;c.input.dailySchedule.forEach(d=>d.breaks=[]);
 const result=planDailyLoad(combined,[c],['new'],b.rows.map(r=>r.id));assert.equal(result.warnings.length,1);assert.equal(result.warnings[0].scheduled,60);assert.equal(result.warnings[0].over,10);
});
test('unknown standard stays unknown; pending completion remains reserved and explicitly identified',()=>{
 const b=planTransitBacklog([order('pending',{sku:'UNKNOWN',pendingReportQty:30})],week,[]);assert.equal(b.rows[0].remaining,30);assert.equal(b.rows[0].pending,30);assert.equal(b.rows[0].hours,null);const c=backlogLineSummary(b,'A');assert.equal(c.backlogHours,0);assert.equal(c.backlogMissing,1);
 const total=planSummaryWithBacklog({line:'A',required:10,available:80},[{line:'A',...c}]);assert.equal(total.totalRequired,10);assert.equal(total.difference,70);assert.equal(total.partial,true);
});
test('weekly balance combines new orders and carryover once',()=>{
 const b=planTransitBacklog([order('a')],week,labor);const total=planSummaryWithBacklog({line:'A',required:30,available:80},[{line:'A',...backlogLineSummary(b,'A')}]);assert.equal(total.totalRequired,90);assert.equal(total.difference,-10);assert.equal(total.warning,'overload');
});

test('weekly cards deduplicate matching plans and display a carryover-only Line C',()=>{
 const b=planTransitBacklog([order('a'),order('c',{line:'C'})],week,labor),capacity=['A','B','C'].map(line=>({line,week,status:'Đã xác nhận',availableHours:80,...backlogLineSummary(b,line)}));
 const rows=[{id:'pa',planId:'plana',line:'A',week,status:'DỰ KIẾN',plan:100,laborHour:2},{id:'new',line:'A',week,start:week,end:week,status:'DỰ KIẾN',plan:30,laborHour:1}];
 const cards=remainingPlanWithTransitSummary(rows,capacity,week);assert.equal(cards.find(c=>c.line==='A').totalRequired,90);assert.equal(cards.find(c=>c.line==='C').totalRequired,60);
});
