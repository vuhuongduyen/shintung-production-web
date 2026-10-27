'use client';
import {notifyInvalidAction} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import {attendanceInputTypes,canEditAttendance} from '../lib/production-attendance-controls.mjs';
import {useState} from 'react';
import ClockInput from './capacity-clock-input';
import CapacityEmployeePicker from './capacity-employee-picker';
import {productionRequestId} from '../lib/production-request-id.mjs';
type Row=Record<string,any>;
const local=(v:string)=>v?new Date(Date.parse(v)+7*3600000).toISOString().slice(0,16):'';
export default function ActualLaborEdit({entry,cancelOnly=false,employees,manager,hr,fixedLine=false,busy,save,close}:{entry:Row;cancelOnly?:boolean;employees:Row[];manager:boolean;hr:boolean;fixedLine?:boolean;busy:boolean;save:(b:Row)=>Promise<boolean>;close:()=>void}){
 const movement=entry.kind==='line-movement',personal=entry.attendanceScope==='employee';
 const [start,setStart]=useState(local(entry.effectiveAt)),[end,setEnd]=useState(local(entry.endsAt)),[people,setPeople]=useState<string[]>(entry.employees||[]),[line,setLine]=useState(entry.line),[destination,setDestination]=useState(entry.destinationLine||'B'),[type,setType]=useState(entry.absenceType||'Nghỉ'),[reason,setReason]=useState('');
 const types=attendanceInputTypes({hr,manager:manager&&!personal}).filter(value=>value!=='Chuyển Line');
 const canSave=canEditAttendance(entry,{hr,manager})&&(cancelOnly||movement||types.includes(type))&&(!personal||people.length===1);
 const lines=[...new Set(['A','B',...employees.map(e=>e.line).filter(Boolean)])];
 if(!canEditAttendance(entry,{hr,manager}))return null;
 return <><FeedbackActionButton className="overlay" aria-label="Đóng chỉnh sửa nhân lực" onClick={close}/><section className="production-modal actual-labor-edit" role="dialog" aria-modal="true" aria-label={cancelOnly?'Hủy bản ghi':'Sửa bản ghi'}><header><h2>{cancelOnly?'Hủy bản ghi nhập sai':'Sửa dữ liệu nhân lực'}</h2><FeedbackActionButton type="button" onClick={close}>×</FeedbackActionButton></header><form onInvalid={notifyInvalidAction} className="production-modal-body actual-labor-edit-body" onSubmit={e=>{e.preventDefault();if(!canSave)return;void save({action:cancelOnly?'attendance-cancel':'attendance-edit',attendanceId:entry.id,line,destinationLine:destination,absenceType:type,employees:people,effectiveAt:new Date(`${start}:00+07:00`).toISOString(),endsAt:end?new Date(`${end}:00+07:00`).toISOString():null,reason,requestIdempotency:productionRequestId()}).then(ok=>{if(ok)close();});}}>
 <p>{(entry.employeeDetails||[]).map((p:Row)=>p.name||p.id).join(', ')}</p>
 {!cancelOnly&&<>{!personal&&<label>{movement?'Line nguồn':'Line'}<select value={line} disabled={fixedLine} onChange={e=>setLine(e.target.value)}>{(fixedLine?[entry.line]:lines).map(l=><option key={l}>{l}</option>)}</select></label>}{movement?<label>Line nhận<select value={destination} onChange={e=>setDestination(e.target.value)}><option>A</option><option>B</option></select></label>:<label>Loại<select value={type} onChange={e=>setType(e.target.value)}>{types.map(v=><option key={v}>{v}</option>)}</select></label>}
 <div className="actual-labor-edit-time"><label>Từ ngày<input required type="date" value={start.slice(0,10)} onChange={e=>{setStart(`${e.target.value}T${start.slice(11)}`);if(!movement)setEnd(`${e.target.value}T${end.slice(11)||'17:00'}`);}}/></label><label>Từ giờ<ClockInput value={start.slice(11)} onChange={e=>setStart(`${start.slice(0,10)}T${e.target.value}`)}/></label>
 
 {end&&<><label>Đến ngày<input required type="date" value={end.slice(0,10)} onChange={e=>setEnd(`${e.target.value}T${end.slice(11)}`)}/></label><label>Đến giờ<ClockInput value={end.slice(11)} onChange={e=>setEnd(`${end.slice(0,10)}T${e.target.value}`)}/></label></>}
 </div>{movement&&<label><input type="checkbox" checked={!end} onChange={e=>setEnd(e.target.checked?'':`${start.slice(0,10)}T17:00`)}/> Chuyển dài hạn, chưa có ngày kết thúc</label>}
 <CapacityEmployeePicker employees={employees.map(p=>({id:p.id,name:p.name,displayId:p.sourceEmployeeId}))} selected={people} onChange={ids=>setPeople(personal?ids.slice(-1):ids)} disabled={busy} showSelectAll={!personal} t={vi=>vi} label="Nhân viên cần sửa"/>
 </>}
 <label>Lý do<input required value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label><p>Lưu lịch sử trước/sau và tính lại giờ công liên quan.</p><div className="actual-labor-edit-actions"><FeedbackActionButton type="button" onClick={close}>Đóng</FeedbackActionButton><FeedbackActionButton className="actual-orange actual-record-button" disabled={!canSave||busy||!reason.trim()||!people.length} disabledExplanation={!canSave ? "Bạn chưa có quyền sửa loại bản ghi này." : busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !reason.trim() ? "Nhập lý do trước khi lưu." : "Chọn ít nhất một nhân viên."}>{cancelOnly?'Xác nhận hủy bản ghi':'Lưu điều chỉnh'}</FeedbackActionButton></div></form></section></>;
}
