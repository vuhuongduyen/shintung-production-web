"use client";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import ProductionDateTimeInput from "./production-date-time-input";
import {notifyInvalidAction} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';

import {useEffect,useRef, useState} from 'react';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import ProductionAllocationSelection from './production-allocation-selection';
import ProductionAllocationScope from './production-allocation-scope';
import AllocationEmployeePicker from './allocation-employee-picker';
import styles from './production-allocation-queue.module.css';
import toolbarStyles from './standard-toolbar/StandardToolbar.module.css';
import PlanningFeedback from './planning-feedback';
import {productionRequestId} from '../lib/production-request-id.mjs';

export type AllocationWindow = {effectiveAt:string; endsAt:string};
export type AllocationQueueView = {
 revision:number; readOnly?:boolean; configurationEnabled?:boolean; group:string; sourceLines:string[]; pendingPeople:number;
 offers:Array<AllocationWindow & {id:string; sourceLine:string; sourceGroup:string; targetGroup:string;
  canAllocate:boolean; canWithdraw:boolean; expired:boolean; reason?:string;createdBy?:string;createdAt?:string;
  people:Array<{id:string; name:string; pending:AllocationWindow[]}>;
  allocations:Array<{id?:string;employeeId?:string;targetLine?:string;effectiveAt?:string;endsAt?:string;planning?:boolean;canCancel?:boolean;canceled?:boolean;actorId?:string;recordedAt?:string;canceledBy?:string;canceledAt?:string;cancellationReason?:string;reason?:string;replacedBy?:string;replaces?:string;previousAllocation?:{targetLine:string;effectiveAt:string;endsAt:string}}>; withdrawals:Array<{id?:string;employeeId?:string;effectiveAt?:string;endsAt?:string;actorId?:string;recordedAt?:string;reason?:string}>;
 }>;
};
type Command = Record<string, unknown>;
type Props = {view:AllocationQueueView; candidates:Array<{id:string;name:string;line:string}>; busy:boolean; verified?:boolean; status?:string;statusError?:boolean;reloadBusy?:boolean;onReload?:()=>Promise<void>; onCommand:(command:Command)=>Promise<boolean>; now?:string;planningDate?:string;onScopeSaved?:()=>Promise<void>};
const local = (iso:string)=>new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,16);
const localCeil = (value:string)=>local(new Date(Math.ceil(Date.parse(value)/60000)*60000).toISOString());
const iso = (value:string)=>new Date(`${value.length===16?`${value}:00`:value}+07:00`).toISOString();
const display = (value:string)=>{const text=local(value);return `${text.slice(8,10)}/${text.slice(5,7)}/${text.slice(0,4)} ${text.slice(11,16)}`;};
const validRange = (start:string,end:string,min:string,max?:string)=>{
 const from=Date.parse(`${start}+07:00`),to=Date.parse(`${end}+07:00`);
 return from%60000===0&&to%60000===0&&Number.isFinite(from)&&Number.isFinite(to)&&from>=Date.parse(`${min}+07:00`)&&to>from&&(!max||to<=Date.parse(`${max}+07:00`));
};

// Keep the request token for an unchanged retry after an uncertain response.
function useQueueCommand(onCommand:Props['onCommand']) {
 const pending=useRef(false),receipt=useRef<{fingerprint:string;requestId:string}|null>(null);
 const [saving,setSaving]=useState(false);
 return {saving,submit:async (command:Command)=>{
  if(pending.current)return false;
  const fingerprint=JSON.stringify(command);
  if(receipt.current?.fingerprint!==fingerprint)receipt.current={fingerprint,requestId:productionRequestId()};
  pending.current=true;setSaving(true);
  try {const ok=await onCommand({...command,requestId:receipt.current.requestId});if(ok)receipt.current=null;return ok;}
  catch {return false;} // The parent owns error feedback; leave the user's draft intact.
  finally {pending.current=false;setSaving(false);}
 }};
}

function PendingAction({offer,person,window,view,busy,onCommand,now,mode}:{offer:AllocationQueueView['offers'][number];person:{id:string;name:string};window:AllocationWindow;view:AllocationQueueView;busy:boolean;onCommand:Props['onCommand'];now:string;mode:'allocate'|'withdraw'}) {
 const [start,setStart]=useState(localCeil(window.effectiveAt)),[end,setEnd]=useState(local(window.endsAt));
 const [target,setTarget]=useState(offer.targetGroup==='AB'?'A':'C');
 const [reason,setReason]=useState('');
 const {saving,submit}=useQueueCommand(onCommand);
 const incoming=mode==='allocate'&&!view.readOnly&&offer.canAllocate&&(view.group==='ADMIN'||offer.targetGroup===view.group);
 const outgoing=mode==='withdraw'&&!view.readOnly&&offer.canWithdraw&&(view.group==='ADMIN'||offer.sourceGroup===view.group);
 const returned=offer.allocations.filter(entry=>entry.canceled&&entry.employeeId===person.id&&entry.effectiveAt&&entry.endsAt&&Date.parse(entry.effectiveAt)<Date.parse(window.endsAt)&&Date.parse(window.effectiveAt)<Date.parse(entry.endsAt));
 if(!incoming&&!outgoing)return null;
 const min=localCeil(new Date(Math.max(Date.parse(window.effectiveAt),Date.parse(now))).toISOString());
 const max=local(window.endsAt),disabled=busy||saving;
 return <form onInvalid={notifyInvalidAction} className={`${styles.form} ${incoming?styles.pendingRow:''}`} aria-label={`${incoming?'Phân bổ':'Rút'} ${person.name}`} onSubmit={async event=>{
  event.preventDefault();if(disabled||!validRange(start,end,min,max)||outgoing&&!reason.trim())return;
  await submit({action:incoming?'allocate':'withdraw',expectedRevision:view.revision,offerId:offer.id,employeeId:person.id,
   ...(incoming?{targetLine:target}:{reason:reason.trim()}),effectiveAt:iso(start),endsAt:iso(end)});
 }}>
  <div className={incoming?styles.pendingPerson:undefined}>
   <strong>{person.name} ({person.id})</strong>
   {incoming?<details className={styles.pendingDetails}><summary>Line {offer.sourceLine} · Khoảng còn chờ{returned.length>0?' · Đã hủy phân bổ':''}</summary><p>{display(window.effectiveAt)} – {display(window.endsAt)} (GMT+7)</p>
    {returned.length>0&&<p><strong>Đã hủy phân bổ vào lịch · Trả lại Chờ phân bổ.</strong> Đề nghị chuyển từ Line {offer.sourceLine} vẫn còn hiệu lực. QLSX phía gửi hoặc Admin có thể rút khoảng chờ để kết thúc đề nghị.</p>}
   </details>:<><span> · Line {offer.sourceLine} · Còn chờ: {display(window.effectiveAt)} – {display(window.endsAt)} (GMT+7)</span>
    {returned.length>0&&<p><strong>Đã hủy phân bổ vào lịch · Trả lại Chờ phân bổ.</strong> Nếu không tiếp tục chuyển người, rút khoảng đang chờ bên dưới để kết thúc đề nghị.</p>}</>}
  </div>
  <fieldset disabled={disabled}>
   {incoming&&<label><span className={incoming?styles.pendingLabel:undefined}>Line nhận</span> <select aria-label={`Line nhận cho ${person.name}`} value={target} onChange={e=>setTarget(e.target.value)}>{(offer.targetGroup==='AB'?['A','B']:['C']).map(line=><option key={line} value={line}>{line}</option>)}</select></label>}
   <label><span className={incoming?styles.pendingLabel:undefined}>Từ ngày, giờ</span> <ProductionDateTimeInput label={`Từ ngày giờ của ${person.name}`} name="allocationStart" min={min} max={max} value={start} onChange={setStart}/></label>
   <label><span className={incoming?styles.pendingLabel:undefined}>Đến ngày, giờ</span> <ProductionDateTimeInput label={`Đến ngày giờ của ${person.name}`} name="allocationEnd" min={start||min} max={max} value={end} onChange={setEnd}/></label>
   {outgoing&&<label>Lý do rút <input aria-label={`Lý do rút ${person.name}`} required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
   <FeedbackActionButton stableContainer className={styles.submit} type="submit" disabled={disabled||!validRange(start,end,min,max)||outgoing&&!reason.trim()} disabledExplanation={disabled?"Đang xử lý. Vui lòng chờ hoàn tất.":outgoing&&!reason.trim()?"Nhập lý do rút khoảng đang chờ.":"Chọn khoảng giờ hợp lệ đến phút, chưa qua và nằm trong khoảng còn chờ."}>{incoming?'Lưu phân bổ':'Rút khoảng đang chờ'}</FeedbackActionButton>
  </fieldset>
 </form>;
}

function WithdrawMany({offers,view,busy,onCommand,now}:{offers:AllocationQueueView['offers'];view:AllocationQueueView;busy:boolean;onCommand:Props['onCommand'];now:string}){
 const [selected,setSelected]=useState<string[]>([]),[start,setStart]=useState(''),[end,setEnd]=useState(''),[reason,setReason]=useState('');
 const {saving,submit}=useQueueCommand(onCommand);
 const available=offers.flatMap(offer=>offer.people.filter(person=>person.pending.some(w=>Date.parse(w.endsAt)>Date.parse(now))).map(person=>({offer,person})));
 const candidates=[...new Map(available.map(({offer,person})=>[person.id,{id:person.id,name:`${person.name} · Line ${offer.sourceLine}`}])).values()];
 const chosen=selected.filter(id=>candidates.some(p=>p.id===id));
 const selections=chosen.map(employeeId=>{const found=available.find(({person})=>person.id===employeeId&&person.pending.some(w=>start&&end&&Date.parse(`${start}+07:00`)>= Date.parse(w.effectiveAt)&&Date.parse(`${end}+07:00`)<= Date.parse(w.endsAt)));return found?{offerId:found.offer.id,employeeId}:null;});
 const disabled=busy||saving,valid=chosen.length>0&&selections.every(Boolean)&&validRange(start,end,localCeil(now))&&Boolean(reason.trim());
 const choose=(ids:string[])=>{setSelected(ids);if(!selected.length&&ids.length){const first=available.find(x=>x.person.id===ids[0])?.person.pending.find(w=>Date.parse(w.endsAt)>Date.parse(now));if(first){setStart(localCeil(new Date(Math.max(Date.parse(first.effectiveAt),Date.parse(now))).toISOString()));setEnd(local(first.endsAt));}}};
 return <form className={styles.form} aria-label="Hủy chuyển nhiều nhân viên" onSubmit={async e=>{e.preventDefault();if(disabled||!valid)return;if(await submit({action:'withdraw-many',selections,expectedRevision:view.revision,effectiveAt:iso(start),endsAt:iso(end),reason:reason.trim()})){setSelected([]);setReason('');}}}>
 <AllocationEmployeePicker candidates={candidates} selected={chosen} disabled={disabled} onChange={choose}/>
 {chosen.length>0&&<fieldset disabled={disabled}>
 <label>Từ ngày, giờ <ProductionDateTimeInput label="Hủy chuyển từ ngày giờ" min={localCeil(now)} value={start} onChange={setStart}/></label>
 <label>Đến ngày, giờ <ProductionDateTimeInput label="Hủy chuyển đến ngày giờ" min={start||localCeil(now)} value={end} onChange={setEnd}/></label>
 <label>Lý do hủy <input aria-label="Lý do hủy chuyển nhân sự" required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <FeedbackActionButton type="submit" className={styles.submit} disabled={disabled||!valid} disabledExplanation="Chọn khoảng thời gian còn chờ của tất cả nhân viên và nhập lý do hủy.">Hủy chuyển ({chosen.length})</FeedbackActionButton>
 {!selections.every(Boolean)&&<p role="status">Khoảng hủy phải nằm trong thời gian còn chờ của tất cả nhân viên đã chọn.</p>}
 </fieldset>}
 </form>;
}

function CancelAllocation({offerId,allocationId,revision,busy,onCommand}:{offerId:string;allocationId:string;revision:number;busy:boolean;onCommand:Props['onCommand']}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState('');const {saving,submit}=useQueueCommand(onCommand);const disabled=busy||saving;
 return <div>{!open?<FeedbackActionButton className={`${toolbarStyles.button} ${toolbarStyles.danger}`} type="button" disabled={disabled} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." onClick={()=>setOpen(true)}>Hủy phân bổ</FeedbackActionButton>:<form className={styles.form} aria-label="Hủy phân bổ kế hoạch" onInvalid={notifyInvalidAction} onSubmit={async e=>{e.preventDefault();if(disabled||!reason.trim())return;if(await submit({action:'cancel',offerId,allocationId,expectedRevision:revision,reason:reason.trim()})){setOpen(false);setReason('');}}}>
  <p>Hủy phân bổ vào lịch và trả khoảng giờ về Chờ phân bổ. Đề nghị chuyển từ Line nguồn vẫn còn hiệu lực; QLSX phía gửi hoặc Admin được rút đề nghị. Chỉ áp dụng khi chưa bắt đầu và lịch được phép sửa.</p>
  <label>Lý do hủy <input aria-label="Lý do hủy phân bổ" required maxLength={500} disabled={disabled} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <div className={styles.confirmActions}><FeedbackActionButton className={`${toolbarStyles.button} ${toolbarStyles.danger}`} type="submit" disabled={disabled||!reason.trim()} disabledExplanation={disabled?'Đang xử lý. Vui lòng chờ hoàn tất.':'Nhập lý do hủy phân bổ.'}>Xác nhận hủy phân bổ</FeedbackActionButton>
  <FeedbackActionButton className={toolbarStyles.button} type="button" disabled={disabled} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." onClick={()=>setOpen(false)}>Đóng</FeedbackActionButton></div>
 </form>}</div>;
}

function EditAllocation({offer,entry,view,busy,onCommand,now}:{offer:AllocationQueueView['offers'][number];entry:AllocationQueueView['offers'][number]['allocations'][number];view:AllocationQueueView;busy:boolean;onCommand:Props['onCommand'];now:string}){
 const [open,setOpen]=useState(false),[target,setTarget]=useState(entry.targetLine||''),[start,setStart]=useState(local(entry.effectiveAt!)),[end,setEnd]=useState(local(entry.endsAt!)),[reason,setReason]=useState('');
 const {saving,submit}=useQueueCommand(onCommand),disabled=busy||saving;
 const min=localCeil(new Date(Math.max(Date.parse(now),Date.parse(offer.effectiveAt))).toISOString());
 const valid=validRange(start,end,min,local(offer.endsAt))&&!!reason.trim();
 return <div className={styles.allocationEdit}>{!open?<FeedbackActionButton className={toolbarStyles.button} disabled={disabled} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." onClick={()=>setOpen(true)}>Sửa phân bổ</FeedbackActionButton>:<form className={styles.form} aria-label="Sửa phân bổ" onInvalid={notifyInvalidAction} onSubmit={async e=>{e.preventDefault();if(disabled||!valid)return;if(await submit({action:'edit',offerId:offer.id,allocationId:entry.id,expectedRevision:view.revision,targetLine:target,effectiveAt:iso(start),endsAt:iso(end),reason:reason.trim()}))setOpen(false);}}>
 <strong>Sửa phân bổ · {offer.people.find(p=>p.id===entry.employeeId)?.name||entry.employeeId}</strong>
 <p>Hiện tại: Line {entry.targetLine} · {display(entry.effectiveAt!)} – {display(entry.endsAt!)}</p>
 <fieldset disabled={disabled}>
 <label>Line nhận<select aria-label="Sửa Line nhận" value={target} onChange={e=>setTarget(e.target.value)}>{(offer.targetGroup==='AB'?['A','B']:['C']).map(line=><option key={line}>{line}</option>)}</select></label>
 <label>Từ ngày, giờ<ProductionDateTimeInput label="Sửa phân bổ từ ngày giờ" value={start} onChange={setStart} min={min} max={local(offer.endsAt)}/></label>
 <label>Đến ngày, giờ<ProductionDateTimeInput label="Sửa phân bổ đến ngày giờ" value={end} onChange={setEnd} min={start} max={local(offer.endsAt)}/></label>
 <label>Lý do sửa<input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 </fieldset><div className={styles.confirmActions}><FeedbackActionButton className={styles.submit} type="submit" disabled={disabled||!valid} disabledExplanation="Nhập lý do sửa và khoảng thời gian chưa qua, nằm trong lịch chuyển.">Lưu phân bổ</FeedbackActionButton><FeedbackActionButton type="button" disabled={disabled} disabledExplanation="Đang xử lý. Vui lòng chờ hoàn tất." onClick={()=>setOpen(false)}>Đóng</FeedbackActionButton></div>
 </form>}</div>;
}

export default function ProductionAllocationQueue({view,candidates,busy,onCommand,onScopeSaved,planningDate,verified=true,status,statusError=false,reloadBusy=false,onReload,now=new Date().toISOString()}:Props) {
 const [cancelSelection,setCancelSelection]=useState('');
 const [panel,setPanel]=useState(''),[visibleError,setVisibleError]=useState('');
 useEffect(()=>{setVisibleError(statusError?status||'':'');},[status,statusError]);
 const toggle=(name:string)=>setPanel(current=>current===name?'':name);
 const lines=view.group==='AB'?['A','B']:view.group==='C'?['C']:view.group==='ADMIN'?['A','B','C']:[];
 const scopedLines=lines.filter(line=>view.sourceLines.includes(line));
 const [chosenLine,setChosenLine]=useState(scopedLines[0]||'');
 const sourceLine=scopedLines.includes(chosenLine)?chosenLine:scopedLines[0]||'';
 const [selected,setSelected]=useState<string[]>([]);
 const [reason,setReason]=useState('');
 const initialDate=planningDate||local(now).slice(0,10);
 const [start,setStart]=useState(()=>`${initialDate}T08:00`);
 const [end,setEnd]=useState(()=>`${initialDate}T17:00`);
 const priorPlanningDate=useRef(planningDate),draftTouched=useRef(false);
 useEffect(()=>{
  if(planningDate&&planningDate!==priorPlanningDate.current&&!draftTouched.current){
   setStart(value=>`${planningDate}T${value.slice(11,16)||'08:00'}`);
   setEnd(value=>`${planningDate}T${value.slice(11,16)||'17:00'}`);
  }
  priorPlanningDate.current=planningDate;
 },[planningDate]);
 const changeStart=(value:string)=>{
  draftTouched.current=true;
  if(value.slice(0,10)!==start.slice(0,10)&&end.slice(0,10)===start.slice(0,10))setEnd(`${value.slice(0,10)}T${end.slice(11,16)||'17:00'}`);
  setStart(value);
 };
 const {saving,submit}=useQueueCommand(onCommand);
 const available=candidates.filter(person=>person.line===sourceLine&&scopedLines.includes(person.line));
 const people=selected.filter(id=>available.some(person=>person.id===id));
 const disabled=busy||saving||!verified||!!view.readOnly,min=localCeil(now);
 const hasIncoming=view.offers.some(offer=>!offer.expired&&offer.canAllocate&&(view.group==='ADMIN'||offer.targetGroup===view.group)&&offer.people.some(p=>p.pending.length));
 const sentPending=view.offers.filter(offer=>!offer.expired&&offer.sourceGroup===view.group&&offer.targetGroup!==view.group&&offer.people.some(person=>person.pending.length));
 const outgoing=view.offers.filter(offer=>offer.canWithdraw&&(view.group==='ADMIN'||offer.sourceGroup===view.group)&&!offer.expired);

 const hasOutgoing=outgoing.some(offer=>offer.people.some(person=>person.pending.some(window=>Date.parse(window.endsAt)>Date.parse(now))));
 const pendingCount=new Set(view.offers.flatMap(offer=>offer.people.filter(person=>person.pending.some(window=>Date.parse(window.endsAt)>Date.parse(now))).map(person=>person.id))).size;
 const history=view.offers.filter(offer=>view.readOnly||view.group==='ADMIN'||offer.sourceGroup===view.group||offer.targetGroup===view.group);
 const inspectOnly=!!view.readOnly||!scopedLines.length;
 const cancelable=history.flatMap(offer=>(view.group==='ADMIN'||offer.targetGroup===view.group)?offer.allocations.filter(entry=>entry.planning&&!entry.canceled&&entry.canCancel&&entry.id).map(entry=>({offer,entry})):[]);
 const control=(name:string,label:string)=>{const restricted=inspectOnly&&['send','outgoing'].includes(name);return toolbar.action({type:'button','aria-expanded':panel===name,'aria-controls':`allocation-${name}`,disabled:!verified||busy||restricted,disabledExplanation:!verified?'Đang xác minh dữ liệu và quyền. Vui lòng chờ hoặc tải lại.':restricted?'Tài khoản này chỉ được xem điều phối nhân sự; thao tác chuyển và hủy cần phạm vi QLSX phù hợp.':'Đang xử lý. Vui lòng chờ hoàn tất.',onClick:()=>{if(!verified||busy||restricted)return;toggle(name);}},label);};
 return <section className={`production-allocation-queue ${styles.queue}`} aria-label="Điều phối nhân sự" aria-busy={!verified}>
  <h3>Điều phối nhân sự{status&&!statusError&&<span className={styles.loading} role="status">{status}</span>}</h3>
  <StandardToolbar permissionFeedback name="Điều phối nhân sự" items={[
   control('send','Chuyển nhân sự'),
   control('pending',`Chờ phân bổ (${pendingCount})`),
   control('outgoing','Hủy chuyển nhân sự'),
   control('history','Lịch sử'),
   control('help','Hướng dẫn'),
   view.group==='ADMIN'&&control('setup','Thiết lập QLSX'),
   verified&&inspectOnly&&toolbar.note(view.configurationEnabled===false?'Chỉ xem · Chưa bật cấu hình':'Chỉ xem'),
   statusError&&onReload&&toolbar.action({type:'button',disabled:reloadBusy,disabledExplanation:"Đang tải dữ liệu. Vui lòng chờ hoàn tất.",title:status,onClick:()=>void onReload()},'Cập nhật dữ liệu'),
   !!panel&&toolbar.action({type:'button',onClick:()=>setPanel('')},'Đóng'),
  ]}/>
  {visibleError&&<PlanningFeedback kind="error" message={visibleError} onClose={()=>setVisibleError('')}/>}
  <div id="allocation-setup" className={styles.panel} hidden={panel!=='setup'}>
   <strong>Thiết lập phạm vi QLSX</strong>
   <p>{view.configurationEnabled===false?'Chưa bật cấu hình điều phối. ':''}{!scopedLines.length&&!view.readOnly?'Chưa được thiết lập phạm vi QLSX. ':''}Admin được thao tác cả A/B/C; tài khoản QLSX vẫn cần được gán đúng phạm vi trước khi chuyển hoặc phân công.</p>
   {view.group==='ADMIN'&&panel==='setup'&&<fieldset className={styles.gate} disabled={!verified||busy}><ProductionAllocationScope embedded onSaved={onScopeSaved}/></fieldset>}
  </div>
  <div id="allocation-help" className={styles.panel} hidden={panel!=='help'}>
   <p>Chuyển nhân sự đến nhóm nhận; QLSX nhóm nhận chọn Line A/B hoặc C. Chưa ghi nhận giờ công thực tế. Thời gian GMT+7, chính xác đến phút.</p>
   <p>Có thể chọn nhiều ngày: toàn bộ khoảng đề nghị được giữ chỗ; giờ kế hoạch chỉ tính phần giao với ca HC/TC từng ngày, không tính giờ nghỉ trưa. Chỉ cập nhật lịch nháp; lịch đã chốt hoặc đang khóa không nhận phân công.</p>
  </div>
  {verified&&!scopedLines.length&&!view.readOnly&&<p role="alert" className={styles.notice}>Chưa được thiết lập phạm vi QLSX. Liên hệ Admin để thiết lập.</p>}
  {inspectOnly?<div id="allocation-pending" className={styles.panel} hidden={panel!=='pending'}>
   <h4>Chờ phân bổ · Chỉ xem</h4>{view.offers.length?view.offers.map(offer=><article className={styles.record} key={offer.id}><strong>Line {offer.sourceLine} → {offer.targetGroup==='AB'?'nhóm Line A/B':'Line C'}</strong><p>{display(offer.effectiveAt)} – {display(offer.endsAt)} (GMT+7){offer.expired?' · Hết hạn':''}</p>{offer.people.map(person=><p key={person.id}>{person.name} ({person.id}) · {person.pending.length?person.pending.map(window=>`${display(window.effectiveAt)} – ${display(window.endsAt)}`).join('; '):'Không còn khoảng chờ'}</p>)}</article>):<p>Chưa có đề nghị điều phối.</p>}
  </div>:<>
  <div id="allocation-send" className={styles.panel} hidden={panel!=='send'}><h4>Chuyển nhân sự</h4><p>Nhóm nhận: <strong>{sourceLine==='C'?'QLSX Line A/B':'QLSX Line C'}</strong> · Bên nhận sẽ chọn Line và khoảng giờ phân công.</p>
   <form onInvalid={notifyInvalidAction} className={styles.form} aria-label="Gửi đề nghị nhân lực" onSubmit={async event=>{
    event.preventDefault();if(disabled||!people.length||!reason.trim()||!validRange(start,end,min))return;
    const ok=await submit({action:'offer',expectedRevision:view.revision,sourceLine,employees:people,reason:reason.trim(),effectiveAt:iso(start),endsAt:iso(end)});
    if(ok){setSelected([]);setReason('');draftTouched.current=false;}
   }}>
    <fieldset disabled={disabled}><legend>Nhân viên và khoảng giờ đề nghị</legend>
     <label>Line nguồn <select aria-label="Line nguồn" value={sourceLine} onChange={e=>{draftTouched.current=true;setChosenLine(e.target.value);setSelected([]);}}>{scopedLines.map(line=><option key={line} value={line}>{line}</option>)}</select></label>
     <AllocationEmployeePicker key={`${sourceLine}:${panel==='send'}`} candidates={available} selected={people} disabled={disabled} onChange={value=>{draftTouched.current=true;setSelected(value);}}/>
     <label>Từ ngày, giờ <ProductionDateTimeInput label="Đề nghị từ ngày giờ" name="offerStart" min={min} value={start} onChange={changeStart}/></label>
     <label>Đến ngày, giờ <ProductionDateTimeInput label="Đề nghị đến ngày giờ" name="offerEnd" min={start||min} value={end} onChange={value=>{draftTouched.current=true;setEnd(value);}}/></label>
     <label>Lý do chuyển <input aria-label="Lý do chuyển nhân sự" required maxLength={500} value={reason} onChange={e=>{draftTouched.current=true;setReason(e.target.value);}}/></label>
     {start<min&&<p role="status" className={styles.notice}>Giờ bắt đầu đã qua. Chọn ngày hoặc giờ chưa qua để chuyển nhân sự; giờ mặc định 08:00–17:00 vẫn được giữ để bạn tự sửa.</p>}
     <FeedbackActionButton stableContainer className={styles.submit} type="submit" disabled={disabled||!people.length||!reason.trim()||!validRange(start,end,min)} disabledExplanation={view.readOnly?"Tài khoản này chỉ được xem điều phối nhân sự.":disabled?"Đang xử lý. Vui lòng chờ hoàn tất.":!people.length?"Chọn ít nhất một nhân viên thuộc Line nguồn.":!reason.trim()?"Nhập lý do chuyển nhân sự.":"Nhập giờ kết thúc sau giờ bắt đầu, chính xác đến phút; khoảng đề nghị không được ở quá khứ."}>Chuyển nhân sự ({people.length})</FeedbackActionButton>
    </fieldset>
   </form>
  </div>
  <div id="allocation-pending" className={styles.panel} hidden={panel!=='pending'}><h4>Chờ phân bổ <span aria-label={`${pendingCount} người đang chờ nhận`}>({pendingCount})</span></h4>{(hasIncoming||!sentPending.length)&&<section aria-label="Nhân lực được đề nghị"><ProductionAllocationSelection view={view} busy={disabled} now={now} onCommand={onCommand}/></section>}
   {sentPending.length>0&&<details className={styles.sentPending}><summary>Nhân viên đã chuyển đang chờ bên nhận phân bổ ({new Set(sentPending.flatMap(o=>o.people.filter(p=>p.pending.length).map(p=>p.id))).size}) ▾</summary><p>QLSX phía chuyển theo dõi tại đây. QLSX phía nhận sẽ chọn Line và thời gian phân bổ.</p><div className={styles.historyTable}><table data-no-pagination="true"><thead><tr><th>Nhân viên</th><th>Line nguồn</th><th>Bên nhận</th><th>Khoảng còn chờ</th></tr></thead><tbody>{sentPending.flatMap(offer=>offer.people.filter(p=>p.pending.length).map(person=><tr key={offer.id+person.id}><td>{person.name} ({person.id})</td><td>Line {offer.sourceLine}</td><td>QLSX {offer.targetGroup==='AB'?'Line A/B':'Line C'}</td><td>{person.pending.map(w=><div key={w.effectiveAt}>{display(w.effectiveAt)} – {display(w.endsAt)}</div>)}</td></tr>))}</tbody></table></div></details>}
  </div>
  <div id="allocation-outgoing" className={styles.panel} hidden={panel!=='outgoing'}>
   <h4>Hủy chuyển nhân sự</h4>
   {hasOutgoing&&<WithdrawMany offers={outgoing} view={view} busy={disabled} onCommand={onCommand} now={now}/>}
   {cancelable.length>0&&<StandardToolbar name="Hủy phân bổ đã nhận" items={[toolbar.field('Phân công đã nhận',[toolbar.select({value:cancelSelection,disabled,onChange:e=>setCancelSelection(e.target.value),'aria-label':'Chọn phân công đã nhận cần hủy'},<><option value="">Chọn nhân viên</option>{cancelable.map(({offer,entry})=><option key={entry.id} value={`cancel:${offer.id}:${entry.id}`}>{offer.people.find(person=>person.id===entry.employeeId)?.name||entry.employeeId} · {offer.sourceLine} → {entry.targetLine}</option>)}</>)])]} />}
   {cancelable.filter(({offer,entry})=>cancelSelection===`cancel:${offer.id}:${entry.id}`).map(({offer,entry})=><article className={styles.record} key={`${offer.id}:${entry.id}`}>
    <p><strong>{offer.people.find(person=>person.id===entry.employeeId)?.name||entry.employeeId}</strong> · Line {offer.sourceLine} → {entry.targetLine}{entry.effectiveAt&&entry.endsAt?` · ${display(entry.effectiveAt)} – ${display(entry.endsAt)} (GMT+7)`:''}</p>
    <CancelAllocation offerId={offer.id} allocationId={entry.id!} revision={view.revision} busy={disabled} onCommand={onCommand}/>
   </article>)}
   {!hasOutgoing&&!cancelable.length&&<p>Không có lượt phân công được phép hủy.</p>}

  </div>
  </>}
  <Dialog open={panel==='history'} onOpenChange={open=>{if(!open)setPanel('');}}><DialogContent className={styles.historyDialog}>
   <DialogTitle>Lịch sử</DialogTitle><DialogDescription>Thời gian hiển thị theo giờ Việt Nam (GMT+7). Mở từng lượt chuyển để xem phân bổ, sửa và hủy; người thao tác và thời gian đều được ghi nhận.</DialogDescription>
   <div className={styles.historyBody}>{history.length===0&&<p>Chưa có lịch sử chuyển, phân bổ hoặc hủy.</p>}{history.slice().reverse().map(offer=><details className={styles.historyGroup} key={offer.id}>
    <summary><span className={styles.historySummary}><span><small>Chuyển nhân sự ▾</small><strong>Line {offer.sourceLine} → {offer.targetGroup==='AB'?'nhóm A/B':'C'}</strong></span><span><small>Nhân sự / Trạng thái</small><strong>{offer.people.length} nhân viên · {offer.expired?'Hết hạn':offer.people.some(p=>p.pending.length)?'Còn chờ phân bổ':'Đã xử lý'}</strong>{(offer.withdrawals.length>0||offer.allocations.some(entry=>entry.canceled))&&<span>{offer.withdrawals.length>0?'Có hủy chuyển nhân sự':''}{offer.withdrawals.length>0&&offer.allocations.some(entry=>entry.canceled)?' · ':''}{offer.allocations.some(entry=>entry.canceled)?'Có hủy phân bổ nhân sự':''}</span>}</span><span><small>Thời gian chuyển</small>{display(offer.effectiveAt)} – {display(offer.endsAt)}</span><span><small>Người thao tác / Thời gian thao tác</small><strong>{offer.createdBy||'Chưa ghi nhận'}</strong>{offer.createdAt?display(offer.createdAt):'Chưa ghi nhận thời gian'}</span></span></summary>
    <dl className={styles.historyMeta}><div><dt>Nhân viên</dt><dd>{offer.people.map(p=>`${p.name} (${p.id})`).join(', ')}</dd></div><div><dt>Người chuyển</dt><dd>{offer.createdBy||'Chưa ghi nhận'}</dd></div><div><dt>Thời gian thao tác</dt><dd>{offer.createdAt?display(offer.createdAt):'—'}</dd></div><div><dt>Lý do chuyển</dt><dd>{offer.reason||'—'}</dd></div></dl>
    <div className={styles.historyTable}><table data-no-pagination="true"><thead><tr>{['Thao tác','Nhân viên','Line nhận','Từ – đến','Người thao tác','Thời gian thao tác','Lý do'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>
    {offer.withdrawals.map((entry,index)=><tr key={'w'+(entry.id||index)}><td>Hủy chuyển nhân sự</td><td>{offer.people.find(p=>p.id===entry.employeeId)?.name||entry.employeeId}</td><td>—</td><td>{entry.effectiveAt?display(entry.effectiveAt):'—'}<br/>{entry.endsAt?display(entry.endsAt):'—'}</td><td>{entry.actorId||'—'}</td><td>{entry.recordedAt?display(entry.recordedAt):'—'}</td><td>{entry.reason||'—'}</td></tr>)}
    {offer.allocations.flatMap((entry,index)=>[<tr key={'a'+(entry.id||index)}><td>{entry.replaces?'Sửa phân bổ':entry.planning?'Phân bổ nhân sự (kế hoạch)':'Phân bổ nhân sự (thực tế)'}</td><td>{offer.people.find(p=>p.id===entry.employeeId)?.name||entry.employeeId}</td><td>{entry.targetLine||'—'}</td><td>{entry.effectiveAt?display(entry.effectiveAt):'—'}<br/>{entry.endsAt?display(entry.endsAt):'—'}</td><td>{entry.actorId||'—'}</td><td>{entry.recordedAt?display(entry.recordedAt):'—'}</td><td>{entry.reason||'—'}{entry.previousAllocation&&<p>Trước: Line {entry.previousAllocation.targetLine} · {display(entry.previousAllocation.effectiveAt)} – {display(entry.previousAllocation.endsAt)}</p>}{entry.replacedBy&&<p>Đã thay bằng phân bổ mới</p>}</td></tr>,...(entry.canceled&&!entry.replacedBy?[<tr key={'c'+(entry.id||index)}><td>Hủy phân bổ nhân sự</td><td>{offer.people.find(p=>p.id===entry.employeeId)?.name||entry.employeeId}</td><td>{entry.targetLine||'—'}</td><td>{entry.effectiveAt?display(entry.effectiveAt):'—'}<br/>{entry.endsAt?display(entry.endsAt):'—'}</td><td>{entry.canceledBy||'—'}</td><td>{entry.canceledAt?display(entry.canceledAt):'—'}</td><td>{entry.cancellationReason||'—'}</td></tr>]:[])])}
    {!offer.withdrawals.length&&!offer.allocations.length&&<tr><td colSpan={7}>Chưa có thao tác phân bổ hoặc hủy.</td></tr>}
    </tbody></table></div>
    {offer.allocations.filter(entry=>!entry.canceled).map(entry=><div className={styles.allocationActions} key={entry.id}>
     <strong>{offer.people.find(p=>p.id===entry.employeeId)?.name||entry.employeeId} · Line {entry.targetLine} · {entry.effectiveAt?display(entry.effectiveAt):'—'} – {entry.endsAt?display(entry.endsAt):'—'}</strong>
     {!view.readOnly&&(view.group==='ADMIN'||view.group===offer.targetGroup)?entry.canCancel?<div className={styles.confirmActions}><EditAllocation offer={offer} entry={entry} view={view} busy={disabled} onCommand={onCommand} now={now}/><CancelAllocation offerId={offer.id} allocationId={entry.id!} revision={view.revision} busy={disabled} onCommand={onCommand}/></div>:<p>Phân bổ đã bắt đầu hoặc đã ghi nhận thực tế. Vào Lịch SX thực tế → Thu hồi nhân sự để điều chỉnh phần thời gian còn lại.</p>:<p>Chỉ QLSX phía nhận hoặc Admin được sửa / hủy phân bổ.</p>}
    </div>)}
   </details>)}</div><FeedbackActionButton onClick={()=>setPanel('')}>Đóng lịch sử</FeedbackActionButton>
  </DialogContent></Dialog>
 </section>;
}
