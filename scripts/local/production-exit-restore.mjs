import {projectLiveStages} from '../../lib/production-stage-live.mjs';
import {stageKey} from '../../lib/production-stage-trial.mjs';
import {incidentStage} from '../../lib/production-incidents.mjs';
import {stageEmployeeChoices} from '../../lib/production-stage-staff.mjs';
import {productionDisplayTime} from '../../lib/production-display-time.mjs';
const fail=m=>{throw Object.assign(Error(m),{status:422});};
const live=r=>!r.voided&&!r.cancelled&&r.reviewStatus!=='Cần điều chỉnh';
// Plan only. The caller commits these changes with the cancellation in one guarded batch.
export function planExitRestore({request,chosen,state,events,reports,actor,now,reason}){
 if(!request)return {writes:[],changes:[],impacts:[]};
 const exit=chosen[0],ids=request.employees;
 if(chosen.length!==1||exit.stageAction!=='complete')fail('Phân bổ lại nhân viên chỉ áp dụng khi hủy một lần Xuất trạm.');
 if(!['continuous','return'].includes(request.mode)||!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)fail('Chọn cách khôi phục và ít nhất một nhân viên, không trùng tên.');
 if(reports.find(r=>r.id===exit.reportId)?.reviewStatus==='Đã xác nhận')fail('Báo công Xuất trạm đã xác nhận. Cần xử lý xác nhận/phiếu kho liên quan trước.');
 const from=Date.parse(exit.effectiveAt),at=request.mode==='continuous'?exit.effectiveAt:request.at,start=Date.parse(at);
 if(!Number.isFinite(start)||!/(Z|[+-]\d\d:\d\d)$/.test(String(at))||start<from||start>Date.parse(now))fail('Giờ quay lại phải từ lúc xuất nhầm đến thời điểm hiện tại.');
 const order=state.orders.find(o=>o.id===exit.sourceId),targetStage=(order.processes||[]).find(s=>incidentStage(s)===incidentStage(exit.stageName));
 if(!targetStage||!exit.stageBefore?.startedAt||exit.stageBefore.extraDate)fail('Công đoạn thiếu thời điểm nhập trạm hoặc thuộc làm việc phát sinh; cần điều chỉnh riêng.');
 const eligible=stageEmployeeChoices({employees:state.employees,events:state.events,schedules:state.approvedSchedules,line:order.line,effectiveAt:at});
 for(const id of ids)if(!eligible.some(p=>p.id===id))fail(`${state.employees.find(p=>p.id===id)?.name||id} không thuộc lịch làm việc của Line tại ${productionDisplayTime(at)}.`);
 const targetKey=stageKey(order.id,targetStage),active=events.filter(live),remaining=active.filter(e=>e.id!==exit.id),remainingReports=reports.filter(r=>r.id!==exit.reportId&&live(r));
 const writes=[],changes=[],impacts=[];
 const label=s=>`${state.orders.find(o=>o.id===s.orderId)?.lsxCode||s.orderId} · ${s.stage}`;
 const add=(before,after,operation)=>{writes.push({entity:'production_event',key:after.id,value:after});changes.push({eventId:after.id,operation,before:before||null,after});};
 const make=(s,people,effectiveAt,operation)=>{
  const o=state.orders.find(o=>o.id===s.orderId),after={...s,people,participants:[...new Set([...(s.participants||[]),...people])],status:people.length?'running':'paused',at:effectiveAt};
  const event={id:crypto.randomUUID(),kind:'stage-work',stageReporting:true,stageAction:'transfer',sourceId:o.id,line:o.line,lsxCode:o.lsxCode,planId:o.planId,stageName:s.stage,stageBefore:s,stageAfter:after,employees:people,count:people.length,effectiveAt,recordedAt:now,actor:actor.login,actorId:actor.userId||actor.login,reason,exitRestoreId:exit.id};
  add(null,event,operation);return after;
 };
 // Restore this stage only. Other assignments are retained even if they overlap.
 const old=projectLiveStages(state.orders,remainingReports,remaining,from)[targetKey];
 if(!old||old.status!=='running')fail('Sau khi bỏ Xuất trạm, công đoạn không ở trạng thái đang sản xuất. Kiểm tra thao tác phụ thuộc.');
 const released=(old.people||[]).filter(id=>request.mode==='return'&&start>from||!ids.includes(id));
 if(released.length)impacts.push({orderId:order.id,stage:targetStage,label:label(old),employees:released,from:exit.effectiveAt,action:'Kết thúc phân công tại giờ xuất nhầm'});
 if(request.mode==='return'&&start>from)make(old,[],exit.effectiveAt,'restore-wait');
 make({...old,at:request.mode==='return'?at:old.at},ids,at,'restore');
 impacts.push({orderId:order.id,stage:targetStage,label:label(old),employees:ids,from:at,action:request.mode==='continuous'?'Khôi phục làm liên tục':'Quay lại làm từ giờ chọn'});
 return {writes,changes,impacts};
}

export function assertRestoreTimeline({orders,reports,events,people,from,employees}){
 const points=[...new Set([from,...events.filter(live).map(e=>Date.parse(e.effectiveAt)).filter(n=>Number.isFinite(n)&&n>=from)])].sort((a,b)=>a-b);
 for(const at of points){const assigned=new Map();for(const s of Object.values(projectLiveStages(orders,reports,events,at)))for(const id of s.people||[]){if(!people.has(id))continue;const old=assigned.get(id);if(old){const name=employees.find(p=>p.id===id)?.name||id,label=x=>`${orders.find(o=>o.id===x.orderId)?.lsxCode||x.orderId} · ${x.stage}`;fail(`${name} còn trùng ${label(old)} và ${label(s)} từ ${productionDisplayTime(at)}. Xử lý thao tác phụ thuộc trước.`);}assigned.set(id,s);}}
}
