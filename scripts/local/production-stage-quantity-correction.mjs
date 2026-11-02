import {readProductionWorkflow,recalculateProductionReport} from './production-workflow.mjs';
import {withCorrectionSnapshot} from './production-correction-snapshot.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {importedStageEvents} from '../../lib/production-stage-history.mjs';
import {correctionStage} from '../../lib/production-correction-orders.mjs';
import {correctionEmployeeChoices} from '../../lib/production-correction-eligibility.mjs';
import {validateCorrectionPeople} from '../../lib/production-correction-staffing.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
const fail=(m,s=422)=>{throw Object.assign(Error(m),{status:s});};
const day=t=>new Date(Date.parse(t)+25200000).toISOString().slice(0,10);
const quantity=n=>{if(!Number.isSafeInteger(Number(n))||Number(n)<=0)fail('Số lượng phải là số nguyên lớn hơn 0.');return Number(n);};
export async function correctStageQuantities(db,body,actor,catalog){
 return withCorrectionSnapshot(db,"'production_event','production_report','production_history_import','production_cursor','in_transit','capacity','production_schedule','employees','warehouse_in'",async(records,snapshot)=>{
 const digests=[];for(const row of records)digests.push(await recordRevision(JSON.stringify(row)));const revision=await recordRevision(digests.join(':')); if(body.action==='apply'&&body.expectedRevision!==revision)fail(conflictMessage,409);
 const state=await readProductionWorkflow(db,actor,catalog,{includeDerivedHours:false}),order=state.orders.find(o=>o.id===body.orderId);
 if(!order||actor.line&&actor.line!==order.line)fail('Không có quyền điều chỉnh lệnh của Line này.',403);
 const now=new Date().toISOString(),by=productionActorId(actor),reason=body.reason||'Điều chỉnh báo công',original=state.events.filter(e=>!e.voided&&!e.importedStageProjection),originalReports=state.reports.filter(r=>!r.cancelled&&!r.voided),events=original.map(e=>e.sourceId===order.id&&e.stageReporting?structuredClone(e):e),touched=new Set(),ops=body.operations;
 const cancelled=[];
 for(const op of ops){
  if(!['insert','adjust','cancel'].includes(op.operation))fail('Thao tác điều chỉnh không hợp lệ.');
  let e;if(op.operation==='insert'){
   if(events.some(e=>e.id===op.eventId))fail(conflictMessage,409);
   if(!/^new:[a-zA-Z0-9-]+$/.test(op.eventId)||!['start','complete'].includes(op.stageAction))fail('Dòng bổ sung không hợp lệ.');
   const stage=String(op.stageName||'');if(!(order.processes||[]).some(s=>correctionStage({stage:s})===correctionStage({stage})))fail('Công đoạn bổ sung không thuộc lệnh.');
   e={id:op.eventId,kind:'stage-work',stageReporting:true,stageAction:op.stageAction,sourceId:order.id,line:order.line,stageName:stage,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,recordedAt:now,actor:actor.login,actorId:by};events.push(e);
  }else{
   e=events.find(e=>e.id===op.eventId);if(!e||e.sourceId!==order.id||!e.stageReporting||e.backfillBatch)fail('Chỉ thêm/sửa số lượng trên nhật ký công đoạn của web; dữ liệu nhập lịch sử cần đối chiếu riêng.');
   if(Number(e.version||0)!==Number(op.version||0))fail(conflictMessage,409);
  }
  if(op.operation==='cancel'){
   if(!['start','extra','pause','resume','add'].includes(e.stageAction))fail('Hủy Xuất trạm cần thực hiện riêng để kiểm tra phiếu kho; không gộp với sửa dòng.');
   Object.assign(e,{voided:true,cancelledAt:now,cancelledBy:by,cancelReason:reason,version:Number(e.version||0)+1});cancelled.push({eventId:e.id,operation:'cancel',before:original.find(x=>x.id===e.id),after:e});touched.add(correctionStage(e));continue;
  }
  const c=op.changes||{},instant=Date.parse(c.effectiveAt);if(!Number.isFinite(instant)||instant>Date.now()+600000||!/(Z|[+-]\d\d:\d\d)$/.test(String(c.effectiveAt)))fail('Nhập ngày giờ hợp lệ, không ở tương lai.');e.effectiveAt=new Date(instant).toISOString();
  if(c.quantity!==undefined){if(!['start','extra','complete'].includes(e.stageAction))fail('Chỉ Nhập trạm và Xuất trạm được nhập số lượng.');e.correctionQuantity=quantity(c.quantity);}
  if(c.count!==undefined){if(!['start','extra','resume','add','complete'].includes(e.stageAction))fail('Sửa nhân lực tại Nhập trạm, Tiếp tục hoặc Bổ sung người.');const allowed=correctionEmployeeChoices({employees:state.employees,events:state.events,references:state.approvedSchedules,line:order.line,effectiveAt:e.effectiveAt});validateCorrectionPeople(c.count,c.employees,new Set(allowed.map(p=>p.id)));e.correctionPeople=c.employees;if(e.stageAction==='complete')e.reportEmployees=[...c.employees];}
  if(op.operation==='insert'&&(c.quantity===undefined||op.stageAction==='start'&&!c.employees?.length))fail('Dòng mới cần số lượng; Nhập trạm cần chọn nhân viên.');touched.add(correctionStage(e));
 }
 for(const sourceId of new Set(ops.map(o=>o.splitFrom).filter(Boolean))){
 const old=original.find(e=>e.id===sourceId&&e.sourceId===order.id&&e.stageReporting);if(!old||!['start','extra','complete'].includes(old.stageAction))fail('Lần gốc cần tách không hợp lệ.');
 const group=ops.filter(o=>o.splitFrom===sourceId);if(group.length<2||!group.some(o=>o.eventId===sourceId)||group.some(o=>o.stageAction!==old.stageAction||correctionStage({stage:o.stageName})!==correctionStage(old)))fail('Các dòng tách phải cùng lần nhập/xuất gốc.');
 const total=old.stageAction==='complete'?Number(old.stageQuantity??originalReports.find(r=>r.id===old.reportId)?.stageQuantity):Number(old.entryQuantity??(Number(old.stageAfter?.admittedQuantity||order.lsxQty)-Number(old.stageBefore?.completed||0)));
 if(group.reduce((n,o)=>n+quantity(o.changes?.quantity),0)!==total)fail(`Tổng các dòng tách phải bằng số lượng gốc ${total}.`);
 }
 const reportImpacts=[],eventChanges=[...cancelled],writes=[],warehouseChanges=[],revised=[...originalReports];
 for(const stage of touched){
  const oldEvents=original.filter(e=>e.sourceId===order.id&&correctionStage(e)===stage&&e.stageReporting),sequence=events.filter(e=>!e.voided&&e.sourceId===order.id&&correctionStage(e)===stage&&e.stageReporting).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||'')));
  if(original.some(e=>e.sourceId===order.id&&correctionStage(e)===stage&&e.backfillBatch))fail('Công đoạn có lô nhập bù liên kết; chưa thể thêm dòng riêng lẻ.');
  const mixed=original.some(e=>e.sourceId===order.id&&correctionStage(e)===stage&&e.erpStageImport);
  let current={orderId:order.id,stage:sequence[0]?.stageName,people:[],completed:0,admittedQuantity:0,status:'waiting'},lastExit=null,firstStart=null;
  if(!['start','extra'].includes(sequence[0]?.stageAction)){
   const first=sequence[0],oldFirst=oldEvents.slice().sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt))[0];
   const historical=importedStageEvents([order],originalReports,original).filter(e=>correctionStage(e)===stage&&Date.parse(e.effectiveAt)<=Date.parse(first.effectiveAt)).at(-1)?.stageAfter;
   const prior=oldFirst?.stageBefore;const baseline=oldFirst?.stageAction==='cutover'&&oldFirst.cutover&&['running','paused'].includes(oldFirst.stageAfter?.status)?oldFirst.stageAfter:null;const seed=structuredClone(baseline||prior&&['running','paused'].includes(prior.status)&&prior||historical||{});seed.startedAt??=historical?.startedAt;if(baseline){seed.at=first.effectiveAt;if(seed.startedAt===oldFirst.effectiveAt)seed.startedAt=first.effectiveAt;}
   if(!seed.startedAt||!['running','paused'].includes(seed.status)||Date.parse(first.effectiveAt)<Date.parse(seed.at||seed.startedAt))fail(`Thiếu mốc tiếp nối ERP hợp lệ (${stage}: ${seed.status||'chưa có trạng thái'}, bắt đầu ${seed.startedAt||'chưa có'}, mốc ${seed.at||'chưa có'}, thao tác ${first.stageAction} ${first.effectiveAt}); chưa thay đổi dữ liệu.`);
   current={...current,...seed,admittedQuantity:seed.admittedQuantity??Number(order.lsxQty)};firstStart=seed.startedAt;
   lastExit=originalReports.filter(r=>r.erpStageImport&&r.transitId===order.id&&correctionStage(r)===stage&&Number(r.stageQuantity||0)>0&&Date.parse(r.completedAt)<=Date.parse(first.effectiveAt)).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt)).at(-1)?.completedAt||null;
  }
  for(const e of sequence){
   const old=oldEvents.find(x=>x.id===e.id),before=structuredClone(current),action=e.stageAction;let q;
   if(action==='cutover'&&old?.cutover&&old.stageAfter){current={...current,...structuredClone(old.stageAfter),startedAt:firstStart,completed:current.completed,admittedQuantity:current.admittedQuantity,at:e.effectiveAt};}
   else if(['start','extra'].includes(action)){
    q=e.correctionQuantity??e.entryQuantity??(old?.stageAfter?.admittedQuantity!=null?Number(old.stageAfter.admittedQuantity)-Number(old.stageBefore?.completed||0):Number(order.lsxQty)-current.admittedQuantity);q=quantity(q);
    if(current.admittedQuantity+q>Number(order.lsxQty))fail(`${stage}: tổng nhập trạm vượt số lượng lệnh.`);
    if(current.status==='running'||current.status==='paused')fail(`${stage}: còn phần nhập chưa xuất hết. Sửa số lượng lần nhập trước hoặc xuất hết trước khi nhập lần mới.`);
    const people=e.correctionPeople||old?.stageAfter?.people||[];validateCorrectionPeople(people.length,people,new Set(state.employees.map(p=>p.id)));
    firstStart??=e.effectiveAt;current={...current,status:'running',people,admittedQuantity:current.admittedQuantity+q,startedAt:firstStart,at:e.effectiveAt};e.entryQuantity=q;
   }else if(action==='complete'){
    q=quantity(e.correctionQuantity??e.stageQuantity??originalReports.find(r=>r.id===e.reportId)?.stageQuantity);
    if(current.status!=='running'||!current.people.length||!firstStart)fail(`${stage}: Xuất trạm phải sau Nhập trạm/Tiếp tục có nhân viên.`);
    if(current.completed+q>current.admittedQuantity||current.completed+q>Number(order.lsxQty))fail(`${stage}: tổng xuất trạm vượt tổng nhập hợp lệ hoặc số lượng lệnh.`);
    const startedAt=lastExit||firstStart;if(Date.parse(startedAt)>=Date.parse(e.effectiveAt))fail(`${stage}: mỗi lần xuất phải sau lần nhập hoặc lần xuất trước.`);
    const completed=current.completed+q,remaining=current.admittedQuantity-completed;
    current={...current,completed,status:completed>=Number(order.lsxQty)?'done':remaining>0?'running':'partial',people:remaining>0?current.people:[],at:e.effectiveAt};
    const oldReport=originalReports.find(r=>r.id===e.reportId);if(old&&!oldReport)fail('Thiếu liên kết phiếu xuất trạm; tải lại dữ liệu.');
    const id=oldReport?.id||`CORR:${e.id}`,final=stage.toUpperCase()==='FINAL';
    const splitSource=ops.find(o=>o.eventId===e.id)?.splitFrom,sourceReport=oldReport||originalReports.find(r=>r.id===original.find(x=>x.id===splitSource)?.reportId),wasApproved=sourceReport?.reviewStatus==='Đã xác nhận';
    const next={...(oldReport||{}),id,kind:'completion',stageReporting:true,transitId:order.id,orderSnapshot:order,line:order.line,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,lsxQty:order.lsxQty,stageName:e.stageName,stageQuantity:q,reportedQuantity:final?q:0,startedAt,actualStartedAt:firstStart,completedAt:e.effectiveAt,productionDate:day(e.effectiveAt),employees:before.people,count:before.people.length,sourceCount:before.people.length,reportedBy:oldReport?.reportedBy||actor.login,reportedById:oldReport?.reportedById||by,reportedAt:oldReport?.reportedAt||now,reviewStatus:wasApproved?'Đã xác nhận':'Chờ kiểm tra',approvedQuantity:wasApproved&&final?q:0,reviewedAt:sourceReport?.reviewedAt||null,reviewedBy:sourceReport?.reviewedBy||null,reviewedById:sourceReport?.reviewedById||null,warehouseStatus:wasApproved?(final?'Chờ Kho xác nhận':'Không nhập kho tại công đoạn này'):'Chưa tạo phiếu',version:Number(oldReport?.version||0)+1,correctedAt:now,correctedBy:by,correctionReason:reason};
    if(e.reportEmployees?.length)next.correctionEmployees=[...e.reportEmployees];const historicTimeline=oldReport?.importedStageTimeline||sourceReport?.importedStageTimeline||oldEvents.map(e=>originalReports.find(r=>r.id===e.reportId)?.importedStageTimeline).find(Boolean)||[];next.importedStageTimeline=historicTimeline.filter(t=>!oldEvents.some(e=>e.id===t.id));delete next.confirmationBasis;next.hourStatus=wasApproved?'Đã xác nhận giờ':'Chờ kiểm tra';if(wasApproved)next.correctionApprovalSource=sourceReport.id;next.completedQty=0;next.actualCompletedAt='';reportImpacts.push({reportId:id,stageName:e.stageName,before:oldReport||null,after:next});const i=revised.findIndex(r=>r.id===id);if(i<0)revised.push(next);else revised[i]=next;
    e.reportId=id;e.stageQuantity=q;e.quantity=final?q:0;lastExit=e.effectiveAt;
   }else if(action==='pause'||action==='incident'){if(current.status!=='running'&&!(old?.stageBefore?.status==='paused'&&current.status==='paused'))fail(`${stage}: không thể tạm ngưng khi chưa làm.`);current={...current,status:'paused',at:e.effectiveAt};}
   else if(action==='resume'){if(current.status!=='paused'&&!(old?.stageBefore?.status==='running'&&current.status==='running'))fail(`${stage}: Tiếp tục phải sau tạm ngưng.`);current={...current,status:'running',people:e.correctionPeople||old?.stageAfter?.people||current.people,at:e.effectiveAt};}
   else if(['add','transfer'].includes(action)&&current.status==='done'){current={...current,people:[],at:e.effectiveAt};}
   else if(['add','transfer'].includes(action)){current={...current,people:e.correctionPeople||old?.stageAfter?.people||[],at:e.effectiveAt};if(!current.people.length)current.status='paused';}
   else fail(`${stage}: thao tác ${action} chưa hỗ trợ thêm/sửa số lượng.`);
   if(order.line==='B'&&stage.toUpperCase()==='PHAO'&&current.people.length>1)fail('B-PHAO tối đa 1 người tại một thời điểm.');
   e.stageBefore=before;e.stageAfter=structuredClone(current);e.employees=current.people;e.count=current.people.length;e.version=Number(old?.version||0)+1;e.correctedAt=now;e.correctedBy=by;e.correctionReason=reason;delete e.correctionQuantity;delete e.correctionPeople;
   eventChanges.push({eventId:e.id,before:old||null,after:e});
  }
 }
 // Cross-order overlap is intentionally checked only in the separate report.
 for(const impact of reportImpacts){const next=impact.after;Object.assign(next,await recalculateProductionReport(db,events,next,state.employees.map(p=>({key:p.id,payload:p}))));if(!Number.isFinite(next.hours?.total)||next.hours.total<0)fail('Không tính được giờ công.');const ids=(next.hours.perEmployee||[]).filter(p=>p.total>0).map(p=>p.id);if(ids.length){next.employees=ids;next.count=next.sourceCount=ids.length;}next.employeeDetails=next.employees.map(id=>({id,name:state.employees.find(p=>p.id===id)?.name||id}));
 next.standardLaborHours=Number(next.standardUnit)>0?Number(next.standardUnit)*next.stageQuantity:null;next.laborDeviation=next.standardLaborHours>0?next.hours.total/next.standardLaborHours-1:null;
 const linked=records.filter(r=>r.entity==='warehouse_in').filter(r=>{const w=JSON.parse(r.payload);return !w.cancelled&&!w.voided&&!w._deleted&&(w.reportId===next.id||r.record_key===`SX:${next.id}`);});
 if(linked.length>1)fail('Có nhiều phiếu kho đang hoạt động cho cùng báo công. Cần đối chiếu liên kết trước.');
 const wh=linked[0],w=wh?JSON.parse(wh.payload):null;
 if(w&&(!['Chờ xác nhận','Đã hủy'].includes(w.status)||[w.confirmation_status,w.confirmationStatus].some(x=>x&&x!=='Chờ xác nhận')||w.sheetConfirmationHash||w.confirmedAt||Number(w.receivedQuantity)>0))fail('Phiếu kho đã xác nhận hoặc đã nhận hàng. Chưa lưu điều chỉnh.');
 if(next.reviewStatus==='Đã xác nhận'){
  next.confirmationBasis={at:now,by:actor.login,hours:next.hours,laborNotes:next.laborNotes||[],correction:true,previousReportId:next.correctionApprovalSource};
  if(next.reportedQuantity>0||w){
   const key=wh?.record_key||`SX:${next.id}`,quantityChanged=w&&Number(w.proposedQuantity)!==Number(next.approvedQuantity),value={...(w||{}),id:key,source:'Sản xuất',reportId:next.id,planId:next.planId,lsxCode:next.lsxCode,sku:next.sku,name:next.name,spec:next.spec,line:next.line,proposedQuantity:next.approvedQuantity,receivedQuantity:null,status:'Chờ xác nhận',sourceCompletedAt:next.completedAt,createdAt:w?.createdAt||now,createdBy:w?.createdBy||actor.login,updatedAt:now,updatedBy:actor.login,correctionReason:reason,sheetSync:{...(w?.sheetSync||{}),status:'pending',queuedAt:now,queuedBy:actor.login,error:'',...(quantityChanged?{correctionRevision:crypto.randomUUID()}: {})}};
   writes.push({entity:'warehouse_in',key,value});warehouseChanges.push({id:key,before:w,after:value});
  }
 }else if(w){
  // A warehouse link must only exist for an approved report; do not leave a stale receipt usable.
  fail('Phiếu kho liên kết với báo công chưa xác nhận. Cần đối chiếu trạng thái trước.');
 }
 writes.push({entity:'production_report',key:next.id,value:next});}
 // Final may not introduce a larger upstream deficit than the recorded baseline.
 const outputs=(rs,stage,at)=>rs.filter(r=>r.transitId===order.id&&correctionStage(r)===stage&&Date.parse(r.completedAt)<=at).reduce((n,r)=>n+Number(r.stageQuantity??r.reportedQuantity??0),0);
 for(const r of revised.filter(r=>r.transitId===order.id&&correctionStage(r)==='FINAL'))for(const s of (order.processes||[]).map(s=>correctionStage({stage:s})).filter(s=>s!=='FINAL')){const at=Date.parse(r.completedAt);if(outputs(revised,'FINAL',at)-outputs(revised,s,at)>Math.max(0,outputs(originalReports,'FINAL',at)-outputs(originalReports,s,at)))fail(`FINAL vượt số lượng đã xuất của ${s} tại thời điểm đã chọn.`);}
 const approvedFinal=revised.filter(r=>r.transitId===order.id&&r.reviewStatus==='Đã xác nhận'&&Number(r.approvedQuantity)>0),confirmedTotal=approvedFinal.reduce((n,r)=>n+Number(r.approvedQuantity),0),finished=confirmedTotal>=Number(order.lsxQty),finishedAt=finished?approvedFinal.map(r=>r.completedAt).sort().at(-1)||'':'';
 for(const impact of reportImpacts)Object.assign(impact.after,{completedQty:confirmedTotal,actualCompletedAt:finishedAt,productionState:finished?'Hoàn thành sản xuất':'Đang sản xuất'});
 const sum=rs=>({quantity:rs.filter(r=>r.transitId===order.id).reduce((n,r)=>n+Number(r.reportedQuantity||0),0),hours:rs.filter(r=>r.transitId===order.id).reduce((n,r)=>n+Number(r.hours?.total||0),0)}),orderImpacts=[{id:order.id,totalsBefore:sum(originalReports),totalsAfter:sum(revised)}];
 if(body.action==='preview')return {ok:true,expectedRevision:revision,eventChanges,reportImpacts,orderImpacts,warnings:[],requiresReconfirmation:reportImpacts.some(r=>r.after.reviewStatus!=='Đã xác nhận'),warehouseChanges};
 writes.push(...eventChanges.map(c=>({entity:'production_event',key:c.eventId,value:c.after})));
 const transit=records.find(r=>r.entity==='in_transit'&&r.record_key===order.id);if(transit){const o=JSON.parse(transit.payload),completedQty=revised.filter(r=>r.transitId===order.id&&r.reviewStatus==='Đã xác nhận').reduce((n,r)=>n+Number(r.approvedQuantity??r.reportedQuantity??0),0);writes.push({entity:'in_transit',key:order.id,value:{...o,completedQty,actualCompletedAt:completedQty>=Number(o.lsxQty)?revised.filter(r=>r.transitId===order.id&&r.reviewStatus==='Đã xác nhận'&&Number(r.approvedQuantity)>0).map(r=>r.completedAt).sort().at(-1)||'':'',productionState:completedQty>=Number(o.lsxQty)?'Hoàn thành sản xuất':'Đang sản xuất',updatedAt:now,updatedBy:by}});}
 const id=crypto.randomUUID(),audit={id,kind:'report-correction',sourceId:order.id,line:order.line,effectiveAt:now,recordedAt:now,actor:actor.login,actorId:by,reason,eventChanges,reportChanges:reportImpacts,warehouseChanges,orderChanges:orderImpacts};writes.push({entity:'production_event',key:id,value:audit});
 const cursor=records.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),raw=cursor?.payload||JSON.stringify({version:0,token:''}),nextCursor=JSON.stringify({version:Number(JSON.parse(raw).version||0)+1,token:id});
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(raw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)",batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+snapshot.sql).bind(nextCursor,actor.login,now,raw,...snapshot.args)];
 for(const w of writes){if(w.remove){batch.push(db.prepare('DELETE FROM app_records WHERE entity=? AND record_key=? AND '+guard).bind(w.entity,w.key,nextCursor));continue;}batch.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard+' ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(w.entity,w.key,JSON.stringify(w.value),actor.login,now,nextCursor));}
 const result=await db.batch(batch);if(result[0].meta.changes!==1)fail(conflictMessage,409);return {ok:true,event:audit,reportImpacts,orderImpacts};
 });
}
