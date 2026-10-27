'use client';
import {useEffect,useRef} from 'react';
import styles from './production-date-time-input.module.css';
import ClockInput from './capacity-clock-input';
import {localDateTimeError} from '../lib/clock-input.mjs';
type Props={name?:string;value:string;onChange:(value:string)=>void;label:string;min?:string;max?:string;required?:boolean;disabled?:boolean};
/** Date + a locale-independent 24-hour clock; value stays YYYY-MM-DDTHH:mm. */
export default function ProductionDateTimeInput({name,value,onChange,label,min,max,required=true,disabled=false}:Props){
 const dateInput=useRef<HTMLInputElement>(null);
 const error=localDateTimeError(value,{min,max,required});
 useEffect(()=>{dateInput.current?.setCustomValidity(disabled?'':error);},[disabled,error]);
 return <span className={`work-date-time ${styles.field}`} role="group" aria-label={label}><input ref={dateInput} aria-label={`${label} · ngày`} type="date" required={required} disabled={disabled} min={min?.slice(0,10)} max={max?.slice(0,10)} value={value.slice(0,10)} onChange={event=>onChange(`${event.target.value}T${value.slice(11,16)}`)}/><ClockInput aria-label={`${label} · giờ`} required={required} disabled={disabled} value={value.slice(11,16)} onChange={event=>onChange(`${value.slice(0,10)}T${event.target.value}`)}/>{name&&<input type="hidden" name={name} value={value} disabled={disabled}/>}</span>;
}
