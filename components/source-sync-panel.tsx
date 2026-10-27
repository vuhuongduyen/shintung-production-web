'use client';
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {toolbarLocale,subscribeToolbarLocale,translateToolbar} from './standard-toolbar/translations';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import {LOCAL_TEST} from '../lib/runtime';
type Device={id:string;label:string;owner:string;createdAt:string;expiresAt:string;revokedAt:string|null;scope:'source'|'full-backup'};
export default function SourceSyncPanel(){
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi'),t=(s:string)=>translateToolbar(s,locale);
 const [devices,setDevices]=useState<Device[]>([]),[metadata,setMetadata]=useState<Record<string,any>|null>(null),[label,setLabel]=useState('Máy ONSPA'),[code,setCode]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const refresh=useCallback(async()=>{const r=await fetch('/api/source-sync/devices',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error);setDevices(data.devices);setMetadata(data.metadata);},[]);
 useEffect(()=>{if(!LOCAL_TEST)void refresh().catch(e=>setError(e.message));},[refresh]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await action();await refresh();}catch(e){setMessage('');setError(e instanceof Error?e.message:'Không thực hiện được.');}finally{setBusy(false);}};
 const post=async(body:Record<string,any>)=>{const r=await fetch('/api/source-sync/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await r.json();if(!r.ok)throw Error(data.error);return data;};
 const backupDownload=async()=>{
  const {zipSync,strToU8}=await import('fflate');
  const postBackup=async(path:string,body:unknown)=>{const r=await fetch('/api/full-backup/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);return d;};
  const manifest=await postBackup('start',{});
  if(manifest.entries.reduce((n:number,e:{size:number})=>n+e.size,0)>100*1024*1024)throw Error('Bản sao lưu vượt 100 MiB. Dùng bộ cài Windows để tải đầy đủ từng file về máy.');
  const entries:Record<string,Uint8Array>={},checksums=[];
  for(let i=0;i<manifest.entries.length;i++){
   const e=manifest.entries[i];setMessage(`Đang tải ${i+1}/${manifest.entries.length} tệp…`);
   const r=await fetch(`/api/full-backup/item?id=${manifest.id}&index=${i}`,{cache:'no-store'});if(!r.ok){const d=await r.json();throw Error(d.error);}
   const b=new Uint8Array(await r.arrayBuffer()),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(b.length!==e.size||(e.sha256&&sha256!==e.sha256))throw Error('File tải về thiếu hoặc sai checksum. Chưa tạo bản sao lưu hoàn tất.');
   entries[e.path]=b;checksums.push({path:e.path,size:b.length,sha256});
  }
  await postBackup('complete',{id:manifest.id});
  entries['manifest.json']=strToU8(JSON.stringify(manifest,null,2));entries['checksums.json']=strToU8(JSON.stringify(checksums,null,2));entries['HOAN-TAT.json']=strToU8(JSON.stringify({id:manifest.id,completedAt:new Date().toISOString()}));entries['HUONG-DAN-PHUC-HOI.txt']=strToU8(manifest.restoreGuide);
  const blob=new Blob([zipSync(entries,{level:0}) as BlobPart],{type:'application/zip'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ONSPA-FULL-${manifest.createdAt.slice(0,19).replaceAll(':','')}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('Đã chuẩn bị bản sao lưu đầy đủ. Kiểm tra file ZIP trong thư mục tải xuống.');
 };
 const download=async(kind:'installer'|'download')=>{const r=await fetch(`/api/source-sync/${kind}`,{cache:'no-store'});if(!r.ok){const data=await r.json();throw Error(data.error);}const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=kind==='installer'?'ONSPA-dong-bo-Windows.zip':'ONSPA-source.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="source-sync-panel" data-own-language="true">
  <h3>{t('Đồng bộ source và sao lưu đầy đủ')}</h3><p>{t('Source kiểm tra mỗi 15 phút. Dữ liệu D1 và toàn bộ file R2 sao lưu mỗi ngày khi máy đăng nhập Windows và có mạng; nếu tắt máy, thực hiện khi mở lại. Các bản cũ được giữ riêng, không tự xóa.')}</p><p>{t('Sao lưu đầy đủ gồm KHSX, báo công, kho, nhân sự, tài khoản, phân quyền, nhật ký, file tải lên và mã nguồn. Lưu tại C:\website onspa\backups. Chỉ bản có HOAN-TAT.json mới được tính là hoàn tất.')}</p>
  <p>{t('Folder trên máy')}: <code>C:\website onspa</code> · {t('Source được lưu trong thư mục source; các bản trước nằm trong versions.')}</p>
  <p>{t('Cài một lần, máy tự kiểm tra bản mới mỗi 15 phút khi đăng nhập Windows và có mạng. Đồng bộ một chiều từ web về máy; không thay đổi dữ liệu sản xuất.')}</p>
  <StandardToolbar name="SourceSync" items={[toolbar.action({disabled:busy||LOCAL_TEST, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Chức năng sao lưu và đồng bộ chỉ dùng trên Site ONSPA, không dùng trong TEST.",onClick:()=>void run(()=>download('installer'))},t('Tải bộ cài Windows')),toolbar.action({disabled:busy||LOCAL_TEST||!label.trim(), disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : LOCAL_TEST ? "Chức năng sao lưu chỉ dùng trên Site ONSPA, không dùng trong TEST." : "Nhập tên máy trước khi tạo mã.",onClick:()=>void run(async()=>{const d=await post({action:'create',label,scope:'full-backup'});setCode(d.token);setExpires(d.device.expiresAt);})},t('Tạo mã sao lưu đầy đủ')),toolbar.action({disabled:busy||LOCAL_TEST, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Chức năng sao lưu và đồng bộ chỉ dùng trên Site ONSPA, không dùng trong TEST.",onClick:()=>void run(backupDownload)},t('Tải sao lưu đầy đủ')),toolbar.action({disabled:busy||LOCAL_TEST, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Chức năng sao lưu và đồng bộ chỉ dùng trên Site ONSPA, không dùng trong TEST.",onClick:()=>void run(()=>download('download'))},t('Tải source ngay')),toolbar.action({disabled:busy||LOCAL_TEST, disabledExplanation: busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Chức năng sao lưu và đồng bộ chỉ dùng trên Site ONSPA, không dùng trong TEST.",onClick:()=>void run(refresh)},t('Cập nhật')),toolbar.field(t('Tên máy'),[toolbar.input({value:label,maxLength:100,onChange:e=>setLabel(e.target.value),'aria-label':t('Tên máy')})])]} />
  {LOCAL_TEST&&<p>{t('Chức năng đồng bộ source chỉ dùng trên Site ONSPA.')}</p>}
  {metadata&&<p>{t('Bản source hiện có')}: {metadata.snapshotId.slice(0,12)} · {productionDisplayTime(metadata.builtAt,'—')} · {metadata.fileCount} {t('tệp')}</p>}
  {error&&<p role="alert">{t(error)}</p>}{message&&<p role="status">{t(message)}</p>}
  {code&&<div className="source-sync-code"><label>{t('Mã kết nối chỉ hiển thị lần này')}<textarea readOnly value={code} rows={2} onFocus={e=>e.target.select()}/></label><p>{t('Hết hạn')}: {productionDisplayTime(expires,'—')}. {t('Giữ riêng mã này. Mã sao lưu đầy đủ được đọc dữ liệu công ty và file gốc; không cho phép sửa dữ liệu hoặc phục hồi trên web.')}</p><StandardToolbar name="SourceSyncCode" items={[toolbar.action({onClick:()=>{void navigator.clipboard.writeText(code).then(()=>setMessage('Đã sao chép mã kết nối')).catch(()=>setError('Chọn mã và nhấn Ctrl+C để sao chép.'));}},t('Sao chép mã')),toolbar.action({onClick:()=>setCode('')},t('Ẩn mã'))]}/></div>}
  <ol>{['Tải bộ cài và giải nén vào C:\\website onspa.', 'Tạo mã sao lưu đầy đủ và sao chép mã. Chạy Cai-dong-bo.cmd, nhập mã khi được hỏi.', 'Sau khi cài thành công, source nằm trong source; bản sao lưu trong backups. Dùng Sao-luu-ngay.cmd để sao lưu ngay.', 'Nhật ký nằm trong _sync\\dong-bo.log. Nếu có file đã sửa trong source, chương trình dừng để tránh ghi đè.', 'Mã Admin nội bộ có hạn 1 năm; mã Truy cập nhanh Admin hết hạn cùng quyền thiết lập. Đổi mật khẩu, khóa tài khoản hoặc thu hồi mã sẽ dừng kết nối.'].map(v=><li key={v}>{t(v)}</li>)}</ol>
  <p>{t('Mã kết nối source cũ vẫn chỉ tải source. Để sao lưu tất cả, tải lại bộ cài, tạo mã sao lưu đầy đủ rồi chạy Cai-dong-bo.cmd. Dùng Sao-luu-ngay.cmd để tạo thêm bản ngay. Không cần kho bên ngoài.')}</p>
  <DataTable className="table-wrap"><table><thead><tr>{['Tên máy','Phạm vi','Người cấp','Ngày cấp','Hết hạn','Trạng thái','Thao tác'].map(v=><th key={v}>{t(v)}</th>)}</tr></thead><tbody>{devices.map(d=><tr key={d.id}><DataCell>{d.label}</DataCell><DataCell>{t(d.scope==='full-backup'?'Source + dữ liệu + file':'Chỉ source')}</DataCell><DataCell>{d.owner}</DataCell><DataCell kind="date">{productionDisplayTime(d.createdAt,'—')}</DataCell><DataCell kind="date">{productionDisplayTime(d.expiresAt,'—')}</DataCell><DataCell>{t(d.revokedAt?'Đã thu hồi':Date.parse(d.expiresAt)<Date.now()?'Đã hết hạn':'Có hiệu lực')}</DataCell><DataCell><FeedbackActionButton disabled={busy||!!d.revokedAt} disabledExplanation={busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Mã kết nối này đã được thu hồi."} onClick={()=>void run(async()=>{await post({action:'revoke',id:d.id});setCode('');setMessage('Đã thu hồi mã kết nối');})}>{t('Thu hồi')}</FeedbackActionButton></DataCell></tr>)}</tbody></table></DataTable>
 </section>;
}
