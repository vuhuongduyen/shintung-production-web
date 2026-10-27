import {correctionOperation} from './production-correction-display.mjs';
export const correctionStage=e=>String(e.stageName||e.stage||e.process||e.processCode||e.stageCode||'').trim().replace(/^[ABC]\s*[-–]\s*/i,'');
export function correctionOrderRows(orders,events,reports){
 const ids=[...new Set([...events.map(e=>e.sourceId),...reports.map(r=>r.transitId)].filter(Boolean))];
 const eventsByOrder=new Map(),reportsByOrder=new Map(),ordersById=new Map(orders.map(o=>[o.id,o]));
 for(const e of events)if(!e.voided){if(!eventsByOrder.has(e.sourceId))eventsByOrder.set(e.sourceId,[]);eventsByOrder.get(e.sourceId).push(e);}
 for(const r of reports)if(r.kind==='completion'&&!r.cancelled&&!r.voided){if(!reportsByOrder.has(r.transitId))reportsByOrder.set(r.transitId,[]);reportsByOrder.get(r.transitId).push(r);}
 return ids.map(id=>{
  const own=eventsByOrder.get(id)||[],rs=reportsByOrder.get(id)||[],order=ordersById.get(id)||own[0]?.orderSnapshot||rs[0]?.orderSnapshot||{};
  const total=rs.length&&rs.every(r=>r.hours?.total!=null)?rs.reduce((s,r)=>s+Number(r.hours.total),0):null;
  const completedQuantity=rs.reduce((sum,r)=>sum+Number(r.reportedQuantity??r.approvedQuantity??0),0);
  const completedAt=rs.map(r=>r.completedAt).filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||'';
  const cumulative=own.map(e=>e.cumulativeLaborHours).filter(v=>v!=null&&Number.isFinite(Number(v)));
  return {...order,id,completedAt,completedQuantity,lsx:order.lsxCode||rs[0]?.lsxCode||own[0]?.lsxCode||'',hours:cumulative.length?Math.max(total??0,...cumulative):total,lastAt:[...own.map(e=>e.effectiveAt),...rs.map(r=>r.completedAt)].filter(Boolean).sort().at(-1),events:own,reports:rs};
 }).sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
}
export function correctionStageEvents(events,stage){return events.filter(e=>!e.voided&&correctionStage(e)===stage&&['Nhập trạm','Tạm ngưng','Tiếp tục','Xuất trạm','Báo sự cố','Bổ sung người'].includes(correctionOperation(e))).map(e=>({...e,operation:correctionOperation(e)})).sort((a,b)=>String(a.effectiveAt).localeCompare(String(b.effectiveAt)));}
