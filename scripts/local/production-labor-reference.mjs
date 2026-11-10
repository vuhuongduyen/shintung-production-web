import {attachLaborRateWarningSuppressions} from '../../lib/production-labor-warning.mjs';
import {applyFixedLaborReferences} from '../../lib/production-labor-reference-snapshot.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {attachLaborReferences,attachLaborRateOmissions,laborReferenceInScope} from '../../lib/production-labor-reference.mjs';
import {earnedReportBasis} from '../../lib/production-legacy-earned-basis.mjs';
export async function readLaborReferences(db,workflow,omissionsJson=undefined,snapshotId=undefined,warningSuppressionsJson=undefined){
 if(!workflow.reports?.some(r=>laborReferenceInScope(r)&&r.kind==='completion'&&earnedReportBasis(r).unit==null))return workflow;
 const rows=await readRecordPages(db,{where:"entity IN ('labor_hours','labor_hours_history')"});
 const wrap=r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at});
 const menu=siteLaborHours(rows.filter(r=>r.entity==='labor_hours').map(wrap),null,rows.filter(r=>r.entity==='labor_hours_history').map(wrap));
 let policy=[];try{policy=JSON.parse(omissionsJson||'[]');}catch{/* Invalid configuration must not omit anything. */}
 let reports=attachLaborReferences(workflow.reports,workflow.orders||[],menu);
 if(snapshotId){
  if(!/^[a-f0-9]{64}$/.test(snapshotId))throw Error('Invalid fixed labor basis configuration.');
  const saved=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind('production_labor_reference_snapshot',snapshotId).first();
  if(!saved)throw Error('Configured fixed labor basis is unavailable.');
  const manifest=JSON.parse(saved.payload);
  if(manifest.digest!==snapshotId)throw Error('Fixed labor basis identity mismatch.');
  reports=await applyFixedLaborReferences(reports,manifest,workflow.orders||[]);
 }
 let warningPolicy=[];try{warningPolicy=JSON.parse(warningSuppressionsJson||'[]');}catch{/* Invalid presentation policy hides nothing. */}
 reports=attachLaborRateOmissions(reports,workflow.orders||[],policy);
 return {...workflow,reports:attachLaborRateWarningSuppressions(reports,workflow.orders||[],warningPolicy)};
}
