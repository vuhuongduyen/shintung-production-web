import {formatPlanningFailure} from './production-plan';
import {FeedbackActionButton} from './action-feedback';
import {useState} from 'react';
import {auditText,auditDisplayValue,auditPathLabel,buildAuditDetails} from '../lib/website-test-log-display.mjs';
import {DataTable} from './onspa-ui/DataTable';
import {DataCell} from './onspa-ui/DataCell';

type Entry={before:unknown;after:unknown;hasBefore:boolean;hasAfter:boolean;summary:unknown;outcome?:string};
export function WebsiteTestLogDetails({entry,language='vi'}:{entry:Entry;language?:'vi'|'en'|'zh'}){
 const [showAll,setShowAll]=useState(false);
 const t=(vi:string,en:string,zh:string)=>auditText(vi,en,zh,language);
 const details=buildAuditDetails(entry),changed=details.rows.filter(row=>row.changed);
 const visible=showAll?details.rows:changed;
 const context=entry.summary?buildAuditDetails({before:entry.summary,after:entry.summary,hasBefore:true,hasAfter:true}):null;
 const submitted=(entry.summary as Record<string,unknown>)?.submittedInput;
 const failureDetails=(entry.summary as {failureDetails?:Array<{id?:string;sku?:string;reason?:string}>})?.failureDetails;
 const submittedDetails=submitted?buildAuditDetails({before:submitted,after:submitted,hasBefore:true,hasAfter:true}):null;
 if(entry.outcome&&submittedDetails)return <section style={{minWidth:0}}>{failureDetails?.length ? <div role="note" style={{whiteSpace:'pre-wrap',color:'#b91c1c',fontSize:16,padding:12}}>{formatPlanningFailure({error:String((entry.summary as Record<string,unknown>)?.reason||'batchRejected'),details:failureDetails},[],language)}</div> : null}<h3>{t('Nội dung người dùng đã nhập / gửi','Submitted input','使用者提交內容')}</h3><p>{t('Đây là dữ liệu của lần thao tác, không phải xác nhận đã lưu thành công.','These are submitted values, not confirmation of a successful save.','此為提交資料，不代表儲存成功。')}</p><DataTable className="table-wrap"><table data-no-pagination="true"><thead><tr><th>{t('Trường dữ liệu','Field','欄位')}</th><th>{t('Nội dung đã nhập','Submitted value','輸入內容')}</th></tr></thead><tbody>{submittedDetails.rows.map((row,index)=><tr key={index}><DataCell style={{whiteSpace:'normal',overflowWrap:'anywhere'}}>{auditPathLabel(row.path,language)}</DataCell><DataCell style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{auditDisplayValue(row.after,language)}</DataCell></tr>)}</tbody></table></DataTable>{!!(entry.summary as Record<string,unknown>)?.validationMessage&&<p>{String((entry.summary as Record<string,unknown>).validationMessage)}</p>}</section>;
 return <section style={{minWidth:0}} aria-label={t('Nội dung thay đổi','Change details','變更內容')}>
  {entry.outcome&&!(entry.summary as Record<string,unknown>)?.submittedInput&&<p>{t('Nhật ký này chưa lưu nội dung đã nhập. Không thể khôi phục chính xác dữ liệu của lần thao tác cũ.','Submitted input was not recorded for this operation and cannot be reconstructed.','此操作未記錄輸入內容，無法還原。')}</p>}
  <h3>{t('Nội dung thay đổi','Change details','變更內容')}</h3>
  <p>{t('Chỉ đối chiếu phần dữ liệu đã ghi nhận và tải được. Bản trước/sau có thể đã rút gọn; không thể kết luận về phần không hiển thị.','Only recorded, loaded data is compared. Snapshots may already be abbreviated; no conclusion can be drawn about omitted data.','僅比較已記錄及載入的資料。快照可能已縮減，無法對未顯示的資料下結論。')}</p>
  {(!entry.hasBefore||!entry.hasAfter)&&<p>{t('Lịch sử thiếu bản trước hoặc sau; không thể xác định đầy đủ các thay đổi.','A before or after snapshot is missing; the complete changes cannot be determined.','缺少變更前或變更後快照，無法判定完整變更。')}</p>}
  {!changed.length&&<p>{t('Không thấy khác biệt trong phần dữ liệu hiển thị. Xem thông tin ghi nhận bên dưới để biết thao tác.','No visible differences in the displayed data. See recorded information below for the operation.','目前顯示資料無可見差異。請查看下方操作記錄。')}</p>}
  {details.rows.length>changed.length&&<FeedbackActionButton type="button" className="edit-user-link" onClick={()=>setShowAll(value=>!value)}>{showAll?t('Chỉ xem trường thay đổi','Show changed fields only','僅顯示變更欄位'):t('Xem cả trường không đổi','Include unchanged fields','包含未變更欄位')}</FeedbackActionButton>}
  {!!visible.length&&<DataTable className="table-wrap"><table data-no-pagination="true" style={{tableLayout:'fixed',width:'100%',minWidth:540}}><thead><tr><th>{t('Trường dữ liệu','Field','欄位')}</th><th>{t('Trước thay đổi','Before','變更前')}</th><th>{t('Sau thay đổi','After','變更後')}</th></tr></thead><tbody>{visible.map((row,index)=><tr key={index}><DataCell style={{whiteSpace:'normal',overflowWrap:'anywhere',verticalAlign:'top'}}>{auditPathLabel(row.path,language)}</DataCell><DataCell style={{whiteSpace:'normal',overflowWrap:'anywhere',verticalAlign:'top'}}><span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{auditDisplayValue(row.before,language)}</span></DataCell><DataCell style={{whiteSpace:'normal',overflowWrap:'anywhere',verticalAlign:'top'}}><span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{auditDisplayValue(row.after,language)}</span></DataCell></tr>)}</tbody></table></DataTable>}
  {details.snapshotLimited&&<p role="status">{t('Bản dữ liệu có thể đã chạm giới hạn hiển thị (độ dài, số trường hoặc độ sâu).','Snapshots may have reached display limits (length, fields or nesting).','快照可能已達顯示限制（長度、欄位或層級）。')}</p>}
  {details.truncated&&<p role="status">{t('Chi tiết đã rút gọn ở 500 trường.','Details limited to 500 fields.','詳細資料限制為 500 個欄位。')}</p>}
  {context&&<><h3>{t('Thông tin đã ghi nhận','Recorded information','已記錄資訊')}</h3><dl>{context.rows.map((row,index)=><div key={index} style={{marginBottom:8,overflowWrap:'anywhere'}}><dt><strong>{auditPathLabel(row.path,language)}</strong></dt><dd style={{whiteSpace:'pre-wrap',marginInlineStart:0}}>{auditDisplayValue(row.after,language)}</dd></div>)}</dl>{context.truncated&&<p>{t('Thông tin đã rút gọn ở 500 trường.','Information limited to 500 fields.','資訊限制為 500 個欄位。')}</p>}</>}
 </section>;
}
