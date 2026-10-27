const qty=r=>Number(r.approvedQuantity??r.reportedQuantity??0);
const orderKey=r=>JSON.stringify([r.lsxCode||'',r.sku||'',r.line||'']);
const live=r=>!r._deleted&&!r.cancelled&&!r.voided&&!['Đã hủy','HỦY'].includes(r.status);
const day=v=>String(v||'').slice(0,10);
export function planWarehouseBackfill(reports,receipts){
 const eligible=reports.filter(r=>live(r)&&r.kind==='completion'&&r.reviewStatus==='Đã xác nhận'&&qty(r)>0);
 const existing=receipts.filter(live),direct=new Set(existing.map(r=>r.reportId));
 const create=[],covered=[],blocked=[];
 for(const key of new Set(eligible.map(orderKey))){
  const group=eligible.filter(r=>orderKey(r)===key),missing=group.filter(r=>!direct.has(r.id));
  if(!missing.length)continue;
  const old=existing.filter(r=>orderKey(r)===key&&!group.some(p=>p.id===r.reportId));
  const candidates=[...missing];let unmatched=[];
  const usedOld=new Set();
  const oldDay=w=>day(reports.find(r=>r.id===w.reportId)?.completedAt||w.sourceCompletedAt);
  for(const d of new Set(old.map(oldDay).filter(Boolean))){
   const ws=old.filter(w=>oldDay(w)===d),rs=candidates.filter(r=>day(r.completedAt)===d);
   const have=ws.reduce((n,w)=>n+Number(w.proposedQuantity||0),0),need=rs.reduce((n,r)=>n+qty(r),0);
   if(need>0&&have===need){covered.push({reportIds:rs.map(r=>r.id),receiptIds:ws.map(w=>w.id),quantity:need,reason:'Phiếu cũ gộp đúng tổng xuất thành phẩm cùng ngày, lệnh, SKU, Line'});ws.forEach(w=>usedOld.add(w.id));rs.forEach(r=>candidates.splice(candidates.indexOf(r),1));}
  }
  for(const w of old.filter(w=>!usedOld.has(w.id))){
   const previous=reports.find(r=>r.id===w.reportId);
   const matches=candidates.filter(r=>qty(r)===Number(w.proposedQuantity)&&day(r.completedAt)===day(previous?.completedAt||w.sourceCompletedAt));
   if(matches.length===1){covered.push({reportIds:[matches[0].id],receiptIds:[w.id],quantity:qty(matches[0]),reason:'Cùng lệnh, SKU, Line, ngày xuất trạm và số lượng'});candidates.splice(candidates.indexOf(matches[0]),1);}else unmatched.push(w);
  }
  if(unmatched.length){
   const have=unmatched.reduce((n,r)=>n+Number(r.proposedQuantity||0),0),need=candidates.reduce((n,r)=>n+qty(r),0);
   if(have===need&&need>0){covered.push({reportIds:candidates.map(r=>r.id),receiptIds:unmatched.map(r=>r.id),quantity:need,reason:'Phiếu cũ đã đủ tổng số lượng cùng lệnh, SKU và Line'});continue;}
   blocked.push({lsxCode:group[0].lsxCode,sku:group[0].sku,existingQuantity:have,reportQuantity:need,reason:'Phiếu cũ khác cách chia số lượng; cần đối chiếu để không nhập trùng',reportIds:candidates.map(r=>r.id)});continue;
  }
  for(const r of candidates){if(!r.lsxCode||!r.sku||!r.line||!Number.isFinite(Date.parse(r.completedAt))){blocked.push({lsxCode:r.lsxCode,sku:r.sku,reason:'Thiếu thông tin lệnh hoặc thời điểm xuất trạm',reportIds:[r.id]});continue;}create.push(r);}
 }
 return {create,covered,blocked,alreadyLinked:eligible.filter(r=>direct.has(r.id)).length,eligible:eligible.length};
}
