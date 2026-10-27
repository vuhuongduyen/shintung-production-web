"use client";
import {productionDisplayTime} from "../lib/production-display-time.mjs";
import ProductionStaffing from "./production-staffing";
import {useEffect,useState} from 'react';
import {productionApiFetch as apiFetch} from '../lib/production-api';
type Row=Record<string,any>;
const n=(v:any)=>Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:2});
const t=productionDisplayTime;
export default function ProductionReportImpact({orderId,effectiveLocal,startedLocal,employees}:{orderId:string;effectiveLocal:string;startedLocal?:string;employees:Row[]}) {
 const [result,setResult]=useState<Row|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;setResult(null);setError('');const timer=setTimeout(()=>{if(!effectiveLocal)return;void apiFetch('/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'preview-report',orderId,...(startedLocal&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(startedLocal)?{startedAt:new Date(`${startedLocal}:00+07:00`).toISOString()}:{}),effectiveAt:new Date(`${effectiveLocal}:00+07:00`).toISOString()})}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||'Không tính được giờ công');if(live)setResult(body);}).catch(e=>{if(live)setError(e.message);});},200);return()=>{live=false;clearTimeout(timer);};},[orderId,effectiveLocal,startedLocal]);
 if(error)return <p role="alert" className="production-inline-message error">{error}</p>;
 if(!result)return <p role="status">Đang tính giờ công theo lịch thực tế…</p>;
 if(!result.hours)return <p className="production-attendance-note">Chưa đủ dữ liệu phân công để tính giờ công. Vẫn ghi nhận được sản lượng xuất trạm; QLSX cần đối chiếu giờ công.{result.needsStartedAt?" Nhập ngày giờ bắt đầu thực tế bên dưới.":""}</p>;
 const names=(ids:string[])=>ids.map(id=>{const person=employees.find(p=>p.id===id);return person?`${person.name} (${id})`:id;}).join(', ');
 return <section className="production-report-impact"><h3>Giờ công lần này · {n(result.hours?.total)} giờ</h3><p>{t(result.startedAt)} – {t(result.completedAt)} · HC <b>{n(result.hours?.hc)}</b> · TC <b>{n(result.hours?.ot)}</b></p>
 <ProductionStaffing hours={result.hours} employees={employees}/>
 {!!result.laborNotes?.length&&<><h4>Biến động nhân viên ảnh hưởng LSX</h4>{result.laborNotes.map((note:Row)=><p key={note.eventId}>{note.text}</p>)}</>}
 {!!result.unresolvedAttendance?.length&&<p className="production-attendance-note">Chờ giờ vào thực tế: {names(result.unresolvedAttendance.flatMap((note:Row)=>note.employees))}. Giờ công đang tạm tính; vẫn có thể gửi sản lượng, cần bổ sung giờ vào trước khi xác nhận.</p>}
 {!!result.pendingAttendance?.length&&<p className="production-attendance-note">Có biến động chờ QLSX duyệt giờ: {names(result.pendingAttendance.flatMap((note:Row)=>note.employees))}.</p>}
 <details name="onspa-person-hours"><summary>Chi tiết giờ theo nhân viên</summary>{result.hours?.perEmployee?.length?result.hours.perEmployee.map((person:Row)=><p key={person.id}>{names([person.id])} · HC {n(person.hc)} · TC {n(person.ot)} · Tổng {n(person.total)}</p>):<p>Chưa có giờ làm hợp lệ trong khoảng này.</p>}</details></section>;
}
