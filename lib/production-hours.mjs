import {effectiveAttendance} from './production-attendance.mjs';
// Work order hours are measured in Vietnam civil time, independently of the
// browser's timezone. Events carry absolute ISO timestamps.
const vietnamClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const vnParts = (value) => {
  const parts = vietnamClock.formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
};
const valid = (event, orderId) => event.sourceId === orderId || event.destinationId === orderId;
export function assignedAt(events, orderId, time) {
  const relevant = events.filter((event) => !event.voided && valid(event, orderId) && Date.parse(event.effectiveAt) <= time)
    .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || String(a.recordedAt).localeCompare(String(b.recordedAt)));
  let count = 0, running = false, known = false;
  for (const event of relevant) {
    if (event.kind === "start" && event.sourceId === orderId) { count = event.count; known = true; running = true; }
    if (event.kind === "transfer") {
      if (event.sourceId === orderId) count -= event.count;
      if (event.destinationId === orderId && !event.destinationIncludedInStart) { count += event.count; known = true; running = true; }
    }
    if (event.kind === "add" && event.sourceId === orderId) count += event.count;
    if (event.kind === "reduce" && event.sourceId === orderId) count -= event.count;
    if (event.sourceId === orderId && (event.kind === "pause" || event.kind === "incident" && event.stopWork)) running = false;
    if (event.sourceId === orderId && event.kind === "resume") running = true;
    if(event.sourceId===orderId&&event.kind==="complete"&&event.finalCompletion){count=0;running=false;}
  }
  return { count: Math.max(0, count), running, known };
}
export function employeesAt(events, orderId, time) {
  const relevant = events.filter((event) => !event.voided && valid(event, orderId) && Date.parse(event.effectiveAt) <= time)
    .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || String(a.recordedAt).localeCompare(String(b.recordedAt)));
  const people = new Set(); let identified = false;
  for (const event of relevant) {
    if(event.kind==="complete"&&event.finalCompletion&&event.sourceId===orderId){people.clear();continue;}
    if (!["start", "transfer", "add", "reduce"].includes(event.kind)) continue;
    if (!Array.isArray(event.employees) || event.employees.length !== event.count) identified = false;
    if (event.kind === "start" && event.sourceId === orderId) { people.clear(); identified = event.employees?.length === event.count; }
    if (event.kind === "transfer" && event.destinationId === orderId && !event.destinationIncludedInStart && !identified && !people.size) identified = event.employees?.length === event.count;
    if (event.sourceId === orderId && ["reduce", "transfer"].includes(event.kind)) for (const employee of event.employees || []) people.delete(employee);
    if (event.sourceId === orderId && ["start", "add"].includes(event.kind) || event.kind === "transfer" && event.destinationId === orderId && !event.destinationIncludedInStart)
      for (const employee of event.employees || []) people.add(employee);
  }
  return identified ? [...people] : null;
}
export function hoursForOrder(events, schedule, orderId, from, to, attendance = null) {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Khoảng báo công không hợp lệ.");
  const relevant = effectiveAttendance(events).filter((event) => valid(event, orderId));
  const points = new Set([start, end]);
  for (const event of relevant) {
    for (const moment of [event.effectiveAt, event.endsAt]) {
      const value = Date.parse(moment);
      if (value > start && value < end) points.add(value);
    }
  }
  // Include every configured local schedule edge, including edited break and
  // cleaning hours. A midpoint can otherwise silently span a change of shift.
  if (end - start > 32 * 86400000) throw new Error("Báo công tối đa 32 ngày một lần.");
  if (attendance?.intervalEdges) {
    for (const value of attendance.intervalEdges) if(value>start&&value<end)points.add(value);
  } else {
    // Build civil-day boundaries once, rather than re-reading attendance for every minute.
    const midnight=Date.parse(`${vnParts(start).date}T00:00:00+07:00`);
    for(let base=midnight;base<end;base+=86400000){
      const date=vnParts(base).date,day=schedule[date];
      const edges=[0,1440,day?.hcStart??480,day?.hcEnd??1020,day?.lunchStart??720,day?.lunchEnd??780,
        day?.breakMorningStart??600,day?.breakMorningEnd??610,day?.breakAfternoonStart??900,day?.breakAfternoonEnd??910,
        day?.otStart??1050,day?.otEnd??1260,day?.preOtStart??1020,day?.preOtEnd??1050,
        ...(day?.cleaning||[]).flatMap(group=>[group.start,group.end]),...(attendance?.edges?.(date)||[])];
      for(const minute of edges){const value=base+minute*60000;if(value>start&&value<end)points.add(value);}
    }
  }
  const sorted = [...points].sort((a, b) => a - b);
  let hc = 0, ot = 0, identified = true;
  const perEmployee = new Map(), perDay = new Map(), staffing = [];
  for (let index = 1; index < sorted.length; index++) {
    const a = sorted[index - 1], b = sorted[index], middle = a + (b - a) / 2;
    const state = assignedAt(events, orderId, middle);
    if (!state.known || !state.running || !state.count) continue;
    const { date, minute } = vnParts(middle), day = schedule[date];
    if (!day?.working) continue;
    const absent = relevant.filter((event) => event.kind === "absence" && event.sourceId === orderId &&
      Date.parse(event.effectiveAt) <= middle && Date.parse(event.endsAt) > middle);
    const people = employeesAt(events, orderId, middle);
    if (!people || people.length !== state.count) identified = false;
    const affected = Math.min(state.count, absent.reduce((total, event) => total + Number(event.count || 0), 0));
    const named = Boolean(people && people.length === state.count);
    const available = part => people?.filter(id => !absent.some(event => event.employees?.includes(id)) &&
      (!attendance || attendance.present(id,date,minute,part))) || [];
    const hcIds = available('hc'), otIds = available('ot');
    const workers = named ? hcIds.length : state.count - affected;
    const hcStart = Number(day.hcStart ?? 480), hcEnd = Number(day.hcEnd ?? 1020);
    const lunchStart = Number(day.lunchStart ?? 720), lunchEnd = Number(day.lunchEnd ?? 780);
    const cleaning = (day.cleaning || []).filter((item) => minute >= item.start && minute < item.end);
    const namedCleaning = new Set(cleaning.flatMap((item) => item.employees || []));
    const unnamedCleaning = cleaning.reduce((total, item) => total + Math.max(0, Number(item.people || 0) - (item.employees || []).length), 0);
    // Anonymous line cleaning cannot identify which explicitly named report workers participated.
    // Retain their calculated allocation, consistent with hcWorkers above.
    if (!named && cleaning.some((item) => item.people > 0 && !(item.employees || []).length)) identified = false;
    const namedCount = named ? hcIds.filter((id) => namedCleaning.has(id)).length : namedCleaning.size;
    const hcWorkers = named ? hcIds.filter((id) => !namedCleaning.has(id)).length :
      Math.max(0, workers - Math.min(workers, unnamedCleaning + namedCount));
    const preOt=minute>=Number(day.preOtStart??1020)&&minute<Number(day.preOtEnd??1050);
    const isHc = !preOt && minute >= hcStart && minute < hcEnd && !(minute >= lunchStart && minute < lunchEnd) &&
      !(minute >= Number(day.breakMorningStart ?? 600) && minute < Number(day.breakMorningEnd ?? 610)) &&
      !(minute >= Number(day.breakAfternoonStart ?? 900) && minute < Number(day.breakAfternoonEnd ?? 910));
    const isOt = !preOt && day.ot && minute >= Number(day.otStart ?? 1050) && minute < Number(day.otEnd ?? 1260);
    if (isHc || isOt) {
      const part = isHc ? 'hc' : 'ot', count = isHc ? hcWorkers : (named ? otIds.length : workers);
      const ids = named ? (isHc ? hcIds.filter(id => !namedCleaning.has(id)) : otIds) : null;
      const entry = {from:new Date(a).toISOString(),to:new Date(b).toISOString(),part,assigned:state.count,count,employees:ids};
      const previous = staffing.at(-1);
      if(previous && previous.to===entry.from && previous.part===part && previous.assigned===entry.assigned && previous.count===count && JSON.stringify(previous.employees)===JSON.stringify(ids)) previous.to=entry.to;
      else staffing.push(entry);
    }
    if(attendance?.perDay){const row=perDay.get(date)||{hc:0,ot:0};if(isHc)row.hc+=hcWorkers*(b-a)/3600000;if(isOt)row.ot+=(named?otIds.length:workers)*(b-a)/3600000;perDay.set(date,row);}
    if (isHc) hc += hcWorkers * (b - a) / 3600000;
    if (isOt) ot += (named ? otIds.length : workers) * (b - a) / 3600000;
    if (identified && named) for (const id of new Set([...hcIds,...otIds])) {
      const value = perEmployee.get(id) || { hc: 0, ot: 0 };
      if (isHc && hcIds.includes(id) && !namedCleaning.has(id)) value.hc += (b - a) / 3600000;
      if (isOt && otIds.includes(id)) value.ot += (b - a) / 3600000;
      perEmployee.set(id, value);
    }
  }
  const round = (value) => Math.round(value * 10000) / 10000;
  const total = { hc: round(hc), ot: round(ot), total: round(hc + ot), staffing };
  if (identified && perEmployee.size) total.perEmployee = [...perEmployee].map(([id, value]) => ({ id, hc: round(value.hc), ot: round(value.ot), total: round(value.hc + value.ot) }));
  if(attendance?.perDay) total.perDay=[...perDay].map(([date,v])=>({date,hc:round(v.hc),ot:round(v.ot),total:round(v.hc+v.ot)}));
  return total;
}
