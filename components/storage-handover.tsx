"use client";
import {FeedbackActionButton} from './action-feedback';
import {productionDisplayTime} from "../lib/production-display-time.mjs";
import {PageTitle} from './onspa-ui/PageTitle';
import {DataCell} from './onspa-ui/DataCell';
import SourceSyncPanel from "./source-sync-panel";
import { apiFetch as fetch } from "../lib/data-sync";
import {LOCAL_TEST} from "../lib/runtime";
import {useEffect,useState} from 'react';
type Status={fixture?:boolean;latest:string;recordCount:number;fileCount:number;fileSize:number;problems:string[];entities:{entity:string;count:number}[];files:{file_id:string;original_name:string;module:string}[];history:{id:string;filename:string;created_at:string;status:string;error:string}[]};
export default function StorageHandover(){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[module,setModule]=useState('attachments'),[recordId,setRecordId]=useState('');
 async function refresh(){const r=await fetch('/api/storage',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);}
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 async function run(action:()=>Promise<unknown>){setBusy(true);setError('');try{await action();await refresh();}catch(e){setError(e instanceof Error?e.message:'Không thực hiện được.');}finally{setBusy(false);}}
 async function post(path:string,body:unknown){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 return <main className="workspace"><section className="data-card" style={{padding:20}}><PageTitle variant="menu-root">Sao lưu &amp; Bàn giao</PageTitle><p>{LOCAL_TEST?"MÔI TRƯỜNG TEST · D1: DB · R2: FILES local":"D1: DB · R2: FILES"} · Chỉ Super Admin</p>{error&&<p role="alert">{error}</p>}<SourceSyncPanel/>{data&&<>
 {data.fixture&&<p role="status" data-own-language="true">TEST FIXTURE · CHỈ XEM / READ ONLY / 僅供檢視 — Dữ liệu giả; không cấp quyền Admin, không ghi hoặc tải dữ liệu thật.</p>}
 <p>Dữ liệu gần nhất: {data.latest?productionDisplayTime(data.latest):'—'} · {data.recordCount} bản ghi D1 · {data.fileCount} tệp · {data.fileSize.toLocaleString()} byte</p>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><FeedbackActionButton disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>run(refresh)}>Kiểm tra dữ liệu</FeedbackActionButton>{(['d1','r2','full'] as const).map((kind,i)=><FeedbackActionButton key={kind} disabled={busy || !LOCAL_TEST || data.fixture} disabledExplanation={busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !LOCAL_TEST ? "Chỉ xuất gói kiểm thử trong môi trường TEST." : "Dữ liệu mẫu không được dùng để xuất gói bàn giao."} onClick={()=>run(()=>post('/api/storage-export',{kind}))}>{['Xuất dữ liệu D1','Xuất tệp R2','Xuất gói bàn giao đầy đủ'][i]}</FeedbackActionButton>)}</div>
 {busy&&<p role="status">Đang chuẩn bị…</p>}<p>{data.problems.length?data.problems.join(' · '):LOCAL_TEST?'Kiểm tra liên kết metadata và checksum: không phát hiện tệp thiếu.':'Danh sách bên dưới là metadata D1. Bản sao lưu đầy đủ kiểm tra file gốc và checksum khi tải.'}</p>
 <details><summary>Số bản ghi theo entity</summary>{data.entities.map(r=><p key={r.entity}>{r.entity}: {r.count}</p>)}</details>
 {!LOCAL_TEST&&<p>Sao lưu đầy đủ trên Site: dùng chức năng phía trên hoặc bộ cài Windows. Các nút xuất TEST bên dưới chỉ dùng cho dữ liệu local.</p>}<h3>Lưu tệp gốc</h3><p>Tệp tối đa 5 MiB. Bước này lưu tệp và metadata; chưa tự bóc tách dữ liệu nghiệp vụ.</p><label>Phân hệ <select value={module} onChange={e=>setModule(e.target.value)}>{['base-forecast','demand-event','warehouse','bom','reports','attachments'].map(m=><option key={m}>{m}</option>)}</select></label>{' '}<label>Mã bản ghi <input value={recordId} onChange={e=>setRecordId(e.target.value)}/></label>{' '}
 <input aria-label="Upload tệp gốc" type="file" disabled={busy || data.fixture} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(async()=>{if(file.size>5*1024*1024)throw Error('Tệp vượt 5 MiB.');const base64=await new Promise<string>((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(String(reader.result).split(',')[1]);reader.onerror=()=>fail(Error('Không đọc được tệp.'));reader.readAsDataURL(file);});await post('/api/storage-upload',{module,recordId,name:file.name,contentType:file.type,base64});});}}/>
 <ul>{data.files.map(f=><li key={f.file_id}>{f.module} · {data.fixture?<span>{f.original_name}</span>:<a href={`/api/storage-download?id=${encodeURIComponent(f.file_id)}`}>{f.original_name}</a>}</li>)}</ul>
 <p hidden={!LOCAL_TEST}>Gói chứa dữ liệu D1/R2 local. Dữ liệu JSON hoặc viết sẵn ở các menu cũ chưa được chuyển hết vào D1; gói này chưa thay thế toàn bộ folder mã nguồn.</p>
 <h3>Lịch sử xuất</h3><table><thead><tr><th>Thời điểm</th><th>Trạng thái</th><th>Tệp</th></tr></thead><tbody>{data.history.map(h=><tr key={h.id}><DataCell kind="date">{productionDisplayTime(h.created_at)}</DataCell><DataCell>{h.status}{h.error&&` · ${h.error}`}</DataCell><DataCell>{h.status==='Thành công'&&!data.fixture?<a href={`/api/storage-download?type=backup&id=${encodeURIComponent(h.id)}`}>{h.filename}</a>:data.fixture?h.filename:'—'}</DataCell></tr>)}</tbody></table>
 </>}</section></main>;
}
