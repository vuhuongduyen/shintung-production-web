"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import PlanningFeedback from './planning-feedback';
import ProductionAllocationQueue,{type AllocationQueueView} from './production-allocation-queue';
import {retainedAllocation,readAllocationWorkspace} from '../lib/allocation-workspace-cache';
import {productionApiFetch} from '../lib/production-api';
const denialFallback='Không có quyền truy cập Điều phối nhân sự. Vui lòng kiểm tra tài khoản và quyền truy cập.';
const scopeSetup='Admin thiết lập tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX.';
export async function allocationDenialMessage(response:Response):Promise<string>{
 let message='';
 try{
  const text=(await response.text()).trim();
  try{const result:unknown=JSON.parse(text);if(result&&typeof result==='object'&&'error' in result&&typeof result.error==='string')message=result.error.trim();}
  catch{if(text&&!/[<>{}]/.test(text)&&!response.headers.get('content-type')?.includes('json'))message=text;}
 }catch{/* A missing/unreadable body must not invent a missing-scope diagnosis. */}
 message=message.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500);
 if(!message)return denialFallback;
 const missingScope=/chưa.{0,45}(?:cấu hình|thiết lập|cấp|gán).{0,20}phạm vi QLSX/i.test(message);
 return missingScope?`${message} ${scopeSetup}`:message;
}
type QueueData=AllocationQueueView&{candidates:{id:string;name:string;line:string}[]};
const emptyQueue:QueueData={revision:0,readOnly:true,group:'',sourceLines:[],pendingPeople:0,offers:[],candidates:[]};
export default function ProductionAllocationWorkspace({identity,refresh,planningDate,contextReady=true}:{identity:string;refresh:()=>Promise<boolean>;planningDate?:string;contextReady?:boolean}){
 return <AllocationWorkspaceSession key={identity} refresh={refresh} planningDate={planningDate} contextReady={contextReady}/>;
}
function AllocationWorkspaceSession({refresh,planningDate,contextReady}:{refresh:()=>Promise<boolean>;planningDate?:string;contextReady:boolean}){
 const [data,setData]=useState<QueueData|null>(()=>retainedAllocation()),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[ready,setReady]=useState(false),[verifiedDate,setVerifiedDate]=useState<string|undefined>();
 const [success,setSuccess]=useState('');
 const generation=useRef(0),loadSequence=useRef(0),mutation=useRef(false),verified=useRef(false);
 const canAct=ready&&verifiedDate===planningDate&&contextReady;
 verified.current=canAct;
 const load=useCallback(async(force=false)=>{
  const current=generation.current,sequence=++loadSequence.current;
  setLoading(true);
  try{const result=await readAllocationWorkspace(force);
   if(current===generation.current&&sequence===loadSequence.current){setData(result);setVerifiedDate(planningDate);setReady(true);setError('');}
  }catch(e){if(current===generation.current&&sequence===loadSequence.current){verified.current=false;setReady(false);if([401,403].includes((e as any)?.status))setData(null);setError(e instanceof Error?e.message:'Không tải được Chờ phân bổ.');}}
  finally{if(current===generation.current&&sequence===loadSequence.current)setLoading(false);}
 },[planningDate]);
 useEffect(()=>{const current=++generation.current;const initial=setTimeout(()=>void load(),0);const timer=setInterval(()=>{if(!mutation.current)void load();},30000);const onFocus=()=>{if(!mutation.current)void load();};window.addEventListener('focus',onFocus);window.addEventListener('onspa-capacity-changed',onFocus);return()=>{verified.current=false;generation.current=current+1;clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('onspa-capacity-changed',onFocus);};},[load]);
 const command=async(body:Record<string,unknown>)=>{
  if(mutation.current||!verified.current||!data||data.readOnly)return false;
  mutation.current=true;setBusy(true);setSuccess('');const current=generation.current;
  try{const response=await productionApiFetch('/api/production-allocation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json();
   if(!response.ok){if([401,403,409].includes(response.status)){verified.current=false;setReady(false);if([401,403].includes(response.status))setData(null);}throw Error(result.error||'Không lưu được phân bổ.');}
   if(current!==generation.current)return false;await Promise.all([load(true),refresh()]);setSuccess(body.action==='edit'?'Đã sửa phân bổ và cập nhật lịch nhân sự.':body.action==='cancel'?'Đã hủy phân bổ. Nhân viên trở lại Chờ phân bổ.':'Đã lưu thao tác điều phối nhân sự.');return true;
  }catch(e){if(current===generation.current){setError(e instanceof Error?e.message:'Không lưu được phân bổ.');if(e instanceof Error&&/vừa thay đổi|Tải lại/i.test(e.message))void load();}return false;}
  finally{mutation.current=false;if(current===generation.current)setBusy(false);}
 };
 return <>{success&&<PlanningFeedback kind="success" message={success} onClose={()=>setSuccess('')}/>}<ProductionAllocationQueue view={data||emptyQueue} candidates={data?.candidates||[]} busy={busy} verified={canAct} status={error||(!data&&loading?'Đang tải…':'')} statusError={!!error} reloadBusy={loading||busy} onReload={()=>load(true)} onCommand={command} onScopeSaved={()=>load(true)} planningDate={planningDate}/></>;
}
