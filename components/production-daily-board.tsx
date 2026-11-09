'use client';
import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {DataTable} from './onspa-ui/DataTable';import {DataCell} from './onspa-ui/DataCell';
import {FeedbackActionButton} from './action-feedback';
import {mutationFailureMessage} from '../lib/action-feedback';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {monday,weekEnd,weekNumber,displayDate} from '../lib/production-plan.mjs';
import {paginationModel} from '../lib/pagination-presentation.mjs';
import ProductionDateTimeInput from './production-date-time-input';
import QuantityProgress from './quantity-progress';
import ProductionStatusLegend from './production-status-legend';
import {productionOrderIndex} from '../lib/production-order-index.mjs';
import {productionRuntime} from '../lib/production-runtime.mjs';
import {productionProgressDisplay} from '../lib/production-progress-display.mjs';
import {progressOrderStatus} from '../lib/production-progress-review.mjs';
import {dailyOutputTotalsIndex} from '../lib/production-daily-output.mjs';
import {isDailyOutput} from '../lib/production-report-model.mjs';
import {postProductionCommand} from '../lib/production-command.mjs';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {apiFetch} from '../lib/data-sync';
type Row=Record<string,any>;
const noEvents:Row[]=[];
type Draft={dateTime:string;quantity:string;token:string;revision:string;error:string;errorStatus?:number;uncertain:boolean};
function saveGuidance(draft:Draft){
 if(draft.uncertain)return 'Giữ nguyên số lượng, ngày giờ và lượt gửi. Bấm “Đối chiếu / thử lại lượt cũ” để kiểm tra kết quả; không nhập lại thành phiếu mới.';
 if(draft.errorStatus===401)return 'Chép lại số lượng và ngày giờ đang nhập. Đăng nhập lại đúng tài khoản, mở SX báo công và chọn mã lệnh để kiểm tra các phiếu/ngày đã ghi trước khi gửi lại.';
 if(draft.errorStatus===403)return 'Kiểm tra tài khoản đang đăng nhập và Line của lệnh. Nếu đăng nhập nhầm, chép lại nội dung rồi đăng nhập đúng tài khoản được giao. Nếu vẫn bị chặn, gửi mã lệnh, Line và thông báo này để kiểm tra quyền; không gửi lại liên tục.';
 if(draft.errorStatus===409)return 'Đối chiếu SL lệnh và SL hoàn thành. Chép lại số lượng/ngày giờ, đóng khung rồi tải lại trang SX báo công. Mở Báo công đúng lệnh, kiểm tra phần còn lại và sửa số lượng trước khi bấm Lưu.';
 if(draft.errorStatus===400||draft.errorStatus===422)return 'Kiểm tra Số lượng nhập: dùng số nguyên lớn hơn 0 và không vượt phần còn lại của lệnh. Kiểm tra Ngày giờ sản xuất không ở tương lai, sửa ô báo lỗi rồi bấm Lưu.';
 if(draft.errorStatus===429)return 'Giữ khung và nội dung đang nhập, chờ một lúc rồi bấm Lưu một lần. Không bấm liên tục.';
 return 'Giữ nội dung đang nhập. Chọn mã lệnh ở SX báo công để mở Chi tiết và đối chiếu các phiếu đúng ngày; chỉ gửi lại nếu chưa có phiếu tương ứng. Nếu còn lỗi, chép thông báo và thời điểm thao tác để đối chiếu, không nhập thêm phiếu trùng.';
}
const nowLocal=()=>new Date(Date.now()+25200000).toISOString().slice(0,16);
const number=(value:number)=>value.toLocaleString('vi-VN');
export default function ProductionDailyBoard({orders,reports,policy,allowed,active,owner,onSaved,openDetail,onEditingChange,onNotice,events=noEvents,runtimeFor}:{orders:Row[];reports:Row[];policy:Row;allowed:boolean;active:boolean;owner:object;onSaved:(result:Row)=>void;openDetail:(row:Row)=>void;onEditingChange:(open:boolean)=>void;onNotice?:(text:string)=>void;events?:Row[];runtimeFor?:(row:Row)=>Row}){
 const [selected,setSelected]=useState<Row|null>(null),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[saving,setSaving]=useState(false),[notice,setInlineNotice]=useState('');
 const setNotice=(text:string)=>{setInlineNotice(text);onNotice?.(text);};
 const [page,setPage]=useState(1);
 const sorted=useMemo(()=>orders.slice().sort((a,b)=>(monday(a.week)||'unassigned').localeCompare(monday(b.week)||'unassigned')),[orders]);
 const model=paginationModel(sorted.length,page,10),visible=sorted.slice((model.current-1)*10,model.current*10);
 useEffect(()=>{if(page!==model.current)setPage(model.current);},[page,model.current]);
 const running=useRef(false),mounted=useRef(true),trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{onEditingChange(!!selected);return()=>onEditingChange(false);},[selected,onEditingChange]);
 useEffect(()=>{if(!active&&!saving&&!drafts[selected?.id||'']?.uncertain)setSelected(null);},[active,saving,drafts,selected]);
 const totalsByOrder=useMemo(()=>dailyOutputTotalsIndex(orders,reports),[orders,reports]);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 const orderIndex=useMemo(()=>productionOrderIndex(orders,reports,events,`${today}T00:00:00+07:00`),[orders,reports,events,today]);
 const presentation=useMemo(()=>new Map(orders.map(order=>{
  const ownEvents=orderIndex.eventsByOrder.get(order.id)||[],summary=orderIndex.summaryFor(order),runtime=runtimeFor?runtimeFor(order):productionRuntime(order,ownEvents);
  // Same badge, due-date priority and cancellation semantics as the original work board.
  const badge=order.status==='HỦY'?{label:'Đã hủy',tone:'cancelled'}:!runtime.known&&!orderIndex.reportsByOrder.has(order.id)&&productionProgressDisplay(order.progressStatus)||progressOrderStatus(summary,runtime,ownEvents);
  const deadline=order.status==='HỦY'||!order.planEnd?null:order.planEnd<today?'danger':order.planEnd===today?'warning':'upcoming';
  const overdue=order.status!=='HỦY'&&!summary.completedAt&&deadline==='danger'&&Number(order.inTransitQty||0)>0;
  return [order.id,{badge,deadline,overdue}];
 })),[orders,orderIndex,runtimeFor,today]);
 const exportJson=useMemo(()=>JSON.stringify({title:'SX báo công',headers:['Lệnh sản xuất','SKU','Tên SP','Quy cách','Line','Ghi chú','Thứ tự SX','SL lệnh','SL hoàn thành','KH bắt đầu','KH hoàn thành','Trạng thái','Plan ID'],rows:sorted.map(order=>[order.lsxCode,order.sku,order.name,order.spec||'—',order.line,order.planningNote||'—',order.sequence??'—',Number(order.lsxQty)||0,totalsByOrder.get(order.id)!.approved+totalsByOrder.get(order.id)!.pending,order.planStart||'',order.planEnd||'',presentation.get(order.id)!.badge.label,order.planId||'—'])}),[sorted,totalsByOrder,presentation]);
 function statusBadge(order:Row,mobile=false){const state=presentation.get(order.id)!;return <span className={`onspa-progress onspa-progress-${state.overdue?'overdue':state.badge.tone}`} title={(mobile?state.deadline==='danger':state.overdue)?'Quá hạn':undefined}>{state.badge.label}</span>;}
 const draft=selected?drafts[selected.id]:null,current=selected?orders.find(o=>o.id===selected.id):null;
 const stale=!!draft&&!!current&&draft.revision!==current.revision;
 const newDraft=(order:Row):Draft=>({dateTime:nowLocal(),quantity:'',token:productionRequestId(),revision:order.revision,error:'',uncertain:false});
 function open(order:Row,event:React.MouseEvent<HTMLButtonElement>){trigger.current=event.currentTarget;setDrafts(old=>({...old,[order.id]:old[order.id]||newDraft(order)}));setSelected(order);setNotice('');}
 function change(patch:Partial<Draft>){if(!selected||!draft||draft.uncertain||saving)return;setDrafts(old=>({...old,[selected.id]:{...old[selected.id],...patch,token:productionRequestId(),error:'',errorStatus:undefined}}));}
 async function submit(event:React.FormEvent){event.preventDefault();if(!selected||!draft||!allowed||!active||running.current||stale&&!draft.uncertain)return;
  const order=selected,id=order.id,value=Number(draft.quantity);
  if(!draft.quantity.trim()||!Number.isSafeInteger(value)||value<=0){setDrafts(old=>({...old,[id]:{...old[id],error:'Nhập số lượng là số nguyên lớn hơn 0.',errorStatus:422}}));return;}
  running.current=true;setSaving(true);
  try{
   const result=await postProductionCommand({action:'daily-output',orderId:id,productionDate:draft.dateTime.slice(0,10),productionLocalDateTime:draft.dateTime,quantity:value,expectedOrderRevision:draft.revision,requestIdempotency:draft.token},(path:string,init:RequestInit)=>apiFetch(path,init,owner));
   if(!result.report?.id||!isDailyOutput(result.report)||result.report.transitId!==id)throw Object.assign(new Error('Chưa xác nhận được phiếu trả về. Giữ nguyên lượt gửi để đối chiếu.'),{uncertain:true});
   if(!mounted.current)return;let refreshIssue='';try{onSaved(result);}catch{refreshIssue=' Chưa cập nhật được màn hình; tải lại để đối chiếu.';}setDrafts(old=>{const next={...old};delete next[id];return next;});setNotice(`Đã ghi nhận ${number(result.report.reportedQuantity)} thành phẩm cho ${order.lsxCode}, ngày ${result.report.productionDate.split('-').reverse().join('/')}.${result.report.rateStatus==='missing'?' Thiếu căn cứ định mức: sản lượng vẫn được ghi, phần này chưa tính tiền.':''}${refreshIssue}`);setSelected(old=>old?.id===id?null:old);
  }catch(error:any){if(mounted.current)setDrafts(old=>({...old,[id]:{...old[id],error:error?.status>=500?mutationFailureMessage(error.status):error?.message||'Chưa xác nhận được kết quả lưu.',errorStatus:error?.status,uncertain:old[id].uncertain||error?.uncertain===true}}));}
  finally{running.current=false;if(mounted.current)setSaving(false);}
 }
 const weekLabel=(row:Row)=>{const week=monday(row.week);return week?`TUẦN KẾ HOẠCH ${weekNumber(week)}: ${displayDate(week)} – ${displayDate(weekEnd(week))}`:'Tuần kế hoạch chưa xác định';};
 const date=(value:string)=>value?value.slice(0,10).split('-').reverse().join('/'):'—';
 function reportAction(order:Row){const totals=totalsByOrder.get(order.id)!,blocked=!allowed||saving||order.historicalOnly||order.status==='HỦY'||totals.reported+(totals.reserved||0)>=Number(order.lsxQty)&&!drafts[order.id]?.uncertain;return <div className="work-actions"><FeedbackActionButton type="button" className="work-action-trigger" aria-label={`Báo công · ${order.lsxCode}`} disabled={blocked} disabledExplanation={order.historicalOnly?'Lệnh lịch sử chỉ để tra cứu; không ghi sản lượng mới.':!allowed?'Bạn chưa có quyền báo sản lượng.':saving?'Đang xử lý, vui lòng chờ.':order.status==='HỦY'?'Lệnh đã hủy.':'Lệnh đã báo đủ số lượng, cần đối chiếu các phiếu đã ghi.'} onClick={event=>open(order,event)}>Báo công</FeedbackActionButton></div>;}
 return <section className="data-card work-orders daily-output-board">
  {notice&&!onNotice&&<p role="status" className="production-attendance-note">{notice}</p>}
  <DataTable className="table-wrap work-table-wrap"><table className="work-table daily-output-table" data-no-pagination="true" data-report-source={exportJson} data-report-include-hidden={active?"true":undefined}><thead><tr>{['Báo công','Lệnh sản xuất','SKU','Tên SP','Quy cách','Line','Ghi chú','Thứ tự SX','SL lệnh','SL hoàn thành','KH bắt đầu','KH hoàn thành','Trạng thái','Plan ID'].map(label=><th key={label} className={label==='SL hoàn thành'?'work-completed-qty':label==='SL lệnh'?'production-order-qty':label==='Ghi chú'?'production-compact-note':label==='Trạng thái'?'work-status':label==='Tên SP'?'work-product':label==='Lệnh sản xuất'?'work-order-code':label==='Quy cách'?'work-spec':label==='Plan ID'?'work-plan-id':undefined}>{label}{label==='Trạng thái'&&<ProductionStatusLegend/>}</th>)}</tr></thead><tbody>{visible.map((order,index)=>{const totals=totalsByOrder.get(order.id)!;const state=presentation.get(order.id)!;return <Fragment key={order.id}>{(index===0||monday(visible[index-1].week)!==monday(order.week))&&<tr className="it-week-divider work-week-divider"><th colSpan={14}>{weekLabel(order)}</th></tr>}<tr className={`${selected?.id===order.id?'work-selected ':''}${state.deadline==='warning'?'work-due-today':''}`}><DataCell>{reportAction(order)}</DataCell><DataCell kind="code" className="work-order-code"><FeedbackActionButton type="button" className="sku-link" onClick={()=>openDetail(order)}>{order.lsxCode}</FeedbackActionButton>{order.historicalOnly&&<small>Lịch sử · Chỉ xem</small>}</DataCell><DataCell kind="code">{order.sku}</DataCell><DataCell className="work-product">{order.name}</DataCell><DataCell className="work-spec">{order.spec||'—'}</DataCell><DataCell>{order.line}</DataCell><DataCell className="order-planning-note production-compact-note">{order.planningNote?<span className="khsx-planning-note">{order.planningNote}</span>:'—'}</DataCell><DataCell kind="number">{order.sequence??'—'}</DataCell><DataCell kind="number" className="number production-order-qty">{number(Number(order.lsxQty)||0)}</DataCell><DataCell className="work-completed-qty"><QuantityProgress value={totals.approved+totals.pending} total={Number(order.lsxQty)} approved={totals.approved} pending={totals.pending}/></DataCell><DataCell kind="date">{date(order.planStart)}</DataCell><DataCell kind="date" className={state.deadline==='danger'?'work-overdue':undefined}>{date(order.planEnd)}</DataCell><DataCell className="work-status">{statusBadge(order)}</DataCell><DataCell className="work-plan-id">{order.planId||'—'}</DataCell></tr></Fragment>;})}{!orders.length&&<tr><DataCell colSpan={14}>Chưa có LSX phù hợp.</DataCell></tr>}</tbody></table></DataTable>
  <div className="work-mobile-cards">{visible.map((order,index)=>{const totals=totalsByOrder.get(order.id)!;return <Fragment key={order.id}>{(index===0||monday(visible[index-1].week)!==monday(order.week))&&<h3 className="work-mobile-week">{weekLabel(order)}</h3>}<article className={`work-mobile-card ${selected?.id===order.id?'work-selected':''}`}><FeedbackActionButton type="button" className="work-card-title" onClick={()=>openDetail(order)}><b>{order.planId||order.lsxCode}</b><span>{order.lsxCode} · {order.sku} · Line {order.line}</span><strong>{order.name}</strong></FeedbackActionButton><p>Thứ tự SX: {order.sequence??'—'} · SL lệnh: {number(Number(order.lsxQty)||0)}</p><p>SL hoàn thành: <QuantityProgress value={totals.approved+totals.pending} total={Number(order.lsxQty)} approved={totals.approved} pending={totals.pending}/></p>{order.planningNote&&<p className="khsx-planning-note">Ghi chú KHSX: {order.planningNote}</p>}<p>Quy cách: {order.spec||'—'}</p><p>Kế hoạch: {date(order.planStart)} – {date(order.planEnd)}</p>{statusBadge(order,true)}{reportAction(order)}</article></Fragment>;})}</div>
  <ManualPagination total={orders.length} page={model.current} pageSize={10} onPageChange={setPage}/>
  <Dialog open={!!selected&&active} onOpenChange={value=>{if(!value&&!saving&&!draft?.uncertain)setSelected(null);}}><DialogContent className="production-modal production-daily-report-modal" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});}}><header><DialogTitle>Báo công · {selected?.lsxCode}</DialogTitle><span className="production-daily-close-slot"><FeedbackActionButton type="button" className="production-daily-close" aria-label="Đóng báo công" disabled={saving||draft?.uncertain} disabledExplanation="Đang đối chiếu kết quả lưu. Giữ lượt gửi hiện tại để tránh tạo phiếu trùng." onClick={()=>setSelected(null)}><span aria-hidden="true">×</span></FeedbackActionButton></span></header><div className="production-modal-body"><DialogDescription>Nhập số thành phẩm phát sinh trong ngày, không nhập số lũy kế. Phiếu sẽ chờ QLSX kiểm tra.</DialogDescription>
   {draft&&selected&&<form className="production-daily-report-form" onSubmit={submit}><div className="production-daily-report-field"><span>Ngày giờ sản xuất (GMT+7)</span><ProductionDateTimeInput label="Ngày giờ sản xuất" value={draft.dateTime} min={policy.intakeModel==='server-receipt-quantity-v1'?undefined:`${policy.effectiveFrom}T00:00`} max={nowLocal()} disabled={saving||draft.uncertain} onChange={dateTime=>change({dateTime})}/></div><label className="production-daily-report-field"><span>Số lượng nhập</span><input required type="number" min={1} step={1} style={{width:'8rem',maxWidth:'100%'}} value={draft.quantity} disabled={saving||draft.uncertain} onChange={event=>change({quantity:event.target.value})}/></label>
    {draft.error&&<div role="alert"><p><strong>Nguyên nhân:</strong> {draft.error}</p><p><strong>Hướng xử lý:</strong> {saveGuidance(draft)}</p></div>}{draft.uncertain&&<p role="status">Chưa rõ kết quả lần gửi trước. Dữ liệu và mã thao tác được giữ; thử lại đúng lượt này để đối chiếu, không tạo phiếu mới.</p>}
    {!current&&<p role="alert">Lệnh không còn trong kết quả hiện tại. Đóng và tải lại để đối chiếu; bản nháp vẫn được giữ.</p>}
    {stale&&!draft.uncertain&&<div role="alert">Lệnh đã thay đổi. Kiểm tra lại số lượng/ngày trước khi ghi. <FeedbackActionButton type="button" onClick={()=>setDrafts(old=>({...old,[selected.id]:{...old[selected.id],revision:current!.revision,token:productionRequestId(),error:''}}))}>Đã kiểm tra lệnh mới</FeedbackActionButton></div>}
    <div className="production-form-actions"><FeedbackActionButton type="button" disabled={saving||draft.uncertain} disabledExplanation="Đang đối chiếu kết quả lưu. Giữ lượt gửi hiện tại để tránh tạo phiếu trùng." onClick={()=>setSelected(null)}>Đóng</FeedbackActionButton><FeedbackActionButton type="submit" className="primary-button" disabled={!allowed||saving||!current&&!draft.uncertain||stale&&!draft.uncertain} disabledExplanation={!allowed?'Chưa có quyền báo sản lượng.':saving?'Đang gửi, vui lòng chờ.':'Lệnh đã thay đổi hoặc không còn trong kết quả. Kiểm tra và tải lại trước khi ghi.'}>{saving?'Đang lưu…':draft.uncertain?'Đối chiếu / thử lại lượt cũ':'Lưu'}</FeedbackActionButton></div>
   </form>}
  </div></DialogContent></Dialog>
 </section>;
}
