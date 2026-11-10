import test from 'node:test';import assert from 'node:assert/strict';
import {previewFixedLaborReferences,applyFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';
import {attachLaborReferences,referenceReportBasis} from '../lib/production-labor-reference.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
const order={id:'SYNTHETIC-O',sku:'SYNTHETIC-SKU',line:'A'},report={id:'SYNTHETIC-R',transitId:order.id,sku:order.sku,version:1,kind:'completion',productionDate:'2026-10-20',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',hours:{total:4}};
const menu=value=>siteLaborHours([{key:order.sku,updatedAt:'2026-10-16T03:00:00Z',payload:{sku:order.sku,version:1,laborHour:value}}]);
const preview=reports=>previewFixedLaborReferences({reports,orders:[order],menu:menu(.016),observedAt:'2026-11-10T00:00:00Z'});
test('separate candidate snapshot preserves rates and earnings across retroactive timeline changes without modifying reports',async()=>{
 const input=[report],before=structuredClone(input),p=await preview(input),later=attachLaborReferences(input,[order],menu(.025));
 assert.equal(referenceReportBasis(later[0]).unit,.025);
 const kept=await applyFixedLaborReferences(later,p.manifest);
 assert.equal(referenceReportBasis(kept[0]).unit,.016);assert.equal(kept[0].laborReference.frozen,true);
 assert.equal(monthlyEarnedOrders([order],kept,'2026-10','A')[0].earned,1.6);assert.deepEqual(input,before);assert.deepEqual(kept[0].hours,report.hours);
});
test('changed report, absent entry and altered manifest cannot borrow a new timeline rate; saved basis wins',async()=>{
 const p=await preview([report]);
 for(const patch of [{version:2},{approvedQuantity:101},{productionDate:'2026-10-21'},{hours:{total:5}},{id:'OTHER'}]){
  const r={...report,...patch},[result]=await applyFixedLaborReferences(attachLaborReferences([r],[order],menu(.025)),p.manifest);assert.equal(referenceReportBasis(result).unit,null);
 }
 const saved={...report,standardUnit:.012};assert.equal(referenceReportBasis((await applyFixedLaborReferences([saved],p.manifest))[0]).unit,.012);
 const altered=structuredClone(p.manifest);altered.entries[0].reference.basis.value=99;await assert.rejects(applyFixedLaborReferences([report],altered),/Invalid/);
});
test('preview keeps every input row classified, preserves zero and never invents missing evidence',async()=>{
 const input=[report,{...report,id:'OLD',productionDate:'2026-09-30'},{...report,id:'SAVED',standardUnit:0},{...report,id:'NO',sku:'UNKNOWN'},{...report,id:'CANCEL',cancelled:true}];
 const p=await preview(input);assert.equal(p.rows.length,input.length);assert.deepEqual(p.counts,{'fixed-candidate':1,'out-of-scope':1,'preserve-stored':1,'missing':1,'not-applicable':1});assert.equal(p.manifest.entries.length,1);
});
