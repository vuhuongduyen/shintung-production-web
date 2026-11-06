// Optional synthetic-only direct-handler benchmark; no HTTP/production binding.
import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {workflowGetFixture} from '../../tests/helpers/workflow-get-fixture.mjs';
import {records} from '../local/database.mjs';
import {mutateTransit,readAdditionalCreationScope,acknowledgeAdditionalCreation} from '../local/in-transit.mjs';
import {capturePlanLeadtime} from '../../lib/transit-leadtime.mjs';
const before=process.env.ONSPA_TEST_TRANSIT_BASELINE_MODULE?await import(pathToFileURL(process.env.ONSPA_TEST_TRANSIT_BASELINE_MODULE).href):null;
const actor={login:'SYNTHETIC-KHSX',isAdmin:true},omit=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['id','createdAt','updatedAt'].includes(k)));
for(const count of [50,500]){
 let reference;const output={};
 for(const [label,create]of [...(before?[['before',before.mutateTransit]]:[]),['after',mutateTransit]]){
  const c=await workflowGetFixture(count);try{
   const sourceKey='SYNTHETIC-LSX0',row=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(sourceKey).first();
   const source={...JSON.parse(row.payload),planRowId:'SYNTHETIC-ROW',planQty:2000,planLaborBasis:{status:'resolved',value:.1,segments:[]}};source.planLeadtimeBasis=capturePlanLeadtime({id:source.planRowId,sku:source.sku,plan:2000},[{sku:source.sku,leadTime:2}],[],'2026-11-02T00:00:00Z',actor.login);
   await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify(source),sourceKey).run();
   const originalReports=(await records(c.db)).filter(r=>r.entity==='production_report');let selects=0,batches=0;
   const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^\s*(SELECT|WITH)\b/i.test(sql))selects++;return target.prepare(sql);};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
   output[label]=[];
   for(let i=0;i<3;i++){
    const sample={},measure=async(name,fn)=>{selects=0;batches=0;const start=performance.now(),value=await fn();sample[name]={ms:+(performance.now()-start).toFixed(2),selects,batches};return value;};
    const scope=label==='after'?await measure('openScope',()=>readAdditionalCreationScope(db,actor)):null;
    const result=await measure('create',()=>create(db,{action:'add-lsx',id:sourceKey,planStart:'2026-11-05',planEnd:'2026-11-06',line:'B',priority:'THƯỜNG',sequence:2,requestIdempotency:crypto.randomUUID(),...(scope?{expectedCreationRevision:scope.revision}:{})},actor));
    if(scope){const restored=await measure('recover',()=>readAdditionalCreationScope(db,actor));assert.equal(restored.pending.rowId,result.row.id);await measure('ack',()=>acknowledgeAdditionalCreation(db,{id:result.row.id,expectedCreationRevision:restored.revision},actor));}
    output[label].push(sample);assert.equal(result.row.pendingReportQty,0);assert.equal(result.row.lsxQty,null);assert.deepEqual(result.row.planLaborBasis,source.planLaborBasis);assert.deepEqual(result.row.planLeadtimeBasis,source.planLeadtimeBasis);
    const value=omit(result.row);if(reference)assert.deepEqual(value,reference);else reference=value;
   }
   assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(sourceKey).first()).payload,JSON.stringify(source));assert.deepEqual((await records(c.db)).filter(r=>r.entity==='production_report'),originalReports);
  }finally{await c.close();}
 }
 console.log(JSON.stringify({synthetic:true,initialOrders:count,reports:count,events:count*2,samples:output,businessOutputEqual:!!before,sourceAndReportsUnchanged:true,limits:'3 operations per fresh fixture; after includes separate open-scope/create/recovery/ACK phases, before is the caller-supplied baseline create (identify source SHA separately); seed excluded; direct Node/Miniflare handler; not HTTP/auth/catalog load/browser/Google/WorkerCPU/peak-memory/p95'}));
}
