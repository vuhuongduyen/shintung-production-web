'use client';
import {useEffect,useRef} from 'react';
import {FeedbackActionButton} from './action-feedback';
type Employee={id:string;name:string;displayId?:string;disabled?:boolean;notes?:string[]};
type Props={employees:Employee[];selected:string[];disabled?:boolean;showSelectAll?:boolean;closeOnOutside?:boolean;onChange:(ids:string[])=>void;t:(vi:string,zh:string,en:string)=>string;label?:string;className?:string;onKeyDown?:(event:React.KeyboardEvent<HTMLElement>)=>void};

/** The same named-staff chooser is used by assignments, leave and cleaning. */
export default function CapacityEmployeePicker({employees,selected,disabled,showSelectAll=false,closeOnOutside=false,onChange,t,label,className,onKeyDown}:Props){
 const picker=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(!closeOnOutside)return;const close=(event:PointerEvent)=>{if(picker.current?.open&&!picker.current.contains(event.target as Node))picker.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[closeOnOutside]);
 const names=selected.map(id=>employees.find(e=>e.id===id)?.name||id);
 const available=employees.filter(e=>!e.disabled),all=available.length>0&&available.every(e=>selected.includes(e.id)),partial=!all&&available.some(e=>selected.includes(e.id));
 return <details ref={picker} name="onspa-employee-pickers" className={`cap-employee-picker${className?` ${className}`:''}`} onKeyDown={onKeyDown}>
  <summary title={names.join(', ')} aria-label={label||t('Chọn nhân viên','選擇員工','Select employees')}>{names.length?`${names.length} ${t('người đã chọn','人已選','selected')} ▾`:t('Chọn nhân viên ▾','選擇員工 ▾','Select employees ▾')}</summary>
  <div className="cap-employee-picker-body"><strong>{t('Chọn nhân viên','選擇員工','Select employees')}</strong>
   {showSelectAll&&employees.length>0&&<label className="cap-picker-select-all"><input type="checkbox" ref={node=>{if(node)node.indeterminate=partial;}} disabled={disabled||!available.length} checked={all} onChange={event=>onChange(event.target.checked?available.map(e=>e.id):[])}/>{t('Chọn tất cả','全選','Select all')} · {available.length} NV</label>}
   {employees.length?<div className="cap-employee-picker-options">{employees.map(e=><label key={e.id} className={e.disabled?'cap-picker-unavailable':undefined}><input type="checkbox" aria-label={`${e.displayId||e.id} · ${e.name}`} disabled={disabled||e.disabled} checked={selected.includes(e.id)} onChange={event=>onChange(event.target.checked?[...selected,e.id]:selected.filter(id=>id!==e.id))}/><span className="cap-picker-person">{e.displayId||e.id} · {e.name}{e.notes?.map((note,index)=><small className="cap-picker-person-note" key={index}>{note}</small>)}</span></label>)}</div>:<p>{t('Chưa có nhân viên trong ca này. Kiểm tra ngày và phân công tại Điều phối NV.','此班次沒有員工，請檢查日期與調配。','No employees in this shift. Check the date and staff assignment.')}</p>}
   <FeedbackActionButton type="button" className="cap-picker-done" onClick={e=>{(e.currentTarget.closest('details') as HTMLDetailsElement)?.removeAttribute('open');}}>{t('Xong','完成','Done')} · {selected.length} NV</FeedbackActionButton>
  </div>
 </details>;
}
