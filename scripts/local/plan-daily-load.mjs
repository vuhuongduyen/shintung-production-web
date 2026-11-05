import {readPlanTransitBacklog} from './plan-transit-backlog.mjs';
import {combinePlanBacklog} from '../../lib/plan-transit-backlog.mjs';
import {createHash} from 'node:crypto';
import {planDailyLoad} from '../../lib/plan-daily-load.mjs';
import {applyPlanLaborBasis} from '../../lib/plan-effective-basis.mjs';
export async function checkPlanDailyLoad(db,week,next,ids,labor,{effectivePlanning=false}={}){
 const {results}=await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_plan','capacity') ORDER BY entity,record_key").all();
 const plans=[],capacities=[];for(const r of results){let p;try{p=JSON.parse(r.payload);}catch{continue;}if(p._deleted)continue;
  if(r.entity==='capacity')capacities.push(...(p.rows||[]));
  else if(r.record_key!==week)plans.push(...(p.rows||[]));
 }
 plans.push(...next);
 const standards=new Map(labor.map(r=>[r.sku,r.laborHour]));
 const dated=new Map(labor.map(r=>[String(r.sku).toUpperCase(),r]));
 const current=plans.map(r=>effectivePlanning?applyPlanLaborBasis(r,dated):!['ĐÃ CHỐT','ĐÃ CHUYỂN'].includes(r.status)&&standards.has(r.sku)?{...r,laborHour:standards.get(r.sku)}:r);
 const backlog=await readPlanTransitBacklog(db,week,labor);
 const combined=combinePlanBacklog(current,backlog);
 const editedLines=new Set(current.filter(r=>ids.includes(r.id)).map(r=>r.line));
 const backlogRows=backlog.rows.filter(r=>editedLines.has(r.line));
 const projection={...planDailyLoad(combined,capacities,ids,backlogRows.map(r=>r.id)),backlog:backlogRows};
 // Approval is valid only for this exact edit and its current scheduling basis.
 const token=createHash('sha256').update(JSON.stringify({week,ids,current:current.map(({id,week,line,start,end,plan,laborHour,status,sequence,_deleted})=>({id,week,line,start,end,plan,laborHour,status,sequence,_deleted})),capacities,projection})).digest('hex');
 return {...projection,token};
}
