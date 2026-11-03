import {assertFinalExitLimit} from '../../lib/production-final-limit.mjs';
import {activeStaffMovement} from '../../lib/production-attendance.mjs';
import {stagePersonAvailable} from '../../lib/production-line-assignment.mjs';
import {importedStageEvents} from '../../lib/production-stage-history.mjs';
import {applyLiveStages,projectLiveStages} from '../../lib/production-stage-live.mjs';
import {trialConflicts,stageKey} from '../../lib/production-stage-trial.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {incidentStage} from '../../lib/production-incidents.mjs';
const fail=(m,s=422)=>{throw Object.assign(Error(m),{status:s});};
export async function writeStageWork({db,body,actor,state,events,now,commit,effectiveAt,validatePeople,calculate,legacyPeople}){
 const order=state.orders.find(o=>o.id===body.orderId);
 if(!order||order.historicalOnly||order.status==='HỦY'||actor.line&&order.line!==actor.line||Number(order.inTransitQty)<=0)fail('Lệnh không còn được phép báo công hoặc không thuộc Line của bạn.',403);
 if(state.reports.filter(r=>r.transitId===order.id&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh').reduce((n,r)=>n+Number(r.reportedQuantity||0),0)>=Number(order.lsxQty))fail('Lệnh đã báo đủ thành phẩm. Chờ QLSX xác nhận.');
 if(!['start','pause','resume','complete','add','extra'].includes(body.action))fail('Thao tác công đoạn không hợp lệ.');
 if(!body.requestIdempotency)fail('Thiếu mã thao tác. Đóng khung và mở lại.');
 const current=projectLiveStages(state.orders,state.reports,state.events,Infinity,{presenceAt:Date.parse(effectiveAt)}),entries=body.stageEntries;
 if(!Array.isArray(entries)||entries.length>30)fail('Chọn công đoạn cần báo công.');
 if(entries.some(e=>e.continuePeople!==undefined&&!Array.isArray(e.continuePeople)))fail('Danh sách nhân viên làm tiếp không hợp lệ.');
 const chosen=entries.map(e=>({stage:String(e.stage),people:Array.isArray(e.people)?[...new Set(e.people.map(String))]:[],quantity:e.quantity==null||e.quantity===''?undefined:Number(e.quantity),...(Array.isArray(e.continuePeople)?{continuePeople:[...new Set(e.continuePeople.map(String))]}:{})}));
 if(body.expectedStages&&chosen.some(e=>(body.expectedStages[stageKey(order.id,e.stage)]||null)!==(current[stageKey(order.id,e.stage)]?.at||null)))fail('Dữ liệu công đoạn vừa thay đổi. Đóng khung, cập nhật rồi thao tác lại.',409);
 const ids=chosen.flatMap(e=>[...e.people,...(body.action==='complete'?(e.continuePeople||[]).filter(id=>!(current[stageKey(order.id,e.stage)]?.people||[]).includes(id)):[])]);
 for(const id of ids){const p=state.employees.find(p=>p.id===id);if(!p||p._deleted||p.active===false||(body.action==='extra'&&(activeStaffMovement(events,id,Date.parse(effectiveAt))?.destinationLine||p.line)!==order.line))fail('Nhân viên không còn thuộc Line hoặc không hoạt động.');}
 const explicitlyAssigned=chosen.flatMap(e=>[...e.people,...(e.continuePeople||[])]);
 for(const id of explicitlyAssigned){const move=activeStaffMovement(events,id,Date.parse(effectiveAt));if(move?.destinationLine&&move.destinationLine!==order.line)fail(`Nhân viên ${state.employees.find(p=>p.id===id)?.name||id} đang chuyển Line ${move.destinationLine}; Line ${order.line} không được phân bổ trong khoảng này.`,409);}
 if(ids.length)validatePeople(ids,order,body.action==='extra');
 const conflicts=trialConflicts(current,ids,['extra','complete'].includes(body.action)?chosen.map(e=>stageKey(order.id,e.stage)):[]);
 if(body.expectedStages&&conflicts.some(c=>(body.expectedStages[c.key]||null)!==(current[c.key]?.at||null)))fail('Phân công nhân viên ở lệnh khác vừa thay đổi. Tải lại và kiểm tra trước khi chuyển.',409);
 if(conflicts.some(c=>state.orders.find(o=>o.id===c.orderId)?.line!==order.line))fail('Nhân viên đang ở Line khác. Cần điều chuyển tại Lịch SX thực tế trước.');
 if(legacyPeople(ids,order,current,effectiveAt))fail('Nhân viên còn phân công ở lệnh cũ chưa có công đoạn. Điều chỉnh phân công cũ tại Lịch SX thực tế trước.');
 const destinations=body.destinations||{};
 for(const key of Object.values(destinations).filter(Boolean)){const d=current[key];if(!d||state.orders.find(o=>o.id===d.orderId)?.status==='HỦY'||state.orders.find(o=>o.id===d.orderId)?.line!==order.line)fail('Công đoạn nhận phải thuộc cùng Line.');}
 for(const e of chosen)if(body.action==='complete'&&!Number.isSafeInteger(e.quantity))fail('Sản lượng phải là số nguyên dương.');
 if(body.action==='complete')assertFinalExitLimit(order,state.reports,chosen,effectiveAt);
 const command={orderId:order.id,action:body.action,at:effectiveAt,entries:chosen,confirmed:body.confirmed===true,destinations,reason:String(body.reason||'').slice(0,4000)};
 const next=applyLiveStages(current,command,state.orders),changed=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(current[k]));
 for(const entry of chosen){const key=stageKey(order.id,entry.stage),s=next[key],prior=current[key];if(!s)continue;s.assignmentAt=Object.fromEntries((s.people||[]).map(id=>[id,prior?.people?.includes(id)?prior.assignmentAt?.[id]||effectiveAt:effectiveAt]));const bindings={};for(const id of s.people||[]){const explicitlySelected=entry.people.includes(id)||(entry.continuePeople||[]).includes(id);const retained=prior?.people?.includes(id)&&stagePersonAvailable(prior,id,order.line,events,Date.parse(effectiveAt));const move=activeStaffMovement(events,id,Date.parse(effectiveAt));if(retained&&prior.lineAssignments?.[id])bindings[id]=prior.lineAssignments[id];else if((!prior?.people?.includes(id)||explicitlySelected)&&move?.kind==='line-movement'&&move.destinationLine===order.line)bindings[id]={movementId:move.id};else if(prior?.lineAssignments?.[id])bindings[id]=prior.lineAssignments[id];}if(Object.keys(bindings).length||prior?.lineAssignments)s.lineAssignments=bindings;}
 const by=productionActorId(actor),items=changed.map(key=>{const s=next[key],o=state.orders.find(o=>o.id===s.orderId);if(Date.parse(s.at)>Date.parse(effectiveAt))fail('Không thể ghi lùi trước thao tác công đoạn đã có.');return {id:crypto.randomUUID(),kind:'stage-work',stageReporting:true,stageAction:chosen.some(e=>key===stageKey(order.id,e.stage))?body.action:'transfer',sourceId:s.orderId,line:o.line,planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,stageName:s.stage,stageBefore:current[key],stageAfter:s,count:s.people.length,employees:s.people,effectiveAt,recordedAt:now,actor:actor.login,actorId:by,reason:command.reason};});
 if(!items.length)fail('Không có thay đổi để ghi nhận.');items[0].requestIdempotency=body.requestIdempotency;
 const reports=[];
 if(body.action==='complete')for(const entry of chosen){
  const prev=current[stageKey(order.id,entry.stage)];
  if(!prev.people.length)fail('Chưa có danh sách nhân viên của công đoạn trong dữ liệu nguồn. Bổ sung người với thời điểm tham gia thực tế trước khi xuất trạm; không tự tính 0 giờ.');
  const last=state.reports.filter(r=>r.transitId===order.id&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh'&&incidentStage(r.stageName)===incidentStage(entry.stage)).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt)).at(-1);
  const startedAt=last?.completedAt||prev.startedAt;
  if(!startedAt||Date.parse(effectiveAt)<=Date.parse(startedAt))fail('Xuất trạm phải sau thời điểm nhập trạm hoặc báo công trước.');
  const stages=order.processes||[],final=stages.some(s=>incidentStage(s)==='FINAL')?incidentStage(entry.stage)==='FINAL':entry.stage===stages.at(-1);
  const report={id:crypto.randomUUID(),kind:'completion',stageReporting:true,transitId:order.id,orderSnapshot:order,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,line:order.line,lsxQty:order.lsxQty,stageName:entry.stage,stageQuantity:entry.quantity,reportedQuantity:final?entry.quantity:0,startedAt,actualStartedAt:prev.startedAt,completedAt:effectiveAt,productionDate:new Date(Date.parse(effectiveAt)+7*3600000).toISOString().slice(0,10),count:prev.people.length,sourceCount:prev.people.length,employees:prev.people,reportedBy:actor.login,reportedById:by,actorId:by,reportedAt:now,reviewStatus:'Chờ kiểm tra',warehouseStatus:'Chưa tạo phiếu',version:1,note:command.reason};
  const existing=state.reports.filter(r=>r.transitId===order.id&&r.kind==='completion'&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh').reduce((n,r)=>n+Number(r.reportedQuantity||0),0);
  if(final&&existing+entry.quantity>Number(order.lsxQty))fail('Sản lượng thành phẩm vượt phần còn lại của lệnh.');
  report.importedStageTimeline=importedStageEvents(state.orders,state.reports,state.events).filter(e=>e.sourceId===order.id&&incidentStage(e.stageName)===incidentStage(entry.stage));
  Object.assign(report,calculate([...events,...items],report));const contributors=(report.hours?.perEmployee||[]).filter(p=>Number(p.total)>0).map(p=>p.id);if(contributors.length){report.employees=contributors;report.count=contributors.length;report.sourceCount=contributors.length;}reports.push(report);const event=items.find(e=>e.sourceId===order.id&&e.stageName===entry.stage);event.reportId=report.id;event.quantity=report.reportedQuantity;event.stageQuantity=entry.quantity;
 }
 await commit(db,actor,now,items,null,null,reports.map(r=>({entity:'production_report',key:r.id,payload:r,expected:null})));
 return {ok:true,event:items[0],events:items,reports};
}
