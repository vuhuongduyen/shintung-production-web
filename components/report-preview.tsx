'use client';
import {permissionDeniedMessage} from '../lib/permission-feedback';
import {DataCell} from './onspa-ui/DataCell';
import {toolbarLocale,subscribeToolbarLocale,translateToolbar} from './standard-toolbar/translations';
import {useContext,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {StandardToolbar,toolbar,ExportPermissionContext} from './standard-toolbar/StandardToolbar';
import {displayPayrollCell,payrollXlsx,payrollPdf} from '../lib/production-payroll-export.mjs';
export default function ReportPreview({report,close}:{report:any;close:()=>void}){
 const exportAllowed=useContext(ExportPermissionContext);
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi'),t=(s:string)=>translateToolbar(s,locale);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sheet,setSheet]=useState(0);
 async function download(format:'xlsx'|'pdf'){
  if(!exportAllowed){setError(permissionDeniedMessage(locale));return;}
  if(busy)return;setBusy(true);setError('');try{const bytes=format==='xlsx'?payrollXlsx(report):await payrollPdf(report),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf'})),a=document.createElement('a');a.href=url;a.download=`ONSPA-${report.title.replace(/[^\p{L}\p{N} -]/gu,'').slice(0,70)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setError(e instanceof Error?e.message:'Không xuất được file');}finally{setBusy(false);}
 }
 return createPortal(<div className="onspa-report-overlay"><section className="onspa-report-dialog" role="dialog" aria-modal="true" aria-label={t('Xem trước khi tải')}><StandardToolbar permissionFeedback name="ReportPreview" items={[toolbar.note('Xem trước khi tải'),toolbar.action({onClick:()=>void download('xlsx'),disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."},'Tải Excel',exportAllowed),toolbar.action({onClick:()=>void download('pdf'),disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại."},'Tải PDF',exportAllowed),toolbar.action({onClick:close,disabled:busy, disabledExplanation: "Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.",'aria-label':'Đóng xem trước'},'✕'),toolbar.field('Bảng dữ liệu',[toolbar.select({value:sheet,onChange:e=>setSheet(Number(e.target.value))},<>{report.sheets.map((s:any,i:number)=><option key={i} value={i}>{s.name}</option>)}</>)])]}/>{!report.compactHeader&&<p>{report.note} · {report.timestamp}</p>}{busy&&<p role="status">{t('Đang tạo file…')}</p>}{error&&<p role="alert">{error}</p>}<div className="onspa-report-scroll"><table><tbody>{report.sheets[sheet].rows.map((r:any,i:number)=><tr key={i} className={`report-row-${r.kind}`}>{r.values.map((c:any,j:number)=>r.kind==='header'?<th key={j}>{displayPayrollCell(c)}</th>:<DataCell key={j} colSpan={r.values.length===1?report.sheets[sheet].widths.length:1}>{displayPayrollCell(c)}</DataCell>)}</tr>)}</tbody></table></div></section></div>,document.body);
}
