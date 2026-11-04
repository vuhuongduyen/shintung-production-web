import {outputDate} from './production-output-summary.mjs';
import {pendingReportReview,reportReviewBlocker,reportRequiresDelayReason} from './production-progress-review.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
// Deliberately excludes aggregate order progress: confirming a sibling must not invalidate unchanged selections.
export function reviewSnapshot(order,report){
 const fields=['reportingModel','quantityOnly','legacyCompletedBaseline','rateBasis','rateStatus','rateIssue','earnedStandardHours','id','transitId','line','lsxCode','sku','kind','version','productionDate','productionLocalDateTime','productionAt','startedAt','completedAt','stageCode','stageName','stageReporting','stageQuantity','reportedQuantity','reviewStatus','cancelled','voided','hours','employees','count','note','delayReason','unresolvedAttendance','pendingAttendance','laborNotes','historicalImport','sourceVerified','sourceReportId','sourceCount','sourceLaborHours','sourceCumulativeHours','estimatedStaffing','unallocatedHours','erpStageImport','correctedAt'];
 return JSON.stringify(canonical({order:Object.fromEntries(['id','line','lsxCode','sku','status','cancelReason','historicalOnly','planEnd','lsxQty'].map(k=>[k,order?.[k]??null])),report:Object.fromEntries(fields.map(k=>[k,report?.[k]??null]))}));
}
export function reviewEligibility(order,report,delayReason=''){
 if(!pendingReportReview(report)||report.kind!=='completion')return 'Báo công không còn chờ kiểm tra';
 if(order.status==='HỦY'||order.cancelReason)return 'Lệnh đã hủy tại In transit';
 if(order.historicalOnly)return 'Cần khôi phục LSX trong In Transit trước khi xác nhận';
 if(!outputDate(report))return 'Chưa xác định ngày sản xuất';
 return reportReviewBlocker(report)||(reportRequiresDelayReason(order,report)&&!String(delayReason||report.delayReason||'').trim()?'Nhập lý do trễ trước khi xác nhận':'');
}
export function groupReviewDays(reports){
 const groups=new Map();
 for(const report of reports){const day=outputDate(report)||'',key=JSON.stringify([report.line,report.transitId,day]);if(!groups.has(key))groups.set(key,{key,day,reports:[]});groups.get(key).reports.push(report);}
 return [...groups.values()].sort((a,b)=>a.day.localeCompare(b.day));
}
// A synchronous latch also blocks two clicks before React has rendered its disabled state.
export function createReviewRunner(){let running=false;return async function run(items,{allowed,submit,refresh}){
 if(running)return {ignored:true,results:[]};
 if(!allowed||!items.length)return {ignored:false,results:[],error:!allowed?'Không có quyền xác nhận':'Chưa chọn báo công'};
 running=true;const results=[];let refreshError='';
 try{for(const item of items){try{const result=await submit(item);results.push({id:item.report.id,ok:true,...result});}catch(error){results.push({id:item.report.id,ok:false,uncertain:error.uncertain===true,error:error.message||'Không rõ kết quả; tải lại trước khi thử lại'});}}}
 finally{try{if(await refresh()===false)refreshError='Chưa tải lại được dữ liệu. Cập nhật trước khi kiểm tra lại.';}catch{refreshError='Chưa tải lại được dữ liệu. Cập nhật trước khi kiểm tra lại.';}running=false;}
 return {ignored:false,results,refreshError};
};}

export async function submitReviewSelection(item,request){
 let response,result;
 try{response=await request('/api/production-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'review',reportId:item.report.id,approve:true,reason:'',delayReason:item.delayReason,expectedVersion:item.report.version||0,expectedReview:item.expectedReview})});result=await response.json();}
 catch{throw Object.assign(Error('Không rõ kết quả gửi. Tải lại và đối chiếu trước khi thử lại.'),{uncertain:true});}
 if(!response.ok)throw Object.assign(Error(result.error||'Không xác nhận được'),{uncertain:response.status>=500});
 return {ok:true};
}
