'use client';
import {FeedbackActionButton} from './action-feedback';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {validClockTime as valid,clockTimePattern} from '../lib/clock-input.mjs';

type Props={value?:string;disabled?:boolean;required?:boolean;allowClear?:boolean;openOnInput?:boolean;onChange:(event:{target:{value:string}})=>void;'aria-label'?:string};
const pad=(number:number)=>String(number).padStart(2,'0');
/** All editing and picker values are 24-hour HH:mm, independent of browser locale. */
export default function ClockInput({value='',disabled,required=false,allowClear=false,openOnInput=false,onChange,'aria-label':label}:Props){
 const [draft,setDraft]=useState(value),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 const wrapper=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>setDraft(value),[value]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!wrapper.current?.contains(event.target as Node))setOpen(false);};
  const close=()=>setOpen(false);
  document.addEventListener('pointerdown',outside);
  window.addEventListener('scroll',close,true);
  window.addEventListener('resize',close);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};
 },[open]);
 const setTime=(next:string)=>{setDraft(next);onChange({target:{value:next}});};
 const start=valid(value)?value:'08:00';
 const show=(force=false)=>{if(disabled||!button.current)return;const rect=(openOnInput?wrapper.current:button.current)!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-185)),top:rect.bottom+180>window.innerHeight?Math.max(8,rect.top-170):rect.bottom+4});setOpen(force||!open);};
 return <span ref={wrapper} className="cap-clock"><input onClick={()=>{if(openOnInput)show(true);}} type="text" required={required} pattern={clockTimePattern} aria-invalid={Boolean(draft&&!valid(draft))} inputMode="numeric" maxLength={5} placeholder="HH:mm" aria-label={label} title="Giờ 24h (HH:mm)" disabled={disabled} value={draft} onChange={event=>{const next=event.target.value;setDraft(next);if(valid(next)||allowClear)onChange({target:{value:next}});}} onBlur={()=>{if(!required&&draft!==value&&!valid(draft))setDraft(value);}} onKeyDown={event=>event.stopPropagation()}/><FeedbackActionButton ref={button} type="button" aria-label={`${label||'Giờ'} · chọn giờ 24h`} aria-expanded={open} disabled={disabled} disabledExplanation={"Lịch đang khóa hoặc bạn chưa có quyền chỉnh sửa. Kiểm tra trạng thái xác nhận và quyền được cấp."} onClick={()=>show()}>◷</FeedbackActionButton>{open&&createPortal(<div ref={panel} className="cap-clock-picker" role="group" aria-label={`${label||'Giờ'} · 24h`} style={{left:position.left,top:position.top}} onKeyDown={event=>event.stopPropagation()}><strong>Giờ 24h</strong><div><label>Giờ<select aria-label="Giờ 00–23" value={valid(value)?value.slice(0,2):start.slice(0,2)} onChange={event=>setTime(`${event.target.value}:${valid(value)?value.slice(3,5):start.slice(3,5)}`)}>{Array.from({length:24},(_,h)=><option key={h} value={pad(h)}>{pad(h)}</option>)}</select></label><span>:</span><label>Phút<select aria-label="Phút 00–59" value={valid(value)?value.slice(3,5):start.slice(3,5)} onChange={event=>setTime(`${valid(value)?value.slice(0,2):start.slice(0,2)}:${event.target.value}`)}>{Array.from({length:60},(_,m)=><option key={m} value={pad(m)}>{pad(m)}</option>)}</select></label></div><FeedbackActionButton type="button" onClick={()=>{setTime(valid(value)?value:start);setOpen(false);}}>Xong</FeedbackActionButton></div>,document.body)}</span>;
}
