import {monday} from './production-plan.mjs';
import {allocationInstant} from './production-allocation-queue.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
const dateOf=at=>new Date(at+7*3600000).toISOString().slice(0,10);
const minutes=value=>{const match=/^(\d{2}):(\d{2})$/.exec(String(value||''));return match&&+match[1]<24&&+match[2]<60?+match[1]*60 + +match[2]:NaN;};
const withoutLine=({line,...rest})=>rest;
// An explicitly saved actual calendar selects actual allocation. Capacity stays
// byte-for-byte unchanged. No browser inputs can fabricate working days.
export function actualAllocationEvents(rows,offer,allocation,{now,actorId}){
 const from=allocationInstant(allocation.effectiveAt),to=allocationInstant(allocation.endsAt),line=allocation.targetLine;
 const days=[];for(let at=Date.parse(dateOf(from)+'T00:00:00+07:00');at<to;at+=86400000)days.push({date:dateOf(at),midnight:at});
 const savedFor=date=>rows.find(r=>r.entity==='production_schedule'&&r.key===`${monday(date)}:${line}`&&!r.payload._deleted)?.payload;
 if(!days.some(d=>savedFor(d.date)))return null;
 const events=[];
 for(const {date,midnight} of days){
  const saved=savedFor(date),week=monday(date),row=rows.find(r=>r.entity==='capacity'&&r.key===week)?.payload.rows?.find(r=>r.line===line);
  const approval=row?.history?.filter(h=>h.action==='review'&&h.decision==='approve'&&h.request?.kind==='capacity').at(-1);
  const reference=approval?.after||(row?.reviewStatus==='approved'&&row?.status==='Đã xác nhận'?row.input:null);
  if(!saved||!reference||reference.dailySchedule?.length!==7)fail(`Line ${line}, ngày ${date}: cần lịch SX thực tế đã lưu và lịch tham chiếu đã được KHSX duyệt.`);
  const base=reference.dailySchedule.find(d=>d.date===date),previous=saved.days?.find(d=>d.date===date),oldDays=saved.reference?.days||saved.reference||[],old=oldDays.find(d=>d.date===date);
  const day=previous&&(!oldDays.length||old&&JSON.stringify(withoutLine(previous))!==JSON.stringify(withoutLine(old)))?previous:base;
  const a=Math.max(from,midnight),b=Math.min(to,midnight+86400000);
  const ranges=day?.working?[['hc',day.hcStart,day.hcEnd],...(day.ot?[['ot',day.otStart,day.otEnd]]:[])].map(([shift,start,end])=>({shift,start:midnight+minutes(start)*60000,end:midnight+minutes(end)*60000})).filter(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.end>r.start):[];
  const windows=ranges.map(r=>({...r,start:Math.max(a,r.start),end:Math.min(b,r.end)})).filter(r=>r.end>r.start);
  if(!windows.length||a<Math.min(...windows.map(r=>r.start))||b>Math.max(...windows.map(r=>r.end)))fail(`Line ${line}, ngày ${date}: khoảng nhận nằm ngoài giờ HC/TC của Lịch SX thực tế đã lưu. Kiểm tra giờ nhận và ghi nhận lịch thực tế trước.`);
  // Keep ownership during the lunch/pre-OT gap; payroll still uses the actual
  // calendar's existing break rules. Bound ownership at the requested end.
  events.push({id:`actual-${allocation.id}-${date}`,kind:'line-movement',line:offer.sourceLine,destinationLine:line,employees:[allocation.employeeId],count:1,effectiveAt:new Date(a).toISOString(),endsAt:new Date(b).toISOString(),recordedAt:now,actor:actorId,actorId,reason:allocation.reason||offer.reason||'',approved:true,allocationId:allocation.id,offerId:offer.id,queueActual:true,scheduleVersion:saved.version});
 }
 return events;
}
