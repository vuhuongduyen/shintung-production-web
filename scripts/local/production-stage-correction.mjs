import {correctStageQuantities} from './production-stage-quantity-correction.mjs';
import {productionDisplayTime} from '../../lib/production-display-time.mjs';
import {withCorrectionSnapshot} from './production-correction-snapshot.mjs';
import {correctionEmployeeChoices} from '../../lib/production-correction-eligibility.mjs';
import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {readProductionWorkflow,recalculateProductionReport} from './production-workflow.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {correctionStage} from '../../lib/production-correction-orders.mjs';
import {correctionStaffing,validateCorrectionPeople} from '../../lib/production-correction-staffing.mjs';
import {calculateErpStage,erpScheduleDay,erpFallbackDay} from '../../lib/production-erp-stage.mjs';
import {effectiveAttendance} from '../../lib/production-attendance.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
const day=t=>new Date(Date.parse(t)+25200000).toISOString().slice(0,10);
export async function correctStageWork(db,body,actor,catalog=[]){
 if(!productionMenuRights(actor).correct)fail('Không có quyền Điều chỉnh báo công.',403);
 const grants=(actor?.grants||[]).map(g=>String(g).toLocaleLowerCase('vi'));
 if(!actor?.login||!(actor.isAdmin||grants.some(g=>g.includes('quản lý sản xuất')&&(g.endsWith('/ xác nhận')||g.endsWith('/ sửa')&&!actor.line))))fail('Chỉ QLSX có quyền điều chỉnh báo công.',403);
 if(!['preview','apply'].includes(body.action))fail('Thao tác không hợp lệ.');
 const reason=String(body.reason||'Điều chỉnh báo công').trim(),ops=body.operations;
 if(!reason||reason.length>1000)fail('Nhập lý do điều chỉnh (tối đa 1000 ký tự).');
 if(!Array.isArray(ops)||!ops.length||ops.length>200||new Set(ops.map(o=>o.eventId)).size!==ops.length)fail('Chọn các dòng khác nhau cần điều chỉnh.');
 if(ops.some(o=>o.stageAction==='cutover'||o.operation==='insert'||o.operation==='cancel'||o.changes?.quantity!==undefined||o.stageAction==='complete'&&o.changes?.count!==undefined))return correctStageQuantities(db,body,actor,catalog);
 return withCorrectionSnapshot(db,"'production_event','production_report','production_history_import','production_cursor','in_transit','capacity','production_schedule','employees','warehouse_in'",async(records,snapshot)=>{
 const revision=await recordRevision(JSON.stringify(records));if(body.action==='apply'&&body.expectedRevision!==revision)fail(conflictMessage,409);
 const state=await readProductionWorkflow(db,actor,catalog,{includeDerivedHours:false}),order=state.orders.find(o=>o.id===body.orderId);
 if(!order||actor.line&&actor.line!==order.line)fail('Không có quyền điều chỉnh lệnh của Line này.',403);
 const original=state.events.filter(e=>!e.voided&&!e.importedStageProjection),events=original.map(e=>e.sourceId===order.id?structuredClone(e):e),reports=state.reports.filter(r=>!r.cancelled&&!r.voided),updates=new Map(),labor=new Map(),stages=new Set(),now=new Date().toISOString(),actorId=productionActorId(actor);
 const known=new Set(state.employees.filter(e=>!e._deleted&&e.active!==false).map(e=>e.id));
 const stamp=e=>({...e,version:Number(original.find(o=>o.id===e.id)?.version||0)+1,correctedAt:now,correctedBy:actorId,correctionReason:reason});
 for(const op of ops){
  const old=original.find(e=>e.id===op.eventId);
  if(old?.backfillBatch)fail('Thao tác thuộc lô nhập bù có phân công liên kết. Bản thử chưa hỗ trợ sửa riêng từng mốc của lô; chưa thay đổi dữ liệu.');
  if(!old||old.sourceId!==order.id||!(old.erpStageImport&&old.sourceTimeLog||old.stageReporting)||op.operation!=='adjust')fail('Dòng điều chỉnh không thuộc báo công công đoạn của lệnh đã chọn.');
  if(Number(op.version)!==Number(old.version||0))fail(conflictMessage,409);
  const changes=op.changes||{},time=Date.parse(changes.effectiveAt);
  if(!Number.isFinite(time)||time>Date.now()+600000||!/(Z|[+-]\d\d:\d\d)$/.test(String(changes.effectiveAt)))fail('Thời gian cần hợp lệ, có múi giờ và không ở tương lai.');
  const next=events.find(e=>e.id===old.id);next.effectiveAt=new Date(time).toISOString();stages.add(correctionStage(old));
  if(changes.count!==undefined){
   const staffing=correctionStaffing(old,reports);if(!staffing.editable)fail('Dòng này không thay đổi nhân lực. Hãy sửa tại Nhập trạm, Tiếp tục hoặc Bổ sung người.');
   const permitted=new Set([...known,...staffing.employees]);validateCorrectionPeople(changes.count,changes.employees,permitted);
   const eligible=new Set(correctionEmployeeChoices({employees:state.employees,events:state.events,references:state.approvedSchedules,line:order.line,effectiveAt:next.effectiveAt}).map(p=>p.id));
   const invalid=changes.employees.filter(id=>!eligible.has(id));if(invalid.length)fail(`Line ${order.line}, ngày ${day(next.effectiveAt).split('-').reverse().join('/')}: nhân viên không thuộc lịch/phân bổ hợp lệ: ${invalid.map(id=>state.employees.find(p=>p.id===id)?.name||id).join(', ')}. Kiểm tra lịch chuyển, phân bổ nhân sự và ngày làm việc rồi chọn lại.`);
   const previous=labor.get(staffing.key);if(previous&&JSON.stringify(previous)!==JSON.stringify(changes.employees))fail('Cùng một lần báo công có nhiều danh sách nhân viên khác nhau. Kiểm tra lại số nhân lực.');
   labor.set(staffing.key,changes.employees);
   if(old.stageReporting){next.stageAfter={...next.stageAfter,people:changes.employees};next.employees=changes.employees;next.count=changes.count;}
  }
  if(next.stageAfter){next.stageAfter.at=next.effectiveAt;if(next.stageAfter.startedAt===old.effectiveAt)next.stageAfter.startedAt=next.effectiveAt;}
  updates.set(next.id,stamp(next));
 }
 // Validate each stage independently; parallel stages may start at the same time.
 for(const stage of stages){
  const sequence=original.filter(e=>e.sourceId===order.id&&correctionStage(e)===stage&&(e.sourceTimeLog||e.stageReporting)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||'')));
  let last=-Infinity,carry=null;
  for(const old of sequence){const next=events.find(e=>e.id===old.id),time=Date.parse(next.effectiveAt);if(time<last)fail(`${stage}: thời gian đảo thứ tự thao tác. Kiểm tra Nhập trạm, Tạm ngưng, Tiếp tục và Xuất trạm.`);last=time;
   if(old.stageReporting){
    if(carry&&next.stageBefore)next.stageBefore={...next.stageBefore,people:carry};
    if(labor.has(old.id))carry=labor.get(old.id);
    else if(['start','extra','resume','add','transfer','complete'].includes(old.stageAction))carry=null;
    if(carry&&next.stageAfter&&['running','paused'].includes(next.stageAfter.status)){next.stageAfter={...next.stageAfter,people:carry};next.employees=carry;next.count=carry.length;}
    if(JSON.stringify(old)!==JSON.stringify(next))updates.set(next.id,stamp(next));
   }
  }
 }
 const eventChanges=[...updates].map(([id,after])=>({eventId:id,before:original.find(e=>e.id===id),after}));
 for(const c of eventChanges){if(!c.after.stageReporting)continue;for(const boundary of ['stageBefore','stageAfter']){const value=c.after[boundary];if(!value)continue;const changedStart=eventChanges.find(p=>p.before.sourceId===c.before.sourceId&&correctionStage(p.before)===correctionStage(c.before)&&p.before.effectiveAt===value.startedAt);if(changedStart)value.startedAt=changedStart.after.effectiveAt;}}
 const adjusted=original.map(e=>updates.get(e.id)||e),writes=[],reportImpacts=[];
 const days=new Map(state.approvedSchedules.flatMap(s=>(s.days||[]).map(d=>[`${d.date}:${s.key.split(':').at(-1)}`,d])));
 for(const old of reports.filter(r=>r.transitId===order.id&&stages.has(correctionStage(r))&&(r.erpStageImport||r.stageReporting))){
  const relevant=eventChanges.filter(c=>correctionStage(c.before)===correctionStage(old));
  const mapTime=(value,kind)=>{const found=relevant.filter(c=>Date.parse(c.before.effectiveAt)===Date.parse(value)&&(!kind||kind.includes(c.before.sourceOperation||c.before.stageAction)));const times=[...new Set(found.map(c=>c.after.effectiveAt))];if(times.length>1)fail('Mốc thời gian trùng nhiều thao tác. Điều chỉnh riêng từng lần báo công.');return times[0]||value;};
  const next={...old,startedAt:mapTime(old.startedAt,['Nhập trạm','Xuất trạm','start','extra','complete']),actualStartedAt:mapTime(old.actualStartedAt,['Nhập trạm','start','extra']),completedAt:mapTime(old.completedAt,['Xuất trạm','complete']),pauses:(old.pauses||[]).map(p=>[mapTime(p[0],['Tạm ngưng']),mapTime(p[1],['Tiếp tục'])])};
  if(labor.has(old.id)){next.employees=labor.get(old.id);next.count=next.sourceCount=next.employees.length;next.employeeDetails=next.employees.map(id=>old.employeeDetails?.find(e=>e.id===id)||{id,name:state.employees.find(e=>e.id===id)?.name||id});}
  const intersect=relevant.some(c=>Math.min(Date.parse(c.before.effectiveAt),Date.parse(c.after.effectiveAt))<=Math.max(Date.parse(old.completedAt),Date.parse(next.completedAt))&&Math.max(Date.parse(c.before.effectiveAt),Date.parse(c.after.effectiveAt))>=Math.min(Date.parse(old.startedAt),Date.parse(next.startedAt)));
  if(!labor.has(old.id)&&!intersect)continue;
  if(!(Date.parse(next.startedAt)<Date.parse(next.completedAt)))fail(`${correctionStage(old)}: Xuất trạm phải sau thời điểm bắt đầu.`);
  if(next.erpStageImport){const schedule={};for(let t=Date.parse(day(next.startedAt)+'T00:00:00+07:00');t<Date.parse(next.completedAt);t+=86400000){const date=day(new Date(t).toISOString());schedule[date]=erpScheduleDay(days.get(date+':'+order.line)||erpFallbackDay(date));}next.hours=calculateErpStage(next,schedule,effectiveAttendance(state.events.filter(e=>!e.historicalImport)));}
  else{
   next.importedStageTimeline=(next.importedStageTimeline||[]).map(e=>updates.get(e.id)||e);
   Object.assign(next,await recalculateProductionReport(db,adjusted,next,state.employees.map(e=>({key:e.id,payload:e}))));
   const last=adjusted.filter(e=>e.sourceId===order.id&&correctionStage(e)===correctionStage(old)&&e.stageAfter?.people?.length&&Date.parse(e.effectiveAt)<Date.parse(next.completedAt)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)).at(-1);
   if(last){next.employees=last.stageAfter.people;next.count=next.sourceCount=next.employees.length;next.employeeDetails=next.employees.map(id=>old.employeeDetails?.find(e=>e.id===id)||{id,name:state.employees.find(e=>e.id===id)?.name||id});}
  }
  if(!next.hours||!Number.isFinite(next.hours.total)||next.hours.total<0)fail('Không tính được giờ công sau điều chỉnh. Kiểm tra lịch làm việc của công đoạn.');
  Object.assign(next,{productionDate:day(next.completedAt),version:Number(old.version||0)+1,correctedAt:now,correctedBy:actorId,correctionReason:reason,sourceTimeCorrected:true,staffingCorrected:labor.size>0||old.staffingCorrected,unallocatedHours:Math.max(0,next.hours.total-(next.hours.perEmployee||[]).reduce((s,p)=>s+p.total,0)),laborDeviation:old.standardLaborHours>0?next.hours.total/old.standardLaborHours-1:null});
  writes.push({entity:'production_report',key:next.id,value:next});reportImpacts.push({reportId:next.id,stageName:next.stageName,before:old,after:next});
 }
 let revised=reports.map(r=>writes.find(w=>w.key===r.id)?.value||r),warnings=[];
 for(const w of writes){w.value.overlapWarnings=warnings.filter(p=>p.reportIds.includes(w.key));}
 const warehouseChanges=[];
 for(const impact of reportImpacts){const r=impact.after;
  for(const row of records.filter(x=>x.entity==='warehouse_in')){const w=JSON.parse(row.payload);if(w.reportId!==r.id||w.cancelled||w.voided||w._deleted||w.status!=='Chờ xác nhận'||w.confirmedAt||w.sheetConfirmationHash||Number(w.receivedQuantity)>0)continue;
   const value={...w,sourceCompletedAt:r.completedAt,updatedAt:now,updatedBy:actor.login,...(w.sheetSync?{sheetSync:{...w.sheetSync,status:'pending',queuedAt:now,error:''}}:{})};writes.push({entity:'warehouse_in',key:row.record_key,value});warehouseChanges.push({id:row.record_key,before:w,after:value});
  }
 }
 const allocationImpacts=[];
 const orderImpacts=[{id:order.id,totalsBefore:{hours:reports.filter(r=>r.transitId===order.id).reduce((s,r)=>s+Number(r.hours?.total||0),0)},totalsAfter:{hours:revised.filter(r=>r.transitId===order.id).reduce((s,r)=>s+Number(r.hours?.total||0),0)}}];
 if(body.action==='preview')return {ok:true,expectedRevision:revision,eventChanges,reportImpacts,orderImpacts,warnings,allocationImpacts};
 for(const c of eventChanges.filter(c=>c.before))writes.push({entity:'production_event',key:c.eventId,value:c.after});
 const transit=records.find(r=>r.entity==='in_transit'&&r.record_key===order.id);
 if(transit&&eventChanges.some(c=>c.before&&Date.parse(c.before.effectiveAt)!==Date.parse(c.after.effectiveAt))){const value=JSON.parse(transit.payload),own=revised.filter(r=>r.transitId===order.id),starts=own.map(r=>r.actualStartedAt||r.startedAt).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b)),finishes=own.filter(r=>/FINAL/i.test(r.stageName||'')).map(r=>r.completedAt).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b));writes.push({entity:'in_transit',key:order.id,value:{...value,...(starts.length?{actualStartedAt:starts[0]}:{}),...(value.actualCompletedAt&&finishes.length?{actualCompletedAt:finishes.at(-1)}:{}),updatedAt:now,updatedBy:actorId}});}
 const id=crypto.randomUUID(),audit={id,kind:'report-correction',sourceId:order.id,line:order.line,effectiveAt:now,recordedAt:now,actor:actor.login,actorId,reason,eventChanges,reportChanges:reportImpacts,warehouseChanges,orderChanges:orderImpacts,warnings};writes.push({entity:'production_event',key:id,value:audit});
 const cursor=records.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),raw=cursor?.payload||JSON.stringify({version:0,token:''}),nextCursor=JSON.stringify({version:Number(JSON.parse(raw).version||0)+1,token:id});
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(raw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+snapshot.sql).bind(nextCursor,actor.login,now,raw,...snapshot.args)];
 for(const w of writes)batch.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard+' ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(w.entity,w.key,JSON.stringify(w.value),actor.login,now,nextCursor));
 const result=await db.batch(batch);if(result[0].meta.changes!==1)fail(conflictMessage,409);
 return {ok:true,event:audit,reportImpacts,orderImpacts,warnings,allocationImpacts};
 });
}
