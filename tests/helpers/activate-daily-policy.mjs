// Synthetic fixtures only. This helper is never imported by runtime code.
import {readProductionWorkflow} from '../../scripts/local/production-workflow.mjs';
import {captureLegacyPreservation} from '../../lib/production-legacy-preservation.mjs';
import {siteCatalog} from '../../lib/site-catalog.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {records} from '../../scripts/local/database.mjs';
export async function activateDailyPolicy(db,{effectiveFrom='2026-11-01'}={}){
 const source=await records(db),actor={login:'SYNTHETIC-PRESERVER',isAdmin:true},workflow=await readProductionWorkflow(db,actor,siteCatalog(source.filter(r=>r.entity==='sku').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)})))),rateRows=source.filter(r=>r.entity==='labor_hours').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));
 const standards=new Map(siteLaborHours(rateRows).filter(r=>!r.payload._deleted&&!r.payload.cancelled&&r.payload.status!=='Đã hủy'&&r.payload.laborHour!=null).map(r=>[r.key,Number(r.payload.laborHour)]));
 const rawReports=[...source.filter(r=>r.entity==='production_history_import').flatMap(r=>JSON.parse(r.payload).reports||[]),...source.filter(r=>r.entity==='production_report').map(r=>({...JSON.parse(r.payload),id:r.record_key}))];
 const rawOrders=source.filter(r=>r.entity==='in_transit').map(r=>({...JSON.parse(r.payload),id:r.record_key})),snapshotId='SYNTHETIC-'+crypto.randomUUID(),now=new Date().toISOString();
 const p=await captureLegacyPreservation({workflow,standards,snapshotId,observedAt:now,cutoverDate:effectiveFrom,rawReports,rawOrders});
 const put=(entity,key,value)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,key,JSON.stringify(value),actor.login,now);
 await db.batch([put('production_legacy_manifest',snapshotId,p.manifest),...p.basis.map(b=>put('production_legacy_basis',`${snapshotId}:${b.id}`,b)),...p.monthly.map(m=>put('production_legacy_month',`${snapshotId}:${m.month}`,m)),...p.orders.map(o=>put('production_legacy_order',`${snapshotId}:${o.orderId}`,o)),put('production_reporting_policy','global',{mode:'daily-finished-v1',approved:true,effectiveFrom,revision:1,legacySnapshotId:snapshotId})]);
 return p;
}
