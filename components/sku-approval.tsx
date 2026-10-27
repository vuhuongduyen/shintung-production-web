"use client";
import {FeedbackActionButton} from './action-feedback';
import {productionDisplayTime} from "../lib/production-display-time.mjs";
import { apiFetch as fetch, clientSessionGeneration, isClientSessionReadCancelled, subscribeClientReadInvalidation, useDataRefresh } from "../lib/data-sync";
import { loadSkuRecords, replaceSkuRecords, skuDisplayState, subscribeSkuDisplay, type SkuDisplayState } from "../lib/sku-display-resource";
import { SkuReadCancelled } from "../lib/sku-display-cache.mjs";
import {useCallback,useEffect,useRef,useState} from 'react';
export type ApprovalItem={code:string;status:string;confirmation_status?:string;usage_status?:string;confirmation_source?:string;confirmed_by?:string;confirmed_at?:string;confirmedBy?:string;confirmedAt?:string;currentData?:Record<string,unknown>;requestType?:string;source?:string;createdBy?:string;createdAt?:string};
export function approvalTime(value?:string){return productionDisplayTime(value,'—');}
const cancelled=(error:unknown)=>error instanceof SkuReadCancelled||isClientSessionReadCancelled(error);
export function useSkuApproval<T extends ApprovalItem>(enabled:boolean,onChanged:(rows:T[])=>void){
 const dataRevision=useDataRefresh(['sku']);
 const [snapshot,setSnapshot]=useState<SkuDisplayState<T>>(()=>skuDisplayState<T>());
 const [canConfirm,setCanConfirm]=useState(false),[capabilityLoading,setCapabilityLoading]=useState(false),[capabilityError,setCapabilityError]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[receipt,setReceipt]=useState<T[]>([]);
 const mounted=useRef(false),capabilitySequence=useRef(0),lastRevision=useRef(dataRevision);
 useEffect(()=>{mounted.current=true;const update=()=>setSnapshot(skuDisplayState<T>());update();const unsubscribe=subscribeSkuDisplay(update);const reset=subscribeClientReadInvalidation(reason=>{if(reason==='session'){capabilitySequence.current++;setCanConfirm(false);setCapabilityLoading(false);setCapabilityError('');}});return()=>{mounted.current=false;capabilitySequence.current++;unsubscribe();reset();};},[]);
 useEffect(()=>{onChanged(snapshot.records?.map(record=>record.payload)||[]);},[snapshot.records,onChanged]);
 const refresh=useCallback((force=true)=>{
   const sequence=++capabilitySequence.current,session=clientSessionGeneration();
   const current=()=>mounted.current&&sequence===capabilitySequence.current&&session===clientSessionGeneration();
   setCanConfirm(false);setCapabilityLoading(true);setCapabilityError('');
   // Current capabilities gate actions only. Slow or failed validation must not
   // block independently authorized catalogue rows from reaching the screen.
   void fetch('/api/sku-capabilities',{cache:'reload'}).then(async response=>{
     if(!response.ok)throw new Error('Không kiểm tra được quyền xác nhận SKU.');
     const data=await response.json();if(typeof data.canConfirm!=='boolean')throw new Error('Phản hồi quyền xác nhận SKU chưa hợp lệ.');
     if(current())setCanConfirm(data.canConfirm);
   }).catch(error=>{if(current()&&!cancelled(error))setCapabilityError(error instanceof Error?error.message:String(error));}).finally(()=>{if(current())setCapabilityLoading(false);});
   return loadSkuRecords<T>(force);
 },[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>{setMessage('');setReceipt([]);},4000);return()=>clearTimeout(timer);},[message]);
 useEffect(()=>{
   if(!enabled){capabilitySequence.current++;setCanConfirm(false);setCapabilityLoading(false);return;}
   const changed=lastRevision.current!==dataRevision;lastRevision.current=dataRevision;
   void refresh(changed).catch(()=>{/* The persistent snapshot status owns read errors. */});
 },[enabled,dataRevision,refresh]);
 const confirm=async(codes:string[])=>{
   if(busy||!canConfirm||!codes.length)return [];
   const session=clientSessionGeneration(),current=()=>mounted.current&&session===clientSessionGeneration();
   setBusy(true);setMessage('');setReceipt([]);
   try{
     const records=snapshot.records||[],items=codes.map(code=>records.find(record=>record.key===code));
     if(items.some(record=>!record||record.payload.status!=='Chờ xác nhận'))throw Error('Hãy tải lại và chọn SKU đang chờ xác nhận');
     const response=await fetch('/api/sku-confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:items.map(record=>({key:record!.key,updatedAt:record!.updatedAt}))})});
     const data=await response.json();if(!response.ok)throw Error(data.error);if(!current())return [];
     const updated=records.map(record=>{const payload=data.payloads.find((item:T)=>item.code===record.key);return payload?{...record,payload,updatedAt:payload.confirmedAt||record.updatedAt}:record;});
     replaceSkuRecords(updated);setReceipt(data.payloads);setMessage(`Đã xác nhận SKU ${codes.join(', ')} thành công`);
     window.dispatchEvent(new Event('onspa-approvals-changed'));await refresh().catch(()=>{});return data.payloads as T[];
   }catch(error){if(current()&&!cancelled(error))setMessage(error instanceof Error?error.message:String(error));return [];}
   finally{if(current())setBusy(false);}
 };
 return {canConfirm,capabilityLoading,capabilityError,busy,message,receipt,confirm,refresh,
   hasData:snapshot.records!==null,refreshing:snapshot.loading,error:snapshot.error,updatedAt:snapshot.updatedAt,
   dismiss:()=>{setMessage('');setReceipt([]);}};
}
export function SkuDataStatus({state,language}:{state:{hasData:boolean;refreshing:boolean;error:Error|null;updatedAt:number|null;capabilityLoading:boolean;capabilityError:string;refresh:(force?:boolean)=>Promise<unknown>};language:string}){
 // Routine background reads stay quiet. Initial loading belongs to the table.
 if(!state.error&&!state.capabilityError)return null;
 const text=(vi:string,zh:string,en:string)=>language==='vi'?vi:language==='zh'?zh:en;
 const time=state.error&&state.hasData&&state.updatedAt!==null?productionDisplayTime(new Date(state.updatedAt)):'';
 return <div className="production-inline-message error" role="alert" aria-live="polite">
   {state.error&&text(state.hasData?'Chưa cập nhật được SKU; đang hiển thị dữ liệu đã tải trước đó.':'Chưa tải được dữ liệu SKU.',state.hasData?'SKU 更新失敗；顯示上次成功載入的資料。':'無法載入 SKU 資料。',state.hasData?'SKU refresh failed; showing the last loaded data.':'SKU data could not be loaded.')}
   {time&&<> {text('Lần tải thành công:','上次成功載入：','Last successful load:')} {time}.</>}
   {state.capabilityError&&<> {text('Chưa kiểm tra được quyền xác nhận; thao tác xác nhận tạm khóa.','無法驗證確認權限；暫停確認操作。','Could not verify confirmation permissions; confirmation is temporarily disabled.')}</>}
   <FeedbackActionButton type="button" onClick={()=>{void state.refresh(true).catch(()=>{});}}>{text('Thử lại','重試','Retry')}</FeedbackActionButton>
 </div>;
}
export function SkuResultCount({count,hasData,error,language}:{count:number;hasData:boolean;error:Error|null;language:string}){
 const text=(vi:string,zh:string,en:string)=>language==='vi'?vi:language==='zh'?zh:en;
 return hasData?<><strong>{count}</strong> {text('SKU được tìm thấy','筆 SKU','SKU found')}</>:<span>{error?text('Chưa xác định số SKU; tải dữ liệu thất bại.','載入失敗，尚無法確認 SKU 數量。','SKU count unavailable; data could not be loaded.'):text('Đang tải danh sách SKU…','正在載入 SKU 清單…','Loading SKU list…')}</span>;
}
