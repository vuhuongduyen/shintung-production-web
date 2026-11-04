'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {DataTable} from './onspa-ui/DataTable';import {DataCell} from './onspa-ui/DataCell';
import {FeedbackActionButton} from './action-feedback';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {paginationModel} from '../lib/pagination-presentation.mjs';
import ProductionDateTimeInput from './production-date-time-input';
import QuantityProgress from './quantity-progress';
import {dailyOutputTotalsIndex} from '../lib/production-daily-output.mjs';
import {isDailyOutput} from '../lib/production-report-model.mjs';
import {postProductionCommand} from '../lib/production-command.mjs';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {apiFetch} from '../lib/data-sync';
type Row=Record<string,any>;
type Draft={dateTime:string;quantity:string;token:string;revision:string;error:string;uncertain:boolean};
const nowLocal=()=>new Date(Date.now()+25200000).toISOString().slice(0,16);
const number=(value:number)=>value.toLocaleString('vi-VN');
export default function ProductionDailyBoard({orders,reports,policy,allowed,active,owner,onSaved,openDetail,onEditingChange}:{orders:Row[];reports:Row[];policy:Row;allowed:boolean;active:boolean;owner:object;onSaved:(result:Row)=>void;openDetail:(row:Row)=>void;onEditingChange:(open:boolean)=>void}){
 const [selected,setSelected]=useState<Row|null>(null),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const [page,setPage]=useState(1);
 const model=paginationModel(orders.length,page,10),visible=orders.slice((model.current-1)*10,model.current*10);
 useEffect(()=>{if(page!==model.current)setPage(model.current);},[page,model.current]);
 const running=useRef(false),mounted=useRef(true),trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{onEditingChange(!!selected);return()=>onEditingChange(false);},[selected,onEditingChange]);
 useEffect(()=>{if(!active&&!saving&&!drafts[selected?.id||'']?.uncertain)setSelected(null);},[active,saving,drafts,selected]);
 const totalsByOrder=useMemo(()=>dailyOutputTotalsIndex(orders,reports),[orders,reports]);
 const draft=selected?drafts[selected.id]:null,current=selected?orders.find(o=>o.id===selected.id):null;
 const stale=!!draft&&!!current&&draft.revision!==current.revision;
 const newDraft=(order:Row):Draft=>({dateTime:nowLocal(),quantity:'',token:productionRequestId(),revision:order.revision,error:'',uncertain:false});
 function open(order:Row,event:React.MouseEvent<HTMLButtonElement>){trigger.current=event.currentTarget;setDrafts(old=>({...old,[order.id]:old[order.id]||newDraft(order)}));setSelected(order);setNotice('');}
 function change(patch:Partial<Draft>){if(!selected||!draft||draft.uncertain||saving)return;setDrafts(old=>({...old,[selected.id]:{...old[selected.id],...patch,token:productionRequestId(),error:''}}));}
 async function submit(event:React.FormEvent){event.preventDefault();if(!selected||!draft||!allowed||!active||running.current||stale&&!draft.uncertain)return;
  const order=selected,id=order.id,value=Number(draft.quantity);
  if(!draft.quantity.trim()||!Number.isSafeInteger(value)||value<=0){setDrafts(old=>({...old,[id]:{...old[id],error:'Nhập SL phát sinh là số nguyên lớn hơn 0.'}}));return;}
  running.current=true;setSaving(true);
  try{
   const result=await postProductionCommand({action:'daily-output',orderId:id,productionDate:draft.dateTime.slice(0,10),productionLocalDateTime:draft.dateTime,quantity:value,expectedOrderRevision:draft.revision,requestIdempotency:draft.token},(path:string,init:RequestInit)=>apiFetch(path,init,owner));
   if(!result.report?.id||!isDailyOutput(result.report)||result.report.transitId!==id)throw Object.assign(new Error('Chưa xác nhận được phiếu trả về. Giữ nguyên lượt gửi để đối chiếu.'),{uncertain:true});
   if(!mounted.current)return;try{onSaved(result);}catch{setNotice('Phiếu đã ghi nhận. Chưa cập nhật được màn hình; tải lại để đối chiếu.');}setDrafts(old=>{const next={...old};delete next[id];return next;});setNotice(`Đã ghi nhận ${number(result.report.reportedQuantity)} thành phẩm cho ${order.lsxCode}, ngày ${result.report.productionDate.split('-').reverse().join('/')}.${result.report.rateStatus==='missing'?' Thiếu căn cứ định mức: sản lượng vẫn được ghi, phần này chưa tính tiền.':''}`);setSelected(old=>old?.id===id?null:old);
  }catch(error:any){if(mounted.current)setDrafts(old=>({...old,[id]:{...old[id],error:error?.message||'Chưa xác nhận được kết quả lưu.',uncertain:old[id].uncertain||error?.uncertain===true}}));}
  finally{running.current=false;if(mounted.current)setSaving(false);}
 }
 return <section className="data-card daily-output-board">
  {notice&&<p role="status" className="production-attendance-note">{notice}</p>}
  <DataTable className="table-wrap"><table className="production-table" data-no-pagination="true"><thead><tr>{['Báo công','Lệnh sản xuất','SKU','Tên sản phẩm','Line','SL lệnh','SL hoàn thành SX','KH bắt đầu','KH hoàn thành'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(order=>{const totals=totalsByOrder.get(order.id)!,blocked=!allowed||saving||order.status==='HỦY'||totals.reported>=Number(order.lsxQty)&&!drafts[order.id]?.uncertain;return <tr key={order.id}><DataCell><FeedbackActionButton type="button" className="work-action-trigger" aria-label={`Báo công · ${order.lsxCode}`} disabled={blocked} disabledExplanation={!allowed?'Bạn chưa có quyền báo sản lượng.':saving?'Đang xử lý, vui lòng chờ.':order.status==='HỦY'?'Lệnh đã hủy.':'Lệnh đã báo đủ số lượng, cần đối chiếu các phiếu đã ghi.'} onClick={event=>open(order,event)}>Báo công</FeedbackActionButton></DataCell><DataCell kind="code"><FeedbackActionButton type="button" onClick={()=>openDetail(order)}>{order.lsxCode}</FeedbackActionButton></DataCell><DataCell>{order.sku}</DataCell><DataCell>{order.name}</DataCell><DataCell>{order.line}</DataCell><DataCell kind="number">{number(Number(order.lsxQty)||0)}</DataCell><DataCell><QuantityProgress value={totals.reported} total={Number(order.lsxQty)} approved={totals.approved} pending={totals.pending}/></DataCell><DataCell kind="date">{order.planStart||'—'}</DataCell><DataCell kind="date">{order.planEnd||'—'}</DataCell></tr>;})}{!orders.length&&<tr><DataCell colSpan={9}>Chưa có LSX phù hợp.</DataCell></tr>}</tbody></table></DataTable><ManualPagination total={orders.length} page={model.current} pageSize={10} onPageChange={setPage}/>
  <Dialog open={!!selected&&active} onOpenChange={value=>{if(!value&&!saving&&!draft?.uncertain)setSelected(null);}}><DialogContent className="production-modal" onCloseAutoFocus={event=>{event.preventDefault();if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});}}><header><DialogTitle>Báo công · {selected?.lsxCode}</DialogTitle></header><div className="production-modal-body"><DialogDescription>Nhập số thành phẩm phát sinh trong ngày, không nhập số lũy kế. Phiếu sẽ chờ QLSX kiểm tra.</DialogDescription>
   {draft&&selected&&<form onSubmit={submit}><label>Ngày giờ sản xuất (GMT+7)<ProductionDateTimeInput label="Ngày giờ sản xuất" value={draft.dateTime} min={`${policy.effectiveFrom}T00:00`} max={nowLocal()} disabled={saving||draft.uncertain} onChange={dateTime=>change({dateTime})}/></label><label>SL phát sinh<input required type="number" min={1} step={1} value={draft.quantity} disabled={saving||draft.uncertain} onChange={event=>change({quantity:event.target.value})}/></label>
    {draft.error&&<p role="alert">{draft.error}</p>}{draft.uncertain&&<p role="status">Chưa rõ kết quả lần gửi trước. Dữ liệu và mã thao tác được giữ; thử lại đúng lượt này để đối chiếu, không tạo phiếu mới.</p>}
    {!current&&<p role="alert">Lệnh không còn trong kết quả hiện tại. Đóng và tải lại để đối chiếu; bản nháp vẫn được giữ.</p>}
    {stale&&!draft.uncertain&&<div role="alert">Lệnh đã thay đổi. Kiểm tra lại số lượng/ngày trước khi ghi. <FeedbackActionButton type="button" onClick={()=>setDrafts(old=>({...old,[selected.id]:{...old[selected.id],revision:current!.revision,token:productionRequestId(),error:''}}))}>Đã kiểm tra lệnh mới</FeedbackActionButton></div>}
    <div className="production-form-actions"><FeedbackActionButton type="button" disabled={saving||draft.uncertain} disabledExplanation="Đang đối chiếu kết quả lưu. Giữ lượt gửi hiện tại để tránh tạo phiếu trùng." onClick={()=>setSelected(null)}>Đóng</FeedbackActionButton><FeedbackActionButton type="submit" className="primary-button" disabled={!allowed||saving||!current&&!draft.uncertain||stale&&!draft.uncertain} disabledExplanation={!allowed?'Chưa có quyền báo sản lượng.':saving?'Đang gửi, vui lòng chờ.':'Lệnh đã thay đổi hoặc không còn trong kết quả. Kiểm tra và tải lại trước khi ghi.'}>{saving?'Đang ghi nhận…':draft.uncertain?'Đối chiếu / thử lại lượt cũ':'Ghi nhận sản lượng'}</FeedbackActionButton></div>
   </form>}
  </div></DialogContent></Dialog>
 </section>;
}
