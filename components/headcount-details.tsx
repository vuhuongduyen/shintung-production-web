import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
import {scheduleClock,scheduleHeadcount} from '../lib/production-schedule-headcount.mjs';
type Projection=ReturnType<typeof scheduleHeadcount>;
type Window=Projection['windows'][number];
type Employee={id?:string;name?:string;sourceEmployeeId?:string;line?:string};
type Event=Parameters<typeof effectiveAttendance>[0][number];
const unique=(ids:string[])=>[...new Set(ids)];
export default function HeadcountDetails({projection,date,line,events=[],employees=[]}:{projection?:Projection;date:string;line:string;events?:Event[];employees?:Employee[]}){
 const time=(value:string)=>{const full=productionDisplayTime(value);return full.startsWith(date.split('-').reverse().join('/'))?full.slice(11,16):full.slice(0,16);};
 const windows:Window[]=projection?.windows||[];
 const label=(id:string,code=false)=>{const p=employees.find(p=>String(p.id).toUpperCase()===id.toUpperCase());return p?`${p.name||id}${code?` (${p.sourceEmployeeId||id})`:''}`:id;};
 const planned=unique(windows.flatMap(w=>w.provisional)),actual=unique(windows.flatMap(w=>w.actualAbsent));
 const roster=unique(windows.flatMap(w=>w.people));
 const midnight=Date.parse(`${date}T00:00:00+07:00`);
 const movements=new Map<string,string[]>();
 for(const e of effectiveAttendance(events))if(['transfer','line-movement'].includes(e.kind)&&e.line!==e.destinationLine&&(e.line===line||e.destinationLine===line)&&windows.some(w=>Date.parse(e.effectiveAt)<midnight+w.end*60000&&(!e.endsAt||Date.parse(e.endsAt)>midnight+w.start*60000))){
  const key=`${e.line} → ${e.destinationLine}`;
  // A verified, open-ended directory assignment is the employee's normal Line,
  // not a daily temporary movement. Keep the event for allocation and audit.
  const ids=(e.employees||[]).filter((id:string)=>!e.orderAssignmentOnlyEmployees?.includes(id)).filter((id:string)=>{
   const person=employees.find(p=>String(p.id).trim().toUpperCase()===id.trim().toUpperCase());
   return !(e.kind==='line-movement'&&e.directoryAssignment===true&&!e.endsAt&&person?.line&&person.line.trim().toUpperCase()===String(e.destinationLine).trim().toUpperCase());
  });
  if(ids.length)movements.set(key,unique([...(movements.get(key)||[]),...ids]));
 }
 const other=effectiveAttendance(events,true).filter((e:Event)=>['absence','line-absence','attendance-override'].includes(e.kind)&&e.line===line&&Date.parse(e.effectiveAt)<midnight+86400000&&Date.parse(e.endsAt)>midnight);
 const forecast=new Map<string,string[]>();
 for(const part of ['hc','ot'])for(const id of planned){
  const shift=windows.filter(w=>w.part===part),ranges:number[][]=[];let open=false;
  for(const w of shift){if(w.provisional.includes(id)){if(open)ranges[ranges.length-1][1]=w.end;else ranges.push([w.start,w.end]);open=true;}else open=false;}
  if(!ranges.length)continue;
  const hours=shift.every(w=>w.provisional.includes(id))?'':` · ${ranges.map(([a,b])=>`${scheduleClock(a)}–${scheduleClock(b)}`).join(', ')}`;
  const key=`Capacity · nghỉ ${part==='ot'?'TC':'HC'}${hours}`;forecast.set(key,[...(forecast.get(key)||[]),id]);
 }
 const remainingActual=actual.filter(id=>!other.some((e:Event)=>(e.employees||[]).includes(id)));
 const changes=windows.filter((w,i)=>!i||w.count!==windows[i-1].count||w.part!==windows[i-1].part);
 const groups:(Window & {key:string;ranges:number[][]})[]=[];
 for(const w of windows){const key=JSON.stringify([w.part,w.count,[...w.people].sort(),[...w.provisional].sort(),[...w.actualAbsent].sort()]);const last=groups.at(-1);if(last?.key===key)last.ranges.push([w.start,w.end]);else groups.push({...w,key,ranges:[[w.start,w.end]]});}
 const next=new Date(`${date.slice(0,7)}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 return <div className="headcount-compact">
  {[...forecast].map(([caption,ids])=><p key={caption}>{caption}: {ids.map(id=>label(id)).join(', ')}</p>)}
  {other.map((e:Event)=><p key={e.id}>Thực tế · {e.kind==='attendance-override'?'Có mặt':e.absenceType||'Nghỉ'}{e.approved===false?' (chờ duyệt)':''}: {(e.employees||[]).map((id:string)=>label(id)).join(', ')||`${e.count||0} người`} · {time(e.effectiveAt)}–{e.openArrival?'Chưa đến':time(e.endsAt)}</p>)}
  {remainingActual.length>0&&<p>Nghỉ HR: {remainingActual.map(id=>label(id)).join(', ')}</p>}
  {[...movements].filter(([,ids])=>ids.length).map(([direction,ids])=><p key={direction}>{direction}: {ids.map(id=>label(id)).join(', ')}</p>)}
  {changes.length>1&&<p>{changes.map(w=>`${scheduleClock(w.start)} ${w.part==='ot'?'TC':'HC'}: ${w.count===null?'Chưa đủ dữ liệu':`${w.count} người`}`).join(' · ')}</p>}
  {windows.some(w=>w.count===null)?<p>Chưa đủ dữ liệu</p>:!planned.length&&!actual.length&&!movements.size&&!other.length&&changes.length<=1&&<p>Không có biến động.</p>}
  <details><summary>Chi tiết</summary>
   <p>HR cập nhật đến 10/{String(next.getUTCMonth()+1).padStart(2,'0')}</p>
   {(projection?.warnings||[]).map((warning:string)=><p key={warning}>{warning}</p>)}

   <ul aria-label="Giờ làm việc">{groups.map((g,i)=><li key={i}>{g.part==='ot'?'TC':'HC'} {g.ranges.map(([a,b]:number[])=>`${scheduleClock(a)}–${scheduleClock(b)}`).join(', ')}: {g.count===null?'Chưa đủ dữ liệu':`${g.count} người`}{g.provisional.length>0&&<> · Nghỉ dự kiến: {g.provisional.map((id:string)=>label(id)).join(', ')}</>}{g.actualAbsent.length>0&&<> · Nghỉ HR: {g.actualAbsent.map((id:string)=>label(id)).join(', ')}</>}</li>)}</ul>
   {roster.length>0&&<details><summary>Danh sách nhân viên ({roster.length})</summary><ul>{roster.map(id=><li key={id}>{label(id,true)}</li>)}</ul></details>}
  </details>
 </div>;
}
