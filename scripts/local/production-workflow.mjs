import {calculateErpStage,erpFallbackDay,erpScheduleDay} from '../../lib/production-erp-stage.mjs';
import {employeeActiveOn} from '../../lib/employee-employment.mjs';
import {writeStageWork} from './production-stage-live.mjs';
import {stageHours} from '../../lib/production-stage-live.mjs';
const isOtherWork = value => value === 'CV khác';
const isManagerWork = value => ['Phụ kho','CV khác'].includes(value);
import {canApproveStaffRecall,recallGroup,recallGroupLabel} from '../../lib/staff-recall-approval.mjs';
import {allocationAuthority} from '../../lib/production-allocation-queue.mjs';
import {staffRecallCandidates} from '../../lib/production-staff-recall.mjs';
import {productionMenuRights,workflowActionAllowed} from '../../lib/menu-action-access.mjs';
import {productionRuntime,reportStart} from '../../lib/production-runtime.mjs';
import {buildWarehouseDuty} from './warehouse-duty.mjs';
import {personalHrEvent,projectPersonalHr} from '../../lib/hr-attendance-scope.mjs';
import {assertHrAttendancePeriod} from '../../lib/hr-attendance-period.mjs';
import {assertLegacyAllocationWrite} from './production-allocation-queue.mjs';
import {historicalWorkContinuation} from '../../lib/production-work-actions.mjs';
import {hasQuickLineReadScope} from '../../lib/user-permission-profiles.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {reconcileHistorySource} from '../../lib/production-history-source.mjs';
import {timeJournalHours} from '../../lib/production-time-journal.mjs';
import {productionActorId,productionEntryActorId} from "../../lib/production-actor.mjs";
import {eventEmployees} from '../../lib/production-event-employees.mjs';
import { getTransit } from "./in-transit.mjs";
import { assignedAt, hoursForOrder } from "../../lib/production-hours.mjs";
import { monday } from "../../lib/production-plan.mjs";
import { effectiveAttendance, activeStaffMovement, transferStaffCandidates, attendanceEdges, eligibleStaff, hasApprovedLeave, isPresent, vnMoment } from "../../lib/production-attendance.mjs";

const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
const parse = (r) => ({ key: r.record_key, payload: JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at });
const rows = async (db, entity) => (await db.prepare("SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at,record_key").bind(entity).all()).results.map(parse);
const upper = (value) => String(value || "").trim().toUpperCase();
const clock = (value) => {
  const result = Date.parse(value);
  if (!Number.isFinite(result) || !/^(\d{4}-\d\d-\d\dT)/.test(String(value)) || !/(Z|[+-]\d\d:\d\d)$/.test(String(value))) fail("Thời điểm phải có múi giờ hợp lệ.");
  return result;
};
const hasRole = (actor, action) => Boolean(actor?.isAdmin || (actor?.grants || []).some((grant) => {
  const text = String(grant).toLocaleLowerCase("vi");
  return text.includes("quản lý sản xuất") && text.endsWith("/ " + action);
}));
const canHr = actor => Boolean(actor?.isAdmin||(actor?.grants||[]).includes('Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt'));
const canManage = (actor) => hasRole(actor, "xác nhận") || hasRole(actor, "sửa") && !actor.line;
const canWork = (actor) => Boolean(actor?.login && (canManage(actor) || hasRole(actor, "thêm") || hasRole(actor, "lưu") || hasRole(actor, "sửa")));
const permitted = (actor, line) => !actor.line || upper(actor.line) === upper(line);
// Collision checks always consider all events; disclosure is scoped separately.
const attendanceConflictMessage = (actor, conflict, employees, directory) => {
  if (!permitted(actor, conflict.line) || (conflict.destinationLine && !permitted(actor, conflict.destinationLine)))
    return "Nhân viên có biến động trùng thời gian. Không thể ghi nhận.";
  const involved=(conflict.employees||[]).filter(id=>employees.some(selected=>upper(selected)===upper(id)));
  const names=involved.map(id=>`${directory.get(upper(id))?.name||id} (${id})`).join(", ");
  return `Nhân viên ${names}: trùng khoảng giờ ${conflict.effectiveAt} đến ${conflict.endsAt} (bản ghi ${conflict.id}; loại ${conflict.absenceType||conflict.kind||"biến động"}${conflict.reason?`; lý do ${conflict.reason}`:""}).`;
};
const number = (value, label, allowZero = false) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1) || result > 10000) fail(`${label} phải là số nguyên ${allowZero ? "không âm" : "lớn hơn 0"}.`);
  return result;
};
const iso = (value, actor, managerRequired = false) => {
  const time = value ? clock(value) : Date.now();
  if (time > Date.now() + 600000) fail("Không thể ghi sự kiện ở tương lai.");
  if ((managerRequired || time < Date.now() - 30 * 60000) && !canManage(actor)) fail("Chỉ QLSX được ghi lại thời điểm trong quá khứ.", 403);
  return new Date(time).toISOString();
};
const expectedOrder = (orders, id) => {
  const row = orders.find((item) => item.id === id);
  if (!row) fail("LSX không tồn tại hoặc chưa được KHSX đồng bộ.", 404);
  if (row.status === "HỦY" || !row.lsxCode || row.syncStatus !== "ĐÃ ĐỒNG BỘ") fail(`LSX ${row.lsxCode || id} không còn đủ điều kiện.`, 409);
  return row;
};
const currentState = (events,order,at)=>productionRuntime(order,events,at);
const peopleAt = (events, orderId, at) => {
  let known = false, people = [];
  for (const event of events.filter((item) => (item.sourceId === orderId || item.destinationId === orderId) && clock(item.effectiveAt) <= at)
    .sort((a, b) => clock(a.effectiveAt) - clock(b.effectiveAt) || String(a.recordedAt).localeCompare(String(b.recordedAt)))) {
    if (event.kind === "start" && event.sourceId === orderId) { people = [...(event.employees || [])]; known = people.length === event.count; }
    if (event.kind === "transfer") {
      if (event.sourceId === orderId) people = people.filter((id) => !event.employees?.includes(id));
      if (event.destinationId === orderId && !event.destinationIncludedInStart) people.push(...(event.employees || []));
    }
    if (event.kind === "add" && event.sourceId === orderId) people.push(...(event.employees || []));
    if (event.kind === "reduce" && event.sourceId === orderId) people = people.filter((id) => !event.employees?.includes(id));
    if(event.kind==="complete"&&event.finalCompletion&&event.sourceId===orderId)people=[];
  }
  return { known, people };
};
const laborNotesForReport = (events, report, directory) => {
 const from=Date.parse(report.startedAt),to=Date.parse(report.completedAt);
 const label=value=>{const {date,minute}=vnMoment(value);return `${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")} ${date.split("-").reverse().join("/")}`;};
 return effectiveAttendance(events).filter(e=>["absence","line-absence","attendance-override"].includes(e.kind)&&(!e.sourceId||e.sourceId===report.transitId)&&Date.parse(e.effectiveAt)<to&&Date.parse(e.endsAt)>from).flatMap(e=>{
   const start=Math.max(from,Date.parse(e.effectiveAt)),end=Math.min(to,Date.parse(e.endsAt));
   const points=[start,end,...events.filter(x=>x.sourceId===report.transitId||x.destinationId===report.transitId).map(x=>Date.parse(x.effectiveAt)).filter(t=>t>start&&t<end)].sort((a,b)=>a-b);
   const spans=[];
   for(let i=1;i<points.length;i++){
     const middle=(points[i-1]+points[i])/2;
     if(!assignedAt(events,report.transitId,middle).running)continue;
     const affected=(e.employees||[]).filter(id=>peopleAt(events,report.transitId,middle).people.includes(id));if(!affected.length)continue;
     const last=spans.at(-1);if(last&&last.end===points[i-1]&&JSON.stringify(last.employees)===JSON.stringify(affected))last.end=points[i];else spans.push({start:points[i-1],end:points[i],employees:affected});
   }
   return spans.map(span=>{const names=span.employees.map(id=>{const p=directory.find(r=>upper(r.key)===id)?.payload;return p?.name?`${p.name} (${id})`:id;}),type=e.absenceType||"Nghỉ";
     return {eventId:`${e.id}:${span.start}`,sourceEventId:e.id,type,employees:span.employees,actor:e.actor,recordedAt:e.recordedAt,effectiveAt:new Date(span.start).toISOString(),endsAt:new Date(span.end).toISOString(),reason:e.reason,openArrival:Boolean(e.openArrival),text:`QLSX cập nhật NV ${type.toLocaleLowerCase("vi")}: ${names.join(", ")} · ${label(span.start)} – ${e.openArrival?"Chưa đến":label(span.end)}`};
   });
 });
};
const asMinutes = (value) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) fail("Giờ cần theo định dạng 24h HH:mm.");
  const [h, m] = value.split(":").map(Number); return h * 60 + m;
};
const scheduleDay = (day) => ({
  working: Boolean(day.working), ot: Boolean(day.ot),
  hcStart: asMinutes(day.hcStart || "08:00"), hcEnd: asMinutes(day.hcEnd || "17:00"),
  lunchStart: asMinutes(day.lunchStart || "12:00"), lunchEnd: asMinutes(day.lunchEnd || "13:00"),
  breakMorningStart: asMinutes(day.breaks?.[0]?.start || "10:00"),
  breakMorningEnd: asMinutes(day.breaks?.[0]?.end || "10:10"),
  breakAfternoonStart: asMinutes(day.breaks?.[1]?.start || "15:00"),
  breakAfternoonEnd: asMinutes(day.breaks?.[1]?.end || "15:10"),
  cleaning: (day.cleaning || []).filter((item) => item.start && item.end).map((item) => ({
    start: asMinutes(item.start), end: asMinutes(item.end), people: Number(item.people || 0),
    employees: (item.employees || []).map(upper),
  })),
  otStart: asMinutes(day.otStart || "17:30"), otEnd: asMinutes(day.otEnd || "21:00"),
  preOtStart: asMinutes(day.preOtStart || "17:00"), preOtEnd: asMinutes(day.preOtEnd || "17:30"),
});
const dayRange = (week) => Array.from({ length: 7 }, (_, i) => {
  const date = new Date(week + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + i); return date.toISOString().slice(0, 10);
});
async function schedules(db, capacityRead = rows(db, "capacity")) {
  const [records, capacityRecords] = await Promise.all([rows(db, "production_schedule"), capacityRead]);
  const actual = new Map(records.filter((item) => !item.payload._deleted).map((item) => [item.key, item.payload]));
  const approved = new Map();
  for (const record of capacityRecords) {
    for (const row of record.payload.rows || []) {
      const lastApproval = (row.history || []).filter(entry => entry.action === "review" && entry.decision === "approve" && entry.request?.kind === "capacity").at(-1);
      const accepted = lastApproval?.after || (row.reviewStatus === "approved" && row.status === "Đã xác nhận" ? row.input : null);
      if (accepted?.dailySchedule?.length === 7)
        approved.set(`${record.key}:${row.line}`, { days: accepted.dailySchedule, version: lastApproval?.version || row.version,
          approvedAt: lastApproval?.at || row.khsxAcceptedAt, workers: accepted.workers || 0,
          roster: accepted.dailyRoster || [], input: { dailySchedule: accepted.dailySchedule, staffTransfers: accepted.staffTransfers || [],
            dailyHcLeave: accepted.dailyHcLeave || [], dailyOtLeave: accepted.dailyOtLeave || [], otWorkers: accepted.otWorkers } });
    }
  }
  return { actual, approved };
}
const weekOf = (date) => monday(date);
const withoutLine = (day) => { const { line, ...rest } = day || {}; return rest; };
const resolveSchedule = (schedules, week, line) => {
  const key = `${week}:${line}`, saved = schedules.actual.get(key), reference = schedules.approved.get(key);
  if (!reference || reference.days.length !== 7) return { key, approved: false, days: [], version: saved?.version || 0, history: saved?.history || [] };
  // The current KHSX approval is the baseline. Retain QLSX's actual exceptions
  // when Capacity receives a later approval; do not write on a read request.
  const oldBase = saved?.reference?.days || saved?.reference || [];
  const days = reference.days.map((day, index) => {
    const previous = saved?.days?.[index];
    return previous && (!oldBase.length || oldBase[index] && JSON.stringify(withoutLine(previous)) !== JSON.stringify(withoutLine(oldBase[index]))) ? previous : day;
  });
  return { key, approved: true, reference, days, version: saved?.version || 0, history: saved?.history || [] };
};
const toScheduleMap = (schedules, from, to, line) => {
  const map = {}; let date = new Date(new Date(from).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const end = new Date(new Date(to).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  date.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);
  while (date <= end) {
    const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const schedule = resolveSchedule(schedules, weekOf(day), line);
    const row = schedule.days.find((item) => item.date === day);
    if (row) map[day] = scheduleDay(row);
    date.setDate(date.getDate() + 1);
  }
  return map;
};
const attendancePolicy = (calendar, events, line) => ({
  perDay:true,
  present: (id, date, minute, part) => {
    const reference = calendar.approved.get(`${weekOf(date)}:${line}`);
    return !reference || isPresent({ ...reference, days: resolveSchedule(calendar, weekOf(date), line).days }, events, id, line, date, minute, part);
  },
  edges: date => [...attendanceEdges(calendar.approved.get(`${weekOf(date)}:${line}`), date),
    ...effectiveAttendance(events).filter(event=>["absence","line-absence","attendance-override","line-movement"].includes(event.kind))
      .flatMap(event=>[event.effectiveAt,event.endsAt].filter(value=>value&&vnMoment(value).date===date).map(value=>vnMoment(value).minute))],
});
const shiftAt = (day, minute) => {
  if (!day?.working) return null;
  const hcStart = asMinutes(day.hcStart || "08:00"), hcEnd = asMinutes(day.hcEnd || "17:00");
  const otStart = asMinutes(day.otStart || "17:30"), otEnd = asMinutes(day.otEnd || "21:00");
  return minute >= hcStart && minute < hcEnd ? "hc" : day.ot && minute >= otStart && minute < otEnd ? "ot" : null;
};
const eventRows = (events, actor) => events.filter((event) => permitted(actor, event.line) || event.destinationLine && permitted(actor, event.destinationLine));
function canRecalculateReport(report) {
 return report.kind==='completion'&&!report.cancelled&&!report.voided&&!report.manualHours&&report.staffingIncomplete!==true&&(!report.historicalImport||report.erpStageImport&&report.employees?.length||report.stageReporting);
}
function sameReportHours(a,b) {
 const normalize=value=>typeof value==='number'?Math.round(value*1e7)/1e7:Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])])):value;
 return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
function affectedReport(event,report,events) {
 events=[...(report.importedStageTimeline||[]),...events];
 const employees=[...new Set([...(event.employees||[]),...(event.before?.employees||[])].map(upper))];
 if(event.sourceId&&event.sourceId!==report.transitId)return false;
 const from=Math.max(Date.parse(report.startedAt),Math.min(Date.parse(event.effectiveAt),Date.parse(event.before?.effectiveAt||event.effectiveAt)));
 const to=Math.min(Date.parse(report.completedAt),Math.max(event.endsAt?Date.parse(event.endsAt):Infinity,event.before?(event.before.endsAt?Date.parse(event.before.endsAt):Infinity):0));
 if(!(from<to))return false;
 if(report.erpStageImport)return (report.employees||[]).some(id=>employees.includes(upper(id)));
 if(report.historicalImport&&!report.stageReporting){const ids=report.employees?.length?report.employees:(report.hours?.perEmployee||[]).map(p=>p.id);return ids.length?ids.some(id=>employees.includes(upper(id))):event.line===report.line;}
 if(report.stageReporting)return events.some(e=>e.stageReporting&&e.sourceId===report.transitId&&e.stageName===report.stageName&&e.stageAfter?.people?.some(id=>employees.includes(upper(id))));
 const points=[from,to,...events.filter(e=>e.sourceId===report.transitId||e.destinationId===report.transitId).map(e=>Date.parse(e.effectiveAt)).filter(t=>t>from&&t<to)].sort((a,b)=>a-b);
 return points.slice(1).some((t,i)=>peopleAt(events,report.transitId,(points[i]+t)/2).people.some(id=>employees.includes(upper(id))));
}
function reportCalculation(calendar, events, report, directory, calculateHours=true, includeSnapshot=false) {
 if(report.erpStageImport){
  const schedule=toScheduleMap(calendar,report.startedAt,report.completedAt,report.line);
  // Retain the ERP import's established fallback for dates without a web calendar.
  for(let t=Date.parse(report.startedAt);t<=Date.parse(report.completedAt);){const date=new Date(t+25200000).toISOString().slice(0,10);schedule[date]??=erpScheduleDay(erpFallbackDay(date));t=Date.parse(date+'T00:00:00+07:00')+86400000;}
  return {hours:calculateErpStage(report,schedule,effectiveAttendance(events)),laborNotes:report.laborNotes||[],pendingAttendance:[],unresolvedAttendance:[]};
 }

 if(report.stageReporting){const policy=attendancePolicy(calendar,events,report.line);policy.extraPresent=(id,date,minute,part)=>{
  return isPresent(null,events,id,report.line,date,minute,part);
 };return {hours:stageHours(events,report,toScheduleMap(calendar,report.startedAt,report.completedAt,report.line),policy,hoursForOrder),laborNotes:[],pendingAttendance:[],unresolvedAttendance:[]};}

 const schedule=toScheduleMap(calendar,report.startedAt,report.completedAt,report.line);
 const hours=calculateHours&&report.staffingIncomplete!==true?hoursForOrder(events,schedule,report.transitId,report.startedAt,report.completedAt,attendancePolicy(calendar,events,report.line)):null;
 const laborNotes=laborNotesForReport(events,report,directory);
 const unresolved=laborNotes.filter(note=>note.openArrival);
 const pending=effectiveAttendance(events,true).filter(e=>e.approved===false && ["absence","line-absence","attendance-override"].includes(e.kind) && affectedReport(e,report,events));
 return {hours,laborNotes,unresolvedAttendance:unresolved,pendingAttendance:pending.map(e=>({id:e.id,employees:e.employees,absenceType:e.absenceType,effectiveAt:e.effectiveAt,endsAt:e.endsAt})),
   ...(includeSnapshot?{sourceSnapshot:{schedule,attendance:effectiveAttendance(events).filter(e=>Date.parse(e.effectiveAt)<=Date.parse(report.completedAt)&&(["absence","line-absence","attendance-override"].includes(e.kind)?affectedReport(e,report,events):e.sourceId===report.transitId||e.destinationId===report.transitId)),capacity:[...calendar.approved.entries()].filter(([key])=>key.endsWith(`:${report.line}`)&&key.split(":")[0]>=weekOf(vnMoment(report.startedAt).date)&&key.split(":")[0]<=weekOf(vnMoment(report.completedAt).date)).map(([key,r])=>({key,version:r.version,approvedAt:r.approvedAt,roster:r.roster,input:r.input}))}}:{})};
}
function reportMetadata(calendar,events,row,directory) {
 if(row.kind!=="completion")return {};
 const {hours,sourceSnapshot,...meta}=reportCalculation(calendar,events,row,directory,false);return meta;
}
export async function readProductionWorkflow(db, actor, catalog = []) {
  if (!canWork(actor) && !canHr(actor) && !hasRole(actor, "xem")) fail("Không có quyền xem Quản lý sản xuất.", 403);
  // Menu visibility does not broaden the authenticated Line data boundary.
  const crossLineView=false,readActor=actor;
  // Share this request's capacity read; do not cache across users or requests.
  const capacityRead = rows(db, "capacity");
  const [state, eventRecords, reportRecords, directory, calendar, capacityRecords,accountRecords,laborRecords,historyRecords] = await Promise.all([
    getTransit(db, {}, catalog), rows(db, "production_event"), rows(db, "production_report"), rows(db, "employees"), schedules(db, capacityRead), capacityRead,rows(db,"users"),rows(db,"labor_hours"),rows(db,'production_history_import'),
  ]);
  const orders = state.rows.filter((row) => ((row.syncStatus === "ĐÃ ĐỒNG BỘ" && row.lsxCode) || row.status === "HỦY") && permitted(readActor, row.line));
  const employeeDirectory = directory.map(row => ({...row.payload, id: row.key,active:employeeActiveOn(row.payload)}));
  const accounts=accountRecords.map(row=>({...row.payload,id:row.key}));
  const actorIdFor=row=>productionEntryActorId(row.payload,accounts)||(row.updatedAt===row.payload.recordedAt?productionEntryActorId({actor:row.updatedBy},accounts):'');
  const journalEvents=eventRecords.map(row=>({...row.payload,actorId:actorIdFor(row)})),allEvents=journalEvents.filter(e=>!e.voided);
  const projectedHr=actor.line?projectPersonalHr(journalEvents,{line:actor.line,employees:employeeDirectory,references:[...calendar.approved.entries()].map(([key,reference])=>({...reference,key,days:resolveSchedule(calendar,...key.split(':')).days}))}):[];
  const scopedJournal=actor.line?[...journalEvents.filter(event=>!personalHrEvent(event)),...projectedHr]:journalEvents;
  const calculationEvents=actor.line?scopedJournal.filter(event=>!event.voided):allEvents;
  const events = eventRows(scopedJournal, readActor).map(event => ({...event, employeeDetails:eventEmployees(event, employeeDirectory),
    affectedOrderIds:!event.sourceId&&["line-absence","attendance-override"].includes(event.kind)?orders.filter(order=>{
      const start=Date.parse(event.effectiveAt),end=Date.parse(event.endsAt),points=[start,end,...allEvents.map(e=>Date.parse(e.effectiveAt)).filter(t=>t>start&&t<end)].sort((a,b)=>a-b);
      return points.slice(1).some((t,i)=>peopleAt(allEvents,order.id,(points[i]+t)/2).people.some(id=>event.employees?.includes(id)));
    }).map(o=>o.id):undefined}));
  for (const order of orders) {
    const moments=allEvents.filter(e=>e.sourceId===order.id||e.destinationId===order.id).map(e=>Date.parse(e.effectiveAt)).filter(Number.isFinite);
    if(!moments.length)continue;
    const map=toScheduleMap(calendar,new Date(Math.min(...moments)).toISOString(),new Date(Math.max(...moments)).toISOString(),order.line);
    const cumulative=timeJournalHours(allEvents,order.id,map,attendancePolicy(calendar,allEvents,order.line));
    for(const event of events)if(event.sourceId===order.id&&cumulative.has(event.id)){
      event.cumulativeLaborHours=cumulative.get(event.id);
      if(event.stageReporting&&event.stageAfter?.startedAt&&Date.parse(event.effectiveAt)>Date.parse(event.stageAfter.startedAt)){
        const report={stageReporting:true,transitId:order.id,line:order.line,stageName:event.stageName,startedAt:event.stageAfter.startedAt,completedAt:event.effectiveAt};
        event.cumulativeLaborHours=reportCalculation(calendar,calculationEvents,report,[]).hours.total;
      }
    }
  }
  const scheduleHistory = [...calendar.actual.values()].filter((row) => permitted(readActor, row.line)).flatMap((row) =>
    (row.history || []).map((entry, index) => ({ id: `schedule:${row.key}:${index}`, kind: "schedule", sourceId: null, line: row.line,
      week: row.week, effectiveAt: entry.at, recordedAt: entry.at, actor: entry.by, actorId:productionEntryActorId(entry,accounts), reason: entry.reason, before: entry.before, after: entry.after })));
  const capacityHistory = canManage(actor)||hasQuickLineReadScope(actor) ? capacityRecords.flatMap((record) => (record.payload.rows || []).filter((row) => permitted(readActor, row.line)).flatMap((row) =>
    (row.history || []).map((entry, index) => ({ id: `capacity:${record.key}:${row.line}:${index}`, kind: "capacity", sourceId: null,
      line: row.line, week: record.key, effectiveAt: entry.at, recordedAt: entry.at, actor: entry.actor, actorId:productionEntryActorId(entry,accounts), reason: entry.reason,
      capacityAction: entry.action, capacityDecision:entry.decision, requestDescription:entry.request?.intendedChange||entry.request?.reason, before: entry.previousHours, after: entry.newHours })))) : [];
  const orderIds = new Set(orders.map((row) => row.id));
  const overrides = new Map(events.filter((event) => !event.voided&&event.kind === "hours-adjustment").flatMap((event) => (event.changes || []).map((change) => [change.reportId, {hours:change.after,at:event.recordedAt}])));
  const historyStandards=new Map(siteLaborHours(laborRecords).map(r=>[r.key,r.payload.cancelled?null:r.payload.laborHour]));
  const reviewedHistory=new Map(reportRecords.filter(r=>r.payload.historicalImport).map(r=>[r.key,{...r.payload,id:r.key}]));
  const historical=reconcileHistorySource(historyRecords.flatMap(row=>(row.payload.reports||[]).filter(r=>permitted(readActor,r.line))).map(r=>({...r,standardUnit:historyStandards.get(r.sku)??null}))).map(r=>reviewedHistory.get(r.id)||r).filter(r=>permitted(readActor,r.line)&&(!r.orderSnapshot||permitted(readActor,r.orderSnapshot.line)));
  for(const r of historical)if(!orderIds.has(r.transitId)&&r.orderSnapshot){orders.push({...r.orderSnapshot,historicalOnly:true});orderIds.add(r.transitId);}
  for(const r of reportRecords.map(r=>({...r.payload,id:r.key})).filter(r=>r.erpStageImport&&!r.cancelled&&permitted(readActor,r.line)))if(!orderIds.has(r.transitId)&&r.orderSnapshot){orders.push({...r.orderSnapshot,historicalOnly:true});orderIds.add(r.transitId);}
  const historyEvents=historical.filter(r=>!r.sourceVerified&&!r.cancelled&&!r.voided).flatMap(r=>[...(!historical.some(p=>p.transitId===r.transitId&&p.completedAt<r.completedAt)?[{id:r.id+':start',kind:'start',effectiveAt:r.actualStartedAt||r.startedAt}]:[]),...(r.pauses||[]).flatMap((p,i)=>[{id:r.id+':pause:'+i,kind:'pause',effectiveAt:p[0]},{id:r.id+':resume:'+i,kind:'resume',effectiveAt:p[1]}]),{id:r.id+':complete',kind:'complete',effectiveAt:r.completedAt,quantity:r.reportedQuantity,reportId:r.id,cumulativeLaborHours:historical.filter(p=>p.transitId===r.transitId&&p.completedAt<=r.completedAt).reduce((s,p)=>s+Number(p.hours?.total||0),0)}].map(e=>({...e,sourceId:r.transitId,planId:r.planId,lsxCode:r.lsxCode,sku:r.sku,name:r.name,spec:r.spec,line:r.line,recordedAt:r.importedAt,actor:r.reportedBy,actorId:r.reportedById,historicalImport:true,estimatedStaffing:true,reviewStatus:r.reviewStatus,reason:'Nhập lịch sử · phân bổ ước tính. Giờ lũy kế Sheet: '+(r.sourceCumulativeHours??'—')+'. '+(r.sourceNote||'')})));
  const stageScopes=historyRecords.filter(r=>r.payload.erpStageImport&&r.payload.scope).map(r=>r.payload.scope);
 const supersededTime=e=>!e.erpStageImport&&stageScopes.some(s=>s.orderIds.includes(e.sourceId)&&Date.parse(e.effectiveAt)>=Date.parse(s.from+'T00:00:00+07:00')&&Date.parse(e.effectiveAt)<=Date.parse(s.to+'T23:59:59+07:00'));
 const sourceTimeEvents=[...new Map(historyRecords.slice().sort((a,b)=>String(a.payload.createdAt).localeCompare(String(b.payload.createdAt))).flatMap(row=>row.payload.timeEvents||[]).filter(e=>permitted(readActor,e.line)&&(!e.orderSnapshot||permitted(readActor,e.orderSnapshot.line))).map(e=>[e.id,e])).values()];
  for(const e of sourceTimeEvents)if(!orderIds.has(e.sourceId)&&e.orderSnapshot){orders.push({...e.orderSnapshot,historicalOnly:true});orderIds.add(e.sourceId);}
  const visibleReportIds=new Set([...historical,...reportRecords.map(r=>({...r.payload,id:r.key}))].filter(r=>orderIds.has(r.transitId)&&permitted(readActor,r.line)).map(r=>r.id));
  // Cross-Line movement remains visible to its receiving Line, without exposing
  // the other Line's order identity or unrelated adjustment report values.
  const projectEvent=event=>{
    if(event&&typeof event==='object')event={...event,actorId:productionEntryActorId(event,accounts)};
    if(!actor.line||!event||typeof event!=='object')return event;
    const result={...event};
    if(result.sourceId&&!orderIds.has(result.sourceId)||result.destinationId&&!orderIds.has(result.destinationId))result.reason='Chuyển Line';
    if(result.sourceId&&!orderIds.has(result.sourceId)){result.sourceId=null;for(const key of ['planId','lsxCode','sku','name','spec','orderSnapshot'])delete result[key];}
    if(result.destinationId&&!orderIds.has(result.destinationId))result.destinationId=null;
    if(Array.isArray(result.changes))result.changes=result.changes.filter(change=>visibleReportIds.has(change.reportId));
    const relevant=value=>value&&(permitted(readActor,value.line)||value.destinationLine&&permitted(readActor,value.destinationLine));
    for(const key of ['before','after'])if(result[key]?.kind)result[key]=relevant(result[key])?projectEvent(result[key]):null;
    if(result.orderSnapshot&&!permitted(readActor,result.orderSnapshot.line))delete result.orderSnapshot;
    if(Array.isArray(result.affectedOrderIds))result.affectedOrderIds=result.affectedOrderIds.filter(id=>orderIds.has(id));
    if(Array.isArray(result.orderChanges))result.orderChanges=result.orderChanges.filter(change=>orderIds.has(change.id));
    if(Array.isArray(result.reportChanges))result.reportChanges=result.reportChanges.filter(change=>visibleReportIds.has(change.reportId));
    if(Array.isArray(result.eventChanges)){
      result.eventChanges=result.eventChanges.filter(change=>relevant(change.before)||relevant(change.after)).map(change=>({...change,before:relevant(change.before)?projectEvent(change.before):null,after:relevant(change.after)?projectEvent(change.after):null}));
      result.employees=[...new Set(result.eventChanges.flatMap(change=>[...(change.before?.employees||[]),...(change.after?.employees||[])]))];
      result.employeeDetails=eventEmployees(result,employeeDirectory);
    }
    if(result.sourceSnapshot?.attendance)result.sourceSnapshot={...result.sourceSnapshot,attendance:eventRows(result.sourceSnapshot.attendance,readActor).map(projectEvent)};
    return result;
  };
  return {
    progressOrders: [...new Map([...state.rows.filter(row=>permitted(readActor,row.line)),...orders].map(row=>[row.id,row])).values()],
    orders:orders.map(order=>{const row=catalog.find(r=>upper(r.key||r.code||r.payload?.code)===upper(order.sku));const master=row?.payload||row;return {...order,processes:Array.isArray(master?.processes)?master.processes:[]};}), events: [...events, ...historyEvents, ...sourceTimeEvents.filter(e=>!supersededTime(e)&&!events.some(saved=>saved.id===e.id&&saved.sourceTimeCorrected)), ...scheduleHistory, ...capacityHistory].map(projectEvent).sort((a, b) =>
      String(a.recordedAt || a.effectiveAt).localeCompare(String(b.recordedAt || b.effectiveAt))),
    reports: [...historical.filter(r=>!reviewedHistory.has(r.id)),...reportRecords.map((row) => ({ id: row.key, ...row.payload,actorId:productionEntryActorId(row.payload,accounts) })).filter((row) => orderIds.has(row.transitId)&&permitted(readActor,row.line))
      .map((row) => ({ ...row, ...(overrides.has(row.id)&&(!row.correctedAt||overrides.get(row.id).at>row.correctedAt) ? { hours: overrides.get(row.id).hours, hourStatus: "Đã duyệt điều chỉnh" } : {}),
        ...(!row.historicalImport?reportMetadata(calendar, calculationEvents, row, directory):{}),
        ...(!row.manualHours&&!row.historicalImport&&!row.cancelled&&row.reviewStatus==="Chờ kiểm tra" ? {hours:reportCalculation(calendar,calculationEvents,row,directory).hours} : {}) }))].map(projectEvent),
    payrollEmployees:directory.map(row=>({...row.payload,id:row.key})).filter(row=>!row._deleted&&(permitted(readActor,row.line)||actor.line&&(projectedHr.some(event=>event.employees.includes(row.id))||effectiveAttendance(allEvents).some(event=>event.destinationLine===actor.line&&event.employees?.includes(row.id))))).map(row=>permitted(readActor,row.line)?row:{id:row.id,name:row.name,line:row.line,active:row.active}),
    employees: directory.map((row) => ({ ...row.payload, id: row.key,active:employeeActiveOn(row.payload) })).filter((row) => row.active !== false && (canManage(actor) || permitted(readActor, row.line)||actor.line&&activeStaffMovement(allEvents,row.id,Date.now())?.destinationLine===actor.line)).map(row=>permitted(readActor,row.line)?row:{id:row.id,name:row.name,line:row.line,active:row.active}).concat(actor.line?employeeDirectory.filter(person=>!permitted(readActor,person.line)&&projectedHr.some(event=>event.employees.includes(person.id))&&person.active!==false&&!canManage(actor)&&activeStaffMovement(allEvents,person.id,Date.now())?.destinationLine!==actor.line).map(person=>({id:person.id,name:person.name,line:person.line,active:person.active})):[]),
    actualSchedules: [...calendar.actual.values()].filter((row) => permitted(readActor, row.line)),
    approvedSchedules: [...calendar.approved.entries()].filter(([key]) => permitted(readActor, key.split(":")[1])).map(([key, reference]) => ({ key, ...reference, days: resolveSchedule(calendar, ...key.split(":")).days })),
    rights: { stageLive:true, crossLineView, historyImport:Boolean(actor.isAdmin&&!actor.line),hr:canHr(actor), ...productionMenuRights(actor), line: actor.line || null },
  };
}
export async function mutateProductionWorkflow(db, body, actor, catalog = []) {
 const result=await mutateProductionWorkflowInternal(db,body,actor,catalog);
 if(!hasQuickLineReadScope(actor)||(!result.event&&!result.report))return result;
 const visible=await readProductionWorkflow(db,actor,catalog);
 return {...result,...(result.event?{event:visible.events.find(row=>row.id===result.event.id)||null}:{}),...(result.report?{report:visible.reports.find(row=>row.id===result.report.id)||null}:{})};
}
async function mutateProductionWorkflowInternal(db, body, actor, catalog = []) {
  if (!workflowActionAllowed(actor,body)) fail("Không có quyền thao tác tại menu này.",403);
  if (!canWork(actor)&&!canHr(actor)) fail("Không có quyền ghi dữ liệu sản xuất.", 403);
  const action = String(body.action || ""), permittedActions = ["recalculate-attendance-hours","staff-recall", "staff-recall-approve", "warehouse-duty", "preview-report", "attendance-edit", "attendance-cancel", "line-movement", "attendance-correction", "extra", "start", "transfer", "add", "reduce", "absence", "line-absence", "attendance-override", "schedule", "pause", "resume", "incident", "complete", "approve-hours"];
  if (!permittedActions.includes(action)) fail("Thao tác sản xuất không hợp lệ.");
  const hrAction=canHr(actor)&&["line-absence","attendance-override","attendance-correction","attendance-cancel","attendance-edit"].includes(action);
  if(!canWork(actor)&&!hrAction)fail("HR chỉ được ghi nhận vắng mặt và có mặt thực tế.",403);
  if (["staff-recall", "staff-recall-approve", "attendance-edit", "attendance-cancel", "line-movement", "attendance-correction", "absence", "line-absence", "attendance-override", "schedule", "approve-hours"].includes(action) && !canManage(actor)&&!hrAction) fail("Không có quyền điều chỉnh lịch thực tế và nhân lực.", 403);
  if(action==='line-absence'&&isManagerWork(body.absenceType)&&!canManage(actor))fail("Chỉ QLSX được ghi phụ kho hoặc CV khác.",403);
  if (["line-absence","absence"].includes(action) && !isManagerWork(body.absenceType) && !canHr(actor)) fail("Chỉ HR được ghi vắng mặt.",403);
  if(action==="attendance-override"&&!actor.isAdmin)fail("Không còn sử dụng thao tác Có mặt. HR điều chỉnh bản ghi vắng mặt.",403);
  if(body.attendanceScope==='employee'&&(!canHr(actor)||actor.line))fail('Chỉ HR không giới hạn Line được ghi nhận theo nhân viên.',403);
  const requestId=String(body.requestIdempotency||"");
  if(requestId && !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) fail("Mã thao tác không hợp lệ.");
  if(requestId){const existing=(await rows(db,"production_event")).find(r=>r.payload.requestIdempotency===requestId);
    if(existing){if(personalHrEvent(existing.payload)&&(!canHr(actor)||actor.line))fail("Không có quyền đọc lại dữ liệu HR theo nhân viên.",403);if(existing.payload.actor!==actor.login)fail("Mã thao tác thuộc người khác.",409);return {event:existing.payload,replayed:true,...(existing.payload.kind==='staff-recall-request'?{pendingRecall:true,requestId:existing.payload.requestId}:{})};}}
  const cursorBefore=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();
  const expectedCursor=cursorBefore?.payload||JSON.stringify({version:0,token:""});
  const commit=(db,actor,now,items,report=null,record=null,extraRecords=[])=>commitEvents(db,actor,now,items,report,record,expectedCursor,extraRecords);
  const state = await readProductionWorkflow(db, { ...actor, line: null }, catalog);
  const events = state.events.filter(e=>!e.voided&&!e.historicalImport), calendar = await schedules(db), now = new Date().toISOString();
  if(body.stageEntries){
    const effectiveAt=iso(body.effectiveAt,actor);
    return writeStageWork({db,body,actor,state,events,now,commit,effectiveAt,
      calculate:(history,report)=>reportCalculation(calendar,history,report,[],true,true),
      validatePeople:(ids,order,extra)=>{const moment=vnMoment(effectiveAt),actual=resolveSchedule(calendar,weekOf(moment.date),order.line),day=actual.days.find(d=>d.date===moment.date),part=shiftAt(day,moment.minute);
        if(!extra&&(!actual.approved||!part))fail('Thời điểm không thuộc lịch làm việc đã duyệt. Chọn Làm việc phát sinh nếu làm ngoài lịch.');
        if(!extra){const ref={...calendar.approved.get(`${weekOf(moment.date)}:${order.line}`),days:actual.days};const staff=eligibleStaff({reference:ref,events,employees:state.employees,line:order.line,date:moment.date,at:moment.minute,part});if(ids.some(id=>!staff.allowed.some(p=>p.id===id)))fail('Nhân viên chưa thuộc ca hoặc đang nghỉ. Kiểm tra Lịch SX thực tế.');}},
      legacyPeople:(ids,order,current,at)=>state.orders.some(o=>!Object.values(current).some(s=>s.orderId===o.id&&s.startedAt)&&peopleAt(events,o.id,Date.parse(at)).people.some(id=>ids.includes(id)))
    });
  }
  if(['start','pause','resume','complete','add','reduce','transfer'].includes(action)&&events.some(e=>e.stageReporting&&e.sourceId===body.orderId))fail('Lệnh đang báo công theo công đoạn. Mở SX báo công và chọn thao tác theo công đoạn.',409);
  const adjustmentEvents=(changes,event,reason,requestIds)=>{
    const groups=new Map();for(const change of changes){const line=state.reports.find(report=>report.id===change.reportId)?.line;if(!line)continue;groups.set(line,[...(groups.get(line)||[]),change]);}
    return [...groups].map(([line,changes])=>({id:crypto.randomUUID(),kind:'hours-adjustment',sourceId:null,line,effectiveAt:event.effectiveAt,recordedAt:now,actor:actor.login,requestIds,reason,changes}));
  };
  const automaticHrAdjustments=items=>{
    const absences=items.filter(e=>e.approved&&["line-absence","absence","attendance-override"].includes(e.kind));
    if(!(canHr(actor)||canManage(actor))||!absences.length)return [];
    const history=[...events,...items];
    const changes=state.reports.filter(r=>canRecalculateReport(r)&&absences.some(e=>affectedReport(e,r,events))).map(r=>({reportId:r.id,before:r.hours??null,after:reportCalculation(calendar,history,r,[]).hours}));
    return adjustmentEvents(changes,items[0],'Cập nhật nhân sự · tự tính lại giờ báo công',items.map(event=>event.id));
  };
  if(action==='recalculate-attendance-hours') {
    if(!actor.isAdmin||actor.line)fail('Chỉ Admin toàn quyền được đối chiếu và tính bù báo công.',403);
    if(!['preview','apply'].includes(body.mode)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month||''))fail('Chọn tháng tính lại hợp lệ.');
    const from=Date.parse(body.month+'-01T00:00:00+07:00'),next=new Date(body.month+'-01T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const to=Date.parse(next.toISOString().slice(0,10)+'T00:00:00+07:00');
    const attendance=effectiveAttendance(events).filter(e=>['absence','line-absence','attendance-override','line-movement','transfer'].includes(e.kind));
    const pendingAttendance=effectiveAttendance(events,true).filter(e=>e.approved===false&&['absence','line-absence','attendance-override'].includes(e.kind)&&Date.parse(e.effectiveAt)<to&&Date.parse(e.endsAt)>from).length;
    const impacted=state.reports.filter(r=>r.kind==='completion'&&!r.cancelled&&!r.voided&&Date.parse(r.startedAt)<to&&Date.parse(r.completedAt)>from&&attendance.some(e=>affectedReport(e,r,events)));
    const skipped=impacted.filter(r=>!canRecalculateReport(r)).map(r=>({id:r.id,lsx:r.lsxCode,reason:r.manualHours?'Giờ đã điều chỉnh thủ công':'Thiếu phân công chi tiết; giữ giờ nguồn để đối chiếu'}));
    const changes=impacted.filter(canRecalculateReport).map(r=>({reportId:r.id,before:r.hours??null,after:reportCalculation(calendar,events,r,[]).hours})).filter(c=>!sameReportHours(c.before,c.after));
    const signature=JSON.stringify([body.month,expectedCursor,state.reports,events,[...calendar.actual],[...calendar.approved]]);
    const revision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const summary=changes.map(c=>{const r=state.reports.find(r=>r.id===c.reportId);return {reportId:r.id,lsx:r.lsxCode,stage:r.stageName,line:r.line,completedAt:r.completedAt,before:c.before?.total??null,after:c.after?.total??null,employees:[...new Set([...(c.before?.perEmployee||[]).map(p=>p.id),...(c.after?.perEmployee||[]).map(p=>p.id)])].map(id=>({id,name:state.payrollEmployees.find(p=>p.id===id)?.name||r.employeeDetails?.find(p=>p.id===id)?.name||id,before:c.before?.perEmployee?.find(p=>p.id===id)?.total||0,after:c.after?.perEmployee?.find(p=>p.id===id)?.total||0}))};});
    if(body.mode==='preview')return {revision,month:body.month,checked:impacted.length,changes:summary,skipped,pendingAttendance};
    if(body.revision!==revision)fail('Dữ liệu nhân sự hoặc báo công đã thay đổi. Đối chiếu lại trước khi cập nhật.',409);
    if(changes.length){
      const items=[];for(let i=0;i<changes.length;i+=20)items.push(...adjustmentEvents(changes.slice(i,i+20),{effectiveAt:new Date(from).toISOString()},'Tính bù báo công theo dữ liệu nhân sự · '+body.month,[]));
      await commit(db,actor,now,items);
    }
    return {updated:changes.length,checked:impacted.length,changes:summary,skipped,pendingAttendance};
  }
  if(['staff-recall','staff-recall-approve'].includes(action)) {
    const approving=action==='staff-recall-approve';
    const requestRow=approving?await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(String(body.id||'')).first():null;
    const originalRequest=requestRow?JSON.parse(requestRow.payload):null;
    if(approving&&originalRequest?.kind!=='staff-recall')fail('Không tìm thấy yêu cầu thu hồi nhân sự.',404);
    const submittedBody=body;
    if(approving)body={...body,...originalRequest.recall.window,employees:originalRequest.recall.employees.map(p=>p.id)};
    const effectiveAt=new Date(clock(body.effectiveAt)).toISOString(),endsAt=new Date(clock(body.endsAt)).toISOString();
    if(Date.parse(endsAt)<=Date.parse(effectiveAt)||Date.parse(endsAt)-Date.parse(effectiveAt)>31*86400000)fail('Chọn khoảng thu hồi lớn hơn 0 và không quá 31 ngày.');
    const scopeRow=await db.prepare("SELECT payload FROM app_records WHERE entity='production_allocation_scope' AND record_key='global'").first();
    const recallScope=scopeRow?JSON.parse(scopeRow.payload):null,recallAuthority=allocationAuthority(actor,recallScope);
    if(!recallScope?.enabled||!recallAuthority)fail('Chưa cấu hình đủ QLSX hai phía để gửi và xác nhận thu hồi. Liên hệ Admin kiểm tra phạm vi điều phối.',403);
    if(approving){
      if(!canApproveStaffRecall(originalRequest,actor,recallScope))fail('Chỉ QLSX phía đang nhận nhân sự được đồng ý; người tạo không được tự xác nhận.',403);
      if(originalRequest.revision!==submittedBody.revision)fail('Yêu cầu đã thay đổi hoặc đã được xác nhận. Mở lại để kiểm tra.',409);
    }
    const ids=Array.isArray(body.employees)?[...new Set(body.employees.map(upper))]:[];
    if(!ids.length||ids.length>100)fail('Chọn từ 1 đến 100 nhân viên cần thu hồi.');
    const candidates=staffRecallCandidates({references:state.approvedSchedules,events,employees:state.employees,effectiveAt,endsAt});
    const chosen=ids.map(id=>candidates.find(p=>upper(p.id)===id));
    if(chosen.some(p=>!p))fail('Nhân viên không còn phân bổ sang Line khác trong khoảng đã chọn. Tải lại danh sách và kiểm tra thời gian.',409);
    if(!approving&&chosen.some(p=>!permitted(actor,p.line)||!recallAuthority.lines.includes(p.line)))fail('Chỉ QLSX quản lý Line gốc được thu hồi nhân sự về Line đó.',403);
    const sourceGroups=[...new Set(chosen.map(p=>recallGroup(p.line)))],targetGroups=[...new Set(chosen.flatMap(p=>p.segments.map(s=>recallGroup(s.line))))];
    if(sourceGroups.length!==1||targetGroups.length!==1||!sourceGroups[0]||!targetGroups[0]||sourceGroups[0]===targetGroups[0])fail('Chọn nhân sự chuyển giữa Line C và Line A/B trong cùng một yêu cầu.');
    if(!recallScope.managers?.some(m=>m.group===targetGroups[0]))fail('Chưa cấu hình QLSX phía nhận để xác nhận yêu cầu.',409);
    if(approving&&(sourceGroups[0]!==originalRequest.recall.sourceGroup||targetGroups[0]!==originalRequest.recall.targetGroup))fail('Phân bổ nhân sự đã thay đổi. Kiểm tra và tạo yêu cầu mới.',409);
    const login=productionActorId(actor),local=new Date(Date.parse(now)+7*3600000).toISOString();
    if(!approving){
      const pending=(await rows(db,'department_change')).map(r=>r.payload).filter(r=>r.kind==='staff-recall'&&r.recall?.status==='pending');
      if(pending.some(r=>r.recall.employees.some(p=>ids.includes(upper(p.id)))&&Date.parse(r.recall.window.effectiveAt)<Date.parse(endsAt)&&Date.parse(r.recall.window.endsAt)>Date.parse(effectiveAt)))fail('Nhân viên đã có yêu cầu thu hồi chờ xác nhận trong khoảng này. Xem Lịch sử Nhân sự trước khi gửi lại.',409);
      const id=crypto.randomUUID(),label=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});
      const content=`Đề nghị thu hồi nhân sự: ${chosen.map(p=>`${p.name} (${p.id}) · Line ${p.borrowedLines.join('/')} → Line ${p.line}`).join('; ')}. Từ ${label(effectiveAt)} đến ${label(endsAt)}.`;
      const request={id,kind:'staff-recall',code:'THNS-'+id.slice(0,8).toUpperCase(),owner:login,department:'QLSX',createdAt:now,updatedAt:now,date:local.slice(0,10),time:local.slice(11,16),revision:1,drafts:{},recipients:[recallGroupLabel(targetGroups[0])],pendingDepartments:[recallGroupLabel(targetGroups[0])],messages:[{text:content,at:now,login,department:recallGroupLabel(sourceGroups[0])}],recall:{status:'pending',sourceGroup:sourceGroups[0],targetGroup:targetGroups[0],window:{effectiveAt,endsAt},employees:chosen.map(p=>({id:p.id,name:p.name,line:p.line,borrowedLines:p.borrowedLines})),segments:chosen.flatMap(p=>p.segments.map(segment=>({...segment,employeeId:p.id})))}};
      const event={id:crypto.randomUUID(),kind:'staff-recall-request',requestId:id,line:chosen[0].line,effectiveAt,endsAt,employees:ids,count:ids.length,employeeDetails:eventEmployees({employees:ids},state.employees),reason:content,recordedAt:now,actor:actor.login,requestIdempotency:requestId||undefined};
      await commit(db,actor,now,[event],null,null,[{entity:'department_change',key:id,payload:request,expected:null}]);
      return {event,requestId:id,pendingRecall:true,count:ids.length};
    }
    const currentSegments=chosen.flatMap(p=>p.segments.map(segment=>({...segment,employeeId:p.id})));
    if(JSON.stringify(currentSegments)!==JSON.stringify(originalRequest.recall.segments))fail('Phân bổ đã thay đổi sau khi gửi yêu cầu. Chưa thu hồi; kiểm tra lại trước khi xác nhận.',409);
    const items=chosen.flatMap(person=>person.segments.map(segment=>({id:crypto.randomUUID(),kind:'line-movement',movementType:'recall',...segment,employees:[person.id],count:1,employeeDetails:eventEmployees({employees:[person.id]},state.employees),approved:true,sourceId:null,parentMovementIds:effectiveAttendance(events).filter(e=>['line-movement','transfer'].includes(e.kind)&&e.employees?.includes(person.id)&&Date.parse(e.effectiveAt)<Date.parse(segment.endsAt)&&(!e.endsAt||Date.parse(e.endsAt)>Date.parse(segment.effectiveAt))).map(e=>e.id),reason:'Thu hồi nhân sự',recordedAt:now,actor:actor.login,recallWindow:{effectiveAt,endsAt}})));
    if(items.length>500)fail('Khoảng thu hồi có quá nhiều phân đoạn. Chọn khoảng thời gian ngắn hơn.');
    items[0].requestIdempotency=requestId||undefined;
    const updated=[...events,...items];
    const changes=state.reports.filter(r=>canRecalculateReport(r)&&items.some(e=>affectedReport(e,r,events))).map(r=>({reportId:r.id,before:r.hours??null,after:reportCalculation(calendar,effectiveAttendance(updated),r,[]).hours}));
    for(const item of items)item.recallRequestId=originalRequest.id;
    const nextRequest={...originalRequest,revision:originalRequest.revision+1,updatedAt:now,pendingDepartments:[],pending:null,recall:{...originalRequest.recall,status:'approved',approvedBy:login,approvedAt:now,eventIds:items.map(e=>e.id)},messages:[...originalRequest.messages,{text:'Đồng ý thu hồi nhân sự theo khoảng thời gian yêu cầu. Đã cập nhật lịch thực tế.',at:now,login,department:recallGroupLabel(originalRequest.recall.targetGroup)}]};
    await commit(db,actor,now,[...items,...adjustmentEvents(changes,items[0],'Thu hồi nhân sự · tự tính lại giờ báo công',items.map(e=>e.id))],null,null,[{entity:'department_change',key:originalRequest.id,payload:nextRequest,expected:requestRow.payload}]);
    return {event:items[0],count:ids.length,affected:changes.length};
  }
  if(action==='warehouse-duty') {
    const result=buildWarehouseDuty({body,state,actor,now,canManage,permitted,affectedReport});
    await commit(db,actor,now,[...result.events,...automaticHrAdjustments(result.events)]);return result;
  }
  if(action==="preview-report") {
    const order=expectedOrder(state.orders,String(body.orderId||""));if(!permitted(actor,order.line))fail("Không có quyền xem LSX này.",403);
    const to=iso(body.effectiveAt,actor),previous=state.reports.filter(r=>r.transitId===order.id&&r.kind==="completion"&&!r.cancelled&&r.reviewStatus!=="Cần điều chỉnh").map(r=>r.completedAt).sort().at(-1);
    const from=body.startedAt?iso(body.startedAt,actor):reportStart(order,state.reports,events);
    if(!from)return {hours:null,staffingIncomplete:true,needsStartedAt:true};
    if(Date.parse(from)>=Date.parse(to))fail("Thời điểm báo công phải sau lần trước hoặc nhập trạm.");
    return {startedAt:from,completedAt:to,...reportCalculation(calendar,events,{transitId:order.id,line:order.line,startedAt:from,completedAt:to,staffingIncomplete:!currentState(events,order,Date.parse(to)).staffingKnown},state.employees.map(p=>({key:p.id,payload:p})))};
  }
  if(["attendance-cancel","attendance-edit","line-movement"].includes(action)) {
    let event, affected;
    const reason=String(body.reason||"").trim();
    if(!reason)fail("Nhập lý do để ghi nhật ký.");
    let original;
    if(action!=="line-movement") {
      original=effectiveAttendance(events,true).find(e=>e.id===body.attendanceId&&["line-absence","absence","attendance-override","line-movement"].includes(e.kind));
      if(!original)fail("Bản ghi đã hủy, đã điều chỉnh hoặc không tồn tại.",409);
      if(personalHrEvent(original)&&(!canHr(actor)||actor.line))fail("Không có quyền sửa dữ liệu HR theo nhân viên.",403);
      if(!permitted(actor,original.line)&&!permitted(actor,original.destinationLine))fail("Không có quyền hủy dữ liệu Line này.",403);
      if(original.kind==='line-movement'||isManagerWork(original.absenceType)){if(!canManage(actor))fail("Chỉ QLSX được hủy phụ kho hoặc chuyển Line.",403);}
      else {if(!canHr(actor))fail("Chỉ HR được hủy dữ liệu vắng mặt.",403);assertHrAttendancePeriod(vnMoment(original.effectiveAt).date);}
    }
    if(original?.movementType==='recall')fail('Bản thu hồi được giữ trong lịch sử thực tế; không sửa bằng thao tác chuyển Line.',409);
    if(original?.kind==='line-movement'&&effectiveAttendance(events,true).some(e=>(e.parentMovementIds||[]).includes(original.id)))fail("Nhân viên đã được cho Line khác mượn tiếp. Hãy hủy lượt mượn sau trước khi sửa hoặc hủy lượt này.",409);
    if(action==="attendance-cancel") {
      affected=original;
      event={...original,id:crypto.randomUUID(),kind:"attendance-cancel",supersedes:original.id,approvedFrom:original.approvedFrom,approved:true,before:original,after:{cancelled:true},reason,recordedAt:now,actor:actor.login,requestIdempotency:requestId||undefined};
    } else if(action==='attendance-edit'&&original.kind!=='line-movement') {
      const absenceType=String(body.absenceType||original.absenceType);let line=upper(body.line||original.line);
      const personal=personalHrEvent(original);if(personal&&!['Nghỉ','Đi trễ','Về sớm'].includes(absenceType))fail('HR theo nhân viên chỉ ghi Nghỉ, Đi trễ hoặc Về sớm.');
      if(!['Nghỉ','Đi trễ','Về sớm','Phụ kho','CV khác'].includes(absenceType)||(!personal&&!['A','B'].includes(line))||!permitted(actor,line))fail('Chọn loại và Line hợp lệ.');
      if(isManagerWork(absenceType)?!canManage(actor):!canHr(actor))fail('Không có quyền sửa loại biến động này.',403);
      const employees=[...new Set((body.employees||original.employees||[]).map(upper))];
      if(!employees.length||employees.some(id=>!state.employees.some(p=>upper(p.id)===id)))fail('Chọn nhân viên trong danh sách.');
      if(personal){if(employees.length!==1)fail('Chọn một nhân viên cho mỗi dòng HR.');line=upper(state.employees.find(person=>upper(person.id)===employees[0])?.line)||null;}
      const effectiveAt=new Date(clock(body.effectiveAt)).toISOString(),endsAt=new Date(clock(body.endsAt)).toISOString();
      if(Date.parse(endsAt)<=Date.parse(effectiveAt)||vnMoment(effectiveAt).date!==vnMoment(endsAt).date)fail('Chọn giờ bắt đầu, kết thúc trong cùng ngày.');
      if(!isManagerWork(absenceType))assertHrAttendancePeriod(vnMoment(effectiveAt).date);
      const overlap=effectiveAttendance(events,true).find(e=>e.id!==original.id&&['absence','line-absence'].includes(e.kind)&&(isManagerWork(absenceType)||!isManagerWork(e.absenceType))&&e.employees?.some(id=>employees.includes(id))&&Date.parse(e.effectiveAt)<Date.parse(endsAt)&&Date.parse(e.endsAt)>Date.parse(effectiveAt));
      if(overlap){
        const directory=new Map(state.employees.map(p=>[upper(p.id),p]));
        fail(attendanceConflictMessage(actor,overlap,employees,directory),409);
      }
      event={...original,id:crypto.randomUUID(),kind:'line-absence',sourceId:null,line,absenceType,employees,count:employees.length,employeeDetails:eventEmployees({employees},state.employees),effectiveAt,endsAt,openArrival:false,approved:true,supersedes:original.id,before:original,reason,recordedAt:now,actor:actor.login,requestIdempotency:requestId||undefined};
      affected={...event,employees:[...new Set([...employees,...original.employees])],before:original};
    } else {
      if(!canManage(actor))fail("Chỉ QLSX được chuyển Line.",403);
      const line=upper(body.line),destinationLine=upper(body.destinationLine),employees=[...new Set((body.employees||[]).map(upper))];
      const lines=new Set(['A','B',...state.employees.map(p=>upper(p.line)).filter(Boolean)]);
      if(!lines.has(line)||!['A','B'].includes(destinationLine)||line===destinationLine||!permitted(actor,destinationLine)||!employees.length)fail("Chọn Line nguồn, Line nhận khác nhau và nhân viên.");
      const effectiveAt=new Date(clock(body.effectiveAt)).toISOString(),endsAt=body.endsAt?new Date(clock(body.endsAt)).toISOString():null;
      if(endsAt&&Date.parse(endsAt)<=Date.parse(effectiveAt))fail("Thời điểm kết thúc phải sau bắt đầu.");
      const active=effectiveAttendance(events,true),directory=new Map(state.employees.map(p=>[upper(p.id),p]));
      if(employees.some(id=>!directory.has(id)))fail("Nhân viên phải đang hoạt động trong danh sách.");
      if((body.directoryAssignment||original?.directoryAssignment)&&employees.some(id=>upper(directory.get(id).line)!==destinationLine))fail("Line nhận phải khớp Line hiện tại trong Danh sách nhân viên. Tải lại để lấy dữ liệu mới.",409);
      const previous=active.filter(e=>e.id!==original?.id);
      const references=state.approvedSchedules;
      if(endsAt&&!body.directoryAssignment&&!original?.directoryAssignment){
        const available=new Set(transferStaffCandidates({references,events:previous,employees:state.employees,line,effectiveAt,endsAt}).map(e=>upper(e.id)));
        if(employees.some(id=>!available.has(id)))fail("Nhân viên không có đủ thời gian tại Line nguồn trong khoảng đã chọn. Tải lại và kiểm tra các lượt mượn hoặc lịch điều phối.",409);
      }else if(previous.some(e=>e.kind==='line-movement'&&e.employees?.some(id=>employees.includes(id))&&Date.parse(e.effectiveAt)<(endsAt?Date.parse(endsAt):Infinity)&&(e.endsAt?Date.parse(e.endsAt):Infinity)>Date.parse(effectiveAt)))fail("Nhân viên đã có chuyển Line trùng khoảng giờ. Hủy bản sai trước khi nhập lại.",409);
      const parentMovementIds=[...new Set(previous.filter(e=>['transfer','line-movement'].includes(e.kind)&&e.destinationLine===line&&e.employees?.some(id=>employees.includes(upper(id)))&&Date.parse(e.effectiveAt)<(endsAt?Date.parse(endsAt):Infinity)&&(!e.endsAt||Date.parse(e.endsAt)>Date.parse(effectiveAt))).map(e=>e.id))];
      event={id:crypto.randomUUID(),kind:'line-movement',parentMovementIds,directoryAssignment:Boolean(body.directoryAssignment||original?.directoryAssignment),sourceId:null,line,destinationLine,employees,count:employees.length,employeeDetails:eventEmployees({employees},state.employees),effectiveAt,endsAt,approved:true,supersedes:original?.id,before:original,reason,recordedAt:now,actor:actor.login,requestIdempotency:requestId||undefined};affected={...event,employees:[...new Set([...employees,...(original?.employees||[])])]};
    }
    const updated=[...events,event];
    const changes=state.reports.filter(r=>canRecalculateReport(r)&&affectedReport(affected,r,events)).map(r=>({reportId:r.id,before:r.hours??null,after:reportCalculation(calendar,effectiveAttendance(updated),r,[]).hours}));
    const audit=adjustmentEvents(changes,event,`${action==='attendance-cancel'?'Hủy biến động':action==='attendance-edit'?'Sửa biến động':'Chuyển Line'} · tự tính lại giờ báo công`,[event.id]);
    await commit(db,actor,now,[event,...audit]);return {event,affected:changes.length};
  }
  if(action==="attendance-correction") {
    const original=effectiveAttendance(events,true).find(e=>e.id===body.attendanceId&&["line-absence","attendance-override"].includes(e.kind));
    if(!original||!permitted(actor,original.line))fail("Biến động đã được điều chỉnh hoặc không tồn tại.",409);
    if(personalHrEvent(original)&&(!canHr(actor)||actor.line))fail("Không có quyền sửa dữ liệu HR theo nhân viên.",403);
    if(!isManagerWork(original.absenceType)){if(!canHr(actor))fail("Chỉ HR được điều chỉnh vắng mặt.",403);assertHrAttendancePeriod(vnMoment(original.effectiveAt).date);}
    if(isManagerWork(original.absenceType)&&!canManage(actor))fail("Chỉ QLSX được điều chỉnh phụ kho.",403);
    const effectiveAt=body.effectiveAt?new Date(clock(body.effectiveAt)).toISOString():original.effectiveAt;
    const endsAt=new Date(clock(body.endsAt)).toISOString();
    if(vnMoment(effectiveAt).date!==vnMoment(original.effectiveAt).date)fail("Điều chỉnh giờ trong cùng ngày với bản ghi gốc.");
    if(Date.parse(endsAt)<=Date.parse(effectiveAt)||vnMoment(endsAt).date!==vnMoment(original.effectiveAt).date)fail("Giờ thực tế phải sau giờ bắt đầu và trong cùng ngày.");
    const kind=body.actualPresent?"attendance-override":original.kind;
    const absenceType=body.actualPresent?"Có mặt":body.fullLeave?"Nghỉ":original.absenceType;
    if(original.openArrival&&Date.parse(endsAt)>Date.now()+600000&&!body.fullLeave)fail("Giờ vào thực tế không được ở tương lai.");
    if(!isManagerWork(absenceType))assertHrAttendancePeriod(vnMoment(effectiveAt).date);
    const overlap=effectiveAttendance(events,true).find(e=>e.id!==original.id&&(isManagerWork(original.absenceType)||!isManagerWork(e.absenceType))&&["absence","line-absence","attendance-override"].includes(e.kind)&&e.employees?.some(id=>original.employees.includes(id))&&Date.parse(e.effectiveAt)<Date.parse(endsAt)&&Date.parse(e.endsAt)>Date.parse(effectiveAt));
    if(overlap)fail(attendanceConflictMessage(actor,overlap,original.employees,new Map(state.employees.map(p=>[upper(p.id),p]))),409);
    const revised={...original,id:crypto.randomUUID(),supersedes:original.id,approvedFrom:original.approved===false?original.id:undefined,kind,absenceType,effectiveAt,endsAt,openArrival:false,
      approved:true,recordedAt:now,actor:actor.login,reason:absenceType,requestIdempotency:requestId||undefined,before:{...original},after:{effectiveAt,endsAt,absenceType,openArrival:false}};
    await commit(db,actor,now,[revised,...automaticHrAdjustments([revised])]);return {event:revised,pendingHours:!revised.approved};
  }
  if (action === "line-absence" || action === "attendance-override") {
    const personal=body.attendanceScope==='employee';
    let line = upper(body.line);const employees = Array.isArray(body.employees) ? [...new Set(body.employees.map(upper))] : [];
    if ((!personal&&!["A", "B"].includes(line)) || !permitted(actor,line) || !employees.length || employees.length > 10000) fail("Chọn Line và ít nhất một nhân viên.");
    const effectiveAt = new Date(clock(body.effectiveAt)).toISOString();
    if(personal&&body.openArrival===true)fail("Nhập khoảng giờ đã xác định cho ghi nhận HR theo nhân viên.");
    const openArrival=action==="line-absence"&&body.absenceType==="Đi trễ"&&body.openArrival===true;
    const date=vnMoment(effectiveAt).date,actualDay=resolveSchedule(calendar,weekOf(date),line).days.find(d=>d.date===date);
    const endsAt = openArrival?new Date(`${date}T${actualDay?.ot?actualDay.otEnd||"21:00":actualDay?.hcEnd||"17:00"}:00+07:00`).toISOString():new Date(clock(body.endsAt)).toISOString();
    const {date:fromDate,minute:startMinute}=vnMoment(effectiveAt),{date:endDate,minute:endMinute}=vnMoment(endsAt);
    if (endDate!==fromDate || endMinute<=startMinute) fail("Chọn giờ kết thúc sau giờ bắt đầu trong cùng ngày.");
    const toDate=body.dateTo===undefined?fromDate:String(body.dateTo);
    const startDay=Date.parse(`${fromDate}T00:00:00Z`),lastDay=Date.parse(`${toDate}T00:00:00Z`);
    if (!/^\d{4}-\d\d-\d\d$/.test(toDate)||!Number.isFinite(lastDay)||new Date(lastDay).toISOString().slice(0,10)!==toDate||lastDay<startDay||lastDay-startDay>31*86400000)
      fail("Khoảng nghỉ phải từ ngày bắt đầu đến ngày kết thúc, tối đa 32 ngày.");
    if(action!=="line-absence"&&toDate!==fromDate||action==="line-absence"&&String(body.absenceType||"Nghỉ")!=="Nghỉ"&&toDate!==fromDate)
      fail("Khoảng nhiều ngày hiện chỉ áp dụng cho đăng ký nghỉ.");
    const directory = new Map(state.employees.map(item=>[upper(item.id),item]));
    if (employees.some(id=>!directory.has(id))) fail("Nhân viên không có trong Danh sách nhân viên đang làm.");
    if(personal){if(action!=='line-absence'||employees.length!==1||!['Nghỉ','Đi trễ','Về sớm'].includes(body.absenceType))fail('HR theo nhân viên chỉ ghi một người với Nghỉ, Đi trễ hoặc Về sớm.');line=upper(directory.get(employees[0])?.line)||null;}
    const absenceType=action==="attendance-override"?"Có mặt":String(body.absenceType||"Nghỉ");
    if(action==="line-absence"&&!["Nghỉ","Đi trễ","Về sớm","Phụ kho","CV khác"].includes(absenceType)) fail("Loại biến động không hợp lệ.");
    if(!isManagerWork(absenceType))assertHrAttendancePeriod(fromDate);
    if(isOtherWork(absenceType)&&!String(body.reason||" ").trim())fail("Nhập nội dung công việc khác.");
    const reason=String(body.reason||"").trim()||absenceType;
    const rangeId=crypto.randomUUID(),created=[];
    for(let day=startDay;day<=lastDay;day+=86400000){
      const date=new Date(day).toISOString().slice(0,10),actual=resolveSchedule(calendar,weekOf(date),line);
      if(!personal&&!actual.approved) fail(`Ngày ${date} chưa có Capacity được KHSX đồng ý. Chưa lưu ngày nào.`,409);
      const scheduleDay=actual.days.find(item=>item.date===date);
      if(!personal&&!scheduleDay?.working) continue;
      const start=new Date(`${date}T${String(Math.floor(startMinute/60)).padStart(2,"0")}:${String(startMinute%60).padStart(2,"0")}:00+07:00`).toISOString();
      const end=new Date(`${date}T${String(Math.floor(endMinute/60)).padStart(2,"0")}:${String(endMinute%60).padStart(2,"0")}:00+07:00`).toISOString();
      const reference={...calendar.approved.get(`${weekOf(date)}:${line}`),days:actual.days};
      const part=shiftAt(scheduleDay,startMinute)||"hc";
      const roster=eligibleStaff({reference,events,employees:state.employees,line,date,at:startMinute,part});
      if(!personal&&employees.some(id=>![...roster.allowed,...roster.blocked].some(person=>upper(person.id)===id))) fail(`Ngày ${date}: nhân viên không thuộc danh sách ca tại Line này. Chưa lưu ngày nào.`,409);
      if(action==="attendance-override"&&employees.some(id=>!hasApprovedLeave(reference,id,date,startMinute,endMinute,part)))
        fail(`Ngày ${date}: chỉ dùng Có mặt thực tế cho nhân viên đã đăng ký nghỉ trong Capacity.`,409);
      // Keep the presence/eligibility guard, but prefer a scoped collision diagnostic
      // when the same request is invalid for both reasons. Collision is global;
      // attendanceConflictMessage discloses details only for visible Lines.
      const duplicate=effectiveAttendance(events,true).find(event=>["absence","line-absence","attendance-override"].includes(event.kind)&& (isManagerWork(absenceType)||event.absenceType!=="Phụ kho")&&
        (event.employees||[]).some(id=>employees.includes(upper(id)))&&Date.parse(event.effectiveAt)<Date.parse(end)&&Date.parse(event.endsAt)>Date.parse(start));
      if(duplicate)fail(`${attendanceConflictMessage(actor,duplicate,employees,directory)} Chưa lưu ngày nào.`,409);
      if(action==="line-absence"&&isManagerWork(absenceType)&&employees.some(id=>!isPresent(reference,events,id,line,date,startMinute,part)))
        fail(`Ngày ${date}: nhân viên đã nghỉ hoặc không thuộc lịch Line. Chưa lưu ngày nào.`,409);
      created.push({id:crypto.randomUUID(),...(personal?{attendanceScope:'employee'}:{}),rangeId,rangeFrom:fromDate,rangeTo:toDate,kind:action,sourceId:null,line,count:employees.length,employees,employeeDetails:eventEmployees({employees},state.employees),
        effectiveAt:start,endsAt:end,openArrival,recordedAt:now,actor:actor.login,reason,absenceType,approved:true,requestIdempotency:requestId||undefined});
    }
    if(!created.length) fail("Khoảng ngày đã chọn không có ngày làm việc; chưa ghi nhận nghỉ.",409);
    await commit(db,actor,now,[...created,...automaticHrAdjustments(created)]);
    return {event:created[0],events:created,recordedDays:created.length,pendingHours:created.some(event=>!event.approved)};
  }
  if (action === "approve-hours" && !body.orderId) {
    const request=events.find(item=>item.id===body.requestId&&["line-absence","attendance-override"].includes(item.kind)&&item.approved===false);
    if(!request||!permitted(actor,request.line)) fail("Yêu cầu điều chỉnh giờ đã được xử lý hoặc không tồn tại.",409);
    const requests=request.rangeId?events.filter(item=>item.rangeId===request.rangeId&&item.approved===false):[request];
    if(!requests.length||requests.some(item=>events.some(other=>other.approvedFrom===item.id))) fail("Yêu cầu điều chỉnh giờ đã được xử lý hoặc không tồn tại.",409);
    const effective=requests.map(item=>({...item,id:crypto.randomUUID(),approved:true,approvedFrom:item.id,recordedAt:now,actor:actor.login}));
    const history=[...events,...effective];
    const changes=state.reports.filter(report=>canRecalculateReport(report)&&["Đã xác nhận","Chờ kiểm tra"].includes(report.reviewStatus)&&requests.some(item=>affectedReport(item,report,events))).map(report=>{
      const order=state.orders.find(item=>item.id===report.transitId);
      if(!order)return null;
      if(!permitted(actor,order.line))fail(`Không có quyền duyệt giờ LSX ${order.lsxCode} tại Line ${order.line}.`,403);
      const hours=reportCalculation(calendar,history,report,[]).hours;
      return {reportId:report.id,before:report.hours??null,after:hours};
    }).filter(Boolean);
    const adjustment={id:crypto.randomUUID(),kind:"hours-adjustment",sourceId:null,line:request.line,effectiveAt:request.effectiveAt,recordedAt:now,
      actor:actor.login,requestId:request.id,requestIds:requests.map(item=>item.id),reason:"QLSX duyệt biến động theo Line sau thời điểm báo công",changes};
    await commit(db,actor,now,[...effective,adjustment]);
    return {event:adjustment,affected:changes.length};
  }
  const order = action === "schedule" ? null : expectedOrder(state.orders, String(body.orderId || ""));
  if (order && !permitted(actor, order.line)) fail("LSX không thuộc Line được cấp.", 403);
  if(order?.historicalOnly)fail("Lệnh lưu trữ chỉ dùng đối chiếu lịch sử, không báo công mới.",409);
  if(order&&!["approve-hours","preview-report"].includes(action)&&state.reports.some(r=>r.transitId===order.id&&r.kind==="completion"&&r.reviewStatus==="Chờ kiểm tra"&&events.some(e=>e.reportId===r.id&&e.finalCompletion)))fail(`LSX ${order.lsxCode} đã báo đủ sản lượng, chờ QLSX xác nhận hoặc trả báo công.`,409);
  if (order && action !== "approve-hours" && currentState(events, order, Date.now()).completed) fail(`LSX ${order.lsxCode} đã hoàn thành.`, 409);
  if (action === "schedule") {
    const week = String(body.week || ""), line = upper(body.line);
    if (!/^\d{4}-\d\d-\d\d$/.test(week) || weekOf(week) !== week || !["A", "B"].includes(line)) fail("Tuần hoặc Line không hợp lệ.");
    if (!permitted(actor, line)) fail("Không có quyền đổi lịch Line này.", 403);
    const existing = resolveSchedule(calendar, week, line);
    if (!existing.approved) fail("Chờ KHSX đồng ý Capacity của tuần và Line này trước khi ghi lịch thực tế.", 409);
    if (Number(body.approvedVersion) !== existing.reference.version) fail("KHSX vừa đồng ý phiên bản Capacity mới; tải lại lịch trước khi lưu.", 409);
    if (Number(body.version || 0) !== existing.version) fail("Lịch vừa được sửa; tải lại trước khi lưu.", 409);
    if (!Array.isArray(body.days) || body.days.length !== 7 || body.days.some((day, i) => day.date !== dayRange(week)[i])) fail("Lịch thực tế cần đủ bảy ngày của tuần.");
    const days = body.days.map((day) => { const parsed = scheduleDay(day);
      if (parsed.hcEnd <= parsed.hcStart || parsed.otEnd <= parsed.otStart || parsed.otStart < parsed.hcEnd ||
        parsed.ot && (parsed.preOtStart < parsed.hcEnd || parsed.preOtEnd <= parsed.preOtStart || parsed.preOtEnd > parsed.otStart) ||
        parsed.lunchStart < parsed.hcStart || parsed.lunchEnd <= parsed.lunchStart || parsed.lunchEnd > parsed.hcEnd ||
        parsed.breakMorningEnd <= parsed.breakMorningStart || parsed.breakAfternoonEnd <= parsed.breakAfternoonStart ||
        parsed.cleaning.some((group) => group.end <= group.start || group.start < parsed.hcStart || group.end > parsed.hcEnd || !Number.isSafeInteger(group.people) || group.people < 0) ||
        parsed.ot && !parsed.working) fail("Khung giờ, tăng ca hoặc số người vệ sinh trong lịch không hợp lệ.");
      if (typeof day.note !== "undefined" && (typeof day.note !== "string" || day.note.length > 500)) fail("Ghi chú ngày không hợp lệ (tối đa 500 ký tự).");
      return { ...day, line }; });
    const altered = new Set(days.filter((day, index) => JSON.stringify(withoutLine(day)) !== JSON.stringify(withoutLine(existing.days[index]))).map((day) => day.date));
    const reason = String(body.reason || "").trim(); if (!reason) fail("Nhập lý do đổi lịch thực tế.");
    if (!altered.size) return { schedule: calendar.actual.get(existing.key) || existing, unchanged: true };
    const record = { key: existing.key, week, line, days, reference: existing.reference, version: existing.version + 1,
      history: [...existing.history, { before: existing.days, after: days, reason, by: actor.login, byId:productionActorId(actor), at: now }] };
    const old = calendar.actual.get(existing.key);
    const nextCalendar={...calendar,actual:new Map(calendar.actual)};
    nextCalendar.actual.set(existing.key,record);
    const impacted=state.reports.filter(report=>report.kind==='completion'&&!report.cancelled&&!report.voided&&report.line===line&&[...altered].some(date=>{
      const start=Date.parse(`${date}T00:00:00+07:00`);return Date.parse(report.startedAt)<start+86400000&&Date.parse(report.completedAt)>start;
    }));
    const changes=impacted.filter(canRecalculateReport).map(report=>({reportId:report.id,before:report.hours??null,after:reportCalculation(nextCalendar,events,report,[]).hours})).filter(c=>!sameReportHours(c.before,c.after));
    const skipped=impacted.filter(report=>!canRecalculateReport(report)).map(report=>({id:report.id,lsx:report.lsxCode,reason:report.manualHours?'Giờ đã điều chỉnh thủ công':'Thiếu phân công chi tiết; giữ giờ nguồn để đối chiếu'}));
    const audit=[];
    for(let i=0;i<Math.max(1,changes.length);i+=20)audit.push({id:crypto.randomUUID(),kind:'hours-adjustment',sourceId:null,line,effectiveAt:`${week}T00:00:00+07:00`,recordedAt:now,actor:actor.login,reason:`Cập nhật lịch làm việc · tự tính lại giờ báo công · ${reason}`,scheduleKey:existing.key,scheduleVersion:record.version,changes:changes.slice(i,i+20),skipped:i===0?skipped:[]});
    await commit(db,actor,now,audit,null,null,[{entity:'production_schedule',key:existing.key,payload:record,expected:old?JSON.stringify(old):null}]);
    return { schedule: record, affected:changes.length, skipped };

  }
  if (action === "approve-hours") {
    const request = events.find((item) => item.id === body.requestId && item.kind === "absence" && item.approved === false && item.sourceId === order.id);
    if (!request || events.some((item) => item.approvedFrom === request.id)) fail("Yêu cầu điều chỉnh giờ đã được xử lý hoặc không tồn tại.", 409);
    const effective = { ...request, id: crypto.randomUUID(), approved: true, approvedFrom: request.id, recordedAt: now, actor: actor.login };
    const impacted = state.reports.filter((report) => report.kind === "completion" && report.transitId === order.id && ["Đã xác nhận", "Chờ kiểm tra"].includes(report.reviewStatus) &&
      Date.parse(report.startedAt) < Date.parse(request.endsAt) && Date.parse(report.completedAt) > Date.parse(request.effectiveAt));
    const revised = impacted.map((report) => {
      const history = [...events, effective];
      const hours = reportCalculation(calendar,history,report,[]).hours;
      return { before: report, after: { ...report, hours, hourStatus: "Đã duyệt điều chỉnh", hoursUpdatedBy: actor.login, hoursUpdatedAt: now } };
    });
    const history = { id: crypto.randomUUID(), kind: "hours-adjustment", sourceId: order.id, line: order.line, effectiveAt: request.effectiveAt, recordedAt: now, actor: actor.login, requestId: request.id,
      reason: "QLSX cập nhật biến động nhân lực sau thời điểm báo công", changes: revised.map(({ before, after }) => ({ reportId: before.id, before: before.hours ?? null, after: after.hours })) };
    await commit(db, actor, now, [effective, history]);
    return { event: history, affected: revised.length };
  }
  const effectiveAt = iso(body.effectiveAt, actor, action === "absence");
  if(action==="absence"&&(body.absenceType||"Nghỉ")!=="Phụ kho")assertHrAttendancePeriod(vnMoment(effectiveAt).date);
  const instant = clock(effectiveAt), runtime = currentState(events, order, instant), count = ["start", "transfer", "add", "reduce", "absence"].includes(action) ? number(body.count, "Số người") : 0;
  if (["start", "transfer", "add", "reduce", "pause", "resume"].includes(action) && state.reports.some((report) =>
    report.kind === "completion" && report.transitId === order.id && ["Đã xác nhận", "Chờ kiểm tra"].includes(report.reviewStatus) &&
    Date.parse(report.startedAt) < instant && Date.parse(report.completedAt) > instant))
    fail("Mốc hiệu lực giao kỳ báo công đã lưu; cần QLSX duyệt điều chỉnh giờ trước khi áp dụng biến động này.", 409);
  const pendingQuantity=state.reports.filter(r=>r.transitId===order.id&&r.kind==='completion'&&!r.cancelled&&!r.voided&&['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(r.reviewStatus)).reduce((n,r)=>n+Number(r.reportedQuantity||0),0);
  if(pendingQuantity>=Number(order.inTransitQty)&&pendingQuantity>0)fail("Cần xác nhận báo công hoàn thành trước khi tiếp tục.",409);
  if(action!=="start"&&historicalWorkContinuation(order,state.reports).blocked)fail("Cần xác nhận báo công lịch sử trước khi tiếp tục.",409);
  const employees = Array.isArray(body.employees) ? [...new Set(body.employees.map(upper))] : [];
  if (employees.length && employees.length !== count) fail("Số nhân viên chọn phải khớp số người.");
  if (employees.length) {
    const directory = new Map(state.employees.map((item) => [upper(item.id), item]));
    if (employees.some((employee) => !directory.has(employee))) fail("Nhân viên không có trong Danh sách nhân viên còn làm việc.");
    const assigned = peopleAt(events, order.id, instant);
    if (["transfer", "reduce", "absence"].includes(action) && (!assigned.known || employees.some((employee) => !assigned.people.includes(employee)))) fail("Chọn đúng nhân viên đang được phân cho LSX nguồn.");
  }
  if (["start", "transfer", "add", "reduce", "absence"].includes(action) &&
    state.employees.some((employee) => upper(employee.line) === upper(order.line)) && employees.length !== count)
    fail("Line có Danh sách nhân viên; chọn đủ nhân viên cụ thể cho biến động.");
  if (action === "add" && employees.some((employee) => state.orders.some((other) =>
    other.id !== order.id && !currentState(events, other, instant).completed && peopleAt(events, other.id, instant).people.includes(employee))))
    fail("Nhân viên đã thuộc LSX khác ở cùng thời điểm.", 409);
  if (["start", "add", "transfer"].includes(action) && employees.length) {
    const { date, minute } = vnMoment(effectiveAt), targetLine = action === "transfer" ? expectedOrder(state.orders, String(body.destinationId || "")).line : order.line;
    const actual = resolveSchedule(calendar, weekOf(date), targetLine), day = actual.days.find(row => row.date === date);
    if (!actual.approved) fail(`Line ${targetLine}: chưa có Capacity được KHSX đồng ý cho ngày ${date}.`, 409);
    const part = shiftAt(day, minute);
    if (!part) fail(`Ngày ${date} không thuộc giờ làm HC/TC thực tế của Line ${targetLine}.`, 409);
    const reference = { ...calendar.approved.get(`${weekOf(date)}:${targetLine}`), days: actual.days };
    const eligible = eligibleStaff({ reference, events, employees: state.employees, line: targetLine, date, at: minute, part });
    const selectable=[...eligible.allowed,...eligible.blocked.filter(person=>effectiveAttendance(events).some(e=>e.kind==="line-absence"&&e.absenceType==="Đi trễ"&&e.employees?.includes(upper(person.id))&&Date.parse(e.effectiveAt)<=instant&&Date.parse(e.endsAt)>instant))];
    if (employees.some(id => !selectable.some(person => upper(person.id) === id)))
      fail("Có nhân viên nghỉ, chưa được phân vào ca hoặc đang vắng trong ngày này; kiểm tra danh sách trước khi lưu.", 409);
  }
  const autoTransfers=[];
  if(action==="start"&&employees.length){
    for(const other of state.orders.filter(o=>o.id!==order.id&&!currentState(events,o,instant).completed)){
      const moving=peopleAt(events,other.id,instant).people.filter(id=>employees.includes(id));if(!moving.length)continue;
      if(!permitted(actor,other.line)||other.line!==order.line&&!canManage(actor))fail("Chỉ QLSX được chuyển nhân viên khác Line.",403);
      if(state.reports.some(r=>r.transitId===other.id&&r.kind==="completion"&&!r.cancelled&&r.reviewStatus!=="Cần điều chỉnh"&&Date.parse(r.completedAt)>instant))fail(`LSX ${other.lsxCode}: mốc nhập trạm ảnh hưởng báo công đã lưu.`,409);
      autoTransfers.push({id:crypto.randomUUID(),kind:"transfer",sourceId:other.id,destinationId:order.id,destinationIncludedInStart:true,orderAssignmentOnlyEmployees:moving.filter(id=>activeStaffMovement(events,id,instant)?.kind==='line-movement'),line:other.line,destinationLine:order.line,count:moving.length,employees:moving,employeeDetails:eventEmployees({employees:moving},state.employees),effectiveAt,recordedAt:now,actor:actor.login,reason:`Chuyển khi nhập trạm ${order.lsxCode}`,before:{source:peopleAt(events,other.id,instant).people.length},after:{source:peopleAt(events,other.id,instant).people.length-moving.length}});
    }
  }
  if(["start","transfer","add"].includes(action)&&employees.length&&events.some(e=>["start","transfer","add","reduce"].includes(e.kind)&&Date.parse(e.effectiveAt)>instant&&e.employees?.some(id=>employees.includes(id))))fail("Có phân công nhân viên sau mốc hiệu lực này; không thể ghi lùi gây chồng LSX.",409);
  if (action === "start") {
    const history=historicalWorkContinuation(order,state.reports);
    // Imported/approved dates describe past output, never an active staffing session.
    const liveEntry=events.some(e=>e.kind==='start'&&e.sourceId===order.id||e.kind==='transfer'&&e.destinationId===order.id);
    if(history.blocked)fail("Cần xác nhận báo công lịch sử trước khi nhập trạm phần còn lại.",409);
    if(runtime.known||order.actualStartedAt&&!(history.ready&&!liveEntry))fail("LSX đã nhập trạm.",409);
    if(history.ready&&(!Number.isFinite(Date.parse(history.lastCompletedAt))||instant<Date.parse(history.lastCompletedAt)))fail("Nhập trạm phần còn lại phải từ sau lần báo công lịch sử cuối cùng.",409);
  }
  if (["transfer", "reduce", "pause", "complete"].includes(action) && !runtime.running) fail("LSX nguồn chưa làm hoặc đang tạm ngưng.", 409);
  if (action === "incident" && body.stopWork && !runtime.running) fail("LSX nguồn đang tạm ngưng.", 409);
  if (action === "add" && !runtime.running) fail("Chỉ bổ sung người cho LSX đang làm.", 409);
  if (action === "resume" && !runtime.paused) fail("LSX không ở trạng thái tạm ngưng.", 409);
  if (["transfer", "reduce", "absence"].includes(action) && count > runtime.count) fail("Số người rời/nghỉ vượt người đang ở LSX nguồn.", 409);
  if (action === "transfer") {
    const destination = expectedOrder(state.orders, String(body.destinationId || ""));
    if (employees.length) {
      const {date,minute}=vnMoment(effectiveAt),source=resolveSchedule(calendar,weekOf(date),order.line);
      const reference={...calendar.approved.get(`${weekOf(date)}:${order.line}`),days:source.days};
      if (employees.some(id=>!isPresent(reference,events,id,order.line,date,minute,shiftAt(source.days.find(day=>day.date===date),minute)||'hc')))
        fail("Không thể chuyển nhân viên đang nghỉ hoặc không có mặt tại LSX nguồn.",409);
    }
    if (destination.id === order.id) fail("Chọn LSX đích khác nguồn.");
    if (state.reports.some((report) => report.kind === "completion" && report.transitId === destination.id &&
      ["Đã xác nhận", "Chờ kiểm tra"].includes(report.reviewStatus) && Date.parse(report.startedAt) < instant && Date.parse(report.completedAt) > instant))
      fail("Mốc chuyển giao kỳ báo công đã lưu tại LSX đích; cần QLSX duyệt điều chỉnh giờ trước.", 409);
    if ((!permitted(actor, destination.line) || destination.line !== order.line) && !canManage(actor)) fail("Chỉ QLSX được điều chuyển khác Line.", 403);
    const target = currentState(events, destination, instant);
    if (target.completed || target.paused || /Tạm ngưng/.test(destination.productionState || "")) fail("LSX đích đang tạm ngưng hoặc đã hoàn thành. Hãy tiếp tục lệnh trước khi chuyển.", 409);
    if (destination.actualStartedAt && !target.known) fail("LSX đích có dữ liệu lịch sử chưa đối chiếu phân công; không tự thay số người.", 409);
    if (state.employees.some((employee) => upper(employee.line) === upper(destination.line)) && employees.length !== count)
      fail("Phải chọn nhân viên cụ thể khi chuyển vào Line có danh sách nhân viên.");
    if (employees.length) {
      const assignedTarget = peopleAt(events, destination.id, instant);
      if (employees.some((employee) => assignedTarget.people.includes(employee))) fail("Nhân viên đã ở LSX đích.");
    }
    body.destinationLine = destination.line;
  }
  if (["pause", "incident", "absence"].includes(action) && !String(body.reason || "").trim()) fail("Cần nhập lý do hoặc nội dung sự cố.");
  let endsAt = null;
  if (action === "absence") {
    if (!["Nghỉ", "Đi trễ", "Về sớm", "Phụ kho", "Việc khác"].includes(body.absenceType || "Nghỉ")) fail("Loại biến động không hợp lệ.");
    endsAt = new Date(clock(body.endsAt)).toISOString();
    if (clock(endsAt) <= instant) fail("Thời gian kết thúc phải sau bắt đầu.");
    if (events.some((event) => event.kind === "absence" && event.sourceId === order.id && event.approved !== false &&
      clock(event.effectiveAt) < clock(endsAt) && clock(event.endsAt) > instant &&
      employees.length && event.employees?.some((employee) => employees.includes(employee))))
      fail("Nhân viên đã có biến động giao thời gian; kiểm tra để tránh trừ trùng.", 409);
  }
  let report = null, finalCompletion=false;
  if (action === "complete") {
    const qty = number(body.quantity, "Số lượng báo công");
    const pending = state.reports.filter((item) => item.transitId === order.id && item.kind === "completion" && item.reviewStatus === "Chờ kiểm tra").reduce((sum, item) => sum + Number(item.reportedQuantity || 0), 0);
    if (qty > Number(order.inTransitQty || 0) - pending) fail("Số lượng báo công vượt SL đang đi sau khi trừ báo công chờ duyệt.", 409);
    finalCompletion=qty+pending>=Number(order.inTransitQty||0);
    const previous = state.reports.filter((item) => item.transitId === order.id && item.kind === "completion" && !item.cancelled && item.reviewStatus!=="Cần điều chỉnh").map((item) => item.completedAt).filter(Boolean).sort().at(-1);
    const from = body.startedAt ? iso(body.startedAt, actor) : reportStart(order,state.reports,events);
    if (!from || clock(from) >= instant || previous && clock(from) < clock(previous)) fail("Khoảng báo công phải bắt đầu sau lượt trước và kết thúc sau khi bắt đầu.");
    const productionDate=String(body.productionDate||vnMoment(effectiveAt).date);
    if(!/^\d{4}-\d\d-\d\d$/.test(productionDate)||productionDate<vnMoment(from).date||productionDate>vnMoment(effectiveAt).date)fail("Ngày sản lượng phải nằm trong khoảng báo công.");
    const schedule = toScheduleMap(calendar, from, effectiveAt, order.line);
    const hours = runtime.staffingKnown ? hoursForOrder(events, schedule, order.id, from, effectiveAt, attendancePolicy(calendar, events, order.line)) : null;
    report = { id: crypto.randomUUID(), kind: "completion", transitId: order.id, planId: order.planId, lsxCode: order.lsxCode, sku: order.sku,
      name: order.name, spec: order.spec, line: order.line, lsxQty: order.lsxQty, reportedQuantity: qty,
      productionDate, startedAt: from, completedAt: effectiveAt, staffingIncomplete:!runtime.staffingKnown, hours, hourStatus: hours ? "Tạm tính" : "Chưa đủ phân công để tính giờ",
      reviewStatus: "Chờ kiểm tra", warehouseStatus: "Chưa tạo phiếu", reportedBy: actor.login, reportedAt: now,
      delayReason:String(body.delayReason||"").trim().slice(0,1000), sourceSnapshot:reportCalculation(calendar,events,{transitId:order.id,line:order.line,startedAt:from,completedAt:effectiveAt},[],true,true).sourceSnapshot,
      note: String(body.note || "").trim().slice(0, 1000) };
  }
  const event = { id: crypto.randomUUID(), requestIdempotency:requestId||undefined, kind: action, ...(action==='transfer'?{orderAssignmentOnlyEmployees:employees.filter(id=>activeStaffMovement(events,id,instant)?.kind==='line-movement')}:{}), finalCompletion, sourceId: order.id, destinationId: body.destinationId || null,
    line: order.line, destinationLine: body.destinationLine || null, count:action==="complete"?runtime.count:count, employees:action==="complete"?peopleAt(events,order.id,instant).people:employees, employeeDetails:eventEmployees({employees:action==="complete"?peopleAt(events,order.id,instant).people:employees},state.employees), effectiveAt, endsAt, recordedAt: now,
    actor: actor.login, reason: String(body.reason || "").trim(), absenceType: action === "absence" ? body.absenceType || "Nghỉ" : null, stopWork: action === "incident" && Boolean(body.stopWork),
    affectedQuantity: action === "incident" ? Math.max(0, Number(body.affectedQuantity || 0)) : null, reportId: report?.id || null,
    before: { source: runtime.count }, after: { source: finalCompletion?0:action === "transfer" || action === "reduce" ? runtime.count - count : action === "add" ? runtime.count + count : action === "start" ? count : runtime.count } };
  if (action === "absence") {
    event.approved = true;
  }
  await commit(db, actor, now, [event,...autoTransfers,...automaticHrAdjustments([event])], report, ["start", "pause", "resume"].includes(action) || action === "incident" && body.stopWork ? {
    id: event.id, kind: "state", transitId: order.id, lsxCode: order.lsxCode, sku: order.sku, line: order.line,
    productionState: action === "start" || action === "resume" ? "Đang sản xuất" : action === "incident" ? "Tạm ngưng sự cố" : "Tạm ngưng",
    eventAt: effectiveAt, actualStartedAt: action === "start" ? effectiveAt : order.actualStartedAt || "",
    reason: event.reason, operator: actor.login, reviewStatus: "Tự động ghi nhận",
  } : null);
  return { event, report };
}

async function commitEvents(db, actor, now, events, report = null, state = null, expectedCursor = null, extraRecords = []) {
  await assertLegacyAllocationWrite(db,events);
  const key = "global", initial = JSON.stringify({ version: 0, token: "" });
  await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('production_cursor',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(key, initial, actor.login, now).run();
  const cursor = await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key=?").bind(key).first();
  if(expectedCursor!==null&&cursor.payload!==expectedCursor)fail("Có thao tác SX đồng thời; tải lại trước khi ghi để tránh phân công trùng.",409);
  const token = crypto.randomUUID(), updated = JSON.stringify({ version: Number(JSON.parse(cursor.payload).version || 0) + 1, token });
  const guardedInsert = (entity, id, payload) => db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key=? AND payload=?)").bind(entity, id, JSON.stringify(payload), actor.login, now, key, updated);
  const extraConditions=extraRecords.map(r=>r.expected===null?"NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)":"EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)");
  const extraArgs=extraRecords.flatMap(r=>r.expected===null?[r.entity,r.key]:[r.entity,r.key,r.expected]);
  const writes = [db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key=? AND payload=?"+(extraConditions.length?' AND '+extraConditions.join(' AND '):'')).bind(updated, actor.login, now, key, cursor.payload,...extraArgs),
    ...events.map((event) => guardedInsert("production_event", event.id, {...event,actorId:productionActorId(actor)}))];
  for(const r of extraRecords)writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key=? AND payload=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(r.entity,r.key,JSON.stringify(r.payload),actor.login,now,key,updated));
  if (report) writes.push(guardedInsert("production_report", report.id, {...report,actorId:productionActorId(actor),reportedById:productionActorId(actor)}));
  if (state) writes.push(guardedInsert("production_report", state.id, {...state,actorId:productionActorId(actor)}));
  const results = await db.batch(writes);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) fail("Có thao tác đồng thời trên dữ liệu SX; tải lại rồi thử lại.", 409);
}

export async function recalculateProductionReport(db,events,report,directory=[]) {
 return reportCalculation(await schedules(db),events.filter(e=>!e.voided),report,directory,true,true);
}

export async function validateCorrectedAssignment(db,events,event,directory) {
 if(!['start','add','transfer'].includes(event.kind)||!event.employees?.length)return;
 const calendar=await schedules(db),targetLine=event.kind==='transfer'?event.destinationLine:event.line;
 const {date,minute}=vnMoment(event.effectiveAt),actual=resolveSchedule(calendar,weekOf(date),targetLine),day=actual.days.find(d=>d.date===date),part=shiftAt(day,minute);
 if(!actual.approved||!part)fail(`Line ${targetLine}: thời điểm điều chỉnh không thuộc lịch HC/TC được duyệt.`,409);
 const reference={...calendar.approved.get(`${weekOf(date)}:${targetLine}`),days:actual.days};
 const eligible=eligibleStaff({reference,events,employees:directory,line:targetLine,date,at:minute,part});
 const late=eligible.blocked.filter(p=>effectiveAttendance(events).some(e=>e.kind==='line-absence'&&e.absenceType==='Đi trễ'&&e.employees?.includes(p.id)&&Date.parse(e.effectiveAt)<=Date.parse(event.effectiveAt)&&Date.parse(e.endsAt)>Date.parse(event.effectiveAt)));
 if(event.employees.some(id=>![...eligible.allowed,...late].some(p=>p.id===id)))fail('Nhân viên điều chỉnh chưa thuộc ca hoặc đang nghỉ; kiểm tra lịch và danh sách nhân viên.',409);
}
