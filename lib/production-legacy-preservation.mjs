import {captureLegacyEarnedBasis,legacyEarnedModel} from './production-legacy-earned-basis.mjs';
import {monthlyAttendance} from './production-monthly-attendance.mjs';
import {outputDate} from './production-output-summary.mjs';
import {validBusinessDate} from './effective-dated-value.mjs';
import {finalReportIds} from './production-report-order.mjs';
import {journalOrderHours} from './production-report-cumulative.mjs';
import {journalStandardHours} from './production-journal-standards.mjs';
import {isDailyOutput} from './production-report-model.mjs';
export const preservationModel='observed-production-baseline-v1';
// Explicit preparation only. Captures a known calculation, not an invented
// effective history. The caller must supply one consistent source snapshot.
export async function captureLegacyPreservation({workflow,standards,snapshotId,observedAt,cutoverDate,rawReports=workflow.reports,rawOrders=workflow.orders}){
 if(!validBusinessDate(cutoverDate))throw Error('Mốc chuyển đổi không hợp lệ.');
 const earned=await captureLegacyEarnedBasis({orders:workflow.orders,reports:workflow.reports,standards,snapshotId,observedAt,rawReports});
 const legacy=workflow.reports.filter(r=>!isDailyOutput(r)),finalIds=finalReportIds(legacy,workflow.orders),cumulative=journalOrderHours(legacy,workflow.orders,finalIds),standardHours=journalStandardHours(legacy,workflow.orders,standards,finalIds,cumulative);
 for(const b of earned.basis)b.presentation={...b.presentation,...cumulative.get(b.reportId),...standardHours.get(b.reportId),legacyJournalFinal:finalIds.has(b.reportId)};
 const dates=[...workflow.reports.filter(r=>!isDailyOutput(r)).map(outputDate),...workflow.approvedSchedules.flatMap(s=>(s.days||[]).map(d=>d.date)),...workflow.events.map(e=>String(e.productionDate||e.effectiveAt||'').slice(0,10))];
 const months=[...new Set(dates.filter(validBusinessDate).map(d=>d.slice(0,7)).filter(m=>m<cutoverDate.slice(0,7)))].sort();
 const monthly=months.map(month=>({kind:preservationModel,snapshotId,month,observedAt,lines:Object.fromEntries(['A','B'].map(line=>[line,monthlyAttendance({orders:workflow.orders,events:workflow.events,schedules:workflow.approvedSchedules,employees:workflow.payrollEmployees||workflow.employees,month,line})]))}));
 const rawById=new Map(rawOrders.map(o=>[o.id,o]));
 const orders=workflow.orders.map(o=>({kind:preservationModel,snapshotId,orderId:o.id,sourceSku:o.sku,sourceFields:Object.fromEntries(['name','spec','unit','group','line','standardLeadtime','processes'].map(k=>[k,structuredClone(rawById.get(o.id)?.[k]??null)])),display:Object.fromEntries(['name','spec','unit','group','line','standardLeadtime','processes'].map(k=>[k,structuredClone(o[k]??null)])),observedAt}));
 return {manifest:{id:snapshotId,kind:preservationModel,cutoverDate,observedAt,status:'complete',scope:{earned:true,reportPresentation:true,monthlyAttendance:true,orderMetadata:true},counts:{reports:earned.basis.length,months:monthly.length,orders:orders.length},missingEarned:earned.issues},basis:earned.basis,monthly,orders};
}
export function preservedOrderMetadata(row,basis){
 if(!basis||basis.kind!==preservationModel||String(row.sku).trim().toUpperCase()!==basis.sourceSku)return null;
 return Object.fromEntries(Object.entries(basis.display).filter(([k])=>k==='processes'?JSON.stringify(row[k]??null)===JSON.stringify(basis.sourceFields[k]??null):(row[k]??null)===(basis.sourceFields[k]??null)));
}
