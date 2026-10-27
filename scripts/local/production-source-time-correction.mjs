import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {readProductionWorkflow,recalculateProductionReport} from './production-workflow.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {correctionOperation} from '../../lib/production-correction-display.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
const names={'Nhập trạm':'start','Tạm ngưng':'pause','Tiếp tục':'resume','Xuất trạm':'complete'};
const day=t=>new Date(Date.parse(t)+7*3600000).toISOString().slice(0,10);
const round=n=>Math.round(n*10000)/10000;
function timeline(events){
 const list=events.filter(e=>names[correctionOperation(e)]).map(e=>({...e,workKind:names[correctionOperation(e)]}));
 // Keep event identity/order; changing times may not reorder production actions.
 let previous=-Infinity,running=false,started=false;
 for(const e of list){const time=Date.parse(e.effectiveAt);if(!Number.isFinite(time)||time<previous)fail('Thời gian điều chỉnh đảo thứ tự sự kiện. Kiểm tra Nhập trạm, Tạm ngưng, Tiếp tục và Xuất trạm.');previous=time;
 if(e.workKind==='start'){if(started&&running)fail('Nhập trạm bị trùng khi lệnh đang làm.');started=true;running=true;}
 if(!started)fail('Thiếu Nhập trạm gốc để tính lại giờ công.');
 if(e.workKind==='pause'){if(!running)fail('Tạm ngưng cần sau Nhập trạm hoặc Tiếp tục.');running=false;}
 if(e.workKind==='resume'){if(running)fail('Tiếp tục cần sau Tạm ngưng.');running=true;}
 // A partial exit does not close the whole order.
 }
 return list;
}
export async function correctSourceTimes(db,body,actor,catalog=[]){
 if(!productionMenuRights(actor).correct)fail("Không có quyền Điều chỉnh báo công.",403);
 const grants=(actor?.grants||[]).map(g=>String(g).toLocaleLowerCase('vi'));
 if(!actor?.login||!(actor.isAdmin||grants.some(g=>g.includes('quản lý sản xuất')&&(g.endsWith('/ xác nhận')||g.endsWith('/ sửa')&&!actor.line))))fail('Chỉ QLSX có quyền điều chỉnh báo công.',403);
 if(!['preview','apply'].includes(body.action))fail('Thao tác không hợp lệ.');
 const reason=String(body.reason||'').trim();if(!reason||reason.length>1000)fail('Nhập lý do điều chỉnh (tối đa 1000 ký tự).');
 const ops=body.operations;if(!Array.isArray(ops)||!ops.length||ops.length>200||new Set(ops.map(o=>o.eventId)).size!==ops.length)fail('Chọn các thời điểm khác nhau cần sửa.');
 const records=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_event','production_report','production_history_import','production_cursor','in_transit','capacity','production_schedule') ORDER BY entity,record_key").all()).results;
 const revision=await recordRevision(JSON.stringify(records));if(body.action==='apply'&&body.expectedRevision!==revision)fail(conflictMessage,409);
 const state=await readProductionWorkflow(db,actor,catalog),order=state.orders.find(o=>o.id===body.orderId);
 if(!order||actor.line&&actor.line!==order.line)fail('Không có quyền điều chỉnh lệnh của Line này.',403);
 const original=state.events.filter(e=>e.sourceId===order.id&&e.sourceTimeLog&&!e.voided).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.id).localeCompare(String(b.id)));
 const before=timeline(original),updated=structuredClone(original),now=new Date().toISOString(),actorId=productionActorId(actor),eventChanges=[];
 for(const op of ops){const old=original.find(e=>e.id===op.eventId);if(!old||!names[correctionOperation(old)]||op.operation!=='adjust')fail('Chỉ điều chỉnh thời gian sự kiện nguồn thuộc lệnh đã chọn.');if(Number(op.version)!==Number(old.version||0))fail(conflictMessage,409);
 const time=Date.parse(op.changes?.effectiveAt);if(!Number.isFinite(time)||time>Date.now()+600000||!/(Z|[+-]\d\d:\d\d)$/.test(String(op.changes?.effectiveAt)))fail('Thời gian cần hợp lệ, có múi giờ và không ở tương lai.');
 const next={...old,effectiveAt:new Date(time).toISOString(),version:Number(old.version||0)+1,correctedAt:now,correctedBy:actorId,correctionReason:reason,reason,sourceTimeCorrected:true,actor:actor.login,actorId,recordedAt:now};
 updated[updated.findIndex(e=>e.id===old.id)]=next;eventChanges.push({eventId:old.id,before:old,after:next});}
 const after=timeline(updated),allReports=state.reports.filter(r=>r.transitId===order.id&&r.kind==='completion'&&!r.cancelled&&!r.voided).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt));
 const reportImpacts=[],writes=[];let previousOld=before.find(e=>e.workKind==='start')?.effectiveAt,previousNew=after.find(e=>e.workKind==='start')?.effectiveAt;
 const calc=async(list,report,from,to)=>{if(!from||Date.parse(to)<=Date.parse(from))fail('Xuất trạm phải sau thời điểm bắt đầu của lần báo công.');
 const count=Number(report.sourceCount??report.count);if(!(count>0))fail('Báo công thiếu số người nguồn; bổ sung số người trước khi tính lại giờ.');
 const synthetic=list.filter(e=>['start','pause','resume'].includes(e.workKind)).map(e=>({...e,kind:e.workKind,sourceId:order.id,count,employees:undefined,historicalImport:false}));
 const result=await recalculateProductionReport(db,synthetic,{...report,transitId:order.id,startedAt:from,completedAt:to,staffingIncomplete:false});
 const schedule=result.sourceSnapshot?.schedule||{};for(let d=Date.parse(day(from)+'T00:00:00+07:00');d<Date.parse(to);d+=86400000){if(!schedule[day(new Date(d).toISOString())])fail('Thiếu lịch làm việc đã duyệt trong khoảng điều chỉnh. Cập nhật Lịch SX thực tế rồi thử lại.');}
 if(!result.hours)fail('Chưa đủ dữ liệu để tính lại giờ công.');return result.hours;};
 for(const report of allReports){
  const exits=before.filter(e=>e.workKind==='complete'&&(e.reportId===report.id||Date.parse(e.effectiveAt)===Date.parse(report.completedAt)));
  if(exits.length!==1)fail('Không xác định duy nhất lần Xuất trạm của báo công; cần đối chiếu nhật ký nguồn.');
  const exit=exits[0],newExit=after.find(e=>e.id===exit.id),oldFrom=previousOld,newFrom=previousNew;
  previousOld=exit.effectiveAt;previousNew=newExit.effectiveAt;
  const affected=oldFrom!==newFrom||exit.effectiveAt!==newExit.effectiveAt||eventChanges.some(c=>Math.min(Date.parse(c.before.effectiveAt),Date.parse(c.after.effectiveAt))<Math.max(Date.parse(exit.effectiveAt),Date.parse(newExit.effectiveAt))&&Math.max(Date.parse(c.before.effectiveAt),Date.parse(c.after.effectiveAt))>=Math.min(Date.parse(oldFrom),Date.parse(newFrom)));
  if(!affected)continue;
  if(report.hours?.total==null||!Number.isFinite(Number(report.hours.total)))fail('Báo công thiếu tổng giờ nguồn. Cần đối chiếu giờ nguồn trước khi điều chỉnh thời gian.');
  const [oldHours,newHours]=await Promise.all([calc(before,report,oldFrom,exit.effectiveAt),calc(after,report,newFrom,newExit.effectiveAt)]);
  const delta=round(newHours.total-oldHours.total),total=round(Number(report.hours.total)+delta);if(total<0)fail('Giờ sau điều chỉnh nhỏ hơn khoản khấu trừ nguồn. Kiểm tra thời gian và dữ liệu nghỉ/phụ kho.');
  const knownSplit=report.hours.hc!=null&&report.hours.ot!=null;
  const hc=knownSplit?round(Number(report.hours.hc)+newHours.hc-oldHours.hc):null,ot=knownSplit?round(Number(report.hours.ot)+newHours.ot-oldHours.ot):null;
  if(knownSplit&&(hc<0||ot<0))fail('Giờ HC/TC sau điều chỉnh không hợp lệ; cần kiểm tra khấu trừ nguồn.');
  const hours={...report.hours,total,hc,ot,perEmployee:[],timeCorrected:true};
  const next={...report,hours,startedAt:newFrom,actualStartedAt:after.find(e=>e.workKind==='start')?.effectiveAt,completedAt:newExit.effectiveAt,productionDate:day(newExit.effectiveAt),correctedAt:now,correctedBy:actorId,correctionReason:reason,sourceTimeCorrected:true,version:Number(report.version||0)+1,unallocatedHours:total,laborDeviation:report.standardLaborHours>0?total/report.standardLaborHours-1:null,hourStatus:'Đã điều chỉnh thời gian',laborNotes:[...(report.laborNotes||[]),{text:'Tính chênh lệch giờ theo lịch làm việc và số người nguồn; giữ các khoản trừ nghỉ/phụ kho đã đối chiếu từ Sheet.'}]};
  writes.push({entity:'production_report',key:report.id,value:next});reportImpacts.push({reportId:report.id,lsxCode:order.lsxCode,before:{startedAt:oldFrom,completedAt:exit.effectiveAt,hours:report.hours},after:{startedAt:newFrom,completedAt:newExit.effectiveAt,hours}});
 }
 const totals=list=>({hours:list.reduce((s,r)=>s+Number(r.hours?.total||0),0)});
 const newReports=allReports.map(r=>writes.find(w=>w.key===r.id)?.value||r);
 const orderImpacts=[{id:order.id,lsxCode:order.lsxCode,totalsBefore:totals(allReports),totalsAfter:totals(newReports)}];
 if(body.action==='preview')return {ok:true,expectedRevision:revision,eventChanges,reportImpacts,orderImpacts};
 for(const c of eventChanges)writes.push({entity:'production_event',key:c.eventId,value:c.after});
 const transit=records.find(r=>r.entity==='in_transit'&&r.record_key===order.id);
 if(transit){const value=JSON.parse(transit.payload);writes.push({entity:'in_transit',key:order.id,value:{...value,actualStartedAt:after.find(e=>e.workKind==='start')?.effectiveAt||value.actualStartedAt,...(value.actualCompletedAt?{actualCompletedAt:newReports.map(r=>r.completedAt).sort().at(-1)}:{}),updatedAt:now,updatedBy:actorId}});}
 const id=crypto.randomUUID(),audit={id,kind:'report-correction',sourceId:order.id,line:order.line,effectiveAt:eventChanges[0].before.effectiveAt,recordedAt:now,actor:actor.login,actorId,reason,eventChanges,reportChanges:reportImpacts,orderChanges:orderImpacts,before:eventChanges[0].before,after:eventChanges[0].after};writes.push({entity:'production_event',key:id,value:audit});
 const cursor=records.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),cursorRaw=cursor?.payload||JSON.stringify({version:0,token:''}),nextCursor=JSON.stringify({version:Number(JSON.parse(cursorRaw).version||0)+1,token:id});
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(cursorRaw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const sourceGuards="NOT EXISTS(SELECT 1 FROM json_each(?) g WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(g.value,'$.entity') AND a.record_key=json_extract(g.value,'$.record_key') AND a.payload=json_extract(g.value,'$.payload')))";
 const batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+sourceGuards).bind(nextCursor,actor.login,now,cursorRaw,JSON.stringify(records))];
 for(const w of writes)batch.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard+' ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(w.entity,w.key,JSON.stringify(w.value),actor.login,now,nextCursor));
 const result=await db.batch(batch);if(result[0].meta.changes!==1)fail(conflictMessage,409);return {ok:true,event:audit,reportImpacts,orderImpacts};
}
