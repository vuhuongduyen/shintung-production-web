"use client";
import './production-stage-cancel.css';
import {useState,useRef} from 'react';
import {productionApiFetch} from '../lib/production-api';

type Row=Record<string,any>;
export const canCancelStageEvent=(e:Row)=>e.stageReporting&&!e.voided&&['start','pause','resume','complete','add','extra'].includes(e.stageAction);
export function useStageCancellation({orderId,reason,allowed,onSaved,onBusyChange,restore}:{orderId?:string;reason:string;restore?:Record<string,any>|null;allowed:boolean;onSaved:(result:Row)=>Promise<any>;onBusyChange:(busy:boolean)=>void}){
 const [selected,setSelected]=useState<string[]>([]),[checked,setChecked]=useState<{result:Row;reason:string;ids:string;orderId:string;restore:string}|null>(null),[error,setError]=useState('');
 const pending=useRef(false);
 const restoreKey=JSON.stringify(restore||null);
 const preview=checked&&checked.restore===restoreKey&&checked.reason===reason&&checked.ids===JSON.stringify(selected)&&checked.orderId===orderId?checked.result:null;
 const invalidate=()=>{setChecked(null);setError('');};
 const reset=()=>{setSelected([]);setChecked(null);setError('');};
 const toggle=(id:string)=>{if(pending.current)return;setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setChecked(null);setError('');};
 const request=async()=>{
  if(pending.current||!allowed||!orderId||!selected.length||!reason.trim())return;
  if(restore&&(!Array.isArray(restore.employees)||!restore.employees.length)){setError('Chọn ít nhất một nhân viên để phân bổ lại, hoặc bỏ chọn Phân bổ lại NV.');return;}
  pending.current=true;onBusyChange(true);setError('');
  const action=preview?'apply':'preview';
  try{
   const response=await productionApiFetch('/api/production-correction',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'cancel-stage',action,orderId,eventIds:selected,reason,restore:restore||undefined,expectedRevision:preview?.expectedRevision})});
   const result=await response.json();
   if(!response.ok){const message=response.status<500&&typeof result.error==='string'?result.error:'Không thể hoàn tất hủy thao tác. Vui lòng thử lại.';throw Error(message);}
   if(action==='preview')setChecked({result,reason,ids:JSON.stringify(selected),orderId,restore:restoreKey});
   else{reset();await onSaved(result);}
  }catch(e){const message=(e as Error).message;setChecked(null);setError(message);}
  finally{pending.current=false;onBusyChange(false);}
 };
 return {selected,preview,error,toggle,reset,invalidate,request};
}
