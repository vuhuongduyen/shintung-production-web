'use client';
import LaborKindFilter from './labor-kind-filter';
import {employeeLookupOptions,employeeLookupMatcher} from '../lib/employee-lookup';
import {FeedbackActionButton} from './action-feedback';
import {productionEventDuration,formatProductionEventDuration} from '../lib/production-event-duration.mjs';
import {canEditAttendance} from '../lib/production-attendance-controls.mjs';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import ActualLaborEdit from './actual-labor-edit';
import {useEffect,useState,useMemo} from 'react';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
import {eventEmployees} from '../lib/production-event-employees.mjs';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {StandardToolbar,toolbar,type Items} from './standard-toolbar/StandardToolbar';
type Row=Record<string,any>;
export type ActualLaborFilters={month:string;line:string;kind:string;query:string;showCancelled:boolean};
export default function ActualLaborMonth({events,schedules=[],employees,manager,hr,busy,save,line,locked,initialMonth,actions=[],lookupFilters}:{lookupFilters?:ActualLaborFilters;initialMonth?:string;actions?:Items;events:Row[];schedules?:Row[];employees:Row[];manager:boolean;hr:boolean;busy:boolean;save:(body:Row)=>Promise<boolean>;line:string;locked:boolean}){
 const [localMonth,setMonth]=useState(()=>initialMonth||new Date(Date.now()+7*3600000).toISOString().slice(0,7));
 const [localFilterLine,setFilterLine]=useState(locked?line:''),[localKind,setKind]=useState(''),[localQuery,setQuery]=useState(''),[localShowCancelled,setShowCancelled]=useState(false),[selected,setSelected]=useState<Row|null>(null),[reason,setReason]=useState(''),[editMode,setEditMode]=useState(false);
 const [searchBy,setSearchBy]=useState('Tháng');
 // Embedded lookup shares its parent toolbar and receives only applied filters.
 const month=lookupFilters?.month??localMonth,filterLine=locked?line:lookupFilters?.line??localFilterLine,kind=lookupFilters?.kind??localKind,query=lookupFilters?.query??localQuery,showCancelled=lookupFilters?.showCancelled??localShowCancelled;
 useEffect(()=>{setSelected(null);},[hr,manager]);
 const active:Row[]=useMemo(()=>effectiveAttendance(events,true),[events]);
 const durationContext=useMemo(()=>({events,employees,activeEvents:effectiveAttendance(events)}),[events,employees]);
 // Filter by month/type/person before doing the more expensive calendar calculation.
 const candidates:Row[]=useMemo(()=>{
  const start=Date.parse(`${month}-01T00:00:00+07:00`),next=new Date(`${month}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
  const end=Date.parse(`${next.toISOString().slice(0,10)}T00:00:00+07:00`),matchesEmployee=employeeLookupMatcher(query,employees),kinds=kind.split('|');
  const cancellations=showCancelled?events.filter(e=>e.kind==='attendance-cancel').map(e=>({...e.before,cancelled:true,cancelledBy:e.actorId||e.actor,cancelReason:e.reason})):[];
  return [...active.filter(e=>['absence','line-absence','attendance-override','transfer','line-movement'].includes(e.kind)),...cancellations].filter(e=>{
   const type=e.movementType==='recall'?'Thu hồi nhân sự':['transfer','line-movement'].includes(e.kind)?'Chuyển Line':e.absenceType;
   return Date.parse(e.effectiveAt)<end&&(e.kind==='line-movement'&&!e.endsAt?Infinity:Date.parse(e.endsAt||e.effectiveAt))>=start&&(!kind||kinds.includes(type))&&(!query||eventEmployees(e,employees).some((p:Row)=>matchesEmployee(p)));
  });
 },[active,events,month,kind,query,showCancelled,employees]);
 const durations=useMemo(()=>new Map<Row,Row>(candidates.map(e=>[e,productionEventDuration(e,schedules,durationContext)])),[candidates,schedules,durationContext]);
 const durationFor=(e:Row):Row=>durations.get(e)!;
 const rows=useMemo(()=>candidates.filter(e=>!filterLine||e.line===filterLine||e.destinationLine===filterLine||durations.get(e)?.lines?.includes(filterLine)).sort((a,b)=>String(b.effectiveAt).localeCompare(String(a.effectiveAt))),[candidates,filterLine,durations]);
 const durationCell=(e:Row)=>{const value=durationFor(e);return value.people?.length?<details><summary>{formatProductionEventDuration(value)}</summary>{value.people.map((p:Row)=><div key={p.id}><strong>{p.name}: {formatProductionEventDuration(p)}</strong>{p.segments.map((s:Row,i:number)=><div key={i}>Line {s.line} · {productionDisplayTime(s.from,'')} – {productionDisplayTime(s.to,'')}: {formatProductionEventDuration(s)}</div>)}<div>Giờ theo ca gồm giải lao: {formatProductionEventDuration({minutes:p.administrativeMinutes,reason:p.reason})}</div></div>)}</details>:value.minutes===null?formatProductionEventDuration(value):<details><summary>{formatProductionEventDuration(value)}</summary><span>Giờ theo ca gồm giải lao: {formatProductionEventDuration({minutes:value.administrativeMinutes})}</span></details>;};
 const canCancel=(e:Row)=>canEditAttendance(e,{hr,manager});
 return <section className="actual-month-results">
 {lookupFilters&&<h2>Kết quả tra cứu nhân lực · {month.slice(5)}/{month.slice(0,4)}</h2>}
 {!lookupFilters&&<StandardToolbar name="ActualWorkSchedule" items={[...actions,
 toolbar.field('Tra theo',[toolbar.select({value:searchBy,onChange:e=>setSearchBy(e.target.value),'aria-label':'Tra theo'},<>{['Tháng','Line','Loại biến động','Nhân viên','Trạng thái'].map(v=><option key={v}>{v}</option>)}</>)]),
 toolbar.field('Nội dung tra',[
 searchBy==='Tháng'?toolbar.input({type:'month',value:month,'aria-label':'Nội dung tra theo tháng',onChange:e=>{if(e.target.value)setMonth(e.target.value);}}):
 searchBy==='Line'?toolbar.select({value:locked?line:filterLine,disabled:locked,onChange:e=>setFilterLine(e.target.value)},<><option value="">Tất cả Line</option>{[...new Set(['A','B',...employees.map(e=>e.line).filter(Boolean)])].map(v=><option key={v} value={v}>Line {v}</option>)}</>):
 searchBy==='Loại biến động'?toolbar.note(<LaborKindFilter value={kind} onChange={setKind}/>):
 searchBy==='Trạng thái'?toolbar.select({value:showCancelled?'all':'active',onChange:e=>setShowCancelled(e.target.value==='all')},<><option value="active">Bản ghi hiện hành</option><option value="all">Gồm bản đã hủy</option></>):
 toolbar.input({value:query,placeholder:'Mã hoặc tên nhân viên',onChange:e=>setQuery(e.target.value)},employeeLookupOptions(employees,locked?line:undefined))]),
 toolbar.action({onClick:()=>{setMonth(new Date(Date.now()+7*3600000).toISOString().slice(0,7));setFilterLine(locked?line:'');setKind('');setQuery('');setShowCancelled(false);}},'Xóa lọc',true,'clear')
 ]}/>}
 {selected&&canEditAttendance(selected,{hr,manager})&&<ActualLaborEdit key={selected.id+String(editMode)} entry={selected} cancelOnly={!editMode} employees={employees} manager={manager} hr={hr} busy={busy} save={save} close={()=>setSelected(null)}/>}
 <DataTable className="table-wrap actual-scroll"><table><thead><tr><th>Nhân viên</th><th>Từ thời điểm</th><th>Đến thời điểm</th><th title="Thời lượng mỗi người theo lịch, đã loại nghỉ trưa, giải lao và ngoài ca">Số giờ theo lịch (mỗi người)</th><th>Loại</th><th>Line nguồn</th><th>Line nhận</th><th>Số người</th><th>Người ghi nhận</th><th>Ghi chú / Lý do</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><DataCell>{eventEmployees(e,employees).map((p:Row)=><div key={p.id}>{p.name} ({p.id})</div>)}</DataCell><DataCell kind="date">{productionDisplayTime(e.effectiveAt,'')}</DataCell><DataCell kind="date">{e.openArrival?'Chưa đến':e.kind==='line-movement'&&!e.endsAt?'Dài hạn':productionDisplayTime(e.endsAt,'')}</DataCell><DataCell kind="number" title={e.cancelled?'Thời lượng bản đã hủy, chỉ để đối chiếu; không tính vào giờ thực tế':e.approved===false?'Thời lượng bản chờ duyệt, chưa tính vào giờ thực tế':'Thời lượng mỗi người của riêng bản ghi; các bản trùng nhau không cộng trực tiếp'}>{durationCell(e)}</DataCell><DataCell>{e.movementType==='recall'?'Thu hồi nhân sự':['transfer','line-movement'].includes(e.kind)?'Chuyển Line':e.absenceType}</DataCell><DataCell kind="code">{e.line}</DataCell><DataCell>{e.destinationLine||durationFor(e).lines?.filter((l:string)=>l!==e.line).join(' / ')||''}</DataCell><DataCell kind="number">{e.count}</DataCell><DataCell>{e.actorId||e.actor}</DataCell><DataCell>{e.cancelled?`${e.cancelReason} · Hủy bởi ${e.cancelledBy}`:e.reason}</DataCell><DataCell>{e.cancelled?'Đã hủy':e.approved===false?'Chờ duyệt giờ':'Đã ghi nhận'}</DataCell><DataCell>{canCancel(e)&&<div className="onspa-row-actions"><FeedbackActionButton disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>{setSelected(e);setEditMode(true);}}>Sửa</FeedbackActionButton><FeedbackActionButton disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>{setSelected(e);setEditMode(false);}} data-action-tone="danger">Hủy bản ghi</FeedbackActionButton></div>}{e.kind==='transfer'&&'Điều chỉnh tại Điều chỉnh báo công'}</DataCell></tr>)}{!rows.length&&<tr data-no-data="true"><DataCell colSpan={12}>Không có dữ liệu theo bộ lọc tháng này.</DataCell></tr>}</tbody></table></DataTable><p>{rows.length} bản ghi · Số giờ tính cho mỗi người, chưa nhân số người; đã loại nghỉ trưa, giải lao và ngoài ca. Mở mũi tên để đối chiếu giờ theo ca gồm giải lao. Thời lượng từng bản ghi dùng để đối chiếu; bản trùng nhau không cộng trực tiếp, bản đã hủy hoặc chờ duyệt không tính vào giờ thực tế.</p>
 </section>;
}
