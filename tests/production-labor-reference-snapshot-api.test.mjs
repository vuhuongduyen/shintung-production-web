import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {siteApi} from '../worker/site-api.mjs';import {records} from '../scripts/local/database.mjs';
import {previewFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';
import {referenceReportBasis} from '../lib/production-labor-reference.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
test('configured separate registry fixes read results across retroactive updates without writing original reports',()=>dailyFixture(async c=>{
 const raw={id:'SYNTHETIC-LEGACY',transitId:c.order.id,kind:'completion',sku:c.order.sku,orderSnapshot:{id:c.order.id,sku:c.order.sku,line:'A'},line:'A',version:1,stageName:'FINAL',reviewStatus:'Đã xác nhận',approvedQuantity:100,reportedQuantity:100,completedAt:'2026-11-02T03:00:00Z',hours:{hc:3,ot:1,total:4}};
 await c.put('production_report',raw.id,raw);
 for(const [suffix,reviewStatus] of [['CONFIRMED','Đã xác nhận'],['PENDING','Chờ kiểm tra']])await c.put('production_report','SYNTHETIC-ZERO-'+suffix,{...raw,id:'SYNTHETIC-ZERO-'+suffix,stageName:'CUT',reportedQuantity:0,approvedQuantity:0,reviewStatus});
 let snapshotId;
 const call=await reviewer(c,(request,env)=>siteApi(request,{...env,LABOR_RATE_SNAPSHOT_ID:snapshotId}));
 const first=await call('/api/production-workflow');assert.equal(first.status,200);
 const menuResponse=await call('/api/records?entity=labor_hours');
 const preview=await previewFixedLaborReferences({reports:first.body.reports,orders:first.body.orders,menu:siteLaborHours(menuResponse.body.records),observedAt:'2026-11-10T00:00:00Z'});
 assert.equal(preview.manifest.entries.length,1);
 // Explicit synthetic test setup only. Production code has no registry writer.
 await c.put('production_labor_reference_snapshot',preview.manifest.digest,preview.manifest);snapshotId=preview.manifest.digest;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku:c.order.sku,version:9,laborHour:9,updatedAt:'2026-11-10',effectiveFrom:'2026-11-01',effectiveVersions:[{id:'SYNTHETIC-RETRO',status:'published',value:9,validFrom:'2026-11-01'}]}),c.order.sku).run();
 const before=await records(c.db),response=await call('/api/production-workflow');assert.equal(response.status,200);
 const found=response.body.reports.find(r=>r.id===raw.id);assert.equal(referenceReportBasis(found).unit,.1);assert.equal(found.laborReference.frozen,true);assert.deepEqual(found.hours,raw.hours);
 for(const zero of response.body.reports.filter(r=>r.id.startsWith('SYNTHETIC-ZERO-'))){assert.equal(referenceReportBasis(zero).unit,9);assert.equal(referenceReportBasis(zero).earned,0);assert.deepEqual(zero.hours,raw.hours);}
 assert.deepEqual(await records(c.db),before);
 await c.put('labor_hours','SYNTHETIC-OTHER-SKU',{sku:'SYNTHETIC-OTHER-SKU',version:1,laborHour:.9,updatedAt:'2026-11-01T00:00:00Z'});
 const identityChanged={...raw,orderSnapshot:{...raw.orderSnapshot,sku:'SYNTHETIC-OTHER-SKU'}};
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(identityChanged),raw.id).run();
 const blockedIdentity=await call('/api/production-workflow');assert.equal(referenceReportBasis(blockedIdentity.body.reports.find(r=>r.id===raw.id)).unit,null);
 snapshotId=undefined;const unpinned=await call('/api/production-workflow');assert.equal(referenceReportBasis(unpinned.body.reports.find(r=>r.id===raw.id)).unit,.9);snapshotId=preview.manifest.digest;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...raw,version:2,approvedQuantity:99}),raw.id).run();
 const changed=await call('/api/production-workflow');assert.equal(changed.status,200);assert.equal(referenceReportBasis(changed.body.reports.find(r=>r.id===raw.id)).unit,null);
 snapshotId='f'.repeat(64);const missing=await call('/api/production-workflow');assert.equal(missing.status,400);assert.match(missing.body.error,/Configured fixed labor basis is unavailable/);
}));
