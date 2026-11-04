'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {readProductionWorkflow} from '../lib/production-workflow-cache';
import {FeedbackActionButton} from './action-feedback';
type Row=Record<string,any>;
type Data={orders:Row[];reports:Row[];events:Row[];employees:Row[]};
// Work is deliberately a projection. Never use it as a successful full-detail
// response, and never adopt a late disclosure response into the work board.
export default function ProductionDetailRead({full,detail,data,contextKey,refreshKey,children}:{full:boolean;detail:Row;data:Data;contextKey:string;refreshKey:number;children:(data:Data,detail:Row)=>ReactNode}){
 const key=JSON.stringify([contextKey,detail.id,detail.kind]);
 const [retry,setRetry]=useState(0),[state,setState]=useState<{key:string;value:Data|null;loading:boolean;error:Error|null}>({key:'',value:null,loading:true,error:null});
 useEffect(()=>{
  if(!full)return;
  let current=true;
  setState(old=>({key,value:old.key===key?old.value:null,loading:true,error:null}));
  void readProductionWorkflow(true,'full').then(value=>{if(current)setState({key,value,loading:false,error:null});}).catch(error=>{
   if(!current)return;
   const discard=error?.status===401||error?.status===403||['ClientSessionReadCancelled','ProductionReadCancelled'].includes(error?.name);
   setState(old=>({key,value:!discard&&old.key===key?old.value:null,loading:false,error:error instanceof Error?error:new Error('Không tải được chi tiết.')}));
  });
  return()=>{current=false;};
 },[full,key,retry,refreshKey]);
 if(!full)return children(data,detail);
 const value=state.key===key?state.value:null,loading=state.key!==key||state.loading,error=state.key===key?state.error:null;
 const resolved=value&&(value.reports.find(row=>row.id===detail.id&&row.kind===detail.kind)||value.orders.find(row=>row.id===detail.id)||value.events.find(row=>row.id===detail.id&&row.kind===detail.kind));
 return <>
  {loading&&!value&&<p role="status">Đang tải đầy đủ chi tiết…</p>}
  {(error||!loading&&!resolved)&&<section role="alert" className="production-inline-message error"><p>{error?`Không tải được đầy đủ chi tiết. ${error.message}`:'Bản ghi không còn trong dữ liệu chi tiết hiện tại. Tải lại để kiểm tra.'}{value&&resolved?' Đang hiển thị chi tiết đầy đủ của lần tải trước.':''}</p><FeedbackActionButton type="button" disabled={loading} disabledExplanation="Đang tải chi tiết. Vui lòng chờ hoàn tất." onClick={()=>setRetry(n=>n+1)}>Thử tải lại chi tiết</FeedbackActionButton></section>}
  {value&&resolved&&children(value,resolved)}
 </>;
}
