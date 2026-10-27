import { dateISO, monday, weekEnd, displayDate, normalizeRow, normalized, numberOrNull } from './production-plan.mjs';
import { transitReportRows } from './in-transit.mjs';

export const reportTypes = [
 ['all','Tổng hợp tiến độ In transit','在途進度總表','In-transit progress'],
 ['completed-late','Lệnh đã hoàn thành nhưng trễ','已完成但延遲工單','Completed late'],
 ['unfinished-week','Lệnh chưa hoàn thành trong tuần kế hoạch','計畫週內未完成工單','Unfinished orders by plan week'],
 ['overdue','Lệnh quá hạn chưa hoàn thành','逾期未完成工單','Overdue unfinished orders'],
 ['not-opened','Kế hoạch chưa mở LSX','尚未開立工單計畫','Plans without work orders'],
 ['sync-issues','Lệnh chưa đồng bộ hoặc lỗi đồng bộ','未同步或同步錯誤工單','Unsynced orders and sync errors'],
 ['cancelled','Lệnh đã hủy','已取消工單','Cancelled orders'],
 ['weekly-plan','Kế hoạch sản xuất tuần','每週生產計畫','Weekly production plan'],
 ['plan-actual','Kế hoạch so với thực tế','計畫與實際比較','Plan versus actual'],
 ['unprocessed-demand','Demand Event chưa được xử lý','尚未處理需求','Unplanned demand events'],
 ['engine-plan','Đề xuất Engine và kết quả lập kế hoạch','Engine 建議與排程結果','Engine proposals versus plans'],
];
export const label=(tuple,locale='vi')=>tuple[locale==='zh'?2:locale==='en'?3:1];
export const columnLabels={
 week:['Tuần kế hoạch','計畫週次','Plan week'],group:['Nhóm SP','產品組','Product group'],sku:['SKU','SKU','SKU'],name:['Tên sản phẩm','產品名稱','Product name'],spec:['Quy cách','規格','Specification'],line:['Line','產線','Line'],planId:['Plan ID','計畫編號','Plan ID'],lsxCode:['Mã LSX','工單號','Work order'],planQty:['SL kế hoạch','計畫數量','Planned qty'],lsxQty:['SL đã mở LSX','工單數量','Work-order qty'],completedQty:['SL hoàn thành','完成數量','Completed qty'],remaining:['SL còn thiếu','剩餘數量','Remaining qty'],inTransitQty:['SL đang đi','在途數量','In-transit qty'],progress:['Tỷ lệ hoàn thành (%)','完成率 (%)','Completion (%)'],start:['Ngày bắt đầu KH','計畫開始日','Planned start'],end:['Ngày kết thúc KH','計畫結束日','Planned end'],actualCompletedAt:['Ngày hoàn thành','完成日期','Completion date'],priority:['Ưu tiên','優先級','Priority'],status:['Trạng thái','狀態','Status'],progressStatus:['Tiến độ','進度狀態','Progress status'],syncStatus:['Đồng bộ','同步狀態','Sync status'],syncError:['Chi tiết lỗi đồng bộ','同步錯誤詳情','Sync error details'],cancelReason:['Lý do hủy','取消原因','Cancellation reason'],type:['Loại','類型','Type'],requestDate:['Ngày yêu cầu','需求日期','Request date'],delivery:['Ngày giao','交貨日期','Delivery date'],qty:['SL yêu cầu','需求數量','Requested qty'],order:['Khách hàng / Đơn hàng','客戶／訂單','Customer / order'],overdueDays:['Số ngày quá hạn','逾期天數','Days overdue'],updatedBy:['Người cập nhật','更新人','Updated by'],suggested:['SL Engine đề xuất','Engine 建議數量','Engine suggested qty'],received:['SL đề xuất đã nhận vào Plan','計畫已接收建議量','Suggestion qty received by Plan'],difference:['Chênh lệch KH − đề xuất','計畫 − 建議差異','Plan − suggestion'],processing:['Kết quả xử lý','處理結果','Processing result'],generatedAt:['Thời điểm Engine','Engine 產生時間','Engine generated at'],snapshotKey:['Mã bản Engine','Engine 版本代碼','Engine snapshot key'],
};
const common=['week','group','sku','name','spec','line'];
export function columnsFor(type){
 if(type==='weekly-plan')return [...common,'planId','planQty','start','end','priority','type','status'];
 if(type==='plan-actual')return [...common,'planId','planQty','lsxQty','completedQty','remaining','progress','start','end','status'];
 if(type==='unprocessed-demand')return ['requestDate','group','sku','name','spec','qty','delivery','overdueDays','type','priority','order','status','updatedBy'];
 if(type==='engine-plan')return [...common,'suggested','received','planQty','difference','processing','status','generatedAt'];
 return [...common,'planId','lsxCode','planQty','lsxQty','completedQty','inTransitQty','progress','end','actualCompletedAt','status','progressStatus','syncStatus',...(type==='sync-issues'?['syncError']:[]),...(type==='cancelled'?['cancelReason']:[])];
}
export function unpackPlans(records=[]){
 const plans=records.filter(r=>r.payload&&!r.payload._deleted).flatMap(record=>{
  const payload=record.payload;
  return (Array.isArray(payload.rows)?payload.rows:Array.isArray(payload)?payload:[payload])
   .filter(row=>row&&!row._deleted&&(row.sku||row.id)).map((row,i)=>normalizeRow(row,payload.week||record.key,i));
 });
 const keys=plans.map(p=>`${p.week}|${normalized(p.sku)}`);
 if(new Set(keys).size!==keys.length)throw Error('PLAN_DUPLICATE');
 return plans;
}
export function reportRows(type,data={},today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})){
 const plans=data.plans||[],transit=(data.transit||[]).filter(r=>!r._deleted);
 const groupBySku=new Map((data.catalog||[]).map(r=>[normalized(r.code),r.group]));
 const enrich=r=>({...r,group:groupBySku.get(normalized(r.sku))||r.group||''});
 if(type==='weekly-plan')return plans.map(p=>enrich({...p,planQty:p.plan,reportDate:p.start||p.week}));
 if(type==='plan-actual')return plans.filter(p=>p.status!=='HỦY').map(p=>{
  const orders=transit.filter(r=>r.status!=='HỦY'&&r.week===p.week&&(r.planRowId?r.planRowId===p.id:r.planId===p.planId));
  const lsxQty=orders.reduce((sum,r)=>sum+(numberOrNull(r.lsxQty)||0),0),completedQty=orders.reduce((sum,r)=>sum+(numberOrNull(r.completedQty)||0),0);
  return enrich({...p,planQty:p.plan,lsxQty,completedQty,remaining:p.plan===null?null:Math.max(0,p.plan-completedQty),progress:p.plan>0?Math.round(completedQty/p.plan*10000)/100:null,reportDate:p.start||p.week});
 });
 if(type==='unprocessed-demand')return (data.demand||[]).filter(r=>!r._deleted&&normalized(r.status)==='CHUA LAP KE HOACH').map(r=>{
  const delivery=dateISO(r.delivery),requestDate=dateISO(r.requestDate);
  return enrich({...r,requestDate,delivery,week:monday(delivery||requestDate),reportDate:delivery||requestDate,overdueDays:delivery?Math.max(0,Math.floor((Date.parse(today)-Date.parse(delivery))/86400000)):null});
 });
 if(type==='engine-plan'){
  const latest=new Map();
  for(const record of data.engines||[]){const p=record.payload;if(!p||p._deleted||!Array.isArray(p.rows))continue;const week=monday(p.week);if(!week)continue;const generatedAt=p.generatedAt||record.updatedAt||'';const old=latest.get(week);if(!old||generatedAt>old.generatedAt)latest.set(week,{...record,week,generatedAt});}
  return [...latest.values()].flatMap(record=>record.payload.rows.filter(r=>!r._deleted&&numberOrNull(r.suggested)>0&&normalized(r.priority)!=='KHONG BO SUNG').map(row=>{
   const p=plans.find(p=>p.week===record.week&&normalized(p.sku)===normalized(row.sku));
   const linked=p?.sourceIds?.includes(record.key),cancelled=p?.status==='HỦY';
   return enrich({...row,week:record.week,suggested:numberOrNull(row.suggested),received:linked?p.suggested:null,planQty:p?.plan??null,difference:p?.plan==null?null:p.plan-Number(row.suggested),processing:cancelled?'plan-cancelled':linked?'received':p?'other-source':'not-received',status:p?.status||'',generatedAt:record.generatedAt,snapshotKey:record.key,reportDate:record.week});
  }));
 }
 return transitReportRows(transit,type,'',today).map(r=>enrich({...r,planQty:r.isAdditionalLsx?null:r.planQty,progress:r.progress==null?null:Math.round(r.progress*10000)/100,end:r.planEnd,reportDate:r.planEnd||r.week}));
}
export function filterReport(rows,filters={}){
 return rows.filter(r=>(!filters.week||monday(r.week)===monday(filters.week))&&(!filters.group||r.group===filters.group)&&(!filters.line||r.line===filters.line)&&(!filters.status||r.status===filters.status)&&(!filters.query||normalized(`${r.sku} ${r.name} ${r.spec} ${r.planId||''} ${r.lsxCode||''}`).includes(normalized(filters.query)))&&(!filters.from||r.reportDate>=filters.from)&&(!filters.to||r.reportDate<=filters.to));
}
export const weekLabel=value=>monday(value)?`${displayDate(monday(value))} - ${displayDate(weekEnd(value))}`:'—';
export function xmlWorkbook(title,headers,rows){
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 return `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>${[[title],headers,...rows].map(row=>`<Row>${row.map(v=>`<Cell><Data ss:Type="${typeof v==='number'&&Number.isFinite(v)?'Number':'String'}">${escape(v)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
}
