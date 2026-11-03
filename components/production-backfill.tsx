"use client";
import {FeedbackActionButton} from './action-feedback';
import {useEffect,useRef,useState} from 'react';
import ProductionDateTimeInput from './production-date-time-input';
import './production-stage-trial.css';
import {trialStages,stageKey} from '../lib/production-stage-trial.mjs';
type Row=Record<string,any>;
const localNow=()=>new Date(Date.now()+25200000).toISOString().slice(0,16);
const iso=(v:string)=>`${v}:00+07:00`;
const display=(v:string)=>new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});
export default function ProductionBackfill({order,onSaved,onBusy,stageState={}}:{order:Row;onSaved:()=>void;onBusy:(busy:boolean)=>void;stageState?:Record<string,Row>}){
 const remainingFor=(s:string)=>Math.max(0,Number(order.lsxQty||0)-Number(stageState[stageKey(order.id,s)]?.completed||0));
 const [stage,setStage]=useState(trialStages(order)[0]||''),[from,setFrom]=useState(localNow),[closed,setClosed]=useState(false),[to,setTo]=useState(localNow),[quantity,setQuantity]=useState(()=>String(remainingFor(trialStages(order)[0]||'')));
 const [inspection,setInspection]=useState<Row|null>(null),[preview,setPreview]=useState<Row|null>(null),[people,setPeople]=useState<string[]>([]),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const remaining=Number(inspection?.remainingQuantity??remainingFor(stage));
 const saving=useRef(false),requestId=useRef(crypto.randomUUID()),sequence=useRef(0);
 const [reading,setReading]=useState(false),[retry,setRetry]=useState(0);
 const request=async(mode:string,signal?:AbortSignal,resolveAssignments=false)=>{const res=await fetch('/api/production-workflow',{method:'POST',signal,headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',orderId:order.id,requestIdempotency:requestId.current,backfill:{mode,stage,from:iso(from),to:closed?iso(to):null,through:inspection?.checkedThrough,quantity,people,resolveAssignments}})});const raw=await res.text();let data:Row;try{data=JSON.parse(raw);}catch{throw Object.assign(Error('Máy chủ chưa trả được kết quả kiểm tra. Chưa ghi dữ liệu; bấm Thử lại.'),{status:res.status});}if(!res.ok)throw Object.assign(Error(data.error||data.message||'Không kiểm tra được khoảng bù.'),{status:res.status});return data;};
 useEffect(()=>{
   const seq=++sequence.current,controller=new AbortController();setReading(true);
   const timer=setTimeout(()=>{void request('inspect',controller.signal).then(data=>{if(seq!==sequence.current)return;setInspection(data);if(data.repairAllocation?.people)setPeople(data.repairAllocation.people);setQuantity(old=>String(Math.min(Number(old)||data.remainingQuantity,data.remainingQuantity)));setError('');}).catch(e=>{if(seq===sequence.current&&!controller.signal.aborted)setError(e.message);}).finally(()=>{if(seq===sequence.current)setReading(false);});},500);
   return()=>{clearTimeout(timer);controller.abort();sequence.current++;};
 },[stage,from,to,closed,retry]);
 const invalidate=()=>{setInspection(null);setPreview(null);setPeople([]);setConsent(false);setError('');};
 const impacts=(inspection?.candidates||[]).filter((p:Row)=>people.includes(p.id)).flatMap((p:Row)=>p.assignments.filter((a:Row)=>a.orderId!==order.id||a.stage!==stage).map((a:Row)=>({...a,employeeId:p.id,name:p.name})));
 const call=async(mode:string,resolveAssignments=false)=>{
  if(saving.current||uncertain)return;saving.current=true;setBusy(true);onBusy(true);setError('');let rejected=false;
  try{const res=await fetch('/api/production-workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',orderId:order.id,requestIdempotency:requestId.current,backfill:{mode,stage,from:iso(from),to:closed?iso(to):null,through:inspection?.checkedThrough,quantity,people,expectedRevision:preview?.expectedRevision,confirmedAllocations:impacts,resolveAssignments}})});
   const responseText=await res.text();let data:Row;try{data=JSON.parse(responseText);}catch{rejected=!['apply','save'].includes(mode);throw Error(['apply','save'].includes(mode)?'Chưa xác định kết quả lưu do máy chủ trả phản hồi lỗi. Không gửi lại; kiểm tra nhật ký trước.':'Máy chủ chưa trả được kết quả kiểm tra. Chưa ghi dữ liệu; vui lòng thử lại.');}if(!res.ok){rejected=res.status<500;if(['apply','save'].includes(mode)&&res.status>=500){setUncertain(true);throw Error('Chưa xác định được kết quả lưu. Không bấm gửi lại; đóng khung và kiểm tra nhật ký trước.');}if(res.status===409){setPreview(null);setInspection(null);}throw Error(data.error||data.message||'Không thực hiện được thao tác.');}
   if(mode==='inspect'){setInspection(data);setQuantity(old=>String(Math.min(Number(old)||data.remainingQuantity,data.remainingQuantity)));setPreview(null);setPeople([]);}else if(mode==='preview'){setPreview(data);setConsent(false);}else{onSaved();}
  }catch(e){if(['apply','save'].includes(mode)&&!rejected){setUncertain(true);setError('Mất kết nối khi lưu, chưa xác định kết quả. Không gửi lại; kiểm tra nhật ký trước.');}else setError(e instanceof Error?e.message:'Không thực hiện được thao tác.');}
  finally{saving.current=false;setBusy(false);onBusy(false);}
 };
 return <section aria-label="Nhập trạm bù" className="stage-trial-panel production-backfill">
 <h2>Nhập trạm bù</h2><p>Chọn giờ → chọn nhân viên → ghi nhận. Chọn người xong bấm Lưu; hệ thống tự tính lại giờ công.</p>
 <fieldset disabled={busy||uncertain}><label>Công đoạn <select value={stage} onChange={e=>{setStage(e.target.value);setQuantity(String(remainingFor(e.target.value)));invalidate();}}>{trialStages(order).map((s:string)=><option key={s}>{s}</option>)}</select></label>
 <label className="stage-trial-time">Giờ nhập thực tế (GMT+7)<ProductionDateTimeInput value={from} onChange={v=>{setFrom(v);invalidate();}} label="Giờ nhập bù"/></label>
 <label><input type="checkbox" checked={closed} onChange={e=>{setClosed(e.target.checked);invalidate();}}/> Ghi xuất trạm cùng lúc</label>
 {closed?<><label className="stage-trial-time">Giờ xuất thực tế (GMT+7)<ProductionDateTimeInput value={to} onChange={v=>{setTo(v);invalidate();}} label="Giờ xuất bù"/></label><label>Số lượng xuất (còn {remaining.toLocaleString('vi-VN')}) <input type="number" min="1" max={remaining} value={quantity} onChange={e=>{setQuantity(e.target.value);setPreview(null);setConsent(false);}}/></label><p>Chỉ điều chỉnh phân công trong khoảng nhập–xuất. Giữ nguyên phân công sau giờ xuất và hiện tại.</p></>:<p role="note">Chưa xuất trạm: công đoạn sẽ tiếp tục mở. Nhân viên được chọn sẽ làm tại công đoạn này đến khi có thao tác tiếp theo.</p>}
 {reading&&<p role="status">Đang kiểm tra khoảng giờ… Bạn vẫn có thể chỉnh thông tin.</p>}{inspection?.repairAllocation&&<p role="note" className="stage-trial-banner">{inspection.repairAllocation.message} Đã chọn sẵn nhóm phân công cũ; kiểm tra trước khi ghi.</p>}{inspection?.blockingMessage&&<p role="alert" className="stage-trial-conflict">{inspection.blockingMessage}</p>}
 {inspection&&!inspection.blockingMessage&&<><p>Danh sách theo lịch và phân công đến {display(inspection.checkedThrough)}. Giờ nghỉ, giải lao và thời gian ngoài lịch không tính giờ công.</p><div className="table-wrap" style={{maxHeight:300}}><table className="stage-trial-form"><thead><tr><th>Chọn</th><th>Nhân viên</th><th>Phân công trong khoảng bù</th></tr></thead><tbody>{inspection.candidates.map((p:Row)=><tr key={p.id}><td><input type="checkbox" aria-label={`Chọn ${p.name}`} disabled={!p.eligible} checked={people.includes(p.id)} onChange={e=>{setPeople(old=>e.target.checked?[...old,p.id]:old.filter(x=>x!==p.id));setPreview(null);setConsent(false);}}/></td><td>{p.name}{!p.eligible&&<small style={{display:'block'}}>Không có lịch tại Line {order.line} trong {p.partial?'toàn bộ':'khoảng'} giờ đã chọn</small>}</td><td>{p.assignments.length?<details><summary>{[...new Set(p.assignments.map((a:Row)=>`${a.order} · ${a.stage}`))].join('; ')}</summary>{p.assignments.map((a:Row,i:number)=><p key={i}>{a.order} · {a.stage}: {display(a.from)} – {display(a.to)}</p>)}</details>:'Chờ phân bổ trong khoảng đã chọn'}</td></tr>)}</tbody></table></div><strong>Đã chọn {people.length} người</strong></>}
 {inspection&&!inspection.blockingMessage&&people.length>0&&<div role="region" aria-label="Ghi nhập bù">
 {impacts.length>0&&<><b>Xác nhận chuyển người trong khoảng bù</b>{impacts.map((a:Row,i:number)=><p key={i}>{a.name} · {a.order} · {a.stage}: {display(a.from)} – {display(a.to)} → {stage}</p>)}<p>Các phiếu chưa xác nhận liên quan sẽ được tính lại giờ. Giữ phân công sau giờ xuất bù.</p></>}
 <FeedbackActionButton type="button" className="primary-button backfill-action" disabled={reading||busy} disabledExplanation="Đang kiểm tra hoặc lưu dữ liệu. Vui lòng chờ hoàn tất." onClick={()=>void call('save',impacts.length>0)}>{impacts.length?'Đồng ý chuyển và lưu':'Lưu nhập bù'}{closed?' và xuất trạm':''}</FeedbackActionButton><small style={{display:'block'}}>Giờ công tự tính khi lưu. Phiếu xuất chờ QLSX xác nhận. Hiện chưa hỗ trợ sửa/hủy riêng mốc của lô bù.</small>
 </div>}

 </fieldset>{busy&&<p role="status">Đang xử lý…</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}<FeedbackActionButton type="button" className="backfill-action" disabled={busy||uncertain} disabledExplanation={uncertain?"Chưa rõ kết quả lưu. Cập nhật dữ liệu và kiểm tra trước khi thử lại.":"Đang xử lý. Vui lòng chờ hoàn tất."} onClick={()=>{invalidate();setRetry(n=>n+1);}}>Thử lại kiểm tra</FeedbackActionButton></p>}
 </section>;
}
