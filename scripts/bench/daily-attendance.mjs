// Fresh isolated TEST fixtures only. No production bindings, no existing DB opened.
import {performance} from 'node:perf_hooks';import {workflowGetFixture,hr,manager,week,day,at} from '../../tests/helpers/workflow-get-fixture.mjs';
import {mutateProductionWorkflow} from '../local/production-workflow.mjs';import {dutyDates} from '../../lib/warehouse-duty.mjs';
const results=[];
for(let round=0;round<3;round++)for(const operation of ['HR','QLSX']){const c=await workflowGetFixture(80);try{
 const body=operation==='HR'?{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['SYNTHETIC-NV2'],effectiveAt:at(day,'08:00'),endsAt:at(day,'09:00'),requestIdempotency:crypto.randomUUID()}:{action:'warehouse-duty',week,line:'A',expectedId:null,requestIdempotency:crypto.randomUUID(),rows:dutyDates(week).map((date,i)=>({date,employee:'SYNTHETIC-NV1',start:i===0?'08:00':'',end:i===0?'09:00':''}))};
 let selects=0,batches=0;const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^SELECT/i.test(sql))selects++;return target.prepare(sql);};if(key==='batch')return async a=>{batches++;return target.batch(a);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const start=performance.now(),saved=await mutateProductionWorkflow(db,body,operation==='HR'?hr:manager);const ms=performance.now()-start;
 results.push({operation,round,ms:Number(ms.toFixed(3)),selects,batches,saved:Boolean(saved.event||saved.events?.length)});
 }finally{await c.close();}}
console.log(JSON.stringify({tag:process.argv[2]||'current',node:process.version,fixture:{orders:80,legacyReports:80,legacyEvents:160,employeeDirectory:4,capacityWeeks:1},results,limits:'Local Miniflare wall time, direct handler only. Excludes browser/network/audit wrapper; no production CPU/memory measurement.'}));
