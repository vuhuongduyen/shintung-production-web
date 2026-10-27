'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import ActualLaborEdit from './actual-labor-edit';
import {FeedbackActionButton} from './action-feedback';
import ClockInput from './capacity-clock-input';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {toolbarLocale,subscribeToolbarLocale,translateToolbar} from './standard-toolbar/translations';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
import {warehouseHelpers,dutyRows,latestDuty} from '../lib/warehouse-duty.mjs';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {notifyActionFailure} from '../lib/action-feedback';
type Row=Record<string,any>;
export default function WarehouseDuty({week,line,employees,events,allowed,busy,save}:{week:string;line:string;employees:Row[];events:Row[];allowed:boolean;busy:boolean;save:(body:Row)=>Promise<boolean>}){
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi'),t=(s:string)=>translateToolbar(s,locale);
 const candidates=useMemo(()=>warehouseHelpers(employees),[employees]);
 const current=latestDuty(events,week,line),source=dutyRows(events,week,line,effectiveAttendance(events,true));
 const signature=JSON.stringify(source);
 const [editEntry,setEditEntry]=useState<Row|null>(null),[cancelOnly,setCancelOnly]=useState(false);
 const tableRef=useRef<HTMLDivElement>(null);
 const [rows,setRows]=useState<Row[]>(source),[person,setPerson]=useState(''),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const expected=useRef(current?.id||null),token=useRef(productionRequestId()),running=useRef(false);
 useEffect(()=>{if(!dirty){setRows(JSON.parse(signature));expected.current=current?.id||null;}},[signature,current?.id,dirty]);
 const disabled=!allowed||busy||saving;
 const update=(rowId:string,patch:Row)=>{setRows(old=>old.map(row=>row.rowId===rowId?{...row,...(('start' in patch||'end' in patch)?{start:row.start||'08:00',end:row.end||'08:00'}:{}),...patch}:row));setDirty(true);setMessage('');token.current=productionRequestId();};
 async function commit(){if(disabled||running.current||!dirty)return;running.current=true;setSaving(true);
  try{const ok=await save({action:'warehouse-duty',week,line,expectedId:expected.current,rows:rows.map(({date,rowId,employee,start,end})=>({date,rowId,employee,start:start==='08:00'&&end==='08:00'?'':start,end:start==='08:00'&&end==='08:00'?'':end})),requestIdempotency:token.current});if(ok){setDirty(false);setMessage(t('Đã lưu lịch phụ kho. Khoảng giờ chưa đủ được giữ để nhập tiếp.'));}}
  catch{notifyActionFailure(t('Chưa lưu được lịch phụ kho. Dữ liệu đang nhập vẫn được giữ.'));}
  finally{running.current=false;setSaving(false);}
 }
 return <section className="warehouse-duty" aria-label={t('Lịch trực phụ kho theo tuần')}>
  <StandardToolbar name="ActualWorkSchedule" items={[
   toolbar.field('Người trực tuần',[toolbar.select({'aria-label':t('Người trực tuần'),value:person,disabled,onChange:e=>{const value=e.target.value;setPerson(value);setRows(old=>old.map(row=>row.attendanceId?row:{...row,employee:value}));setDirty(true);setMessage('');token.current=productionRequestId();}},<><option value="">{t('Chọn nhân viên')}</option>{candidates.map((p:Row)=><option key={p.id} value={p.id}>{p.name}</option>)}</>)]),
   toolbar.action({disabled:disabled||!dirty,onClick:()=>void commit()},saving?'Đang lưu…':'Lưu ghi nhận',allowed,'action'),
   toolbar.action({disabled:disabled||!dirty,onClick:()=>{setRows(JSON.parse(signature));setDirty(false);setPerson('');setMessage('');token.current=productionRequestId();}},'Hủy thay đổi',allowed,'action'),
  ]}/>
  <div ref={tableRef} className="warehouse-duty-table"><table data-no-pagination="true"><thead><tr><th rowSpan={2}>{t('Ngày')}</th><th rowSpan={2}>{t('Người phụ kho')}</th><th colSpan={2}>{t('Giờ thực tế')}</th><th rowSpan={2}>{t('Thao tác')}</th></tr><tr><th>{t('Từ giờ')}</th><th>{t('Đến giờ')}</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row.rowId}><td><span>{t(`Thứ ${new Date(`${row.date}T00:00:00Z`).getUTCDay()+1}`)}</span><small>{row.date.split('-').reverse().join('/')}</small>{row.attendanceId&&<small>{t(row.approved===false?'Chờ duyệt giờ công':'Đã ghi nhận')}</small>}</td><td><select aria-label={`${t('Người phụ kho')} ${row.date}`} disabled={disabled||!!row.attendanceId} value={row.employee} onChange={e=>update(row.rowId,{employee:e.target.value})}><option value="">{t('Chọn nhân viên')}</option>{candidates.map((p:Row)=><option key={p.id} value={p.id}>{p.name}</option>)}{row.employee&&!candidates.some((p:Row)=>p.id===row.employee)&&<option value={row.employee}>{employees.find(p=>p.id===row.employee)?.name||row.employee}</option>}</select></td><td><ClockInput value={row.start||'08:00'} disabled={disabled||!!row.attendanceId} allowClear openOnInput aria-label={`${t('Phụ kho từ giờ')} ${row.date}`} onChange={e=>update(row.rowId,{start:e.target.value})}/></td><td><ClockInput value={row.end||'08:00'} disabled={disabled||!!row.attendanceId} allowClear openOnInput aria-label={`${t('Phụ kho đến giờ')} ${row.date}`} onChange={e=>update(row.rowId,{end:e.target.value})}/></td><td><div className="warehouse-duty-actions"><FeedbackActionButton disabled={disabled} disabledExplanation="Chưa có quyền hoặc đang xử lý lịch phụ kho." onClick={()=>{const entry=events.find(e=>e.id===row.attendanceId);if(entry){setEditEntry(entry);setCancelOnly(false);}else tableRef.current?.querySelectorAll<HTMLSelectElement>('tbody select')[i]?.focus();}}>{t('Sửa')}</FeedbackActionButton><FeedbackActionButton disabled={disabled||(!row.employee&&!row.attendanceId)} disabledExplanation="Chọn nhân viên hoặc bản ghi cần hủy; kiểm tra quyền thao tác." data-action-tone="danger" onClick={()=>{const entry=events.find(e=>e.id===row.attendanceId);if(entry){setEditEntry(entry);setCancelOnly(true);}else{update(row.rowId,{employee:'',start:'',end:''});setMessage(t('Đã bỏ phân công ngày này. Bấm Lưu ghi nhận để lưu.'));}}}>{t('Hủy')}</FeedbackActionButton><FeedbackActionButton className="primary-button" disabled={disabled} onClick={()=>{setRows(old=>{const next=[...old];next.splice(i+1,0,{rowId:productionRequestId(),date:row.date,employee:row.employee||person,start:'',end:''});return next;});setDirty(true);setMessage('');token.current=productionRequestId();}}>+ {t('Thêm dòng')}</FeedbackActionButton></div></td></tr>)}</tbody></table></div>
  {editEntry&&allowed&&<ActualLaborEdit entry={editEntry} cancelOnly={cancelOnly} employees={candidates} manager={allowed} hr={false} busy={busy} save={save} close={()=>setEditEntry(null)}/>}
  <p className="warehouse-duty-note" aria-live="polite">{message||t('08:00 – 08:00 là giờ mặc định, chưa tính phụ kho. Nhập giờ kết thúc sau giờ bắt đầu rồi lưu ghi nhận.')}</p>
 </section>;
}
