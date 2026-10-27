import {productionRuntime} from './production-runtime.mjs';
import {liveOutput,progressReviewSummary} from './production-progress-review.mjs';

export function historicalWorkContinuation(order,reports) {
 const own=reports.filter(r=>liveOutput(r)&&r.transitId===order.id);
 const history=own.filter(r=>r.historicalImport);
 const blocked=history.some(r=>r.reviewStatus!=='Đã xác nhận');
 return {blocked,ready:history.length>0&&!blocked&&own.every(r=>r.historicalImport)&&Number(order.inTransitQty)>0,
  lastCompletedAt:history.map(r=>r.completedAt).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||''};
}
export function productionWorkActions(order,reports,events,runtime) {
 if(order.status==='HỦY')return {allowed:[],reason:'Lệnh đã hủy tại In transit. Không thể báo công.'};
 runtime=runtime.known?runtime:productionRuntime(order,events);
 const summary=progressReviewSummary(order,reports,events),history=historicalWorkContinuation(order,reports);
 if(Number(order.inTransitQty||0)===0)return {allowed:[],reason:'LSX đã hoàn thành.'};
 if(summary.awaitingCompletion||history.blocked)return {allowed:[],reason:'Cần xác nhận báo công trước khi tiếp tục.'};
 if(!runtime.known)return {allowed:['start','incident'],reason:history.ready?'Lịch sử đã xác nhận. Nhập trạm và phân công nhân viên cho phần còn lại trước khi xuất trạm.':''};
 return runtime.running?{allowed:['complete',...(runtime.count>0?['transfer']:[]),'add','pause','incident'],reason:''}:{allowed:['resume','incident'],reason:'LSX đang tạm ngưng. Tiếp tục trước khi xuất trạm.'};
}
