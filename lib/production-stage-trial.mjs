// Interactive proposal only. Never writes production events/reports or browser storage.
export const stageKey=(orderId,stage)=>JSON.stringify([orderId,stage]);
export const isStageTrialAction=action=>['start','pause','resume','complete','add','incident','extra'].includes(action);
export const hasStageTrial=(order,state)=>Object.values(state).some(s=>s.orderId===order.id);
// Legacy order-level events cannot identify which stages are running. Let the
// operator explicitly establish a disposable baseline; never infer all stages.
export function initializeStageTrial(state,command,orders){
 const order=orders.find(o=>o.id===command.orderId);
 if(!order||hasStageTrial(order,state)||!isStageTrialAction(command.action)||command.action==='start')throw Error('Không thể khởi tạo lại công đoạn đã thử.');
 const next=applyStageTrial(state,{...command,action:'start'},orders);
 if(command.action==='resume')for(const entry of command.entries)next[stageKey(order.id,entry.stage)].status='paused';
 return next;
}
export function trialStages(order){return [...new Set((order.processes||[]).filter(p=>typeof p==='string'&&p.trim()).map(p=>p.trim()))];}
export function stageChoices(order,state,action){return trialStages(order).filter(stage=>{if(!hasStageTrial(order,state)&&['pause','incident'].includes(action))return true;const s=state[stageKey(order.id,stage)],status=s?.status||'waiting';return action==='extra'?['waiting','running','paused','partial'].includes(status):action==='start'?status==='waiting'||status==='partial':action==='resume'?status==='paused':action==='incident'?['running','paused'].includes(status):status==='running';});}
export function trialConflicts(state,ids,exclude=[]){return Object.entries(state).flatMap(([key,s])=>exclude.includes(key)?[]:(s.people||[]).filter(id=>ids.includes(id)).map(id=>({key,id,orderId:s.orderId,stage:s.stage})));}
export function applyStageTrial(state,command,orders){
 const {orderId,action,at,entries,confirmed=false,destinations={},reason='',affectedQuantity=0}=command;
 const order=orders.find(o=>o.id===orderId),instant=Date.parse(at);
 if(!order||!Number.isFinite(instant)||!entries?.length)throw Error('Chọn công đoạn và thời gian hợp lệ.');
 if(!['start','pause','resume','complete','add','incident','extra'].includes(action))throw Error('Thao tác không hợp lệ.');
 if(action==='incident'&&(!reason.trim()||!Number.isFinite(Number(affectedQuantity))||Number(affectedQuantity)<0||Number(affectedQuantity)>Number(order.lsxQty)))throw Error('Nhập nội dung sự cố và số lượng ảnh hưởng hợp lệ.');
 const next=structuredClone(state),allowed=stageChoices(order,state,action),allIds=[];
 for(const e of entries){if(!allowed.includes(e.stage))throw Error('Trạng thái công đoạn vừa thay đổi; chọn lại thao tác.');const old=state[stageKey(orderId,e.stage)];if(old?.at&&instant<Date.parse(old.at))throw Error('Thời gian phải từ sau thao tác trước của công đoạn.');
 if(action==='extra'||action==='start'||action==='add'||action==='resume'&&!old?.people.length){if(!e.people?.length)throw Error('Chọn nhân viên cho từng công đoạn.');if(action==='add'&&e.people.some(id=>old.people.includes(id)))throw Error('Nhân viên đã ở công đoạn này.');allIds.push(...e.people);}}
 if(new Set(allIds).size!==allIds.length)throw Error('Một nhân viên chỉ được chọn cho một công đoạn cùng thời điểm.');
 const conflicts=trialConflicts(state,allIds,action==='extra'?entries.map(e=>stageKey(orderId,e.stage)):[]);if(conflicts.length&&!confirmed)throw Error('Cần xác nhận chuyển nhân viên từ công việc đang làm.');
 for(const c of conflicts){if(instant<Date.parse(next[c.key].at))throw Error('Không thể chuyển lùi trước thao tác đã ghi nhận.');for(const session of next[c.key].extraSessions||[])if(session.employee===c.id&&!session.end)session.end=at;next[c.key].people=next[c.key].people.filter(id=>id!==c.id);next[c.key].at=at;if(!next[c.key].people.length)next[c.key].status='paused';}
 for(const e of entries){const key=stageKey(orderId,e.stage),previous=next[key]||{orderId,stage:e.stage,people:[],completed:0};
 if(['extra','pause','complete'].includes(action)||action==='incident')for(const session of previous.extraSessions||[])if(!session.end)session.end=at;
 if(action==='extra')next[key]={...previous,startedAt:previous.startedAt||at,status:'running',people:e.people,participants:[...new Set([...(previous.participants||[]),...e.people])],at,extraSessions:[...(previous.extraSessions||[]),...e.people.map(employee=>({employee,start:at}))]};
 if(action==='resume'&&previous.extraSessions?.length)previous.extraSessions.push(...(previous.people.length?previous.people:e.people).map(employee=>({employee,start:at})));
 if(action==='start')next[key]={...previous,status:'running',people:e.people,participants:[...new Set([...(previous.participants||[]),...e.people])],at};
 if(action==='add')next[key]={...previous,status:'running',people:[...new Set([...previous.people,...e.people])],participants:[...new Set([...(previous.participants||[]),...e.people])],at};
 if(action==='incident')next[key]={...previous,status:'paused',at,incidents:[...(previous.incidents||[]),{at,reason:reason.trim(),affectedQuantity:Number(affectedQuantity),stopWork:true}]};
 if(action==='pause')next[key]={...previous,status:'paused',reason,at};
 if(action==='resume'){const people=previous.people.length?previous.people:e.people;next[key]={...previous,status:'running',people,participants:[...new Set([...(previous.participants||[]),...people])],at};}
 if(action==='complete'){
 const qty=Number(e.quantity),limit=Number(order.lsxQty||0);if(!(qty>0)||!Number.isFinite(qty)||qty+previous.completed>limit)throw Error('Sản lượng công đoạn phải lớn hơn 0 và không vượt SL lệnh.');
 for(const id of previous.people){const target=destinations[id];if(!target)continue;const dest=next[target];if(!dest||dest.status!=='running'||entries.some(x=>target===stageKey(orderId,x.stage)))throw Error('Chọn công đoạn nhận đang sản xuất, khác công đoạn xuất.');if(instant<Date.parse(dest.at))throw Error('Giờ chuyển phải từ sau thao tác của công đoạn nhận.');dest.people=[...new Set([...dest.people,id])];dest.participants=[...new Set([...(dest.participants||[]),id])];dest.at=at;}
 next[key]={...previous,status:previous.completed+qty>=limit?'done':'partial',completed:previous.completed+qty,people:[],at};
 }
 }
 return next;
}
