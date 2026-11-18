'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/data-sync';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';

type Manifest={kind:string;digest:string;entries:unknown[];observedAt:string;month?:string};
type Package={manifest:Manifest;omissions:unknown[]};
type Preview={sourceRevision:string;count:number;digest:string;summary?:{reports:number;orders:number;quantity:number;knownEarned:number}};
const endpoint='/api/labor-reference-snapshot-import';
const qaHostname='onspa-thu-nghiem.shintung-vn-4458.chatgpt.site';
const hash=/^[a-f0-9]{64}$/;
export default function LaborBasisImportPanel({allowed}:{allowed:boolean}){
 const [qa,setQa]=useState(false),[input,setInput]=useState<Package|null>(null),[filename,setFilename]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false),[stored,setStored]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const generation=useRef(0),running=useRef(false),fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{setQa(allowed&&window.location.hostname===qaHostname);return()=>{generation.current++;};},[allowed]);
 useEffect(()=>{if(!allowed){generation.current++;setInput(null);setPreview(null);setConfirmed(false);setStored(false);setFilename('');setError('');setMessage('');}},[allowed]);
 function reset(){generation.current++;setInput(null);setPreview(null);setConfirmed(false);setStored(false);setFilename('');setError('');setMessage('');if(fileInput.current)fileInput.current.value='';}
 async function load(file:File){
  if(running.current)return;
  reset();const current=generation.current;running.current=true;setBusy(true);
  try{
   if(file.size>2*1024*1024)throw Error('Tệp vượt 2 MiB. Chọn lại gói preview đã được kiểm tra.');
   const value=JSON.parse(await file.text());
   if(value?.action!=='preview'||!['labor-reference-snapshot-v1','labor-menu-preservation-v1'].includes(value?.manifest?.kind)||!hash.test(value.manifest.digest)||!Array.isArray(value.manifest.entries)||!value.manifest.entries.length||!Array.isArray(value.omissions))throw Error('Tệp không phải gói preview căn cứ Giờ công hợp lệ.');
   if(current!==generation.current)return;
   setInput({manifest:value.manifest,omissions:value.omissions});setFilename(file.name);setMessage('Đã đọc tệp. Chọn Kiểm tra căn cứ để đối chiếu nguồn hiện hành; chưa lưu dữ liệu.');
  }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Không đọc được tệp.');}
  finally{running.current=false;setBusy(false);}
 }
 async function run(apply=false){
  if(!allowed||!qa||!input||running.current||apply&&(!preview||!confirmed||stored))return;
  const current=generation.current,payload=input,basis=preview;
  running.current=true;setBusy(true);setError('');setMessage('');setConfirmed(false);
  async function post(body:unknown){
   const r=await sessionFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.headers.get('content-type')?.toLowerCase().includes('application/json')){
    await r.body?.cancel();
    throw Error(`Máy chủ chưa trả kết quả hợp lệ (HTTP ${r.status}); có thể bị giới hạn tài nguyên. Không xác nhận đã lưu. Chọn Kiểm tra căn cứ để đọc lại trước khi thử tiếp.`);
   }
   let data;try{data=await r.json();}catch{throw Error('Không đọc được phản hồi máy chủ. Chưa xác minh kết quả; chọn Kiểm tra căn cứ để đọc lại.');}
   if(!r.ok)throw Error(data.error||'Không thực hiện được. Kiểm tra lại nguồn trước khi lưu.');
   if(data.ok!==true||data.digest!==payload.manifest.digest||data.count!==payload.manifest.entries.length||data.activated!==false)throw Error('Kết quả không khớp tệp đã chọn. Không bật cấu hình; kiểm tra lại bản đã lưu.');
   return data;
  }
  try{
   let result=await post(apply?{action:'apply',...payload,expectedSourceRevision:basis!.sourceRevision,confirmDigest:basis!.digest}:{action:'preview',...payload});
   if(apply){
    if(!['stored','already-present'].includes(result.status))throw Error('Chưa xác minh được kết quả lưu. Chọn Kiểm tra căn cứ để đọc lại.');
    result=await post({action:'preview',...payload});
    if(result.status!=='already-present')throw Error('Chưa đọc lại được bản đã lưu. Không bật cấu hình; chọn Kiểm tra căn cứ để thử đọc lại.');
   }
   if(current!==generation.current)return;
   if(result.status==='already-present'){setStored(true);setPreview(null);setMessage(`Đã đọc lại và đối chiếu khớp ${result.count} căn cứ. Bản riêng đã có; phiếu gốc giữ nguyên. Cấu hình chưa được bật bởi công cụ này.`);}
   else if(result.status==='preview-only'&&hash.test(result.sourceRevision)){setStored(false);setPreview({sourceRevision:result.sourceRevision,count:result.count,digest:result.digest,summary:result.summary});setMessage(`Nguồn hiện hành khớp ${result.count} căn cứ. Chưa lưu; kiểm số lượng rồi xác nhận bên dưới.`);}
   else throw Error('Preview không có phiên bản nguồn hợp lệ. Chưa thể lưu căn cứ.');
  }catch(e){if(current===generation.current){setPreview(null);setStored(false);setError(`${e instanceof Error?e.message:'Không kết nối được.'}${apply?' Nếu chưa rõ kết quả, chọn Kiểm tra căn cứ để đọc lại trước khi thử lưu.':''}`);}}
  finally{running.current=false;setBusy(false);}
 }
 if(!allowed||!qa)return null;
 return <div className="workspace"><section className="data-card"><details><summary>Căn cứ Giờ công QA</summary>
  <p>Nhập bản căn cứ riêng từ gói preview đã kiểm tra. Phiếu và giờ Báo công đã lưu được giữ nguyên. Công cụ không bật cấu hình.</p>
  <label>Gói preview căn cứ Giờ công <input ref={fileInput} type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void load(file);}}/></label>
  {input?.manifest.kind==='labor-menu-preservation-v1'&&<p>Bảo toàn kết quả kỳ {input.manifest.month} từ menu QA tại {input.manifest.observedAt}. Không sửa phiếu cũ; không gán ngày hiệu lực hồi tố.</p>}
  {input&&<p>Tệp: {filename} · {input.manifest.entries.length} căn cứ · {input.omissions.length} ngoại lệ theo gói.</p>}
  <StandardToolbar name="LaborBasisImport" items={[
   toolbar.action({disabled:busy||!input,onClick:()=>run(false)},'Kiểm tra căn cứ'),
   toolbar.action({disabled:busy||!preview||!confirmed||stored,onClick:()=>run(true)},'Lưu bản căn cứ riêng'),
   toolbar.action({disabled:busy,onClick:reset},'Chọn lại tệp'),
  ]}/>
  {preview?.summary&&<p>Đối chiếu: {preview.summary.orders} lệnh · {preview.summary.reports} phiếu · {preview.summary.quantity.toLocaleString('vi-VN')} SP · {preview.summary.knownEarned.toLocaleString('vi-VN',{maximumFractionDigits:6})} giờ chuẩn đã xác định.</p>}
  {preview&&<label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Tôi xác nhận lưu riêng {preview.count} căn cứ từ tệp đã kiểm tra, không sửa phiếu gốc.</label>}
  {busy&&<p role="status">Đang đối chiếu…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </details></section></div>;
}
