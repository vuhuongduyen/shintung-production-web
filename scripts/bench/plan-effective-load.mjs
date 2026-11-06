// Optional synthetic-only benchmark, not CI. No network/production bindings.
import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {workflowGetFixture} from '../../tests/helpers/workflow-get-fixture.mjs';
import {activateDailyPolicy} from '../../tests/helpers/activate-daily-policy.mjs';
import {records} from '../local/database.mjs';
import {getPlan,mutatePlan} from '../local/production-plan.mjs';
const baseline=process.env.ONSPA_TEST_PLAN_BASELINE_MODULE?await import(pathToFileURL(process.env.ONSPA_TEST_PLAN_BASELINE_MODULE).href):null;
const week='2026-11-02',sku='SYNTHETIC-SKU',actor={login:'SYNTHETIC-KHSX',isAdmin:true,canEditPlan:true};
for(const count of [50,500]){
 const c=await workflowGetFixture(2),put=(e,k,v)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(e,k,JSON.stringify(v),'SYNTHETIC','now').run();
 try{
  const rows=Array.from({length:count},(_,i)=>({id:'SYNTHETIC-PLAN-'+i,planGroupId:'SYNTHETIC-PLAN-0',groupPlanId:'SYNTHETIC-GROUP',planId:'SYNTHETIC-GROUP',...(i?{splitFromId:'SYNTHETIC-PLAN-0'}:{}),sku,week,line:'A',start:'2026-11-05',end:'2026-11-06',plan:1,suggested:i?null:count,laborHour:.2,status:'DỰ KIẾN'}));
  await put('production_plan',week,{schemaVersion:2,week,revision:0,rows});await put('labor_hours',sku,{sku,laborHour:.2,effectiveVersions:[{id:'SYNTHETIC-RATE',status:'published',value:.2,validFrom:'2026-11-01'}]});await put('capacity',week,{schemaVersion:1,week,rows:[{week,line:'A',status:'Đã xác nhận',version:1,availableHours:1000}]});await put('leadtime',sku,{sku,leadTime:2});await activateDailyPolicy(c.db);
  let selects=0,batches=0;const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^\s*(SELECT|WITH)\b/i.test(sql))selects++;return target.prepare(sql);};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
  const samples={before:[],after:[]};let reference;
  for(let i=0;i<3;i++)for(const [label,read]of [...(baseline?[['before',baseline.getPlan]]:[]),['after',getPlan]]){selects=0;batches=0;const start=performance.now(),value=await read(db,week,true);const ms=performance.now()-start;if(reference)assert.deepEqual(value,reference);else reference=value;assert.equal(batches,0);samples[label].push({ms:+ms.toFixed(2),selects});}
  const source=(await records(c.db)).filter(r=>r.entity==='production_report'),start=performance.now();selects=0;batches=0;let requests=1,result;
  const body={action:'close',week,revision:0,ids:[rows[0].id]};try{result=await mutatePlan(db,body,actor);}catch(e){if(e.message!=='dailyCapacityConfirmation')throw e;requests++;result=await mutatePlan(db,{...body,dailyCapacityAck:JSON.parse(e.details[0].reason).token},actor);}
  const closed={ms:+(performance.now()-start).toFixed(2),selects,batches,requests};assert.equal(result.rows[0].status,'ĐÃ CHỐT');assert.equal(result.rows[0].planLeadtimeBasis.value,2);assert.equal(result.rows[0].planLaborBasis.value,.2);assert.deepEqual((await records(c.db)).filter(r=>r.entity==='production_report'),source);
  console.log(JSON.stringify({synthetic:true,rows:count,get:samples,close:closed,equalReadResults:!!baseline,reportRecordsUnchanged:true,limits:'Node/Miniflare handler only; 3 GET samples/1 close; no HTTP/browser/Google/WorkerCPU/peak-memory/p95'}));
 }finally{await c.close();}
}
