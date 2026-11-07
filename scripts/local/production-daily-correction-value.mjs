import {buildDailyOutput} from '../../lib/production-daily-output.mjs';
import {dailyToday} from './production-daily-output.mjs';
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
export function buildCorrectedDailyReport({old,body,actor,order,scoped,policy,rateRow,now,reason}){
 let next={...old,cancelled:true,cancelledAt:now,cancelledBy:actor.login,cancelReason:reason};
 if(body.operation==='daily-output-edit'){
  // Same-day quantity/time edit retains its original (including missing) basis.
  if(typeof body.productionLocalDateTime!=='string')fail('Thiếu ngày giờ sản xuất (GMT+7).',422);
  const rates=body.productionDate===old.productionDate?(old.rateBasis?[{id:old.rateBasis.versionId,status:'published',validFrom:old.productionDate,value:old.rateBasis.value,revision:old.rateBasis.revision,source:old.rateBasis.source,publishedAt:old.rateBasis.publishedAt}]:[]):rateRow?JSON.parse(rateRow.payload).effectiveVersions||[]:[];
  const rebuilt=buildDailyOutput({order,reports:scoped.reports.map(r=>r.id===old.id?{...r,cancelled:true}:r),quantity:body.quantity,productionDate:body.productionDate,productionLocalDateTime:body.productionLocalDateTime,cutoverDate:policy.policy.effectiveFrom,intakeModel:policy.policy.intakeModel,today:dailyToday(),rateVersions:rates,id:old.id,actor:old.reportedBy,recordedAt:now});
  if(body.productionDate===old.productionDate)Object.assign(rebuilt,{rateBasis:old.rateBasis,rateStatus:old.rateStatus,rateIssue:old.rateIssue,earnedStandardHours:old.rateBasis?body.quantity*old.rateBasis.value:null});
  next={...old,...rebuilt,legacyCompletedBaseline:old.legacyCompletedBaseline,reportedAt:old.reportedAt,delayReason:body.productionDate===old.productionDate?old.delayReason:null,reviewStatus:'Chờ kiểm tra',rejectionReason:null,correctedAt:now,correctedBy:actor.login};
 }
 next.version=Number(old.version||0)+1;
 return next;
}
