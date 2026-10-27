import {hoursForOrder} from './production-hours.mjs';
import {productionActionNames} from './production-journal.mjs';
// Use the same per-worker calculation as production reporting; this is a read-only total.
const dayMs=86400000,offset=7*3600000;
function laborHours(from,to,schedule,events,orderId,attendance) {
 let total=0,complete=true;
 for(let midnight=Math.floor((from+offset)/dayMs)*dayMs-offset;midnight<to;midnight+=dayMs){
  const date=new Date(midnight+offset).toISOString().slice(0,10);
  if(!schedule[date]){complete=false;continue;}
  const hours=hoursForOrder(events,schedule,orderId,new Date(Math.max(from,midnight)).toISOString(),new Date(Math.min(to,midnight+dayMs)).toISOString(),attendance);
  // Retain precision across journal events; round only the cumulative display value.
  total+=hours.staffing.reduce((sum,span)=>sum+span.count*(Date.parse(span.to)-Date.parse(span.from))/3600000,0);
 }
 return {hours:total,complete};
}
export function timeJournalHours(events,orderId,schedule,attendance=null) {
 const relevant=events.filter(e=>!e.voided&&e.approved!==false&&(e.sourceId===orderId||e.destinationId===orderId)&&Number.isFinite(Date.parse(e.effectiveAt)))
  .sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||'')));
 const result=new Map();let running=false,known=false,total=0,previous=null,complete=true;
 for(const event of relevant){const now=Date.parse(event.effectiveAt);
  if(previous!==null&&running&&now>previous){const span=laborHours(previous,now,schedule,events,orderId,attendance);total+=span.hours;complete&&=span.complete;}
  if(event.kind==='start'&&event.sourceId===orderId||event.kind==='transfer'&&event.destinationId===orderId&&!event.destinationIncludedInStart){running=true;known=true;}
  if(event.sourceId===orderId){if(event.kind==='resume')running=true;if(event.kind==='pause'||event.kind==='incident'&&event.stopWork||event.kind==='complete'&&event.finalCompletion)running=false;}
  result.set(event.id,known&&complete?Math.round(total*10000)/10000:null);previous=now;
 }
 return result;
}
export const timeJournalEventNames=productionActionNames;
export const timeJournalColumns=['Thời gian hệ thống ghi nhận','Plan ID','LSX','SKU','Tên sản phẩm','Quy cách','Line','Công đoạn','Sự kiện','Thời gian sự kiện','SL hoàn thành lần này','SL hoàn thành lũy kế','Tổng giờ công lũy kế','Nguồn','Người thao tác (ID)','Lý do điều chỉnh thời gian'];


const orderKey=row=>row.sourceId||row.transitId||row.lsx||`unlinked:${row.id}`;
const eventTime=row=>Date.parse(row.effectiveAt||row.recordedAt)||0;
export function groupTimeJournalRows(rows,allRows=rows) {
 const colorKeys=[...new Set(allRows.map(orderKey))].sort();
 const colors=new Map(colorKeys.map((key,index)=>[key,Math.round(index*137.508)%360]));
 const groups=new Map();
 for(const row of rows){const key=orderKey(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups.entries()].sort(([a,left],[b,right])=>Math.max(...right.map(eventTime))-Math.max(...left.map(eventTime))||String(a).localeCompare(String(b)))
  .flatMap(([key,group])=>group.sort((a,b)=>eventTime(a)-eventTime(b)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||''))||String(a.id).localeCompare(String(b.id)))
   .map((row,index)=>({...row,journalGroup:key,journalGroupHue:colors.get(key),journalGroupStart:index===0,journalGroupEnd:index===group.length-1})));
}

export function timeJournalQuantities(rows,reports) {
 const totals=new Map();
 return groupTimeJournalRows(rows).map(row=>{
  if(row.sourceTimeLog&&row.sourceVerified){
   const own=reports.filter(r=>r.transitId===row.sourceId&&!r.cancelled&&!r.voided&&!r.replacedByStageBatch&&(!row.erpStageImport||(r.erpStageImport&&(r.stageCode||r.stageName)===(row.stageCode||row.stageName)))&&Date.parse(r.completedAt)<=Date.parse(row.effectiveAt));
   const at=Date.parse(row.effectiveAt),matched=own.filter(r=>Date.parse(r.completedAt)===at);
   const known=own.length>0&&own.every(r=>r.hours?.total!=null&&Number.isFinite(Number(r.hours.total)));
   const cumulativeLaborHours=matched.length&&known?own.reduce((sum,r)=>sum+Number(r.hours.total),0):row.cumulativeLaborHours;
   const completedQuantity=['HOÀN THÀNH','Xuất trạm'].includes(row.sourceOperation)&&matched.length?matched.reduce((sum,r)=>sum+Number(row.erpStageImport?(r.stageQuantity??r.reportedQuantity??0):(r.reportedQuantity||0)),0):row.sourceQuantityEvent?Number(row.quantity):null;
   return {...row,cumulativeLaborHours,completedQuantity,cumulativeQuantity:own.reduce((s,r)=>s+Number(row.erpStageImport?(r.stageQuantity??r.reportedQuantity??0):(r.reportedQuantity||0)),0)};
  }
  if(row.stageReporting){const own=reports.filter(r=>r.transitId===row.sourceId&&r.stageName===row.stageName&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh'&&Date.parse(r.completedAt)<=Date.parse(row.effectiveAt));return {...row,completedQuantity:row.stageAction==='complete'?Number(own.find(r=>r.id===row.reportId)?.stageQuantity||0):null,cumulativeQuantity:own.reduce((n,r)=>n+Number(r.stageQuantity||0),0)};}
  const key=orderKey(row);let state=totals.get(key)||{total:0,known:true};
  let quantity=null;
  if(row.kind==='complete'){
   const report=reports.find(r=>r.id===row.reportId);
   const raw=report?.reportedQuantity??row.quantity;
   quantity=raw==null||!Number.isFinite(Number(raw))?null:Number(raw);
   if(!row.voided&&!row.cancelled&&!report?.cancelled&&report?.reviewStatus!=='Đã hủy'){
    if(quantity===null)state.known=false;else state.total+=quantity;
   }
  }
  totals.set(key,state);
  return {...row,completedQuantity:quantity,cumulativeQuantity:state.known?state.total:null};
 });
}
