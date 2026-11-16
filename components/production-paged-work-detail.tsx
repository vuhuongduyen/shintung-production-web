'use client';
import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {FeedbackActionButton} from './action-feedback';
import {productionApiFetch} from '../lib/production-api';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {isDailyOutput} from '../lib/production-report-model.mjs';
type Row=Record<string,any>;
const number=(n:any)=>n==null?'—':Number(n).toLocaleString('vi-VN',{maximumFractionDigits:4});
const time=(s:any)=>productionDisplayTime(s,'—');
export default function ProductionPagedWorkDetail({order,active,onClose}:{order:Row;active:boolean;onClose:()=>void}){
 const [kind,setKind]=useState('reports'),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[state,setState]=useState<Row|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');const generation=useRef(0);
 const key=JSON.stringify([order.id,kind,page]);
 useEffect(()=>{if(!active)return;const version=++generation.current,controller=new AbortController();setLoading(true);setError('');
  const query=new URLSearchParams({orderId:order.id,kind,page:String(page)});
  void productionApiFetch('/api/production-order-pages?'+query,{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Không tải được chi tiết.'),{status:response.status});if(version!==generation.current)return;
   if(!Array.isArray(data.reports)||!Array.isArray(data.events)||!data.orders?.some((r:Row)=>r.id===order.id)||!Number.isSafeInteger(data.total))throw Error('Phản hồi chi tiết không hợp lệ.');
   setState({...data,key});setPage(data.page);setLoading(false);
  }).catch(e=>{if(version!==generation.current||controller.signal.aborted)return;if(e.status===401||e.status===403)setState(null);setError(e.message);setLoading(false);});
  return()=>{generation.current++;controller.abort();};
 },[order.id,kind,page,active,retry,key]);
 const current=state?.key===key?state:null,rows=current?(kind==='reports'?current.reports:current.events):[],shown=current?.orders[0]||order;
 return <Dialog open={active} onOpenChange={value=>{if(!value)onClose();}}><DialogContent className="production-modal production-detail-modal"><DialogTitle>Chi tiết · {order.lsxCode}</DialogTitle><DialogDescription>{order.sku} · {order.name} · Line {order.line}</DialogDescription><div className="production-modal-body">
  <p>SL lệnh: {number(shown.lsxQty)} · Đã duyệt: {number(current?.totals.approved??order.serverSummary.totals.approved)} · Chờ duyệt: {number(current?.totals.pending??order.serverSummary.totals.pending)}</p>
  <div className="actual-tabs"><FeedbackActionButton type="button" className={kind==='reports'?'selected':''} onClick={()=>{setKind('reports');setPage(1);}}>Phiếu báo công</FeedbackActionButton><FeedbackActionButton type="button" className={kind==='events'?'selected':''} onClick={()=>{setKind('events');setPage(1);}}>Lịch sử thao tác</FeedbackActionButton></div>
  {error&&<div role="alert" className="production-inline-message error">{error} <FeedbackActionButton type="button" disabled={loading} onClick={()=>setRetry(n=>n+1)}>Thử lại</FeedbackActionButton></div>}
  {loading&&!current&&<p role="status">Đang tải chi tiết của lệnh…</p>}
  {current&&<><DataTable className="table-wrap production-table-wrap"><table className="production-table" aria-label={kind==='reports'?'Phiếu của lệnh · trang đang xem':'Lịch sử của lệnh · trang đang xem'}><thead><tr>{(kind==='reports'?['Ngày giờ sản xuất','Sản lượng phát sinh','Đã duyệt','Trạng thái','Người ghi nhận','Chi tiết đã lưu']:['Thời điểm','Thao tác','Công đoạn cũ','Sản lượng','Người thao tác','Ghi chú']).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:Row)=>kind==='reports'?<tr key={r.id}><DataCell>{time(isDailyOutput(r)?r.productionAt||r.productionDate:r.completedAt)}</DataCell><DataCell kind="number">{number(r.reportedQuantity)}</DataCell><DataCell kind="number">{r.reviewStatus==='Đã xác nhận'?number(r.approvedQuantity??r.reportedQuantity):'—'}</DataCell><DataCell>{r.cancelled||r.voided?'Đã hủy':r.reviewStatus}</DataCell><DataCell>{r.reportedById||r.actorId||r.reportedBy||'Chưa ghi nhận'}</DataCell><DataCell><details><summary>Xem chi tiết</summary>{!isDailyOutput(r)&&<p>Công đoạn cũ: {r.stageName||r.stageCode||'—'} · Giờ công đã lưu: {number(r.hours?.total)}</p>}<p>Giờ công/SP: {number(isDailyOutput(r)?r.rateBasis?.value:r.standardUnit)}</p>{(r.rateStatus==='missing'||isDailyOutput(r)&&r.rateBasis?.value==null)&&<p>Thiếu căn cứ định mức</p>}{r.note&&<p>{r.note}</p>}{r.delayReason&&<p>Lý do trễ: {r.delayReason}</p>}{r.laborNotes?.map((n:Row,i:number)=><p key={n.eventId||i}>{n.text}</p>)}</details></DataCell></tr>:<tr key={r.id}><DataCell>{time(r.effectiveAt||r.recordedAt)}</DataCell><DataCell>{r.sourceOperation||r.stageAction||r.kind}</DataCell><DataCell>{r.stageName||r.stageCode||'—'}</DataCell><DataCell kind="number">{number(r.quantity)}</DataCell><DataCell>{r.actorId||r.actor||'Chưa ghi nhận'}</DataCell><DataCell>{r.reason||'—'}</DataCell></tr>)}{!rows.length&&<tr><DataCell colSpan={6}>Chưa có dữ liệu trong phạm vi này.</DataCell></tr>}</tbody></table></DataTable><ManualPagination total={current.total} page={current.page} pageSize={current.pageSize} onPageChange={setPage} disabled={loading}/></>}
 </div></DialogContent></Dialog>;
}
