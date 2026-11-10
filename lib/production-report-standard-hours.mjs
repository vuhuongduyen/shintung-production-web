import {referenceReportBasis} from './production-labor-reference.mjs';
import {earnedReportBasis} from './production-legacy-earned-basis.mjs';
const nonnegative=value=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
// Historical displays use the same per-report evidence as payroll. Zero-output
// intermediate stages supply labor, never a rate or an extra finished quantity.
export function reportStandardHours(reports,{reported=false,reference=false}={}){
 let quantity=0,earned=0,missing=false;const units=new Set(),references=[];
 for(const report of reports){
  const qty=nonnegative(reported?report.reportedQuantity:report.approvedQuantity??report.reportedQuantity);
  if(qty===null){missing=true;continue;}if(qty===0)continue;
  quantity+=qty;const basis=reference?referenceReportBasis(report):earnedReportBasis(report);if(basis.reference)references.push(basis.reference);const unit=nonnegative(basis.unit),hours=reported?unit===null?null:qty*unit:nonnegative(basis.earned);
  if(unit===null||hours===null){missing=true;continue;}units.add(unit);earned+=hours;
 }
 const resolved=!missing&&quantity>0&&Number.isFinite(earned);
 return {unit:resolved?(units.size===1?[...units][0]:earned/quantity):null,earned:resolved?earned:null,...(reference?{references}: {})};
}
