"use client";
import {FeedbackActionButton} from './action-feedback';
import {DataCell} from './onspa-ui/DataCell';
import {useState} from 'react';
import {displayDate} from '../lib/production-plan.mjs';
import ClockInput from './capacity-clock-input';
import CapacityEmployeePicker from './capacity-employee-picker';
type Props={line:string;input:Record<string,any>;employees:any[];disabled:boolean;onChange:(input:Record<string,any>)=>void;onTransferMany?:(ids:string[],from:string,to:string,date:string,shift:'hc'|'ot',toDate?:string,start?:string,end?:string)=>boolean;onRemoveTransfer?:(id:string)=>void;t:(vi:string,zh:string,en:string)=>string};
export default function CapacityEmployeeRoster({line,input,employees,disabled,onTransferMany,onRemoveTransfer,t}:Props){
 const roster=input.dailyRoster||[],first=roster[0]?.date||'';
 const [from,setFrom]=useState(''),[date,setDate]=useState(first),[toDate,setToDate]=useState(first),[shift,setShift]=useState<'hc'|'ot'>('hc'),[start,setStart]=useState('08:00'),[end,setEnd]=useState('17:00'),[selected,setSelected]=useState<string[]>([]);
 const lines=Array.from(new Set(['A','B','C',...employees.filter(e=>e.active).map(e=>e.line)])).filter(l=>l&&l!==line).sort();
 const candidates=employees.filter(e=>e.active&&e.line===from);
 const transfers=(input.staffTransfers||[]).filter((r:any)=>r.to===line);
 return <section className="cap-entry-section cap-roster"><header>{t('Nhận nhân viên từ Line khác','從其他產線調入員工','Receive staff from another line')} → Line {line}</header><div className="cap-roster-body">
 <div className="cap-roster-controls"><label>{t('Line nguồn','來源產線','Source line')}<select aria-label="Line nguồn điều phối" disabled={disabled} value={from} onChange={e=>{setFrom(e.target.value);setSelected([]);}}><option value="">{t('Chọn Line','選擇產線','Select line')}</option>{lines.map(l=><option key={l} value={l}>Line {l}</option>)}</select></label>
 <label>{t('Từ ngày','開始日期','From date')}<select aria-label="Điều phối từ ngày" disabled={disabled} value={date} onChange={e=>{setDate(e.target.value);if(toDate<e.target.value)setToDate(e.target.value);}}>{roster.map((r:any)=><option key={r.date} value={r.date}>{displayDate(r.date)}</option>)}</select></label>
 <label>{t('Đến ngày','結束日期','To date')}<select aria-label="Điều phối đến ngày" disabled={disabled} value={toDate} onChange={e=>setToDate(e.target.value)}>{roster.filter((r:any)=>r.date>=date).map((r:any)=><option key={r.date} value={r.date}>{displayDate(r.date)}</option>)}</select></label>
 <label>{t('Ca','班次','Shift')}<select aria-label="Ca điều phối" disabled={disabled} value={shift} onChange={e=>{const s=e.target.value as 'hc'|'ot';setShift(s);const day=input.dailySchedule.find((d:any)=>d.date===date);setStart(day?.[s==='hc'?'hcStart':'otStart']||(s==='hc'?'08:00':'17:30'));setEnd(day?.[s==='hc'?'hcEnd':'otEnd']||(s==='hc'?'17:00':'21:00'));}}><option value="hc">HC</option><option value="ot">TC</option></select></label>
 <label>{t('Từ giờ','開始時間','From time')}<ClockInput aria-label="Điều phối từ giờ" disabled={disabled} value={start} onChange={e=>setStart(e.target.value)}/></label><label>{t('Đến giờ','結束時間','To time')}<ClockInput aria-label="Điều phối đến giờ" disabled={disabled} value={end} onChange={e=>setEnd(e.target.value)}/></label>
 </div>
 {from&&<CapacityEmployeePicker employees={candidates} selected={selected} disabled={disabled} t={t} onChange={setSelected}/>}
 <FeedbackActionButton type="button" disabled={disabled||!selected.length||!onTransferMany} disabledExplanation={disabled ? "Lịch đang khóa hoặc bạn chưa có quyền chỉnh sửa. Kiểm tra trạng thái xác nhận và quyền được cấp." : !selected.length ? "Chọn ít nhất một nhân viên để điều phối." : "Chức năng điều phối chưa sẵn sàng trong màn hình này."} onClick={()=>{if(onTransferMany?.(selected,from,line,date,shift,toDate,start,end))setSelected([]);}}>{t('Ghi nhận điều phối','記錄調配','Record transfer')} · {selected.length} {t('người','人','staff')} → Line {line}</FeedbackActionButton>
 <p>{t('Áp dụng khung giờ trên cho các ngày có lịch trong khoảng đã chọn. Nhấn Lưu nháp để lưu; giờ nghỉ không tính vào giờ khả dụng.','時段套用至所選日期內的工作日；按儲存草稿保存，休息不计入可用工時。','Applies to scheduled days in the selected range. Save draft to persist; breaks are excluded from available hours.')}</p>
 {!!transfers.length&&<div className="cap-entry-scroll"><table className="cap-entry-table"><thead><tr>{[t('Nhân viên','員工','Employees'),t('Line nguồn','來源產線','Source'),t('Từ ngày – Đến ngày','日期範圍','Date range'),t('Ca / Giờ','班次／時間','Shift / time'),t('Xóa','刪除','Remove')].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{transfers.map((r:any)=><tr key={r.id}><DataCell>{r.employees.map((id:string)=>employees.find(e=>e.id===id)?.name||id).join(', ')}</DataCell><DataCell>Line {r.from}</DataCell><DataCell kind="date">{displayDate(r.date)} – {displayDate(r.toDate)}</DataCell><DataCell kind="time">{r.shift==='hc'?'HC':'TC'} · {r.start} – {r.end}</DataCell><DataCell><FeedbackActionButton disabled={disabled} disabledExplanation={"Lịch đang khóa hoặc bạn chưa có quyền chỉnh sửa. Kiểm tra trạng thái xác nhận và quyền được cấp."} aria-label={`Xóa điều phối ${r.id}`} onClick={()=>onRemoveTransfer?.(r.id)}>×</FeedbackActionButton></DataCell></tr>)}</tbody></table></div>}
 </div></section>;
}
