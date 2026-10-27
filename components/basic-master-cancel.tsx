"use client";
import {FeedbackActionButton} from './action-feedback';
import {useState} from 'react';
import {apiFetch,announceDataChange} from '../lib/data-sync';
import {knownRecordRevision,acceptRecordRevision} from '../lib/record-fetch';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {toolbarLocale} from './standard-toolbar/translations';

type Target={entity:string;key:string;label:string;version?:number;linkedKeys?:string[]};
export function useMasterCancellation(onSaved:()=>void){
 const [target,setTarget]=useState<(Target&{expectedRevision:string|null;linkedRevision:string|null;linkedRevisions:Record<string,string|null>})|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const t=(vi:string,zh:string,en:string)=>toolbarLocale()==='zh'?zh:toolbarLocale()==='en'?en:vi;
 const open=(value:Target)=>{setError('');setNotice('');setTarget({...value,expectedRevision:knownRecordRevision(value.entity,value.key)??null,linkedRevision:knownRecordRevision('safety_rules',value.key)??null,linkedRevisions:Object.fromEntries((value.linkedKeys||[]).map(key=>[key,knownRecordRevision('leadtime_versions',key)??null]))});};
 const cancel=async()=>{if(!target||busy)return;setBusy(true);setError('');try{
  const response=await apiFetch('/api/basic-master-cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...target,expectedVersion:target.version})});
  const data=await response.json();if(!response.ok)throw Error(response.status===409&&String(data.error).includes('được người khác sửa')?t('Phiên bản dữ liệu trên màn hình chưa khớp với bản đang lưu. Hãy Quay lại, tải lại danh sách rồi chọn Hủy lại. Cảnh báo này không xác định có người khác sửa.','畫面資料版本與儲存版本不一致。請返回並重新整理後再停用；此訊息不代表其他人曾修改。','The displayed version differs from the saved version. Go back, refresh the list and retry. This does not establish that another person edited the record.'):data.error||'Không thể Hủy dữ liệu.');
  for(const record of data.records||[]){acceptRecordRevision(record.entity,record.key,record.revision);announceDataChange(record.entity);}
  setNotice(t("Đã Hủy dữ liệu. Dữ liệu được giữ lại và không còn áp dụng.","資料已停用，保留供查詢。","Record cancelled; data retained and no longer applied."));setTarget(null);onSaved();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const dialog=<>{notice&&<p role="status" className="admin-operation-notice success">{notice}</p>}<Dialog open={!!target} onOpenChange={open=>{if(!open&&!busy)setTarget(null);}}><DialogContent className="basic-master-cancel-dialog" showCloseButton={!busy}>
  <DialogHeader><DialogTitle>{t('Hủy dữ liệu','停用資料','Cancel record')}</DialogTitle><DialogDescription>{target?.label} · {target?.key}</DialogDescription></DialogHeader>
  <p>{t('Dữ liệu vẫn được giữ để tra cứu và xem lịch sử, nhưng không còn áp dụng cho các lần tính hoặc chọn mới. Dữ liệu nghiệp vụ đã ghi nhận trước đó được giữ nguyên.','資料保留供查詢與歷史記錄，但不再用於新的計算或選取。既有業務記錄保持不變。','The record remains available for lookup and history but is no longer used for new calculations or selections. Existing business records are preserved.')}</p>
  {error&&<p role="alert" className="admin-operation-notice error">{error}</p>}
  <div className="form-actions"><FeedbackActionButton className="outline-button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>setTarget(null)}>{t('Quay lại','返回','Back')}</FeedbackActionButton><FeedbackActionButton className="primary-button" disabled={busy} disabledExplanation={"Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>void cancel()}>{busy?t('Đang Hủy…','正在停用…','Cancelling…'):t('Xác nhận Hủy','確認停用','Confirm cancellation')}</FeedbackActionButton></div>
 </DialogContent></Dialog></>;
 return {open,dialog,busy};
}
