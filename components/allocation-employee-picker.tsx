"use client";

import {useEffect,useId,useRef,useState} from 'react';
import styles from './allocation-employee-picker.module.css';
import {FeedbackActionButton} from './action-feedback';

type Employee = {id:string;name:string};
type Props = {candidates:Employee[];selected:string[];disabled:boolean;onChange:(ids:string[])=>void};
const searchable=(value:string)=>value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');

export default function AllocationEmployeePicker({candidates,selected,disabled,onChange}:Props) {
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
 const listId=useId();
 const term=searchable(query.trim());
 const visible=candidates.filter(person=>searchable(`${person.name} ${person.id}`).includes(term));
 const selectedIds=new Set(selected);
 const selectedCount=candidates.filter(person=>selectedIds.has(person.id)).length;
 const close=()=>{setOpen(false);trigger.current?.focus();};

 useEffect(()=>{
  if(!open)return;
  search.current?.focus();
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return ()=>document.removeEventListener('pointerdown',outside);
 },[open]);

 return <div ref={root} className={styles.picker} onBlur={event=>{
  if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))setOpen(false);
 }} onKeyDown={event=>{
  if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}
  // Choosing or searching people must never implicitly submit the transfer form.
  if(event.key==='Enter'&&event.target instanceof HTMLInputElement)event.preventDefault();
 }}>
  <span className={styles.caption}>Nhân viên</span>
  <FeedbackActionButton disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." ref={trigger} type="button" className={styles.trigger} aria-label="Chọn nhân viên" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={()=>{
   if(disabled)return;
   if(!open)setQuery('');
   setOpen(current=>!current);
  }}><span>Chọn nhân viên ({selectedCount})</span><span aria-hidden="true">{open?'▴':'▾'}</span></FeedbackActionButton>
  {open&&<div id={listId} className={styles.dropdown} role="group" aria-label="Danh sách nhân viên">
   <input ref={search} className={styles.search} type="search" aria-label="Tìm nhân viên theo tên hoặc mã" placeholder="Tìm tên hoặc mã nhân viên" autoComplete="off" value={query} disabled={disabled} onChange={event=>{if(!disabled)setQuery(event.target.value);}}/>
   <div className={styles.list}>
    {visible.map(person=><label key={person.id} className={styles.option} title={`${person.name} (${person.id})`}>
     <input type="checkbox" aria-label={`${person.name} (${person.id})`} checked={selectedIds.has(person.id)} disabled={disabled} onChange={event=>{
      if(disabled)return;
      onChange(event.target.checked?Array.from(new Set([...selected,person.id])):selected.filter(id=>id!==person.id));
     }}/>
     <span className={styles.name}>{person.name}</span><span className={styles.code}>({person.id})</span>
    </label>)}
    {!visible.length&&<p className={styles.empty}>{candidates.length?'Không tìm thấy nhân viên phù hợp.':'Không có nhân viên khả dụng trong Line nguồn.'}</p>}
   </div>
   <div className={styles.footer}><span role="status">Đã chọn {selectedCount} / {candidates.length}</span><FeedbackActionButton disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." type="button" className={styles.done} disabled={disabled} onClick={close}>Xong</FeedbackActionButton></div>
  </div>}
 </div>;
}
