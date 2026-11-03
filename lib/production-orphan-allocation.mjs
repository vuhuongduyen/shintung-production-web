import {incidentStage} from './production-incidents.mjs';
// Explicit legacy add into a closed/unstarted stage is allocation evidence only.
// Never infer a missing admission from a report or a transfer without this evidence.
export function orphanStageAllocation(events,orderId,stage,at){
 const history=events.filter(e=>!e.voided&&!e.cancelled&&e.stageReporting&&e.sourceId===orderId&&incidentStage(e.stageName)===incidentStage(stage)&&Date.parse(e.effectiveAt)<=at).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||((Date.parse(a.recordedAt)||0)-(Date.parse(b.recordedAt)||0)));
 let orphan=null;
 for(const e of history){
  if(['start','extra','complete'].includes(e.stageAction)){orphan=null;continue;}
  if(e.stageAction==='add'&&['waiting','partial'].includes(e.stageBefore?.status)&&(!Number.isFinite(Number(e.stageBefore?.admittedQuantity))||Number(e.stageBefore.admittedQuantity)<=Number(e.stageBefore.completed||0))){orphan={event:e,people:e.stageAfter?.people||[]};continue;}
  if(orphan&&['add','transfer','pause','resume'].includes(e.stageAction))orphan={...orphan,people:e.stageAfter?.people||[]};
 }
 return orphan?.people.length?orphan:null;
}

// Carry the repaired exit through later no-op additions / outgoing transfers.
// A genuinely new assignment or production action must never be erased.
export function repairOrphanCarry(event,people){
 if(!['add','transfer'].includes(event.stageAction)||!event.stageBefore||!event.stageAfter)return null;
 const before=event.stageBefore,after=event.stageAfter,old=before.people||[],next=after.people||[];
 if(next.some(id=>!old.includes(id))||Number(before.completed||0)!==Number(after.completed||0))return null;
 if(!['waiting','partial','paused'].includes(before.status)||!['waiting','partial','paused'].includes(after.status))return null;
 const clean=s=>({...s,people:(s.people||[]).filter(id=>!people.includes(id))});
 const stageBefore=clean(before),stageAfter=clean(after);
 return {...event,stageBefore,stageAfter,employees:stageAfter.people,count:stageAfter.people.length};
}
