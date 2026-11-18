"use client";
import {useCallback,useEffect,useState} from 'react';
import {apiFetch,clientSessionGeneration} from '../lib/data-sync';
import {ProductionPlan} from './production-plan';
import {FeedbackActionButton} from './action-feedback';

type AccessUser={login:string;view:boolean;eligible:boolean;reason?:string};
type AccessState={revision:string;users:AccessUser[]};
export function LinePlanAccess(){
 const [session]=useState(clientSessionGeneration);
 const [data,setData]=useState<AccessState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const r=await apiFetch('/api/quick-line-plan-access',{cache:'reload'});const d=await r.json();if(session!==clientSessionGeneration())return;if(!r.ok)throw Error(d.error);if(typeof d.revision!=='string'||!Array.isArray(d.users))throw Error('Không xác minh được dữ liệu quyền Line.');setData(d);},[session]);
 useEffect(()=>{const timer=setTimeout(()=>{void load().catch(e=>setError(e.message));},0);return()=>clearTimeout(timer);},[load]);
 async function save(login:string,view:boolean){
  if(busy||!data||!window.confirm(`${view?'Cấp':'Thu hồi'} quyền Xem Pro Plan cho ${login}? Chỉ xem Line của tài khoản, không cấp quyền sửa.`))return;
  setBusy(true);setError('');try{const r=await apiFetch('/api/quick-line-plan-access',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login,view,confirmed:true,expectedRevision:data.revision})});const d=await r.json();if(session!==clientSessionGeneration())return;if(!r.ok)throw Error(d.error);await load();}catch(e){if(session===clientSessionGeneration()){setError(e instanceof Error?e.message:'Không lưu được quyền.');setData(null);}}finally{setBusy(false);}
 }
 return <section className="data-card"><h3>Line A / B · Quyền Xem Pro Plan</h3><p>Chỉ xem kế hoạch của Line mình. Không mở sửa, chốt, tách đơn, xuất file hoặc dữ liệu tổng hợp.</p>{error&&<p role="alert">{error}</p>}{data?.users.map(u=><p key={u.login}>{u.login}: {u.view?'Đã cấp quyền xem':'Chưa cấp quyền xem'} <FeedbackActionButton type="button" disabled={busy||!u.eligible} disabledExplanation={busy?"Đang lưu quyền. Vui lòng chờ.":u.reason||"Tài khoản Line chưa đủ điều kiện."} onClick={()=>void save(u.login,!u.view)}>{u.view?'Thu hồi quyền xem':'Cấp quyền xem'}</FeedbackActionButton>{u.reason}</p>)}<FeedbackActionButton type="button" disabled={busy} disabledExplanation="Đang lưu quyền. Vui lòng chờ." onClick={()=>void load().catch(e=>setError(e.message))}>Tải lại quyền Line</FeedbackActionButton></section>;
}

export function QuickLinePlan({line}:{line:'A'|'B'}){
 return <ProductionPlan key={line} readOnlyLine={line}/>;
}
