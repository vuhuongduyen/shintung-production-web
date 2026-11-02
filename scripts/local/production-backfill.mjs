import {workflowReadSnapshot} from '../../worker/read-performance.mjs';
import {orphanStageAllocation,repairOrphanCarry} from '../../lib/production-orphan-allocation.mjs';
import {withCorrectionSnapshot} from './production-correction-snapshot.mjs';
import {readProductionWorkflow,recalculateProductionReport} from './production-workflow.mjs';
import {backfillInspection,stageKey} from '../../lib/production-backfill.mjs';
import {projectLiveStages} from '../../lib/production-stage-live.mjs';
import {incidentStage} from '../../lib/production-incidents.mjs';
import {trialStages} from '../../lib/production-stage-trial.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';
import {productionDisplayTime as display} from '../../lib/production-display-time.mjs';
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});},time=v=>Date.parse(v),stamp=t=>new Date(t).toISOString();
const scope="'production_event','production_report','production_history_import','production_cursor','in_transit','capacity','production_schedule','employees','warehouse_in'";
export async function backfillStageWork(db,body,actor,catalog){
 const input=body.backfill,now=new Date().toISOString(),a=time(input?.from),closed=!!input?.to,b=closed?time(input.to):time(input.through||now);
 if(!['inspect','preview','apply','save'].includes(input?.mode)||!Number.isFinite(a)||!Number.isFinite(b)||a>=b||b>time(now)||b-a>31*86400000||!/(Z|[+-]\d\d:\d\d)$/.test(input.from)||closed&&!/(Z|[+-]\d\d:\d\d)$/.test(input.to))fail('Chọn khoảng bù hợp lệ, tối đa 31 ngày; giờ xuất phải sau giờ nhập và không ở tương lai.');
 if(!closed&&input.through&&time(now)-b>600000)fail('Kết quả kiểm tra đã quá 10 phút. Kiểm tra lại phân công hiện tại trước khi ghi nhập bù.',409);
 const run=async(records,snapshot)=>{
 const revision=await recordRevision(JSON.stringify(records));if(input.mode==='apply'&&revision!==input.expectedRevision)fail('Lịch hoặc phân công vừa thay đổi. Bấm Kiểm tra lại và xem ảnh hưởng trước khi lưu.',409);
 const state=await readProductionWorkflow(workflowReadSnapshot(db),{...actor,line:null},catalog,{includeDerivedHours:false}),order=state.orders.find(o=>o.id===body.orderId),stage=input.stage;
 if(!order||Number(order.inTransitQty)<=0||order.status==='HỦY'||order.historicalOnly||order.syncStatus!=='ĐÃ ĐỒNG BỘ'||actor.line&&order.line!==actor.line||!trialStages(order).includes(stage))fail('Lệnh hoặc công đoạn không còn phù hợp, hoặc không thuộc Line của bạn.',403);
 const checked=backfillInspection(state,order,input.from,stamp(b));
 if(!checked.total)fail('Khoảng đã chọn không có giờ làm theo lịch Line. Kiểm tra ngày và ca làm việc.');
 const activeReports=state.reports.filter(r=>!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh'),completed=activeReports.filter(r=>r.transitId===order.id&&incidentStage(r.stageName)===incidentStage(stage)).reduce((n,r)=>n+Number(r.stageQuantity??r.reportedQuantity??0),0),remainingQuantity=Math.max(0,Number(order.lsxQty)-completed);
 const targetKey=stageKey(order.id,stage),orphan=orphanStageAllocation(state.events,order.id,stage,a),occupied=checked.slices.find(slice=>{const s=slice.stages[targetKey];return s?.status==='running'||s?.startedAt&&s?.people?.length;});
 const overlap=activeReports.find(r=>r.transitId===order.id&&incidentStage(r.stageName)===incidentStage(stage)&&time(r.startedAt)<b&&time(r.completedAt)>a);
 const blockingMessage=overlap?`${order.lsxCode} · ${stage} đã có phiếu xuất ${Number(overlap.stageQuantity??overlap.reportedQuantity??0).toLocaleString('vi-VN')} cho khoảng ${display(overlap.startedAt)} – ${display(overlap.completedAt)}. Khoảng bù đang trùng phiếu này; kiểm tra/sửa phiếu đã có, không nhập thêm lần nữa.`:occupied&&!orphan?`${order.lsxCode} · ${stage} đã phân công ${(occupied.stages[targetKey].people||[]).map(id=>state.employees.find(p=>p.id===id)?.name||id).join(', ')||'nhân viên'} lúc ${display(stamp(occupied.from))}. Số lượng còn lại không có nghĩa là khoảng giờ này chưa nhập trạm. Kiểm tra lần nhập/xuất đã có hoặc chọn khoảng sau lần xuất; không tạo lần nhập trùng.`:'';
 if(input.mode==='inspect')return {ok:true,blockingMessage,repairAllocation:orphan?{people:orphan.people,at:orphan.event.effectiveAt,message:'Đã có Bổ sung người nhưng thiếu Nhập trạm. Ghi nhập bù sẽ nối vào phân công cũ, không chuyển người đi rồi thêm lại.'}:null,candidates:checked.candidates.map(p=>({...p,assignments:p.assignments.map(x=>actor.line&&x.line!==actor.line?{...x,orderId:null,order:'Phân công ở Line khác',stage:''}:x)})),remainingQuantity,expectedRevision:revision,checkedThrough:stamp(b)};
 if(!Array.isArray(input.people))fail('Chọn danh sách nhân viên hợp lệ.');
 const people=[...new Set(input.people.map(String))];if(!people.length||people.some(id=>!checked.candidates.some(p=>p.id===id&&p.eligible)))fail('Nhân viên không có lịch tại Line '+order.line+' trong toàn bộ giờ làm của khoảng bù. Kiểm tra lịch chuyển Line hoặc thu hẹp khoảng bù.');
 const key=stageKey(order.id,stage),validEvents=state.events.filter(e=>!e.voided&&!e.cancelled&&!e.replacedByStageBatch),before=projectLiveStages(state.orders,state.reports,validEvents,a)[key];
 if(blockingMessage)fail(blockingMessage);
 const within=validEvents.filter(e=>e.stageReporting&&e.sourceId===order.id&&e.stageName===stage&&time(e.effectiveAt)>a&&time(e.effectiveAt)<b),repairableInside=orphan?within.filter(e=>e.stageAction==='add'&&repairOrphanCarry(e,orphan.people)&&JSON.stringify([...(e.stageBefore.people||[])].sort())===JSON.stringify([...(e.stageAfter.people||[])].sort())):[];
 const inside=within.find(e=>!repairableInside.includes(e));if(inside)fail(`Có thao tác ${inside.stageAction} tại ${display(inside.effectiveAt)} của ${stage} trong khoảng bù. Cần đối chiếu mốc này trước; chưa lưu thay đổi.`);
 for(const slice of checked.slices){const other=(slice.stages[key]?.people||[]).filter(id=>!people.includes(id));if(other.length)fail('Công đoạn đã phân công '+other.map(id=>state.employees.find(p=>p.id===id)?.name||id).join(', ')+'. Kiểm tra và chọn đủ nhóm tham gia thực tế trước khi nhập bù.');}
 if(closed&&orphan&&validEvents.some(e=>e.stageReporting&&e.sourceId===order.id&&incidentStage(e.stageName)===incidentStage(stage)&&time(e.effectiveAt)===b&&!repairOrphanCarry(e,orphan.people)))fail('Giờ xuất bù trùng một thao tác đã có của công đoạn. Kiểm tra mốc này trước; chưa lưu thay đổi.');
 const quantity=closed?Number(input.quantity):0;
 if(closed&&(!Number.isSafeInteger(quantity)||quantity<=0||quantity>Number(order.lsxQty)-completed))fail(`Số lượng xuất phải từ 1 đến ${Math.max(0,Number(order.lsxQty)-completed)} còn lại của ${stage}.`);
 if(!closed&&completed>=Number(order.lsxQty))fail('Công đoạn đã báo đủ sản lượng.');
 if(!closed&&validEvents.some(e=>e.sourceId===order.id&&e.stageName===stage&&time(e.effectiveAt)>=a&&!(orphan&&time(e.effectiveAt)===a&&['add','transfer'].includes(e.stageAction))))fail('Công đoạn đã có thao tác sau giờ nhập bù. Chọn ghi xuất trạm cùng lúc hoặc điều chỉnh thao tác đã có.');
 if(activeReports.some(r=>r.transitId===order.id&&r.stageName===stage&&time(r.startedAt)<b&&time(r.completedAt)>a))fail('Khoảng bù trùng phiếu báo công đã có của công đoạn. Dùng Sửa thao tác để điều chỉnh.');
 const selected=checked.candidates.filter(p=>people.includes(p.id)),allocationImpacts=selected.flatMap(p=>p.assignments.filter(x=>x.orderId!==order.id||x.stage!==stage).map(x=>({...x,employeeId:p.id,name:p.name})));
 const allocationSignature=items=>JSON.stringify(items.map(i=>[i.employeeId,i.orderId,i.stage,i.from,i.to]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));
 if(input.mode==='save'&&(!Array.isArray(input.confirmedAllocations)||allocationSignature(input.confirmedAllocations)!==allocationSignature(allocationImpacts)))fail('Phân công vừa thay đổi so với danh sách đã chọn. Chưa lưu; tải lại danh sách để xác nhận đúng người và khoảng giờ.',409);
 if(allocationImpacts.some(i=>i.legacy))fail('Có phân công cũ chưa xác định công đoạn: '+allocationImpacts.filter(i=>i.legacy).map(i=>`${i.name} · ${i.order} · ${display(i.from)}–${display(i.to)}`).join('; ')+'. Chưa thể tự tách khoảng này; không có thay đổi được lưu.');
 if(allocationImpacts.some(i=>i.line!==order.line))fail('Phân công trùng thuộc Line khác. Kiểm tra Lịch SX thực tế trước; không tự chuyển Line bằng nhập bù.');
 const by=productionActorId(actor),batch=crypto.randomUUID(),events=[],updates=new Map(),reportImpacts=[];
 const add=(o,s,fromState,toState,at,action,extra={})=>{const e={id:crypto.randomUUID(),kind:'stage-work',stageReporting:true,stageAction:action,sourceId:o.id,line:o.line,lsxCode:o.lsxCode,sku:o.sku,name:o.name,stageName:s,stageBefore:fromState,stageAfter:{...toState,at:stamp(at)},employees:toState.people||[],count:(toState.people||[]).length,effectiveAt:stamp(at),recordedAt:now,actor:actor.login,actorId:by,backfillBatch:batch,backfillWindow:{from:stamp(a),to:closed?stamp(b):null},reason:'Nhập trạm bù',...extra};events.push(e);return e;};
 const startState={...before,orderId:order.id,stage,people,participants:people,status:'running',startedAt:stamp(a),completed:Number(before?.completed||0),admittedQuantity:Number(order.lsxQty)};
 if(orphan&&orphan.people.some(id=>!people.includes(id)))fail('Phân công cũ còn nhân viên chưa được chọn. Chọn đủ nhóm đang phân công để nối lần nhập bù; không tự xóa phân công.');
 const start=add(order,stage,before,startState,a,'start',orphan?{repairsAllocationEventId:orphan.event.id}:{});start.requestIdempotency=body.requestIdempotency;
 for(const e of repairableInside)updates.set(e.id,{...e,stageBefore:{...startState,at:e.stageBefore.at},stageAfter:{...startState,at:e.effectiveAt},employees:people,count:people.length,version:Number(e.version||0)+1,correctedAt:now,correctedBy:by,backfillAllocationRepair:{batch,sourceEventId:orphan.event.id,startedAt:stamp(a)}});
 let report;
 if(closed){const originalEnd=projectLiveStages(state.orders,state.reports,validEvents,b)[key]||before,nextCompleted=Number(originalEnd?.completed||0)+quantity;
 const restored={...originalEnd,orderId:order.id,stage,people:originalEnd?.people||[],completed:nextCompleted,admittedQuantity:Math.max(Number(originalEnd?.admittedQuantity||0),nextCompleted),status:nextCompleted>=Number(order.lsxQty)?'done':originalEnd?.people?.length?originalEnd.status:'partial'};
 if(orphan){restored.people=[];restored.admittedQuantity=Number(order.lsxQty);restored.status=nextCompleted>=Number(order.lsxQty)?'done':'paused';restored.startedAt=stamp(a);}
 const finish=add(order,stage,startState,restored,b,'complete');
 // Remove only unchanged orphan carry-over; preserve genuine later assignments.
 let orphanCarry=!!orphan;
 for(const e of validEvents.filter(e=>e.stageReporting&&e.sourceId===order.id&&e.stageName===stage&&time(e.effectiveAt)>=b).sort((x,y)=>time(x.effectiveAt)-time(y.effectiveAt)||time(x.recordedAt)-time(y.recordedAt))){
  if(e.importedStageProjection)fail('Công đoạn có dữ liệu lịch sử nhập ERP sau khoảng bù; chưa thể tự sửa mốc sản lượng.');
  const repaired=orphanCarry?repairOrphanCarry(e,orphan.people):null;if(!repaired)orphanCarry=false;const source=repaired||e;
  if(Number(source.stageAfter?.completed||0)+quantity>=Number(order.lsxQty)&&source.stageAfter?.people?.length)fail(`${order.lsxCode} · ${stage}: xuất bù ${quantity.toLocaleString('vi-VN')} sẽ hoàn thành công đoạn lúc ${display(stamp(b))}, nhưng ${source.stageAfter.people.map(id=>state.employees.find(p=>p.id===id)?.name||id).join(', ')} có thao tác ${e.stageAction} mới lúc ${display(e.effectiveAt)}. Đây không phải phân công lặp cũ nên chưa tự sửa; chưa lưu thay đổi.`);
  const adjust=s=>s?{...s,completed:Number(s.completed||0)+quantity,...(Number(s.completed||0)+quantity>=Number(order.lsxQty)&&!(s.people||[]).length?{status:'done'}:{}),admittedQuantity:s.admittedQuantity==null?undefined:Math.min(Number(order.lsxQty),Number(s.admittedQuantity)+quantity)}:s;
  updates.set(e.id,{...source,...(repaired?{backfillAllocationRepair:{batch,sourceEventId:orphan.event.id,endedAt:stamp(b)}}:{}),stageBefore:adjust(source.stageBefore),stageAfter:adjust(source.stageAfter),version:Number(e.version||0)+1,correctedAt:now,correctedBy:by,backfillQuantityBatch:batch});
 }
 const final=trialStages(order).some(s=>s.replace(/^[ABC]-/,'')==='FINAL')?stage.replace(/^[ABC]-/,'')==='FINAL':stage===trialStages(order).at(-1);
 if(final&&activeReports.filter(r=>r.transitId===order.id).reduce((n,r)=>n+Number(r.reportedQuantity||0),0)+quantity>Number(order.lsxQty))fail('Sản lượng thành phẩm vượt số lượng lệnh.');
 report={id:crypto.randomUUID(),kind:'completion',stageReporting:true,transitId:order.id,orderSnapshot:order,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,line:order.line,lsxQty:order.lsxQty,stageName:stage,stageQuantity:quantity,reportedQuantity:final?quantity:0,startedAt:stamp(a),actualStartedAt:stamp(a),completedAt:stamp(b),productionDate:new Date(b+25200000).toISOString().slice(0,10),employees:people,count:people.length,sourceCount:people.length,actorId:by,reportedBy:actor.login,reportedById:by,reportedAt:now,reviewStatus:'Chờ kiểm tra',warehouseStatus:'Chưa tạo phiếu',version:1,backfillBatch:batch};finish.reportId=report.id;finish.stageQuantity=quantity;finish.quantity=report.reportedQuantity;
 }
 // Overlay only intersecting segments on donor stages, then restore at the exact end.
 const donorKeys=new Set(allocationImpacts.map(i=>stageKey(i.orderId,i.stage)));
 for(const donorKey of donorKeys){let priorRemove=[];const points=[...new Set([a,...checked.slices.map(s=>s.from),...(closed?[b]:[])])].sort((x,y)=>x-y);
  for(const at of points){const s=projectLiveStages(state.orders,state.reports,validEvents,at)[donorKey];if(!s)continue;const remove=closed&&at===b?[]:(s.people||[]).filter(id=>people.includes(id));const boundary=validEvents.some(e=>stageKey(e.sourceId,e.stageName)===donorKey&&time(e.effectiveAt)===at);
   if((remove.length||priorRemove.length)&&(boundary||JSON.stringify(remove)!==JSON.stringify(priorRemove))){const o=state.orders.find(o=>o.id===s.orderId),beforeState=projectLiveStages(state.orders,state.reports,[...validEvents,...events],at-1)[donorKey]||s,after={...s,people:(s.people||[]).filter(id=>!remove.includes(id))};if(!after.people.length&&after.status==='running')after.status='paused';add(o,s.stage,beforeState,after,at,'transfer');}priorRemove=remove;
  }
 }
 const revised=validEvents.map(e=>updates.get(e.id)||e).concat(events),writes=[];
 if(report){Object.assign(report,await recalculateProductionReport(db,revised,report,state.employees.map(p=>({key:p.id,payload:p}))));if(!report.hours?.total)fail('Không có giờ công hợp lệ sau khi trừ nghỉ, giải lao và lịch làm việc. Kiểm tra người và khoảng giờ.');writes.push({entity:'production_report',key:report.id,value:report});}
 for(const old of activeReports.filter(r=>allocationImpacts.some(i=>i.orderId===r.transitId&&i.stage===r.stageName&&time(r.startedAt)<time(i.to)&&time(r.completedAt)>time(i.from)))){
  const warehouse=records.filter(r=>r.entity==='warehouse_in').map(r=>JSON.parse(r.payload)).find(r=>r.reportId===old.id||r.id===`SX:${old.id}`);
  if(old.reviewStatus==='Đã xác nhận'||old.erpStageImport||old.manualHours||warehouse&&(!['Chờ xác nhận','Đã hủy'].includes(warehouse.status)||warehouse.sheetSync||warehouse.sheetConfirmationHash||Number(warehouse.receivedQuantity)>0))fail(`Không thể tự sửa ${old.lsxCode||old.transitId} · ${old.stageName} · ${display(old.startedAt)}–${display(old.completedAt)}: phiếu đã xác nhận/khóa hoặc xử lý kho. Nhân viên liên quan: ${selected.map(p=>p.name).join(', ')}. Chưa lưu thay đổi.`);
  const next={...old,...await recalculateProductionReport(db,revised,old,state.employees.map(p=>({key:p.id,payload:p}))),reviewStatus:'Chờ kiểm tra',version:Number(old.version||0)+1,correctedAt:now,correctedBy:by,backfillBatch:batch};next.employees=(next.hours?.perEmployee||[]).filter(p=>p.total>0).map(p=>p.id);next.count=next.employees.length;writes.push({entity:'production_report',key:next.id,value:next});reportImpacts.push({reportId:old.id,order:old.lsxCode||old.transitId,stage:old.stageName,beforeHours:old.hours?.total,afterHours:next.hours?.total});
 }
 const result={ok:true,expectedRevision:revision,allocationImpacts,reportImpacts,report:report||null,checkedThrough:stamp(b),closed,repairAllocation:orphan?{eventId:orphan.event.id,message:'Bổ sung mốc Nhập trạm cho phân công cũ; giữ nguyên lịch sử Bổ sung người.'}:null};
 if(input.mode==='preview')return result;
 if(allocationImpacts.length&&!input.resolveAssignments)fail('Chưa xác nhận chuyển phần giờ phân bổ nhầm. Xem ảnh hưởng và tích xác nhận trong khung.');
 for(const [id,value]of updates)writes.push({entity:'production_event',key:id,value});
 for(const e of events)writes.push({entity:'production_event',key:e.id,value:e});
 const audit={id:crypto.randomUUID(),kind:'report-correction',sourceId:order.id,line:order.line,actor:actor.login,actorId:by,recordedAt:now,effectiveAt:now,reason:'Nhập trạm bù',backfillBatch:batch,eventChanges:[...updates].map(([id,after])=>({eventId:id,before:validEvents.find(e=>e.id===id),after})),allocationImpacts,reportChanges:writes.filter(w=>w.entity==='production_report'&&w.key!==report?.id).map(w=>({reportId:w.key,before:activeReports.find(r=>r.id===w.key),after:w.value}))};writes.push({entity:'production_event',key:audit.id,value:audit});
 const cursor=records.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),raw=cursor?.payload||JSON.stringify({version:0,token:''}),nextCursor=JSON.stringify({version:Number(JSON.parse(raw).version||0)+1,token:batch});
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(raw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const batchWrites=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+snapshot.sql).bind(nextCursor,actor.login,now,raw,...snapshot.args)];
 for(const w of writes)batchWrites.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard+' ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(w.entity,w.key,JSON.stringify(w.value),actor.login,now,nextCursor));
 const results=await db.batch(batchWrites);if(results[0].meta.changes!==1)fail('Dữ liệu vừa thay đổi; chưa lưu. Kiểm tra lại khoảng bù.',409);
 return {...result,event:start};
 };
 return input.mode==='inspect'?run([],null):withCorrectionSnapshot(db,scope,run);
}
