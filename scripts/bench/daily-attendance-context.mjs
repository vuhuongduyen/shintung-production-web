// Isolated synthetic TEST databases only; preparation is outside the timed mutation.
import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';import {workflowGetFixture,hr,manager,week,day,at} from '../../tests/helpers/workflow-get-fixture.mjs';
import {activateDailyPolicy} from '../../tests/helpers/activate-daily-policy.mjs';import {mutateProductionWorkflow} from '../local/production-workflow.mjs';import {dutyDates} from '../../lib/warehouse-duty.mjs';
const baseline=process.argv[2]?(await import(pathToFileURL(process.argv[2]).href)).mutateProductionWorkflow:null,results=[];
for(const count of [80,2000])for(const operation of ['HR','QLSX'])for(let round=0;round<2;round++)for(const [version,handler] of [...(baseline?[['before',baseline]]:[]),['after',mutateProductionWorkflow]]){
 const c=await workflowGetFixture(count);try{await activateDailyPolicy(c.db,{effectiveFrom:day});
 const body=operation==='HR'?{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['SYNTHETIC-NV2'],effectiveAt:at(day,'08:00'),endsAt:at(day,'09:00'),requestIdempotency:crypto.randomUUID()}:{action:'warehouse-duty',week,line:'A',expectedId:null,requestIdempotency:crypto.randomUUID(),rows:dutyDates(week).map((date,i)=>({date,employee:'SYNTHETIC-NV1',start:i===0?'08:00':'',end:i===0?'09:00':''}))};
 let selects=0,batches=0;const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^SELECT/i.test(sql))selects++;return target.prepare(sql);};if(key==='batch')return async a=>{batches++;return target.batch(a);};const v=target[key];return typeof v==='function'?v.bind(target):v;}}),start=performance.now(),saved=await handler(db,body,operation==='HR'?hr:manager);
 results.push({count,operation,round,version,ms:Number((performance.now()-start).toFixed(3)),selects,batches,saved:Boolean(saved.event||saved.events?.length)});
 }finally{await c.close();}}
console.log(JSON.stringify({node:process.version,results,limits:'Direct-handler local Miniflare wall time. Preparation excluded. Same fixture sizes, two fresh samples. Not browser/network or production CPU/memory measurement.'}));
