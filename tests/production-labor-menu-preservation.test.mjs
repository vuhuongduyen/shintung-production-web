import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMenuPreservation,applyMenuPreservation,preservationDigest} from '../lib/production-labor-menu-preservation.mjs';
import {previewFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';
import {referenceReportBasis,attachLaborReferences,laborReferenceLabel} from '../lib/production-labor-reference.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
const observedAt='2026-11-10T00:00:00Z',orders=[{id:'O',sku:'TEST',line:'A',lsxCode:'TEST'}];
const report=(id,date='2026-10-09',qty=8)=>({id,transitId:'O',kind:'completion',reviewStatus:'Đã xác nhận',productionDate:date,reportedQuantity:qty,approvedQuantity:qty,version:1,sku:'TEST',hours:{total:3}});
const menu=[{key:'TEST',updatedAt:observedAt,payload:{sku:'TEST',laborHour:.046,version:2,resolvedRateVersions:[{id:'old',status:'published',validFrom:'2026-09-01',value:.02}]}}];
async function setup(reports=[report('old')]){const parentManifest=(await previewFixedLaborReferences({reports,orders,menu,observedAt})).manifest;return {reports,orders,menu,parentManifest,month:'2026-10',observedAt};}
test('menu baseline preserves October output and actual data after menu changes; prior registry survives',async()=>{
 const input=await setup([report('old'),report('prior','2026-09-30',2000),report('later','2026-11-01',2000)]),before=structuredClone(input);
 const p=await previewMenuPreservation(input);assert.equal(p.summary.reports,1);assert.equal(p.summary.quantity,8);assert.equal(p.summary.knownEarned,.368);
 const changed=structuredClone(menu);changed[0].payload.laborHour=.9;changed[0].payload.resolvedRateVersions[0].value=.7;
 const projected=attachLaborReferences(input.reports,orders,changed),after=await applyMenuPreservation(projected,p.manifest,orders);
 assert.equal(referenceReportBasis(after[0]).unit,.046);assert.equal(referenceReportBasis(after[0]).earned,.368);assert.equal(referenceReportBasis(after[2]).unit,.02);
 assert.equal(monthlyEarnedOrders(orders,after,'2026-10','A')[0].qty,8);assert.equal(monthlyEarnedOrders(orders,after,'2026-10','A')[0].earned,.368);
 assert.deepEqual(input,before);for(let i=0;i<after.length;i++)assert.deepEqual(after[i].hours,input.reports[i].hours);
 assert.match(laborReferenceLabel([after[0].laborReference]),/Menu tại/);
});
test('changed identity/version/quantity fails closed; new IDs do not inherit old menu and stored new basis wins',async()=>{
 const input=await setup(),p=await previewMenuPreservation(input);
 for(const patch of [{sku:'OTHER'},{version:2},{approvedQuantity:9},{orderSnapshot:{sku:'OTHER'}}]){
  const r=(await applyMenuPreservation([{...input.reports[0],...patch}],p.manifest,orders))[0];assert.equal(referenceReportBasis(r).unit,null);
 }
 const fresh={...report('new','2026-11-11'),standardUnit:.1};const output=await applyMenuPreservation([fresh,report('unverified')],p.manifest,orders);
 assert.equal(referenceReportBasis(output[0]).unit,.1);assert.equal(referenceReportBasis(output[1]).unit,null);
});
test('zero is retained, missing stays missing, existing stored basis never overwritten',async()=>{
 for(const value of [0,null,'',undefined]){const input=await setup();input.menu=structuredClone(menu);input.menu[0].payload.laborHour=value;
 const p=await previewMenuPreservation(input),after=await applyMenuPreservation(input.reports,p.manifest,orders);assert.equal(referenceReportBasis(after[0]).unit,value===0?0:null);assert.equal(after.length,1);}
 const input=await setup([{...report('saved'),standardUnit:.123}]);const p=await previewMenuPreservation(input);assert.equal(p.manifest.entries.length,0);assert.equal(p.rows[0].unit,.123);
});
test('tamper, duplicate, missing parent and invalid scope reject',async()=>{
 const input=await setup(),p=await previewMenuPreservation(input),bad=structuredClone(p.manifest);bad.entries[0].reference.unit=1;
 await assert.rejects(applyMenuPreservation(input.reports,bad,orders));
 await assert.rejects(previewMenuPreservation({...input,parentManifest:null}));
 await assert.rejects(previewMenuPreservation({...input,month:'2026-09'}));
 const duplicate=structuredClone(p.manifest);duplicate.entries.push(duplicate.entries[0]);const {digest,...body}=duplicate;duplicate.digest=await preservationDigest(body);await assert.rejects(applyMenuPreservation(input.reports,duplicate,orders));
});
test('existing invalid/daily bases are not repaired by a current menu observation',async()=>{
 for(const patch of [{standardUnit:'invalid'},{rateBasis:{value:99}},{reportingModel:'daily-finished-v1',quantityOnly:true,rateStatus:'missing'}]){
 const input=await setup([{...report('protected'),...patch}]),p=await previewMenuPreservation(input);assert.equal(p.manifest.entries.length,0);assert.equal(p.rows[0].unit,null);assert.equal(p.rows[0].status,'preserve-unresolved');
 }
});
