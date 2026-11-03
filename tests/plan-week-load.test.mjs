import test from 'node:test';import assert from 'node:assert/strict';
import {allocatePlanWeek} from '../lib/plan-week-load.mjs';
import {remainingPlanWithTransitSummary,planTransitBacklog} from '../lib/plan-transit-backlog.mjs';
const week='2026-10-26';const budgets=Array.from({length:14},(_,i)=>({date:new Date(Date.parse(week)+86400000*i).toISOString().slice(0,10),available:i%7<5?8:0}));
const row=(id,start,end,plan,extra={})=>({id,sku:id,week,line:'A',start,end,plan,laborHour:1,status:'DỰ KIẾN',...extra});
test('future-start order stays visible but has no weekly load even without future Capacity',()=>{const r=allocatePlanWeek([row('next','2026-11-02','2026-11-06',100)],[],week)[0];assert.equal(r.hours,0);assert.equal(r.deferred,100);});
test('cross-week Pro Plan belongs to completion week',()=>{const r=allocatePlanWeek([row('cross',week,'2026-11-06',60)],budgets.slice(0,7),week)[0];assert.equal(r.hours,0);assert.equal(r.deferred,60);const next=allocatePlanWeek([row('cross',week,'2026-11-06',60)],budgets,'2026-11-02')[0];assert.equal(next.hours,60);assert.equal(next.deferred,0);});
test('existing backlog reserves time before new cross-week orders; due-this-week excess stays this week',()=>{const rs=[row('new',week,'2026-11-06',30),row('old',week,'2026-10-30',20,{backlog:true,previousWeek:true})],r=allocatePlanWeek(rs,budgets,week);assert.equal(r.find(r=>r.id==='new').hours,0);assert.equal(r.find(r=>r.id==='new').deferred,30);assert.equal(allocatePlanWeek([row('due',week,'2026-10-30',50)],budgets,week)[0].hours,50);});
test('cancelled and held orders are excluded; missing capacity and unscheduled work are not invented as zero',()=>{assert.equal(allocatePlanWeek([row('cancel',week,week,100,{status:'HỦY'})],budgets,week).length,0);assert.equal(allocatePlanWeek([row('missing',week,'2026-10-30',20)],[],week)[0].hours,null);assert.equal(allocatePlanWeek([row('undated','','',20)],budgets,week)[0].hours,null);});
test('weekly summary excludes Pro Plan completing after this week',()=>{const cap=[{line:'A',week,status:'Đã xác nhận',availableHours:40,dailyBudgets:budgets,backlogRows:[],otherPlans:[]}],rows=[row('cross',week,'2026-11-06',60),row('future','2026-11-02','2026-11-06',100)];const s=remainingPlanWithTransitSummary(rows,cap,week)[0];assert.equal(s.required,0);assert.equal(s.totalRequired,0);assert.equal(s.difference,40);});
test('In transit includes cross-week unfinished work but excludes future starts',()=>{const r=(id,start,end)=>({id,planStart:start,planEnd:end,sku:'SKU',line:'A',week,lsxQty:60,completedQty:0,status:'ĐÃ MỞ LSX'});const b=planTransitBacklog([r('cross',week,'2026-11-06'),r('future','2026-11-02','2026-11-06')],week,[{sku:'SKU',laborHour:1}]);assert.deepEqual(b.rows.map(r=>r.transitId),['cross']);});
test('pending order from another plan week contributes to the week it actually runs',()=>{const cap=[{line:'A',week,status:'Đã xác nhận',availableHours:40,dailyBudgets:budgets,backlogRows:[],otherPlans:[row('from-old',week,'2026-10-30',20,{week:'2026-10-19'})]}];assert.equal(remainingPlanWithTransitSummary([],cap,week)[0].totalRequired,20);});
test('missing labor on Line B does not hide valid plan and backlog totals or poison shared dates',()=>{
 const cap=[{line:'B',week,status:'Đã xác nhận',availableHours:40,dailyBudgets:budgets,backlogRows:[row('old',week,'2026-10-30',10,{line:'B',remaining:10,previousWeek:true})],otherPlans:[]}];
 const rows=[row('missing',week,'2026-10-30',50,{line:'B',laborHour:null,sequence:1}),row('valid',week,'2026-10-30',20,{line:'B',sequence:2})];
 const s=remainingPlanWithTransitSummary(rows,cap,week).find(r=>r.line==='B');
 assert.equal(s.required,20);assert.equal(s.backlogHours,10);assert.equal(s.previousBacklogHours,10);assert.equal(s.totalRequired,30);assert.equal(s.difference,10);assert.equal(s.ratio,.75);assert.equal(s.partial,true);assert.equal(s.missingLabor,1);
});
test('row missing a later budget does not reserve partial hours from a valid row',()=>{
 const r=allocatePlanWeek([row('missing',week,'2026-10-30',20),row('valid',week,week,8)],budgets.slice(0,1),week);
 assert.equal(r[0].hours,null);assert.equal(r[1].hours,8);
});

test('finish dates include earlier starts and exclude future finishes',()=>{
 const rows=[row('before','2026-10-25','2026-10-30',90),row('after','2026-11-02','2026-11-06',90,{laborHour:null}),row('monday',week,week,8),row('sunday','2026-11-01','2026-11-01',2)];
 const r=allocatePlanWeek(rows,budgets,week);assert.equal(r.find(r=>r.id==='before').hours,90);assert.equal(r.find(r=>r.id==='after').hours,0);assert.equal(r.find(r=>r.id==='monday').hours,8);assert.equal(r.find(r=>r.id==='sunday').hours,2);
});
test('transit remaining hours carry forward while old untransferred plans stay excluded',()=>{
 const b=planTransitBacklog([{id:'old',line:'B',sku:'x',week:'2026-10-19',planStart:'2026-10-19',planEnd:'2026-10-30',lsxQty:50,completedQty:0,laborHour:1}],week);
 for(const daily of [true,false]){const c={line:'B',week,status:'Đã xác nhận',availableHours:40,backlogRows:b.rows,...(daily?{dailyBudgets:budgets}:{})};const s=remainingPlanWithTransitSummary([row('ok',week,week,8,{line:'B'})],[c],week).find(r=>r.line==='B');assert.equal(s.totalRequired,58);assert.equal(s.backlogHours,50);}
});
test('finish-date eligibility matches daily and retained summaries at week boundaries',()=>{
 const rows=[row('prior','2026-10-19','2026-10-25',99),row('monday','2026-10-19',week,10),row('sunday',week,'2026-11-01',5),row('next',week,'2026-11-02',90),row('undated',week,'',90)];
 for(const daily of [true,false]){const cap=[{line:'A',week,status:'Đã xác nhận',availableHours:40,backlogRows:[],...(daily?{dailyBudgets:budgets}:{})}];assert.equal(remainingPlanWithTransitSummary(rows,cap,week)[0].required,15);}
});
