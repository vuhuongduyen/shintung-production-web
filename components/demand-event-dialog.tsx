"use client";
import DemandImageImport from './demand-image-import';
import {notifyInvalidAction} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import {vietnamDate} from '../lib/vietnam-calendar.mjs';
import { recordFetch as fetch } from "../lib/record-fetch";
import {monday,weekEnd,displayDate} from '../lib/production-plan.mjs';
import {usableSku} from '../lib/sku-state.mjs';
import {useEffect,useRef,useState} from 'react';
type Master={code:string;name:string;specification:string;group:string;line:string;processes?:string[];status:string;_deleted?:boolean};
export type NewDemand={id:string;createdAt:string;requestDate:string;type:'Phát sinh'|'Bù tải';sku:string;name:string;spec:string;qty:number;delivery:string;priority:string;order:string;note:string;status:'Chưa lập kế hoạch';plannedWeek:string;planningWeekStart:string;planningWeekEnd:string;updatedBy:string;updatedAt:string};
const today=()=>vietnamDate();
export function DemandEventDialog({masterRows,operator,onClose,onSaved,onBatchSaved,initial}:{onBatchSaved?:()=>void;initial?:NewDemand;masterRows:Master[];operator:string;onClose:()=>void;onSaved:(row:NewDemand)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),savingRef=useRef(false),key=useRef(initial?.id || `DE-${crypto.randomUUID()}`);
 const [imageMode,setImageMode]=useState(false);
 const [planningWeekStart,setPlanningWeekStart]=useState(initial?.planningWeekStart || '');
 const [query,setQuery]=useState(initial?.sku || ''),[sku,setSku]=useState<Master|null>(()=>masterRows.find(r=>r.code===initial?.sku)||null),[requestDate,setRequestDate]=useState(()=>initial?.requestDate.split('/').reverse().join('-')||today()),[delivery,setDelivery]=useState(initial?.delivery.split('/').reverse().join('-')||''),[type,setType]=useState(initial?.type||''),[qty,setQty]=useState(initial?String(initial.qty):''),[priority,setPriority]=useState(initial?.priority||''),[order,setOrder]=useState(initial?.order==='—'?'':initial?.order||''),[note,setNote]=useState(initial?.note||''),[saving,setSaving]=useState(false),[errors,setErrors]=useState<Record<string,string>>({});
 useEffect(()=>{const el=dialog.current!;el.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;el.close();};},[]);
 const candidates=sku||!query.trim()?[]:masterRows.filter(r=>!r._deleted&&`${r.code} ${r.name} ${r.specification}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,8);
 const selectSku=(row:Master)=>{setSku(row);setQuery(row.code);setErrors(current=>({...current,sku:usableSku(row)?'':'SKU chưa được xác nhận; không thể lưu. / 產品尚未確認。'}));};
 const acceptSku=(event:React.KeyboardEvent<HTMLInputElement>)=>{
  if(event.key!=='Enter'||event.nativeEvent.isComposing)return;
  event.preventDefault();
  const exact=masterRows.filter(row=>!row._deleted&&row.code.trim().toLowerCase()===query.trim().toLowerCase());
  if(exact.length===1)selectSku(exact[0]);
  else setErrors(current=>({...current,sku:'Nhập đúng mã SKU rồi nhấn Enter, hoặc chọn trong danh sách gợi ý. / 請輸入完整產品代碼後按 Enter，或從建議清單選取。'}));
 };
 const error=(field:string)=>errors[field]?<small id={`de-${field}-error`} className="de-error" role="alert">{errors[field]}</small>:null;
 const read=(label:string,value?:string)=><label className="de-field"><span>{label}</span><input readOnly value={value||'—'}/></label>;
 const close=()=>{if(!savingRef.current)onClose();};
 async function save(e:React.FormEvent){e.preventDefault();if(savingRef.current)return;
  const next:Record<string,string>={};
  if(!sku)next.sku='Chọn SKU từ danh sách gợi ý. / 請選擇產品。';else if(!usableSku(sku))next.sku='SKU chưa được xác nhận; không thể lưu. / 產品尚未確認。';
  if(!requestDate)next.requestDate='Chọn ngày yêu cầu. / 請選擇需求日期。';if(!type)next.type='Chọn loại nhu cầu. / 請選擇需求類型。';if(!Number.isFinite(Number(qty))||Number(qty)<=0)next.qty='Số lượng phải lớn hơn 0. / 數量須大於零。';if(!delivery)next.delivery='Chọn ngày giao. / 請選擇交貨日期。';else if(delivery<requestDate)next.delivery='Ngày giao không được trước ngày yêu cầu. / 交貨日期不得早於需求日期。';if(!priority)next.priority='Chọn mức ưu tiên. / 請選擇優先級。';
  if(!planningWeekStart)next.planningWeekStart='Chọn ngày bắt đầu tuần kế hoạch. / 請選擇計畫週開始日期。';
  setErrors(next);if(Object.keys(next).length||!sku)return;savingRef.current=true;setSaving(true);
  try{const now=new Date().toISOString();const row:NewDemand={...initial,id:key.current,createdAt:initial?.createdAt || now,requestDate:requestDate.split('-').reverse().join('/'),type:type as NewDemand['type'],sku:sku.code,name:sku.name,spec:sku.specification,qty:Number(qty),delivery:delivery.split('-').reverse().join('/'),priority,order:order||'—',note,status:'Chưa lập kế hoạch',plannedWeek:'',planningWeekStart,planningWeekEnd:weekEnd(planningWeekStart),updatedBy:operator,updatedAt:now};
   const response=await fetch('/api/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entity:'demand_event',key:key.current,payload:row,...(initial?{}:{createOnly:true,expectedRevision:null})})});const data=await response.json();if(!response.ok){setErrors(data.fields||{save:data.error||`Không lưu được: HTTP ${response.status}`});return;}onSaved(data.payload);
  }catch{setErrors({save:'Mất kết nối database local. Dữ liệu nhập vẫn được giữ; hãy thử lưu lại. / 本機連線失敗，請重試。'});}finally{savingRef.current=false;setSaving(false);}
 }
 return <dialog data-own-language ref={dialog} className={`de-dialog ${imageMode?'de-dialog-image':''}`} aria-labelledby="de-title" onCancel={e=>{e.preventDefault();close();}}>{imageMode?<><h2 id="de-title">Thêm Demand event từ hình / 圖片匯入需求</h2><DemandImageImport masterRows={masterRows} operator={operator} onBusyChange={value=>{savingRef.current=value;}} onBack={()=>setImageMode(false)} onSaved={()=>{onBatchSaved?.();onClose();}}/></>:<form onInvalid={notifyInvalidAction} onSubmit={save} noValidate>
  <header><h2 id="de-title">{initial?'ĐIỀU CHỈNH DEMAND EVENT':'THÊM DEMAND EVENT'} <small>{initial?'調整需求':'新增需求'}</small></h2><FeedbackActionButton type="button" aria-label="Đóng cửa sổ Demand Event" disabled={saving} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={close}>×</FeedbackActionButton></header>
  {!initial&&<div className="de-image-entry"><FeedbackActionButton type="button" className="primary-button" onClick={()=>setImageMode(true)}>Tải hình — nhập nhiều mã / 上傳圖片</FeedbackActionButton></div>}
  <div className="de-dialog-body">
   <fieldset><legend>Thông tin sản phẩm / 產品資訊</legend>
    <div className="de-field"><label htmlFor="de-sku">SKU *</label><div><input id="de-sku" autoFocus autoComplete="off" value={query} onChange={e=>{setQuery(e.target.value);setSku(null);setErrors(current=>({...current,sku:''}));}} onKeyDown={acceptSku} placeholder="Mã SKU, tên hoặc quy cách / 產品、名稱、規格" aria-describedby="de-sku-error"/>
     {!!candidates.length&&<div className="de-suggestions" aria-label="Gợi ý SKU">{candidates.map(r=><FeedbackActionButton type="button" key={r.code} onClick={()=>selectSku(r)}><b>{r.code}</b> · {r.name} · {r.specification}</FeedbackActionButton>)}</div>}{!sku&&query&&!candidates.length&&<small>Không tìm thấy SKU. / 找不到產品。</small>}{error('sku')}</div></div>
    {read('Tên sản phẩm / 產品名稱',sku?.name)}{read('Quy cách / 規格',sku?.specification)}{read('Nhóm sản phẩm / 產品組別',sku?.group)}{read('Line / Công đoạn · 產線 / 工序',[sku?.line,...(sku?.processes||[])].filter(Boolean).join(' · '))}
   </fieldset>
   <fieldset><legend>Thông tin nhu cầu / 需求資訊</legend>
    <label className="de-field"><span>Tuần kế hoạch: ngày bắt đầu * / 計畫週開始日</span><div><input type="date" value={planningWeekStart} disabled={saving} onInput={e=>setPlanningWeekStart(monday(e.currentTarget.value))} onChange={e=>setPlanningWeekStart(monday(e.target.value))}/>{error('planningWeekStart')}</div></label>
    {read('Ngày kết thúc tuần / 計畫週結束日', planningWeekStart ? displayDate(weekEnd(planningWeekStart)) : '')}
    <label className="de-field"><span>Ngày yêu cầu * / 需求日期</span><div><input type="date" value={requestDate} onInput={e=>setRequestDate(e.currentTarget.value)} onChange={e=>setRequestDate(e.target.value)}/>{error('requestDate')}</div></label>
    <label className="de-field"><span>Loại nhu cầu * / 需求類型</span><div><select value={type} onChange={e=>setType(e.target.value)}><option value="">Chọn loại nhu cầu / 選擇</option><option value="Phát sinh">Phát sinh / 新增</option><option value="Bù tải">Bù tải / 補載</option></select>{error('type')}</div></label>
    <label className="de-field"><span>Số lượng phát sinh * / 數量</span><div><input type="number" step="any" value={qty} onChange={e=>setQty(e.target.value)}/>{error('qty')}</div></label>
    <label className="de-field"><span>Ngày giao dự kiến * / 預計交貨</span><div><input type="date" value={delivery} onInput={e=>setDelivery(e.currentTarget.value)} onChange={e=>setDelivery(e.target.value)}/>{error('delivery')}</div></label>
    <label className="de-field"><span>Mức ưu tiên * / 優先級</span><div><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Chọn mức ưu tiên / 選擇</option><option value="Gấp">Gấp / 緊急</option><option value="Thường">Thường / 一般</option></select>{error('priority')}</div></label>
    <label className="de-field"><span>Khách hàng/Mã đơn / 客戶訂單</span><input value={order} onChange={e=>setOrder(e.target.value)}/></label>
    <label className="de-field"><span>Ghi chú / 備註</span><textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
   <fieldset><legend>Thông tin hệ thống / 系統資訊</legend>{read('Trạng thái / 狀態','Chưa lập kế hoạch / 尚未排程')}{read('Người cập nhật / 更新人',operator)}{read('Thời gian cập nhật / 更新時間','Tự ghi khi lưu / 儲存時自動記錄')}{read('Tuần đã lập kế hoạch / 排程週','')}</fieldset>
  </div>
  <footer>{error('save')}<FeedbackActionButton type="button" disabled={saving} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={close}>Hủy / 取消</FeedbackActionButton><FeedbackActionButton type="submit" disabled={saving||Boolean(sku&&!usableSku(sku))} disabledExplanation={saving ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "SKU chưa đủ điều kiện sử dụng. Chọn SKU hợp lệ trước khi lưu."}>{saving?'Đang lưu… / 儲存中':'Lưu / 儲存'}</FeedbackActionButton></footer>
 </form>}</dialog>;
}
