import {incidentStage} from './production-incidents.mjs';

// Only actual, active exit reports available at the requested time supply Final.
// A pending QLSX review is still an exit; cancelled/returned reports are not.
export function assertFinalExitLimit(order,reports,entries,at){
 const stages=[...new Set((order.processes||[]).map(incidentStage).filter(Boolean))];
 const finalIndex=stages.indexOf('FINAL');
 if(finalIndex<0||!entries.some(e=>incidentStage(e.stage)==='FINAL'))return;
 const totals=new Map(stages.map(s=>[s,0])),end=Date.parse(at);
 for(const r of reports){
  if(r.transitId!==order.id||r.cancelled||r.voided||['Cần điều chỉnh','Đã hủy'].includes(r.reviewStatus)||!(Date.parse(r.completedAt)<=end))continue;
  const stage=incidentStage(r.stageName||r.stageCode),quantity=Number(r.stageQuantity??r.reportedQuantity??0);
  if(Number.isFinite(quantity)&&quantity>0)totals.set(stage,(totals.get(stage)||0)+quantity);
 }
 const priorFinal=totals.get('FINAL')||0;
 for(const e of entries){const s=incidentStage(e.stage),q=Number(e.quantity);if(Number.isFinite(q)&&q>0)totals.set(s,(totals.get(s)||0)+q);}
 const finalTotal=totals.get('FINAL')||0,missing=stages.slice(0,finalIndex).filter(s=>(totals.get(s)||0)<finalTotal);
 if(!missing.length)return;
 const limit=Math.max(0,Math.min(...stages.slice(0,finalIndex).map(s=>totals.get(s)||0))-priorFinal);
 throw Object.assign(Error(`Không thể xuất FINAL lũy kế ${finalTotal.toLocaleString('vi-VN')}. Công đoạn trước chưa xuất đủ: ${missing.map(s=>`${s} đã xuất ${(totals.get(s)||0).toLocaleString('vi-VN')}`).join('; ')}. FINAL được xuất thêm tối đa ${limit.toLocaleString('vi-VN')} sản phẩm tại thời điểm này. Ghi nhận xuất các công đoạn còn thiếu trước.`),{status:422});
}
