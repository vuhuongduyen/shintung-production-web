import {requestDailyWithdrawal} from './production-warehouse-withdrawal.mjs';
import {readDailyOutputPolicy} from './production-daily-output.mjs';
import {correctDailyOutput} from './production-daily-correction.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {cancelStageWork} from './production-stage-cancel.mjs';
import {correctStageWork} from './production-stage-correction.mjs';
import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {correctSourceTimes} from './production-source-time-correction.mjs';
import {correctReportHours} from './production-report-hours-correction.mjs';
import {assertLegacyAllocationWrite} from './production-allocation-queue.mjs';
import {productionActorId} from "../../lib/production-actor.mjs";
import {readProductionWorkflow,recalculateProductionReport,validateCorrectedAssignment} from './production-workflow.mjs';
import {assignedAt,employeesAt} from '../../lib/production-hours.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {vnMoment} from '../../lib/production-attendance.mjs';

const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const editable=new Set(['start','pause','resume','complete','transfer','add','reduce','incident','absence','line-absence','attendance-override']);
const read=async(db,entity)=>(await readRecordPages(db,{where:'entity=?',args:[entity]})).map(r=>({key:r.record_key,raw:r.payload,value:JSON.parse(r.payload)}));
const parseTime=value=>{const n=Date.parse(value);if(!Number.isFinite(n)||!/(Z|[+-]\d\d:\d\d)$/.test(String(value))||n>Date.now()+600000)fail('Thời điểm thực tế cần hợp lệ, có múi giờ và không ở tương lai.',422);return new Date(n).toISOString();};
const unique=values=>[...new Set(values.filter(Boolean))];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function validateTimeline(events,orders) {
 const live=events.filter(e=>!e.voided&&editable.has(e.kind)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
 const before=[];
 for(const event of live) {
  const instant=Date.parse(event.effectiveAt),state=assignedAt(before,event.sourceId,instant);
  const people=employeesAt(before,event.sourceId,instant);
  const label=orders.find(o=>o.id===event.sourceId)?.lsxCode||'LSX';
  if(['transfer','reduce','pause','resume','complete','add'].includes(event.kind)&&!state.known)fail(`${label}: thao tác ${event.kind} còn phụ thuộc vào Nhập trạm. Xử lý thao tác sau trước.`);
  if(['transfer','reduce','complete','add'].includes(event.kind)&&(!state.running||state.count===0))fail(`${label}: còn thao tác sau khi lệnh không có người hoặc đã tạm ngưng. Xử lý thao tác sau trước.`);
  if(event.kind==='incident'&&event.stopWork&&!state.running)fail(`${label}: sự cố dừng lệnh không còn LSX đang làm.`);
  if(event.kind==='pause'&&!state.running||event.kind==='resume'&&state.running)fail(`${label}: thứ tự Tạm ngưng/Tiếp tục không hợp lệ sau thay đổi.`);
  if(['reduce','transfer'].includes(event.kind)&&(event.count>state.count||people&&event.employees?.some(id=>!people.includes(id))))fail(`${label}: thao tác sau đang sử dụng nhân viên bị hủy phân công.`);
  if(event.kind==='start'&&state.known&&state.count)fail(`${label}: Nhập trạm bị trùng với phân công đang có.`);
  if(event.kind==='transfer') {
   const destination=assignedAt(before,event.destinationId,instant);
   if(destination.known&&!destination.running&&destination.count)fail('LSX đích đang tạm ngưng; không thể điều chỉnh chuyển người vào lệnh này.');
  }
  if(['start','add','transfer'].includes(event.kind)) {
   const receiving=event.kind==='transfer'?event.destinationId:event.sourceId;
   const existing=employeesAt(before,receiving,instant)||[];
   if(event.employees?.some(id=>existing.includes(id))&&!(event.kind==='transfer'&&event.destinationIncludedInStart))fail(`${label}: nhân viên bị phân công trùng trong cùng LSX.`);
   // Cross-order overlaps are permitted in corrections and audited separately.
  }
  before.push(event);
 }
}

async function runCorrection(db,body,actor,catalog=[]) {
 if(body.operation==='daily-output-withdraw')return requestDailyWithdrawal(db,body,actor);
 if(['daily-output-edit','daily-output-cancel'].includes(body.operation))return correctDailyOutput(db,body,actor);
 if(!productionMenuRights(actor).correct)fail("Không có quyền Điều chỉnh báo công.",403);
 if((await readDailyOutputPolicy(db)).policy?.cutoverReached)fail('Lịch sử công đoạn chỉ để tra cứu sau mốc chuyển đổi; không hủy hoặc tính lại giờ cũ.',409);
 if(body.operation==='cancel-stage')return cancelStageWork(db,body,actor,catalog);
 if(body.stageWorkCorrection===true)return correctStageWork(db,body,actor,catalog);
 if(body.sourceTimeCorrection===true)return correctSourceTimes(db,body,actor,catalog);
 if(body.operation==='adjust-report-hours')return correctReportHours(db,body,actor,catalog);
 const grants=(actor?.grants||[]).map(g=>String(g).toLocaleLowerCase('vi'));
 const allowed=actor?.login&&(actor.isAdmin||grants.some(g=>g.includes('quản lý sản xuất')&&(g.endsWith('/ xác nhận')||g.endsWith('/ sửa')&&!actor.line)));
 if(!allowed)fail('Chỉ QLSX có quyền hủy hoặc điều chỉnh báo công.',403);
 const batch=Array.isArray(body.operations);
 if(!['preview','apply'].includes(body.action)||!batch&&!['cancel','adjust'].includes(body.operation))fail('Chọn Hủy hoặc Điều chỉnh báo công.',422);
 const operations=batch?body.operations:[body];
 if(!operations.length||operations.length>200||new Set(operations.map(o=>o.eventId)).size!==operations.length||operations.some(o=>!['cancel','adjust'].includes(o.operation)))fail('Chọn từ 1 đến 200 sự kiện khác nhau để điều chỉnh.',422);
 const reason=String(body.reason||'').trim();if(body.action==='apply'&&(!reason||reason.length>1000))fail('Nhập lý do hủy/điều chỉnh (tối đa 1000 ký tự).',422);
 const cursor=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();
 const cursorRaw=cursor?.payload||JSON.stringify({version:0,token:''});
 const revision=await recordRevision(cursorRaw);
 if(body.action==='apply'&&body.expectedRevision!==revision)fail(conflictMessage);
 const [eventRows,reportRows,transitRows,warehouseRows]=await Promise.all(['production_event','production_report','in_transit','warehouse_in'].map(e=>read(db,e)));
 const anchor=eventRows.find(r=>r.key===body.eventId)?.value;
 if(!anchor||!editable.has(anchor.kind))fail('Không tìm thấy thao tác báo công được phép xử lý.',404);
 const orderId=body.orderId||anchor.sourceId;
 if(batch&&(!orderId||![anchor.sourceId,anchor.destinationId].includes(orderId)))fail('Chọn đúng LSX cần điều chỉnh.',422);
 const state=await readProductionWorkflow(db,{...actor,line:null},catalog),orders=state.orders;
 const now=new Date().toISOString(),token=crypto.randomUUID(),changes=[],newRows=[],eventChanges=[],retiredIds=[],replacements=[];
 const reports=reportRows.map(r=>structuredClone(r.value));
 const affected=[];
 for(const operation of operations) {
 const stored=eventRows.find(r=>r.key===operation.eventId),original=stored?.value;
 if(!original||!editable.has(original.kind))fail('Không tìm thấy thao tác báo công được phép xử lý.',404);
 if(['absence','line-absence','attendance-override'].includes(original.kind)&&original.absenceType!=='Phụ kho'&&!actor.isAdmin)fail('Dữ liệu vắng mặt do HR điều chỉnh tại Lịch SX thực tế.',403);
 if(batch&&![original.sourceId,original.destinationId,...(original.affectedOrderIds||[])].includes(orderId))fail('Sự kiện không thuộc LSX đang điều chỉnh.',422);
 if(original.voided)fail('Thao tác này đã hủy hoặc đã được thay thế.');
 if(Number(operation.version)!==Number(original.version||0))fail(conflictMessage);
 if(actor.line&&[original.line,original.destinationLine].filter(Boolean).some(line=>line!==actor.line))fail('Không có quyền xử lý thao tác của Line khác.',403);
 if(eventRows.some(r=>!r.value.voided&&(r.value.supersedes===original.id||r.value.approvedFrom===original.id)))fail('Thao tác đã có điều chỉnh tiếp theo. Hãy chọn bản đang áp dụng.');
 if(original.destinationIncludedInStart)fail('Chuyển người này đi kèm Nhập trạm. Chọn Nhập trạm của LSX đích để hủy cả nhóm cùng lúc.');
 const companions=original.kind==='start'?eventRows.filter(r=>!r.value.voided&&r.value.destinationIncludedInStart&&r.value.destinationId===original.sourceId&&r.value.effectiveAt===original.effectiveAt):[];
 const replacementId=crypto.randomUUID();
 const input=operation.changes||{};
 const retired={...original,voided:true,version:Number(original.version||0)+1,cancelledAt:now,cancelledBy:actor.login,cancelledById:productionActorId(actor),cancelReason:reason,replacementId:operation.operation==='adjust'?replacementId:null};
 retiredIds.push(original.id);
 changes.push({entity:'production_event',row:stored,value:retired});
 for(const row of companions) {
  const value={...row.value,voided:true,version:Number(row.value.version||0)+1,cancelledAt:now,cancelledBy:actor.login,cancelledById:productionActorId(actor),cancelReason:reason};
  changes.push({entity:'production_event',row,value});retiredIds.push(row.value.id);
  if(operation.operation==='adjust') {
   const effectiveAt=parseTime(input.effectiveAt||original.effectiveAt);
   const groupIds=new Set([original.id,...companions.map(r=>r.value.id)]);
   const assignmentEvents=eventRows.filter(r=>!groupIds.has(r.value.id)).map(r=>changes.find(c=>c.entity==='production_event'&&c.row.key===r.key)?.value||r.value).concat(newRows.filter(r=>r.entity==='production_event').map(r=>r.value));
   const available=employeesAt(assignmentEvents,row.value.sourceId,Date.parse(effectiveAt))||row.value.employees||[];
   const selected=unique((Array.isArray(input.employees)?input.employees:original.employees||[]).map(id=>String(id).trim().toUpperCase()));
   const employees=selected.filter(id=>available.includes(id));
   if(!employees.length){eventChanges.push({operation:'adjust',eventId:row.value.id,before:row.value,after:{...value,status:'Không còn chuyển tới LSX này'}});continue;}
   const companion={...row.value,id:crypto.randomUUID(),version:0,correctedFrom:row.value.id,correctionGroupId:token,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason,effectiveAt,employees,count:employees.length,employeeDetails:employees.map(id=>({id,name:state.employees.find(e=>e.id===id)?.name||id}))};
   delete companion.requestIdempotency;newRows.push({entity:'production_event',key:companion.id,value:companion});replacements.push(companion);
   eventChanges.push({operation:'adjust',eventId:row.value.id,before:row.value,after:companion});
  }else eventChanges.push({operation:'cancel',eventId:row.value.id,before:row.value,after:{...row.value,voided:true,status:'Đã hủy'}});
 }
 let replacement=null;
 if(operation.operation==='adjust') {
  replacement={...original,id:replacementId,version:0,correctedFrom:original.id,correctionGroupId:token,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason,effectiveAt:parseTime(input.effectiveAt||original.effectiveAt)};
  delete replacement.requestIdempotency;
  if(['start','add','reduce','transfer'].includes(original.kind)) {
   const employees=Array.isArray(input.employees)?unique(input.employees.map(v=>String(v).trim().toUpperCase())):original.employees||[];
   const count=Number(input.count??employees.length??original.count);
   if(!Number.isSafeInteger(count)||count<1||count>10000||employees.length&&employees.length!==count)fail('Số người cần bằng danh sách nhân viên đã chọn.',422);
   if(employees.some(id=>!state.employees.some(e=>e.id===id&&e.active!==false)))fail('Nhân viên không tồn tại hoặc đã ngừng sử dụng.',422);
   if(state.employees.length&&!employees.length)fail('Chọn tên nhân viên được phân công.',422);
   replacement={...replacement,count,employees,employeeDetails:employees.map(id=>({id,name:state.employees.find(e=>e.id===id)?.name||id}))};
   if(original.kind==='transfer') {
    const destination=orders.find(o=>o.id===(input.destinationId||original.destinationId));
    if(!destination||destination.id===original.sourceId||actor.line&&destination.line!==actor.line)fail('Chọn LSX đích hợp lệ.',422);
    replacement.destinationId=destination.id;replacement.destinationLine=destination.line;
   }
  }
  if(['absence','line-absence','attendance-override'].includes(original.kind)) {
   replacement.endsAt=parseTime(input.endsAt||original.endsAt);
   if(Date.parse(replacement.endsAt)<=Date.parse(replacement.effectiveAt))fail('Đến thời điểm cần sau thời điểm bắt đầu.',422);
   replacement.approved=true;replacement.openArrival=false;
  }
  if(original.kind==='incident') {replacement.stopWork=input.stopWork??original.stopWork;replacement.affectedQuantity=Number(input.affectedQuantity??original.affectedQuantity??0);if(!Number.isSafeInteger(replacement.affectedQuantity)||replacement.affectedQuantity<0)fail('Số lượng ảnh hưởng không hợp lệ.',422);}
  if(original.kind==='complete')replacement.quantity=Number(input.quantity??reports.find(r=>r.id===original.reportId)?.reportedQuantity??original.quantity);
  newRows.push({entity:'production_event',key:replacement.id,value:replacement});
  replacements.push(replacement);
 }
 affected.push(...unique([original.sourceId,original.destinationId,replacement?.destinationId,...(original.affectedOrderIds||[]),...companions.flatMap(r=>[r.value.sourceId,r.value.destinationId])]));
 if(!original.sourceId)affected.push(...orders.filter(o=>o.line===original.line).map(o=>o.id));
 const targetReport=reports.find(r=>r.id===original.reportId);
 if(original.kind==='complete'&&!targetReport)fail('Thao tác xuất trạm thiếu báo công gốc; cần kiểm tra dữ liệu trước khi hủy.');
 if(targetReport) {
  if(operation.operation==='cancel')Object.assign(targetReport,{cancelled:true,reviewStatus:'Đã hủy',approvedQuantity:0,cancelledAt:now,cancelledBy:actor.login,cancelReason:reason});
  else {
   const quantity=Number(input.quantity??targetReport.reportedQuantity),productionDate=String(input.productionDate||vnMoment(replacement.effectiveAt).date);
   if(!Number.isSafeInteger(quantity)||quantity<=0)fail('Sản lượng điều chỉnh cần là số nguyên lớn hơn 0.',422);
   Object.assign(targetReport,{...(targetReport.reviewStatus==='Cần điều chỉnh'?{reviewStatus:'Chờ kiểm tra',approvedQuantity:0,reviewedBy:null,reviewedAt:null,warehouseStatus:'Chưa tạo phiếu'}:{}),reportedQuantity:quantity,...(targetReport.reviewStatus==='Đã xác nhận'?{approvedQuantity:quantity}:{}),completedAt:replacement.effectiveAt,productionDate,note:String(input.note??targetReport.note??'')});
  }
 }
 eventChanges.push({operation:operation.operation,eventId:original.id,before:original,after:replacement||{...original,voided:true,status:'Đã hủy'}});
 }
 let events=eventRows.map(r=>changes.find(c=>c.entity==='production_event'&&c.row.key===r.key)?.value||r.value).concat(replacements);
 const impacted=unique(affected);
 // Rebuild each report boundary and physical completion from the remaining events.
 for(const id of impacted) {
  const order=orders.find(o=>o.id===id);if(!order)fail('LSX liên quan không còn được đồng bộ.');
  const rs=reports.filter(r=>r.kind==='completion'&&r.transitId===id&&!r.cancelled&&r.reviewStatus!=='Cần điều chỉnh').sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt));
  const first=events.filter(e=>!e.voided&&(e.kind==='start'&&e.sourceId===id||e.kind==='transfer'&&e.destinationId===id)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt))[0];
  let previous=first?.effectiveAt,qty=0;
  for(const report of rs) {
   if(!previous||Date.parse(report.completedAt)<=Date.parse(previous))fail(`${order.lsxCode}: báo công sau không còn khoảng làm việc hợp lệ. Xử lý báo công phụ thuộc trước.`);
   if(report.productionDate<vnMoment(previous).date||report.productionDate>vnMoment(report.completedAt).date)fail(`${order.lsxCode}: ngày sản lượng không nằm trong khoảng báo công mới.`,422);
   qty+=Number(report.reportedQuantity);if(qty>Number(order.lsxQty))fail(`${order.lsxCode}: tổng sản lượng sau điều chỉnh vượt số lượng lệnh.`,422);
   report.startedAt=previous;previous=report.completedAt;
   const event=events.find(e=>!e.voided&&e.reportId===report.id&&e.kind==='complete');
   if(event) {
    const updated={...event,finalCompletion:qty>=Number(order.lsxQty)};
    if(!same(event,updated)){events=events.map(e=>e.id===event.id?updated:e);const inserted=newRows.find(r=>r.key===event.id);if(inserted)inserted.value=updated;else changes.push({entity:'production_event',row:eventRows.find(r=>r.key===event.id),value:updated});}
   }
  }
 }
 for(const candidate of replacements){
  const replacement=events.find(e=>e.id===candidate.id);
  const sorted=events.filter(e=>!e.voided).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
  const prefix=sorted.slice(0,sorted.findIndex(e=>e.id===replacement.id)),at=Date.parse(replacement.effectiveAt);
  replacement.before={...replacement.before,source:assignedAt(prefix,replacement.sourceId,at).count};
  replacement.after={...replacement.after,source:assignedAt([...prefix,replacement],replacement.sourceId,at).count};
  const inserted=newRows.find(r=>r.key===replacement.id);if(inserted)inserted.value=replacement;
  const change=eventChanges.find(c=>c.after.id===replacement.id);if(change)change.after=replacement;
 }
 validateTimeline(events,orders);
 for(const candidate of replacements)await validateCorrectedAssignment(db,events,events.find(e=>e.id===candidate.id),state.employees);
 // Output staff snapshots must follow corrected assignments, including final
 // output where the assignment is released immediately after the event.
 const chronological=events.filter(e=>!e.voided).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
 for(let i=0;i<chronological.length;i++) {
  const event=chronological[i];if(event.kind!=='complete'||!impacted.includes(event.sourceId))continue;
  const prefix=chronological.slice(0,i),at=Date.parse(event.effectiveAt),people=employeesAt(prefix,event.sourceId,at),count=assignedAt(prefix,event.sourceId,at).count;
  const updated={...event,count,employees:people||[],employeeDetails:(people||[]).map(id=>({id,name:state.employees.find(e=>e.id===id)?.name||id}))};
  if(!same(event,updated)) {
   events=events.map(e=>e.id===event.id?updated:e);
   const inserted=newRows.find(r=>r.key===event.id);if(inserted)inserted.value=updated;
   else changes.push({entity:'production_event',row:eventRows.find(r=>r.key===event.id),value:updated});
   const changed=eventChanges.find(c=>c.after.id===event.id);if(changed)changed.after=updated;
  }
  const report=reports.find(r=>r.id===event.reportId);if(report)Object.assign(report,{count,employees:people||[],employeeDetails:updated.employeeDetails});
 }
 const reportImpacts=[];
 for(const storedReport of reportRows.filter(r=>r.value.kind==='completion'&&impacted.includes(r.value.transitId))) {
  const report=reports.find(r=>r.id===storedReport.value.id);
  if(!report.cancelled&&report.reviewStatus!=='Cần điều chỉnh')Object.assign(report,await recalculateProductionReport(db,events,report,state.employees.map(e=>({key:e.id,payload:e}))));
  const before=storedReport.value;
  const effectiveBefore=state.reports.find(r=>r.id===report.id)||before;
  const business=r=>({quantity:r.reportedQuantity,approvedQuantity:r.approvedQuantity,startedAt:r.startedAt,completedAt:r.completedAt,productionDate:r.productionDate,cancelled:Boolean(r.cancelled),status:r.reviewStatus,note:r.note||'',count:r.count,employees:r.employees,hours:r.hours,laborNotes:r.laborNotes||[]});
  if(same(business(effectiveBefore),business(report)))continue;
  Object.assign(report,{correctedAt:now,correctedBy:actor.login,correctionReason:reason,version:Number(before.version||0)+1});
  changes.push({entity:'production_report',row:storedReport,value:report});
  reportImpacts.push({reportId:report.id,lsxCode:report.lsxCode,before:{quantity:before.cancelled?0:before.reportedQuantity,hours:effectiveBefore.hours,status:before.reviewStatus,startedAt:before.startedAt,completedAt:before.completedAt},after:{quantity:report.cancelled?0:report.reportedQuantity,hours:report.cancelled?null:report.hours,status:report.reviewStatus,startedAt:report.startedAt,completedAt:report.completedAt}});
  const warehouse=warehouseRows.find(r=>r.value.reportId===report.id||r.key===`SX:${report.id}`);
  if(warehouse) {
   const quantityChanged=report.cancelled||Number(report.reportedQuantity)!==Number(before.reportedQuantity);
   const posted=!['Chờ xác nhận','Đã hủy'].includes(warehouse.value.status)||Number(warehouse.value.receivedQuantity||0)>0;
   if(posted&&quantityChanged)fail(`${report.lsxCode}: phiếu nhập kho đã được xử lý. Cần xử lý phiếu kho liên quan trước khi hủy/điều chỉnh báo công.`);
   const value={...warehouse.value,...(report.cancelled?{status:'Đã hủy',cancelReason:reason,cancelledBy:actor.login,cancelledAt:now}:{proposedQuantity:report.approvedQuantity??report.reportedQuantity}),updatedBy:actor.login,updatedAt:now};
   if(!posted)changes.push({entity:'warehouse_in',row:warehouse,value});
  }
 }
 const orderImpacts=[];
 for(const id of impacted) {
  const row=transitRows.find(r=>r.key===id||r.value.id===id);if(!row)fail('Không tìm thấy bản ghi lệnh gốc.');
  const validReports=reports.filter(r=>r.transitId===id&&!r.cancelled&&r.kind==='completion'&&r.reviewStatus==='Đã xác nhận');
  const completedQty=validReports.reduce((sum,r)=>sum+Number(r.approvedQuantity??r.reportedQuantity),0);
  const runtime=assignedAt(events,id,Date.now());
  const first=events.filter(e=>!e.voided&&(e.kind==='start'&&e.sourceId===id||e.kind==='transfer'&&e.destinationId===id)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt))[0];
  const actualStartedAt=first?.effectiveAt||'',actualCompletedAt=completedQty>=Number(row.value.lsxQty)?validReports.map(r=>r.completedAt).sort().at(-1)||'':'';
  const productionState=actualCompletedAt?'Hoàn thành sản xuất':runtime.running?'Đang sản xuất':runtime.known&&runtime.count?'Tạm ngưng':'Chưa sản xuất';
  const value={...row.value,completedQty,actualStartedAt,actualCompletedAt,productionState,updatedAt:now,updatedBy:actor.login};
  for(const changed of changes.filter(c=>c.entity==='production_report'&&c.value.kind==='completion'&&c.value.transitId===id))Object.assign(changed.value,{completedQty,productionState,actualStartedAt,actualCompletedAt});
  const totals=list=>{const valid=list.filter(r=>r.transitId===id&&r.kind==='completion'&&!r.cancelled&&r.reviewStatus!=='Cần điều chỉnh');return {quantity:valid.reduce((s,r)=>s+Number(r.reportedQuantity||0),0),hc:valid.reduce((s,r)=>s+Number(r.hours?.hc||0),0),ot:valid.reduce((s,r)=>s+Number(r.hours?.ot||0),0),hours:valid.reduce((s,r)=>s+Number(r.hours?.total||0),0)};};
  changes.push({entity:'in_transit',row,value});orderImpacts.push({id,lsxCode:row.value.lsxCode,before:state.orders.find(o=>o.id===id)?.completedQty,after:completedQty,productionState,totalsBefore:totals(state.reports),totalsAfter:totals(reports)});
  for(const old of reportRows.filter(r=>r.value.kind==='state'&&(r.value.transitId===id||r.value.lsxCode===row.value.lsxCode)))changes.push({entity:'production_report',row:old,value:{...old.value,actualStartedAt,...(retiredIds.includes(old.key)?{voided:true}:{}),correctedAt:now}});
  newRows.push({entity:'production_report',key:`CORRECTION:${token}:${id}`,value:{id:`CORRECTION:${token}:${id}`,kind:'state',transitId:id,lsxCode:row.value.lsxCode,sku:row.value.sku,line:row.value.line,productionState,actualStartedAt,eventAt:now,updatedAt:now,operator:actor.login,actorId:productionActorId(actor),reviewStatus:'Tự động ghi nhận'}});
 }
 const firstChange=eventChanges.find(c=>c.eventId===operations[0].eventId);
 const allCancelled=operations.every(o=>o.operation==='cancel');
 const audit={id:crypto.randomUUID(),kind:allCancelled?'report-cancel':'report-correction',sourceId:batch?orderId:anchor.sourceId,destinationId:anchor.destinationId,line:orders.find(o=>o.id===orderId)?.line||anchor.line,targetEventId:anchor.id,targetKind:anchor.kind,reportId:batch?undefined:anchor.reportId,effectiveAt:firstChange.before.effectiveAt,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason,employees:unique(eventChanges.flatMap(c=>[...(c.before.employees||[]),...(c.after.employees||[])])),before:firstChange.before,after:firstChange.after,eventChanges,correctionGroupId:token,reportChanges:reportImpacts,orderChanges:orderImpacts,affectedOrderIds:impacted,status:allCancelled?'Đã hủy':'Đã điều chỉnh'};
 if(body.action==='preview')return {ok:true,expectedRevision:revision,eventId:anchor.id,eventChanges,reportImpacts,orderImpacts};
 newRows.push({entity:'production_event',key:audit.id,value:audit});
 newRows.push({entity:'admin_audit',key:audit.id,value:{entity:'production_event',key:anchor.id,before:audit.before,after:audit.after,eventChanges,actor:actor.login,actorId:productionActorId(actor),at:now,reason,reportChanges:reportImpacts,orderChanges:orderImpacts}});
 await assertLegacyAllocationWrite(db,[...changes.filter(c=>c.entity==='production_event').map(c=>c.value),...newRows.filter(r=>r.entity==='production_event').map(r=>r.value)]);
 // Claim global revision first; D1 batch keeps the guarded business writes together.
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(cursorRaw,actor.login,now).run();
 const nextCursor=JSON.stringify({version:Number(JSON.parse(cursorRaw).version||0)+1,token});
 const dedup=[...new Map(changes.map(c=>[`${c.entity}:${c.row.key}`,c])).values()];
 const guards="NOT EXISTS(SELECT 1 FROM json_each(?) g WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(g.value,'$.entity') AND a.record_key=json_extract(g.value,'$.key') AND a.payload=json_extract(g.value,'$.raw')))";
 const writes=[db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND ${guards}`).bind(nextCursor,actor.login,now,cursorRaw,JSON.stringify(dedup.map(c=>({entity:c.entity,key:c.row.key,raw:c.row.raw}))))];
 for(const c of dedup)writes.push(db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)").bind(JSON.stringify(c.value),actor.login,now,c.entity,c.row.key,nextCursor));
 for(const r of newRows)writes.push(db.prepare("INSERT INTO app_records SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)").bind(r.entity,r.key,JSON.stringify(r.value),actor.login,now,nextCursor));
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail(conflictMessage);
 return {ok:true,event:audit,reportImpacts,orderImpacts};
}

export async function correctProduction(...args){
 try{return await runCorrection(...args);}catch(error){
  if(/SQLITE_TOOBIG|Serialized RPC|32MiB|string or blob too big/i.test(error.message))throw Object.assign(Error('Hệ thống chưa xử lý được yêu cầu vì lượng dữ liệu quá lớn. Đây là lỗi hệ thống, không phải do bạn nhập sai giờ. Chưa xác nhận lưu thành công; tải lại dữ liệu để kiểm tra trước khi thử lại.'),{status:503});
  throw error;
 }
}
