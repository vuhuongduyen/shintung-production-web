import {productionDisplayTime} from "./production-display-time.mjs";
// Read-only display context. Keep stored historical values; fill missing fields from linked records.
const missing=value=>value===undefined||value===null||value==='';
export function productionDetailContext(input,orders=[],reports=[],events=[]) {
 const original=reports.find(r=>r.id===input.id)||events.find(e=>e.id===input.id)||orders.find(o=>o.id===input.id)||input;
 const detail={...original};
 const report=detail.kind==='completion'?detail:reports.find(r=>r.id===detail.reportId);
 const event=detail.kind==='completion'?events.filter(e=>e.reportId===detail.id&&e.kind==='complete').find(e=>!e.voided)||events.find(e=>e.reportId===detail.id&&e.kind==='complete'):detail.kind?detail:null;
 const source=orders.find(o=>o.id===(detail.transitId||detail.sourceId||report?.transitId||(!detail.kind?detail.id:null)));
 const snapshot=report?.orderSnapshot||detail.orderSnapshot||{};
 for(const field of ['planId','lsxCode','sku','name','spec','line','planStart','planEnd','lsxQty','completedQty','inTransitQty','actualStartedAt','actualCompletedAt','productionState','status']) {
  if(missing(detail[field]))detail[field]=!missing(snapshot[field])?snapshot[field]:!missing(report?.[field])?report[field]:source?.[field];
 }
 const orderId=source?.id||detail.transitId||detail.sourceId||report?.transitId;
 const outputReports=reports.filter(r=>r.kind==='completion'&&r.transitId===orderId&&!r.cancelled&&!r.voided&&['Chờ kiểm tra','Đã xác nhận'].includes(r.reviewStatus));
 // Transit completedQty is approved output; it must not label pending output as unproduced.
 const approved=outputReports.filter(r=>r.reviewStatus==='Đã xác nhận').reduce((sum,r)=>sum+Number(r.approvedQuantity??r.reportedQuantity??0),0);
 const legacyApproved=Math.max(Number(source?.completedQty??detail.completedQty??0)-approved,0);
 detail.approvedCompletedQty=legacyApproved+approved;
 detail.pendingCompletedQty=outputReports.filter(r=>r.reviewStatus==='Chờ kiểm tra').reduce((sum,r)=>sum+Number(r.reportedQuantity||0),0);
 detail.reportedCompletedQty=detail.approvedCompletedQty+detail.pendingCompletedQty;
 detail.unreportedQty=detail.lsxQty==null?null:Math.max(Number(detail.lsxQty)-detail.reportedCompletedQty,0);
 const startTimes=events.filter(e=>!e.voided&&((e.kind==='start'&&e.sourceId===orderId)||(e.kind==='transfer'&&e.destinationId===orderId))).map(e=>e.effectiveAt)
  .concat(outputReports.map(r=>r.startedAt)).filter(value=>value&&Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(a)-Date.parse(b));
 if(startTimes[0]&&(missing(detail.actualStartedAt)||/^\d{4}-\d{2}-\d{2}$/.test(detail.actualStartedAt)))detail.actualStartedAt=startTimes[0];
 // A complete event's effectiveAt is the end of the linked reporting interval.
 if(detail.kind==='complete'&&report) {
  detail.startedAt=report.startedAt;
  detail.completedAt=report.completedAt;
 }
 if(detail.kind==='completion'&&event) {
  for(const field of ['count','employees','employeeDetails'])if(missing(detail[field]))detail[field]=event[field];
 }
 if(detail.kind==='completion'&&!detail.employees?.length)detail.employees=detail.hours?.perEmployee?.map(p=>p.id)||[];
 const ids=new Set([detail.sourceId,detail.transitId,detail.destinationId,...(detail.affectedOrderIds||[])]);
 for(const change of [...(detail.changes||[]),...(detail.reportChanges||[])]) {
  const r=reports.find(r=>r.id===change.reportId);if(r)ids.add(r.transitId);
 }
 return {detail,source,report,event,destination:orders.find(o=>o.id===detail.destinationId),affectedOrders:orders.filter(o=>ids.has(o.id))};
}
const span=(start,end)=>start&&end?`${start}–${end}`:'—';
function scheduleSummary(day) {
 if(!day)return {working:'Chưa ghi nhận',hc:'—',ot:'—',breaks:'—',lunch:'—',preOt:'—',cleaning:'—',reason:'—'};
 return {working:day.working?'Làm việc':'Nghỉ',hc:day.working?span(day.hcStart,day.hcEnd):'Không làm',ot:day.ot?span(day.otStart,day.otEnd):'Không tăng ca',
  breaks:(day.breaks||[]).map(b=>span(b.start,b.end)).join(', ')||'—',lunch:span(day.lunchStart,day.lunchEnd),preOt:day.ot?span(day.preOtStart,day.preOtEnd):'Không tăng ca',
  cleaning:(day.cleaning||[]).map(c=>`${span(c.start,c.end)} · ${c.people??'—'} người`).join(', ')||'Không có',reason:day.note||'—'};
}
export function scheduleChanges(before,after) {
 const old=Array.isArray(before)?before:[],next=Array.isArray(after)?after:[];
 return [...new Set([...old,...next].map(d=>d.date))].sort().map(date=>({date,before:scheduleSummary(old.find(d=>d.date===date)),after:scheduleSummary(next.find(d=>d.date===date))}));
}
export function productionChangeFields(before,after,orders=[],employees=[]) {
 const fields={kind:'Thao tác',effectiveAt:'Bắt đầu',endsAt:'Kết thúc',absenceType:'Loại biến động',quantity:'Sản lượng',status:'Trạng thái',source:'Người ở LSX nguồn',destination:'Người ở LSX đích',count:'Số người',employees:'Nhân viên',destinationId:'LSX đích',stopWork:'Dừng sản xuất',affectedQuantity:'Số lượng ảnh hưởng',voided:'Đã hủy',productionDate:'Ngày sản lượng',note:'Ghi chú'};
 return Object.entries(fields).filter(([key])=>before?.[key]!==undefined||after?.[key]!==undefined).map(([key,label])=>({key,label,before:format(before?.[key],key),after:format(after?.[key],key)}));
 function format(value,key) {
  if(value===undefined||value===null||value==='')return '—';
  if(['effectiveAt','endsAt'].includes(key))return productionDisplayTime(value);
  if(key==='productionDate')return String(value).split('-').reverse().join('/');
  if(typeof value==='boolean')return value?'Có':'Không';
  if(key==='employees')return value.map(id=>{const p=employees.find(p=>p.id===id);return p?.name?`${p.name} (${id})`:id;}).join(', ')||'Không có';
  if(key==='destinationId')return orders.find(o=>o.id===value)?.lsxCode||'Chưa có lệnh trong danh sách';
  return String(value);
 }
}
