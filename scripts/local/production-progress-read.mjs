import {getTransit} from './in-transit.mjs';
import {productionOrderScope} from './production-order-pages.mjs';
import {normalized} from '../../lib/production-plan.mjs';
import {pendingReportReview} from '../../lib/production-progress-review.mjs';
// Progress needs review fields (including laborNotes and hours), but not the
// copied audit trees. Full disclosure still reads the original records.
const trim=value=>`json_remove(${value},'$.sourceSnapshot','$.overlapWarnings','$.history')`;
export function progressReadPayload(entity){
 if(entity==='production_report'||entity==='production_event')return trim('payload');
 if(entity==='production_history_import')return `CASE WHEN json_type(payload,'$.reports')='array' THEN json_set(payload,'$.reports',json((SELECT json_group_array(json(${trim('value')})) FROM json_each(payload,'$.reports')))) ELSE payload END`;
 return 'payload';
}

// Determine current membership from compact quantity/status records. Archived
// report details and audit trees never enter the default workflow response.
// Metadata must still be checked so corrections can reopen a completed order.
export async function activeProgressDatabase(db,actor,catalog,preservedOrders){
 const state=await getTransit(db,{},catalog,{includeHistory:false,includeProductionSummary:true,skipLeadtime:true,preservedOrders});
 const orders=activeProgressOrders(state,actor);
 const scoped=productionOrderScope(db,orders,{workflow:true});
 const activeIds=new Set(orders.map(o=>o.id));
 // The active-order scan already computed these rows. Reuse them only inside
 // this request; do not scan quantities and status a second time.
 scoped.transitState={rows:state.rows.filter(o=>activeIds.has(o.id)),history:[]};
 return scoped;
}

export function activeProgressOrders(state,actor){
 const pending=state.summaryReports.filter(pendingReportReview);
 // Index once instead of scanning all pending reports for every finished order.
 // Keep the original identity precedence and split-Plan exclusion exactly.
 const ids=new Set(),codes=new Set(),plans=new Set();
 for(const r of pending){if(r.transitId)ids.add(r.transitId);else if(r.lsxCode||r.orderCode||r.mo)codes.add(normalized(r.lsxCode||r.orderCode||r.mo));else plans.add(normalized(r.planId));}
 const hasPending=o=>ids.has(o.id)||codes.has(normalized(o.lsxCode))||!o.planGroupId&&Boolean(o.planId&&plans.has(normalized(o.planId)));
 const orders=state.rows.filter(o=>(!actor.line||o.line===actor.line)&&o.status!=='HỦY'&&!(Number(o.lsxQty)>0&&Number(o.completedQty)>=Number(o.lsxQty)&&!hasPending(o)));
 // Pending history without a live In Transit row remains actionable for
 // reconciliation; it must not disappear merely because the row is archived.
 const known=new Set(state.rows.map(o=>o.id));
 for(const r of pending)if(r.transitId&&!known.has(r.transitId)&&(!actor.line||r.line===actor.line))orders.push({id:r.transitId,lsxCode:r.lsxCode||'',planId:r.planId||''});
 return orders;
}

export function workspaceReadPayload(entity){
 if(entity==='production_report'||entity==='production_event')return "json_remove(payload,'$.sourceSnapshot')";
 if(entity==='production_history_import')return `CASE WHEN json_type(payload,'$.reports')='array' THEN json_set(payload,'$.reports',json((SELECT json_group_array(json(json_remove(value,'$.sourceSnapshot'))) FROM json_each(payload,'$.reports')))) ELSE payload END`;
 return 'payload';
}

// Strip audit transport only after legacy signatures and labor references have
// been checked against raw records. Detail disclosures keep the complete data.
export function workspaceDisplayWorkflow(workflow){
 const display=row=>{const {sourceSnapshot,...value}=row;return value;};
 return {...workflow,reports:workflow.reports.map(display),events:workflow.events.map(display)};
}
