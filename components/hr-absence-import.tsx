'use client';
import {useEffect,useRef,useState} from 'react';
import {StandardToolbar,toolbar,type Items} from './standard-toolbar/StandardToolbar';
import {FeedbackActionButton} from './action-feedback';
import {DataTable} from './onspa-ui/DataTable';
import {productionRequestId} from '../lib/production-request-id.mjs';
import {HR_IMPORT_LIMIT} from '../lib/hr-absence-import.mjs';
import {hrImportDateIssue} from '../lib/hr-attendance-period.mjs';
import {hrImportRequest} from '../lib/hr-import-request.mjs';
type Row=Record<string,any>;
export default function HrAbsenceImport({month,allowed,busy,items,t}:{month:string;allowed:boolean;busy:boolean;items:Items;t:(s:string)=>string}){
 const file=useRef<HTMLInputElement>(null),running=useRef(false),generation=useRef(0);
 const [working,setWorking]=useState(false),[message,setMessage]=useState(''),[source,setSource]=useState<Row|null>(null),[preview,setPreview]=useState<Row|null>(null),[history,setHistory]=useState<Row|null>(null),[cancel,setCancel]=useState<Row|null>(null),[reason,setReason]=useState('');
 useEffect(()=>{generation.current++;setSource(null);setPreview(null);setHistory(null);setCancel(null);setMessage('');return()=>{generation.current++;};},[month,allowed]);
 const disabled=busy||working||!allowed;
 const request=(body:Row)=>hrImportRequest(body);
 async function run(task:(current:()=>boolean)=>Promise<void>){if(running.current||disabled)return;running.current=true;setWorking(true);setMessage('');const token=generation.current;try{await task(()=>generation.current===token);}catch(e){if(generation.current===token)setMessage(e instanceof Error?e.message:t('Không thực hiện được thao tác.'));}finally{running.current=false;setWorking(false);}}
 const choose=(selected?:File)=>run(async current=>{
  if(!selected)return;
  setMessage(t('Đang đọc và kiểm tra file…'));setPreview(null);setSource(null);setHistory(null);setCancel(null);
  const {readAbsenceXlsx}=await import('../lib/hr-absence-xlsx');
  const parsed=await readAbsenceXlsx(selected);
  if(!current())return;
  const value={...parsed,fileName:selected.name,month,importId:productionRequestId()};setSource(value);
  const dateResults=parsed.rows.map((row:Row)=>({...row,status:'error',issue:hrImportDateIssue(row.date,month)}));
  if(dateResults.length&&dateResults.every((row:Row)=>row.issue)){
   setPreview({saved:false,count:0,results:dateResults});
   setMessage(`${t('Không lưu dòng nào')}: ${dateResults.length} ${t('dòng không hợp lệ')}. ${dateResults[0].issue}`);return;
  }
  setMessage(t('Đang gửi dữ liệu; chưa xác nhận lưu…'));
  // Exactly one request per explicit file choice. Never retry a write on timeout.
  const result=await request({...value,action:'hr-import-save',automatic:true});
  if(!current())return;
  setPreview(result);
  setMessage(`${result.saved?'':t('Không lưu dòng nào')+' · '}${t('Thành công')}: ${result.count||0} · ${t('Trùng')}: ${result.results?.filter((r:Row)=>r.status==='duplicate').length||0} · ${t('Lỗi')}: ${result.results?.filter((r:Row)=>r.status==='error').length||0}${result.replayed?' · '+t('Lần nhập đã được xử lý; không ghi lại.'):''}`);
  if(result.saved)changed();
 });
 const loadHistory=(page=0)=>run(async current=>{const result=await request({action:'hr-import-history',page});if(current()){setHistory(result);setCancel(null);}});
 const changed=()=>window.dispatchEvent(new CustomEvent('onspa-production-updated'));
 return <>
  <StandardToolbar preserveOrder name="HrAttendanceEntry" items={[...items,...(allowed?[
   toolbar.action({disabled,disabledExplanation:t('Đang xử lý dữ liệu.'),onClick:()=>file.current?.click()},t('Tải file Excel')),
   toolbar.action({disabled,disabledExplanation:t('Đang xử lý dữ liệu.'),onClick:()=>void loadHistory()},t('Hủy lần nhập'))]:[])]}/>
  <input ref={file} hidden type="file" accept=".xlsx" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/>
  {message&&<p role="status">{message}</p>}
  {source&&<section aria-label={t('Kết quả nhập Excel')}>
   <p><strong>{source.fileName}</strong> · {source.rows.length}/{HR_IMPORT_LIMIT} {t('dòng')} · {t('Giờ vắng tính theo lịch, loại các khoảng nghỉ.')}</p>
   <DataTable className="table-wrap"><table className="production-table"><thead><tr>{['Dòng','Mã NV','Tên nhân viên','Ngày','Từ giờ','Đến giờ','Mã nghỉ','Giờ xin phép','Loại ghi nhận','Kết quả'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{source.rows.map((r:Row,i:number)=>{const p=preview?.results?.[i];return <tr key={r.row}><td>{r.row}</td><td>{r.code}</td><td>{r.name}</td><td>{r.date.split('-').reverse().join('/')}</td><td>{r.start}</td><td>{r.end}</td><td title={r.leaveName}>{r.leaveCode}</td><td>{r.duration}</td><td>{t(r.kind||'Chưa nhận diện')}</td><td>{p?.issue|| (p?.status==='valid'&&preview?.saved?t('Đã lưu'):working?t('Đang xử lý dữ liệu.'):t('Chưa xác nhận lưu; kiểm tra Hủy lần nhập trước khi tải lại.'))}</td></tr>;})}</tbody></table></DataTable>
  </section>}
  {history&&<section aria-label={t('Lịch sử nhập Excel')}><h3>{t('Chọn lần nhập cần hủy')}</h3>
   <DataTable className="table-wrap"><table className="production-table" data-no-pagination="true"><thead><tr>{['Tên file','Thời điểm nhập','Người nhập','Số dòng','Trạng thái','Thao tác'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{history.rows.map((r:Row)=><tr key={r.id}><td>{r.fileName}</td><td>{new Date(r.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td>{r.actor}</td><td>{r.count}</td><td>{t(r.status==='cancelled'?'Đã hủy':'Đã nhập')}</td><td><FeedbackActionButton disabledExplanation={t("Đang xử lý hoặc chưa đủ điều kiện; kiểm tra lựa chọn và lý do hủy.")} disabled={disabled||r.status==='cancelled'} onClick={()=>void run(async current=>{const result=await request({action:'hr-import-cancel-preview',importId:r.id});if(current()){setCancel(result);setReason('');}})}>{t('Chọn')}</FeedbackActionButton></td></tr>)}</tbody></table></DataTable>
   <FeedbackActionButton disabledExplanation={t("Đang xử lý hoặc chưa đủ điều kiện; kiểm tra lựa chọn và lý do hủy.")} disabled={disabled||!history.page} onClick={()=>void loadHistory(history.page-1)}>{t('Trang trước')}</FeedbackActionButton> <FeedbackActionButton disabledExplanation={t("Đang xử lý hoặc chưa đủ điều kiện; kiểm tra lựa chọn và lý do hủy.")} disabled={disabled||!history.hasMore} onClick={()=>void loadHistory(history.page+1)}>{t('Trang sau')}</FeedbackActionButton> <FeedbackActionButton disabledExplanation={t("Đang xử lý hoặc chưa đủ điều kiện; kiểm tra lựa chọn và lý do hủy.")} disabled={disabled} onClick={()=>{setHistory(null);setCancel(null);}}>{t('Đóng')}</FeedbackActionButton>
   {cancel?.batch&&<div role="region" aria-label={t('Xác nhận hủy lần nhập')}><p><strong>{cancel.batch.fileName}</strong> · {cancel.batch.count} {t('bản ghi sẽ hủy')}. {t('Giờ được tính lại từ dữ liệu còn hiệu lực; không khôi phục đè các thay đổi khác.')}</p>
    <p>{cancel.rows?.map((r:Row)=>`${r.code} · ${r.name} · ${r.date} ${r.start}–${r.end}`).join('; ')}</p>
    {cancel.issues?.map((r:Row)=><p role="alert" key={r.row}>{t('Dòng')} {r.row}: {r.issue}</p>)}
    <label>{t('Lý do hủy')} <input value={reason} maxLength={1000} disabled={disabled} onChange={e=>setReason(e.target.value)}/></label>
    <FeedbackActionButton disabledExplanation={t("Đang xử lý hoặc chưa đủ điều kiện; kiểm tra lựa chọn và lý do hủy.")} disabled={disabled||!cancel.canCancel||!reason.trim()} onClick={()=>void run(async current=>{const result=await request({action:'hr-import-cancel',importId:cancel.batch.id,reason});if(current()){setMessage(`${t('Đã hủy')}: ${result.count} ${t('bản ghi')}`);setCancel(null);setHistory(null);changed();}})}>{t('Xác nhận hủy lần nhập')}</FeedbackActionButton>
   </div>}
  </section>}
 </>;
}
