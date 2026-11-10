import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLaborReferences,attachLaborRateOmissions,isLaborRateOmitted} from '../lib/production-labor-reference.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {payrollMonth} from '../lib/production-payroll-month.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
import {fullPayrollFixture} from './helpers/payroll-scope-fixture.mjs';
const menu=(orders,value,day='2026-10-01')=>siteLaborHours(orders.map(o=>({key:o.sku,updatedAt:day+'T03:00:00Z',payload:{sku:o.sku,laborHour:value,version:1}})));
test('date-selected rates restore efficiency and integer payroll without changing attendance or original reports',()=>{
 const input=fullPayrollFixture(),before=structuredClone(input),expected=payrollMonth(input);
 const missing={...input,reports:input.reports.map(({standardUnit,...r})=>r)};
 const prior=structuredClone(missing),projected={...missing,reports:attachLaborReferences(missing.reports,input.orders,menu(input.orders,1))};
 const restored=payrollMonth(projected);
 for(let i=0;i<2;i++){
  for(const field of ['earned','actual','production','quantity'])assert.equal(restored[i][field],expected[i][field]);
  for(const field of ['score','factor','fund','paid','returned','unallocated'])assert.equal(restored[i].result[field],expected[i].result[field]);
  assert.deepEqual(restored[i].result.payments,expected[i].result.payments);
  assert.deepEqual(restored[i].result.issues,[]);
 }
 assert.deepEqual(input,before);assert.deepEqual(missing,prior);
 assert.equal(restored.reduce((n,r)=>n+r.result.paid+r.result.returned+r.result.unallocated,0),6000000);
});
test('future-only, missing and pre-cutoff rates never become zero or the current master rate in payroll',()=>{
 const input=fullPayrollFixture();input.reports=input.reports.map(({standardUnit,...r})=>r);
 for(const rates of [[],menu(input.orders,99,'2026-11-01')]){
  const rows=attachLaborReferences(input.reports,input.orders,rates);
  assert.equal(monthlyEarnedOrders(input.orders,rows,input.month,'A',new Map([[input.orders[0].sku,99]]))[0].earned,null);
  assert.equal(payrollMonth({...input,reports:rows})[0].result.paid,null);
 }
 const old=input.reports.map(r=>({...r,productionDate:'2026-09-30'}));
 assert.equal(monthlyEarnedOrders(input.orders,attachLaborReferences(old,input.orders,menu(input.orders,1,'2026-09-01')),'2026-09','A')[0].earned,null);
});
test('saved bases remain authoritative and real zero remains numeric',()=>{
 const input=fullPayrollFixture(),projected=attachLaborReferences(input.reports,input.orders,menu(input.orders,99));
 assert.equal(monthlyEarnedOrders(input.orders,projected,input.month,'A')[0].earned,100);
 const reports=input.reports.map(({standardUnit,...r})=>r),zero=attachLaborReferences(reports,input.orders,menu(input.orders,0));
 assert.equal(monthlyEarnedOrders(input.orders,zero,input.month,'A')[0].unit,0);
 assert.equal(monthlyEarnedOrders(input.orders,zero,input.month,'A')[0].earned,0);
});

test('explicit missing-rate exception preserves quantity, attendance and null rate while other missing reports still block',()=>{
 const input=fullPayrollFixture(),extra={...input.reports[0],id:'SYNTHETIC-EXCEPTION',approvedQuantity:7,standardUnit:undefined,productionDate:'2026-10-02'};
 const reports=[...input.reports,extra],before=structuredClone(reports),policy=[{orderCode:input.orders[0].lsxCode,sku:input.orders[0].sku,date:'2026-10-02'}];
 const rows=attachLaborRateOmissions(reports,input.orders,policy),out=payrollMonth({...input,reports:rows}),baseline=payrollMonth(input);
 assert.equal(isLaborRateOmitted(rows.at(-1)),true);
 assert.equal(out[0].quantity,107);assert.equal(out[0].earned,100);assert.equal(out[0].rows[0].earned,null);assert.equal(out[0].rows[0].basis.at(-1).unit,null);
 assert.equal(out[0].actual,baseline[0].actual);assert.deepEqual(out[0].result.payments,baseline[0].result.payments);assert.deepEqual(out[0].result.issues,[]);assert.deepEqual(reports,before);
 const other={...extra,id:'SYNTHETIC-OTHER',productionDate:'2026-10-03'};
 const mixed=attachLaborRateOmissions([...reports,other],input.orders,policy);
 assert.equal(isLaborRateOmitted(mixed.at(-1)),false);assert.equal(payrollMonth({...input,reports:mixed})[0].result.paid,null);
 for(const mismatch of [{...policy[0],sku:'OTHER'},{...policy[0],date:'2026-10-03'},{...policy[0],orderCode:'OTHER'}])assert.equal(isLaborRateOmitted(attachLaborRateOmissions([extra],input.orders,[mismatch])[0]),false);
 const resolved={...extra,standardUnit:.016};assert.equal(isLaborRateOmitted(attachLaborRateOmissions([resolved],input.orders,policy)[0]),false);
});
