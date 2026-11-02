"use client";
import {productionOrderIndex} from "../lib/production-order-index.mjs";
import {hasScheduledWorkday} from '../lib/production-extra-policy.mjs';
import {liveStageChoices} from '../lib/production-stage-live.mjs';
import ProductionWorkActionDialog from './production-work-action-dialog';
import ProductionStatusLegend from './production-status-legend';
import {stageChoices} from '../lib/production-stage-trial.mjs';
import {reportStart} from "../lib/production-runtime.mjs";
import {notifyInvalidAction} from '../lib/action-feedback';
import {notifyActionFailure} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {monday,weekEnd,weekNumber,displayDate} from '../lib/production-plan.mjs';
import {toolbarLocale,subscribeToolbarLocale} from './standard-toolbar/translations';
import {productionWorkActions} from '../lib/production-work-actions.mjs';
import {productionProgressDisplay} from "../lib/production-progress-display.mjs";
import {completedWorkQuantity,progressOrderStatus,progressReviewSummary} from "../lib/production-progress-review.mjs";
import {productionDisplayTime} from "../lib/production-display-time.mjs";
import ProductionReportImpact from './production-report-impact';
import {Fragment,useMemo,useEffect,useRef,useState,useSyncExternalStore,type FormEvent,type RefObject} from 'react';
import {ManualPagination} from './onspa-ui/ManualPagination';
import {paginationModel} from '../lib/pagination-presentation.mjs';
import ProductionDateTimeInput from './production-date-time-input';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator} from './ui/dropdown-menu';
import {productionDailyAbsences} from '../lib/production-daily-absences.mjs';
import {vnMoment} from '../lib/production-attendance.mjs';
import {scheduleHeadcount} from '../lib/production-schedule-headcount.mjs';
import HeadcountDetails from './headcount-details';
type Row=Record<string,any>;
const number=(value:any)=>Number(value||0).toLocaleString('vi-VN',{maximumFractionDigits:2});
const date=(value?:string)=>value?value.slice(0,10).split('-').reverse().join('/'):'—';
const time=(value?:string)=>productionDisplayTime(value,'Chưa bắt đầu');
type BoardProps={stageLive?:boolean;stageState?:Record<string,Row>;rows:Row[];events:Row[];reports:Row[];active:(row:Row,at?:number)=>{count:number;assigned?:number;running:boolean;known:boolean;staffingKnown?:boolean};openAction:(row:Row,action:string)=>void;showDetail:(row:Row)=>void;chosen:Row|null;action:string;effectiveLocal:string;setEffectiveLocal:(value:string)=>void;submit:(event:FormEvent<HTMLFormElement>)=>void;cancel:()=>void;busy:boolean;schedules:Row[];line:string;employees:Row[]};
const PAGE_SIZE=10;
export default function ProductionWorkBoard(props:BoardProps){
 const [page,setPage]=useState(1);
 const viewportRef=useRef<HTMLDivElement>(null);
 const current=paginationModel(props.rows.length,page,PAGE_SIZE).current;
 useEffect(()=>{if(page!==current)setPage(current);},[page,current]);
 return <ProductionWorkBoardView {...props} page={current} viewportRef={viewportRef} onPageChange={next=>{setPage(next);viewportRef.current?.scrollTo({top:0,behavior:"instant"});}}/>;
}
export function ProductionWorkBoardView({stageLive=false,stageState={},rows,events,reports,active,openAction,showDetail,chosen,action,effectiveLocal,setEffectiveLocal,submit,cancel,busy,schedules,line,employees,page,onPageChange,viewportRef}:BoardProps & {page:number;onPageChange:(page:number)=>void;viewportRef?:RefObject<HTMLDivElement|null>}){
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=>"vi");
 const weekKey=(row:Row)=>monday(row.week)||'unassigned';
 // Stable within-week ordering keeps the active toolbar sort intact.
 const groupedRows=[...rows].sort((a,b)=>weekKey(a).localeCompare(weekKey(b)));
 const weekLabel=(row:Row)=>{const week=monday(row.week);return week?`${locale==='en'?'PLAN WEEK':locale==='zh'?'計畫週':'TUẦN KẾ HOẠCH'} ${weekNumber(week)}: ${displayDate(week)} – ${displayDate(weekEnd(week))}`:locale==='en'?'Unassigned plan week':locale==='zh'?'尚未指定計畫週':'Tuần kế hoạch chưa xác định';};
 const model=paginationModel(rows.length,page,PAGE_SIZE);
 // Keep hidden table records for the existing all-filtered-rows report exporter.
 const pageRows=groupedRows.slice((model.current-1)*PAGE_SIZE,model.current*PAGE_SIZE);
 const [legacyStart,setLegacyStart]=useState("");
 useEffect(()=>setLegacyStart(""),[chosen?.id,action]);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});

 const orderIndex=useMemo(()=>productionOrderIndex([],reports,events),[reports,events,today]);
 const summary=(row:Row)=>orderIndex.summaryFor(row);
 const due=(row:Row)=>row.status==='HỦY'||!row.planEnd?null:row.planEnd<today?['danger','Quá hạn']:row.planEnd===today?['warning','Đến hạn hôm nay']:['upcoming','Sắp đến hạn'];
 const status=(row:Row)=>row.status==='HỦY'?{label:'Đã hủy',tone:'cancelled'}:!active(row).known&&!orderIndex.reportsByOrder.has(row.id)&&productionProgressDisplay(row.progressStatus)||progressOrderStatus(summary(row),active(row),(orderIndex.eventsByOrder.get(row.id)||[]));
 const actions=(row:Row)=>{
  if(row.status==='HỦY')return <span className="production-cancelled-lock" title={row.cancelReason||'Lệnh đã hủy tại In transit; không được báo công.'}>Đã hủy · Khóa thao tác</span>;
  const isTrial=Object.values(stageState).some(s=>s.orderId===row.id);
  const availability=stageLive?{allowed:Number(row.inTransitQty)>0&&!summary(row).awaitingCompletion?['start','pause','resume','complete','add','incident'].filter(a=>liveStageChoices(row,stageState,a).length):[],reason:''}:isTrial?{allowed:['start','pause','resume','complete','add','incident'].filter(a=>stageChoices(row,stageState,a).length),reason:'Thao tác theo công đoạn đang ở bản thử; chưa ghi báo công chính thức.'}:productionWorkActions(row,reports,events,active(row));
  const allowed=new Set(availability.allowed);if(!hasScheduledWorkday(schedules,row.line,today)&&Number(row.inTransitQty)>0&&(!stageLive||!summary(row).awaitingCompletion)&&(stageLive?liveStageChoices:stageChoices)(row,stageState,'extra').length)allowed.add('extra');
  const choices=[['start','Nhập trạm'],['pause','Tạm ngưng'],['resume','Tiếp tục'],['complete','Xuất trạm'],['transfer','Chuyển người'],['add','Bổ sung người'],['incident','Báo sự cố'],['extra','Làm việc phát sinh']];
  return <div className="work-actions"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><FeedbackActionButton aria-label={`Báo công · ${row.lsxCode}`} className="work-action-trigger">Báo công <span aria-hidden="true">▾</span></FeedbackActionButton></DropdownMenuTrigger><DropdownMenuContent className="production-work-action-menu" align="end" collisionPadding={8}>{choices.filter(([name])=>allowed.has(name)).map(([name,label])=><DropdownMenuItem key={name} data-work-action={name} aria-disabled={busy||!allowed.has(name)} onSelect={event=>{if(busy||!allowed.has(name)){event.preventDefault();notifyActionFailure(busy?'Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.':availability.reason||'Trạng thái LSX chưa cho phép thao tác này. Kiểm tra tiến độ và nhân lực trước.');return;}openAction(row,name);}}>{label}</DropdownMenuItem>)}{availability.reason&&<p className="production-attendance-note" role="note">{availability.reason}</p>}<DropdownMenuSeparator/><DropdownMenuItem data-work-action="detail" onSelect={()=>showDetail(row)}>Chi tiết</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
 };
 const chosenReports=chosen?reports.filter(r=>r.transitId===chosen.id&&r.reviewStatus!=='Cần điều chỉnh'):[];
 const hours=chosenReports.reduce((sum,r)=>sum+Number(r.hours?.hc||0)+Number(r.hours?.ot||0),0);
 const quantity=chosenReports.reduce((sum,r)=>sum+Number(r.reportedQuantity||0),0);
 const started=chosen?reportStart(chosen,reports,events):"";
 return <>

 <section className="data-card work-orders" data-pagination-owner="true"><DataTable ref={viewportRef} className="table-wrap work-table-wrap"><table className="work-table" data-no-pagination="true"><thead><tr>{['Báo công','Lệnh sản xuất','SKU','Tên SP','Quy cách','Line','Ghi chú','Thứ tự SX','SL lệnh','SL hoàn thành','KH bắt đầu','KH hoàn thành','Có mặt hiện tại / Phân công','Trạng thái','Plan ID'].map(label=><th key={label} className={label==='SL lệnh'?'production-order-qty':label==='Ghi chú'?'production-compact-note':label==='Quy cách'?'work-spec':label==='Plan ID'?'work-plan-id':label==='Tên SP'?'work-product':label==='Lệnh sản xuất'?'work-order-code':label==='Trạng thái'?'work-status':label==='Có mặt hiện tại / Phân công'?'work-people':undefined}>{label}{label==='Trạng thái'&&<ProductionStatusLegend/>}</th>)}</tr></thead><tbody>{groupedRows.map((row,index)=>{const state=active(row),badge=status(row),deadline=due(row);return <Fragment key={row.id}>{(index===0||weekKey(groupedRows[index-1])!==weekKey(row)||index===(model.current-1)*PAGE_SIZE)&&<tr className="it-week-divider work-week-divider" hidden={index<(model.current-1)*PAGE_SIZE||index>=model.current*PAGE_SIZE}><th colSpan={15}>{weekLabel(row)}</th></tr>}<tr hidden={index<(model.current-1)*PAGE_SIZE||index>=model.current*PAGE_SIZE} className={`${chosen?.id===row.id?'work-selected ':''}${deadline?.[0]==='warning'?'work-due-today':''}`}><DataCell>{actions(row)}</DataCell><DataCell kind="code" className="work-order-code"><FeedbackActionButton className="sku-link" onClick={()=>showDetail(row)}>{row.lsxCode||'Chưa mở LSX'}</FeedbackActionButton></DataCell><DataCell kind="code">{row.sku}</DataCell><DataCell className="work-product">{row.name}</DataCell><DataCell className="work-spec">{row.spec||'—'}</DataCell><DataCell kind="code">{row.line}</DataCell><DataCell className="order-planning-note production-compact-note">{row.planningNote?<span className="khsx-planning-note">{row.planningNote}</span>:'—'}</DataCell><DataCell kind="number">{row.sequence??'—'}</DataCell><DataCell kind="number" className="number production-order-qty">{number(row.lsxQty)}</DataCell><DataCell kind="number" className="number">{number(completedWorkQuantity(row,summary(row)))}</DataCell><DataCell kind="date">{date(row.planStart)}</DataCell><DataCell kind="date" className={deadline?.[0]==='danger'?'work-overdue':''}>{date(row.planEnd)}</DataCell><DataCell className="work-people">{(state.staffingKnown??state.known)?<><b>{number(state.count)}</b><small> / {number(state.assigned??state.count)} phân công</small></>:'—'}</DataCell><DataCell className="work-status"><span className={`onspa-progress onspa-progress-${row.status!=='HỦY'&&!summary(row).completedAt&&deadline?.[0]==="danger"&&Number(row.inTransitQty||0)>0?'overdue':badge.tone}`} title={row.status!=='HỦY'&&!summary(row).completedAt&&deadline?.[0]==="danger"?'Quá hạn':undefined}>{badge.label}</span></DataCell><DataCell kind="code" className="work-plan-id">{row.planId||'—'}</DataCell></tr></Fragment>})}{!rows.length&&<tr data-no-data="true"><DataCell colSpan={15}>Chưa có LSX phù hợp.</DataCell></tr>}</tbody></table></DataTable>
 <div className="work-mobile-cards">{pageRows.map((row,index)=>{const badge=status(row),deadline=due(row);return <Fragment key={row.id}>{(index===0||weekKey(pageRows[index-1])!==weekKey(row))&&<h3 className="work-mobile-week">{weekLabel(row)}</h3>}<article className={`work-mobile-card ${chosen?.id===row.id?'work-selected':''}`}><FeedbackActionButton className="work-card-title" onClick={()=>showDetail(row)}><b>{row.planId||row.lsxCode}</b><span>{row.lsxCode} · {row.sku} · Line {row.line}</span><strong>{row.name}</strong></FeedbackActionButton><p>Thứ tự SX: {row.sequence??'—'} · <span className="production-order-qty">SL lệnh: {number(row.lsxQty)}</span> · SL hoàn thành: {number(completedWorkQuantity(row,summary(row)))}</p>{row.planningNote&&<p className="khsx-planning-note">Ghi chú KHSX: {row.planningNote}</p>}<p>Quy cách: {row.spec||'—'}</p><p>Kế hoạch: {date(row.planStart)} – {date(row.planEnd)}</p><p>Có mặt hiện tại: <b>{(active(row).staffingKnown??active(row).known)?number(active(row).count):'—'}</b></p><span className={`onspa-progress onspa-progress-${row.status!=='HỦY'&&!summary(row).completedAt&&deadline?.[0]==="danger"&&Number(row.inTransitQty||0)>0?'overdue':badge.tone}`} title={deadline?.[0]==="danger"?'Quá hạn':undefined}>{badge.label}</span>{actions(row)}</article></Fragment>})}{!rows.length&&<p>Chưa có LSX phù hợp.</p>}</div><ManualPagination total={rows.length} page={model.current} pageSize={PAGE_SIZE} onPageChange={onPageChange}/></section>
 {action==='complete'&&chosen&&<ProductionWorkActionDialog title={`Xuất trạm · ${chosen.lsxCode}`} onBack={cancel} busy={busy}><section className="data-card work-report-panel" data-work-action-panel aria-label="Xuất trạm LSX"><h2>XUẤT TRẠM · {chosen.planId||chosen.lsxCode}</h2><p>LSX: <b>{chosen.lsxCode}</b> · SKU: {chosen.sku} · <b>{chosen.name}</b> · Quy cách: {chosen.spec||'—'} (Line {chosen.line})</p><ProductionReportImpact orderId={chosen.id} effectiveLocal={effectiveLocal} startedLocal={!started?legacyStart:undefined} employees={employees}/><form onInvalid={notifyInvalidAction} onSubmit={submit}><div className="work-report-inputs"><div className="work-plan-banner">Kế hoạch: {date(chosen.planStart)} → {date(chosen.planEnd)}</div><label>Có mặt tại giờ xuất / Phân công<input readOnly value={active(chosen).staffingKnown===false?"Chưa đủ dữ liệu phân công":`${number(active(chosen,Date.parse(`${effectiveLocal}:00+07:00`)).count)} / ${number(active(chosen,Date.parse(`${effectiveLocal}:00+07:00`)).assigned)}`}/></label><label>Bắt đầu thực tế{started?<input readOnly value={time(started)}/>:<><ProductionDateTimeInput name="startedAt" value={legacyStart} onChange={setLegacyStart} label="Bắt đầu thực tế" max={effectiveLocal}/><small>Dữ liệu cũ chưa có giờ bắt đầu. Nhập mốc thực tế để xuất trạm.</small></>}</label><label>Hoàn thành thực tế<input readOnly value={chosen.actualCompletedAt?time(chosen.actualCompletedAt):'Chưa hoàn thành'}/></label><label className="work-report-at">Thời điểm xuất trạm<ProductionDateTimeInput name="effectiveAt" value={effectiveLocal} onChange={setEffectiveLocal} label="Xuất trạm"/></label><label className="work-report-quantity">Sản lượng hoàn thành lần này *<input autoFocus name="quantity" type="number" min="1" max={chosen.inTransitQty} required/></label><label>Ngày sản lượng *<input type="date" name="productionDate" key={effectiveLocal.slice(0,10)} defaultValue={effectiveLocal.slice(0,10)} max={effectiveLocal.slice(0,10)} required/></label><label className="work-report-note">Ghi chú<input name="note" placeholder="Nhập ghi chú (nếu có)…"/></label></div><aside className="work-hours"><h3>Giờ công đã ghi nhận</h3><p>Theo các lần báo công và điều chỉnh nhân lực đã lưu.</p><dl><div><dt>Tổng giờ công</dt><dd>{number(hours)} giờ</dd></div><div><dt>Sản lượng theo giờ</dt><dd>{hours>0?`${number(quantity/hours)} SP/giờ`:'Chưa có dữ liệu'}</dd></div></dl><small>{chosenReports.some(r=>!r.hours)?'Có lần báo công chưa đủ dữ liệu giờ.':''}</small><div className="work-submit"><FeedbackActionButton className="work-report-button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."}>{busy?'Đang gửi…':'Xác nhận xuất trạm'}</FeedbackActionButton><FeedbackActionButton type="button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={cancel}>Hủy</FeedbackActionButton></div></aside></form></section></ProductionWorkActionDialog>}
 </>;
}

export function WorkCalendarBanner({schedules,line,referenceDate,events=[],employees=[],displayEmployees=employees,restrictedLine=false,orders=[]}:{schedules:Row[];line:string;referenceDate?:string;events?:Row[];employees?:Row[];displayEmployees?:Row[];restrictedLine?:boolean;orders?:Row[]}){
 const [currentDate,setCurrentDate]=useState(()=>vnMoment(new Date()).date);
 useEffect(()=>{const tick=()=>setCurrentDate(vnMoment(new Date()).date);const timer=window.setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 const today=referenceDate||currentDate;
 const calendars=schedules.filter(s=>line==='all'||s.key?.endsWith(`:${line}`)).flatMap(reference=>(reference.days||[]).filter((day:Row)=>day.date===today).map((day:Row)=>{
  const currentLine=reference.key?.split(':')[1];
  return {...day,line:currentLine,headcount:scheduleHeadcount({reference,events,employees:displayEmployees,line:currentLine,day,restrictedLine})};
 }));
 const absences=productionDailyAbsences({date:today,events,employees:displayEmployees,orders,line});
 const lines=[...new Set([...calendars.map((day:Row)=>day.line),...absences.map((item:Row)=>item.line)])].sort();
 return <div className="work-calendar-banner"><b>{referenceDate?"Ngày thử":"Hôm nay"}, {date(today)}</b>{calendars.length?calendars.map((day:Row)=><span key={day.line}>Line {day.line} · {day.working?`HC ${day.hcStart||'08:00'} – ${day.hcEnd||'17:00'}${day.ot?` · TC ${day.otStart||'17:30'} – ${day.otEnd||'21:00'}`:''}`:'Không làm việc'}{day.working&&<> · <strong>{day.headcount.label}{day.headcount.windows.some((window:Row)=>window.count===null)?'':' người'}</strong>{day.headcount.windows.some((window:Row)=>window.provisional.length>0)?' · Tạm tính':''}</>}</span>):<span>Chưa có lịch thực tế được duyệt cho ngày này</span>}
 <details className="work-daily-absences" key={today}><summary>Nhân lực</summary>
 {lines.length?lines.map(currentLine=>{
  const day=calendars.find((item:Row)=>item.line===currentLine);
  // Source-only LSX absences need orders to resolve their Line; the shared display has no order context.
  const otherAbsences=absences.filter((item:Row)=>item.line===currentLine&&(!day||events.some(event=>!event.line&&event.sourceId&&item.id===`${event.id}:${currentLine}`)));
  const fallback=otherAbsences.length>0&&<ul aria-label={`Ghi nhận nghỉ Line ${currentLine}`}>{otherAbsences.map((item:Row)=><li key={item.id}>{item.kind}: {item.names.length?item.names.join(', '):`${item.count} người · chưa có tên`} · {item.start}–{item.end}{item.openArrival?' · Chưa đến':''}{item.pending?' · Chờ duyệt':''}</li>)}</ul>;
  return <section key={currentLine}><b>Line {currentLine}</b>
   {day&&<HeadcountDetails projection={day.headcount} date={today} line={currentLine} events={events} employees={displayEmployees}/>}
   {fallback&&(day?<details><summary>Ghi nhận khác</summary>{fallback}</details>:fallback)}
  </section>;
 }):<p>Chưa có ghi nhận.</p>}
 </details></div>;
}
