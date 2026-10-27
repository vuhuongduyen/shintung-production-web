'use client';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {toolbarLocale,subscribeToolbarLocale,translateToolbar} from './standard-toolbar/translations';
import {LookupInput} from './standard-toolbar/LookupInput';
import {employeeLookupOptions} from '../lib/employee-lookup';
import {hrAttendanceDeadline,hrAttendancePeriodOpen} from '../lib/hr-attendance-period.mjs';
import ActualLaborEdit from './actual-labor-edit';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {effectiveAttendance,eligibleStaff} from '../lib/production-attendance.mjs';
import {notifyActionFailure} from '../lib/action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {FeedbackActionButton} from './action-feedback';
import ClockInput from './capacity-clock-input';
import styles from './hr-attendance-entry.module.css';
type Row=Record<string,any>;
type Draft={id:string;employee:string;kind:string;from:string;to:string;start:string;end:string;note:string;error?:string;done?:boolean;token:string};
const kinds=['Nghỉ','Đi trễ','Về sớm'];
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const displayClock=(value:string)=>value&&Number.isFinite(Date.parse(value))?new Date(Date.parse(value)+7*3600000).toISOString().slice(11,16):'—';
const iso=(date:string,time:string)=>new Date(`${date}T${time}:00+07:00`).toISOString();
export default function HrAttendanceEntry({week,line,globalHr=false,days,approved,schedules=[],employees,events,active,allowed,busy,save,back}:{week:string;line:string;globalHr?:boolean;days:Row[];approved?:Row;schedules?:Row[];employees:Row[];events:Row[];active:boolean;allowed:boolean;busy:boolean;save:(body:Row)=>Promise<boolean>;back:()=>void}){
 const [month,setMonth]=useState(week.slice(0,7));
 const context=`${month}:${globalHr?"employee":line}`,firstDay=`${month}-01`,lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 const dateWeek=(date:string)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
 const referenceFor=(date:string)=>{if(!validDate(date))return null;const key=`${dateWeek(date)}:${line}`;return schedules.find(item=>item.key===key)||(dateWeek(date)===week&&approved?{...approved,days}:null);};
 const calendarDays=[...new Map([...schedules.filter(item=>item.key?.endsWith(`:${line}`)).flatMap(item=>item.days||[]),...(approved?.days||days)].map(day=>[day.date,day])).values()] as Row[];
 const [editEntry,setEditEntry]=useState<Row|null>(null),[cancelOnly,setCancelOnly]=useState(false);
 const monthOpen=hrAttendancePeriodOpen(month);

 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 const t=(vi:string)=>translateToolbar(vi,locale);
 const makeRow=(copy?:Draft):Draft=>{const day=calendarDays.find(day=>day.working&&day.date>=firstDay&&day.date<=lastDay);return {...(copy||{employee:'',kind:'Nghỉ',from:day?.date||firstDay,to:day?.date||firstDay,start:day?.hcStart||'08:00',end:day?.hcEnd||'17:00',note:''}),id:productionRequestId(),token:productionRequestId(),error:undefined,done:false};};
 const [drafts,setDrafts]=useState<Record<string,Draft[]>>(()=>({[context]:[makeRow()]}));
 const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[historyKind,setHistoryKind]=useState('');
 const tableRef=useRef<HTMLDivElement>(null),pendingFocus=useRef<{context:string;id:string;column:number}|null>(null);
 const running=useRef(false),mounted=useRef(true),latest=useRef({context,allowed,active});latest.current={context,allowed,active};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{setDrafts(old=>old[context]?.length?old:{...old,[context]:[makeRow()]});setMessage('');setEditEntry(null);setHistoryKind('');pendingFocus.current=null;},[context]);
 useEffect(()=>{if(active)setDrafts(old=>old[context]?.some(row=>!row.done)?old:{...old,[context]:[...(old[context]||[]),makeRow()]});},[active,context]);
 const rows=drafts[context]||[],disabled=saving||busy||!allowed||!monthOpen;
 const update=(id:string,patch:Partial<Draft>)=>{if(disabled)return;setDrafts(old=>({...old,[context]:(old[context]||[]).map(row=>row.id===id&&!row.done?{...row,...patch,error:undefined,token:productionRequestId()}:row)}));setMessage('');};
 const findPerson=(query:string)=>employees.find(person=>[person.id,person.sourceEmployeeId,`${person.sourceEmployeeId||person.id} · ${person.name||''}`].some(code=>code&&String(code).trim().toLocaleLowerCase('vi')===query.trim().toLocaleLowerCase('vi')));
 const candidates=(row:Draft)=>{if(globalHr)return employees.filter(person=>person.active!==false);const minute=Number(row.start.slice(0,2))*60+Number(row.start.slice(3));const reference=referenceFor(row.from);const roster=reference&&validDate(row.from)&&validTime(row.start)?eligibleStaff({reference,events,employees,line,date:row.from,at:minute,part:minute>=Number((reference?.days?.find((day:Row)=>day.date===row.from)?.hcEnd||'17:00').slice(0,2))*60+Number((reference?.days?.find((day:Row)=>day.date===row.from)?.hcEnd||'17:00').slice(3))?'ot':'hc'}):null;const ids=new Set([...(roster?.allowed||[]),...(roster?.blocked||[])].map(person=>person.id));return employees.filter(person=>person.active!==false&&(person.line===line||ids.has(person.id)));};
 const intervals=(row:Draft)=>{if(!validDate(row.from)||!validDate(row.to)||row.to<row.from||row.from<firstDay||row.to>lastDay)return [];
  const dates=globalHr?Array.from({length:Math.round((Date.parse(row.to)-Date.parse(row.from))/86400000)+1},(_,i)=>({date:new Date(Date.parse(row.from)+i*86400000).toISOString().slice(0,10),working:true})):calendarDays;
  return dates.filter(day=>day.working&&day.date>=row.from&&day.date<=row.to).map(day=>({start:iso(day.date,row.start),end:iso(day.date,row.end)}));};
 function validate(){const errors=new Map<string,string>(),seen:{id:string;person:string;start:string;end:string}[]=[];for(const row of rows.filter(row=>row.done)){const person=findPerson(row.employee);if(person)for(const range of intervals(row))seen.push({id:row.id,person:person.id,...range});}const existing=effectiveAttendance(events,true).filter((event:Row)=>['absence','line-absence','attendance-override'].includes(event.kind)&&event.absenceType!=='Phụ kho');
  for(const row of rows.filter(row=>!row.done)){
   const person=findPerson(row.employee);let error='';
   if(!person||!candidates(row).some(item=>item.id===person.id))error=globalHr?'Chọn mã hoặc tên nhân viên trong danh sách.':'Chọn đúng nhân viên trong danh sách của Line.';
   else if(!kinds.includes(row.kind))error='Chọn Nghỉ, Đi trễ hoặc Về sớm.';
   else if(!validDate(row.from)||!validDate(row.to)||row.from<firstDay||row.to>lastDay||row.to<row.from)error='Chọn khoảng ngày hợp lệ trong tháng đang nhập.';
   else if(row.kind!=='Nghỉ'&&row.from!==row.to)error='Đi trễ hoặc về sớm cần ghi theo từng ngày.';
   else if((!validTime(row.start)||!validTime(row.end)||row.start>=row.end))error='Chọn giờ kết thúc sau giờ bắt đầu trong cùng ngày.';
   if(!error){const ranges=intervals(row);if(!ranges.length)error='Khoảng ngày này không có ngày làm việc. Kiểm tra lịch đã được duyệt.';else if(!globalHr&&ranges.some(range=>!referenceFor(new Date(Date.parse(range.start)+7*3600000).toISOString().slice(0,10))))error='Ngày được chọn chưa có lịch được duyệt. Kiểm tra Capacity trước khi lưu.';
    for(const range of ranges){const duplicate=seen.find(other=>other.person===person!.id&&other.start<range.end&&other.end>range.start);const recorded=existing.some((event:Row)=>event.requestIdempotency!==row.token&&(event.employees||[]).includes(person!.id)&&Date.parse(event.effectiveAt)<Date.parse(range.end)&&Date.parse(event.endsAt)>Date.parse(range.start));
     if(duplicate)error=`Trùng thời gian với dòng ${rows.findIndex(item=>item.id===duplicate.id)+1}. Sửa ngày hoặc giờ trước khi lưu.`;
     if(recorded)error='Đã có ghi nhận trong khoảng này. Đối chiếu bảng ghi nhận trước khi lưu.';
     seen.push({id:row.id,person:person!.id,...range});
    }
   }
   if(error)errors.set(row.id,error);
  }
  return errors;
 }
 async function commit(){if(running.current||disabled||!active)return;const errors=validate();if(errors.size){setDrafts(old=>({...old,[context]:rows.map(row=>({...row,error:errors.get(row.id)}))}));notifyActionFailure(`Có ${errors.size} dòng cần sửa. Xem hướng xử lý ngay tại dòng trước khi lưu.`);return;}
  const queue=rows.filter(row=>!row.done);if(!queue.length)return;running.current=true;setSaving(true);let count=0;
  try{for(const row of queue){if(!mounted.current||latest.current.context!==context||!latest.current.allowed||!latest.current.active)break;
    const person=findPerson(row.employee)!;const start=row.start,end=row.end;
    const body={action:'line-absence',...(globalHr?{attendanceScope:'employee'}:{line}),absenceType:row.kind,employees:[person.id],effectiveAt:iso(row.from,start),endsAt:iso(row.from,end),...(row.kind==='Nghỉ'?{dateTo:row.to}:{}),reason:row.note.trim()||row.kind,requestIdempotency:row.token};
    let ok=false;try{ok=await save(body);}catch{ok=false;}
    if(!mounted.current)break;
    if(!ok){setDrafts(old=>({...old,[context]:(old[context]||[]).map(item=>item.id===row.id?{...item,error:'Chưa xác nhận lưu dòng này. Kiểm tra thông báo và bảng đã ghi nhận rồi thử lại; các dòng còn lại vẫn được giữ.'}:item)}));break;}
    count++;setDrafts(old=>({...old,[context]:(old[context]||[]).map(item=>item.id===row.id?{...item,done:true,error:undefined}:item)}));
   }
   if(mounted.current&&latest.current.context===context){const result=count===queue.length?(globalHr?`Đã lưu ${count} dòng ghi nhận chấm công. Chỉ tính giờ khi có tham gia SX ở A/B.`:`Đã lưu ${count} dòng. Các bản ghi đã cập nhật vào lịch thực tế.`):`Đã xác nhận lưu ${count}/${queue.length} dòng trong lần này. Các dòng chưa lưu vẫn được giữ để kiểm tra và thử lại.`;setMessage(result);if(count!==queue.length)notifyActionFailure(result);}
  }finally{running.current=false;if(mounted.current)setSaving(false);}
 }
 const outstanding=rows.filter(row=>!row.done).length;
 const monthEvents=effectiveAttendance(events,true).filter((event:Row)=>['absence','line-absence','attendance-override'].includes(event.kind)&&kinds.includes(event.absenceType)&&(globalHr||event.line===line)&&!event.hrScopeProjection&&new Date(Date.parse(event.effectiveAt)+7*3600000).toISOString().slice(0,7)===month).sort((a:Row,b:Row)=>String(b.effectiveAt).localeCompare(String(a.effectiveAt))||String(a.id).localeCompare(String(b.id)));
 const historyEvents=monthEvents.filter((event:Row)=>!historyKind||event.absenceType===historyKind);
 const focusRow=(id:string,column:number)=>{const tr=[...tableRef.current?.querySelectorAll<HTMLTableRowElement>('[data-hr-draft-id]')||[]].find(tr=>tr.dataset.hrDraftId===id);const cell=tr?.cells[column];const control=cell?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),button:not(:disabled)')||tr?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled)');control?.focus();control?.scrollIntoView?.({block:'nearest',inline:'nearest'});};
 useLayoutEffect(()=>{const target=pendingFocus.current;if(target&&target.context===context&&active&&!disabled){pendingFocus.current=null;focusRow(target.id,target.column);}},[rows,context,active,disabled]);
 function moveRow(event:React.KeyboardEvent<HTMLTableRowElement>,row:Draft,index:number){
  if(!['ArrowDown','ArrowUp'].includes(event.key)||event.defaultPrevented||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||disabled||row.done)return;
  const target=event.target as HTMLElement,cell=target.closest('td');if(!cell||!event.currentTarget.contains(target))return;
  // Open autocomplete/clock pickers own their arrow keys until selection closes.
  if(target.getAttribute('role')==='combobox'&&target.getAttribute('aria-expanded')==='true'&&!findPerson(row.employee)||cell.querySelector('button[aria-expanded=true]')||target.closest('[role=listbox],.cap-clock-picker'))return;
  event.preventDefault();event.stopPropagation();const column=(cell as HTMLTableCellElement).cellIndex,step=event.key==='ArrowDown'?1:-1;
  let next=index+step;while(next>=0&&next<rows.length&&rows[next].done)next+=step;
  if(next>=0&&next<rows.length){focusRow(rows[next].id,column);return;}
  if(step===1&&rows.length<100){const added=makeRow();pendingFocus.current={context,id:added.id,column};setDrafts(old=>({...old,[context]:[...(old[context]||[]),added]}));}
 }

 // Unmount input popovers when leaving this screen; row drafts remain in this component.
 if(!active)return null;
 return <section className={styles.entry} aria-label={t('Ghi nhận chấm công')} data-hr-attendance-entry="true">
  <h2>{t('Ghi nhận chấm công')}{!globalHr&&` · Line ${line}`}</h2>
  <StandardToolbar name="HrAttendanceEntry" items={[
   toolbar.field('Tháng ghi nhận',[toolbar.input({type:'month',value:month,'aria-label':'Tháng ghi nhận',disabled:saving||busy,onChange:event=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value))setMonth(event.target.value);}})]),
   toolbar.note(`${t('Hạn ghi nhận')}: ${hrAttendanceDeadline(month)?.split('-').reverse().join('/')} · GMT+7`),
   toolbar.action({disabled:saving,disabledExplanation:'Đang lưu. Vui lòng chờ hoàn tất trước khi quay lại.',onClick:back},'Quay lại',true,'back'),
  ]}/>
  <p>{t(globalHr?'Nhập tất cả nhân viên A/B/C, không cần chọn Line. Chỉ tính giờ tại khoảng người đó thực sự tham gia sản xuất ở A/B.':'Mỗi dòng là một trường hợp. Nghỉ nhiều ngày dùng Từ ngày – Đến ngày; ngày không làm việc được bỏ qua.')}</p>
  <p>{t('Nhấn ↓ để xuống dòng tiếp theo; ở dòng cuối sẽ tự thêm dòng. Nhấn ↑ để quay lại dòng trước.')}</p>
  {message&&<p role="status">{message}</p>}
  <div ref={tableRef}><DataTable className={`table-wrap ${styles.table}`}><table data-no-pagination="true"><thead><tr>{['Nhân viên','Loại ghi nhận','Từ ngày','Đến ngày','Từ giờ','Đến giờ','Ghi chú','Trạng thái','Thao tác'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>
   {rows.map((row,index)=>{const person=findPerson(row.employee),locked=disabled||row.done;return <tr key={row.id} data-hr-row={index+1} data-hr-draft-id={row.id} onKeyDownCapture={event=>moveRow(event,row,index)} onKeyDown={event=>{if(event.key!=='Enter'||event.defaultPrevented||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;if(!(event.target instanceof HTMLInputElement)||event.target.getAttribute('aria-expanded')==='true')return;event.preventDefault();const inputs=[...event.currentTarget.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input:not(:disabled),select:not(:disabled)')];const next=inputs[inputs.indexOf(event.target)+1];if(next)next.focus();else if(index===rows.length-1&&!disabled&&!row.done&&rows.length<100)setDrafts(old=>({...old,[context]:[...(old[context]||[]),makeRow()]}));}}>
    <DataCell><LookupInput aria-label={`${t('Nhân viên')} ${index+1}`} value={person?`${person.sourceEmployeeId||person.id} · ${person.name||''}`:row.employee} disabled={locked} options={employeeLookupOptions(candidates(row) as {id:string}[]).map(option=>({...option,searchText:`${option.searchText} ${option.label}`}))} locale={locale} placeholder={t('Mã hoặc tên nhân viên')} onChange={event=>update(row.id,{employee:event.target.value})}/></DataCell>
    <DataCell><select aria-label={`${t('Loại ghi nhận')} ${index+1}`} value={row.kind} disabled={locked} onChange={event=>update(row.id,{kind:event.target.value,to:row.from})}>{kinds.map(kind=><option key={kind} value={kind}>{t(kind)}</option>)}</select></DataCell>
    <DataCell><input aria-label={`${t('Từ ngày')} ${index+1}`} type="date" min={firstDay} max={lastDay} value={row.from} disabled={locked} onChange={event=>update(row.id,{from:event.target.value,to:row.kind==='Nghỉ'&&row.to>=event.target.value?row.to:event.target.value})}/></DataCell>
    <DataCell><input aria-label={`${t('Đến ngày')} ${index+1}`} type="date" min={row.from} max={lastDay} value={row.to} disabled={locked||row.kind!=='Nghỉ'} onChange={event=>update(row.id,{to:event.target.value})}/></DataCell>
    <DataCell><ClockInput aria-label={`${t('Từ giờ')} ${index+1}`} disabled={locked} value={row.start} onChange={event=>update(row.id,{start:event.target.value})}/></DataCell>
    <DataCell><ClockInput aria-label={`${t('Đến giờ')} ${index+1}`} disabled={locked} value={row.end} onChange={event=>update(row.id,{end:event.target.value})}/></DataCell>
    <DataCell><input aria-label={`${t('Ghi chú')} ${index+1}`} maxLength={500} value={row.note} disabled={locked} onChange={event=>update(row.id,{note:event.target.value})}/></DataCell>
    <DataCell>{row.done?t('Đã lưu'):row.error?<span className={styles.error} role="alert">{t(row.error)}</span>:t('Chưa lưu')}</DataCell>
    <DataCell><div className={styles.actions}><FeedbackActionButton type="button" disabled={disabled||rows.length>=100} disabledExplanation={disabled?'Đang xử lý hoặc tháng đã khóa. Kiểm tra quyền và hạn ghi nhận.':'Bảng đã có tối đa 100 dòng. Lưu các dòng hiện tại trước khi nhập tiếp.'} onClick={()=>setDrafts(old=>({...old,[context]:[...(old[context]||[]),makeRow(row)]}))}>{t('Sao chép')}</FeedbackActionButton>{!row.done&&<FeedbackActionButton type="button" disabled={disabled} disabledExplanation="Đang xử lý hoặc tháng đã khóa. Kiểm tra quyền và hạn ghi nhận." onClick={()=>{const empty=makeRow();setDrafts(old=>{const remaining=(old[context]||[]).filter(item=>item.id!==row.id);return {...old,[context]:remaining.some(item=>!item.done)?remaining:[...remaining,empty]};});}}>{t('Xóa dòng')}</FeedbackActionButton>}</div></DataCell>
   </tr>;})}
  </tbody></table></DataTable></div>
  <div className="document-footer-actions" data-hr-save-footer="true"><FeedbackActionButton type="button" disabled={disabled||rows.length>=100} disabledExplanation={disabled?'Đang xử lý hoặc tháng đã khóa. Kiểm tra quyền và hạn ghi nhận.':'Bảng đã có tối đa 100 dòng. Lưu các dòng hiện tại trước khi nhập tiếp.'} onClick={()=>setDrafts(old=>({...old,[context]:[...(old[context]||[]),makeRow()]}))}>{t('Thêm dòng')}</FeedbackActionButton><FeedbackActionButton type="button" className="primary-button" disabled={disabled||!outstanding} disabledExplanation={!allowed?'Bạn chưa có quyền ghi nhận chấm công.':!monthOpen?'Tháng này đã hết hạn ghi nhận. Hạn là hết ngày 10 tháng sau.':saving||busy?'Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.':'Không có dòng mới để lưu.'} onClick={commit}>{saving?t('Đang lưu…'):`${t('Lưu ghi nhận')} · ${outstanding} ${t('dòng')}`}</FeedbackActionButton></div>
  <h3>{t('Đã ghi nhận trong tháng')}</h3>
  <StandardToolbar name="HrAttendanceHistory" items={[
   ...['',...kinds].map(kind=>toolbar.action({'aria-current':historyKind===kind?'true':undefined,onClick:()=>setHistoryKind(kind)},`${t(kind||'Tất cả')} · ${kind?monthEvents.filter((event:Row)=>event.absenceType===kind).length:monthEvents.length}`,true,'action')),
   toolbar.note(`${historyEvents.length} / ${monthEvents.length} ${t('bản ghi')}`),
  ]}/>
  <DataTable className={`table-wrap ${styles.table} ${styles.history}`}><table data-no-pagination="true"><thead><tr>{['Nhân viên','Loại ghi nhận','Ngày','Từ giờ','Đến giờ','Ghi chú','Người ghi nhận','Thời điểm ghi nhận','Thao tác'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{historyEvents.map((event:Row)=><tr key={event.id} data-hr-history-row="true"><DataCell>{(event.employees||[]).map((id:string)=>{const person=employees.find(person=>person.id===id);return <div key={id}>{person?`${person.sourceEmployeeId||person.id} · ${person.name}`:event.employeeDetails?.find((person:Row)=>person.id===id)?.name||id}</div>;})}</DataCell><DataCell>{event.absenceType}</DataCell><DataCell>{new Date(Date.parse(event.effectiveAt)+7*3600000).toISOString().slice(0,10).split('-').reverse().join('/')}</DataCell><DataCell>{displayClock(event.effectiveAt)}</DataCell><DataCell>{event.openArrival?'Chưa đến':displayClock(event.endsAt)}</DataCell><DataCell>{event.reason||'—'}</DataCell><DataCell>{event.actor||'—'}</DataCell><DataCell>{event.recordedAt?new Date(event.recordedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false}):'—'}</DataCell><DataCell><div className={styles.actions}><FeedbackActionButton type="button" disabled={disabled} disabledExplanation={!monthOpen?'Tháng này đã hết hạn ghi nhận. Hạn là hết ngày 10 tháng sau.':'Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.'} onClick={()=>{setEditEntry(event);setCancelOnly(false);}}>{t('Sửa')}</FeedbackActionButton><FeedbackActionButton type="button" disabled={disabled} disabledExplanation="Đang xử lý hoặc tháng đã khóa. Kiểm tra quyền và hạn ghi nhận." data-action-tone="danger" onClick={()=>{setEditEntry(event);setCancelOnly(true);}}>{t('Hủy bản ghi')}</FeedbackActionButton></div></DataCell></tr>)}{!historyEvents.length&&<tr><DataCell colSpan={9}>{t('Không có bản ghi phù hợp trong tháng.')}</DataCell></tr>}</tbody></table></DataTable>
  {editEntry&&allowed&&<ActualLaborEdit entry={editEntry} cancelOnly={cancelOnly} employees={employees} manager={false} hr={allowed} fixedLine busy={busy} save={save} close={()=>setEditEntry(null)}/>}
  <p>{t('Dòng đã lưu không gửi lại. Dùng Sửa hoặc Hủy bản ghi tại bảng Đã ghi nhận trong tháng.')}</p>
 </section>;
}
