import {readRecordPages} from './production-record-pages.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {attachLaborReferences,attachLaborRateOmissions,laborReferenceInScope} from '../../lib/production-labor-reference.mjs';
import {earnedReportBasis} from '../../lib/production-legacy-earned-basis.mjs';
export async function readLaborReferences(db,workflow,omissionsJson=undefined){
 if(!workflow.reports?.some(r=>laborReferenceInScope(r)&&r.kind==='completion'&&earnedReportBasis(r).unit==null))return workflow;
 const rows=await readRecordPages(db,{where:"entity IN ('labor_hours','labor_hours_history')"});
 const wrap=r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at});
 const menu=siteLaborHours(rows.filter(r=>r.entity==='labor_hours').map(wrap),null,rows.filter(r=>r.entity==='labor_hours_history').map(wrap));
 let policy=[];try{policy=JSON.parse(omissionsJson||'[]');}catch{/* Invalid configuration must not omit anything. */}
 const reports=attachLaborReferences(workflow.reports,workflow.orders||[],menu);
 return {...workflow,reports:attachLaborRateOmissions(reports,workflow.orders||[],policy)};
}
