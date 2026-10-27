import {incidentStage} from './production-incidents.mjs';
import {stageKey,trialStages} from './production-stage-trial.mjs';
// Read-only projection of verified imported stage history. Never infer a stage
// from an order-level status, nor assign unnamed people to an active stage.
export function importedStageEvents(orders,reports,events){
 const result=[],state={},queue=[],byId=new Map(reports.map(r=>[r.id,r]));
 const valid=r=>!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh';
 const locate=(id,name)=>{const o=orders.find(o=>o.id===id),stage=o&&trialStages(o).find(s=>incidentStage(s)===incidentStage(name));return stage?{o,stage,key:stageKey(id,stage)}:null;};
 for(const r of reports.filter(r=>valid(r)&&r.erpStageImport)){
  const found=locate(r.transitId,r.stageName||r.stageCode);if(!found)continue;
  queue.push({r,found,action:'start',at:r.startedAt,rank:0},{r,found,action:'complete',at:r.completedAt,rank:3});
  for(const p of r.pauses||[])queue.push({r,found,action:'pause',at:p[0],rank:1},{r,found,action:'resume',at:p[1],rank:1});
 }
 const names={'Nhập trạm':'start','Tạm ngưng':'pause','Tiếp tục':'resume','Xuất trạm':'complete','Hủy nhập trạm':'cancel-start'};
 for(const e of events.filter(e=>valid(e)&&e.sourceTimeLog&&e.sourceVerified)){
  const found=locate(e.sourceId,e.stageName||e.stageCode),action=names[e.sourceOperation]||e.sourceRow?.kind;
  if(found&&['start','pause','resume','complete','cancel-start'].includes(action))queue.push({e,found,action,at:e.effectiveAt,rank:2});
 }
 queue.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.rank-b.rank);
 for(const q of queue){if(!Number.isFinite(Date.parse(q.at)))continue;
  const {o,stage,key}=q.found,old=state[key]||{orderId:o.id,stage,people:[],completed:0,status:'waiting'};
  const linked=q.e?.reportId&&byId.get(q.e.reportId),explicit=q.r?.employees||q.e?.employees||q.e?.sourceRow?.employees||(linked&&valid(linked)?linked.employees:undefined);
  const people=explicit?.map(p=>String(typeof p==='string'?p:p.id)).filter(Boolean),next={...old,at:q.at};
  if(q.action==='start'){next.status='running';next.startedAt=q.at;next.people=people||[];}
  if(q.action==='pause'){next.status='paused';next.people=people||old.people;}
  if(q.action==='resume'){next.status='running';next.startedAt=old.startedAt||q.at;next.people=people||old.people;}
  if(q.action==='cancel-start'){next.status=old.completed?'partial':'waiting';next.people=[];next.startedAt=undefined;}
  if(q.action==='complete'){next.completed=old.completed+(q.r?Number(q.r.stageQuantity??q.r.reportedQuantity??0):0);next.status=next.completed>=Number(o.lsxQty)?'done':'partial';next.people=[];}
  // A source event cannot reopen a stage already reported in full.
  if(old.completed>=Number(o.lsxQty)&&q.action!=='complete')continue;
  state[key]=next;
  result.push({...(q.e||{}),id:q.e?.id||`stage-history:${q.r.id}:${q.action}:${q.at}`,kind:'stage-work',stageReporting:true,importedStageProjection:true,historicalImport:true,sourceId:o.id,line:o.line,stageName:stage,stageBefore:old,stageAfter:next,effectiveAt:q.at,recordedAt:q.e?.recordedAt||q.r?.reportedAt||q.at,employees:next.people});
 }
 return result;
}
