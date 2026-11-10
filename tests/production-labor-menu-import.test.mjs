import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {siteApi} from '../worker/site-api.mjs';import {records} from '../scripts/local/database.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';import {previewFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';
import {previewMenuPreservation} from '../lib/production-labor-menu-preservation.mjs';import {importLaborReferenceSnapshot} from '../scripts/local/production-labor-reference-import.mjs';
import {readLaborReferences} from '../scripts/local/production-labor-reference.mjs';import {referenceReportBasis} from '../lib/production-labor-reference.mjs';
const hostname='onspa-thu-nghiem.shintung-vn-4458.chatgpt.site',actor={isAdmin:true,login:'SYNTHETIC',grants:[]},entity='production_labor_reference_snapshot',observedAt=new Date().toISOString();
async function setup(c){
 const raw={id:'SYNTHETIC-OLD',transitId:c.order.id,sku:c.order.sku,kind:'completion',stageName:'FINAL',line:'A',version:1,reviewStatus:'Đã xác nhận',approvedQuantity:8,reportedQuantity:8,productionDate:'2026-11-02',completedAt:'2026-11-02T03:00:00Z',hours:{total:3}};await c.put('production_report',raw.id,raw);
 const call=await reviewer(c,siteApi),w=(await call('/api/production-workflow')).body;
 const labor=(await records(c.db)).filter(r=>r.entity==='labor_hours').map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at,updatedBy:r.updated_by}));
 const parent=(await previewFixedLaborReferences({reports:w.reports,orders:w.orders,menu:siteLaborHours(labor),observedAt})).manifest;await c.put(entity,parent.digest,parent);
 const p=await previewMenuPreservation({reports:w.reports,orders:w.orders,menu:siteLaborHours(labor,'2026-11-10'),parentManifest:parent,month:'2026-11',observedAt});
 const body={action:'preview',manifest:p.manifest,omissions:[]};const preview=await importLaborReferenceSnapshot(c.db,body,actor,{hostname});
 return {raw,w,parent,body,apply:{...body,action:'apply',confirmDigest:p.manifest.digest,expectedSourceRevision:preview.sourceRevision}};
}
test('menu preservation preview/apply/readback/retry and rollback config retain all originals and prior registry',()=>dailyFixture(async c=>{
 const f=await setup(c),before=await records(c.db),r=await importLaborReferenceSnapshot(c.db,f.apply,actor,{hostname});assert.equal(r.status,'stored');
 const after=await records(c.db);assert.deepEqual(after.filter(r=>r.record_key!==f.body.manifest.digest),before);assert.equal((await importLaborReferenceSnapshot(c.db,f.apply,actor,{hostname})).status,'already-present');
 const pinned=await readLaborReferences(c.db,f.w,undefined,f.body.manifest.digest);assert.equal(referenceReportBasis(pinned.reports.find(r=>r.id===f.raw.id)).unit,.2);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.laborHour',0.8,'$.effectiveVersions[1].value',0.8) WHERE entity='labor_hours'").run();
 const stable=await readLaborReferences(c.db,f.w,undefined,f.body.manifest.digest);assert.equal(referenceReportBasis(stable.reports.find(r=>r.id===f.raw.id)).unit,.2);
 const reverted=await readLaborReferences(c.db,f.w,undefined,f.parent.digest);assert.equal(referenceReportBasis(reverted.reports.find(r=>r.id===f.raw.id)).unit,.1);
}));
test('menu source changes and forged observed values are refused before writes',()=>dailyFixture(async c=>{
 const f=await setup(c);await c.db.prepare("UPDATE app_records SET updated_at='CHANGED' WHERE entity='labor_hours'").run();
 await assert.rejects(importLaborReferenceSnapshot(c.db,f.apply,actor,{hostname}));assert.equal((await records(c.db)).filter(r=>r.entity===entity).length,1);
}));
test('parent registry mutation during final batch aborts atomically',()=>dailyFixture(async c=>{
 const f=await setup(c);const db=new Proxy(c.db,{get(t,k){if(k==='batch')return async s=>{if(s.length>2)await c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=?').bind('{}',entity,f.parent.digest).run();return t.batch(s);};const v=t[k];return typeof v==='function'?v.bind(t):v;}});
 await assert.rejects(importLaborReferenceSnapshot(db,f.apply,actor,{hostname}),/Giao dịch/);assert.equal((await records(c.db)).filter(r=>r.record_key===f.body.manifest.digest).length,0);
}));
