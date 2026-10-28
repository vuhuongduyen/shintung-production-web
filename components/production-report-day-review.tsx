'use client';
import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {DataCell} from './onspa-ui/DataCell';
import {DataTable} from './onspa-ui/DataTable';
import {FeedbackActionButton} from './action-feedback';
import ProductionEmployeeCount from './production-employee-count';
import {groupReviewDays,reviewEligibility,reviewSnapshot} from '../lib/production-review-selection.mjs';
import {pendingReportReview,reportRequiresDelayReason} from '../lib/production-progress-review.mjs';
import {productionEntryActorId,productionConfirmationActorId} from '../lib/production-actor.mjs';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
type Row=Record<string,any>;
export type ReviewSelection={report:Row;expectedReview:string;delayReason:string};
const num=(n:any)=>n==null?'—':Number(n).toLocaleString('vi-VN',{maximumFractionDigits:2});
export default function ProductionReportDayReview({order,reports,sourceReports,employees,manager,busy,open,onConfirm,t}:{order:Row;reports:Row[];sourceReports:Row[];employees:Row[];manager:boolean;busy:boolean;open:(row:Row)=>void;onConfirm:(items:ReviewSelection[])=>Promise<any>;t:(s:string)=>string}){
 const [checked,setChecked]=useState<Record<string,ReviewSelection>>({}),[delays,setDelays]=useState<Record<string,string>>({}),[result,setResult]=useState(''),[submitting,setSubmitting]=useState(false);
 const latch=useRef(false),generation=useRef(0);
 const groups=useMemo(()=>groupReviewDays(reports),[reports]);
 const [context,setContext]=useState({sourceReports,order,manager});
 if(context.sourceReports!==sourceReports||context.order!==order||context.manager!==manager){generation.current++;setContext({sourceReports,order,manager});setChecked({});setDelays({});}
 useEffect(()=>()=>{generation.current++;},[]);
 const items=Object.values(checked),locked=busy||submitting;
 const reason=(r:Row)=>delays[r.id]??r.delayReason??'';
 const eligible=(r:Row)=>manager&&!reviewEligibility(order,r,reason(r));
 const entry=(r:Row)=>({report:r,expectedReview:reviewSnapshot(order,r),delayReason:reason(r)});
 const toggle=(r:Row,value:boolean)=>setChecked(old=>{const next={...old};if(value&&eligible(r))next[r.id]=entry(r);else delete next[r.id];return next;});
 async function confirm(){
  if(latch.current||locked||!manager||!items.length)return;
  // Capture exactly the explicitly selected rows. Never substitute a refreshed/new report.
  const selected=items.filter(item=>eligible(item.report)&&reviewSnapshot(order,item.report)===item.expectedReview);
  if(selected.length!==items.length){setChecked({});setResult('Dữ liệu đã thay đổi. Kiểm tra và chọn lại.');return;}
  latch.current=true;setSubmitting(true);const started=generation.current;
  try{const outcome=await onConfirm(selected);if(!outcome?.ignored){const ok=outcome?.results?.filter((r:Row)=>r.ok).length||0,fail=outcome?.results?.filter((r:Row)=>!r.ok)||[];setResult(`Đã xác nhận ${ok}/${selected.length} phiếu.${fail.length?` Cần kiểm tra lại: ${fail.map((r:Row)=>`${r.id}${r.uncertain?" (chưa rõ kết quả)":" (không thành công)"}: ${r.error}`).join('; ')}. Kiểm tra lại trước khi chọn.`:''} ${outcome?.refreshError||outcome?.error||''}`);}}
  catch{if(started===generation.current)setResult('Không rõ kết quả. Cập nhật dữ liệu và kiểm tra lại trước khi xác nhận.');}
  finally{setChecked({});latch.current=false;setSubmitting(false);}
 }
 if(!reports.length)return <p className="production-attendance-note">{t('Không có báo công trong nhóm này.')}</p>;
 return <div className="report-day-review">
 {groups.map(group=>{const candidates=group.reports.filter((r:Row)=>eligible(r)&&!r.estimatedStaffing&&!(r.sourceVerified&&r.hours?.sourceTotal)),all=candidates.length>0&&candidates.every((r:Row)=>checked[r.id]);return <details key={group.key} className="report-day-group" open>
 <summary><strong>{t('Ngày sản xuất')}: {group.day?group.day.split('-').reverse().join('/') : t('Chưa xác định')}</strong><span>Line {order.line} · {order.lsxCode}</span><span>{group.reports.filter(pendingReportReview).length} {t('phiếu chờ kiểm tra')} · {t('SL thành phẩm')}: {num(group.reports.reduce((sum:number,r:Row)=>sum+Number(r.reportedQuantity||0),0))}</span></summary>
 <label className="report-day-select"><input type="checkbox" checked={all} disabled={locked||!manager||!candidates.length} onChange={e=>{const value=e.target.checked;setChecked(old=>{const next={...old};for(const r of candidates){if(value)next[r.id]=entry(r);else delete next[r.id];}return next;});}}/>{t('Chọn tất cả phiếu đủ điều kiện trong ngày')} ({candidates.length})</label>
 <DataTable className="table-wrap report-day-table" tabIndex={0} role="region" aria-label={`${t('Báo công ngày')} ${group.day}`}><table className="production-table progress-report-table" data-no-pagination="true"><thead><tr>{['Đã kiểm tra','Công đoạn','Xuất trạm','SL thành phẩm','Nhân viên','Giờ HC / TC','Tổng giờ','Người báo (ID)','Trạng thái','Người xác nhận','Lúc xác nhận','KHSX / Kho','Chi tiết'].map(s=><th key={s}>{t(s)}</th>)}</tr></thead><tbody>{group.reports.map((r:Row)=>{const waiting=pendingReportReview(r),blocker=reviewEligibility(order,r,reason(r)),needsDelay=reportRequiresDelayReason(order,r);return <Fragment key={r.id}><tr>
 <DataCell><label className="report-checked"><input type="checkbox" checked={Boolean(checked[r.id])} disabled={locked||!manager||!!blocker} onChange={e=>toggle(r,e.target.checked)} aria-label={`${t('Đã kiểm tra')} ${r.stageName||r.stageCode||''} ${r.id}`}/>{t('Đã kiểm tra')}</label></DataCell>
 <DataCell><strong>{r.stageName||r.stageCode||t('Chưa ghi nhận')}</strong></DataCell><DataCell kind="date">{productionDisplayTime(r.completedAt)}<small>{t('Bắt đầu')}: {productionDisplayTime(r.startedAt)}</small></DataCell><DataCell kind="number">{num(r.reportedQuantity)}</DataCell>
 <DataCell><ProductionEmployeeCount row={r} employees={employees} t={t}/><small>{t('Theo khoảng báo công')}</small></DataCell><DataCell>{r.hours?`${num(r.hours.hc)} / ${num(r.hours.ot)}`:t('Chưa đủ dữ liệu giờ công')}</DataCell><DataCell kind="number">{num(r.hours?.total)}</DataCell><DataCell>{productionEntryActorId(r)||t('Chưa ghi nhận')}</DataCell>
 <DataCell><span className={`progress-state progress-state-${r.reviewStatus==='Đã xác nhận'?'completed':waiting?'review':'incident'}`}>{t(r.reviewStatus)}</span>{waiting&&blocker&&<small className="progress-blocker">{t(blocker)}</small>}{r.sourceVerified&&r.hours?.sourceTotal&&<small>{t('Tổng giờ nguồn; chưa có chi tiết giờ từng nhân viên.')}</small>}{waiting&&needsDelay&&<label className="progress-delay">{t('Lý do trễ')} *<input disabled={locked||!manager} value={reason(r)} onChange={e=>{setDelays(old=>({...old,[r.id]:e.target.value}));toggle(r,false);}}/></label>}</DataCell>
 <DataCell>{r.reviewStatus==='Đã xác nhận'?(productionConfirmationActorId(r)||t('Chưa ghi nhận')):'—'}</DataCell><DataCell kind="date">{r.reviewStatus==='Đã xác nhận'?productionDisplayTime(r.reviewedAt||r.confirmationBasis?.at):'—'}</DataCell><DataCell>{t(r.reviewStatus==='Đã xác nhận'?'Đã đồng bộ':'Chưa đồng bộ')}<small>{t(r.warehouseStatus||'Chưa tạo phiếu')}</small></DataCell><DataCell><FeedbackActionButton type="button" onClick={()=>open(r)}>{t('Xem báo công')}</FeedbackActionButton></DataCell></tr>{r.note&&<tr className="progress-report-note"><DataCell colSpan={13}>{t('Ghi chú')}: {r.note}</DataCell></tr>}</Fragment>;})}</tbody></table></DataTable>
 </details>;})}
 <div className="report-review-toolbar"><strong aria-live="polite">{t('Đã chọn')} {items.length} {t('phiếu')} · {items.length?1:0} {t('lệnh')} · {new Set(items.map(item=>groupReviewDays([item.report])[0].day)).size} {t('ngày')}</strong><FeedbackActionButton type="button" className="primary-button" disabled={locked||!manager||!items.length} onClick={()=>void confirm()}>{submitting?t('Đang xác nhận…'):`${t('Xác nhận đã chọn')} (${items.length})`}</FeedbackActionButton></div>
 <p>{t('Tích chọn chưa xác nhận. Chỉ ghi người duyệt và đồng bộ khi bấm xác nhận.')}</p>{!manager&&<p>{t('Bạn không có quyền xác nhận báo công.')}</p>}{result&&<p role="status" className="production-inline-message">{result}</p>}
 </div>;
}
