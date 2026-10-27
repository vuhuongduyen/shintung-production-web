"use client";
import {productionDisplayTime} from "../lib/production-display-time.mjs";
type Row=Record<string,any>;
const time=productionDisplayTime;
export default function ProductionStaffing({hours,employees}:{hours?:Row|null;employees:Row[]}) {
 const segments:Row[]=hours?.staffing||[];
 if(!segments.length)return <p>Chưa có chi tiết số người theo khoảng giờ của lần báo công này.</p>;
 const counts=segments.map(s=>s.count),min=Math.min(...counts),max=Math.max(...counts);
 const assigned=[...new Set(segments.map(s=>s.assigned))].join('–');
 return <div className="production-staffing"><p><b>Thực tế tính giờ lần này: {min===max?min:`${min}–${max}`} người</b> · Phân công: {assigned} người</p><details name="onspa-staffing-segments"><summary>Xem số người theo từng khoảng giờ</summary>{segments.map((s,i)=><div key={i}><p>{time(s.from)} – {time(s.to)} · {s.part==='hc'?'HC':'TC'} · <b>{s.count}/{s.assigned} người tính giờ</b></p>{s.employees&&<p>{s.employees.map((id:string)=>employees.find(e=>e.id===id)?.name||id).join(', ')||'Không có người làm trong khoảng này'}</p>}</div>)}</details><small>Số người hiện tại thay đổi khi nhân viên đến. Giờ công chỉ tính thời gian thực tế làm việc, đã trừ nghỉ, giải lao và vệ sinh.</small></div>;
}
