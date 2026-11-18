import {linePlanDisplayFields,projectLinePlanRow} from '../../lib/line-plan-view.mjs';
import {tokenHash} from '../../worker/password-auth.mjs';
import {quickLinePermissions,hasQuickLineReadScope} from '../../lib/user-permission-profiles.mjs';
import {dateISO,monday,normalizeRow,normalized,numberOrNull,sortedRows,transitMatchesPlan} from '../../lib/production-plan.mjs';
import {mergeProduction,normalizeTransit} from '../../lib/in-transit.mjs';
import {readRecordPages} from './production-record-pages.mjs';
export const linePlanGrant='Kế hoạch sản xuất / Production_plan / Xem';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,linePlanAccessError:true});};
const snapshotSql="SELECT json_group_array(json_array(entity,record_key,payload)) FROM (SELECT entity,record_key,payload FROM app_records WHERE entity IN ('users','quick_line_plan_access') ORDER BY entity,record_key)";
const validUser=(key,user)=>user?.login===key&&key===`LINE_${user.line}`&&['A','B'].includes(user.line)&&user.authMode==='quick_line'&&user.active===true&&!user._deleted&&user.role==='USER';
const validAccess=(key,p)=>p?.login===key&&p.line===key.slice(5)&&p.active===true&&!p._deleted&&p.view===true;
async function snapshot(db){const row=await db.prepare(`SELECT (${snapshotSql}) AS snapshot`).first();const serialized=row.snapshot;return {serialized,revision:await tokenHash(serialized),rows:JSON.parse(serialized).map(([entity,key,raw])=>({entity,key,payload:JSON.parse(raw)}))};}
function target(rows,login){
 const users=rows.filter(r=>r.entity==='users'&&r.key.toLowerCase()===login.toLowerCase());
 const access=rows.filter(r=>r.entity==='quick_line_plan_access'&&r.key.toLowerCase()===login.toLowerCase());
 if(users.length!==1||users[0].key!==login||!validUser(login,users[0].payload))fail('Tài khoản Line không hợp lệ hoặc ngưng hoạt động.');
 if(access.length>1||access.some(r=>r.key!==login||r.payload.login!==login||r.payload.line!==login.slice(5)||r.payload._deleted||r.payload.active!==true))fail('Bản ghi quyền Line cần đối chiếu trước khi thay đổi.');
 return {login,line:users[0].payload.line,view:access.length===1&&validAccess(login,access[0].payload),before:access[0]?.payload||null};
}
function admin(actor){if(!actor?.isAdmin||actor.authMode==='quick_line'||!String(actor.userId||'').trim())fail('Chỉ Admin đã xác thực được cấp quyền xem Pro Plan.',403);}
export async function readLinePlanAccess(db,actor){admin(actor);const state=await snapshot(db);return {revision:state.revision,users:['LINE_A','LINE_B'].map(login=>{try{const row=target(state.rows,login);return {login:row.login,line:row.line,view:row.view,eligible:true};}catch(e){return {login,eligible:false,view:false,reason:e.message};}})};}
export async function saveLinePlanAccess(db,body,actor){
 admin(actor);if(!body||!['LINE_A','LINE_B'].includes(body.login)||typeof body.view!=='boolean'||body.confirmed!==true)fail('Chọn Line, quyền xem và xác nhận thay đổi.',400);
 const state=await snapshot(db);if(body.expectedRevision!==state.revision)fail('Quyền hoặc tài khoản vừa thay đổi. Tải lại để đối chiếu.');
 const user=target(state.rows,body.login),by=actor.userId,at=new Date().toISOString(),auditId=crypto.randomUUID();
 const after={...user.before,login:user.login,line:user.line,active:true,view:body.view,updatedBy:by,updatedAt:at};
 const audit={action:'LINE_PLAN_VIEW_PERMISSION',actor:by,at,changes:[{entity:'quick_line_plan_access',key:user.login,before:user.before,after}]};
 const result=await db.batch([
 db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE (${snapshotSql})=?`).bind('admin_audit',auditId,JSON.stringify(audit),by,at,state.serialized),
 db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='admin_audit' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind('quick_line_plan_access',user.login,JSON.stringify(after),by,at,auditId)
 ]);
 if(result[0].meta.changes!==1||result[1].meta.changes!==1)fail('Quyền hoặc tài khoản vừa thay đổi. Tải lại để đối chiếu.');
 return {ok:true,auditId};
}
export async function quickLinePlanGrants(db,user){
 if(!hasQuickLineReadScope(user))return [...quickLinePermissions];
 try{const state=await snapshot(db);if(target(state.rows,user.login).view)return [...quickLinePermissions,linePlanGrant];}catch{/* Invalid or inactive identity fails closed. */}
 return [...quickLinePermissions];
}
// This endpoint never returns envelopes, transit/report records, group totals,
// source snapshots, audit, or freeform metadata, even for a transferred plan.
const inputFields=[...linePlanDisplayFields,'groupPlanId'];
const scalar=value=>typeof value==='string'||typeof value==='number'&&Number.isFinite(value)||value===null;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

// A transferred row is not a completed row. Resolve each split via the canonical
// plan-row link and use the canonical merged/approved In Transit progress. A
// finished partial LSX cannot hide the unallocated balance of its parent plan.
export function unfinishedLinePlan(row,transit=[],{ambiguousIds=new Set(),stable=true,ambiguousFallback=false}={}){
 if(row.status==='HỦY')return false;
 if(row.status!=='ĐÃ CHUYỂN'||!(row.plan>0)||!stable)return true;
 const linked=transit.filter(item=>item.line===row.line&&!item._deleted&&transitMatchesPlan(row,item));
 if(linked.some(item=>ambiguousIds.has(item.id)||ambiguousFallback&&!item.planRowId))return true;
 const active=linked.filter(item=>item.status!=='HỦY'&&!item.cancelReason);
 if(!active.length||new Set(active.map(item=>item.id)).size!==active.length)return true;
 let completed=0;
 for(const item of active){
  const quantity=numberOrNull(item.lsxQty),actual=numberOrNull(item.completedQty)||0;
  // Unknown/unopened LSX and pending reports are not proof of completion.
  if(!(quantity>0)||!dateISO(item.actualCompletedAt)||actual<quantity||Number(item.pendingReportQty)>0)return true;
  completed+=Math.min(quantity,Math.max(0,actual));
 }
 return completed<row.plan;
}

// Keep original attribution long enough to detect a legacy report that would
// otherwise be applied to multiple LSX by the compatible Plan-ID fallback.
// Reconciliation itself is the same normalizeTransit/mergeProduction pair used
// by getTransit. Nothing from these records is returned to the Line client.
async function readLineProgress(db,line){
 const entities=['in_transit','production_report','production_event','production_history_import'];
 const batches=await Promise.all(entities.map(entity=>readRecordPages(db,{where:'entity=?',args:[entity]})));
 const parsed=batches.map(records=>records.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||a.record_key.localeCompare(b.record_key)).flatMap(record=>{
  try{const payload=JSON.parse(record.payload);return object(payload)&&!payload._deleted?[{...record,payload}]:[];}catch{return [];}
 }));
 const [records,storedReports,events,history]=parsed;
 const orders=records.map(record=>normalizeTransit({...record.payload,id:record.payload.id||record.record_key}));
 const reports=storedReports.flatMap(record=>(Array.isArray(record.payload.rows)?record.payload.rows:[{...record.payload,id:record.payload.id||record.record_key}])
  .filter(object).map(report=>({...report,updatedAt:report.updatedAt||record.updated_at}))).map(report=>object(report.payload)?{...report.payload,updatedAt:report.payload.updatedAt||report.updatedAt}:report).filter(report=>!object(report.payload)&&!report._deleted&&!report.voided&&!report.cancelled);
 const ids=new Set(reports.map(report=>report.id));
 reports.push(...history.flatMap(record=>Array.isArray(record.payload.reports)?record.payload.reports:[])
  .filter(report=>object(report)&&!report._deleted&&!ids.has(report.id)&&!report.voided&&!report.cancelled&&['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(report.reviewStatus))
  .map(({id,transitId,kind,reviewStatus,reportedQuantity,line})=>({id,transitId,kind,reviewStatus,reportedQuantity,line})));
 // A report explicitly assigned to another Line never contributes quantity.
 const ownReports=reports.filter(report=>!report.line||report.line===line);
 const ambiguousIds=new Set();
 for(const report of ownReports){
  const contributes=report.kind==='completion'?normalized(report.reviewStatus)===normalized('Đã xác nhận'):numberOrNull(report.completedQty??report.quantityCompleted)!==null;
  if(!contributes)continue;
  const code=String(report.lsxCode||report.orderCode||report.mo||'').trim();
  const matching=orders.filter(order=>report.transitId?report.transitId===order.id:code?normalized(code)===normalized(order.lsxCode):!order.planGroupId&&Boolean(order.planId&&normalized(report.planId)===normalized(order.planId)));
  if(matching.length>1)for(const order of matching)ambiguousIds.add(order.id);
 }
 const ownEvents=events.map(record=>record.payload).filter(event=>!event.line||event.line===line);
 return {ambiguousIds,transit:orders.filter(order=>order.line===line).map(order=>mergeProduction(order,ownReports,ownEvents))};
}

export async function readQuickLinePlan(db,actor,week=null){
 if(!hasQuickLineReadScope(actor)||!actor.grants?.includes(linePlanGrant))fail('Không có quyền xem Pro Plan của Line.',403);
 if(week!==null&&(!week||monday(week)!==week))fail('Tuần không hợp lệ.',400);
 const records=await readRecordPages(db,{where:'entity=?',args:['production_plan'],columns:'record_key,payload'});
 const candidates=[],stableRows=new Set();
 for(const record of records){let p;try{p=JSON.parse(record.payload);}catch{continue;}
  if(!p||typeof p!=='object'||p._deleted)continue;
  const envelopeWeek=monday(p.week)||monday(record.record_key);
  const rows=Array.isArray(p.rows)?p.rows:Array.isArray(p)?p:[p];
  for(const raw of rows){
   // Validate identity before normalizing. A malformed/cross-Line value cannot
   // become an authorized row through coercion or inherited envelope metadata.
   if(!object(raw)||raw._deleted||raw.line!==actor.line)continue;
   const rowWeek=raw.week?monday(raw.week):envelopeWeek;
   if(!rowWeek)continue;
   const input=Object.fromEntries(inputFields.filter(key=>scalar(raw[key])).map(key=>[key,raw[key]]));
   const row=normalizeRow({...input,week:rowWeek},rowWeek,candidates.length);
   candidates.push(row);
   if(typeof raw.id==='string'&&raw.id.trim())stableRows.add(row);
  }
 }
 // Detect ambiguity across all own-Line weeks, even when a week is requested.
 const counts=key=>candidates.reduce((map,row)=>map.set(key(row),(map.get(key(row))||0)+1),new Map());
 const rowIds=counts(row=>row.id),planIds=counts(row=>row.planId),businessKeys=counts(row=>`${row.week}|${row.sku.toUpperCase()}`);
 const selected=candidates.filter(row=>!week||row.week===week);
 const progress=selected.some(row=>row.status==='ĐÃ CHUYỂN')?await readLineProgress(db,actor.line):{transit:[],ambiguousIds:new Set()};
 const rows=sortedRows(selected.filter(row=>unfinishedLinePlan(row,progress.transit,{ambiguousIds:progress.ambiguousIds,stable:stableRows.has(row)&&rowIds.get(row.id)===1,ambiguousFallback:planIds.get(row.planId)>1||businessKeys.get(`${row.week}|${row.sku.toUpperCase()}`)>1})))
  .sort((a,b)=>a.week.localeCompare(b.week))
  .map(projectLinePlanRow);
 return {week,line:actor.line,readOnly:true,scope:'unfinished',rows};
}
