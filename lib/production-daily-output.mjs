import {normalized} from './production-plan.mjs';
import {validBusinessDate,effectiveValueOn} from './effective-dated-value.mjs';
import {mergeProduction} from './in-transit.mjs';
import {dailyOutputModel,isDailyOutput} from './production-report-model.mjs';
export {dailyOutputModel,isDailyOutput};
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
export function dailyOutputTotals(order,reports){
 const state=mergeProduction(order,reports);
 const reserved=reports.filter(r=>isDailyOutput(r)&&!r.cancelled&&!r.voided&&(r.transitId===order.id||!r.transitId&&r.lsxCode===order.lsxCode)).reduce((total,r)=>total+Math.max(0,Number(r.pendingQuantityReservation)||0),0);
 return {approved:Number(state.completedQty||0),pending:Number(state.pendingReportQty||0),...(reserved?{reserved}:{}),reported:Number(state.completedQty||0)+Number(state.pendingReportQty||0)+reserved};
}
// Explicit Vietnam civil time, separate from the server/audit recording time.
export function dailyProductionTime(local,productionDate,recordedAt){
 if(local==null)return {};
 if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(local)||!validBusinessDate(local.slice(0,10))||local.slice(0,10)!==productionDate)fail('Ngày giờ sản xuất không hợp lệ hoặc không khớp ngày sản xuất.');
 const at=new Date(`${local}:00+07:00`).toISOString();
 if(!Number.isFinite(Date.parse(recordedAt))||Date.parse(at)>Date.parse(recordedAt))fail('Ngày giờ sản xuất không được sau thời điểm hiện tại.');
 return {productionLocalDateTime:local,productionAt:at};
}
// Pure construction contract; the server supplies trusted policy/rate history,
// checks permission, and commits with cursor/order/rate/policy CAS atomically.
export function buildDailyOutput({order,reports,quantity,productionDate,productionLocalDateTime,cutoverDate,intakeModel,today,rateVersions,id,actor,recordedAt}){
 if(!validBusinessDate(cutoverDate))fail('Chưa có mốc triển khai đã duyệt cho báo sản lượng ngày.',409);
 if(!validBusinessDate(productionDate)||!validBusinessDate(today)||productionDate>today||(intakeModel!=='server-receipt-quantity-v1'&&productionDate<cutoverDate))fail('Ngày sản xuất phải hợp lệ, từ mốc chuyển đổi đến hôm nay.');
 if(!order?.id||!order.lsxCode||!order.sku||!['A','B','C'].includes(order.line)||order.syncStatus!=='ĐÃ ĐỒNG BỘ'||order.status==='HỦY'||order.cancelReason)fail('Lệnh không còn đủ điều kiện báo sản lượng.',409);
 if(!Number.isSafeInteger(quantity)||quantity<=0)fail('SL phát sinh phải là số nguyên lớn hơn 0.');
 const totals=dailyOutputTotals(order,reports);
 if(!Number.isSafeInteger(Number(order.lsxQty))||totals.reported+quantity>Number(order.lsxQty))fail('SL phát sinh và lũy kế chờ/đã xác nhận vượt số lượng lệnh.',409);
 const resolved=effectiveValueOn(rateVersions,productionDate);
 const rated=resolved.ok&&typeof resolved.basis.value==='number'&&Number.isFinite(resolved.basis.value)&&resolved.basis.value>=0;
 if(!id||!actor||!recordedAt)fail('Thiếu định danh hoặc người ghi nhận.');
 const ownDaily=reports.filter(r=>isDailyOutput(r)&&!r.cancelled&&!r.voided&&(r.transitId===order.id||!r.transitId&&r.lsxCode===order.lsxCode));
 const legacyCompletedBaseline=ownDaily.length?Math.max(...ownDaily.map(r=>Number(r.legacyCompletedBaseline)||0)):Number(mergeProduction(order,reports.filter(r=>!isDailyOutput(r))).completedQty)||0;
 const productionTime=dailyProductionTime(productionLocalDateTime,productionDate,recordedAt);
 const orderSnapshot=Object.fromEntries(['id','planId','planGroupId','lsxCode','sku','name','spec','line','lsxQty','syncStatus','planStart','planEnd','status','week','sequence','completedQty'].filter(k=>order[k]!==undefined).map(k=>[k,order[k]]));
 return {...productionTime,orderSnapshot,legacyCompletedBaseline,id,kind:'completion',reportingModel:dailyOutputModel,quantityOnly:true,transitId:order.id,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,line:order.line,lsxQty:Number(order.lsxQty),productionDate,reportedQuantity:quantity,approvedQuantity:0,reviewStatus:'Chờ kiểm tra',warehouseStatus:'Chưa tạo phiếu',version:1,rateBasis:rated?resolved.basis:null,rateStatus:rated?'resolved':'missing',rateIssue:rated?null:'Thiếu căn cứ định mức',earnedStandardHours:rated?quantity*resolved.basis.value:null,reportedBy:actor,reportedAt:recordedAt};
}
export function dailyEarnedHours(report){
 if(!isDailyOutput(report))return null;
 const resolved=effectiveValueOn([],report.productionDate,report.rateBasis);
 const quantity=Number(report.reviewStatus==='Đã xác nhận'?report.approvedQuantity:report.reportedQuantity);
 return resolved.ok&&typeof resolved.basis.value==='number'&&Number.isFinite(resolved.basis.value)&&resolved.basis.value>=0&&Number.isSafeInteger(quantity)&&quantity>=0?quantity*resolved.basis.value:null;
}

// One index per report snapshot; edits in a dialog must not rescan all history
// once for every order. Preserve legacy source matching exactly.
export function dailyOutputTotalsIndex(orders,reports){
 const byId=new Map(),byCode=new Map(),byPlan=new Map(),norm=normalized;
 const add=(map,key,r)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(r);};
 for(const input of reports){const r=input?.payload&&typeof input.payload==='object'?input.payload:input;if(r.transitId)add(byId,r.transitId,r);else if(r.lsxCode||r.orderCode||r.mo)add(byCode,norm(r.lsxCode||r.orderCode||r.mo),r);else if(r.planId)add(byPlan,norm(r.planId),r);}
 return new Map(orders.map(o=>[o.id,dailyOutputTotals(o,[...(byId.get(o.id)||[]),...(byCode.get(norm(o.lsxCode))||[]),...(!o.planGroupId?byPlan.get(norm(o.planId))||[]:[])])]));
}
