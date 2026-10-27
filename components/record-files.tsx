"use client";
import {actionFeedbackScope,notifyActionFailure, actionFeedbackVersion, isCancelledAction, mutationFailureMessage} from '../lib/action-feedback';
import {FeedbackActionButton} from './action-feedback';
import { apiFetch as fetch } from "../lib/data-sync";
import {useEffect,useState,useRef,type Ref} from 'react';
export type StoredFile={file_id:string;original_name:string;module:string;record_id:string;checksum:string;uploaded_at?:string};
export default function RecordFiles({module,recordId='',accept='.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg',label='Tệp đính kèm',uploadInputRef,onUploadReadyChange,externalUpload=false,hidePanel=false,showAll=false,onPrepareUpload,onFileStored,onImportStored,importedFileIds=[]}:{module:string;recordId?:string;accept?:string;label?:string;uploadInputRef?:Ref<HTMLInputElement>;onUploadReadyChange?:(ready:boolean)=>void;externalUpload?:boolean;hidePanel?:boolean;showAll?:boolean;onPrepareUpload?:(file:File)=>Promise<string>;onFileStored?:(file:File,stored:StoredFile)=>Promise<string>;onImportStored?:(stored:StoredFile)=>Promise<string>;importedFileIds?:string[]}){
 const detailsRef=useRef<HTMLDetailsElement>(null);
 const readGeneration=useRef(0);
 const [files,setFiles]=useState<StoredFile[]>([]),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[code,setCode]=useState(recordId);
 useEffect(()=>{onUploadReadyChange?.(allowed&&!busy&&(!!code.trim()||!!onPrepareUpload))},[allowed,busy,code,onPrepareUpload,onUploadReadyChange]);
 useEffect(()=>{setCode(recordId)},[recordId]);
 useEffect(()=>{if(showAll&&detailsRef.current)detailsRef.current.open=true},[showAll]);
 async function refresh(generation=readGeneration.current){
  const feedbackBefore=actionFeedbackVersion();
  try{
   const r=await fetch('/api/storage',{cache:'no-store'});
   if(generation!==readGeneration.current)return;
   if(!r.ok){
    setAllowed(false);setFiles([]);
    // Initial permission probes must not reveal an entirely unauthorized panel.
    // Explicit user reads already receive the shared transport explanation.
    if(r.status!==401&&r.status!==403&&actionFeedbackVersion()===feedbackBefore)notifyActionFailure(mutationFailureMessage(r.status));
    return;
   }
   const d=await r.json();if(generation!==readGeneration.current)return;
   if(!Array.isArray(d.files))throw Error('Invalid file list');
   setAllowed(true);setFiles(d.files);
  }catch(error){
   if(generation!==readGeneration.current||isCancelledAction(error))return;
   setAllowed(false);setFiles([]);
   if(actionFeedbackVersion()===feedbackBefore)notifyActionFailure('Không tải được danh sách tệp. Kiểm tra kết nối và mở lại màn hình để thử lại.');
  }
 }
 useEffect(()=>{const generation=++readGeneration.current;void refresh(generation);return()=>{readGeneration.current++;};},[module,recordId]);
 async function upload(file:File){const scope=actionFeedbackScope();let requestStarted=false;setBusy(true);setMessage('');try{
  const targetCode=onPrepareUpload?await onPrepareUpload(file):code.trim();
  if(!targetCode)throw Error('Không xác định được tháng áp dụng để liên kết tệp.');if(file.size>5*1024*1024)throw Error('Tệp vượt 5 MiB.');
  const base64=await new Promise<string>((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(String(reader.result).split(',')[1]);reader.onerror=()=>fail(Error('Không đọc được tệp'));reader.readAsDataURL(file);});
  requestStarted=true;const r=await fetch('/api/storage-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({module,recordId:targetCode,name:file.name,contentType:file.type,base64})});const d=await r.json();if(!r.ok)throw Error(d.error);
  await refresh();setMessage(onFileStored?await onFileStored(file,d.file):`Đã lưu tệp gốc ${d.file.original_name}. Chưa nhập hoặc thay đổi các dòng dữ liệu nghiệp vụ.`);
 }catch(e){if(!requestStarted&&scope===actionFeedbackScope())notifyActionFailure('Không lưu được tệp. Kiểm tra định dạng, giới hạn 5 MiB và mã liên kết rồi thử lại.');setMessage(e instanceof Error?e.message:'Lỗi lưu tệp');}finally{setBusy(false);}}
 async function importStored(file:StoredFile){if(!onImportStored)return;const scope=actionFeedbackScope();setBusy(true);setMessage('');try{setMessage(await onImportStored(file))}catch(e){if(scope===actionFeedbackScope())notifyActionFailure('Không nhập được dữ liệu PDF. Kiểm tra tệp và dữ liệu đối chiếu rồi thử lại.');setMessage(e instanceof Error?e.message:'Không nhập được dữ liệu PDF.')}finally{setBusy(false)}}
 if(!allowed)return null;
 if(hidePanel)return <><input ref={uploadInputRef} type="file" hidden accept={accept} disabled={busy||!onPrepareUpload&&!code.trim()} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file)}}/>{busy&&<p role="status">Đang xử lý PDF…</p>}{message&&<p role="status">{message}</p>}</>;
 return <details ref={detailsRef} className="record-files" style={{margin:'8px 0',padding:'8px 12px',border:'1px solid #dce6df',borderRadius:6}}><summary>{label} · FILES</summary><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>{!onPrepareUpload&&<label>Mã phiếu/bản ghi <input aria-label={`Mã liên kết ${module}`} value={code} readOnly={!!recordId} onChange={e=>setCode(e.target.value)}/></label>}<label hidden={externalUpload}>Lưu tệp gốc <input ref={uploadInputRef} aria-label={`Lưu tệp ${module}`} type="file" accept={accept} disabled={busy||!onPrepareUpload&&!code.trim()} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file){if(detailsRef.current)detailsRef.current.open=true;void upload(file)}}}/></label></div>{busy&&<p role="status">Đang xử lý PDF…</p>}{message&&<p role="status">{message}</p>}<ul>{files.filter(f=>f.module===module&&(showAll||!code||f.record_id===code)).map(f=><li key={f.file_id}><a href={`/api/storage-download?id=${encodeURIComponent(f.file_id)}`}>{f.original_name}</a> · {f.record_id}{showAll?' (tháng gắn tệp)':''}{onImportStored&&(importedFileIds.includes(f.file_id)?<span> · Đã nhập dữ liệu</span>:<FeedbackActionButton className="calc-button record-files-import-action" type="button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>void importStored(f)}>Nhập dữ liệu PDF</FeedbackActionButton>)}</li>)}</ul></details>;
}
