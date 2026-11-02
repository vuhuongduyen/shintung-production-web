// Display-only links. Never infer a transfer from time alone or mutate events.
const key=e=>e.stageReporting&&e.recordedAt&&e.effectiveAt&&(e.actorId||e.actor)?JSON.stringify([e.recordedAt,e.effectiveAt,e.actorId||e.actor,e.line,!!e.voided]):null;
const ids=(e,side)=>(e[side]?.people||[]).map(String);
const delta=(e,side,other)=>ids(e,side).filter(id=>!ids(e,other).includes(id));
export function staffTransferDetails(events){
 const batches=new Map(),details=new Map(),hidden=new Set();
 for(const e of events){const k=key(e);if(k){if(!batches.has(k))batches.set(k,[]);batches.get(k).push(e);}}
 for(const batch of batches.values()){
  const edges=[];
  for(const from of batch)for(const id of delta(from,'stageBefore','stageAfter')){
   const sources=batch.filter(e=>delta(e,'stageBefore','stageAfter').includes(id));
   const targets=batch.filter(e=>e.id!==from.id&&delta(e,'stageAfter','stageBefore').includes(id));
   if(sources.length!==1||targets.length!==1)continue;
   const to=targets[0];if(from.stageAction!=='transfer'&&to.stageAction!=='transfer')continue;
   edges.push({employeeId:id,fromEventId:from.id,toEventId:to.id,fromOrderId:from.sourceId,fromOrder:from.lsxCode,fromStage:from.stageName,toOrderId:to.sourceId,toOrder:to.lsxCode,toStage:to.stageName,at:to.effectiveAt});
  }
  for(const e of batch){const linked=edges.filter(r=>r.fromEventId===e.id||r.toEventId===e.id);if(linked.length)details.set(e.id,linked);
   if(e.stageAction==='transfer'){
    const changed=[...delta(e,'stageBefore','stageAfter'),...delta(e,'stageAfter','stageBefore')];
    const attached=linked.filter(r=>batch.some(p=>p.stageAction!=='transfer'&&(p.id===r.fromEventId||p.id===r.toEventId)));
    if(changed.length&&changed.every(id=>attached.some(r=>r.employeeId===id)))hidden.add(e.id);
   }
  }
 }
 return {details,hidden};
}
