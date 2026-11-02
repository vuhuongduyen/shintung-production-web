'use client';
import {useEffect,useMemo,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {DataTable} from './onspa-ui/DataTable';
import {assignmentOverview} from '../lib/production-assignment-overview.mjs';
import './production-assignment-overview.css';
type Row=Record<string,any>;
export default function ProductionAssignmentOverview({orders,events,reports,employees,restrictedLine,loading,error,refresh,onClose}:{orders:Row[];events:Row[];reports:Row[];employees:Row[];restrictedLine?:string;loading:boolean;error?:string;refresh:()=>void;onClose:()=>void}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 const period=(v:string)=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'Chưa có giờ kết thúc';
 const [line,setLine]=useState(restrictedLine||'all'),[status,setStatus]=useState('all');
 const rows=useMemo(()=>assignmentOverview({orders,events,reports,employees,line:restrictedLine||'all',now}),[orders,events,reports,employees,restrictedLine,now]);
 const effectiveLine=restrictedLine||line;
 const shown=rows.filter(r=>(effectiveLine==='all'||r.line===effectiveLine)&&(status==='all'||r.status===status));
 const count=new Set(shown.map(r=>r.id)).size;
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="production-assignment-overview"><DialogTitle>Phân công nhân viên</DialogTitle><DialogDescription>Xem lệnh và công đoạn đang được phân công, kể cả công đoạn chưa kết thúc từ ngày trước. Người chưa có phân công hiển thị Đang chờ phân bổ.</DialogDescription><StandardToolbar name="ProductionAssignmentOverview" items={[toolbar.action({onClick:refresh,disabled:loading},'Cập nhật dữ liệu',true,'action'),toolbar.field('Line',[toolbar.select({value:effectiveLine,disabled:!!restrictedLine,onChange:e=>setLine(e.target.value)},<><>{!restrictedLine&&<option value="all">Tất cả Line</option>}</>{[...new Set(restrictedLine?[restrictedLine]:rows.map(r=>r.line))].map(v=><option key={v} value={v}>Line {v}</option>)}</>)]),toolbar.field('Trạng thái',[toolbar.select({value:status,onChange:e=>setStatus(e.target.value)},<><option value="all">Tất cả</option>{['Đang làm','Tạm ngưng','Đang chờ phân bổ','Đang chuyển Line'].map(v=><option key={v}>{v}</option>)}</>)]),toolbar.action({onClick:onClose},'Đóng',true,'back')]}/>{error&&<p role="alert">Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải; bấm Cập nhật dữ liệu để thử lại.</p>}<p>{count} nhân viên · {new Set(shown.filter(r=>r.status==='Đang chờ phân bổ').map(r=>r.id)).size} chờ phân bổ</p><DataTable className="table-wrap"><table className="production-table" data-no-pagination="true"><colgroup>{[30,8,24,18,20].map((width,i)=><col key={i} style={{width:`${width}%`}}/>)}</colgroup><thead><tr>{['Nhân viên','Line','Lệnh','Công đoạn','Trạng thái'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map((r,i)=><tr key={`${r.id}:${i}`}><td>{r.name}<small>{r.id}</small></td><td>{r.line}</td><td>{r.order}</td><td>{r.stage}</td><td><span className={r.status==='Đang chuyển Line'?'assignment-moved':r.status==='Đang chờ phân bổ'?'assignment-waiting':undefined}>{r.status}{r.destinationLine?` ${r.destinationLine}`:''}</span>{r.destinationLine&&<small>{period(r.effectiveAt)} – {period(r.endsAt)}</small>}{r.conflict&&<small className="assignment-conflict">Có nhiều phân công — cần kiểm tra</small>}</td></tr>)}{!shown.length&&<tr><td colSpan={5}>Không có nhân viên phù hợp.</td></tr>}</tbody></table></DataTable></DialogContent></Dialog>;
}
