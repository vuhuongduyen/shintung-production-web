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
 const current=projectLiveStages(state.orders,state.reports,state.events),entries=body.stageEntries;
 if(!Array.isArray(entries)||entries.length>30)fail('Chọn công đoạn cần báo công.');
 const chosen=entries.map(e=>({stage:String(e.stage),people:Array.isArray(e.people)?[...new Set(e.people.map(String))]:[],quantity:Number(e.quantity)}));
 if(body.expectedStages&&chosen.some(e=>(body.expectedStages[stageKey(order.id,e.stage)]||null)!==(current[stageKey(order.id,e.stage)]?.at||null)))fail('Dữ liệu công đoạn vừa thay đổi. Đóng khung, cập nhật rồi thao tác lại.',409);
 const ids=chosen.flatMap(e=>e.people);
 for(const id of ids){const p=state.employees.find(p=>p.id===id);if(!p||p._deleted||p.active===false||p.line!==order.line)fail('Nhân viên không còn thuộc Line hoặc không hoạt động.');}
 if(ids.length)validatePeople(ids,order,body.action==='extra');
 const conflicts=trialConflicts(current,ids,body.action==='extra'?chosen.map(e=>stageKey(order.id,e.stage)):[]);
 if(conflicts.some(c=>state.orders.find(o=>o.id===c.orderId)?.line!==order.line))fail('Nhân viên đang ở Line khác. Cần điều chuyển tại Lịch SX thực tế trước.');
 if(legacyPeople(ids,order,current,effectiveAt))fail('Nhân viên còn phân công ở lệnh cũ chưa có công đoạn. Điều chỉnh phân công cũ tại Lịch SX thực tế trước.');
 const destinations=body.destinations||{};
 for(const key of Object.values(destinations).filter(Boolean)){const d=current[key];if(!d||state.orders.find(o=>o.id===d.orderId)?.status==='HỦY'||state.orders.find(o=>o.id===d.orderId)?.line!==order.line)fail('Công đoạn nhận phải thuộc cùng Line.');}
 for(const e of chosen)if(body.action==='complete'&&!Number.isSafeInteger(e.quantity))fail('Sản lượng phải là số nguyên dương.');
 const command={orderId:order.id,action:body.action,at:effectiveAt,entries:chosen,confirmed:body.confirmed===true,destinations,reason:String(body.reason||'').slice(0,4000)};
 const next=applyLiveStages(current,command,state.orders),changed=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(current[k]));
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
  Object.assign(report,calculate([...events,...items],report));reports.push(report);const event=items.find(e=>e.sourceId===order.id&&e.stageName===entry.stage);event.reportId=report.id;event.quantity=report.reportedQuantity;event.stageQuantity=entry.quantity;
 }
 await commit(db,actor,now,items,null,null,reports.map(r=>({entity:'production_report',key:r.id,payload:r,expected:null})));
 return {ok:true,event:items[0],reports};
}
