import {productionDisplayTime} from './production-display-time.mjs';
import {sanitizeTestLogValue} from './website-test-log.mjs';

// Presentation only. Never infer an unrecorded value or modify the source history.
const labels = {
 submittedInput:['Nội dung đã nhập / gửi','Submitted input','提交內容'],fields:['Dữ liệu nhập','Input fields','輸入欄位'],limited:['Đã rút gọn nội dung','Truncated','已縮減'],validationMessage:['Thông báo lỗi tại giao diện','UI error','介面錯誤'],employee:['Nhân viên','Employee','員工'],effectiveAt:['Thời điểm bắt đầu','Effective time','生效時間'],endsAt:['Thời điểm kết thúc','End time','結束時間'],
 requestDate:['Ngày yêu cầu','Request date','需求日期'],delivery:['Ngày giao','Delivery date','交貨日期'],planningWeek:['Tuần kế hoạch','Planning week','計畫週'],plannedWeek:['Tuần đã lập kế hoạch','Planned week','已排程週'],importedAt:['Thời gian nhập','Imported at','匯入時間'],importedBy:['Người nhập','Imported by','匯入人'],sourceLine:['Dòng nguồn','Source line','來源列'],sourceId:['Mã nguồn','Source ID','來源編號'],sourceIds:['Mã nguồn','Source IDs','來源編號'],
 input:['Thông số đầu vào','Inputs','輸入參數'],hcHours:['Giờ hành chính','Regular hours','正常工時'],otHours:['Giờ tăng ca','Overtime hours','加班工時'],otWorkers:['Số người tăng ca','Overtime workers','加班人數'],factor:['Hệ số (%)','Factor (%)','係數 (%)'],workDays:['Ngày làm việc','Working days','工作日'],otDays:['Lịch tăng ca','Overtime days','加班日'],breakMinutes:['Giải lao (phút)','Break (minutes)','休息（分鐘）'],cleanMinutes:['Vệ sinh (phút)','Cleaning (minutes)','清潔（分鐘）'],otEnabled:['Có tăng ca','Overtime enabled','啟用加班'],hours:['Số giờ','Hours','時數'],enabled:['Bật','Enabled','啟用'],date:['Ngày','Date','日期'],
 id:['Mã bản ghi','Record ID','紀錄編號'],name:['Tên','Name','名稱'],secondaryId:['Mã phụ','Secondary ID','次要編號'],
 line:['Chuyền','Line','產線'],active:['Đang hoạt động','Active','啟用'],cancelled:['Đã hủy','Cancelled','已取消'],_deleted:['Đã xóa','Deleted','已刪除'],
 sku:['Mã SKU','SKU','SKU'],laborHour:['Giờ công / sản phẩm','Labor hours / product','每件工時'],note:['Ghi chú','Note','備註'],
 week:['Tuần','Week','週'],plan:['Số lượng kế hoạch','Planned quantity','計畫數量'],planId:['Mã kế hoạch','Plan ID','計畫編號'],
 suggested:['Số lượng đề xuất','Suggested quantity','建議數量'],status:['Trạng thái','Status','狀態'],priority:['Ưu tiên','Priority','優先順序'],
 start:['Ngày bắt đầu','Start date','開始日期'],end:['Ngày kết thúc','End date','結束日期'],type:['Loại','Type','類型'],
 spec:['Quy cách','Specification','規格'],group:['Nhóm','Group','群組'],sequence:['Thứ tự','Sequence','順序'],
 qty:['Số lượng','Quantity','數量'],lsxQty:['Số lượng LSX','Order quantity','工單數量'],workers:['Số nhân viên','Workers','人數'],
 availableHours:['Giờ công khả dụng','Available hours','可用工時'],previousHours:['Giờ công trước','Previous hours','原工時'],newHours:['Giờ công mới','New hours','新工時'],
 rows:['Danh sách dòng','Rows','資料列'],employees:['Nhân viên','Employees','員工'],employeeIds:['Mã nhân viên','Employee IDs','員工編號'],
 decision:['Quyết định','Decision','決定'],request:['Yêu cầu','Request','申請'],reviewReason:['Lý do xét duyệt','Review reason','審核原因'],
 reason:['Lý do','Reason','原因'],changes:['Các thay đổi','Changes','變更'],before:['Trước thay đổi','Before','變更前'],after:['Sau thay đổi','After','變更後'],
 field:['Trường dữ liệu','Field','欄位'],result:['Kết quả','Result','結果'],version:['Phiên bản','Version','版本'],
 createdAt:['Thời gian tạo','Created at','建立時間'],createdBy:['Người tạo','Created by','建立人'],updatedAt:['Thời gian cập nhật','Updated at','更新時間'],updatedBy:['Người cập nhật','Updated by','更新人'],
 actor:['Người thao tác','User','操作人員'],at:['Thời gian','Time','時間'],action:['Thao tác ghi nhận','Recorded operation','記錄操作'],source:['Nguồn','Source','來源'],
};
export function auditText(vi,en,zh,language='vi'){return language==='zh'?zh:language==='en'?en:vi;}
export function auditFieldLabel(key,language='vi') { const label=Object.hasOwn(labels,key)?labels[key]:null;return label?label[language==='zh'?2:language==='en'?1:0]:key; }
const object=value=>value!==null&&typeof value==='object';
const state=(value,present=true)=>({kind:present?'value':'unknown',value});
const child=(parent,key)=>parent.kind!=='value'?parent:parent.value===null?{kind:'no-record'}:object(parent.value)&&Object.hasOwn(parent.value,key)?state(parent.value[key]):{kind:'absent'};
const equal=(a,b)=>a.kind===b.kind&&(a.kind!=='value'||JSON.stringify(a.value)===JSON.stringify(b.value));
export function auditDisplayValue(cell,language='vi'){
 const t=(vi,en,zh)=>auditText(vi,en,zh,language);
 if(cell.kind==='unknown')return t('Không rõ (lịch sử không lưu)','Unknown (not recorded)','未知（未記錄）');
 if(cell.kind==='no-record')return t('Không có bản ghi','No record','無紀錄');
 if(cell.kind==='absent')return t('Không có trường này trong bản lưu','Field absent from snapshot','快照中無此欄位');
 const v=cell.value;
 if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return productionDisplayTime(v)+' (GMT+7)';
 if(v===null)return t('Chưa có giá trị (null)','No value (null)','無值（null）');
 if(v===undefined)return t('Không rõ (không có giá trị)','Unknown (no value)','未知（無值）');
 if(v==='')return t('Để trống','Empty text','空白文字');
 if(typeof v==='boolean')return v?t('Có','Yes','是'):t('Không','No','否');
 if(Array.isArray(v))return t('Danh sách rỗng','Empty list','空清單');
 if(object(v))return t('Không có trường dữ liệu','No fields','無欄位');
 return String(v);
}
export function buildAuditDetails(entry){
 const rows=[];let truncated=false;
 const limited=(value,depth=0)=>depth>8||typeof value==='string'&&(value.length>6000||/\[(?:Đã rút gọn|đã rút gọn|Nội dung lồng sâu)/.test(value))||Array.isArray(value)&&(value.length>=200||value.some(v=>limited(v,depth+1)))||value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.keys(value).length>=150||Object.values(value).some(v=>limited(v,depth+1)));
 const snapshotLimited=limited(entry.before)||limited(entry.after);
 const walk=(before,after,path,depth=0)=>{
  if(rows.length>=500){truncated=true;return;}
  const a=before.kind==='value'?before.value:undefined,b=after.kind==='value'?after.value:undefined;
  // Arrays are explicitly positional, never guessed to represent the same employee/record.
  const incompatibleTypes=before.kind==='value'&&after.kind==='value'&&(a!==null&&b!==null||path.length>0)&&(object(a)!==object(b)||object(a)&&object(b)&&Array.isArray(a)!==Array.isArray(b));
  const compatible=!incompatibleTypes;
  const keys=compatible?[...new Set([...object(a)?Object.keys(a):[],...object(b)?Object.keys(b):[]])]:[];
  if(keys.length&&depth<10){for(const key of keys)walk(child(before,key),child(after,key),[...path,{key,array:Array.isArray(a)||Array.isArray(b)}],depth+1);return;}
  // Different container types retain each side through independently flattened sections below.
  if(!compatible){walk(before,{kind:'absent'},[...path,{key:'before'}],depth+1);walk({kind:'absent'},after,[...path,{key:'after'}],depth+1);return;}
  rows.push({path,before,after,changed:!equal(before,after)});
 };
 const before=state(entry.hasBefore?sanitizeTestLogValue(entry.before):undefined,entry.hasBefore);
 const after=state(entry.hasAfter?sanitizeTestLogValue(entry.after):undefined,entry.hasAfter);
 walk(before,after,[]);
 return {rows,truncated,snapshotLimited};
}
export function auditPathLabel(path,language='vi'){
 return path.length?path.map(({key,array})=>array?auditText(`Mục ${Number(key)+1} (vị trí)`,`Item ${Number(key)+1} (position)`,`項目 ${Number(key)+1}（位置）`,language):auditFieldLabel(key,language)).join(' › '):auditText('Bản ghi','Record','紀錄',language);
}
