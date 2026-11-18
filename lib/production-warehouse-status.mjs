import {isDailyOutput} from './production-report-model.mjs';
export const confirmedProductionWarehouseStatus='Đã xác nhận';
export function dailyReceiptMatches(report,receipt){
 const quantity=Number(report?.approvedQuantity);
 return isDailyOutput(report)&&!report.cancelled&&!report.voided&&!report._deleted&&report.reviewStatus==='Đã xác nhận'&&Number.isSafeInteger(quantity)&&quantity>0&&receipt?.source==='Sản xuất'&&(receipt.reportId||receipt.sourceReportId)===report.id&&['sku','line','lsxCode'].every(k=>receipt[k]===report[k])&&Number(receipt.proposedQuantity)===quantity&&(!receipt.sourceProductionDate||receipt.sourceProductionDate===report.productionDate);
}
export function dailyReceiptConfirmed(report,receipt){
 return dailyReceiptMatches(report,receipt)&&!receipt._deleted&&!receipt.cancelled&&!receipt.voided&&(receipt.confirmation_status||receipt.confirmationStatus||receipt.status)==='Đã xác nhận'&&receipt.receivedQuantity!==null&&receipt.receivedQuantity!==undefined&&receipt.receivedQuantity!==''&&Number.isFinite(Number(receipt.receivedQuantity))&&Number(receipt.receivedQuantity)>=0&&!!receipt.confirmedBy&&Number.isFinite(Date.parse(receipt.confirmedAt));
}
