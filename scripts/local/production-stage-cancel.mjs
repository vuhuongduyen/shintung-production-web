import {withCorrectionSnapshot} from './production-correction-snapshot.mjs';
import {planExitRestore} from './production-exit-restore.mjs';
import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {readProductionWorkflow,recalculateProductionReport} from './production-workflow.mjs';
import {projectLiveStages} from '../../lib/production-stage-live.mjs';
import {correctionOperation} from '../../lib/production-correction-display.mjs';
import {productionDisplayTime} from '../../lib/production-display-time.mjs';
import {correctionStage} from '../../lib/production-correction-orders.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
const fail=(m,status=422)=>{throw Object.assign(Error(m),{status});};
const scope="'production_event','production_report','production_cursor','in_transit','warehouse_in','capacity','employees'";
export async function cancelStageWork(db,body,actor,catalog=[]){
 if(!actor?.login||!productionMenuRights(actor).correct)fail('Không có quyền Điều chỉnh báo công.',403);
 if(!['preview','apply'].includes(body.action))fail('Chọn xem trước hoặc xác nhận hủy.');
 const reason=String(body.reason||'Hủy thao tác báo công').trim(),ids=body.eventIds;
 if(!reason||reason.length>1000||!Array.isArray(ids)||!ids.length||ids.length>200||new Set(ids).size!==ids.length)fail('Chọn thao tác và nhập lý do hủy (tối đa 1000 ký tự).');
 return withCorrectionSnapshot(db,scope,async(records,snapshot)=>{
 const revision=await recordRevision(JSON.stringify(records));if(body.action==='apply'&&body.expectedRevision!==revision)fail(conflictMessage,409);
 const state=await readProductionWorkflow(db,actor,catalog,{includeDerivedHours:false}),order=state.orders.find(o=>o.id===body.orderId);
 if(!order||actor.line&&order.line!==actor.line)fail('Không có quyền xử lý lệnh của Line khác.',403);
 const events=records.filter(r=>r.entity==='production_event').map(r=>({...JSON.parse(r.payload),id:r.record_key})),reports=records.filter(r=>r.entity==='production_report').map(r=>({...JSON.parse(r.payload),id:r.record_key}));
 const chosen=ids.map(id=>events.find(e=>e.id===id));
 if(chosen.some(e=>!e||e.voided||e.sourceId!==order.id||!e.stageReporting||!['start','pause','resume','complete','add','extra'].includes(e.stageAction)))fail('Chọn thao tác công đoạn đang áp dụng do website ghi nhận. Dữ liệu nhập ERP cần điều chỉnh tại nguồn nhập.');
 if(chosen.some(e=>e.backfillBatch))fail('Thao tác thuộc lô nhập bù có phân công liên kết. Bản thử chưa hỗ trợ hủy riêng từng mốc của lô; chưa thay đổi dữ liệu.');
 const stages=new Set(chosen.map(correctionStage));
 // Never leave a dependent snapshot after undoing its predecessor. The preview
 // identifies the suffix; the user explicitly selects every dependent action.
 const dependencies=[];
 for(const stage of stages){const first=Math.min(...chosen.filter(e=>correctionStage(e)===stage).map(e=>Date.parse(e.effectiveAt)));dependencies.push(...events.filter(e=>!e.voided&&e.sourceId===order.id&&(correctionStage(e)===stage||e.kind==='stage-incident'&&e.stages?.some(s=>correctionStage({stage:s})===stage))&&(e.stageReporting||e.sourceTimeLog||e.kind==='stage-incident')&&Date.parse(e.effectiveAt)>=first&&!ids.includes(e.id)));}
 if(dependencies.length)fail('Còn thao tác phía sau phụ thuộc. Chọn hủy cùng các dòng: '+dependencies.map(e=>`${correctionStage(e)} · ${correctionOperation(e)||e.kind} · ${productionDisplayTime(e.effectiveAt)}`).join('; '));
 const now=new Date().toISOString(),writes=[],eventChanges=[],reportImpacts=[];
 for(const e of chosen){const value={...e,voided:true,cancelledAt:now,cancelledBy:actor.login,cancelReason:reason,version:Number(e.version||0)+1};writes.push({entity:'production_event',key:e.id,value});eventChanges.push({eventId:e.id,operation:'cancel',before:e,after:value});
 if(e.stageAction==='complete'){
  const report=reports.find(r=>r.id===e.reportId);if(!report)fail('Xuất trạm thiếu báo công gốc, chưa thể hủy.');
  const warehouse=records.find(r=>r.entity==='warehouse_in'&&(r.record_key===`SX:${report.id}`||JSON.parse(r.payload).reportId===report.id));
  if(warehouse){const old=JSON.parse(warehouse.payload);if(!['Chờ xác nhận','Đã hủy'].includes(old.status)||Number(old.receivedQuantity||0)>0||old.sheetSync||old.sheetConfirmationHash)fail('Phiếu kho đã được xử lý hoặc gửi kho. Cần xử lý phiếu kho liên quan trước khi hủy Xuất trạm.');writes.push({entity:'warehouse_in',key:warehouse.record_key,value:{...old,status:'Đã hủy',cancelled:true,cancelReason:reason,cancelledAt:now,cancelledBy:actor.login}});}
  const after={...report,cancelled:true,reviewStatus:'Đã hủy',approvedQuantity:0,cancelReason:reason,cancelledAt:now,cancelledBy:actor.login,version:Number(report.version||0)+1};writes.push({entity:'production_report',key:report.id,value:after});reportImpacts.push({reportId:report.id,before:report,after});
 }}
 const restoration=planExitRestore({request:body.restore,chosen,state,events,reports,actor,now,reason});
 writes.push(...restoration.writes);eventChanges.push(...restoration.changes);
 const updatedEvents=[...state.events.map(e=>writes.find(w=>w.entity==='production_event'&&w.key===e.id)?.value||e),...writes.filter(w=>w.entity==='production_event'&&!state.events.some(e=>e.id===w.key)).map(w=>w.value)],updatedReports=state.reports.map(r=>writes.find(w=>w.entity==='production_report'&&w.key===r.id)?.value||r);
 // Recalculate only unconfirmed reports on receiving stages; output stays unchanged.
 for(const impact of restoration.impacts.filter(i=>i.orderId!==order.id))for(const old of reports.filter(r=>!r.cancelled&&!r.voided&&r.transitId===impact.orderId&&correctionStage(r)===impact.stage&&Date.parse(r.completedAt)>Date.parse(impact.from))){
  if(writes.some(w=>w.entity==='production_report'&&w.key===old.id))continue;
  const warehouse=records.filter(r=>r.entity==='warehouse_in').map(r=>JSON.parse(r.payload)).find(r=>r.reportId===old.id||r.id===`SX:${old.id}`);
  if(old.reviewStatus==='Đã xác nhận'||warehouse&&(!['Chờ xác nhận','Đã hủy'].includes(warehouse.status)||warehouse.sheetSync||warehouse.sheetConfirmationHash||Number(warehouse.receivedQuantity)>0))fail(`${impact.label}: phiếu ${old.id} đã xác nhận hoặc xử lý kho, khoảng ${productionDisplayTime(old.startedAt)} – ${productionDisplayTime(old.completedAt)}. Cần quyền xử lý phiếu đã khóa; chưa lưu thay đổi.`);
  const calculated=await recalculateProductionReport(db,updatedEvents,old,state.employees.map(p=>({key:p.id,payload:p})));
  const after={...old,...calculated,reviewStatus:'Chờ kiểm tra',version:Number(old.version||0)+1,correctedBy:actor.login,correctedAt:now};
  const people=(after.hours?.perEmployee||[]).filter(p=>p.total>0).map(p=>p.id);after.employees=people;after.count=people.length;after.employeeDetails=people.map(id=>({id,name:state.employees.find(p=>p.id===id)?.name||id}));
  writes.push({entity:'production_report',key:old.id,value:after});reportImpacts.push({reportId:old.id,before:old,after});const i=updatedReports.findIndex(r=>r.id===old.id);if(i>=0)updatedReports[i]=after;
 }
 const projected=projectLiveStages(state.orders,updatedReports,updatedEvents);
 const own=updatedReports.filter(r=>r.kind==='completion'&&r.transitId===order.id&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh'),approved=own.filter(r=>r.reviewStatus==='Đã xác nhận');
 const transit=records.find(r=>r.entity==='in_transit'&&r.record_key===order.id),current=Object.values(projected).filter(s=>s.orderId===order.id);
 const completedQty=approved.reduce((n,r)=>n+Number(r.approvedQuantity??r.reportedQuantity??0),0),actualStartedAt=current.map(s=>s.startedAt).filter(Boolean).sort().at(0)||'',actualCompletedAt=completedQty>=Number(order.lsxQty)?approved.map(r=>r.completedAt).sort().at(-1)||'':'';
 if(transit)writes.push({entity:'in_transit',key:order.id,value:{...JSON.parse(transit.payload),completedQty,actualStartedAt,actualCompletedAt,productionState:actualCompletedAt?'Hoàn thành sản xuất':current.some(s=>s.status==='running')?'Đang sản xuất':current.some(s=>s.status==='paused')?'Tạm ngưng':'Chưa sản xuất',updatedAt:now,updatedBy:actor.login}});
 for(const id of new Set(restoration.impacts.map(i=>i.orderId).filter(id=>id!==order.id))){const row=records.find(r=>r.entity==='in_transit'&&r.record_key===id),st=Object.values(projected).filter(s=>s.orderId===id);if(row)writes.push({entity:'in_transit',key:id,value:{...JSON.parse(row.payload),productionState:st.some(s=>s.status==='running')?'Đang sản xuất':st.some(s=>s.status==='paused')?'Tạm ngưng':JSON.parse(row.payload).productionState,updatedAt:now,updatedBy:actor.login}});}
 const audit={id:crypto.randomUUID(),kind:'report-cancel',sourceId:order.id,line:order.line,actor:actor.login,actorId:actor.userId||actor.login,effectiveAt:now,recordedAt:now,reason,restore:body.restore,allocationImpacts:restoration.impacts,eventChanges,reportChanges:reportImpacts,status:'Đã hủy'};
 if(body.action==='preview')return {ok:true,expectedRevision:revision,eventChanges,reportImpacts,allocationImpacts:restoration.impacts};
 writes.push({entity:'production_event',key:audit.id,value:audit},{entity:'admin_audit',key:audit.id,value:{...audit,entity:'production_event'}});
 const cursor=records.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),raw=cursor?.payload||JSON.stringify({version:0,token:''}),nextCursor=JSON.stringify({version:Number(JSON.parse(raw).version||0)+1,token:audit.id});
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(raw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+snapshot.sql).bind(nextCursor,actor.login,now,raw,...snapshot.args)];
 for(const w of writes)batch.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard+' ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(w.entity,w.key,JSON.stringify(w.value),actor.login,now,nextCursor));
 const result=await db.batch(batch);if(result[0].meta.changes!==1)fail(conflictMessage,409);return {ok:true,event:audit,reportImpacts};
 });
}
