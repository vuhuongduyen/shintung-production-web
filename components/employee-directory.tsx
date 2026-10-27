'use client';
import {FeedbackActionButton} from './action-feedback';
import {PageTitle} from './onspa-ui/PageTitle';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';
import { apiFetch as fetch } from "../lib/data-sync";
import { useDataRefresh } from "../lib/data-sync";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {StandardToolbar,toolbar} from './standard-toolbar/StandardToolbar';
import {subscribeToolbarLocale,toolbarLocale} from './standard-toolbar/translations';
import './employee-directory.css';
import {newestMasterFirst,isMasterCancelled} from '../lib/basic-master.mjs';
type Employee={startDate?:string;endDate?:string;cancelled?:boolean;updatedAt?:string;createdAt?:string;id:string;secondaryId?:string;name:string;line:string;active:boolean;version:number;history?:Array<{at:string;by:string;action?:string;before:any;after:any}>};
function parseEmployeeFile(text:string){
 const rows:string[][]=[];let cell='',row:string[]=[],quoted=false;
 const separator=text.split(/\r?\n/).find(line=>line.trim())?.includes('\t')?'\t':',';
 for(let i=0;i<text.length;i++){
  const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&ch===separator){row.push(cell.trim());cell='';}
  else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(quoted)throw Error('File CSV có dấu nháy chưa đóng');
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 const header=rows.findIndex(r=>r.some(v=>/^stt$/i.test(v))&&r.some(v=>/mã nv/i.test(v)));
 const items=header>=0?rows.slice(header+1).map(r=>({id:r[1],secondaryId:r[2],name:r[3],line:r[4],startDate:r[5]})):rows.slice(1).map(r=>({id:r[0],secondaryId:r[1],name:r[2],line:r[3],startDate:r[4]}));
 if(!items.length||items.some(x=>!x.id||!x.name||!['A','B','C'].includes(x.line?.toUpperCase())))throw Error('File cần cột mã NV, mã ngắn, họ tên và Line A/B/C');
 return items.map(x=>({id:x.id.trim(),secondaryId:x.secondaryId?.trim()||'',name:x.name.trim(),line:x.line.trim().toUpperCase(),startDate:x.startDate||''}));
}
export default function EmployeeDirectory(){
 const dataRevision=useDataRefresh(['employees']);
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi');
 const t=(vi:string,zh:string,en:string)=>locale==='zh'?zh:locale==='en'?en:vi;
 const [items,setItems]=useState<Employee[]>([]),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[line,setLine]=useState(''),[current,setCurrent]=useState<Employee|null>(null),[draft,setDraft]=useState<Employee|null>(null),[importRows,setImportRows]=useState<Array<{id:string;secondaryId:string;name:string;line:string;startDate:string}>>([]),[importOpen,setImportOpen]=useState(false);
 const [searchMode,setSearchMode]=useState('line');
 const [searchOpen,setSearchOpen]=useState(false),[appliedLookup,setAppliedLookup]=useState({mode:'line',query:'',line:''});
 const [loadState,setLoadState]=useState<'loading'|'success'|'error'>('loading'),[readError,setReadError]=useState('');
 const hasLoaded=useRef(false);
 const loadRequest=useRef<AbortController|null>(null);
 const load=async()=>{
  loadRequest.current?.abort();
  const request=new AbortController();loadRequest.current=request;
  const initialLoad=!hasLoaded.current;
  // Polling keeps the table's geometry and editing controls unchanged. Only an
  // initial read blocks the view; mutation busy/error state belongs to writes.
  if(initialLoad){setBusy(true);setLoadState('loading');setReadError('');}
  try{
   const response=await fetch('/api/employees',{cache:'no-store',signal:request.signal});
   if(response.status===401||response.status===403){
    if(request.signal.aborted)return;
    hasLoaded.current=false;setItems([]);setAllowed(false);setCurrent(null);setDraft(null);
    throw Error(response.status===403?t('Bạn không có quyền xem danh sách nhân viên. Vui lòng liên hệ quản trị viên.','您無權查看員工名單，請聯絡管理員。','You do not have permission to view employees. Contact an administrator.'):t('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.','登入已過期，請重新登入。','Your session expired. Please sign in again.'));
   }
   const data=await response.json();
   if(!response.ok)throw Error(data.error||t('Không tải được danh sách nhân viên.','無法載入員工名單。','Could not load employees.'));
   if(!Array.isArray(data.employees))throw Error(t('Dữ liệu danh sách nhân viên không hợp lệ.','員工資料格式無效。','Invalid employee response.'));
   if(request.signal.aborted)return;
   hasLoaded.current=true;setItems(data.employees);setAllowed(Boolean(data.permissions?.edit));setReadError('');setLoadState('success');
  }catch(e){if(!request.signal.aborted){setReadError((e as Error).message);setLoadState('error');}}
  finally{if(initialLoad&&loadRequest.current===request&&!request.signal.aborted)setBusy(false);}
 };
 useEffect(()=>{void load();return()=>loadRequest.current?.abort();},[dataRevision]);
 const visible=items.filter(e=>(appliedLookup.mode==='createDate'||!appliedLookup.line||e.line===appliedLookup.line)&&(appliedLookup.mode==='createDate'||!appliedLookup.query||`${e.id} ${e.secondaryId||''} ${e.name}`.toLocaleLowerCase().includes(appliedLookup.query.toLocaleLowerCase()))).sort((a,b)=>appliedLookup.mode==='createDate'?newestMasterFirst(a,b)||a.id.localeCompare(b.id):a.id.localeCompare(b.id));
 const save=async()=>{if(!draft||busy)return;setBusy(true);setError('');setNotice('');try{const response=await fetch('/api/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(draft)}),data=await response.json();if(!response.ok)throw Error(data.error||'Không lưu được nhân viên');setDraft(null);setCurrent(data.employee);setNotice(t('Đã lưu nhân viên. Lịch Capacity đã chốt không bị thay đổi.','員工已儲存。已確認的產能版本不變。','Employee saved. Confirmed Capacity versions remain unchanged.'));await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const restore=async()=>{if(!current||busy)return;setBusy(true);setError('');try{const response=await fetch('/api/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...current,action:'restore'})}),data=await response.json();if(!response.ok)throw Error(data.error);setCurrent(data.employee);setNotice(t('Đã khôi phục nhân viên.','員工已恢復。','Employee restored.'));await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const dateText=(date?:string)=>date?date.split('-').reverse().join('/'):'—';
 const importFile=async()=>{if(!importRows.length||busy)return;setBusy(true);setError('');try{const response=await fetch('/api/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'import',rows:importRows})}),data=await response.json();if(!response.ok)throw Error(data.error||'Không nhập được danh sách');if(data.duplicates?.length)throw Error(`Mã đã có: ${data.duplicates.join(', ')}. Chưa nhập dòng nào; hãy đối chiếu trước.`);setImportRows([]);setImportOpen(false);await load();setNotice(`${t('Đã nhập','已匯入','Imported')} ${data.imported} ${t('nhân viên','位員工','employees')}.`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <main className="workspace employee-directory" data-own-language="true"><PageTitle variant="menu-root">{t('Danh sách nhân viên','員工名單','Employee directory')}</PageTitle>
  <StandardToolbar name="EmployeeDirectory" items={[
   toolbar.action({disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>void load()},t(loadState==='error'?'Thử lại':'Tải lại',loadState==='error'?'重試':'重新載入',loadState==='error'?'Retry':'Refresh')),
   toolbar.action({disabled:busy||!allowed, disabledExplanation: !allowed ? "Bạn không có quyền thực hiện thao tác này." : "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",onClick:()=>{setDraft({id:'',secondaryId:'',name:'',line:'A',active:true,version:0,startDate:'',endDate:''});setCurrent(null);}},t('Thêm mới','新增','Add'),allowed),
   toolbar.action({disabled:busy||!allowed||!current||isMasterCancelled(current), disabledExplanation: !allowed ? "Bạn không có quyền thực hiện thao tác này." : busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : !current ? "Chỉ chọn một dòng phù hợp để thực hiện thao tác." : "Bản ghi đã hủy, không thể chỉnh sửa.",onClick:()=>setDraft({...current!})},t('Sửa','編輯','Edit'),allowed),
   current&&isMasterCancelled(current)&&toolbar.action({disabled:busy,onClick:()=>void restore()},t('Khôi phục','恢復','Restore'),allowed),
   toolbar.action({onClick:()=>{setSearchMode(appliedLookup.mode);setQuery(appliedLookup.query);setLine(appliedLookup.line);setSearchOpen(true);}},'Tra cứu',true,'lookup'),
   ...(searchOpen?[
   toolbar.field('TRA THEO',[toolbar.select({value:searchMode,onChange:e=>{setSearchMode(e.target.value);setLine('');setQuery('');}},<><option value="line">Line / {t('Mã hoặc tên','編號或姓名','ID or name')}</option><option value="createDate">Create - date</option></>)]),
   toolbar.field('NỘI DUNG TRA',[searchMode==='createDate'?toolbar.input({value:t('Thêm/sửa gần nhất','最近新增或修改','Latest added or edited'),readOnly:true}):toolbar.input({value:query,onChange:e=>setQuery(e.target.value),placeholder:t('Mã hoặc tên','編號或姓名','ID or name')})]),
   searchMode!=='createDate'&&toolbar.field('Line',[toolbar.select({value:line,onChange:e=>setLine(e.target.value)},<><option value="">{t('Tất cả Line','所有產線','All lines')}</option><option value="A">Line A</option><option value="B">Line B</option><option value="C">Line C</option></>)]),
   toolbar.action({onClick:()=>setAppliedLookup({mode:searchMode,query,line})},'Tìm kiếm',true,'search'),
   toolbar.action({onClick:()=>{setQuery('');setLine('');setAppliedLookup({mode:searchMode,query:'',line:''});}},'Xóa lọc',true,'clear'),
   toolbar.action({onClick:()=>setSearchOpen(false)},'Quay lại',true,'back','lookup')
   ]:[]),
   current&&toolbar.action({onClick:()=>document.querySelector('#employee-history')?.scrollIntoView({block:'nearest'})},t('Lịch sử','歷史','History'))
  ]}/>
  {loadState==='loading'&&<p role="status" className="cap-notice">{t('Đang tải danh sách nhân viên…','正在載入員工名單…','Loading employees…')}</p>}
  {readError&&<p role="alert" className="cap-error">{hasLoaded.current&&t('Chưa cập nhật được; đang hiển thị danh sách đã tải. ','無法更新；顯示先前載入的名單。 ','Refresh failed; showing the previously loaded list. ')}{readError}</p>}
  {error&&<p role="alert" className="cap-error">{error}</p>}{notice&&<p role="status" className="cap-notice">{notice}</p>}
  {importOpen&&<section className="data-card employee-import"><h2>{t('Nhập danh sách nhân viên','匯入員工名單','Import employees')}</h2><p>{t('Mở DSNV.xls, chọn toàn bộ bảng và dán vào đây; hoặc chọn file CSV. Xem trước rồi mới nhập, không ghi đè mã đã có.','開啟 DSNV.xls，複製整個表格貼到此處，或選擇 CSV。預覽後才匯入。','Copy the entire table from DSNV.xls here, or select CSV. Review before import; existing IDs are not overwritten.')}</p><textarea rows={4} placeholder={t('Dán các ô đã sao chép từ Excel','貼上 Excel 儲存格','Paste cells copied from Excel')} aria-label={t('Dán danh sách từ Excel','貼上員工名單','Paste employee list')} onChange={e=>{setError('');try{setImportRows(parseEmployeeFile(e.target.value));}catch{setImportRows([]);}}}/><input type="file" accept=".csv,.txt,text/csv" aria-label={t('Chọn file CSV nhân viên','選擇員工 CSV','Select employee CSV')} onChange={async e=>{setError('');setImportRows([]);try{const file=e.target.files?.[0];if(file){if(file.size>300000)throw Error('File quá lớn');setImportRows(parseEmployeeFile((await file.text()).replace(/^\uFEFF/,'')));}}catch(err){setError((err as Error).message);}}}/>{importRows.length>0&&<><p>{t('Sẽ nhập','將匯入','Ready to import')} {importRows.length} {t('người','人','people')} · A {importRows.filter(x=>x.line==='A').length} · B {importRows.filter(x=>x.line==='B').length} · C {importRows.filter(x=>x.line==='C').length}</p><DataTable className="table-wrap"><table><thead><tr><th>{t('Mã NV','員工編號','ID')}</th><th>{t('Mã ngắn','短碼','Short ID')}</th><th>{t('Họ tên','姓名','Name')}</th><th>Line</th></tr></thead><tbody>{importRows.slice(0,8).map((x,i)=><tr key={`${x.id}-${i}`}><DataCell>{x.id}</DataCell><DataCell>{x.secondaryId}</DataCell><DataCell>{x.name}</DataCell><DataCell kind="code">{x.line}</DataCell></tr>)}</tbody></table></DataTable><FeedbackActionButton disabled={busy||!allowed} disabledExplanation={!allowed ? "Bạn không có quyền thực hiện thao tác này." : "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."} onClick={()=>void importFile()}>{t('Nhập sau khi đối chiếu','核對後匯入','Import after review')}</FeedbackActionButton></>}<FeedbackActionButton onClick={()=>{setImportOpen(false);setImportRows([]);}}>{t('Đóng','關閉','Close')}</FeedbackActionButton></section>}
  {draft&&<section className="data-card employee-form"><h2>{draft.version?t('Sửa nhân viên','編輯員工','Edit employee'):t('Thêm nhân viên','新增員工','Add employee')}</h2><div className="employee-form-fields"><label>{t('Mã nhân viên','員工編號','Employee ID')}<input value={draft.id} disabled={draft.version>0} onChange={e=>setDraft({...draft,id:e.target.value.toUpperCase()})}/></label><label>{t('Mã NV ngắn','員工短碼','Short employee ID')}<input value={draft.secondaryId||''} onChange={e=>setDraft({...draft,secondaryId:e.target.value.toUpperCase()})}/></label><label>{t('Họ tên','姓名','Full name')}<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Line<select value={draft.line} onChange={e=>setDraft({...draft,line:e.target.value})}><option value="A">Line A</option><option value="B">Line B</option><option value="C">Line C</option></select></label><label>{t('Ngày bắt đầu','到職日期','Start date')}{!draft.version?' *':''}<input type="date" required={!draft.version} value={draft.startDate||''} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label><label>{t('Ngày ngưng làm việc','離職日期','End date')}<input type="date" min={draft.startDate||undefined} value={draft.endDate||''} onChange={e=>setDraft({...draft,endDate:e.target.value})}/></label></div><p>{t('Ngày ngưng làm việc là ngày đầu tiên không còn làm việc. Để trống nếu vẫn đang làm.','離職日期為不再工作的第一天；在職時留空。','End date is the first day no longer working. Leave blank while employed.')}</p><div className="employee-form-actions"><FeedbackActionButton disabled={busy||!draft.id||!draft.name.trim()||(!draft.version&&!draft.startDate)} disabledExplanation={busy ? "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại." : "Nhập đầy đủ mã, tên nhân viên và ngày bắt đầu trước khi lưu."} onClick={()=>void save()}>{t('Lưu','儲存','Save')}</FeedbackActionButton><FeedbackActionButton onClick={()=>setDraft(null)}>{t('Đóng','關閉','Close')}</FeedbackActionButton></div></section>}
  <section className="data-card"><DataTable className="table-wrap"><table><thead><tr><th>{t('Mã nhân viên','員工編號','Employee ID')}</th><th>{t('Mã NV ngắn','員工短碼','Short ID')}</th><th>{t('Họ tên','姓名','Full name')}</th><th>Line</th><th>{t('Ngày bắt đầu','到職日期','Start date')}</th><th>{t('Ngày ngưng làm việc','離職日期','End date')}</th><th>{t('Trạng thái','狀態','Status')}</th><th>{t('Phiên bản','版本','Version')}</th></tr></thead><tbody>{visible.map(e=><tr key={e.id} onClick={()=>setCurrent(e)} onDoubleClick={()=>allowed&&!isMasterCancelled(e)&&setDraft({...e})} className={current?.id===e.id?'employee-selected':''}><DataCell>{e.id}</DataCell><DataCell>{e.secondaryId||'—'}</DataCell><DataCell>{e.name}</DataCell><DataCell kind="code">Line {e.line}</DataCell><DataCell>{dateText(e.startDate)}</DataCell><DataCell>{dateText(e.endDate)}</DataCell><DataCell>{e.cancelled?t('Đã hủy','已停用','Cancelled'):e.active?t('Đang làm việc','在職','Active'):e.startDate&&e.startDate>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'})?t('Chưa bắt đầu','尚未到職','Not started'):t('Đã ngưng làm việc','已離職','Stopped working')}</DataCell><DataCell kind="code">{e.version||1}</DataCell></tr>)}{hasLoaded.current&&!visible.length&&<tr data-no-data="true"><DataCell colSpan={8}>{t('Chưa có nhân viên phù hợp.','沒有符合的員工。','No matching employees.')}</DataCell></tr>}</tbody></table></DataTable></section>
  {current&&<details id="employee-history" className="data-card" key={current.id}><summary>{t('Lịch sử thay đổi','變更歷史','Change history')} · {current.id} · {current.name}</summary>{(current.history||[]).slice().reverse().map((h,i)=><p key={i}>{new Date(h.at).toLocaleString(locale==='zh'?'zh-TW':locale==='en'?'en-GB':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hourCycle:'h23'})} · {h.by} · {h.before?`${h.before.name} / ${h.before.line} → `:t('Tạo mới → ','建立 → ','Created → ')}{h.after.name} / {h.after.line} · {h.action||t('Cập nhật','更新','Updated')} · {t('Ngày bắt đầu','到職日期','Start date')}: {dateText(h.before?.startDate)} → {dateText(h.after.startDate)} · {t('Ngày ngưng làm việc','離職日期','End date')}: {dateText(h.before?.endDate)} → {dateText(h.after.endDate)}</p>)}</details>}
 </main>;
}
