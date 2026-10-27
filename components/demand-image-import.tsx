'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {FeedbackActionButton as Button} from './action-feedback';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {matchImageSku} from '../lib/demand-image-parse.mjs';
import {readDemandImage} from '../lib/demand-image-ocr';
import {usableSku} from '../lib/sku-state.mjs';
import {monday,weekEnd} from '../lib/production-plan.mjs';
import {recordFetch} from '../lib/record-fetch';
type Row=Record<string,any>;
export default function DemandImageImport({masterRows,operator,onBack,onSaved,onBusyChange}:{masterRows:Row[];operator:string;onBack:()=>void;onSaved:()=>void;onBusyChange:(busy:boolean)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[week,setWeek]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[image,setImage]=useState('');
 const lock=useRef(false),fileInput=useRef<HTMLInputElement>(null),savedIds=useRef(new Set<string>());
 const catalog=useMemo(()=>new Map(masterRows.filter(r=>!r._deleted).map(r=>[r.code.toUpperCase(),r])),[masterRows]);
 const master=(code:string)=>catalog.get(code.trim().toUpperCase());
 useEffect(()=>()=>{if(image)URL.revokeObjectURL(image);},[image]);
 const patch=(id:string,value:Row)=>setRows(old=>old.map(r=>r.id===id?{...r,...value}:r));
 async function upload(file?:File){if(!file||lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setError('');setMessage('Đang đọc hình…');try{const parsed=await readDemandImage(file,setMessage);if(parsed.rows.length>100)throw Error('Mỗi lần nhập tối đa 100 dòng.');setImage(URL.createObjectURL(file));savedIds.current.clear();setWeek(parsed.week);setRows(parsed.rows.map((r:Row)=>({...r,...matchImageSku(r.sku,masterRows),id:`DE-${crypto.randomUUID()}`})));setMessage(`Đã đọc ${parsed.rows.length} dòng. Kiểm tra SKU, số lượng và bổ sung ngày giao còn trống trước khi lưu.`);}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);onBusyChange(false);if(fileInput.current)fileInput.current.value='';}}
 async function save(){if(lock.current||!rows.length)return;setError('');
 if(!week||monday(week)!==week){setError('Chọn ngày bắt đầu tuần kế hoạch là Thứ Hai.');return;}
 const pending=rows.filter(r=>!savedIds.current.has(r.id));
 for(const r of pending){const index=rows.indexOf(r)+1;if(!usableSku(master(r.sku))){setError(`Dòng ${index}: SKU ${r.sku} chưa khớp hoặc chưa được xác nhận/đang sử dụng trong SKU master.`);return;}if(!(Number(r.qty)>0)||!Number.isFinite(Number(r.qty))){setError(`Dòng ${index}: nhập số lượng lớn hơn 0.`);return;}if(!r.requestDate||!r.delivery||r.delivery<r.requestDate){setError(`Dòng ${index}: bổ sung ngày giao hợp lệ, không trước ngày yêu cầu.`);return;}}
 lock.current=true;setBusy(true);onBusyChange(true); 
 try{const current=await recordFetch('/api/records?entity=demand_event',{cache:'reload'});if(!current.ok)throw Error('Không tải được dữ liệu để kiểm tra trước khi lưu.');const existing=await current.json();for(const r of pending){if(existing.records?.some((x:Row)=>x.key===r.id)){savedIds.current.add(r.id);continue;}const sku=master(r.sku)!;const now=new Date().toISOString(),payload={...r,sku:sku.code,name:sku.name,spec:sku.specification,qty:Number(r.qty),requestDate:week.split('-').reverse().join('/'),delivery:r.delivery.split('-').reverse().join('/'),planningWeekStart:week,planningWeekEnd:weekEnd(week),status:'Chưa lập kế hoạch',plannedWeek:'',createdAt:now,updatedAt:now,updatedBy:operator,order:r.order||'—',imageImport:true};
 const response=await recordFetch('/api/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entity:'demand_event',key:r.id,createOnly:true,expectedRevision:null,payload})});const data=await response.json();
 if(!response.ok){if(response.status===409){const check=await recordFetch('/api/records?entity=demand_event',{cache:'reload'});if(check.ok){const result=await check.json();if(result.records?.some((x:Row)=>x.key===r.id)){savedIds.current.add(r.id);continue;}}}throw Error(Object.values(data.fields||{}).join(' ')||data.error||'Không lưu được dòng.');}
 savedIds.current.add(r.id);setMessage(`Đã lưu ${savedIds.current.size}/${rows.length} dòng.`);}
 setMessage(`Đã lưu ${rows.length} dòng Demand event.`);onSaved();
 }catch(e){setError(`Đã lưu ${savedIds.current.size}/${rows.length} dòng. ${(e as Error).message} Các dòng đã lưu sẽ không lưu lại khi bấm Lưu tiếp.`);}finally{setRows(old=>old.map(r=>({...r,saved:savedIds.current.has(r.id)})));lock.current=false;setBusy(false);onBusyChange(false);}}
 return <section className="demand-image-import"><StandardToolbar name="DemandImageImport" items={[
 toolbar.action({type:'button',disabled:busy,onClick:()=>fileInput.current?.click()},'Tải hình',true,'action'),
 toolbar.action({type:'button',disabled:busy||!rows.length,onClick:()=>void save()},busy?'Đang xử lý…':'Lưu',true,'action'),
 toolbar.action({type:'button',disabled:busy,onClick:onBack},'Quay lại',true,'back')
 ]}/><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void upload(e.target.files?.[0])}/>
 <p>Chọn hình bảng có tuần kế hoạch, SKU, số lượng và ngày giao. Tên, quy cách lấy từ SKU master. Mỗi dòng trên hình được giữ riêng.</p>
 {message&&<p role="status">{message}</p>}{error&&<p className="de-error" role="alert">{error}</p>}
 {!!rows.length&&<><label>Tuần kế hoạch — ngày bắt đầu <input type="date" disabled={busy||savedIds.current.size>0} value={week} onChange={e=>{const value=monday(e.target.value);setWeek(value);setRows(old=>old.map(r=>({...r,requestDate:value})));}}/></label>
 {image&&<details><summary>Hình đã tải</summary><img src={image} alt="Bảng Demand event gốc để đối chiếu" style={{maxWidth:'100%'}}/></details>}
 <div className="demand-image-table"><table><thead><tr>{['STT','SKU','Tên sản phẩm / Quy cách','Ngày yêu cầu','Ngày giao','Loại','SL phát sinh','Ưu tiên','Thao tác'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=>{const sku=master(r.sku);return <tr key={r.id}><td>{i+1}</td><td><input aria-label={`SKU dòng ${i+1}`} disabled={busy||r.saved} value={r.sku} onChange={e=>patch(r.id,{sku:e.target.value})}/>{r.review&&<small>{r.review}</small>}{!usableSku(sku)&&<small className="de-error">Kiểm tra SKU master</small>}</td><td>{sku?.name||'Chưa khớp mã'}<small>{sku?.specification||''}</small></td><td><input aria-label={`Ngày yêu cầu dòng ${i+1}`} type="date" disabled={busy||r.saved} value={week} readOnly/></td><td><input aria-label={`Ngày giao dòng ${i+1}`} type="date" disabled={busy||r.saved} value={r.delivery} onChange={e=>patch(r.id,{delivery:e.target.value})}/></td><td><select aria-label={`Loại dòng ${i+1}`} disabled={busy||r.saved} value={r.type} onChange={e=>patch(r.id,{type:e.target.value})}><option>Bù tải</option><option>Phát sinh</option></select></td><td><input aria-label={`Số lượng dòng ${i+1}`} type="number" min="0" step="any" disabled={busy||r.saved} value={r.qty} onChange={e=>patch(r.id,{qty:e.target.value})}/></td><td><select aria-label={`Ưu tiên dòng ${i+1}`} disabled={busy||r.saved} value={r.priority} onChange={e=>patch(r.id,{priority:e.target.value})}><option>Thường</option><option>Gấp</option></select></td><td>{r.saved?'Đã lưu':<Button type="button" disabled={busy} onClick={()=>setRows(old=>old.filter(x=>x.id!==r.id))}>Bỏ dòng</Button>}</td></tr>;})}</tbody></table></div></>}
 </section>;
}
