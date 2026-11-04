import {isDailyOutput} from './production-report-model.mjs';
import {staffTransferDetails} from './production-staff-transfer-detail.mjs';
const journalDayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
import {productionEntryActorId} from "./production-actor.mjs";
export const productionActionNames={"staff-recall-request":"Yêu cầu thu hồi nhân sự","warehouse-duty":"Lịch trực phụ kho","attendance-cancel":"Hủy biến động nhân lực","line-movement":"Chuyển Line theo giờ",extra:'Làm việc phát sinh',start:'Nhập trạm',pause:'Tạm ngưng',resume:'Tiếp tục',complete:'Xuất trạm',completion:'Báo công sản lượng',transfer:'Chuyển người',add:'Bổ sung người',reduce:'Giảm người',absence:'Nghỉ / phụ kho','line-absence':'Biến động theo Line','attendance-override':'Điều chỉnh có mặt','stage-incident':'Báo sự cố theo công đoạn',incident:'Báo sự cố',schedule:'Lịch làm việc',capacity:'Capacity tuần','report-approval':'Xác nhận báo công','report-rejection':'Trả báo công','approve-hours':'Duyệt điều chỉnh giờ','hours-adjustment':'Điều chỉnh giờ','report-cancel':'Hủy báo công','report-correction':'Điều chỉnh báo công'};
productionActionNames['daily-output']='Báo sản lượng thành phẩm theo ngày';
productionActionNames['daily-output-correction']='Điều chỉnh sản lượng theo ngày';
productionActionNames['daily-output-withdrawal-request']='Yêu cầu thu hồi phiếu sản lượng';
productionActionNames['daily-output-withdrawal-decision']='Kho xử lý yêu cầu thu hồi';
productionActionNames['daily-output-withdrawal-completed']='Đã thu hồi phiếu sản lượng và đối soát kho';
productionActionNames.cutover='Tiếp nhận nhật ký từ web thử';
export const correctionKinds=['start','pause','resume','complete','transfer','add','reduce','incident','absence','line-absence','attendance-override'];
export const journalCategories={output:'Sản lượng ngày',report:'Báo công',time:'Nhật ký giờ công',labor:'Nhân lực',adjustment:'Điều chỉnh báo công',change:'Thay đổi'};
function withdrawalStatus(entry){
 if(entry.kind==='daily-output-withdrawal-request')return 'Chờ Kho xử lý thu hồi';
 if(entry.kind==='daily-output-withdrawal-completed')return 'Đã thu hồi';
 if(entry.kind==='daily-output-withdrawal-decision')return ({'approved-awaiting-sheet':'Kho đồng ý, chờ đối soát Sheet',rejected:'Kho từ chối thu hồi'})[entry.after?.status]||'Cần đối chiếu quyết định Kho';
 return null;
}
/** @param {any} [index] */
export function journalContext(entry,orders,employees=[],reports=[],index=null) {
 const report=entry.kind==='completion'?entry:entry.reportId?(index?.reports.get(entry.reportId)||reports.find(r=>r.id===entry.reportId)):null;
 const snapshot=entry.orderSnapshot||report?.orderSnapshot||{};
 const ids=new Set([entry.transitId,entry.sourceId,entry.destinationId,report?.transitId,...(entry.affectedOrderIds||[])]);
 const daily=isDailyOutput(entry)||isDailyOutput(report);
 const linked=daily&&index?[...ids].map(id=>index.orders.get(id)).filter(Boolean):orders.filter(o=>ids.has(o.id));
 const join=field=>daily?(entry[field]??snapshot[field]??report?.[field]??linked[0]?.[field]??''):[...new Set(linked.map(o=>o[field]).concat(entry[field]||snapshot[field]||report?.[field]||[]).filter(Boolean))].join(' / ');
 const sku=join('sku');
 // Some legacy events retain only a report reference or SKU. Resolve a name
 // without attaching unrelated work orders or inventing missing product data.
 const name=join('name')||(sku?[...new Set(orders.filter(o=>o.sku===sku).map(o=>o.name).filter(Boolean))].join(' / '):'');
 return {...entry,lsx:join('lsxCode'),sku,name,spec:join('spec'),planId:join('planId'),employee:(entry.employees||entry.hours?.perEmployee?.map(p=>p.id)||[]).map(id=>employees.find(p=>p.id===id)?.name||id).join(', '),actor:productionEntryActorId(entry),actorId:productionEntryActorId(entry),operation:entry.stageReporting?productionActionNames[entry.stageAction]:entry.movementType==='recall'?'Thu hồi nhân sự':entry.sourceTimeLog?entry.sourceOperation:productionActionNames[entry.kind]||entry.kind,status:withdrawalStatus(entry)||(entry.replacedByStageBatch?'Đã thay thế':entry.voided||entry.cancelled?'Đã hủy':entry.reviewStatus||(entry.approved===false?'Chờ duyệt giờ':'Đang áp dụng'))};
}
export function journalRows(category,reports,events) {
 if(category==='output')return reports.filter(r=>r.kind==='completion'&&isDailyOutput(r));
 if(category==='report')return reports.filter(r=>r.kind==='completion'&&!isDailyOutput(r));
 const types={time:['stage-work','stage-incident','start','pause','resume','complete','incident','source-time'],labor:['stage-work','staff-recall-request','warehouse-duty','line-movement','start','add','reduce','transfer','absence','line-absence','attendance-override'],adjustment:['daily-output-withdrawal-completed','daily-output-withdrawal-request','daily-output-withdrawal-decision','daily-output-correction','attendance-cancel','report-correction','report-cancel','hours-adjustment','approve-hours'],change:['daily-output','report-source-reconciliation','report-cancel','report-approval','report-rejection','schedule','capacity']};
 const hidden=['time','labor'].includes(category)?staffTransferDetails(events).hidden:new Set();
 return events.filter(e=>!hidden.has(e.id)&&!(category==='time'&&e.sourceTimeLog&&e.sourceOperation==='BÁO CÔNG')&&!(category==='labor'&&e.historicalImport)&&(types[category]?.includes(e.kind)||(category==='adjustment'&&e.supersedes)));
}
export function filterJournal(rows,filters={}) {
 const query=String(filters.value||'').trim().toLocaleLowerCase('vi');
 return rows.filter(row=>{
  if(query&&!String(row[filters.field||'lsx']||'').toLocaleLowerCase('vi').includes(query))return false;
  if(filters.line&&filters.line!=='all'&&row.line!==filters.line)return false;
  if(filters.status&&filters.status!=='all'&&row.status!==filters.status)return false;
  if(!filters.from&&!filters.to)return true;
  const value=isDailyOutput(row)&&row.kind==='completion'?row.productionAt||row.productionDate:row.recordedAt||row.reportedAt||row.effectiveAt;
  const day=value?journalDayFormatter.format(new Date(value)):'';
  return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);
 });
}
