import {historySourceBaseline} from './production-history-source.mjs';
import {eligibleStaff} from './production-attendance.mjs';
const minute=s=>{const [h,m]=String(s||'').split(':').map(Number);return h*60+m;};
const inside=(at,a,b)=>at>=minute(a)&&at<minute(b);
// Historical reconstruction only. Never turns the standard into observed labor time.
export function allocateHistory(reports,state,standards){
 const warnings=new Set(),allocations=reports.map(()=>new Map()),totals=reports.map(()=>0);
 const choicesUntil=new Map();
 const units=reports.map(r=>Number(standards.get(r.sku))||0);
 const weights=reports.map((r,i)=>{const prior=historySourceBaseline(r,[...(state.reports||[]),...reports]);return units[i]>0?units[i]*r.reportedQuantity*60:Math.max(1,((Number(r.sourceCumulativeHours)||0)-prior)*r.sourceCount*60);});
 for(const [i,r] of reports.entries())if(!units[i])warnings.add(`${r.planId}: thiếu giờ chuẩn/SP; phân bổ theo số người gốc.`);
 const first=Math.min(...reports.map(r=>Date.parse(r.startedAt))),last=Math.max(...reports.map(r=>Date.parse(r.completedAt)));
 if(!Number.isFinite(first)||!Number.isFinite(last)||last-first>62*86400000)throw Error('Khoảng lịch sử không hợp lệ hoặc vượt 62 ngày.');
 const days=new Map();for(const s of state.approvedSchedules)for(const d of s.days||[])days.set(`${d.date}:${s.key.split(':').at(-1)}`,{day:d,reference:s});
 const sourceEvents=state.events.filter(e=>!e.historicalImport&&!e.voided);
 // Existing named assignments reserve their minutes; no overlap with live reports.
 const occupied=new Map();for(const r of state.reports.filter(r=>!r.cancelled&&!r.voided))for(const a of r.historicalAllocations||[])for(let t=Date.parse(a.from);t<Date.parse(a.to);t+=60000)occupied.set(`${a.id}:${Math.floor(t/60000)}`,true);
 for(let t=Math.floor(first/60000)*60000;t<last;t+=60000){
  const local=new Date(t+7*3600000),date=local.toISOString().slice(0,10),at=local.getUTCHours()*60+local.getUTCMinutes();
  const used=new Set();
  for(const line of ['A','B']){
   const active=reports.map((r,i)=>({r,i})).filter(({r})=>r.line===line&&Date.parse(r.startedAt)<t+60000&&Date.parse(r.completedAt)>t&&!(r.pauses||[]).some(p=>Date.parse(p[0])<=t&&Date.parse(p[1])>t));
   if(!active.length)continue;
   const calendar=days.get(`${date}:${line}`);if(!calendar){warnings.add(`${date} Line ${line}: thiếu lịch đã duyệt, chưa phân bổ giờ ngày này.`);continue;}
   const {day,reference}=calendar;let part=day.working&&inside(at,day.hcStart,day.hcEnd)?'hc':day.working&&day.ot&&inside(at,day.otStart,day.otEnd)?'ot':null;
   if(!part||part==='hc'&&inside(at,day.lunchStart,day.lunchEnd)||(day.breaks||[]).some(b=>inside(at,b.start,b.end)))continue;
   let people=eligibleStaff({reference,events:sourceEvents,employees:state.employees,line,date,at,part}).allowed.sort((a,b)=>a.id.localeCompare(b.id));
   const cleaning=(day.cleaning||[]).filter(c=>inside(at,c.start,c.end)).reduce((s,c)=>s+Number(c.people||0),0);people=people.slice(Math.min(cleaning,people.length));
   const counts=new Map();
   for(const p of people){
    if(used.has(p.id)||occupied.has(`${p.id}:${Math.floor(t/60000)}`))continue;
    // Do not consume personnel already named on a real production interval.
    if(state.reports.some(r=>!r.historicalImport&&!r.cancelled&&Date.parse(r.startedAt)<t+60000&&Date.parse(r.completedAt)>t&&(r.employees||r.hours?.perEmployee?.map(e=>e.id)||[]).includes(p.id)))continue;
    const choices=active.filter(({r,i})=>(counts.get(i)||0)<r.sourceCount).sort((a,b)=>totals[a.i]/weights[a.i]-totals[b.i]/weights[b.i]||a.r.planId.localeCompare(b.r.planId));
    if(!choices.length)continue;const prior=choicesUntil.get(p.id),choice=prior&&prior.until>t?choices.find(c=>c.i===prior.i)||choices[0]:choices[0];if(!prior||prior.i!==choice.i||prior.until<=t)choicesUntil.set(p.id,{i:choice.i,until:t+15*60000});const {r,i}=choice,from=Math.max(t,Date.parse(r.startedAt)),to=Math.min(t+60000,Date.parse(r.completedAt)),amount=(to-from)/3600000;
    if(!allocations[i].has(p.id))allocations[i].set(p.id,{id:p.id,name:p.name,hc:0,ot:0,total:0,segments:[]});
    const person=allocations[i].get(p.id);person[part]+=amount;person.total+=amount;totals[i]+=amount*60;counts.set(i,(counts.get(i)||0)+1);used.add(p.id);
    const previous=person.segments.at(-1);if(previous&&previous.to===from&&previous.part===part)previous.to=to;else person.segments.push({from,to,part});
   }
  }
 }
 return {warnings:[...warnings],reports:reports.map((r,i)=>{const people=[...allocations[i].values()],hc=people.reduce((s,p)=>s+p.hc,0),ot=people.reduce((s,p)=>s+p.ot,0);return {...r,standardUnit:units[i]||null,count:people.length,employees:people.map(p=>p.id),employeeDetails:people.map(({id,name})=>({id,name})),hours:{hc,ot,total:hc+ot,estimated:true,perEmployee:people.map(({segments,...p})=>p)},historicalAllocations:people.flatMap(p=>p.segments.map(a=>({id:p.id,from:new Date(a.from).toISOString(),to:new Date(a.to).toISOString(),part:a.part}))),laborNotes:[{text:'Phân bổ bổ sung từ Google Sheet; giờ nhân viên là ước tính theo lịch thực tế và tỷ trọng SL × giờ chuẩn/SP, không phải giờ báo công gốc.'}]};})};
}
