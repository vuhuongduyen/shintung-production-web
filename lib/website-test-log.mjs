import {annotateTestLogWarnings} from './website-test-log-warnings.mjs';
// Read-only projection of existing committed histories. Never creates audit rows.
export const testLogStartsAt='2026-10-15T17:00:00.000Z';
export const testLogStartDate='2026-10-16';
const cutoff=Date.parse(testLogStartsAt);
function eventTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
 const [hour,minute,second]=value.slice(11,19).split(':').map(Number);if(hour>23||minute>59||second>59)return NaN;
 const date=value.slice(0,10),utcDay=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(utcDay.getTime())||utcDay.toISOString().slice(0,10)!==date)return NaN;
 return Date.parse(value);
}
export const testLogSources = ['admin_audit','sku_history','labor_hours_history','leadtime_audit','safety_rule_audit','production_plan_audit','in_transit_audit','inventory_snapshot_audit','capacity','employees','production_schedule','production_event','production_history_import','website_action_audit'];
const labels = {production_engine:'Production Engine',file_objects:'Tệp đính kèm',users:'Quản lý người dùng',permissions:'Phân quyền',department_permissions:'Phân quyền',departments:'Thiết lập bộ phận',sku:'SKU Master',labor_hours:'Giờ công',leadtime:'Leadtime',leadtime_versions:'Leadtime',safety_rules:'Safety Days',safety_rule_groups:'Safety Days',forecast:'Base Forecast',bom:'Dữ liệu lượng dùng BOM',bom_change:'Phiếu thay đổi BOM',production_plan:'Production Plan',in_transit:'In Transit',capacity:'Capacity tuần',employees:'Danh sách nhân viên',production_schedule:'Lịch sản xuất thực tế',production_event:'SX báo công',production_report:'SX báo công',production_history_import:'Nhập lịch sử sản xuất',inventory_snapshot:'Chốt tồn kho',inventory:'Tồn kho',demand_event:'Demand Event',production_hr_month:'Giờ công HR',user_feedback:'Phản hồi người dùng',source_sync_device:'Thiết bị sao lưu'};
const adminActionEntity={PASSWORD_SET:'users',INITIAL_ADMIN_ACTIVATED:'users',LINE_USER_CREATED:'users',USER_PERMISSION_SETUP:'permissions',USER_PERMISSION_ADD:'permissions',SOURCE_SYNC_CREATED:'source_sync_device',SOURCE_SYNC_REVOKED:'source_sync_device',SKU_UNIT_BOM_IMPORT:'sku'};
const sourceEntity={sku_history:'sku',labor_hours_history:'labor_hours',leadtime_audit:'leadtime',safety_rule_audit:'safety_rules',production_plan_audit:'production_plan',in_transit_audit:'in_transit',inventory_snapshot_audit:'inventory_snapshot'};
const secretKey=/(password|passwd|pwd|secret|token|credential|authorization|cookie|salt|api.?key|private.?key|base64|password.?hash|^hash$)/i;
const omitKey=/^(history|audit|sourceSnapshots|currentData)$/i;
const passive=/^(LOGIN|LOGOUT|SETUP_ADMIN_DEVICE_ACTIVATED|view|read|search|preview|heartbeat|list|download)$/i;
const metadataOnly=new Set(['updatedAt','updatedBy','modifiedAt','modifiedBy','at','actor','actorId','version','revision']);
export function sanitizeTestLogValue(value,depth=0,bounded=true){
 if(depth>(bounded?8:32))return '[Nội dung lồng sâu đã ẩn]';
 if(typeof value==='string')return bounded&&value.length>6000?value.slice(0,6000)+'… [đã rút gọn]':value;
 if(Array.isArray(value))return [...value.slice(0,bounded?200:undefined).map(v=>sanitizeTestLogValue(v,depth+1,bounded)),...(bounded&&value.length>200?['[Đã rút gọn danh sách]']:[])];
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!omitKey.test(k)&&!secretKey.test(k)).slice(0,bounded?150:undefined).map(([k,v])=>[k,sanitizeTestLogValue(v,depth+1,bounded)]));
 return value??null;
}
const stable=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):Object.fromEntries(Object.keys(value).filter(k=>!metadataOnly.has(k)&&!omitKey.test(k)).sort().map(k=>[k,JSON.parse(stable(value[k]))])):value??null);
const firstText=(...values)=>{for(const value of values)if(typeof value==='string'&&value.trim())return value.trim();return '';};
function actorIdentity(entry,accounts){
 const recorded=firstText(entry.actorId,entry.userId,entry.byId,entry.reportedById,entry.actor?.login,entry.actor,entry.operator,entry.by,entry.changedBy,entry.reportedBy);
 if(!recorded)return {actorId:'',actor:'Không rõ (lịch sử cũ)'};
 const matches=accounts.filter(a=>[a.id,a.login,a.email].some(v=>typeof v==='string'&&v.toLowerCase()===recorded.toLowerCase()));
 const account=matches.length===1?matches[0]:null;
 return {actorId:account?firstText(account.id,account.login,recorded):recorded,actor:account?.name?`${account.name} (${firstText(account.login,recorded)})`:recorded};
}
function classify(entry,before,after,hasBefore,hasAfter,source){
 const action=String(entry.action||entry.kind||entry.type||'');
 if(/delete|remove|cancel|hủy|xoá|xóa/i.test(action)||after?._deleted===true||after?.cancelled===true)return 'delete';
 if(source==='production_history_import')return 'add';
 if(hasBefore&&before===null&&hasAfter&&after!==null||/^(create|add|add-lsx|add-unplanned|insert|FEEDBACK_CREATED|LINE_USER_CREATED|SOURCE_SYNC_CREATED)$/i.test(action))return 'add';
 return 'update';
}
function snapshots(p,source){
 let hasBefore=Object.hasOwn(p,'before'),hasAfter=Object.hasOwn(p,'after');let before=p.before,after=p.after;
 if(p.action==='FEEDBACK_UPDATED'&&p.change){before={status:p.change.beforeStatus,response:p.change.beforeResponse};after={status:p.change.status,response:p.change.response};hasBefore=hasAfter=true;}
 if(source==='sku_history'&&Object.hasOwn(p,'data')){after=p.data;hasAfter=true;}
 if(source==='labor_hours_history'&&Object.hasOwn(p,'newLaborHour')){before=hasBefore?before:p.oldLaborHour===null?null:{laborHour:p.oldLaborHour,note:p.oldNote};after={laborHour:p.newLaborHour,note:p.newNote};hasBefore=hasAfter=true;}
 if(source==='inventory_snapshot_audit'&&p.fromStatus){before={status:p.fromStatus};after={status:p.toStatus};hasBefore=hasAfter=true;}
 if(Array.isArray(p.changes)&&p.changes.length&&p.changes.every(c=>c&&typeof c==='object'&&typeof c.field==='string'&&Object.hasOwn(c,'before')&&Object.hasOwn(c,'after'))){before=Object.fromEntries(p.changes.map(c=>[c.field,c.before]));after=Object.fromEntries(p.changes.map(c=>[c.field,c.after]));hasBefore=hasAfter=true;}
 return {before:hasBefore?sanitizeTestLogValue(before):null,after:hasAfter?sanitizeTestLogValue(after):null,hasBefore,hasAfter,_rawBefore:before??null,_rawAfter:after??null};
}
function recordedContext(p){
 const keys=['decision','request','status','week','line','version','previousHours','newHours','changes','result'];
 const context=Object.fromEntries(keys.filter(k=>Object.hasOwn(p,k)&&p[k]!==null&&p[k]!==undefined).map(k=>[k,p[k]]));
 return Object.keys(context).length?sanitizeTestLogValue(context):null;
}
export function normalizeTestLog(records,accounts=[]){
 const result=[];
 const importBatches=new Map(records.filter(r=>r.entity==='production_history_import').flatMap(r=>{try{const p=typeof r.payload==='string'?JSON.parse(r.payload):r.payload;return p?[[r.record_key,p]]:[];}catch{return [];}}));
 const append=(p,row,suffix='',entityOverride)=>{
  if(p?.action==='USER_PERMISSION_SETUP'&&Array.isArray(p.changes)&&p.changes.every(c=>c&&typeof c==='object'&&Object.hasOwn(c,'before')&&Object.hasOwn(c,'after')&&stable(c.before)===stable(c.after)))return;
  if(!p||typeof p!=='object'||passive.test(String(p.action||p.kind||''))||p.replayed||p.unchanged)return;
  const entity=entityOverride||p.entity||(row.entity==='admin_audit'?adminActionEntity[p.action]:null)||(row.entity==='safety_rule_audit'&&p.group&&!p.ruleId?'safety_rule_groups':sourceEntity[row.entity])||row.entity;
  if(['active_viewer','auth_sessions','auth_accounts','production_cursor'].includes(entity)||row.entity==='admin_audit'&&testLogSources.includes(entity)&&entity.endsWith('_audit'))return;
  const snap=snapshots(p,row.entity);
  // A history row with equal business snapshots is a no-op, even if metadata changed.
  if(snap.hasBefore&&snap.hasAfter&&stable(snap._rawBefore)===stable(snap._rawAfter)&&/^(save|edit|update|FEEDBACK_UPDATED|cập nhật|sửa)?$/i.test(String(p.action||p.kind||p.type||'')))return;
  const review=entity==='production_report'&&snap.hasBefore&&snap.hasAfter&&snap.before?.reviewStatus!==snap.after?.reviewStatus&&['Đã xác nhận','Cần điều chỉnh'].includes(snap.after?.reviewStatus);
  const action=review?(snap.after.reviewStatus==='Đã xác nhận'?'Xác nhận báo công':'Yêu cầu điều chỉnh báo công'):firstText(p.operation,p.action,p.kind,p.type);
  if(row.entity==='admin_audit'&&!snap.hasBefore&&!snap.hasAfter&&!action)return;
  const directIdentity=actorIdentity(p,accounts);
  const parent=row.entity==='production_history_import'&&p.parentBatchId?importBatches.get(p.parentBatchId):null;
  const identity=!directIdentity.actorId&&parent?actorIdentity(parent,accounts):directIdentity,at=firstText(p.at,p.recordedAt,p.changedAt,p.createdAt);
  const record=firstText(p.record,p.key,p.recordId,p.ruleId,p.after?.id,p.sku,p.snapshotId,p.target,p.deviceId,p.sourceId,p.week,row.record_key);
  const id=`${row.entity}:${row.record_key}${suffix}`;
  result.push({id,source:row.entity,sourceId:row.record_key,entity,menu:review?'Tiến độ SX':p.menu||labels[entity]||entity,record,...(row.entity==='website_action_audit'?{outcome:p.outcome==='ui-blocked'&&/^(Trang trước|Trang sau)$/.test(p.operation||'')&&/trang đầu|trang cuối|Chưa có dữ liệu để chuyển trang/.test(p.validationMessage||'')?'ui-unavailable':p.outcome==='ui-blocked'&&/Không thể kết nối|Không tải được dữ liệu/.test(p.validationMessage||'')?'network-unknown':p.outcome,evidence:p.evidence,httpStatus:p.httpStatus,operationId:p.id}:{}),batchOperation:!!p.sourceFileId||/import|batch|bulk/i.test(String(p.source||''))||row.entity==='production_history_import',...identity,at:at&&Number.isFinite(eventTime(at))?at:null,action:classify(p,snap.before,snap.after,snap.hasBefore,snap.hasAfter,row.entity),operation:action||'Cập nhật dữ liệu',reason:firstText(p.reason),...snap,summary:!snap.hasBefore&&!snap.hasAfter?sanitizeTestLogValue(p):recordedContext(p)});
 };
 for(const row of records){
  let p;try{p=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;}catch{continue;}
  if(!p||!testLogSources.includes(row.entity))continue;
  if(row.entity==='capacity'){for(const [i,line]of(Array.isArray(p.rows)?p.rows:[]).entries())for(const [j,h]of(Array.isArray(line?.history)?line.history:[]).entries())append(h&&typeof h==='object'?{...h,key:`${row.record_key} · ${line.line||i}`}:null,row,`:${i}:${j}`);}
  else if(['employees','production_schedule'].includes(row.entity)){for(const [i,h]of(Array.isArray(p.history)?p.history:[]).entries())append(h&&typeof h==='object'?{...h,key:row.record_key}:null,row,`:${i}`);}
  else append(p,row);
 }
 // Exact mirrored correction IDs, or matching entity/key/actor/time AND snapshots.
 const adminIds=new Set(result.filter(r=>r.source==='admin_audit').map(r=>r.sourceId));
 const adminsByActorTime=new Map();
 for(const a of result.filter(r=>r.source==='admin_audit')){const key=JSON.stringify([a.actorId,a.at]);const group=adminsByActorTime.get(key)||[];group.push(a);adminsByActorTime.set(key,group);}
 const partialMatch=(part,whole)=>part===null?whole===null:part&&whole&&typeof part==='object'&&!Array.isArray(part)&&!Array.isArray(whole)?Object.entries(part).filter(([k])=>!metadataOnly.has(k)).every(([k,v])=>stable(v)===stable(whole[k])):stable(part)===stable(whole);
 const mirrored=r=>(adminsByActorTime.get(JSON.stringify([r.actorId,r.at]))||[]).some(a=>a.actorId&&a.actorId===r.actorId&&a.at&&a.at===r.at&&(a.entity===r.entity||r.source==='leadtime_audit'&&a.entity==='leadtime_versions')&&(a.record===r.record||r.source==='leadtime_audit'&&a.after?.sku===r.record&&a.after?.version===r.summary?.version)&&((r.hasBefore&&r.hasAfter&&partialMatch(r._rawBefore,a._rawBefore)&&partialMatch(r._rawAfter,a._rawAfter))||(r.source==='leadtime_audit'&&r.summary?.newLeadTime===a.after?.leadTime&&r.summary?.version===a.after?.version)));
 const exact=new Set(result.filter(r=>r.source==='admin_audit'&&(r.hasBefore||r.hasAfter)).map(r=>stable([r.entity,r.record,r.actorId,r.at,r._rawBefore,r._rawAfter])));
 return result.filter(r=>r.source==='admin_audit'||!mirrored(r)&&!(r.source==='production_event'&&adminIds.has(r.sourceId))&&!((r.hasBefore||r.hasAfter)&&exact.has(stable([r.entity,r.record,r.actorId,r.at,r._rawBefore,r._rawAfter])))).sort((a,b)=>(eventTime(b.at)||0)-(eventTime(a.at)||0)||a.id.localeCompare(b.id)).map(({_rawBefore,_rawAfter,...entry})=>entry);
}
export function filterTestLog(entries,params=new URLSearchParams()){
 const get=k=>String(params.get(k)||'').trim();
 const actor=get('actor'),entity=get('entity'),action=get('action'),from=get('from'),to=get('to'),q=get('q').toLocaleLowerCase('vi');
 const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
 const start=isDate(from)?Date.parse(`${from}T00:00:00+07:00`):-Infinity,end=isDate(to)?Date.parse(`${to}T23:59:59.999+07:00`):Infinity;
 const filtered=entries.filter(e=>(!get('outcome')||e.outcome===get('outcome'))&&Number.isFinite(eventTime(e.at))&&eventTime(e.at)>=cutoff&&(get('warnings')!=='1'||e.warnings?.length>0)&&(!actor||(actor==='__unknown__'?!e.actorId:e.actorId===actor))&&(!entity||e.entity===entity)&&(!action||e.action===action)&&((!from&&!to)||e.at&&Date.parse(e.at)>=start&&Date.parse(e.at)<=end)&&(!q||[e.record,e.operation,e.reason,e.menu,e.actor].join(' ').toLocaleLowerCase('vi').includes(q)));
 const limit=Math.min(100,Math.max(1,Number.parseInt(get('limit'),10)||50)),offset=Math.max(0,Math.min(100000,Number.parseInt(get('offset'),10)||0));
 return {entries:filtered.slice(offset,offset+limit),total:filtered.length,offset,limit,hasMore:offset+limit<filtered.length};
}
export async function readWebsiteTestLog(db,params=new URLSearchParams()){
 const legacySources=testLogSources.filter(s=>s!=='website_action_audit');
 const placeholders=legacySources.map(()=>'?').join(',');
 // The DB projects oversized history outside the budget to NULL before transport.
 // This bounds payload hydration even when inventory/engine snapshots are large.
 const rows=(await db.prepare(`WITH recent AS (SELECT entity,record_key,payload,updated_at,length(CAST(payload AS BLOB)) AS payload_bytes FROM app_records WHERE entity IN (${placeholders}) ORDER BY updated_at DESC,entity,record_key LIMIT 5001), budgeted AS (SELECT *,SUM(payload_bytes) OVER (ORDER BY updated_at DESC,entity,record_key) AS loaded_bytes FROM recent) SELECT entity,record_key,updated_at,CASE WHEN loaded_bytes<=8388608 THEN payload ELSE NULL END AS payload,CASE WHEN loaded_bytes<=8388608 THEN 0 ELSE 1 END AS payload_omitted FROM budgeted ORDER BY updated_at DESC,entity,record_key`).bind(...legacySources).all()).results;
 const dateBound=(value,end=false)=>{const stamp=eventTime(`${value}T${end?'23:59:59.999':'00:00:00'}+07:00`);return Number.isFinite(stamp)?new Date(stamp).toISOString():end?'9999':testLogStartsAt;};
 const ledger=(await db.prepare("SELECT entity,record_key,payload,updated_at FROM app_records WHERE entity='website_action_audit' AND updated_at>=? AND updated_at<=? ORDER BY updated_at DESC LIMIT 5001").bind(dateBound(params.get('from')),dateBound(params.get('to'),true)).all()).results;
 const accounts=(await db.prepare("SELECT json_extract(payload,'$.id') AS id,json_extract(payload,'$.login') AS login,json_extract(payload,'$.email') AS email,json_extract(payload,'$.name') AS name FROM app_records WHERE entity='users' AND json_valid(payload)").all()).results;
 const completeEntries=annotateTestLogWarnings(normalizeTestLog([...rows.slice(0,5000),...ledger.slice(0,5000)],accounts).filter(e=>Number.isFinite(eventTime(e.at))&&eventTime(e.at)>=cutoff));
 const {entries,reviewHints}=visibleTestLogEntries(completeEntries,accounts);
 const actors=[...new Map(entries.filter(e=>e.actorId).map(e=>[e.actorId,{id:e.actorId,label:e.actor}])).values()].sort((a,b)=>a.label.localeCompare(b.label));
 if(entries.some(e=>!e.actorId))actors.push({id:'__unknown__',label:'Không rõ (lịch sử cũ)'});
 const menus=[...new Map(entries.map(e=>[e.entity,{id:e.entity,label:e.menu}])).values()].sort((a,b)=>a.label.localeCompare(b.label));
 return {...filterTestLog(entries,params),reviewHints,warningCount:entries.filter(e=>e.warnings?.length).length,actors,menus,truncated:ledger.length>5000||rows.length>5000||rows.some(r=>r.payload_omitted===1),coverage:'Nhật ký tổng hợp từ lịch sử đã lưu. Một số thao tác cũ chưa có lịch sử hoặc bản trước/sau; không khôi phục được thông tin chưa từng ghi nhận.',timeZone:'Asia/Ho_Chi_Minh',startsAt:testLogStartsAt,startDate:testLogStartDate};
}

// Display preference only: capture and immutable source histories are untouched.
export function visibleTestLogEntries(annotatedEntries,accounts=[]){
 const hiddenIds=new Set(['sample_user_15']);
 for(const account of accounts)if(String(account.login||'').trim().toLowerCase()==='sample_user_15')for(const value of [account.id,account.login])if(value)hiddenIds.add(String(value).trim().toLowerCase());
 const hidden=entry=>hiddenIds.has(String(entry.actorId||'').trim().toLowerCase());
 const entries=annotatedEntries.filter(entry=>!hidden(entry));
 // A hint may be attached to a hidden event. Keep it separately as a
 // record-level review hint, never attribute it to a visible editor.
 const reviewHints=annotatedEntries.filter(hidden).flatMap(entry=>(entry.warnings||[]).map(w=>({id:entry.id+':'+w.code,record:entry.record,menu:entry.menu,at:entry.at,code:w.code,evidence:w.evidence})));
 return {entries,reviewHints};
}
