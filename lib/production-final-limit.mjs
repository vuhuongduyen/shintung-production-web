import {incidentStage} from './production-incidents.mjs';

// Pending QLSX review still counts as an exit; cancelled/returned reports do not.
// Historical insertion must remain valid at every later Final exit, not only at
// the inserted timestamp. Group simultaneous exits before checking the limit.
export function assertFinalExitLimit(order,reports,entries,at){
 const stages=[...new Set((order.processes||[]).map(incidentStage).filter(Boolean))];
 const finalIndex=stages.indexOf('FINAL');
 if(finalIndex<0||!entries.some(e=>incidentStage(e.stage)==='FINAL'))return;
 const end=Date.parse(at),timeline=new Map(),totals=new Map(stages.map(s=>[s,0]));
 const add=(time,stage,quantity)=>{
  if(!Number.isFinite(time)||!Number.isFinite(quantity)||quantity<=0)return;
  if(!timeline.has(time))timeline.set(time,new Map());
  const batch=timeline.get(time);batch.set(stage,(batch.get(stage)||0)+quantity);
 };
 for(const r of reports){
  if(r.transitId!==order.id||r.cancelled||r.voided||['Cần điều chỉnh','Đã hủy'].includes(r.reviewStatus))continue;
  add(Date.parse(r.completedAt),incidentStage(r.stageName||r.stageCode),Number(r.stageQuantity??r.reportedQuantity??0));
 }
 let requestedFinal=0;
 for(const e of entries){const stage=incidentStage(e.stage),quantity=Number(e.quantity);add(end,stage,quantity);if(stage==='FINAL'&&Number.isFinite(quantity)&&quantity>0)requestedFinal+=quantity;}
 for(const [time,batch]of [...timeline].sort(([a],[b])=>a-b)){
  for(const [stage,quantity]of batch)totals.set(stage,(totals.get(stage)||0)+quantity);
  if(time<end||(time!==end&&!batch.has('FINAL')))continue;
  const finalTotal=totals.get('FINAL')||0,missing=stages.slice(0,finalIndex).filter(s=>(totals.get(s)||0)<finalTotal);
  if(!missing.length)continue;
  const limit=Math.max(0,Math.min(...stages.slice(0,finalIndex).map(s=>totals.get(s)||0))-(finalTotal-requestedFinal));
  const future=time>end?` Việc nhập bù làm vượt giới hạn tại mốc ${new Date(time).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}.`:'';
  throw Object.assign(Error(`Không thể xuất FINAL lũy kế ${finalTotal.toLocaleString('vi-VN')}. Công đoạn trước chưa xuất đủ: ${missing.map(s=>`${s} đã xuất ${(totals.get(s)||0).toLocaleString('vi-VN')}`).join('; ')}. FINAL được xuất thêm tối đa ${limit.toLocaleString('vi-VN')} sản phẩm tại thời điểm này.${future} Ghi nhận xuất các công đoạn còn thiếu trước.`),{status:422});
 }
}
