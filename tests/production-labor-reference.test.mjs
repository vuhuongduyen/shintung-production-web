import test from 'node:test';import assert from 'node:assert/strict';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {attachLaborReferences,referenceReportBasis,laborReferenceLabel} from '../lib/production-labor-reference.mjs';
import {earnedReportBasis,legacyEarnedModel} from '../lib/production-legacy-earned-basis.mjs';
import {reportStandardHours} from '../lib/production-report-standard-hours.mjs';
import {journalStandardHours} from '../lib/production-journal-standards.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
import {orderLaborOutput} from '../lib/production-output-summary.mjs';
const sku='SYNTHETIC',orders=[{id:'O',sku,line:'A',lsxQty:100,actualCompletedAt:'2026-10-25T03:00:00Z'}];
const report={id:'R',transitId:'O',kind:'completion',reviewStatus:'Đã xác nhận',reportedQuantity:100,approvedQuantity:100,completedAt:'2026-10-25T03:00:00Z',hours:{hc:3,ot:1,total:4},legacyEarnedBasis:{kind:legacyEarnedModel,status:'missing',sku,line:'A'}};
const history=[{key:'H1',updatedAt:'2026-09-17T03:00:00Z',payload:{id:'H1',sku,version:1,newLaborHour:.017}},{key:'H2',updatedAt:'2026-10-16T03:00:00Z',payload:{id:'H2',sku,version:2,newLaborHour:.016}}];
const menu=()=>siteLaborHours([{key:sku,updatedAt:'2026-10-16T03:00:00Z',payload:{sku,laborHour:.016,version:2}}],null,history);
test('closed missing-basis report gets dated comparison for payroll without changing actual hours or stored basis',()=>{
 const before=structuredClone(report),[r]=attachLaborReferences([report],orders,menu());
 assert.equal(referenceReportBasis(r).unit,.016);assert.equal(referenceReportBasis(r).earned,1.6);assert.equal(r.laborReference.frozen,false);assert.match(laborReferenceLabel([r.laborReference]),/H2/);
 assert.equal(earnedReportBasis(r).unit,null);assert.equal(monthlyEarnedOrders(orders,[r],'2026-10','A')[0].earned,1.6);assert.deepEqual(orderLaborOutput(orders[0],[r]).total,4);assert.deepEqual(report,before);assert.deepEqual(r.hours,before.hours);
 assert.deepEqual(reportStandardHours([r]),{unit:null,earned:null});assert.equal(reportStandardHours([r],{reference:true}).unit,.016);
 const journal=journalStandardHours([r],orders,null,new Set(['R']),new Map([['R',{orderCumulativeHours:4}]]),[r],{reference:true}).get('R');assert.equal(journal.standardUnitHours,.016);assert.equal(journal.laborReferences.length,1);
});
test('missing bases from October onward receive dated references; September remains unchanged',()=>{
 const reports=['2026-09-30','2026-10-01','2026-10-31','2026-11-01','2026-11-09','2026-12-01'].map((date,i)=>({...report,id:String(i),completedAt:date+'T03:00:00Z'})),before=structuredClone(reports),rows=attachLaborReferences(reports,orders,menu());
 assert.deepEqual(rows.map(r=>referenceReportBasis(r).unit),[null,.017,.016,.016,.016,.016]);assert.equal(rows[0],reports[0]);assert.deepEqual(reports,before);
});
test('saved, stale, invalid and daily bases are not replaced by a reference',()=>{
 for(const r of [{...report,legacyEarnedBasis:undefined,standardUnit:.02},{...report,legacyEarnedBasis:{...report.legacyEarnedBasis,status:'resolved',unit:.025,earned:2.5}},{...report,legacyEarnedBasis:{...report.legacyEarnedBasis,status:'stale'}},{...report,standardUnit:-1},{...report,rateBasis:{value:99}}])assert.equal(attachLaborReferences([r],orders,menu())[0],r);
});
test('future versions do not change past reference; retroactive correction is labeled and leaves prior response intact',()=>{
 const [old]=attachLaborReferences([report],orders,menu()),later=structuredClone(history);later.push({key:'H3',payload:{id:'H3',sku,version:3,newLaborHour:.04,at:'2026-11-10T03:00:00Z'}});
 const m=siteLaborHours([{key:sku,payload:{sku,version:3,laborHour:.04,updatedAt:'2026-11-10T03:00:00Z'}}],null,later);assert.equal(referenceReportBasis(attachLaborReferences([report],orders,m)[0]).unit,.016);
 later[2].payload.effectiveFrom='2026-10-20';const fixed=siteLaborHours([{key:sku,payload:{sku,version:3,laborHour:.04,updatedAt:'2026-11-10T03:00:00Z'}}],null,later),[next]=attachLaborReferences([report],orders,fixed);
 assert.equal(referenceReportBasis(next).unit,.04);assert.equal(referenceReportBasis(old).unit,.016);assert.notEqual(next.laborReference.basis.versionId,old.laborReference.basis.versionId);assert.match(laborReferenceLabel([next.laborReference]),/Giờ công theo ngày/);
});
test('missing dates and test-only timelines remain missing, and preserved SKU wins over changed live order',()=>{
 const [bad]=attachLaborReferences([{...report,completedAt:''}],orders,menu());assert.equal(referenceReportBasis(bad).unit,null);
 const testMenu=siteLaborHours([{key:sku,payload:{sku,version:1,laborHour:16,isTest:true,updatedAt:'2026-09-17'}}]);assert.equal(referenceReportBasis(attachLaborReferences([report],orders,testMenu)[0]).unit,null);
 assert.equal(referenceReportBasis(attachLaborReferences([report],[{...orders[0],sku:'CHANGED'}],menu())[0]).unit,.016);
});

test('October cutoff uses production date and Vietnam completion date without changing source',()=>{
 const input=[{...report,completedAt:'2026-09-30T16:59:59Z'},{...report,completedAt:'2026-09-30T17:00:00Z'},{...report,productionDate:'2026-09-30',completedAt:'2026-11-05T03:00:00Z'},{...report,productionDate:'2026-11-05',completedAt:'2026-09-30T03:00:00Z'}],before=structuredClone(input);
 const rows=attachLaborReferences(input,orders,menu());assert.deepEqual(rows.map(r=>referenceReportBasis(r).unit),[null,.017,null,.016]);assert.deepEqual(input,before);
});
