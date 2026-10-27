import {assignedAt} from './production-hours.mjs';
// Operating state and known staffing are independent for orders carried from Sheets.
export function productionRuntime(order,events,at=Date.now()) {
 const live=events.filter(e=>!e.voided&&!e.historicalImport);
 const state=assignedAt(live,order.id,at);
 const own=live.filter(e=>(e.sourceId===order.id||e.destinationId===order.id)&&Date.parse(e.effectiveAt)<=at).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
 const started=String(order.actualStartedAt||'');
 const startTime=Date.parse(started.length===10?`${started}T00:00:00+07:00`:started);
 const legacy=(!started||startTime<=at)&&(Boolean(started)||Number(order.completedQty)>0||/ĐANG SẢN XUẤT|TẠM NGƯNG|TẠM DỪNG/i.test(order.productionState||order.progressStatus||''));
 let known=state.known||legacy,running=state.running;
 if(!state.known&&legacy){
  running=!/TẠM NGƯNG|TẠM DỪNG/i.test(order.productionState||order.progressStatus||'');
  for(const e of own){
   if(e.sourceId!==order.id)continue;
   if(e.kind==='pause'||e.kind==='incident'&&e.stopWork||e.kind==='complete'&&e.finalCompletion)running=false;
   if(e.kind==='resume')running=true;
  }
 }
 const stageState=new Map();for(const e of own){if(e.stageReporting&&e.stageAfter)stageState.set(e.stageName,e.stageAfter);if(e.kind==='stage-incident')for(const [k,v] of stageState)if(e.stages?.includes(k.replace(/^[ABC]-/,'')))stageState.set(k,{...v,status:'paused'});}
 if(stageState.size){known=true;running=[...stageState.values()].some(s=>s.status==='running');state.known=true;state.count=new Set([...stageState.values()].filter(s=>s.status==='running').flatMap(s=>s.people)).size;}
 const completed=Number(order.lsxQty)>0&&Number(order.inTransitQty)===0;
 return {...state,known,staffingKnown:state.known,running:!completed&&running,completed,paused:known&&!running&&!completed};
}
export function reportStart(order,reports,events){
 const previous=reports.filter(r=>r.transitId===order.id&&r.kind==='completion'&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh').map(r=>r.completedAt).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
 return previous||events.filter(e=>!e.voided&&!e.historicalImport&&(e.kind==='start'&&e.sourceId===order.id||e.kind==='transfer'&&e.destinationId===order.id)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt))[0]?.effectiveAt||(String(order.actualStartedAt||'').includes('T')?order.actualStartedAt:'');
}
