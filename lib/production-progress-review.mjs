import {isDailyOutput} from './production-daily-output.mjs';
import {validBusinessDate} from './effective-dated-value.mjs';
import {historyAllocationSummary,historyAllocationTolerance} from './production-history-source.mjs';
import {productionDisplayTime} from './production-display-time.mjs';
export const pendingReportReview=r=>!r.cancelled&&!r.voided&&['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(r.reviewStatus);
export const liveOutput=r=>r.kind==='completion'&&!r.cancelled&&!r.voided;
export const completedWorkQuantity=(order,summary)=>Math.max(Number(order.completedQty||0),summary.qty)+summary.pendingQty;
export const fullyConfirmedProgressOrder=(order,summary,runtime)=>Boolean(summary.completedAt&&(!runtime.running||summary.outputs.some(isDailyOutput))&&Number(order.lsxQty)>0&&summary.qty>=Number(order.lsxQty)&&summary.outputs.length&&summary.pending.length===0&&summary.outputs.every(r=>r.reviewStatus==='Đã xác nhận'));
export function progressReviewSummary(order,reports,events=[],now=new Date().toISOString()) {
 const outputs=reports.filter(r=>liveOutput(r)&&r.transitId===order.id);
 const approved=outputs.filter(r=>r.reviewStatus==='Đã xác nhận'),pending=outputs.filter(r=>['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(r.reviewStatus));
 const qty=approved.reduce((s,r)=>s+Number(r.approvedQuantity??r.reportedQuantity??0),0),pendingQty=pending.reduce((s,r)=>s+Number(r.reportedQuantity||0),0);
 const own=events.filter(e=>!e.voided&&(e.sourceId===order.id||e.destinationId===order.id)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt));
 const starts=own.filter(e=>e.kind==='start'&&e.sourceId===order.id||e.kind==='transfer'&&e.destinationId===order.id).map(e=>e.effectiveAt).concat(outputs.map(r=>r.startedAt)).filter(Boolean).sort();
 const reportedQty=outputs.reduce((s,r)=>s+Number(r.reportedQuantity||0),0);
 const reportedComplete=Number(order.lsxQty)>0&&reportedQty>=Number(order.lsxQty);
 const final=order.actualCompletedAt||(reportedComplete?outputs.map(r=>isDailyOutput(r)?r.productionDate:r.completedAt).filter(Boolean).sort().at(-1):'')||'';
 const awaitingCompletion=reportedComplete&&pendingQty>0&&!order.actualCompletedAt;
 const day=productionDisplayTime(final||now,'').split(' ')[0].split('/').reverse().join('-'),end=String(order.planEnd||'').slice(0,10);
 const timing=final&&end?(day<end?'Hoàn thành sớm':day>end?'Hoàn thành trễ':'Hoàn thành đúng hạn'):!final&&end?(day>end?'Quá hạn':day===end?'Đến hạn hôm nay':'Trong hạn'):'—';
 return {outputs,approved,pending,qty,pendingQty,awaitingCompletion,startedAt:order.actualStartedAt||starts[0]||'',completedAt:final,timing,hc:approved.some(r=>!r.hours)?null:approved.reduce((s,r)=>s+Number(r.hours.hc||0),0),ot:approved.some(r=>!r.hours)?null:approved.reduce((s,r)=>s+Number(r.hours.ot||0),0)};
}
// Reconciled Sheets reports carry authoritative aggregate labor, not invented employee allocations.
export function verifiedSourceLabor(report){
 return report.sourceVerified===true&&Boolean(report.sourceReportId)&&report.hours?.sourceTotal===true&&report.hours?.sourceVerified===true&&report.sourceLaborHours!=null&&Number.isFinite(Number(report.sourceLaborHours))&&Number(report.sourceLaborHours)>=0&&Math.abs(Number(report.hours.total)-Number(report.sourceLaborHours))<0.000001;
}
export function reportReviewBlocker(report){if(isDailyOutput(report))return !validBusinessDate(report.productionDate)||!Number.isSafeInteger(Number(report.reportedQuantity))||Number(report.reportedQuantity)<=0?'Sản lượng/ngày sản xuất không hợp lệ':'';if(report.historicalImport&&(!Number.isSafeInteger(Number(report.sourceCount))||Number(report.sourceCount)<1||(!report.erpStageImport&&(report.sourceCumulativeHours==null||!Number.isFinite(Number(report.sourceCumulativeHours))))))return 'Thiếu số người hoặc giờ nguồn';if(!report.hours||['hc','ot','total'].some(k=>report.hours[k]==null||!Number.isFinite(Number(report.hours[k]))))return 'Chưa đủ dữ liệu giờ công';if(report.historicalImport&&!verifiedSourceLabor(report)&&historyAllocationSummary(report).unallocated>(report.erpStageImport?Math.max(historyAllocationTolerance,(report.employees?.length||1)*0.0001):historyAllocationTolerance))return 'Giờ công nguồn chưa được phân bổ đủ; cần đối chiếu trước khi xác nhận';if(report.unresolvedAttendance?.length)return 'Chưa ghi giờ vào thực tế';if(report.pendingAttendance?.length)return 'Có điều chỉnh giờ chờ duyệt';return '';}
// reportedQuantity is finished output: intermediate stages record zero.
export function reportRequiresDelayReason(order,report,reports=[]) {
 if(!(Number(report?.reportedQuantity)>0)||!(Number(order?.lsxQty)>0))return false;
 const end=String(order.planEnd||'').slice(0,10);
 const day=isDailyOutput(report)?report.productionDate:productionDisplayTime(report.completedAt,'').split(' ')[0].split('/').reverse().join('-');
 return /^\d{4}-\d{2}-\d{2}$/.test(end)&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>end;
}
export function reportDelayReasonError(order,report,value,reports=[]) {
 return reportRequiresDelayReason(order,report,reports)&&!String(value??'').trim()
  ? isDailyOutput(report)?`LSX ${report.lsxCode||order.lsxCode||''}: sản lượng ghi nhận sau ngày kế hoạch. Nhập Lý do trễ trước khi xác nhận và đồng bộ với KHSX.`:`LSX ${report.lsxCode||order.lsxCode||''} · Công đoạn ${report.stageName||report.stageCode||'Cuối'}: công đoạn cuối xuất trạm trễ kế hoạch. Nhập Lý do trễ trước khi xác nhận và đồng bộ với KHSX.` : '';
}

export function progressOrderStatus(summary,runtime,events=[]) {
 if(summary.awaitingCompletion)return {label:'Chờ xác nhận HT',tone:'review'};
 if(summary.completedAt)return summary.timing==='Hoàn thành sớm'?{label:'HT sớm',tone:'early'}:summary.timing==='Hoàn thành trễ'?{label:'HT trễ',tone:'late'}:{label:'Hoàn thành',tone:'completed'};
 if(events.some(e=>!e.voided&&e.finalCompletion&&summary.pending.some(r=>r.id===e.reportId)))return {label:'Chờ xác nhận HT',tone:'review'};
 if(summary.outputs?.some(r=>r.historicalImport)&&!runtime.known)return {label:'Đang SX',tone:'running'};
 const lastStop=events.filter(e=>!e.voided&&(e.kind==='pause'||e.kind==='resume'||e.kind==='start'||e.kind==='incident'&&e.stopWork)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)).at(-1);
 if(!runtime.running&&lastStop?.kind==='incident')return {label:'Tạm dừng sự cố',tone:'incident'};
 return runtime.running?{label:'Đang SX',tone:'running'}:runtime.known?{label:'Đang tạm ngưng',tone:'paused'}:{label:'Chưa SX',tone:'waiting'};
}
