const hourTotals=({hc,ot,total})=>({hc,ot,total});
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { root, openDatabase, migrate, records } from "../scripts/local/database.mjs";
import { readProductionWorkflow, mutateProductionWorkflow } from "../scripts/local/production-workflow.mjs";
import { hoursForOrder } from "../lib/production-hours.mjs";
import { attendanceEdges, effectiveAttendance, eligibleStaff, isPresent } from "../lib/production-attendance.mjs";

test("Capacity forecast does not deduct hours; HR actual absence immediately adjusts saved reports", () => withDb(async db => {
  const days=approvedDays(),input={workers:3,dailySchedule:days,dailyRoster:days.map(day=>({date:day.date,hc:["NV01","NV02","NV03"],ot:[]})),
    dailyHcLeave:[{date:"2026-09-25",mode:"hours",start:"08:00",end:"12:00",employees:["NV02"]}],dailyOtLeave:[]};
  await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("capacity","2026-09-21",JSON.stringify({schemaVersion:1,rows:[{line:"A",status:"Đã xác nhận",reviewStatus:"approved",version:1,input}]}),"TEST","2026-09-20").run();
  for(const id of ["NV01","NV02","NV03"]) await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("employees",id,JSON.stringify({id,name:id,line:"A",active:true}),"TEST","2026-09-20").run();
  const order=makeOrder("A","A");await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit",order.id,JSON.stringify(order),"TEST","2026-09-20").run();
  const other=makeOrder("B","A");await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit",other.id,JSON.stringify(other),"TEST","2026-09-20").run();
  await mutateProductionWorkflow(db,{action:"start",orderId:"A",count:2,employees:["NV01","NV02"],effectiveAt:"2026-09-24T01:00:00Z"},manager);
  const savedStart=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND json_extract(payload,'$.kind')='start' AND json_extract(payload,'$.sourceId')='A'").first()).payload);
  assert.deepEqual(savedStart.employeeDetails,[{id:"NV01",name:"NV01"},{id:"NV02",name:"NV02"}]);
  await mutateProductionWorkflow(db,{action:"start",orderId:"B",count:1,employees:["NV03"],effectiveAt:"2026-09-24T01:00:00Z"},manager);
  const completion=await mutateProductionWorkflow(db,{action:"complete",orderId:"A",quantity:10,startedAt:"2026-09-25T01:00:00Z",effectiveAt:"2026-09-25T05:00:00Z",note:"Sản lượng ca sáng"},manager);
  const otherCompletion=await mutateProductionWorkflow(db,{action:"complete",orderId:"B",quantity:10,startedAt:"2026-09-25T01:00:00Z",effectiveAt:"2026-09-25T05:00:00Z"},manager);
  const fullReview=await readProductionWorkflow(db,manager);
  const focusedReview=await readProductionWorkflow(db,manager,[],{reviewReportId:completion.report.id});
  assert.deepEqual(focusedReview.reports.find(r=>r.id===completion.report.id),fullReview.reports.find(r=>r.id===completion.report.id),'focused confirmation preserves all derived target report fields');
  assert.deepEqual(focusedReview.progressOrders,fullReview.progressOrders);
  assert.deepEqual(focusedReview.approvedSchedules,fullReview.approvedSchedules);
  assert.ok(completion.report.hours.perEmployee.find(person=>person.id==="NV02")?.hc>0,"Capacity planned leave is forecast, not actual absence");
  const hr={login:"hr-forecast@test",grants:["Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt"]};
  assert.equal(completion.report.hours.perEmployee.find(person=>person.id==="NV02").hc,
    completion.report.hours.perEmployee.find(person=>person.id==="NV01").hc,"Forecast leave must not deduct actual hours");
  const late=await mutateProductionWorkflow(db,{action:"line-absence",line:"A",absenceType:"Đi trễ",employees:["NV01"],effectiveAt:"2026-09-25T02:00:00Z",endsAt:"2026-09-25T03:00:00Z"},hr);
  assert.equal(late.event.approved,true);assert.equal(late.pendingHours,false);
  const report=(await readProductionWorkflow(db,manager)).reports.find(item=>item.id===completion.report.id);
  assertClose(completion.report.hours.perEmployee.find(person=>person.id==="NV01").hc-report.hours.perEmployee.find(person=>person.id==="NV01").hc,1,"Actual HR late arrival deducts exactly one HC hour");
  assert.ok(report.hours.perEmployee.find(person=>person.id==="NV02")?.hc>0);
  assert.equal(report.note,"Sản lượng ca sáng");
  assert.equal(report.reportedQuantity,10);
  assert.ok(report.laborNotes.find(note=>note.type==="Đi trễ")?.text.includes("NV01"));
  assert.ok(report.laborNotes.some(note=>note.type==="Đi trễ"));
  assert.deepEqual((await readProductionWorkflow(db,manager)).reports.find(item=>item.id===otherCompletion.report.id).laborNotes,[]);
}));

test("HR multi-day leave skips days off, applies immediately and rejects duplicate atomically", () => withDb(async db => {
  await approveCapacity(db);
  for(const id of ["NV01","NV02"])await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("employees",id,JSON.stringify({id,name:id,line:"A",active:true}),"TEST","2026-09-20").run();
  const order=makeOrder("A","A");await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit",order.id,JSON.stringify(order),"TEST","2026-09-20").run();
  await mutateProductionWorkflow(db,{action:"start",orderId:"A",count:1,employees:["NV01"],effectiveAt:"2026-09-24T01:00:00Z"},manager);
  const report=(await mutateProductionWorkflow(db,{action:"complete",orderId:"A",quantity:10,startedAt:"2026-09-25T01:00:00Z",effectiveAt:"2026-09-26T05:00:00Z"},manager)).report;
  const leave=await mutateProductionWorkflow(db,{action:"line-absence",line:"A",absenceType:"Nghỉ",employees:["NV01"],
    effectiveAt:"2026-09-25T01:00:00Z",endsAt:"2026-09-25T10:00:00Z",dateTo:"2026-09-27",reason:"Nghỉ hai ngày làm việc"},hrActual);
  assert.equal(leave.recordedDays,2);assert.equal(leave.events.length,2);assert.equal(leave.pendingHours,false);assert.ok(leave.events.every(event=>event.approved));
  assert.deepEqual(leave.events.map(item=>item.effectiveAt.slice(0,10)),["2026-09-25","2026-09-26"]);
  const before=(await readProductionWorkflow(db,manager)).reports.find(item=>item.id===report.id);
  assertClose(report.hours.hc,11.5,"Friday and Saturday baseline");
  assert.equal(before.hours.hc,0,"HR leave must recalculate both reported days immediately");
  const eventsBefore=(await readProductionWorkflow(db,manager)).events;
  const rowsBefore=await records(db);
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:"line-absence",line:"A",absenceType:"Nghỉ",employees:["NV01"],
    effectiveAt:"2026-09-25T01:00:00Z",endsAt:"2026-09-25T10:00:00Z",dateTo:"2026-09-27",reason:"Trùng"},hrActual),{status:409});
  assert.deepEqual(await records(db),rowsBefore,"Duplicate must leave all app_records, including the cursor, unchanged");
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:"line-absence",line:"A",absenceType:"Nghỉ",employees:["NV01"],
    effectiveAt:"2026-09-24T01:00:00Z",endsAt:"2026-09-24T10:00:00Z",dateTo:"2026-09-25",reason:"Ngày sau bị trùng"},hrActual),error=>{
      assert.equal(error.status,409);assert.ok(error.message.includes(leave.events[0].id),"The rejected overlap is on the second requested day");return true;
    });
  assert.deepEqual(await records(db),rowsBefore,"A collision on the second day must not save the valid first day");
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:"line-absence",line:"A",absenceType:"Nghỉ",employees:["NV02"],
    effectiveAt:"2026-09-26T01:00:00Z",endsAt:"2026-09-26T10:00:00Z",dateTo:"2026-09-28",reason:"Tuần sau chưa duyệt"},hrActual),error=>{
      assert.equal(error.status,409);assert.match(error.message,/2026-09-28.*Capacity/);return true;
    });
  assert.deepEqual(await records(db),rowsBefore,"A later unapproved Capacity week must not save the earlier valid day");
  const after=await readProductionWorkflow(db,manager),updated=after.reports.find(item=>item.id===report.id);
  assert.deepEqual(after.events,eventsBefore,"Duplicate must not write events");
  assert.equal(updated.hours.hc,before.hours.hc,"Duplicate must not alter hours");
  const audits=after.events.filter(item=>item.kind==="hours-adjustment");
  assert.equal(audits.length,1,"A multi-day command has one atomic hours audit");
  assert.equal(audits[0].actor,hrActual.login);assert.equal(audits[0].actorId,hrActual.userId);
  assert.deepEqual(audits[0].requestIds,leave.events.map(event=>event.id));
  assert.deepEqual(audits[0].changes.map(change=>change.reportId),[report.id]);
  assertClose(audits[0].changes[0].before.hc,11.5,"Audit keeps original hours");
  assert.equal(audits[0].changes[0].after.hc,0);
  assert.equal(updated.reportedQuantity,10);
}));

const manager = { login: "manager@test", isAdmin: true, line: null };
const worker = { login: "line-a@test", isAdmin: false, line: "A", grants: ["Quản lý sản xuất / Thêm", "Quản lý sản xuất / Xem"] };
const hrActual = { login: "hr.actual@example.test", userId: "SYNTHETIC-HR-ID", isAdmin: false, line: null,
  grants: ["Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt"] };
const assertClose = (actual, expected, message) => assert.ok(Math.abs(actual-expected)<0.00011,`${message}: expected ${expected}, got ${actual}`);
// Business fixtures use a fixed HR entry date so month-close tests never age out.
async function withDb(fn,now='2026-10-10T16:59:59.999Z') {
  const originalNow=Date.now;Date.now=()=>Date.parse(now);
  mkdirSync(resolve(root, ".local-data/tests"), { recursive: true });
  const connection = await openDatabase(mkdtempSync(resolve(root, ".local-data/tests/production-")));
  try { await migrate(connection.db); await fn(connection.db); } finally { Date.now=originalNow;await connection.close(); }
}
const makeOrder = (id, line) => ({ id, planId: `PLAN-${id}`, week: "2026-09-21", sku: `SKU-${id}`, line,
  lsxCode: `LSX-${id}`, lsxQty: 2000, lsxOpenedAt: "2026-09-21", planStart: "2026-09-21", planEnd: "2026-09-26", syncStatus: "ĐÃ ĐỒNG BỘ" });
const approvedDays = (ot = false) => Array.from({ length: 7 }, (_, index) => {
  const date = new Date("2026-09-21T00:00:00Z"); date.setUTCDate(date.getUTCDate() + index);
  return { date: date.toISOString().slice(0,10), working: index < 6, ot, hcStart:"08:00",hcEnd:"17:00",lunchStart:"12:00",lunchEnd:"13:00",breaks:[{start:"10:00",end:"10:10"},{start:"15:00",end:"15:10"}],cleaning:[],otStart:"17:30",otEnd:"21:00" };
});
async function approveCapacity(db, days = approvedDays(), version = 1) {
  const payload = { schemaVersion:1, week:"2026-09-21", rows:[{line:"A", status:"Đã xác nhận",reviewStatus:"approved",version,input:{workers:2,dailySchedule:days}}] };
  await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('capacity',?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload").bind("2026-09-21",JSON.stringify(payload),"TEST","2026-09-20").run();
}
test("work starts with actual workforce and a transfer moves four people to an unopened order atomically", () => withDb(async (db) => {
  for (const row of [makeOrder("A", "A"), makeOrder("B", "B")])
    await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit", row.id, JSON.stringify(row), "TEST", "2026-09-20").run();
  const start = await mutateProductionWorkflow(db, { action: "start", orderId: "A", count: 10, effectiveAt: "2026-09-25T01:00:00.000Z" }, manager);
  assert.equal(start.event.count, 10);
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 4, effectiveAt: "2026-09-25T03:00:00.000Z" }, worker), { status: 403 });
  const moved = await mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 4, effectiveAt: "2026-09-25T03:00:00.000Z" }, manager);
  assert.equal(moved.event.destinationLine, "B");
  const data = await readProductionWorkflow(db, manager);
  assert.equal(data.events.length, 2);
  const day = { "2026-09-25": { working: true, ot: false, hcStart: 480, hcEnd: 1020, lunchStart: 720, lunchEnd: 780,
    breakMorningStart: 600, breakMorningEnd: 610, breakAfternoonStart: 900, breakAfternoonEnd: 910 } };
  assert.deepEqual(hourTotals(hoursForOrder(data.events, day, "A", "2026-09-25T01:00:00.000Z", "2026-09-25T04:00:00.000Z")), { hc: 25, ot: 0, total: 25 });
  assert.deepEqual(hourTotals(hoursForOrder(data.events, day, "B", "2026-09-25T03:00:00.000Z", "2026-09-25T04:00:00.000Z")), { hc: 3.3333, ot: 0, total: 3.3333 });
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 7, effectiveAt: "2026-09-25T04:01:00.000Z" }, manager), /vượt người/);
}));

test("named workers cannot be assigned twice and an approved late absence leaves the original report immutable", () => withDb(async (db) => {
  await approveCapacity(db);
  for (const row of [makeOrder("A", "A"), makeOrder("B", "A")])
    await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit", row.id, JSON.stringify(row), "TEST", "2026-09-20").run();
  for (const id of ["NV01", "NV02"])
    await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("employees", id, JSON.stringify({ id, name: id, line: "A", active: true }), "TEST", "2026-09-20").run();
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "start", orderId: "A", count: 2, effectiveAt: "2026-09-25T01:00:00Z" }, manager), /chọn đủ nhân viên/);
  await mutateProductionWorkflow(db, { action: "start", orderId: "A", count: 2, employees: ["NV01", "NV02"], effectiveAt: "2026-09-25T01:00:00Z" }, manager);
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "add", orderId: "B", count: 1, employees: ["NV02"], effectiveAt: "2026-09-25T01:01:00Z" }, manager), /đã thuộc LSX/);
  const completed = await mutateProductionWorkflow(db, { action: "complete", orderId: "A", quantity: 10, effectiveAt: "2026-09-25T03:00:00Z" }, manager);
  const report = completed.report;
  assert.ok(report.hours && report.hours.hc > 0);
  assert.equal(report.hours.perEmployee.length, 2);
  assert.equal(Math.round(report.hours.perEmployee.reduce((total, person) => total + person.hc, 0) * 100), Math.round(report.hours.hc * 100));
  const approved = { ...report, reviewStatus: "Đã xác nhận", approvedQuantity: 10 };
  await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(approved), report.id).run();
  const requested = await mutateProductionWorkflow(db, { action: "absence", orderId: "A", count: 1, employees: ["NV01"], effectiveAt: "2026-09-25T01:30:00Z", endsAt: "2026-09-25T02:30:00Z", reason: "Đi trễ thực tế" }, manager);
  assert.equal(requested.event.approved, true);
  assert.ok((await readProductionWorkflow(db, manager)).reports.find(r => r.id === report.id).hours.hc < report.hours.hc);
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "approve-hours", orderId: "A", requestId: requested.event.id }, manager), {status:409});
  const persisted = await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first();
  assert.deepEqual(JSON.parse(persisted.payload).hours, report.hours);
  const visible = (await readProductionWorkflow(db, manager)).reports.find(r => r.id === report.id);
  assert.ok(visible.hours.hc < report.hours.hc);
  assert.equal(visible.hours.perEmployee.find(person => person.id === "NV02").hc, report.hours.perEmployee.find(person => person.id === "NV02").hc);
  assert.equal(visible.reportedQuantity, 10);
  assert.equal(visible.hourStatus, "Đã duyệt điều chỉnh");
}));

test("actual schedule begins only after KHSX approval and preserves actual exceptions across later approvals", () => withDb(async db => {
  const week="2026-09-21", days=approvedDays();
  await assert.rejects(() => mutateProductionWorkflow(db,{action:"schedule",week,line:"A",version:0,approvedVersion:1,days,reason:"Thay đổi ca"},manager),/Chờ KHSX/);
  await approveCapacity(db, days);
  let state=await readProductionWorkflow(db,manager);
  assert.equal(state.approvedSchedules[0].days[2].working,true);
  const changed=structuredClone(days);changed[2].ot=true;
  await mutateProductionWorkflow(db,{action:"schedule",week,line:"A",version:0,approvedVersion:1,days:changed,reason:"Tăng ca phát sinh"},manager);
  const revised=structuredClone(days);revised[1].ot=true;
  await approveCapacity(db,revised,2);
  state=await readProductionWorkflow(db,manager);
  assert.equal(state.approvedSchedules[0].days[1].ot,true);
  assert.equal(state.approvedSchedules[0].days[2].ot,true);
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:"schedule",week,line:"A",version:1,approvedVersion:1,days:state.approvedSchedules[0].days,reason:"Sửa"},manager),/phiên bản Capacity mới/);
  const saved=await db.prepare("SELECT payload FROM app_records WHERE entity='production_schedule' AND record_key=?").bind(`${week}:A`).first();
  assert.equal(JSON.parse(saved.payload).history.length,1);
  const waiting={schemaVersion:1,week,rows:[{line:"A",status:"Nháp",reviewStatus:"adjusting",version:3,input:{workers:2,dailySchedule:approvedDays()},history:[
    {action:"review",decision:"approve",request:{kind:"capacity"},version:2,at:"2026-09-20T01:00:00Z",after:{workers:2,dailySchedule:revised}}]}]};
  await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity' AND record_key=?").bind(JSON.stringify(waiting),week).run();
  state=await readProductionWorkflow(db,manager);
  assert.equal(state.approvedSchedules[0].version,2);
  assert.equal(state.approvedSchedules[0].days[1].ot,true);
  assert.equal(state.approvedSchedules[0].days[2].ot,true);
}));

test("cleaning groups deduct their participants, not the whole work order", () => {
  const events = [{ kind: "start", sourceId: "A", count: 10, effectiveAt: "2026-09-25T09:00:00Z", recordedAt: "2026-09-25T09:00:00Z" }];
  const day = { "2026-09-25": { working: true, hcStart: 480, hcEnd: 1020, lunchStart: 720, lunchEnd: 780,
    breakMorningStart: 600, breakMorningEnd: 610, breakAfternoonStart: 900, breakAfternoonEnd: 910,
    cleaning: [{ people: 5, start: 960, end: 1020 }, { people: 4, start: 990, end: 1020 }] } };
  assert.deepEqual(hourTotals(hoursForOrder(events, day, "A", "2026-09-25T09:00:00Z", "2026-09-25T10:00:00Z")), { hc: 3, ot: 0, total: 3 });
});

test("a named worker absent on the next day is excluded from an ongoing order and from a new start", () => withDb(async db => {
  const people=Array.from({length:10},(_,i)=>`NV${String(i+1).padStart(2,'0')}`);
  const days=approvedDays();days[5].working=true;
  const input={workers:10,dailySchedule:days,dailyRoster:days.map(day=>({date:day.date,hc:day.working?[...people]:[],ot:[]})),
    dailyHcLeave:[{date:'2026-09-26',to:'2026-09-26',mode:'full',people:1,employees:['NV10']}],dailyOtLeave:[]};
  const record={schemaVersion:1,week:'2026-09-21',rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input}]};
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-09-21',JSON.stringify(record),'TEST','2026-09-20').run();
  for(const id of people)await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({id,name:id,line:'A',active:true}),'TEST','2026-09-20').run();
  const order=makeOrder('A','A');await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',order.id,JSON.stringify(order),'TEST','2026-09-20').run();
  const state=await readProductionWorkflow(db,manager),reference=state.approvedSchedules[0];
  const friday=eligibleStaff({reference,events:[],employees:state.employees,line:'A',date:'2026-09-25',at:480});
  const saturday=eligibleStaff({reference,events:[],employees:state.employees,line:'A',date:'2026-09-26',at:480});
  assert.equal(friday.free.length,10);assert.equal(saturday.free.length,10);
  assert.equal(saturday.free.some(person=>person.id==='NV10'),true);
  const hr={login:'hr-actual@test',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
  const absent=await mutateProductionWorkflow(db,{action:'line-absence',line:'A',absenceType:'Nghỉ',employees:['NV10'],effectiveAt:'2026-09-26T01:00:00Z',endsAt:'2026-09-26T09:00:00Z'},hr);
  assert.equal(absent.event.approved,true);
  const actualState=await readProductionWorkflow(db,manager);
  const actualSaturday=eligibleStaff({reference:actualState.approvedSchedules[0],events:actualState.events,employees:actualState.employees,line:'A',date:'2026-09-26',at:480});
  assert.equal(actualSaturday.free.length,9);assert.equal(actualSaturday.free.some(person=>person.id==='NV10'),false);
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:'start',orderId:'A',count:10,employees:people,effectiveAt:'2026-09-26T01:00:00Z'},manager),/nghỉ|vắng/);
  const started=await mutateProductionWorkflow(db,{action:'start',orderId:'A',count:10,employees:people,effectiveAt:'2026-09-25T01:00:00Z'},manager);
  assert.equal(started.event.count,10);
  const completed=await mutateProductionWorkflow(db,{action:'complete',orderId:'A',quantity:10,effectiveAt:'2026-09-26T09:00:00Z'},manager);
  const byId=new Map(completed.report.hours.perEmployee.map(person=>[person.id,person.hc]));
  assert.ok(byId.get('NV10')>0);
  assert.ok(byId.get('NV10')<byId.get('NV09'));
  assertClose(byId.get('NV10'),7+2/3,'Absent worker keeps Friday HC only');
  assertClose(byId.get('NV09'),14+1/3,'Present worker keeps both reported days');
  assert.ok(Math.abs(completed.report.hours.hc-[...byId.values()].reduce((sum,hours)=>sum+hours,0))<0.001);
}));

test("26/09 order keeps its people on a newly opened 27/09 shift, except the employee who registered leave", () => withDb(async db => {
  const people=Array.from({length:10},(_,i)=>`NV${i+1}`),days=approvedDays();
  const input={workers:10,dailySchedule:days,dailyRoster:days.map(day=>({date:day.date,hc:day.working?[...people]:[],ot:[]})),dailyHcLeave:[],dailyOtLeave:[]};
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-09-21',JSON.stringify({schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input}]}),'TEST','2026-09-20').run();
  for(const id of people)await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({id,name:id,line:'A',active:true}),'TEST','2026-09-20').run();
  const sunday=structuredClone(days);sunday[6].working=true;
  await mutateProductionWorkflow(db,{action:'schedule',week:'2026-09-21',line:'A',version:0,approvedVersion:1,days:sunday,reason:'Làm thêm Chủ nhật'},manager);
  const leave=await mutateProductionWorkflow(db,{action:'line-absence',line:'A',employees:['NV10'],effectiveAt:'2026-09-27T01:00:00Z',endsAt:'2026-09-27T10:00:00Z',reason:'Nghỉ một ngày'},manager);
  assert.equal(leave.event.sourceId,null);
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:'line-absence',line:'A',employees:['NV09'],effectiveAt:'2026-09-27T01:00:00Z',endsAt:'2026-09-27T10:00:00Z',reason:'Nghỉ'},worker),{status:403});
  await assert.rejects(()=>mutateProductionWorkflow(db,{action:'line-absence',line:'A',employees:['NV10'],effectiveAt:'2026-09-27T02:00:00Z',endsAt:'2026-09-27T09:00:00Z',reason:'Nghỉ trùng'},manager),{status:409});
  const state=await readProductionWorkflow(db,manager),reference=state.approvedSchedules[0];
  const candidates=eligibleStaff({reference,events:state.events,employees:state.employees,line:'A',date:'2026-09-27',at:480});
  assert.equal(candidates.free.length,9);
  assert.equal(candidates.free.some(person=>person.id==='NV10'),false);
  const assignment={kind:'start',sourceId:'A',count:10,employees:people,effectiveAt:'2026-09-26T01:00:00Z',recordedAt:'2026-09-26T01:00:00Z'};
  const schedule={'2026-09-27':{working:true,hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:600,breakMorningEnd:610,breakAfternoonStart:900,breakAfternoonEnd:910}};
  const policy={present:(id,date,minute,part)=>isPresent(reference,state.events,id,'A',date,minute,part),edges:date=>attendanceEdges(reference,date)};
  const hours=hoursForOrder([assignment],schedule,'A','2026-09-27T01:00:00Z','2026-09-27T10:00:00Z',policy);
  assert.equal(hours.hc,69);
  assert.equal(hours.perEmployee.some(person=>person.id==='NV10'),false);
}));

test("overtime follows the actual shift, paused destinations reject transfers, and concurrent changes keep one winner", () => withDb(async (db) => {
  for (const row of [makeOrder("A", "A"), makeOrder("B", "A")])
    await db.prepare("INSERT INTO app_records VALUES(?,?,?,?,?)").bind("in_transit", row.id, JSON.stringify(row), "TEST", "2026-09-20").run();
  await mutateProductionWorkflow(db, { action: "start", orderId: "A", count: 10, effectiveAt: "2026-09-25T01:00:00Z" }, manager);
  await mutateProductionWorkflow(db, { action: "start", orderId: "B", count: 2, effectiveAt: "2026-09-25T01:00:00Z" }, manager);
  await mutateProductionWorkflow(db, { action: "pause", orderId: "B", reason: "Thiếu vật tư", effectiveAt: "2026-09-25T09:00:00Z" }, manager);
  await assert.rejects(() => mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 4, effectiveAt: "2026-09-25T10:15:00Z" }, manager), /tạm ngưng/);
  await mutateProductionWorkflow(db, { action: "resume", orderId: "B", effectiveAt: "2026-09-25T09:01:00Z" }, manager);
  await mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 4, effectiveAt: "2026-09-25T10:15:00Z" }, manager);
  const result = await readProductionWorkflow(db, manager), schedule = { "2026-09-25": { working: true, ot: true, hcEnd: 1020, otStart: 1050, otEnd: 1260 } };
  assert.equal(hoursForOrder(result.events, schedule, "A", "2026-09-25T10:00:00Z", "2026-09-25T11:00:00Z").ot, 3);
  assert.equal(hoursForOrder(result.events, schedule, "B", "2026-09-25T10:00:00Z", "2026-09-25T11:00:00Z").ot, 3);
  assert.equal(hoursForOrder(result.events, { "2026-09-27": { working: false, ot: false } }, "A", "2026-09-27T01:00:00Z", "2026-09-27T04:00:00Z").total, 0);
  const attempts=await Promise.allSettled([1,2].map(() => mutateProductionWorkflow(db, { action: "transfer", orderId: "A", destinationId: "B", count: 4, effectiveAt: "2026-09-25T10:20:00Z" }, manager)));
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length, 1);
  const after=await readProductionWorkflow(db,manager);
  assert.equal(after.events.filter(e=>e.kind==="transfer").length,2);
}));

test("new station transfers selected people atomically, late attendance follows their actual order, and retry is idempotent",()=>withDb(async db=>{
 await approveCapacity(db);
 for(const row of [makeOrder('MOVE-A','A'),makeOrder('MOVE-B','A')])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',row.id,JSON.stringify(row),'TEST','fixture').run();
 const ids=Array.from({length:10},(_,i)=>`NV${String(i+1).padStart(2,'0')}`);
 for(const id of ids)await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({id,name:`Tên ${id}`,line:'A',active:true}),'TEST','fixture').run();
 const late=await mutateProductionWorkflow(db,{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['NV01'],effectiveAt:'2026-09-25T01:00:00Z',openArrival:true},manager);
 assert.equal(late.event.openArrival,true);
 await mutateProductionWorkflow(db,{action:'start',orderId:'MOVE-A',count:10,employees:ids,effectiveAt:'2026-09-25T01:00:00Z'},manager);
 let preview=await mutateProductionWorkflow(db,{action:'preview-report',orderId:'MOVE-A',effectiveAt:'2026-09-25T02:00:00Z'},manager);
 assert.equal(preview.hours.hc,9);assert.deepEqual(preview.unresolvedAttendance[0].employees,['NV01']);
 const moveBody={action:'start',orderId:'MOVE-B',count:4,employees:ids.slice(0,4),effectiveAt:'2026-09-25T03:00:00Z',requestIdempotency:'test-station-retry-0001'};
 await mutateProductionWorkflow(db,moveBody,manager);await mutateProductionWorkflow(db,moveBody,manager);
 const state=await readProductionWorkflow(db,manager),changes=state.events.filter(e=>e.kind==='transfer');
 assert.equal(changes.length,1);assert.deepEqual(changes[0].employees,ids.slice(0,4));assert.equal(changes[0].destinationIncludedInStart,true);
 const beforeConflict=await readProductionWorkflow(db,manager);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'line-absence',line:'A',absenceType:'Phụ kho',employees:['NV01'],effectiveAt:'2026-09-25T02:00:00Z',endsAt:'2026-09-25T04:00:00Z'},manager),error=>{
  assert.equal(error.status||error.statusCode,409);
  const timeLabel=value=>new Date(value).toISOString();
  const message=String(error.message);for(const required of ['Tên NV01','Đi trễ',late.event.id,timeLabel(late.event.effectiveAt),timeLabel(late.event.endsAt)])assert.ok(message.includes(required),`Thiếu ${required}: ${message}`);
  return true;
 });
 const afterConflict=await readProductionWorkflow(db,manager);
 assert.deepEqual(afterConflict.events,beforeConflict.events,'collision must not append an event');
 assert.deepEqual(afterConflict.reports,beforeConflict.reports,'collision must not change reports');
 await mutateProductionWorkflow(db,{action:'attendance-correction',attendanceId:late.event.id,endsAt:'2026-09-25T03:30:00Z'},manager);
 const a=await mutateProductionWorkflow(db,{action:'complete',orderId:'MOVE-A',quantity:20,effectiveAt:'2026-09-25T04:00:00Z'},manager);
 const b=await mutateProductionWorkflow(db,{action:'complete',orderId:'MOVE-B',quantity:30,effectiveAt:'2026-09-25T04:00:00Z'},manager);
 assert.equal(a.report.hours.hc,23);assert.equal(b.report.hours.hc,3);
 assert.equal((await readProductionWorkflow(db,manager)).reports.find(r=>r.id===b.report.id).unresolvedAttendance.length,0);
 assert.equal(a.report.sourceSnapshot.attendance.find(e=>e.id===late.event.id),undefined);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_event' AND record_key=?").bind(late.event.id).first()).n,1,'original absence remains immutable');
}));

// Approval is fixture state here. The supported approval endpoint is tested separately.
// This fixture represents an approved report and completed LSX, not a payroll-period lock.
async function approvedClosedHrFixture(db) {
  await approveCapacity(db,approvedDays(true));
  const order={...makeOrder('HR-CLOSED','A'),lsxQty:10};
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',order.id,JSON.stringify(order),'TEST','fixture').run();
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Nhân viên giả',line:'A',active:true}),'TEST','fixture').run();
  await mutateProductionWorkflow(db,{action:'start',orderId:order.id,count:1,employees:['NV01'],effectiveAt:'2026-09-25T01:00:00Z'},manager);
  const completed=await mutateProductionWorkflow(db,{action:'complete',orderId:order.id,quantity:10,effectiveAt:'2026-09-25T12:30:00Z',note:'Sản lượng đã chốt'},manager);
  assert.equal(completed.event.finalCompletion,true);
  const report=JSON.parse(JSON.stringify({...completed.report,reviewStatus:'Đã xác nhận',approvedQuantity:10}));
  await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(report),report.id).run();
  await db.prepare("UPDATE app_records SET payload=? WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify({...order,actualCompletedAt:report.completedAt,completedQty:10,inTransitQty:0,productionState:'Hoàn thành'}),order.id).run();
  const originalRows=await records(db);
  const assertState=async(hcDeduction,otDeduction,auditCount)=>{
    const state=await readProductionWorkflow(db,hrActual),visible=state.reports.find(item=>item.id===report.id);
    assert.equal(state.rights.hr,true);assert.equal(state.rights.manager,false);
    assertClose(visible.hours.hc,report.hours.hc-hcDeduction,'HC is recalculated from effective attendance, without double deduction');
    assertClose(visible.hours.ot,report.hours.ot-otDeduction,'TC is recalculated from effective attendance, without double deduction');
    assertClose(visible.hours.total,report.hours.total-hcDeduction-otDeduction,'Total hours');
    assert.equal(visible.hours.perEmployee.length,1);assert.equal(visible.hours.perEmployee[0].id,'NV01');
    for(const part of ['hc','ot','total'])assertClose(visible.hours.perEmployee[0][part],visible.hours[part],`Employee ${part} agrees with report`);
    assert.equal(visible.reportedQuantity,10);assert.equal(visible.approvedQuantity,10);
    assert.equal(visible.reviewStatus,'Đã xác nhận');assert.equal(visible.note,'Sản lượng đã chốt');
    assert.deepEqual(visible.sourceSnapshot,report.sourceSnapshot,'Original report source snapshot stays immutable');
    assert.deepEqual(visible.pendingAttendance,[]);assert.deepEqual(visible.unresolvedAttendance,[]);
    const closed=state.orders.find(item=>item.id===order.id);
    assert.equal(closed.completedQty,10);assert.equal(closed.inTransitQty,0);
    assert.equal(closed.actualCompletedAt,'2026-09-25');
    assert.equal(state.events.filter(event=>event.kind==='hours-adjustment').length,auditCount);
    const savedRows=await records(db);
    for(const original of originalRows.filter(row=>row.entity!=='production_cursor'))
      assert.deepEqual(savedRows.find(row=>row.entity===original.entity&&row.record_key===original.record_key),original,'Raw approved report, quantities, original events and fixture records must not be rewritten');
    return {state,visible};
  };
  assertClose(report.hours.hc,7+2/3,'Baseline HC excludes lunch and two breaks');
  assert.equal(report.hours.ot,2);assertClose(report.hours.total,9+2/3,'Baseline HC plus TC');
  await assertState(0,0,0);
  return {report,order,assertState};
}

function assertAppendOnlyEvents(before,after,newEventCount) {
  for(const row of before.filter(row=>row.entity!=='production_cursor'))
    assert.deepEqual(after.find(item=>item.entity===row.entity&&item.record_key===row.record_key),row,'Existing journal rows remain byte-for-byte unchanged');
  const known=new Set(before.map(row=>`${row.entity}:${row.record_key}`));
  const added=after.filter(row=>!known.has(`${row.entity}:${row.record_key}`));
  assert.equal(added.length,newEventCount);
  assert.ok(added.every(row=>row.entity==='production_event'),'Only new journal rows may be appended');
  const cursor=rows=>JSON.parse(rows.find(row=>row.entity==='production_cursor').payload).version;
  assert.equal(cursor(after),cursor(before)+1,'One accepted command advances the cursor once');
}

test('HR first entry and repeated edits immediately recalculate approved/completed HC and TC, preserving raw report and audit history',()=>withDb(async db=>{
  const fixture=await approvedClosedHrFixture(db);
  let previous=(await fixture.assertState(0,0,0)).visible,auditCount=0;
  const apply=async(body,hcDeduction,otDeduction,original=null)=>{
    const rowsBefore=await records(db);
    const result=await mutateProductionWorkflow(db,body,hrActual);
    assert.equal(result.event.approved,true);
    if(body.action==='attendance-edit')assert.equal(result.affected,1);
    else assert.equal(result.pendingHours,false,'HR entry/correction must not wait for QLSX');
    assert.equal(result.event.actor,hrActual.login);
    if(original){assert.equal(result.event.supersedes,original.id);assert.equal(result.event.before.id,original.id);assert.equal(result.event.before.endsAt,original.endsAt);}
    const {state,visible}=await fixture.assertState(hcDeduction,otDeduction,++auditCount);
    const audits=state.events.filter(event=>event.kind==='hours-adjustment'&&event.requestIds?.includes(result.event.id));
    assert.equal(audits.length,1,'Each accepted HR change has exactly one audit');
    const audit=audits[0];assert.equal(audit.actor,hrActual.login);assert.equal(audit.actorId,hrActual.userId);
    assert.deepEqual(audit.requestIds,[result.event.id]);assert.equal(audit.changes.length,1);
    assert.equal(audit.changes[0].reportId,fixture.report.id);
    assert.deepEqual(audit.changes[0].before,previous.hours,'Audit before is the latest visible hours, not stale raw hours');
    assert.deepEqual(audit.changes[0].after,visible.hours);
    const savedEvent=state.events.find(event=>event.id===result.event.id);
    assert.equal(savedEvent.actorId,hrActual.userId,'Saved event records internal HR ID separately from login');
    assert.equal(visible.hourStatus,'Đã duyệt điều chỉnh');
    assertAppendOnlyEvents(rowsBefore,await records(db),2);
    previous=visible;
    return result.event;
  };
  const late=await apply({action:'line-absence',line:'A',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T02:00:00Z'},1,0);
  const lateEdit=await apply({action:'attendance-correction',attendanceId:late.id,endsAt:'2026-09-25T03:00:00Z'},2,0,late);
  const lateRepeat=await apply({action:'attendance-correction',attendanceId:lateEdit.id,endsAt:'2026-09-25T02:30:00Z'},1.5,0,lateEdit);
  const early=await apply({action:'line-absence',line:'A',employees:['NV01'],absenceType:'Về sớm',effectiveAt:'2026-09-25T11:30:00Z',endsAt:'2026-09-25T12:30:00Z'},1.5,1);
  const earlyEdit=await apply({action:'attendance-edit',attendanceId:early.id,effectiveAt:'2026-09-25T12:00:00Z',endsAt:'2026-09-25T12:30:00Z',reason:'Sửa giờ về'},1.5,0.5,early);
  const earlyRepeat=await apply({action:'attendance-edit',attendanceId:earlyEdit.id,effectiveAt:'2026-09-25T11:00:00Z',endsAt:'2026-09-25T12:30:00Z',reason:'Sửa giờ về lần hai'},1.5,1.5,earlyEdit);
  const leave=await apply({action:'line-absence',line:'A',employees:['NV01'],absenceType:'Nghỉ',effectiveAt:'2026-09-25T06:00:00Z',endsAt:'2026-09-25T06:30:00Z'},2,1.5);
  const leaveEdit=await apply({action:'attendance-edit',attendanceId:leave.id,effectiveAt:'2026-09-25T06:00:00Z',endsAt:'2026-09-25T06:45:00Z',reason:'Sửa khoảng nghỉ'},2.25,1.5,leave);
  const leaveRepeat=await apply({action:'attendance-edit',attendanceId:leaveEdit.id,effectiveAt:'2026-09-25T06:00:00Z',endsAt:'2026-09-25T06:15:00Z',reason:'Sửa khoảng nghỉ lần hai'},1.75,1.5,leaveEdit);
  const {state,visible}=await fixture.assertState(1.75,1.5,9);
  assert.deepEqual(effectiveAttendance(state.events).filter(event=>event.kind==='line-absence').map(event=>event.id).sort(),[lateRepeat.id,earlyRepeat.id,leaveRepeat.id].sort(),'Only the latest absence revisions affect hours');
  assert.deepEqual(visible.laborNotes.map(note=>note.sourceEventId).sort(),[lateRepeat.id,earlyRepeat.id,leaveRepeat.id].sort());
  const rowsBeforeReload=await records(db);
  await fixture.assertState(1.75,1.5,9);
  assert.deepEqual(await records(db),rowsBeforeReload,'Reloading must not write another adjustment or deduct again');
}));

test('HR approved/completed changes reject unauthorized and stale writes, replay once, and accept one concurrent correction',()=>withDb(async db=>{
  const fixture=await approvedClosedHrFixture(db);
  const qlsx={login:'qlsx@example.test',isAdmin:false,line:null,grants:['Quản lý sản xuất / Lịch SX thực tế / Sửa']};
  const entry={action:'line-absence',line:'A',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T02:00:00Z',requestIdempotency:'hr-closed-entry-0001'};
  const rejectUnchanged=async(body,actor,status)=>{
    const before=await records(db);
    await assert.rejects(()=>mutateProductionWorkflow(db,body,actor),{status});
    assert.deepEqual(await records(db),before,'Denied, invalid or stale commands must leave app_records and cursor unchanged');
  };
  await rejectUnchanged(entry,qlsx,403);
  await rejectUnchanged(entry,worker,403);
  const first=await mutateProductionWorkflow(db,entry,hrActual);
  await fixture.assertState(1,0,1);
  const replayUnchanged=async(body,event)=>{
    const before=await records(db),replay=await mutateProductionWorkflow(db,body,hrActual);
    assert.equal(replay.replayed,true);assert.equal(replay.event.id,event.id);
    assert.deepEqual(await records(db),before,'Idempotency replay cannot append an absence, audit or cursor change');
  };
  await replayUnchanged(entry,first.event);
  await rejectUnchanged(entry,{...hrActual,login:'another.hr@example.test',userId:'OTHER-HR'},409);
  await rejectUnchanged({...entry,requestIdempotency:undefined},hrActual,409);
  const correction={action:'attendance-correction',attendanceId:first.event.id,endsAt:'2026-09-25T02:30:00Z',requestIdempotency:'hr-closed-correct-0001'};
  for(const body of [correction,
    {action:'attendance-edit',attendanceId:first.event.id,effectiveAt:entry.effectiveAt,endsAt:entry.endsAt,reason:'Không có quyền'},
    {action:'attendance-cancel',attendanceId:first.event.id,reason:'Không có quyền'}])await rejectUnchanged(body,qlsx,403);
  await rejectUnchanged({...correction,endsAt:entry.effectiveAt},hrActual,422);
  const corrected=await mutateProductionWorkflow(db,correction,hrActual);
  await fixture.assertState(1.5,0,2);
  await replayUnchanged(correction,corrected.event);
  await replayUnchanged(entry,first.event);
  for(const body of [
    {...correction,requestIdempotency:undefined},
    {action:'attendance-edit',attendanceId:first.event.id,effectiveAt:entry.effectiveAt,endsAt:entry.endsAt,reason:'Bản cũ'},
    {action:'attendance-cancel',attendanceId:first.event.id,reason:'Bản cũ'},
  ])await rejectUnchanged(body,hrActual,409);
  const beforeRace=await records(db),priorHours=(await fixture.assertState(1.5,0,2)).visible.hours;
  const commands=['2026-09-25T01:15:00Z','2026-09-25T01:45:00Z'].map((endsAt,index)=>({action:'attendance-correction',attendanceId:corrected.event.id,endsAt,requestIdempotency:`hr-closed-race-000${index}`}));
  const attempts=await Promise.allSettled(commands.map(body=>mutateProductionWorkflow(db,body,hrActual)));
  assert.equal(attempts.filter(attempt=>attempt.status==='fulfilled').length,1,'Exactly one concurrent HR correction may commit');
  const loser=attempts.find(attempt=>attempt.status==='rejected');assert.equal(loser.reason.status,409);
  const winnerIndex=attempts.findIndex(attempt=>attempt.status==='fulfilled'),winner=attempts[winnerIndex].value;
  assert.equal(winner.pendingHours,false);assert.equal(winner.event.supersedes,corrected.event.id);
  const deduction=(Date.parse(winner.event.endsAt)-Date.parse(entry.effectiveAt))/3600000;
  const {state,visible}=await fixture.assertState(deduction,0,3);
  assertAppendOnlyEvents(beforeRace,await records(db),2);
  const audit=state.events.find(event=>event.kind==='hours-adjustment'&&event.requestIds?.includes(winner.event.id));
  assert.ok(audit);assert.equal(audit.actorId,hrActual.userId);
  assert.deepEqual(audit.changes,[{reportId:fixture.report.id,before:priorHours,after:visible.hours}]);
  assert.deepEqual(effectiveAttendance(state.events).filter(event=>event.kind==='line-absence').map(event=>event.id),[winner.event.id]);
  await replayUnchanged(commands[winnerIndex],winner.event);
  await rejectUnchanged(commands[1-winnerIndex],hrActual,409);
  await fixture.assertState(deduction,0,3);
}));

test('final physical report releases staff immediately while keeping them in the report snapshot',()=>withDb(async db=>{
 await approveCapacity(db);
 for(const id of ['FINAL-A','FINAL-B'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',id,JSON.stringify({...makeOrder(id,'A'),lsxQty:10}),'TEST','fixture').run();
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Một',line:'A',active:true}),'TEST','fixture').run();
 await mutateProductionWorkflow(db,{action:'start',orderId:'FINAL-A',count:1,employees:['NV01'],effectiveAt:'2026-09-25T01:00:00Z'},manager);
 const done=await mutateProductionWorkflow(db,{action:'complete',orderId:'FINAL-A',quantity:10,effectiveAt:'2026-09-25T02:00:00Z'},manager);
 assert.equal(done.event.finalCompletion,true);assert.equal(done.report.hours.hc,1);assert.deepEqual(done.event.employees,['NV01']);
 const next=await mutateProductionWorkflow(db,{action:'start',orderId:'FINAL-B',count:1,employees:['NV01'],effectiveAt:'2026-09-25T02:00:00Z'},manager);
 assert.equal(next.event.count,1);assert.ok(done.report.sourceSnapshot.attendance.some(e=>e.kind==='start'&&e.employees.includes('NV01')));
}));

test('HR saves and corrects actual absence, retains actor, reloads; cannot change schedule, helper, or production',()=>withDb(async db=>{
 const hr={login:'TEST_USER_005',isAdmin:false,line:null,grants:['Quản lý sản xuất / Lịch SX thực tế / Xem','Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
 await approveCapacity(db);
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Nhân viên kiểm thử',line:'A',active:true}),'TEST','2026-09-20').run();
 const body={action:'line-absence',line:'A',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T02:00:00Z'};
 const saved=await mutateProductionWorkflow(db,body,hr);assert.equal(saved.event.actor,'TEST_USER_005');
 const corrected=await mutateProductionWorkflow(db,{action:'attendance-correction',attendanceId:saved.event.id,endsAt:'2026-09-25T01:30:00Z'},hr);assert.equal(corrected.event.supersedes,saved.event.id);
 const loaded=await readProductionWorkflow(db,hr);assert.equal(loaded.rights.hr,true);assert.equal(loaded.rights.manager,false);assert.ok(loaded.events.some(e=>e.id===corrected.event.id));
 for(const action of ['schedule','approve-hours','start','transfer'])await assert.rejects(()=>mutateProductionWorkflow(db,{action},hr),{status:403});
 await assert.rejects(()=>mutateProductionWorkflow(db,{...body,absenceType:'Phụ kho'},hr),{status:403});
}));

test('HR actual absence after reporting recalculates saved hours and audits the HR ID; QLSX cannot enter absence',()=>withDb(async db=>{
 const hr={login:'TEST_USER_005',isAdmin:false,line:null,grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
 const qlsx={login:'qlsx',isAdmin:false,line:null,grants:['Quản lý sản xuất / Lịch SX thực tế / Sửa']};
 await approveCapacity(db);
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Nhân viên kiểm thử',line:'A',active:true}),'TEST','fixture').run();
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit','HR-LATE',JSON.stringify({...makeOrder('HR-LATE','A'),lsxQty:10}),'TEST','fixture').run();
 await mutateProductionWorkflow(db,{action:'start',orderId:'HR-LATE',count:1,employees:['NV01'],effectiveAt:'2026-09-25T01:00:00Z'},manager);
 const reported=await mutateProductionWorkflow(db,{action:'complete',orderId:'HR-LATE',quantity:10,effectiveAt:'2026-09-25T03:00:00Z'},manager);
 assert.equal(reported.report.hours.total,2);
 const body={action:'line-absence',line:'A',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T02:00:00Z'};
 await assert.rejects(()=>mutateProductionWorkflow(db,body,qlsx),{status:403});
 const saved=await mutateProductionWorkflow(db,body,hr);assert.equal(saved.pendingHours,false);
 let loaded=await readProductionWorkflow(db,manager);
 assert.equal(loaded.reports.find(r=>r.id===reported.report.id).hours.total,1);
 const audit=loaded.events.find(e=>e.kind==='hours-adjustment'&&e.actor==='TEST_USER_005');
 assert.equal(audit.changes[0].before.total,2);assert.equal(audit.changes[0].after.total,1);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'attendance-correction',attendanceId:saved.event.id,endsAt:'2026-09-25T01:30:00Z'},qlsx),{status:403});
 await mutateProductionWorkflow(db,{action:'attendance-correction',attendanceId:saved.event.id,endsAt:'2026-09-25T01:30:00Z'},hr);
 loaded=await readProductionWorkflow(db,manager);assert.equal(loaded.reports.find(r=>r.id===reported.report.id).hours.total,1.5);
}));

test('actual labor: HR cancellation is durable, restores hours and rejects QLSX or duplicate cancellation',()=>withDb(async db=>{
 await approveCapacity(db);
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({name:'Employee',line:'A',active:true}),'TEST','fixture').run();
 const order=makeOrder('CANCEL','A');await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',order.id,JSON.stringify(order),'TEST','fixture').run();
 await mutateProductionWorkflow(db,{action:'start',orderId:order.id,count:1,employees:['NV01'],effectiveAt:'2026-09-25T01:00:00Z'},manager);
 const report=(await mutateProductionWorkflow(db,{action:'complete',orderId:order.id,quantity:1,effectiveAt:'2026-09-25T05:00:00Z'},manager)).report;
 const hr={login:'hr-test',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
 const leave=await mutateProductionWorkflow(db,{action:'line-absence',line:'A',employees:['NV01'],absenceType:'Đi trễ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T02:00:00Z'},hr);
 const command={action:'attendance-cancel',attendanceId:leave.event.id,reason:'Nhập sai'};
 await assert.rejects(()=>mutateProductionWorkflow(db,command,{login:'qlsx',grants:['Quản lý sản xuất / Sửa']}),{status:403});
 const cancelled=await mutateProductionWorkflow(db,command,hr);assert.equal(cancelled.event.before.id,leave.event.id);
 const state=await readProductionWorkflow(db,manager);
 assert.equal(state.reports.find(r=>r.id===report.id).hours.total,report.hours.total);
 assert.equal(state.events.find(e=>e.id===cancelled.event.id).actor,'hr-test');
 await assert.rejects(()=>mutateProductionWorkflow(db,command,hr),{status:409});
}));

test('actual labor: named C to B loan is bounded, cancellable and rejects overlapping loans',()=>withDb(async db=>{
 for(const id of ['C1','C2'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({name:id,line:'C',active:true}),'TEST','fixture').run();
 const body={action:'line-movement',line:'C',destinationLine:'B',employees:['C1','C2'],effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T05:00:00Z',reason:'Mượn 2 người'};
 const moved=await mutateProductionWorkflow(db,body,manager);
 await assert.rejects(()=>mutateProductionWorkflow(db,body,manager),{status:409});
 const reference={roster:[{date:'2026-09-25',hc:[],ot:[]}]};
 assert.equal(isPresent(reference,[moved.event],'C1','B','2026-09-25',540),true);
 assert.equal(isPresent(reference,[moved.event],'C1','B','2026-09-25',780),false);
 assert.equal(isPresent({roster:[{date:'2026-09-25',hc:['C1'],ot:[]}]},[moved.event],'C1','C','2026-09-25',540),false);
 const cancelled=await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:moved.event.id,reason:'Nhập sai'},manager);
 assert.equal(isPresent(reference,[moved.event,cancelled.event],'C1','B','2026-09-25',540),false);
}));

test('actual labor: edit absence date, people and kind; cancel revised record without reviving original',()=>withDb(async db=>{
 await approveCapacity(db);for(const id of ['NV01','NV02'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({name:id,line:'A',active:true}),'TEST','fixture').run();
 const original=(await mutateProductionWorkflow(db,{action:'line-absence',line:'A',employees:['NV01'],absenceType:'Nghỉ',effectiveAt:'2026-09-25T01:00:00Z',endsAt:'2026-09-25T03:00:00Z'},manager)).event;
 const edited=(await mutateProductionWorkflow(db,{action:'attendance-edit',attendanceId:original.id,line:'A',employees:['NV02'],absenceType:'Phụ kho',effectiveAt:'2026-09-26T01:00:00Z',endsAt:'2026-09-26T02:00:00Z',reason:'Sửa người và loại nhập nhầm'},manager)).event;
 assert.equal(edited.before.id,original.id);assert.equal(edited.supersedes,original.id);assert.deepEqual(edited.employees,['NV02']);
 const cancelled=(await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:edited.id,reason:'Nhập nhầm'},manager)).event;
 const {effectiveAttendance}=await import('../lib/production-attendance.mjs');assert.equal(effectiveAttendance([original,edited,cancelled]).length,0);
}));
test('actual labor: permanent transfer remains effective next month and can be edited retroactively',()=>withDb(async db=>{
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({name:'Employee',line:'B',active:true}),'TEST','fixture').run();
 const moved=(await mutateProductionWorkflow(db,{action:'line-movement',line:'A',destinationLine:'B',employees:['NV01'],effectiveAt:'2026-10-01T01:00:00Z',endsAt:null,reason:'Chuyển dài hạn'},manager)).event;
 assert.equal(moved.endsAt,null);assert.equal(isPresent({roster:[{date:'2026-11-02',hc:[],ot:[]}]},[moved],'NV01','B','2026-11-02',480),true);
 const edited=(await mutateProductionWorkflow(db,{action:'attendance-edit',attendanceId:moved.id,line:'A',destinationLine:'B',employees:['NV01'],effectiveAt:'2026-10-02T01:00:00Z',endsAt:null,reason:'Sửa ngày hiệu lực'},manager)).event;
 assert.equal(edited.supersedes,moved.id);assert.equal(edited.effectiveAt,'2026-10-02T01:00:00.000Z');
}));

test('chained borrowing API allows C to B to A, protects dependency and returns without directory writes',()=>withDb(async db=>{
 for(const id of ['C1','C2'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({name:id,line:'C',active:true}),'TEST','fixture').run();
 const command={action:'line-movement',line:'C',destinationLine:'B',employees:['C1','C2'],effectiveAt:'2026-10-16T01:00:00Z',endsAt:'2026-10-16T10:00:00Z',reason:'Mượn 2 người'};
 const parent=(await mutateProductionWorkflow(db,command,manager)).event;
 const childCommand={...command,line:'B',destinationLine:'A',employees:['C1'],effectiveAt:'2026-10-16T01:00:00Z',endsAt:'2026-10-16T05:00:00Z'};
 const child=(await mutateProductionWorkflow(db,childCommand,manager)).event;
 assert.deepEqual(child.parentMovementIds,[parent.id]);
 await assert.rejects(()=>mutateProductionWorkflow(db,childCommand,manager),{status:409});
 await assert.rejects(()=>mutateProductionWorkflow(db,{...childCommand,employees:['C2'],endsAt:'2026-10-16T11:00:00Z'},manager),{status:409});
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:parent.id,reason:'Hủy nguồn'},manager),error=>error.status===409&&error.message.includes('mượn tiếp'));
 await assert.rejects(()=>mutateProductionWorkflow(db,{...command,action:'attendance-edit',attendanceId:parent.id},manager),{status:409});
 let state=await readProductionWorkflow(db,manager);assert.deepEqual(state.employees.map(e=>e.line),['C','C']);
 assert.equal(isPresent({roster:[{date:'2026-10-16',hc:[],ot:[]}]},state.events,'C1','A','2026-10-16',540),true);
 assert.equal(isPresent({roster:[{date:'2026-10-16',hc:[],ot:[]}]},state.events,'C1','B','2026-10-16',540),false);
 await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:child.id,reason:'Hủy lượt sau'},manager);
 state=await readProductionWorkflow(db,manager);assert.equal(isPresent({roster:[{date:'2026-10-16',hc:[],ot:[]}]},state.events,'C1','B','2026-10-16',540),true);
 await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:parent.id,reason:'Hủy nguồn'},manager);
}));

test('starting an order during chained loan preserves noon and end-of-loan returns and caps order hours',()=>withDb(async db=>{
 const days=approvedDays(),payload={schemaVersion:1,week:'2026-09-21',rows:['A','B'].map(line=>({line,status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:0,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:[],ot:[]}))}}))};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-09-21',JSON.stringify(payload),'TEST','fixture').run();
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','C1',JSON.stringify({name:'C1',line:'C',active:true}),'TEST','fixture').run();
 for(const line of ['A','B'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',`JOB-${line}`,JSON.stringify(makeOrder(`JOB-${line}`,line)),'TEST','fixture').run();
 const at=h=>`2026-09-25T${h}:00+07:00`;
 await mutateProductionWorkflow(db,{action:'line-movement',line:'C',destinationLine:'B',employees:['C1'],effectiveAt:at('08:00'),endsAt:at('17:00'),reason:'Mượn vào B'},manager);
 await mutateProductionWorkflow(db,{action:'start',orderId:'JOB-B',count:1,employees:['C1'],effectiveAt:at('08:00')},manager);
 await mutateProductionWorkflow(db,{action:'line-movement',line:'B',destinationLine:'A',employees:['C1'],effectiveAt:at('09:00'),endsAt:at('12:00'),reason:'Mượn tiếp vào A'},manager);
 await mutateProductionWorkflow(db,{action:'start',orderId:'JOB-A',count:1,employees:['C1'],effectiveAt:at('10:00')},manager);
 const state=await readProductionWorkflow(db,manager),station=state.events.find(e=>e.kind==='transfer');assert.deepEqual(station.orderAssignmentOnlyEmployees,['C1']);
 const ref=line=>({roster:[{date:'2026-09-25',hc:line==='C'?['C1']:[],ot:[]}]});
 for(const [minute,owner] of [[660,'A'],[720,'B'],[1020,'C']])assert.deepEqual(['A','B','C'].filter(line=>isPresent(ref(line),state.events,'C1',line,'2026-09-25',minute)),[owner]);
 const report=await mutateProductionWorkflow(db,{action:'preview-report',orderId:'JOB-A',effectiveAt:at('17:00')},manager);
 assertClose(report.hours.total,1.8333,'A order hours stop at noon instead of extending the temporary loan');
}));

test('HR October 5 back-entry is accepted through November 10 GMT+7 and rejected starting November 11',async()=>{
 for(const [now,ok] of [['2026-11-10T16:59:59.999Z',true],['2026-11-10T17:00:00.000Z',false]])await withDb(async db=>{
  const days=approvedDays().map((day,index)=>({...day,date:`2026-10-${String(5+index).padStart(2,'0')}`}));
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-10-05',JSON.stringify({schemaVersion:1,week:'2026-10-05',rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:1,dailySchedule:days}}]}),'TEST','fixture').run();
  await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Nhân viên thử',line:'A',active:true}),'TEST','fixture').run();
  const command={action:'line-absence',line:'A',absenceType:'Nghỉ',employees:['NV01'],effectiveAt:'2026-10-05T01:00:00Z',endsAt:'2026-10-05T10:00:00Z'};
  if(ok){const result=await mutateProductionWorkflow(db,command,hrActual);assert.equal(result.events.length,1);assert.equal(result.events[0].effectiveAt,'2026-10-05T01:00:00.000Z');
   Date.now=()=>Date.parse('2026-11-10T17:00:00.000Z');
   for(const action of ['attendance-edit','attendance-cancel','attendance-correction'])await assert.rejects(mutateProductionWorkflow(db,{...command,action,attendanceId:result.event.id,reason:'Sửa bản thử'},hrActual),/hết hạn.*2026-10/);
   assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_event'").first()).n,1);
  }
  else{await assert.rejects(mutateProductionWorkflow(db,command,hrActual),/hết hạn.*2026-10/);assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_event'").first()).n,0);}
 },now);
});

test('personal HR accepts all native Lines including C without approved calendar or movement, isolates scope and keeps directory',()=>withDb(async db=>{
 for(const line of ['A','B','C'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',`PERSON-${line}`,JSON.stringify({name:`Person ${line}`,line,active:true,privatePayroll:'PRIVATE'}),'TEST','2026-09-20').run();
 const before=await records(db);const events=[];
 for(const line of ['A','B','C']){const result=await mutateProductionWorkflow(db,{action:'line-absence',attendanceScope:'employee',employees:[`PERSON-${line}`],absenceType:'Nghỉ',effectiveAt:'2026-09-27T01:00:00Z',endsAt:'2026-09-27T10:00:00Z',reason:`Private ${line}`,requestIdempotency:`PERSONAL-HR-${line}-SCOPE-0001`},hrActual);assert.equal(result.event.line,line);events.push(result.event);}
 const full=await readProductionWorkflow(db,hrActual);assert.equal(full.events.filter(e=>e.attendanceScope==='employee').length,3);assert.equal(full.reports.length,0);assert.equal(full.events.some(e=>e.kind==='line-movement'||e.kind==='start'),false);
 for(const line of ['A','B']){const scoped=await readProductionWorkflow(db,{...worker,line});const facts=scoped.events.filter(e=>e.attendanceScope==='employee');assert.equal(facts.length,1);assert.equal(facts[0].line,line);assert.equal(facts[0].hrScopeProjection,true);assert.equal(facts[0].reason,'HR · Nghỉ');assert.equal(facts[0].before,undefined);assert.equal(scoped.employees.some(p=>p.id==='PERSON-C'),false);}
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'line-absence',absenceType:'Nghỉ',requestIdempotency:'PERSONAL-HR-A-SCOPE-0001'},{...hrActual,line:'A'}),{status:403});
 const snapshot=await records(db);assert.deepEqual(snapshot.filter(r=>r.entity==='employees'),before.filter(r=>r.entity==='employees'));
 const forged={action:'line-absence',attendanceScope:'employee',employees:['PERSON-C'],absenceType:'Nghỉ',effectiveAt:'2026-09-26T01:00:00Z',endsAt:'2026-09-26T10:00:00Z'};
 for(const actor of [worker,{...hrActual,line:'A'}])await assert.rejects(()=>mutateProductionWorkflow(db,forged,actor),{status:403});
 for(const action of ['attendance-edit','attendance-cancel','attendance-correction'])await assert.rejects(()=>mutateProductionWorkflow(db,{action,attendanceId:events[0].id,reason:'forged',endsAt:'2026-09-27T02:00:00Z'},{...hrActual,line:'A'}),{status:403});
 assert.deepEqual(await records(db),snapshot,'forbidden requests cannot change cursor or rows');
}));

test('personal C HR adjusts only actually assigned A/B orders, per-Line audit, edit/cancel and idempotency',()=>withDb(async db=>{
 const insert=async(entity,id,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(payload),'TEST','2026-09-20').run();
 await approveCapacity(db);await insert('employees','PERSON-C',{name:'Borrowed C',line:'C',active:true});await insert('employees','UNUSED-C',{name:'Unused C',line:'C',active:true});
 const cap=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='capacity'").first()).payload);cap.rows.push({...cap.rows[0],line:'B'});await db.prepare("UPDATE app_records SET payload=? WHERE entity='capacity'").bind(JSON.stringify(cap)).run();
 for(const line of ['A','B'])await insert('in_transit',line,makeOrder(line,line));
 // Synthetic accepted movement and station events model C -> B -> A -> B -> C.
 const at=time=>`2026-09-25T${time}:00+07:00`;
 const loan={id:'loan',kind:'line-movement',line:'C',destinationLine:'B',employees:['PERSON-C'],effectiveAt:at('08:00'),endsAt:at('17:00'),approved:true};
 const onward={...loan,id:'onward',line:'B',destinationLine:'A',effectiveAt:at('09:00'),endsAt:at('12:00'),parentMovementIds:['loan']};
 for(const e of [loan,onward,{id:'station-b',kind:'start',sourceId:'B',line:'B',count:1,employees:['PERSON-C'],effectiveAt:at('08:00')},{id:'station-a',kind:'start',sourceId:'A',line:'A',count:1,employees:['PERSON-C'],effectiveAt:at('09:00')}])await insert('production_event',e.id,e);
 const reports=[];for(const line of ['A','B'])reports.push((await mutateProductionWorkflow(db,{action:'complete',orderId:line,quantity:1,startedAt:at('08:00'),effectiveAt:at('17:00')},manager)).report);
 const body={action:'line-absence',attendanceScope:'employee',employees:['PERSON-C'],absenceType:'Nghỉ',effectiveAt:at('07:00'),endsAt:at('18:00'),reason:'Private HR raw fact',requestIdempotency:'PERSONAL-HR-RETRY-00001'};
 const saved=await mutateProductionWorkflow(db,body,hrActual);const rowsAfterSave=await records(db);await mutateProductionWorkflow(db,body,hrActual);assert.deepEqual(await records(db),rowsAfterSave);
 let full=await readProductionWorkflow(db,manager);assert.ok(full.reports.every(r=>r.hours.total===0));
 for(const line of ['A','B']){const scoped=await readProductionWorkflow(db,{...worker,line});assert.equal(scoped.reports[0].hours.total,0);assert.ok(scoped.events.some(e=>e.kind==='hours-adjustment'&&e.line===line));const facts=scoped.events.filter(e=>e.hrScopeProjection);assert.equal(facts.length,line==='A'?1:2);assert.ok(facts.every(e=>e.reason==='HR · Nghỉ'&&e.before===undefined));assert.equal(new Set(scoped.employees.map(p=>p.id)).size,scoped.employees.length);assert.ok(scoped.employees.some(p=>p.id==='PERSON-C'));}
 await assert.rejects(()=>mutateProductionWorkflow(db,{...body,requestIdempotency:'PERSONAL-HR-OVERLAP-0001'},hrActual),{status:409});
 const edited=await mutateProductionWorkflow(db,{action:'attendance-edit',attendanceId:saved.event.id,employees:['PERSON-C'],absenceType:'Đi trễ',effectiveAt:at('08:00'),endsAt:at('09:00'),reason:'Correct raw fact'},hrActual);
 full=await readProductionWorkflow(db,manager);assertClose(full.reports.find(r=>r.line==='A').hours.total,reports.find(r=>r.line==='A').hours.total,'A outside absence stays unchanged');assertClose(reports.find(r=>r.line==='B').hours.total-full.reports.find(r=>r.line==='B').hours.total,1,'B only loses 08-09');
 await mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:edited.event.id,reason:'Cancel incorrect fact'},hrActual);
 full=await readProductionWorkflow(db,manager);for(const r of reports)assertClose(full.reports.find(x=>x.id===r.id).hours.total,r.hours.total,'cancel restores report');
 for(const line of ['A','B']){const scoped=await readProductionWorkflow(db,{...worker,line});assert.equal(scoped.events.some(e=>e.hrScopeProjection),false);assertClose(scoped.reports[0].hours.total,reports.find(r=>r.line===line).hours.total,'scoped override readback');}
}));

test('CV khác persists for manager, rejects HR and overlapping periods',()=>withDb(async db=>{const days=approvedDays(),input={workers:1,dailySchedule:days,dailyRoster:days.map(day=>({date:day.date,hc:['NV01'],ot:[]}))};await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-09-21',JSON.stringify({schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input}]}),'TEST','2026-09-20').run();await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({id:'NV01',name:'Trần Quốc Việt',line:'A',active:true}),'TEST','2026-09-20').run();const body={action:'line-absence',line:'A',absenceType:'CV khác',employees:['NV01'],effectiveAt:'2026-09-25T02:00:00Z',endsAt:'2026-09-25T03:00:00Z',reason:'Kiểm đếm vật tư'};await assert.rejects(()=>mutateProductionWorkflow(db,body,{login:'hr',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']}),/QLSX/);const r=await mutateProductionWorkflow(db,body,manager);assert.equal(r.event.absenceType,'CV khác');assert.equal(r.event.reason,'Kiểm đếm vật tư');await assert.rejects(()=>mutateProductionWorkflow(db,body,manager));}));


test("cancelled In transit orders remain visible with original plan quantity but cannot receive work", () => withDb(async db => {
 const a={...makeOrder('CANCEL-A','A'),planQty:3000,planningNote:'Ghi chú KHSX',cancelReason:'Dừng đơn hàng',syncStatus:'CÓ THAY ĐỔI'};
 const b={...makeOrder('CANCEL-B','B'),cancelReason:'Dừng đơn hàng',syncStatus:'CÓ THAY ĐỔI'};
 const unopened={...makeOrder('CANCEL-NO-LSX','A'),lsxCode:'',lsxOpenedAt:'',cancelReason:'Chưa mở nhưng đã hủy',syncStatus:'CHƯA ĐỒNG BỘ'};
 for(const order of [a,b,unopened])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',order.id,JSON.stringify(order),'TEST','2026-09-20').run();
 const result=await readProductionWorkflow(db,worker);
 assert.equal(result.orders.length,2);assert.ok(result.orders.some(o=>o.id===unopened.id));assert.equal(result.orders[0].status,'HỦY');
 assert.equal(result.orders[0].planQty,3000);assert.equal(result.orders[0].lsxQty,2000);
 assert.equal(result.progressOrders.find(o=>o.id===a.id).planningNote,'Ghi chú KHSX');
 const {productionWorkActions}=await import('../lib/production-work-actions.mjs');
 assert.deepEqual(productionWorkActions(result.orders[0],[],[],{}).allowed,[]);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'start',orderId:a.id,count:1,effectiveAt:'2026-09-25T01:00:00Z'},manager),/đủ điều kiện|hủy/);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'start',orderId:a.id,stageEntries:[{stage:'CUT',people:['N1']}],effectiveAt:'2026-09-25T01:00:00Z'},manager),/không còn được phép/);
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_event'").first()).n,0);
}));

test('Saturday actual cleaning can be added, changed and removed without changing approved planning',()=>withDb(async db=>{
 const week='2026-09-21',days=approvedDays();await approveCapacity(db,days);
 const changed=structuredClone(days);changed[5].working=true;changed[5].cleaning=[{people:1,start:'16:30',end:'17:00'}];
 const save=(value,version)=>mutateProductionWorkflow(db,{action:'schedule',week,line:'A',version,approvedVersion:1,days:value,reason:'Vệ sinh thứ Bảy thực tế'},manager);
 await save(changed,0);let state=await readProductionWorkflow(db,manager);
 assert.deepEqual(state.approvedSchedules[0].days[5].cleaning,changed[5].cleaning);
 const edited=structuredClone(changed);edited[5].cleaning[0].start='16:00';await save(edited,1);
 await assert.rejects(()=>save(changed,1),/Lịch vừa được sửa/);
 const removed=structuredClone(edited);removed[5].cleaning=[];await save(removed,2);
 state=await readProductionWorkflow(db,manager);assert.deepEqual(state.approvedSchedules[0].days[5].cleaning,[]);
 const record=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_schedule' AND record_key=?").bind(`${week}:A`).first()).payload);
 assert.equal(record.history.length,3);assert.deepEqual(record.reference.days[5].cleaning,[]);
}));

test('close permanent movement after onward loan and directory return without cancelling history',()=>withDb(async db=>{
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees','NV01',JSON.stringify({name:'Employee',line:'B',active:true}),'TEST','fixture').run();
 const command={action:'line-movement',line:'A',destinationLine:'B',employees:['NV01'],effectiveAt:'2026-10-01T01:00:00Z',endsAt:null,directoryAssignment:true,reason:'Permanent'};
 const parent=(await mutateProductionWorkflow(db,command,manager)).event;
 const child=(await mutateProductionWorkflow(db,{action:'line-movement',line:'B',destinationLine:'A',employees:['NV01'],effectiveAt:'2026-10-30T07:25:00Z',endsAt:'2026-10-31T10:00:00Z',reason:'Temporary'},manager)).event;
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='employees' AND record_key='NV01'").bind(JSON.stringify({name:'Employee',line:'A',active:true})).run();
 const close={...command,action:'attendance-edit',attendanceId:parent.id,endsAt:'2026-10-31T17:00:00Z',reason:'Return A'};
 await assert.rejects(()=>mutateProductionWorkflow(db,{...close,endsAt:'2026-10-31T09:00:00Z'},manager),e=>e.status===409&&e.message.includes('bao trọn'));
 const edited=(await mutateProductionWorkflow(db,close,manager)).event;
 assert.equal(edited.before.id,parent.id);assert.equal(edited.endsAt,close.endsAt.replace('Z','.000Z'));assert.deepEqual(edited.parentMovementIds,[]);
 const state=await readProductionWorkflow(db,manager),active=effectiveAttendance(state.events);
 assert.ok(active.some(e=>e.id===child.id));assert.ok(active.some(e=>e.id===edited.id));assert.ok(!active.some(e=>e.id===parent.id));
 assert.equal(isPresent({roster:[{date:'2026-10-30',hc:[],ot:[]}]},state.events,'NV01','A','2026-10-30',900),true);
 assert.equal(isPresent({roster:[{date:'2026-11-02',hc:[],ot:[]}]},state.events,'NV01','B','2026-11-02',480),false);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'attendance-cancel',attendanceId:edited.id,reason:'Cancel'},manager),e=>e.status===409);
}));
