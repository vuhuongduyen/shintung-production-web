import test from 'node:test';import assert from 'node:assert/strict';
import {captureLegacyPreservation,preservedOrderMetadata} from '../lib/production-legacy-preservation.mjs';
import {attachLegacyEarnedBasis,preservedJournalFinalIds,preservedJournalPresentation} from '../lib/production-legacy-earned-basis.mjs';
import {payrollMonth} from '../lib/production-payroll-month.mjs';
import {finalReportIds} from '../lib/production-report-order.mjs';
const month='2026-10',day='2026-10-01',snapshotId='SYNTHETIC-HISTORY';
function fixture(){
 const days=Array.from({length:31},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,working:i===0,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false}));
 const orders=['A','B'].map(line=>({id:`LSX-${line}`,sku:`SKU-${line}`,line,lsxCode:`LSX-${line}`,planId:`PLAN-${line}`,name:`Synthetic ${line}`,spec:'OLD',lsxQty:1000,processes:['PACKING','FINAL'],standardLeadtime:2}));
 const reports=orders.map(o=>({id:`REPORT-${o.line}`,kind:'completion',transitId:o.id,line:o.line,stageCode:'FINAL',productionDate:day,completedAt:`${day}T10:00:00+07:00`,reportedQuantity:200,approvedQuantity:200,reviewStatus:'Đã xác nhận',hours:{hc:8,ot:0,total:8,perEmployee:[]},standardUnit:0.1}));
 const employees=['A','B'].map(line=>({id:`NV-${line}`,name:`Synthetic ${line}`,line,active:true,startDate:'2026-01-01',productionBonusStartDate:'2026-01-01'}));
 const schedules=['A','B'].map(line=>({key:`2026-09-28:${line}`,line,days,roster:[{date:day,hc:[`NV-${line}`],ot:[]}]}));
 return {orders,reports,employees,approvedSchedules:schedules,events:[{id:'HELP',kind:'line-absence',absenceType:'Phụ kho',line:'A',employees:['NV-A'],approved:true,effectiveAt:`${day}T13:00:00+07:00`,endsAt:`${day}T14:00:00+07:00`} ]};
}
const calculate=(w,extra={})=>payrollMonth({orders:w.orders,reports:w.reports,employees:w.employees,schedules:w.approvedSchedules,events:w.events,month,standards:new Map([['SKU-A',.1],['SKU-B',.1]]),...extra});
test('past month preserves every person/hour/payment/quantity after current master and calendar changes',async()=>{
 const w=fixture(),raw=structuredClone(w),before=calculate(w),p=await captureLegacyPreservation({workflow:w,standards:new Map([['SKU-A',.1],['SKU-B',.1]]),snapshotId,observedAt:'2026-11-04T01:00:00Z',cutoverDate:'2026-11-04'});
 assert.ok(before.every(r=>r.result.issues.length===0),JSON.stringify(before.map(r=>r.result.issues)));assert.ok(before[0].result.paid>0);assert.equal(before[0].support,1);
 const changed={...w,orders:w.orders.map(o=>({...o,sku:'NEW',line:o.line==='A'?'B':'A',name:'New name',spec:'New spec'})),employees:w.employees.map(e=>({...e,line:'C',name:'New employee name',startDate:'2027-01-01',active:false})),approvedSchedules:[],events:[],reports:await attachLegacyEarnedBasis(w.reports,p.basis,{required:true})};
 const after=calculate(changed,{standards:new Map([['NEW',9]]),attendanceBaselines:p.monthly,historyProtection:{requiredBeforeMonth:'2026-11',snapshotId}});
 // Order display also has a separately guarded snapshot; compare all calculation values and preserved labels.
 for(let i=0;i<before.length;i++){for(const key of ['people','selected','earned','share','result','actual','support','production','quantity','missing'])assert.deepEqual(after[i][key],before[i][key],key);assert.equal(after[i].rows[0].order.name,before[i].rows[0].order.name);assert.equal(after[i].rows[0].earned,before[i].rows[0].earned);}
 assert.deepEqual(w,raw,'capture and calculation never write original data');
});
test('journal final marker/rate/cumulative hours and known missing metadata do not follow later master changes',async()=>{
 const w=fixture(),p=await captureLegacyPreservation({workflow:w,standards:new Map([['SKU-A',.1],['SKU-B',.1]]),snapshotId,observedAt:'2026-11-04T01:00:00Z',cutoverDate:'2026-11-04'}),attached=await attachLegacyEarnedBasis(w.reports,p.basis,{required:true}),changed=w.orders.map(o=>({...o,processes:['PACKING']}));
 assert.equal(finalReportIds(attached,changed).size,0);assert.equal(preservedJournalFinalIds(attached,finalReportIds(attached,changed)).size,2);
 const view=preservedJournalPresentation(attached[0]);assert.equal(view.standardUnitHours,.1);assert.equal(view.standardLaborHours,20);assert.equal(view.orderCumulativeHours,8);assert.equal(view.standardUnit,.1);
 const basis=p.orders[0];assert.equal(preservedOrderMetadata(w.orders[0],basis).standardLeadtime,2);assert.equal(preservedOrderMetadata({...w.orders[0],standardLeadtime:3},basis).standardLeadtime,undefined,'explicit source edit is not overridden');
 const missing=calculate(w,{attendanceBaselines:[],historyProtection:{requiredBeforeMonth:'2026-11',snapshotId}});assert.ok(missing.every(r=>r.result.fund===null));assert.match(missing[0].result.issues.join(),/Thiếu mốc bảo toàn/);
});
