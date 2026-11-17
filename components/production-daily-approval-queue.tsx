'use client';
import './production-daily-approval-queue.css';
import {Fragment,useRef,useState} from 'react';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {FeedbackActionButton} from './action-feedback';
import {reviewEligibility,reviewSnapshot} from '../lib/production-review-selection.mjs';
import {reportRequiresDelayReason} from '../lib/production-progress-review.mjs';
import {productionEntryActorId} from '../lib/production-actor.mjs';
import {outputDate} from '../lib/production-output-summary.mjs';
import type {ReviewSelection} from './production-report-day-review';
type Row=Record<string,any>;
export type DailyApprovalEntry={order:Row;report:Row};
const num=(n:any)=>Number(n||0).toLocaleString('vi-VN');
export default function ProductionDailyApprovalQueue({entries,manager,busy,onConfirm,t,page,onPageChange}:{entries:DailyApprovalEntry[];manager:boolean;busy:boolean;onConfirm:(items:ReviewSelection[])=>Promise<any>;t:(s:string)=>string;page:number;onPageChange:(page:number)=>void}){
 const [reasons,setReasons]=useState<Record<string,string>>({}),[saving,setSaving]=useState(''),[message,setMessage]=useState('');
 const latch=useRef(false);
 const sorted=[...entries].sort((a,b)=>(outputDate(a.report)||'9999').localeCompare(outputDate(b.report)||'9999')||String(a.order.lsxCode).localeCompare(String(b.order.lsxCode))||String(a.report.productionAt||'').localeCompare(String(b.report.productionAt||''))||String(a.report.id).localeCompare(String(b.report.id)));
 const current=Math.min(page,Math.max(1,Math.ceil(sorted.length/20))),rows=sorted.slice((current-1)*20,current*20);
 const reason=(r:Row)=>reasons[r.id]??r.delayReason??'';
 async function confirm(entry:DailyApprovalEntry){
  const {order,report}=entry;
  if(latch.current||busy||!manager||reviewEligibility(order,report,reason(report)))return;
  latch.current=true;setSaving(report.id);setMessage('');
  try{
   const outcome=await onConfirm([{report,expectedReview:reviewSnapshot(order,report),delayReason:reason(report)}]);
   if(outcome?.ignored)return;
   const result=outcome?.results?.find((r:Row)=>r.id===report.id);
   setMessage(result?.ok?`${t('Đã xác nhận')} ${order.lsxCode} · ${num(report.reportedQuantity)}. ${outcome.refreshError||''}`:result?.error||outcome?.error||t('Không rõ kết quả. Tải lại và kiểm tra trước khi xác nhận lại.'));
  }catch{setMessage(t('Không rõ kết quả. Tải lại và kiểm tra trước khi xác nhận lại.'));}
  finally{latch.current=false;setSaving('');}
 }
 return <section className="data-card daily-approval-queue" aria-label={t('Sản lượng chờ xác nhận theo ngày')}>
 <DataTable className="table-wrap"><table className="production-table" data-no-pagination="true"><colgroup>{[96,124,124,null,110,52,90,116,120,null].map((width,index)=><col key={index} style={width?{width}:undefined}/>)}</colgroup><thead><tr>{['Xác nhận','LSX','SKU','Tên sản phẩm','Quy cách','Line','SL lệnh','SL chờ xác nhận','Người báo (ID)','Ghi chú'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>
 {rows.map((entry,index)=>{const {order,report}=entry,day=outputDate(report),blocker=reviewEligibility(order,report,reason(report));return <Fragment key={report.id}>
 {(index===0||outputDate(rows[index-1].report)!==day)&&<tr className="it-week-divider progress-week-divider"><th colSpan={10}>{t('Ngày hoàn thành')}: {day?day.split('-').reverse().join('/'):t('Chưa xác định')}</th></tr>}
 <tr><DataCell><FeedbackActionButton type="button" className="primary-button" aria-label={`${t('Xác nhận')} ${order.lsxCode} ${num(report.reportedQuantity)}`} disabled={busy||!!saving||!manager||!!blocker} disabledExplanation={!manager?t('Bạn không có quyền xác nhận báo công.'):blocker?t(blocker):t('Đang xử lý. Vui lòng chờ hoàn tất.')} onClick={()=>void confirm(entry)}>{t(saving===report.id?'Đang xác nhận…':'Xác nhận')}</FeedbackActionButton></DataCell>
 <DataCell kind="code">{order.lsxCode}</DataCell><DataCell kind="code">{order.sku}</DataCell><DataCell>{order.name}</DataCell><DataCell>{order.spec||'—'}</DataCell><DataCell>{order.line}</DataCell><DataCell kind="number">{num(order.lsxQty)}</DataCell><DataCell kind="number"><strong>{num(report.reportedQuantity)}</strong></DataCell><DataCell>{productionEntryActorId(report)||'—'}</DataCell>
 <DataCell>{report.note||'—'}{blocker&&<small className="progress-blocker">{t(blocker)}</small>}{reportRequiresDelayReason(order,report)&&<label className="progress-delay">{t('Lý do trễ')} *<input aria-label={`${t('Lý do trễ')} ${order.lsxCode} ${num(report.reportedQuantity)}`} disabled={busy||!!saving||!manager} value={reason(report)} onChange={e=>setReasons(old=>({...old,[report.id]:e.target.value}))}/></label>}</DataCell></tr></Fragment>;})}
 {!rows.length&&<tr data-no-data="true"><DataCell colSpan={10}>{t('Không có báo công chờ kiểm tra. Chọn Tất cả LSX để xem tiến độ.')}</DataCell></tr>}
 </tbody></table></DataTable><ManualPagination total={sorted.length} page={current} pageSize={20} onPageChange={onPageChange}/>
 {message&&<p role="status" className="production-inline-message">{message}</p>}
 </section>;
}
