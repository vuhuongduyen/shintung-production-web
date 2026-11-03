"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {FeedbackActionButton} from './action-feedback';
import './production-unassigned-alert.css';
type Row=Record<string,any>;
export default function ProductionUnassignedAlert({line,defer=false,revision}:{line:string;defer?:boolean;revision:unknown}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[dismissed,setDismissed]=useState<Record<string,number>>({}),[readVersion,setReadVersion]=useState(0);
 const inFlight=useRef(false),mounted=useRef(true),generation=useRef(0),queue=useRef<Promise<void>>(Promise.resolve());
 const read=useCallback(async()=>{if(inFlight.current||document.visibilityState==='hidden')return;inFlight.current=true;const version=generation.current;try{const response=await fetch('/api/production-workflow?unassignedAlerts=1');if(!response.ok)throw Error();const data=await response.json();if(mounted.current&&version===generation.current){setRows(data.rows||[]);setReadVersion(n=>n+1);setError('');}}catch{if(mounted.current)setError('Chưa cập nhật được cảnh báo. Hệ thống sẽ thử lại.');}finally{inFlight.current=false;}},[]);
 useEffect(()=>{mounted.current=true;void read();const timer=setInterval(()=>void read(),30000);window.addEventListener('focus',read);return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('focus',read);};},[read]);
 useEffect(()=>{void read();},[revision,read]);
 const command=useCallback((action:string,keys:string[])=>{
  const version=++generation.current;
  if(action==='acknowledge')setDismissed(old=>({...old,...Object.fromEntries(keys.map(key=>[key,Date.now()+300000]))}));
  const run=async()=>{try{
   const response=await fetch('/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'unassigned-reminder',reminder:{action,keys}})});
   if(!response.ok)throw Error();const data=await response.json();
   if(mounted.current&&version===generation.current){setRows(data.rows||[]);setError('');}
  }catch{if(mounted.current&&version===generation.current){setError('Chưa lưu được xác nhận cảnh báo. Vui lòng bấm Đã hiểu để thử lại.');if(action==='acknowledge')setDismissed(old=>{const next={...old};keys.forEach(key=>delete next[key]);return next;});}}};
  queue.current=queue.current.then(run,run);return queue.current;
 },[]);
 const visible=rows.filter(r=>line==='all'||r.line===line),available=visible.filter(r=>!(dismissed[r.key]>Date.now())),due=available.filter(r=>r.due),pending=available.filter(r=>r.count>0&&!r.acknowledgedAt);
 const dueKeys=JSON.stringify(due.map(r=>r.key));
 useEffect(()=>{if(!defer&&dueKeys!=='[]')void command('show',JSON.parse(dueKeys));},[dueKeys,defer,command,readVersion]);
 return <>{visible.length>0&&<p className="production-unassigned-summary" role="status">{visible.length} nhân viên quá 10 phút chưa được phân công. {visible.map(r=>`${r.name} · Line ${r.line} · Đã nhắc ${r.count} lần`).join('; ')}</p>}{error&&<p role="status">{error} <button type="button" onClick={()=>void read()}>Thử lại</button></p>}<Dialog open={!defer&&pending.length>0}><DialogContent className="production-unassigned-alert" showCloseButton={false} onEscapeKeyDown={e=>e.preventDefault()} onInteractOutside={e=>e.preventDefault()}><DialogTitle>Cảnh báo: Nhân viên chưa được phân công</DialogTitle><DialogDescription>Nhân viên đã chờ quá 10 phút trong giờ làm việc. Sau khi bấm Đã hiểu, hệ thống nhắc lại sau 5 phút nếu vẫn chưa được phân công.</DialogDescription><ul>{pending.map(r=><li key={r.key}><strong>{r.name} ({r.id})</strong> · Line {r.line} · {r.minutes} phút · <strong>Lần nhắc {r.count}</strong><br/><small>Chờ từ {new Date(r.since).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false})}</small></li>)}</ul>{error&&<p role="alert">{error}</p>}<FeedbackActionButton type="button" className="primary-button" onClick={()=>void command('acknowledge',pending.map(r=>r.key))}>Đã hiểu – tiến hành phân công</FeedbackActionButton></DialogContent></Dialog></>;
}
