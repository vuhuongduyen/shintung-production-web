'use client';
import {useEffect,useRef} from 'react';
import styles from './production-date-time-input.module.css';
import ClockInput from './capacity-clock-input';
import {localDateTimeError} from '../lib/clock-input.mjs';
type Props={seconds?:boolean;name?:string;value:string;onChange:(value:string)=>void;label:string;min?:string;max?:string;required?:boolean;disabled?:boolean};
/** Date + a locale-independent 24-hour clock; value stays YYYY-MM-DDTHH:mm. */
export default function ProductionDateTimeInput({name,value,onChange,label,min,max,required=true,disabled=false,seconds=false}:Props){
 const dateInput=useRef<HTMLInputElement>(null);
 const error=localDateTimeError(seconds?value.slice(0,16):value,{min,max,required});
 useEffect(()=>{dateInput.current?.setCustomValidity(disabled?'':error);},[disabled,error]);
 return <span className={`work-date-time ${styles.field}`} role="group" aria-label={label}><input ref={dateInput} aria-label={`${label} · ngày`} type="date" required={required} disabled={disabled} min={min?.slice(0,10)} max={max?.slice(0,10)} value={value.slice(0,10)} onChange={event=>onChange(`${event.target.value}T${value.slice(11,seconds?19:16)}`)}/>{seconds?<input aria-label={`${label} · giờ`} type="text" inputMode="numeric" pattern="([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?" placeholder="HH:mm:ss" required={required} disabled={disabled} value={value.slice(11,19)} onChange={event=>onChange(`${value.slice(0,10)}T${event.target.value}`)}/>:<ClockInput aria-label={`${label} · giờ`} required={required} disabled={disabled} value={value.slice(11,16)} onChange={event=>onChange(`${value.slice(0,10)}T${event.target.value}`)}/>}{name&&<input type="hidden" name={name} value={value} disabled={disabled}/>}</span>;
}
