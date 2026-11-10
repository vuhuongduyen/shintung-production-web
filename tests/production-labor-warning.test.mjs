import test from 'node:test';import assert from 'node:assert/strict';
import {attachLaborRateWarningSuppressions as attach,isLaborRateWarningSuppressed as hidden} from '../lib/production-labor-warning.mjs';
import {isLaborRateOmitted,referenceReportBasis} from '../lib/production-labor-reference.mjs';
import {monthlyEarnedOrders,payrollPreview} from '../lib/production-payroll.mjs';
const orders=Array.from({length:4},(_,i)=>({id:'SYNTHETIC-ORDER-'+i,lsxCode:'SYNTHETIC-LSX-'+i,sku:'SYNTHETIC-SKU-'+i,line:'A',processes:['FINAL']}));
const reports=orders.map((o,i)=>({id:'SYNTHETIC-REPORT-'+i,kind:'completion',transitId:o.id,orderSnapshot:o,sku:o.sku,line:'A',stageName:'FINAL',completedAt:'2026-11-02T03:00:00Z',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',hours:{hc:1,ot:0,total:1}}));
const policy=orders.slice(0,3).map(o=>({orderCode:o.lsxCode,sku:o.sku,date:'2026-11-02'}));
test('three exact warning suppressions leave fourth warning and every payroll input/result unchanged',()=>{
 const before=JSON.stringify(reports),projected=attach(reports,orders,policy);
 assert.deepEqual(projected.map(hidden),[true,true,true,false]);assert.deepEqual(attach(projected,orders,[]).map(hidden),[false,false,false,false]);assert.deepEqual(attach(projected,orders,null).map(hidden),[false,false,false,false]);assert.deepEqual(projected.map(isLaborRateOmitted),[false,false,false,false]);
 const original=monthlyEarnedOrders(orders,reports,'2026-11','A'),after=monthlyEarnedOrders(orders,projected,'2026-11','A');assert.deepEqual(after,original);
 for(const row of after){assert.equal(row.calculationEarned,null);assert.equal(row.unit,null);assert.equal(row.reported,1);assert.equal(row.basis[0].omitted,false);}
 assert.deepEqual(payrollPreview(after[0].calculationEarned,[],1000,[],'2026-11'),payrollPreview(original[0].calculationEarned,[],1000,[],'2026-11'));
 assert.equal(JSON.stringify(reports),before);assert.deepEqual(projected.map(referenceReportBasis),reports.map(referenceReportBasis));
});
test('warning policy is exact, unresolved-only and cannot silently suppress different identity/date or valid zero',()=>{
 for(const field of ['orderCode','sku','date']){const p=structuredClone(policy);p[0][field]=field==='date'?'2026-11-03':'OTHER';assert.equal(hidden(attach(reports,orders,p)[0]),false);}
 for(const invalid of [null,{},[{sku:orders[0].sku}],[{...policy[0],extra:true}]])assert.equal(hidden(attach(reports,orders,invalid)[0]),false);
 for(const rate of [0,.016])assert.equal(hidden(attach([{...reports[0],standardUnit:rate}],orders,policy)[0]),false);
 for(const change of [{stageName:'CUT'},{cancelled:true},{approvedQuantity:0},{approvedQuantity:'invalid'},{completedAt:'2026-09-30T03:00:00Z'}])assert.equal(hidden(attach([{...reports[0],...change}],orders,policy)[0]),false);
 const marked=attach(reports,orders,policy)[0];for(const change of [{id:'OTHER'},{completedAt:'2026-11-03T03:00:00Z'},{orderSnapshot:{...orders[0],sku:'OTHER'}},{standardUnit:0}])assert.equal(hidden({...marked,...change}),false);
});

test('warning attachment and reader share live-order SKU/code fallback, and reject changed or missing context',()=>{
 const raw={...reports[0],sku:undefined,orderSnapshot:undefined},[marked]=attach([raw],orders,policy);
 assert.ok(marked.laborRateWarningSuppression);assert.equal(hidden(marked,orders[0]),true);assert.equal(hidden(marked),false);
 for(const changed of [{...orders[0],sku:'OTHER'},{...orders[0],lsxCode:'OTHER'}])assert.equal(hidden(marked,changed),false);
 assert.equal(isLaborRateOmitted(marked),false);assert.deepEqual(referenceReportBasis(marked),referenceReportBasis(raw));
 assert.deepEqual(monthlyEarnedOrders(orders,[marked],'2026-11','A'),monthlyEarnedOrders(orders,[raw],'2026-11','A'));
});
