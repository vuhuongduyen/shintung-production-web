import {readLaborReferences} from '../scripts/local/production-labor-reference.mjs';
import {readLaborHistory} from '../scripts/local/labor-rate-source.mjs';
import {frozenPendingReport} from '../scripts/local/production-quantity-cutover.mjs';
import {decideDailyWithdrawal} from '../scripts/local/production-warehouse-withdrawal.mjs';
import {readLegacyPreservation} from '../scripts/local/production-legacy-preservation.mjs';
import {dailyAttendanceActions} from '../lib/production-report-model.mjs';
import {reviewDailyOutput} from '../scripts/local/production-daily-review.mjs';
import {buildLaborHoursRevision,laborBusinessDate} from '../lib/labor-hours-revision.mjs';
import {isDailyOutput,dailyOutputTotals} from '../lib/production-daily-output.mjs';
import {readDailyOrderReports,readDailyOutputPolicy,quantityBaselineForOrder} from '../scripts/local/production-daily-output.mjs';
import {reviewSnapshot} from '../lib/production-review-selection.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
import {productionUnassignedReminder} from '../scripts/local/production-unassigned-alert.mjs';
import {cancelReportingDay} from './cancel-reporting-day.mjs';
import {productionReportingHold,reportingWriteBlocked} from '../lib/production-reporting-hold.mjs';
import {sheetBridge,sheetSetup} from './warehouse-sheet.mjs';
import {skuTransfer} from './sku-transfer.mjs';
import {hasMenuPermission,entityPermissionMenu,productionMenus} from '../lib/menu-action-access.mjs';
import {createProductionIncident} from './production-incidents.mjs';
import {incidentReplacementOrders} from './production-incidents.mjs';
import {changeRequests} from './change-requests.mjs';
import {confirmWarehouse,confirmSelectedWarehouse} from './warehouse-confirm.mjs';
import {warehouseBackfill} from './warehouse-backfill.mjs';
import {auditRoutes,auditMutation,clientReceipt} from './action-audit.mjs';
import {readAllocationScope,saveAllocationScope} from '../scripts/local/production-allocation-scope.mjs';
import {allocationSessionGroup,readAllocationQueue,mutateAllocationQueue} from '../scripts/local/production-allocation-queue.mjs';
import {adminReadPaths,adminReadResponse} from '../lib/admin-readonly.mjs';
import {pendingReportReview,reportReviewBlocker,reportDelayReasonError} from '../lib/production-progress-review.mjs';
import {productionHistoryImport} from '../scripts/local/production-history-import.mjs';
import {hrAttendancePermissions,withBusinessViews} from '../lib/user-permission-profiles.mjs';
import {readSkuStock} from "../lib/sku-stock.mjs";
import {feedbackApi} from '../lib/user-feedback.mjs';
import {readPermissionSetup,applyPermissionSetup} from '../scripts/local/user-permission-setup.mjs';
import {quickLinePermissions,hasQuickLineReadScope} from '../lib/user-permission-profiles.mjs';
import {importTransitHistory,restoreTransitHistoryRemovals} from '../scripts/local/transit-history-import.mjs';
import {readHrMonth,saveHrMonth} from '../lib/production-hr-storage.mjs';
import {productionActorId} from "../lib/production-actor.mjs";
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {exampleDatabase,readExampleSet,createProductionExamples,exampleReference} from '../scripts/local/production-examples.mjs';
import {vnMoment} from '../lib/production-attendance.mjs';
import {projectCancelledMaster} from '../lib/basic-master.mjs';
import {cancelBasicMaster} from '../scripts/local/basic-master.mjs';
import {mutateBom} from '../scripts/local/bom-lifecycle.mjs';
import {canBomAction} from '../lib/bom-permissions.mjs';
import {reconcileBomPdf} from '../scripts/local/bom-reconciliation.mjs';
import {mutateBomBulk} from '../scripts/local/bom-bulk.mjs';
import {readCapacity,mutateCapacity,capacityPermissions,listCapacityRequests,latestCapacityWeek,readLatestCapacity} from '../scripts/local/capacity.mjs';
import {readEmployees,saveEmployee,importEmployees} from '../scripts/local/employees.mjs';
import {passwordAuth,sessionUser,isAdminRole} from './password-auth.mjs';
import {siteCatalog,siteDemand} from '../lib/site-catalog.mjs';
import {getPlan,getPlanCapacity,getPlanCapacityDetail,mutatePlan,PlanError} from '../scripts/local/production-plan.mjs';
import {canPlanAction} from '../lib/production-plan-permissions.mjs';
import {getTransit,mutateTransit,readAdditionalCreationScope,acknowledgeAdditionalCreation} from '../scripts/local/in-transit.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {saveEngine} from '../scripts/local/engine.mjs';
import {mutateInventoryImport} from '../scripts/local/inventory-import.mjs';
import {importForecastFile} from '../scripts/local/forecast-import.mjs';
import {skuCapability,confirmSkus,requestSku} from '../scripts/local/sku-approval.mjs';
import {validateNewDemand} from '../scripts/local/demand-validation.mjs';
import {isSuperAdmin,storeFile} from '../lib/file-store.mjs';
import {usableSku} from '../lib/sku-state.mjs';
import {syncBomSources} from '../lib/bom-source.mjs';
import {siteLaborHours,siteLaborHoursHistory,laborHoursImportSummary} from '../lib/site-labor-hours.mjs';
import {recordRevision,conflictMessage} from '../lib/record-revision.mjs';
import {commitLinkedRecords} from '../scripts/local/linked-records.mjs';
import {hasBaseLeadtime} from '../lib/site-leadtime.mjs';
import {importSkuUnitsFromBom} from '../lib/sku-unit-import.mjs';
import {observeReadDatabase,workflowReadSnapshot} from './read-performance.mjs';

const entities=new Set(['users','permissions','departments','department_permissions','versions','sku','sku_history','leadtime','leadtime_versions','leadtime_audit','safety_days','safety_rules','safety_rule_groups','safety_rule_audit','labor_hours','labor_hours_history','production_engine_snapshot','inventory','warehouse_in','warehouse_out','warehouse_transfer','warehouse_docs','warehouse_count','inventory_snapshot','inventory_snapshot_audit','bom','bom_change','forecast','forecast_import_history','demand_event','production_engine','production_plan','production_plan_audit','in_transit','in_transit_audit','production_report','labor_adjustment','capacity','admin_audit']);
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function attributeChanges(value, before, email) {
 if(Array.isArray(value))return value.map((row,i)=>attributeChanges(row,Array.isArray(before)?before.find(old=>row?.id&&old?.id===row.id)||before[i]:undefined,email));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,
  (/(?:By|_by)$/.test(key)||['operator','user','actor'].includes(key)) && item!==before?.[key]
   ? email : attributeChanges(item,before?.[key],email)]));
}
export async function sitePrincipal(request,env){
 const db=env.DB,user=await sessionUser(request,env);if(!user)return null;
 if(user.authMode==='quick_line')return {login:user.login,userId:user.login,permissionLogin:user.login,name:user.name,email:null,department:'QLSX',role:'USER',isAdmin:false,isSetupAdmin:false,authMode:'quick_line',line:user.line,grants:quickLinePermissions,canReopenPlan:false};
 // Read the two applicable permission records in one fresh DB round trip.
 const department=String(user.department||'').trim();
 const permissionRows=(await db.prepare("SELECT entity,payload FROM app_records WHERE (entity='permissions' AND lower(record_key)=lower(?)) OR (entity='department_permissions' AND ?<>'' AND lower(record_key)=lower(?))").bind(user.login,department,department).all()).results;
 const personalRows=permissionRows.filter(r=>r.entity==='permissions').map(r=>JSON.parse(r.payload));
 const personal=personalRows.find(p=>!p._deleted&&p.login===user.login)||personalRows.find(p=>!p._deleted)||null;
 const departmentRows=permissionRows.filter(r=>r.entity==='department_permissions').map(r=>JSON.parse(r.payload));
 const departmentPermission=departmentRows.find(p=>!p._deleted&&p.active===true)||null;
 const permissionSource=personal&&personal.active!==true?null:personal&&personal.permissionMode!=='DEPARTMENT'?personal:departmentPermission;
 const grants=withBusinessViews(String(permissionSource?.permissions||'').split(' · ').filter(Boolean),personal?.active!==false);
 // The existing HR account was explicitly assigned attendance entry by the owner.
 if(String(user.login).toLowerCase()==='haquyen'&&personal?.active!==false)for(const grant of hrAttendancePermissions)if(!grants.includes(grant))grants.push(grant);
 const role=user.role||'USER',isAdmin=isAdminRole(role);
 return {login:user.email||user.login,email:user.email||null,name:user.name||user.login,userId:user.login,permissionLogin:user.login,department,role,isAdmin,grants,line:['A','B'].includes(String(user.line||'').toUpperCase())?String(user.line).toUpperCase():null,isSetupAdmin:user.isSetupAdmin===true,canReopenPlan:canPlanAction({login:user.login,isAdmin,grants},'reopen')};
}
const normalized=value=>String(value||'').toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ').trim();
const catalogPayload=row=>row?.payload&&typeof row.payload==='object'?row.payload:row;
const catalogGroups=catalog=>new Map(catalog.map(row=>{const payload=catalogPayload(row);return [String(payload?.code||row?.key||'').trim().toUpperCase(),String(payload?.group||'').trim()];}).filter(([sku,group])=>sku&&group));
const syncRowGroup=(row,groups)=>row&&typeof row==='object'&&!Array.isArray(row)?{...row,group:groups.get(String(row.sku||row.code||'').trim().toUpperCase())||row.group}:row;
const syncPayloadGroups=(payload,groups)=>Array.isArray(payload)?payload.map(row=>syncRowGroup(row,groups)):payload&&typeof payload==='object'&&Array.isArray(payload.rows)?{...payload,rows:payload.rows.map(row=>syncRowGroup(row,groups))}:syncRowGroup(payload,groups);
const hasGrant=(actor,label,actions=[])=>actor.isAdmin||actor.grants.some(grant=>{const value=normalized(grant);return value.includes(normalized(label))&&(!actions.length||actions.some(action=>normalized(String(grant).split('/').at(-1))===normalized(action)));});
const canWrite=(actor,label)=>!!label&&hasGrant(actor,label,['Thêm','Sửa','Xác nhận','Hủy xác nhận','Chốt','Lưu','Nhập','Cập nhật','Tạo','Xóa','Hủy']);
const entityLabel=entityPermissionMenu;
const fileModuleLabel=m=>({'base-forecast':'Kế hoạch sản xuất / Base_forecast','demand-event':'Kế hoạch sản xuất / Demand_event',warehouse:'Quản lý kho',bom:'Cấu trúc thành phẩm'}[m]);
const fileAllowed=(actor,module,write=false)=>actor.isAdmin||Boolean(fileModuleLabel(module)&&hasGrant(actor,fileModuleLabel(module),write?['Thêm','Sửa']:['Xem']));
const entityReadLabel=e=>['users','permissions','departments','department_permissions','versions','admin_audit'].includes(e)?'ADMIN':e==='sku'||e==='sku_history'?'Dữ liệu cơ bản / SKU Master':e.startsWith('leadtime')?'Dữ liệu cơ bản / Leadtime':e.startsWith('safety')?'Dữ liệu cơ bản / Quy tắc Safety Days':e.startsWith('labor_hours')?'Dữ liệu cơ bản / Giờ công':e.startsWith('warehouse')||e.startsWith('inventory')?'Quản lý kho':e.startsWith('bom')?'Cấu trúc thành phẩm':e==='forecast'||e==='forecast_import_history'?'Kế hoạch sản xuất / Base_forecast':e==='demand_event'?'Kế hoạch sản xuất / Demand_event':e.startsWith('production_engine')?'Kế hoạch sản xuất / Production_engine':e.startsWith('production_plan')?'Kế hoạch sản xuất / Production_plan':e.startsWith('in_transit')?'Kế hoạch sản xuất / In_transit':'Quản lý sản xuất';
const laborFallback=(actor,actions)=>hasGrant(actor,'Dữ liệu cơ bản / SKU Master',actions);
const canReadEntity=(actor,entity)=>{if(entity==='capacity')return capacityPermissions(actor).view;const label=entityReadLabel(entity);if(label==='ADMIN')return actor.isAdmin;if(entity.startsWith('labor_hours'))return hasGrant(actor,label,['Xem'])||laborFallback(actor,['Xem']);return hasGrant(actor,label,['Xem']);};
const approvalDefinitions={
 sku:{label:'SKU Master',view:'sku',child:'sku-master'},
 bom:{label:'BOM mới',view:'bom',child:'bom-data'},
 bom_change:{label:'Phiếu thay đổi BOM',view:'bom',child:'bom-change'},
 leadtime_versions:{label:'Lead Time',view:'sku',child:'leadtime'},
 safety_rules:{label:'Quy tắc Safety Days',view:'sku',child:'safety-days'},
 safety_rule_groups:{label:'Bộ quy tắc Safety Days',view:'sku',child:'safety-days'},
 warehouse_in:{label:'Phiếu nhập kho',view:'warehouse',child:'warehouse-in'},
 warehouse_out:{label:'Phiếu xuất kho',view:'warehouse',child:'warehouse-out'},
 warehouse_transfer:{label:'Phiếu chuyển kho',view:'warehouse',child:'warehouse-transfer'},
 warehouse_docs:{label:'Chứng từ kho',view:'warehouse',child:'warehouse-docs'},
 warehouse_count:{label:'Phiếu kiểm kê',view:'warehouse',child:'warehouse-count'},
};
const approvalStatus=payload=>String(payload?.confirmation_status||payload?.confirmationStatus||payload?.status||'').trim();
export async function siteApi(request,env){
 const path=new URL(request.url).pathname;
 if(request.method!=='GET'||!path.startsWith('/api/')){
  const timing=['/api/production-workflow','/api/production-report','/api/production-correction'].includes(path)?observeReadDatabase(env.DB):null;
  const scoped=timing?{...env,DB:timing.database}:env;
  const run=async()=>{
   if(auditRoutes.has(path)&&['POST','PUT','PATCH','DELETE'].includes(request.method)&&request.headers.get('origin')===new URL(request.url).origin){const actor=await sitePrincipal(request,scoped);if(actor)return auditMutation({request,env:scoped,actor,run:()=>handleSiteApi(request,scoped,timing)});}
   return handleSiteApi(request,scoped,timing);
  };
  const response=await run();
  if(timing&&response){const stats=timing.summary();response.headers.set('Server-Timing',`total;dur=${stats.totalMs.toFixed(1)}, db_sum;dur=${stats.dbMs.toFixed(1)}, db_max;dur=${stats.maxDbMs.toFixed(1)}, db_calls;desc="${stats.calls}"`);if(stats.totalMs>=2000)console.info('ONSPA slow write',JSON.stringify({route:path,status:response.status,...Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,Math.round(value)]))}));}
  return response;
 }
 const timing=observeReadDatabase(env.DB);
 const response=await handleSiteApi(request,{...env,DB:timing.database},timing);
 if(!response)return response;
 const stats=timing.summary();
 response.headers.set('Server-Timing',`total;dur=${stats.totalMs.toFixed(1)}, auth;dur=${stats.authMs.toFixed(1)}, principal;dur=${stats.principalMs.toFixed(1)}, handler;dur=${stats.handlerMs.toFixed(1)}, db_sum;dur=${stats.dbMs.toFixed(1)}, db_max;dur=${stats.maxDbMs.toFixed(1)}, db_calls;desc="${stats.calls}"`);
 if(stats.totalMs>=2000){
  // Fixed route labels only: no query strings, entities, identities or payloads.
  const route=['/api/site-session','/api/auth/session','/api/pending-approvals','/api/production-allocation','/api/production-allocation-scope','/api/production-workflow','/api/records','/api/production-plan','/api/in-transit','/api/capacity','/api/employees'].includes(path)?path:'other';
  console.info('ONSPA slow read',JSON.stringify({route,status:response.status,...Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,Math.round(value)]))}));
 }
 return response;
}
async function handleSiteApi(request,env,timing){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/'))return null;
 if(path.startsWith('/api/test-'))return json({error:'API TEST không khả dụng trên Site.'},410);
 try{
  if(!env.DB?.prepare||!env.FILES?.put)return json({error:'Thiếu binding DB hoặc FILES.'},503);
  if(path==='/api/warehouse-sheet/bridge')return await sheetBridge(request,env);
  const auth=await(timing?timing.measure(()=>passwordAuth(request,env),'authMs'):passwordAuth(request,env));if(auth)return auth;
  const actor=await(timing?timing.measure(()=>sitePrincipal(request,env),'principalMs'):sitePrincipal(request,env));
  if(path==='/api/site-session')return json({environment:'SITE',authenticated:!!actor,user:actor?{authMode:actor.authMode||'password',id:actor.userId,login:actor.permissionLogin,email:actor.email,name:actor.name,role:actor.role,isAdmin:actor.isAdmin,line:actor.line,allocationGroup:await allocationSessionGroup(env.DB,actor),grants:actor.grants,isSetupAdmin:actor.isSetupAdmin,setupAdminExpiresAt:actor.isSetupAdmin?env.SETUP_ADMIN_EXPIRES_AT:null}:null});
  if(path==='/api/storage-capability')return json({allowed:!!actor&&await isSuperAdmin(env.DB,actor)});
  if(!actor)return json({error:'Vui lòng đăng nhập ONSPA.'},401);
  if(path==='/api/warehouse-sheet/setup')return await sheetSetup(request,env,actor);
  if(path==='/api/change-requests'&&request.method==='GET')return json(url.searchParams.has('incidentId')?await incidentReplacementOrders(env.DB,actor,url.searchParams.get('incidentId')):await changeRequests(env.DB,actor));
  if(path==='/api/action-audit')return clientReceipt(request,env,actor);
  const feedback=await feedbackApi(request,env,actor);if(feedback)return feedback;
  if(adminReadPaths.has(path)){
   const authorized=await isSuperAdmin(env.DB,actor);
   const result=await adminReadResponse({path,method:request.method,authorized,db:env.DB,searchParams:url.searchParams});
   return json(result.body,result.status);
  }
  if(actor.authMode==='quick_line'&&path!=='/api/production-workflow'&&!(request.method==='GET'&&['/api/capacity','/api/production-hr-hours','/api/production-standards'].includes(path)))return json({error:'User Line chỉ được xem Quản lý sản xuất và báo công tại Line của mình.'},403);
  if(path==='/api/production-allocation-scope'){
   if(request.method==='GET')return json(await readAllocationScope(env.DB,actor));
   if(request.method!=='POST')return json({error:'Phương thức không hợp lệ'},405);
   if(request.headers.get('origin')!==url.origin)return json({error:'Origin không hợp lệ'},403);
   return json(await saveAllocationScope(env.DB,await request.json(),actor));
  }
  if(path==='/api/production-allocation'){
   if(request.method==='GET')return json(await readAllocationQueue(env.DB,actor));
   if(request.method!=='POST')return json({error:'Phương thức không hợp lệ'},405);
   if(request.headers.get('origin')!==url.origin)return json({error:'Origin không hợp lệ'},403);
   return json(await mutateAllocationQueue(env.DB,await request.json(),actor));
  }
  if(path==='/api/user-permission-setup'){if(request.method==='GET')return json(await readPermissionSetup(env.DB,actor));if(request.method!=='POST')return json({error:'Phương thức không hợp lệ'},405);if(request.headers.get('origin')!==url.origin)return json({error:'Origin không hợp lệ'},403);return json(await applyPermissionSetup(env.DB,await request.json(),actor));}
  if(path==='/api/production-standards'&&request.method==='GET'){
   if(!hasGrant(actor,'Quản lý sản xuất',['Xem']))return json({error:'Không có quyền xem giờ công sản xuất.'},403);
   const rows=(await env.DB.prepare("SELECT record_key,payload,updated_at FROM app_records WHERE entity='labor_hours'").all()).results;
   const allowedSkus=hasQuickLineReadScope(actor)?new Set((await readProductionWorkflow(env.DB,actor)).orders.map(row=>row.sku)):null;
   return json({records:siteLaborHours(rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedAt:r.updated_at})),laborBusinessDate(),await readLaborHistory(env.DB)).filter(r=>!allowedSkus||allowedSkus.has(r.payload.sku||r.key)).map(r=>({key:r.key,payload:{sku:r.payload.sku,laborHour:r.payload.laborHour,cancelled:r.payload.cancelled,status:r.payload.status,_deleted:r.payload._deleted}}))});
  }
  if(path==='/api/production-hr-hours'){
   const hrExample=url.searchParams.get('examples')==='1';
   if(request.method==='GET')return json(await readHrMonth(env.DB,url.searchParams.get('month'),actor,hrExample));
   if(request.method!=='POST')return json({error:'Phương thức không hợp lệ'},405);
   if(request.headers.get('origin')!==url.origin)return json({error:'Origin không hợp lệ'},403);
   return json(await saveHrMonth(env.DB,env.FILES,await request.json(),actor,hrExample));
  }
  if(path==='/api/system/r2-healthcheck')return json({ok:true,binding:'FILES',configured:true,mode:'read-only',listed:(await env.FILES.list({limit:1})).objects.length});
  const examples=url.searchParams.get('examples')==='1';
  const exampleRoute=['/api/production-workflow','/api/production-report','/api/production-correction','/api/production-examples'].includes(path);
  if(examples&&!exampleRoute)return json({error:'Chế độ mẫu chỉ áp dụng cho báo công, lịch thực tế và nhật ký.'},400);
  if((examples||path==='/api/production-examples')&&(!actor.isAdmin||actor.line))return json({error:'Chỉ admin không giới hạn Line được dùng LSX mẫu.'},403);
  if(examples||path==='/api/production-examples')return json({error:'Đã ngừng dữ liệu mẫu trong Quản lý sản xuất. Hãy tải lại để xem dữ liệu thực tế.'},410);
  const productionDb=examples?exampleDatabase(env.DB):env.DB;
  let catalogPromise;
  const loadCatalog=()=>examples?Promise.resolve([]):catalogPromise||=readRecordPages(env.DB,{where:"entity='sku'"}).then(result=>Promise.all(result.map(async r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:await recordRevision(r.payload)}))).then(siteCatalog));
  if(path==='/api/sku-capabilities')return json({canConfirm:await skuCapability(env.DB,actor)});
  if(path==='/api/pending-approvals'&&request.method==='GET'){
   const monitored=Object.keys(approvalDefinitions).filter(entity=>canReadEntity(actor,entity));
   if(!monitored.length)return json({total:0,groups:[],storedBomChangeStatuses:{}});
   const placeholders=monitored.map(()=>'?').join(',');
   const rows=(await env.DB.prepare(`SELECT entity,record_key,payload,updated_at FROM app_records WHERE entity IN (${placeholders}) ORDER BY updated_at DESC`).bind(...monitored).all()).results;
   const groups=new Map(),storedBomChangeStatuses={};
   for(const row of rows){
    const payload=JSON.parse(row.payload);if(payload?._deleted)continue;
    const status=approvalStatus(payload);
    if(row.entity==='bom_change')storedBomChangeStatuses[row.record_key]=status;
    if(status!=='Chờ xác nhận')continue;
    const definition=approvalDefinitions[row.entity],current=groups.get(row.entity)||{entity:row.entity,...definition,count:0,records:[]};
    current.count+=1;if(current.records.length<5)current.records.push({key:row.record_key,updatedAt:row.updated_at});groups.set(row.entity,current);
   }
   const values=[...groups.values()];
   return json({total:values.reduce((sum,item)=>sum+item.count,0),groups:values,storedBomChangeStatuses});
  }
  if(path==='/api/active-viewers'){
   const now=new Date().toISOString(),cutoff=new Date(Date.now()-2*60*1000).toISOString();
   if(request.method==='POST'){
    const payload={login:actor.login,name:actor.name||actor.login,department:actor.department||'',role:actor.role||'USER',lastSeenAt:now};
    await env.DB.batch([
     env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind('active_viewer',actor.userId,JSON.stringify(payload),actor.login,now),
     env.DB.prepare("DELETE FROM app_records WHERE entity='active_viewer' AND updated_at<?").bind(new Date(Date.now()-24*60*60*1000).toISOString())
    ]);
   }else if(request.method!=='GET')return json({error:'Phương thức không hợp lệ'},405);
   const rows=(await env.DB.prepare("SELECT payload,updated_at FROM app_records WHERE entity='active_viewer' AND updated_at>=? ORDER BY updated_at DESC").bind(cutoff).all()).results;
   return json({viewers:rows.map(row=>({...JSON.parse(row.payload),lastSeenAt:row.updated_at}))});
  }
  if(path==='/api/capacity'&&request.method==='GET')return json(url.searchParams.get('requests')==='1'?{requests:await listCapacityRequests(env.DB,actor)}:url.searchParams.get('bootstrap')==='1'?await readLatestCapacity(env.DB,actor):url.searchParams.get('latest')==='1'?{week:await latestCapacityWeek(env.DB,actor)}:await readCapacity(env.DB,url.searchParams.get('week'),actor));
  if(path==='/api/employees'&&request.method==='GET')return json(await readEmployees(env.DB,actor));
  if(path==='/api/production-plan'&&request.method==='GET'){if(!hasGrant(actor,'Kế hoạch sản xuất / Production_plan',['Xem']))return json({error:'Không có quyền xem kế hoạch'},403);return json(url.searchParams.get('capacityDetail')==='1'?await getPlanCapacityDetail(env.DB,url.searchParams.get('week'),url.searchParams.get('line')):url.searchParams.get('capacityOnly')==='1'?{capacity:await getPlanCapacity(env.DB,url.searchParams.get('week'))}:await getPlan(env.DB,url.searchParams.get('week'),actor.canReopenPlan,await loadCatalog()));}
  if(path==='/api/in-transit'&&request.method==='GET'){if(url.searchParams.get('creationRecovery')==='1'){if(!canWrite(actor,'In Transit')&&!canWrite(actor,'In_transit'))return json({error:'Không có quyền cập nhật In Transit'},403);return json(await readAdditionalCreationScope(env.DB,actor));}if(!hasGrant(actor,'Kế hoạch sản xuất / In_transit',['Xem']))return json({error:'Không có quyền xem In Transit'},403);const activation=await readDailyOutputPolicy(env.DB);if(activation.policy?.cutoverReached&&!activation.policy.active)return json({error:activation.policy.blockedReason,dailyOutputPolicy:activation.policy},503);const preservation=await readLegacyPreservation(env.DB,activation.policy,actor,{full:false});return json(await getTransit(env.DB,Object.fromEntries(url.searchParams),await loadCatalog(),{preservedOrders:preservation?.orders}));}
  if(path==='/api/production-workflow'&&request.method==='GET'){
   const activation=await readDailyOutputPolicy(productionDb);
   if(activation.policy?.cutoverReached&&!activation.policy.active)return json({error:activation.policy.blockedReason,dailyOutputPolicy:activation.policy},503);
   const catalogRead=loadCatalog();
   const legacyPreservation=await readLegacyPreservation(productionDb,activation.policy,actor,{full:url.searchParams.get('view')!=='work'});
   const workflow=await readProductionWorkflow(workflowReadSnapshot(productionDb),actor,await catalogRead,{legacyPreservation,includeJournalHours:url.searchParams.get('unassignedAlerts')!=='1'&&url.searchParams.get('view')!=='work',includeDerivedHours:!activation.policy?.active&&url.searchParams.get('unassignedAlerts')!=='1'&&url.searchParams.get('view')!=='work',stageValidation:url.searchParams.get('view')==='work'});
   if(url.searchParams.get('unassignedAlerts')==='1'){if(productionReportingHold(url.hostname))return json({rows:[],serverNow:Date.now()});return json(await productionUnassignedReminder(productionDb,actor,workflow));}
   return json({...await readLaborReferences(productionDb,workflow,env.LABOR_RATE_OMISSIONS_JSON,env.LABOR_RATE_SNAPSHOT_ID),...(activation.policy?{dailyOutputPolicy:activation.policy}:{}),reportingHold:productionReportingHold(url.hostname),canCancelReportingDay:actor.isAdmin&&!actor.line,rights:{...workflow.rights,examples:actor.isAdmin&&!actor.line},examples:examples?await readExampleSet(productionDb):null});
  }
  if(path==='/api/records'&&request.method==='GET'){
   const entity=url.searchParams.get('entity');if(!entities.has(entity))return json({error:'Hạng mục không hợp lệ'},400);
   if(entity==='production_report')return json({error:'Xem báo công qua API có giới hạn quyền theo Line.'},409);
   if(!canReadEntity(actor,entity))return json({error:'Không có quyền xem dữ liệu này.'},403);
   if(entity==='sku'&&url.searchParams.has('stock'))return json(await readSkuStock(env.DB,url.searchParams.get('stock')));
   if(entity==='sku'&&url.searchParams.get('summary')==='pending'){
    const row=await env.DB.prepare("SELECT count(*) AS count FROM app_records WHERE entity='sku' AND json_extract(payload,'$.status')='Chờ xác nhận'").first();
    return json({pending:Number(row?.count||0)});
   }
   if(entity==='sku_history'&&url.searchParams.get('sku')){
    const sku=String(url.searchParams.get('sku')).trim().toUpperCase();
    const rows=(await env.DB.prepare("SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity='sku_history' AND upper(json_extract(payload,'$.sku'))=? ORDER BY updated_at DESC LIMIT 100").bind(sku).all()).results;
    return json({records:rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at}))});
   }
   if(entity==='sku'&&url.searchParams.get('view')!=='stored')return json({records:await loadCatalog()});
   const rows=await Promise.all((await env.DB.prepare('SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at DESC').bind(entity).all()).results.map(async r=>({...r,revision:await recordRevision(r.payload)})));
   if(entity==='labor_hours')return json({records:siteLaborHours(rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at})),laborBusinessDate(),await readLaborHistory(env.DB)),importSummary:laborHoursImportSummary});
   if(entity==='labor_hours_history')return json({records:siteLaborHoursHistory(rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at})),url.searchParams.get('sku')||'')});
   if(url.searchParams.get('view')==='stored'){if(!await isSuperAdmin(env.DB,actor))return json({error:'Forbidden'},403);return json({records:rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at}))});}
   if(entity==='demand_event')return json({records:siteDemand(rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision})))});
   if(entity==='warehouse_in'){
    const linked=(await env.DB.prepare("SELECT w.record_key,CASE WHEN json_extract(p.payload,'$.reportingModel')='daily-finished-v1' AND json_extract(p.payload,'$.quantityOnly')=1 THEN json_extract(p.payload,'$.productionDate') ELSE json_extract(p.payload,'$.completedAt') END AS completed_at FROM app_records w LEFT JOIN app_records p ON p.entity='production_report' AND p.record_key=json_extract(w.payload,'$.reportId') AND coalesce(json_extract(p.payload,'$._deleted'),0)=0 WHERE w.entity='warehouse_in'").all()).results;
    const completed=new Map(linked.map(r=>[r.record_key,r.completed_at]));
    let reconciliation;
    if(actor.isAdmin&&url.searchParams.get('audit')==='1'){
     const workflow=await readProductionWorkflow(workflowReadSnapshot(productionDb),actor,await loadCatalog());
     const receipts=rows.map(r=>JSON.parse(r.payload)).filter(r=>!r._deleted);
     const ids=new Set(receipts.map(r=>r.reportId));
     const outputs=workflow.reports.filter(r=>r.kind==='completion'&&!r.cancelled&&!r.voided&&!r._deleted);
     const approved=outputs.filter(r=>r.reviewStatus==='Đã xác nhận'&&Number(r.approvedQuantity??r.reportedQuantity??0)>0);
     const missing=approved.filter(r=>!ids.has(r.id)).map(r=>({reportId:r.id,lsxCode:r.lsxCode,sku:r.sku,completedAt:isDailyOutput(r)?r.productionDate:r.completedAt,...(isDailyOutput(r)?{productionDate:r.productionDate}:{}),quantity:r.approvedQuantity??r.reportedQuantity,warehouseStatus:r.warehouseStatus||'Chưa tạo phiếu'}));
     reconciliation={approved:approved.length,receipts:receipts.length,pending:outputs.filter(r=>pendingReportReview(r)).length,missing};
    }

    return json({reconciliation,records:rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),sourceCompletedAt:completed.get(r.record_key)||null,updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision}))});
   }
   if(entity==='leadtime')return json({records:rows.map(r=>({key:r.record_key,payload:projectCancelledMaster('leadtime',JSON.parse(r.payload)),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision}))});
   if(entity==='bom'){const masters=(await loadCatalog()).map(row=>row.payload);return json({records:rows.map(r=>({key:r.record_key,payload:syncBomSources(JSON.parse(r.payload),masters),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision}))});}
   if(['forecast','production_engine','in_transit'].includes(entity)){
    const groups=catalogGroups(await loadCatalog());
    return json({records:rows.map(r=>({key:r.record_key,payload:syncPayloadGroups(JSON.parse(r.payload),groups),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision}))});
   }
   return json({records:rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:r.revision}))});
  }
  if(path.startsWith('/api/storage')){
   if(!actor.isAdmin&&!['base-forecast','demand-event','warehouse','bom'].some(m=>fileAllowed(actor,m)))return json({error:'Không có quyền truy cập tệp.'},403);
   if(path==='/api/storage'&&request.method==='GET'){
    const counts=(await env.DB.prepare('SELECT entity,count(*) AS count FROM app_records GROUP BY entity').all()).results;
    const files=(await env.DB.prepare('SELECT * FROM file_objects ORDER BY uploaded_at DESC').all()).results;
    if(!actor.isAdmin){const scoped=files.filter(f=>fileAllowed(actor,f.module));return json({environment:'SITE',files:scoped,fileCount:scoped.length,backupAvailable:false});}
    return json({environment:'SITE',recordCount:counts.reduce((n,r)=>n+r.count,0),entities:counts,files,fileCount:files.length,fileSize:files.reduce((n,r)=>n+r.size,0),latest:(await env.DB.prepare('SELECT max(updated_at) AS latest FROM app_records').first()).latest,problems:[],history:[],backupAvailable:false});
   }
   if(path==='/api/storage-download'&&request.method==='GET'){
    if(url.searchParams.get('type')==='backup')return json({error:'Backup Worker chưa được triển khai.'},501);
    const row=await env.DB.prepare('SELECT * FROM file_objects WHERE file_id=?').bind(url.searchParams.get('id')).first();if(!row)return json({error:'Không tìm thấy metadata tệp'},404);
    if(!fileAllowed(actor,row.module))return json({error:'Không có quyền xem tệp này.'},403);
    const object=await env.FILES.get(row.object_key);if(!object)return json({error:'Không tìm thấy tệp'},404);
    return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Yêu cầu JSON cùng origin.'},403);
  const text=await request.text();if(text.length>8_000_000)return json({error:'Payload quá lớn'},413);const body=JSON.parse(text);
  const reportingHold=productionReportingHold(url.hostname);
  if(reportingHold&&reportingWriteBlocked(path,body))return json({error:reportingHold.message,code:'PRODUCTION_REPORTING_PAUSED',reportingHold},423);
  if(path==='/api/change-requests')return json(await changeRequests(env.DB,actor,body));
  if(path==='/api/bom-pdf-reconciliation')return json(await reconcileBomPdf(env.DB,body,actor));
  if(['/api/bom-bulk','/api/bom-change','/api/bom'].includes(path)){if(!canBomAction(actor,body.action,body.expectedRevision!=null,path==='/api/bom'?'Dữ liệu lượng dùng BOM':'Phiếu thay đổi BOM'))return json({error:'Không có quyền thực hiện thao tác BOM này.'},403);const catalog=await loadCatalog();return json(path==='/api/bom'?await mutateBom(env.DB,body,actor,catalog):await mutateBomBulk(env.DB,{...body,single:path==='/api/bom-change'},actor,catalog));}
  if(path==='/api/linked-records'&&body.kind==='bom-change')return json({error:'Sử dụng chức năng xác nhận/hủy phiếu BOM để lưu lịch sử và khôi phục.'},409);
  if(path==='/api/linked-records')return json(await commitLinkedRecords(env.DB,body,actor,{authorize:entity=>hasMenuPermission(actor,entityLabel(entity),['Thêm','Sửa','Xác nhận','Hủy xác nhận','Hủy','Xóa','Lưu']),transform:attributeChanges,catalog:await loadCatalog()}));
  if(path==='/api/sku-transfer')return json(await skuTransfer(env.DB,actor,body,await loadCatalog(),false));
  if(path==='/api/basic-master-cancel')return json(await cancelBasicMaster(env.DB,body,actor));
  if(path==='/api/labor-hours'){
   const canManage=canWrite(actor,'Dữ liệu cơ bản / Giờ công')||canWrite(actor,'Dữ liệu cơ bản / SKU Master');
   if(!canManage)return json({error:'Không có quyền cập nhật Giờ công.'},403);
   const sku=String(body.sku||'').trim().toUpperCase(),value=Number(body.laborHour),mode=body.mode==='edit'?'edit':'create',reason=String(body.reason||'').trim(),note=String(body.note||'').trim(),source=body.source==='PDF'?'PDF':'Nhập trực tiếp';
   if(!sku||!['number','string'].includes(typeof body.laborHour)||String(body.laborHour).trim()===''||!Number.isFinite(value)||value<0)return json({error:'SKU hoặc Giờ công/SP không hợp lệ.'},400);
   if(mode==='edit'&&!reason)return json({error:'Vui lòng nhập lý do thay đổi.'},400);
   const catalog=await loadCatalog(),master=catalog.find(row=>String(row.key).toUpperCase()===sku&&usableSku(row.payload));if(!master)return json({error:'SKU không tồn tại hoặc chưa được xác nhận trong SKU Master.'},409);
   const saved=await env.DB.prepare("SELECT payload FROM app_records WHERE entity='labor_hours' AND record_key=?").bind(sku).first();
   const base=siteLaborHours([]).find(row=>row.key===sku)?.payload||null,old=saved?JSON.parse(saved.payload):base;
   if(mode==='create'&&old)return json({error:'SKU đã có Giờ công/SP đang hiệu lực.'},409);
   if(old?.cancelled)return json({error:'Giờ công đã Hủy, không được sửa để tự áp dụng lại.'},409);
   if(mode==='edit'&&!old)return json({error:'SKU chưa có Giờ công/SP để sửa.'},409);
   if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==Number(old?.version||0))
    return json({error:conflictMessage,current:old,updatedBy:old?.updatedBy||null,updatedAt:old?.updatedAt||null},409);
   const now=new Date().toISOString();let current,history;
   try{({current,history}=buildLaborHoursRevision({old,sku,value,effectiveFrom:body.effectiveFrom,note,source,reason,actor:actor.login,now,mode}));}catch(e){return json({error:e.message},e.status||409);}
   const write=saved
    ?env.DB.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=?').bind(JSON.stringify(current),actor.login,now,'labor_hours',sku,saved.payload)
    :env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind('labor_hours',sku,JSON.stringify(current),actor.login,now);
   const result=await env.DB.batch([
    write,
    env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE changes()=1').bind('labor_hours_history',history.id,JSON.stringify(history),actor.login,now),
    env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({entity:'labor_hours',key:sku,before:old,after:current,actor:actor.login,at:now}),actor.login,now,'labor_hours',sku,JSON.stringify(current))
   ]);
   if(result[0].meta.changes!==1)return json({error:conflictMessage},409);
   return json({ok:true,payload:current,history});
  }
  if(path==='/api/sku-unit-import'){
   if(!actor.isAdmin)return json({error:'Chỉ Admin được nhập Đơn vị tính từ PDF BOM.'},403);
   return json(await importSkuUnitsFromBom(env.DB,body,actor.login,await loadCatalog()));
  }
  if(path==='/api/storage-upload'){if(!fileAllowed(actor,body.module,true))return json({error:'Không có quyền tải tệp trong nghiệp vụ này.'},403);return json({file:await storeFile(env.DB,env.FILES,body,actor.userId||actor.login)});}
  if(path==='/api/forecast-import'){
   if(!canWrite(actor,'Kế hoạch sản xuất / Base_forecast'))return json({error:'Không có quyền nhập Forecast PDF.'},403);
   return json(await importForecastFile(env.DB,body,actor));
  }
  if(path==='/api/inventory-import'){
   if(!hasMenuPermission(actor,'Quản lý kho / Tồn kho ERP',['Thêm','Sửa','Xác nhận','Hủy xác nhận']))return json({error:'Không có quyền tải, hủy hoặc chốt tồn ERP.'},403);
   return json(await mutateInventoryImport(env.DB,body,actor));
  }
  if(path==='/api/storage-export')return json({error:'Chức năng xuất ZIP Worker chưa hoàn tất; không sử dụng backup node:fs trên Site.'},501);
  if(path==='/api/capacity')return json(await mutateCapacity(env.DB,body,actor));
  if(path==='/api/employees')return json(body?.action==='import'?await importEmployees(env.DB,body,actor):await saveEmployee(env.DB,body,actor));
  if(path==='/api/production-plan'){
   const allowed=['save','close','reopen','split'].includes(body.action)?canPlanAction(actor,body.action==='split'?'save':body.action):canWrite(actor,'Production Plan');
   if(!allowed)return json({error:body.action==='close'?'Không có quyền xác nhận kế hoạch':body.action==='reopen'?'Không có quyền hủy xác nhận kế hoạch':'Không có quyền sửa kế hoạch'},403);
   return json(await mutatePlan(env.DB,body,{...actor,catalog:await loadCatalog(),canEditPlan:canPlanAction(actor,'save')}));
  }
  if(path==='/api/in-transit'){const transitAction=typeof body.action==='string'?body.action.trim():'';if(!canWrite(actor,'In Transit')&&!canWrite(actor,'In_transit'))return json({error:'Không có quyền cập nhật In Transit'},403);if(transitAction==='ack-add-lsx')return json(await acknowledgeAdditionalCreation(env.DB,body,actor));if(transitAction==='add-lsx'&&(!Object.hasOwn(body,'expectedCreationRevision')||typeof body.requestIdempotency!=='string'))return json({error:'Lượt tạo LSX chưa có mã chống trùng. Vui lòng tải lại giao diện trước khi thử.'},422);return json(await (body.action==='restore-history-removals'?restoreTransitHistoryRemovals(env.DB,body,actor):body.action==='import-history'?importTransitHistory(env.DB,body,actor,await loadCatalog()):mutateTransit(env.DB,body,actor,await loadCatalog())));}
  if(path==='/api/production-examples'){if(body.action!=='create')return json({error:'Chọn tạo bộ LSX mẫu.'},400);const skuRows=(await env.DB.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));
   const reference=await exampleReference(env.DB,siteCatalog(skuRows));return json(await createProductionExamples(exampleDatabase(env.DB),actor,new Date(),reference));}
  if(path==='/api/production-history-import'){if((await readDailyOutputPolicy(productionDb)).policy?.cutoverReached)return json({error:'Lịch sử công đoạn đã khóa tại mốc chuyển đổi; không nhập đè dữ liệu cũ.'},409);return json(await productionHistoryImport(productionDb,body,actor,await loadCatalog()));}
  if(path==='/api/production-workflow'&&body.action==='unassigned-reminder'){if(reportingHold)return json({rows:[],serverNow:Date.now()});return json(await productionUnassignedReminder(productionDb,actor,await readProductionWorkflow(productionDb,actor,await loadCatalog(),{includeDerivedHours:false}),body.reminder));}
  if(path==='/api/production-workflow'&&body.action==='incident-create')return json(await createProductionIncident(productionDb,actor,body,await readProductionWorkflow(productionDb,actor,await loadCatalog())));
  if(path==='/api/production-workflow'){const quantityOnly=body.action==='daily-output',attendanceOnly=dailyAttendanceActions.has(body.action)&&(await readDailyOutputPolicy(productionDb)).policy?.active;return json(await mutateProductionWorkflow(productionDb,body,actor,quantityOnly||attendanceOnly?[]:await loadCatalog()));}
  if(path==='/api/warehouse-confirm')return json(await (String(body.action||'').startsWith('withdrawal-')?decideDailyWithdrawal(env.DB,body,actor):confirmSelectedWarehouse(env.DB,body,actor)));
  if(path==='/api/warehouse-backfill')return json(await (String(body.action).startsWith('confirm')?confirmWarehouse(env.DB,body,actor):warehouseBackfill(env.DB,body,actor)));
  if(path==='/api/production-correction'){if(body.operation==='cancel-reporting-day'&&(await readDailyOutputPolicy(productionDb)).policy?.cutoverReached)return json({error:'Lịch sử công đoạn chỉ để tra cứu; không hủy ngày báo công cũ sau chuyển đổi.'},409);return json(body.operation==='cancel-reporting-day'?await cancelReportingDay(productionDb,body,actor,url.hostname):await correctProduction(productionDb,body,actor,['daily-output-edit','daily-output-cancel','daily-output-withdraw'].includes(body.operation)?[]:await loadCatalog()));}
  if(path==='/api/production-report'){
   if(!actor.isAdmin&&!hasMenuPermission(actor,productionMenus.progress,['Xác nhận']))return json({error:'Chỉ QLSX được duyệt báo công.'},403);
   if(body.action!=='review'||!body.reportId)return json({error:'Yêu cầu kiểm tra báo công không hợp lệ.'},400);
   const reviewReads=workflowReadSnapshot(productionDb);
   const [cursorBefore,stored]=await Promise.all([
    productionDb.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first(),
    productionDb.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(String(body.reportId)).first(),
   ]);
   const reviewPolicyState=await readDailyOutputPolicy(productionDb);
   let historySource=null,workflow=null;
   if(!stored){
    const batches=(await productionDb.prepare("SELECT record_key,payload FROM app_records WHERE entity='production_history_import'").all()).results;
    historySource=batches.find(b=>(JSON.parse(b.payload).reports||[]).some(r=>r.id===body.reportId));
    if(!historySource)return json({error:'Không tìm thấy báo công cần kiểm tra.'},404);
    workflow=await readProductionWorkflow(reviewReads,actor,await loadCatalog(),{reviewReportId:String(body.reportId),includeDerivedHours:reviewPolicyState.policy?.intakeModel!=='server-receipt-quantity-v1'});
   }
   const report=stored?JSON.parse(stored.payload):workflow.reports.find(r=>r.id===body.reportId);
   if(!report)return json({error:'Không có quyền xem báo công này.'},403);
   if(body.expectedVersion!==undefined&&Number(body.expectedVersion)!==Number(report.version||0))return json({error:'Báo công đã thay đổi. Vui lòng cập nhật dữ liệu và kiểm tra lại.'},409);
   if(actor.line&&actor.line!==report.line)return json({error:'Không được duyệt báo công của Line khác.'},403);
   if(!pendingReportReview(report))return json({error:'Báo công này đã được xử lý trước đó.'},409);
   if(isDailyOutput(report)&&stored)return json(await reviewDailyOutput(productionDb,body,actor,{stored,cursorBefore}));
   const reviewPolicy=reviewPolicyState.policy;
   const receiptLegacy=reviewPolicy?.intakeModel==='server-receipt-quantity-v1'&&await frozenPendingReport(productionDb,reviewPolicy,String(body.reportId));
   if(reviewPolicy?.cutoverReached&&!receiptLegacy)return json({error:'Chỉ duyệt phiếu cũ đang chờ trong tập dữ liệu đã chốt.'},409);
   if(receiptLegacy&&body.expectedVersion===undefined)return json({error:'Thiếu phiên bản phiếu cũ cần kiểm tra.'},409);
   if(receiptLegacy)report.id=String(body.reportId); // Frozen storage key is the canonical legacy identity.
   // One request-scoped, byte-bounded read per entity, shared with workflow/transit.
   // Independent reads overlap; the original cursor and payload guards still fence the commit.
   const [eventRecords,reviewRecords,transitStored,reviewWorkflow]=await Promise.all([
    readRecordPages(reviewReads,{where:'entity=?',args:['production_event']}),
    readRecordPages(reviewReads,{where:'entity=?',args:['production_report']}),
    report.transitId?productionDb.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(String(report.transitId)).first():null,
    workflow||loadCatalog().then(catalog=>readProductionWorkflow(reviewReads,actor,catalog,{reviewReportId:String(body.reportId),includeDerivedHours:!receiptLegacy})),
   ]);
   workflow=reviewWorkflow;
   const binary=(a,b)=>a<b?-1:a>b?1:0;
   const adjustmentRows=eventRecords.sort((a,b)=>binary(a.updated_at,b.updated_at)||binary(a.record_key,b.record_key)).map(row=>JSON.parse(row.payload)).filter(e=>!e.voided);
   if(!isDailyOutput(report)&&adjustmentRows.some(event=>event.kind==='absence'&&event.approved===false&&event.sourceId===report.transitId&&
    Date.parse(event.effectiveAt)<Date.parse(report.completedAt)&&Date.parse(event.endsAt)>Date.parse(report.startedAt)&&
    !adjustmentRows.some(next=>next.approvedFrom===event.id)))return json({error:'Có điều chỉnh giờ đang chờ QLSX duyệt; xử lý trước khi xác nhận báo công.'},409);
   const adjustedHours=isDailyOutput(report)?null:adjustmentRows.filter(event=>event.kind==='hours-adjustment'&&(!report.correctedAt||event.recordedAt>report.correctedAt)).flatMap(event=>event.changes||[]).filter(change=>change.reportId===body.reportId).at(-1)?.after;
   const approve=body.approve===true,reason=String(body.reason||'').trim();
   if(!approve&&!reason)return json({error:'Vui lòng nhập lý do từ chối.'},422);
   const reportRows=reviewRecords.map(row=>({key:row.record_key,payload:JSON.parse(row.payload)}));
   const dailyContext=(isDailyOutput(report)||receiptLegacy)&&transitStored?await readDailyOrderReports(productionDb,{...JSON.parse(transitStored.payload),id:report.transitId}):null;
   const reviewQuantityBaseline=receiptLegacy?await quantityBaselineForOrder(productionDb,reviewPolicy,{...JSON.parse(transitStored.payload),id:report.transitId}):null;
   const approvedBefore=dailyContext?dailyOutputTotals({...JSON.parse(transitStored.payload),id:report.transitId,...(reviewQuantityBaseline?{quantityBaseline:reviewQuantityBaseline}:{})},dailyContext.reports.filter(r=>r.id!==report.id)).approved:reportRows.filter(item=>item.key!==body.reportId&&item.payload.kind==='completion'&&item.payload.reviewStatus==='Đã xác nhận'&&(!item.payload.stageReporting||Number(item.payload.approvedQuantity??item.payload.reportedQuantity)>0)&&(report.transitId?item.payload.transitId===report.transitId:item.payload.lsxCode===report.lsxCode)).reduce((sum,item)=>sum+Number(item.payload.approvedQuantity??item.payload.reportedQuantity??0),0);
   const approvedQuantity=approve?Number(report.reportedQuantity||0):0,cumulative=approvedBefore+approvedQuantity,now=new Date().toISOString();
   const transit=transitStored?JSON.parse(transitStored.payload):{};
   if(isDailyOutput(report)&&['line','sku','lsxCode'].some(k=>transit[k]!==report[k]))return json({error:'Lệnh đã đổi Line/SKU/LSX so với phiếu sản lượng. Đối chiếu lại trước khi xác nhận.'},409);
   if(transit.status==='HỦY'||transit.cancelReason)return json({error:'Lệnh đã hủy tại In transit. Không thể xác nhận hoặc điều chỉnh báo công.'},409);
   if(approve&&cumulative>Number(transit.lsxQty||report.lsxQty||0))return json({error:`LSX ${report.lsxCode}: sản lượng lũy kế vượt số lượng lệnh; kiểm tra các báo công trước khi xác nhận.`},409);
   const completed=Number(transit.lsxQty||report.lsxQty||0)>0&&cumulative>=Number(transit.lsxQty||report.lsxQty||0);
   const current=workflow.reports.find(r=>r.id===report.id);
   if(body.expectedReview!==undefined){const reviewOrder=(workflow.progressOrders||workflow.orders).find(o=>o.id===report.transitId);if(!current||!reviewOrder||typeof body.expectedReview!=='string'||body.expectedReview!==reviewSnapshot(reviewOrder,current))return json({error:'Dữ liệu báo công, giờ hoặc lệnh đã thay đổi. Tải lại và kiểm tra trước khi chọn xác nhận.'},409);}
   if(report.historicalImport){
    const liveOrder=workflow.orders.find(o=>o.id===report.transitId&&!o.historicalOnly);
    if(!transitStored||!liveOrder||transit.cancelReason||liveOrder.lsxCode!==report.lsxCode||liveOrder.sku!==report.sku||liveOrder.line!==report.line)return json({error:'Lệnh lịch sử không còn khớp In Transit đang hoạt động. Kiểm tra Plan ID và LSX trước khi xác nhận.'},409);
    const blocker=reportReviewBlocker(current||report);
    if(approve&&blocker)return json({error:blocker},409);
   }
   if(approve&&!isDailyOutput(report)&&current?.unresolvedAttendance?.length)return json({error:`LSX ${report.lsxCode}: chưa có giờ vào thực tế của ${current.unresolvedAttendance.flatMap(n=>n.employees).join(', ')}. QLSX cập nhật tại Lịch SX thực tế trước khi xác nhận và đồng bộ.`},409);
   if(approve&&!isDailyOutput(report)&&current?.pendingAttendance?.length)return json({error:`LSX ${report.lsxCode}: biến động của ${current.pendingAttendance.flatMap(n=>n.employees).join(', ')} đang chờ duyệt điều chỉnh giờ.`},409);
   const completionTimes=isDailyOutput(report)?workflow.reports.filter(r=>r.id!==report.id&&r.transitId===report.transitId&&r.kind==='completion'&&!r.cancelled&&!r.voided&&r.reviewStatus==='Đã xác nhận'&&Number(r.approvedQuantity??r.reportedQuantity)>0).map(r=>isDailyOutput(r)?r.productionDate:r.completedAt).concat(approve?[report.productionDate]:[]).filter(Boolean).sort():reportRows.filter(item=>item.key!==report.id&&item.payload.kind==='completion'&&item.payload.reviewStatus==='Đã xác nhận'&&(!item.payload.stageReporting||Number(item.payload.approvedQuantity??item.payload.reportedQuantity)>0)&&(report.transitId?item.payload.transitId===report.transitId:item.payload.lsxCode===report.lsxCode)).map(item=>isDailyOutput(item.payload)?item.payload.productionDate:item.payload.completedAt).concat(approve&&(!report.stageReporting||approvedQuantity>0)?[isDailyOutput(report)?report.productionDate:report.completedAt]:[]).filter(Boolean).sort();
   const finalAt=completed?completionTimes.at(-1)||'':'';
   const finalDate=finalAt?vnMoment(finalAt).date:'',planEnd=String(transit.planEnd||'').slice(0,10);
   const delayDays=finalDate&&planEnd?Math.max(0,Math.round((Date.parse(finalDate)-Date.parse(planEnd))/86400000)):0;
   const delayReason=String(body.delayReason??'').trim();
   const delayError=approve?reportDelayReasonError({...workflow.orders.find(o=>o.id===report.transitId),...transit},report,delayReason,workflow.reports):'';
   if(delayError)return json({error:delayError},422);
   const quantityBaseline=reviewQuantityBaseline;
   const updated={...report,...(quantityBaseline?{quantityBaseline,quantityAfterCutover:quantityBaseline.snapshotId}:{}),version:Number(report.version||0)+1,...(current?.hours?{hours:current.hours}:{}),hourStatus:approve?(isDailyOutput(report)?"Không áp dụng giờ theo lệnh":"Đã xác nhận giờ"):report.hourStatus,confirmationBasis:approve?(isDailyOutput(report)?{at:now,by:actor.login,productionDate:report.productionDate,quantity:approvedQuantity,rateBasis:report.rateBasis,rateStatus:report.rateStatus}:{at:now,by:actor.login,hours:current?.hours||report.hours,laborNotes:current?.laborNotes||[]}):report.confirmationBasis,delayReason,...(adjustedHours?{hours:adjustedHours,hourStatus:'Đã duyệt điều chỉnh'}:{}),reviewStatus:approve?'Đã xác nhận':'Cần điều chỉnh',approvedQuantity,completedQty:cumulative,productionState:completed?'Hoàn thành sản xuất':'Đang sản xuất',actualStartedAt:transit.actualStartedAt||(isDailyOutput(report)?workflow.orders.find(o=>o.id===report.transitId)?.actualStartedAt||report.productionDate:report.startedAt)||'',actualCompletedAt:finalAt,reviewedBy:actor.login,reviewedById:productionActorId(actor),reviewedAt:now,rejectionReason:reason,warehouseStatus:approve?(approvedQuantity>0?'Chờ Kho xác nhận':'Không nhập kho tại công đoạn này'):'Chưa tạo phiếu',updatedAt:now,updatedBy:actor.login};
   const reviewPendingQty=receiptLegacy?dailyOutputTotals({...transit,id:report.transitId,quantityBaseline},dailyContext.reports.map(r=>r.id===report.id?updated:r)).pending:undefined;
   const cursorKey='global',initial=JSON.stringify({version:0,token:''});
   await productionDb.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('production_cursor',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(cursorKey,initial,actor.login,now).run();
   const cursor=await productionDb.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key=?").bind(cursorKey).first();
   if(cursor.payload!==(cursorBefore?.payload||initial))return json({error:'Dữ liệu SX vừa thay đổi; tải lại trước khi xác nhận.'},409);
   const nextCursor=JSON.stringify({version:Number(JSON.parse(cursor.payload).version||0)+1,token:crypto.randomUUID()});
   const dailyGuards=[...(dailyContext?.guards||[]),...(receiptLegacy&&reviewPolicyState.snapshotGuard?[reviewPolicyState.snapshotGuard]:[]),...[['production_reporting_policy','global',reviewPolicyState.raw],['production_reporting_activation','global',reviewPolicyState.activationRaw],...(reviewPolicyState.manifestKey?[['production_legacy_manifest',reviewPolicyState.manifestKey,reviewPolicyState.manifestRaw]]:[])].map(([entity,key,raw])=>({sql:raw===null?"NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)":"EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)",args:raw===null?[entity,key]:[entity,key,raw]}))];
   if(receiptLegacy){
    // Fence every participating raw row before advancing the batch cursor. A
    // failed order/report CAS must not leave a partial review or warehouse row.
    dailyGuards.push({sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND record_key=? AND payload=?)",args:[report.transitId,transitStored.payload]});
    dailyGuards.push(stored?{sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)",args:[body.reportId,stored.payload]}:{sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='production_history_import' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=?)",args:[historySource.record_key,historySource.payload,body.reportId]});
    if(approve)dailyGuards.push({sql:"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND (record_key=? OR json_extract(payload,'$.reportId')=?))",args:[`SX:${body.reportId}`,body.reportId]});
   }
   const statements=[
    productionDb.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key=? AND payload=?"+(dailyGuards.length?' AND '+dailyGuards.map(g=>g.sql).join(' AND '):'')).bind(nextCursor,actor.login,now,cursorKey,cursor.payload,...dailyGuards.flatMap(g=>g.args)),
    historySource?productionDb.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_report',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_history_import' AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND record_key=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(body.reportId,JSON.stringify(updated),actor.login,now,cursorKey,nextCursor,historySource.record_key,historySource.payload,report.transitId,transitStored.payload,`SX:${body.reportId}`):
    productionDb.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_report' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key=? AND payload=?) AND (?=0 OR NOT EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND record_key=?)) AND (? IS NULL OR EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND record_key=? AND payload=?))").bind(JSON.stringify(updated),actor.login,now,body.reportId,stored.payload,cursorKey,nextCursor,approve?1:0,`SX:${body.reportId}`,transitStored?.payload??null,report.transitId||'',transitStored?.payload??null),
    productionDb.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)").bind(crypto.randomUUID(),JSON.stringify({entity:'production_report',key:body.reportId,before:report,after:updated,actor:actor.login,at:now}),actor.login,now,body.reportId,JSON.stringify(updated))
   ];
   if(receiptLegacy){
    const nextTransit={...transit,quantityBaseline,completedQty:cumulative,pendingReportQty:reviewPendingQty,productionState:updated.productionState,actualStartedAt:updated.actualStartedAt,actualCompletedAt:updated.actualCompletedAt,delayReason:delayReason||transit.delayReason||'',updatedAt:now,updatedBy:actor.login};
    statements.push(productionDb.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)").bind(JSON.stringify(nextTransit),actor.login,now,report.transitId,transitStored.payload,cursorKey,nextCursor,body.reportId,JSON.stringify(updated)));
   }
   const reviewEvent={id:crypto.randomUUID(),kind:approve?'report-approval':'report-rejection',sourceId:report.transitId,line:report.line,reportId:report.id,...(isDailyOutput(report)?{reportingModel:report.reportingModel,quantityOnly:true,productionDate:report.productionDate}:{}),effectiveAt:isDailyOutput(report)?now:report.completedAt,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason:approve?delayReason:reason,before:{quantity:report.approvedQuantity||0,status:report.reviewStatus},after:{quantity:approvedQuantity,status:updated.reviewStatus},employees:report.hours?.perEmployee?.map(p=>p.id)||[]};
   statements.push(productionDb.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_event',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)").bind(reviewEvent.id,JSON.stringify(reviewEvent),actor.login,now,body.reportId,JSON.stringify(updated)));
   if(approve&&approvedQuantity>0){
    const warehouseKey=`SX:${body.reportId}`,warehouse={id:warehouseKey,source:'Sản xuất',reportId:body.reportId,planId:report.planId,lsxCode:report.lsxCode,sku:report.sku,name:report.name,spec:report.spec,line:report.line,proposedQuantity:approvedQuantity,receivedQuantity:null,status:'Chờ xác nhận',sourceCompletedAt:isDailyOutput(report)?report.productionDate:report.completedAt,...(isDailyOutput(report)?{sourceProductionDate:report.productionDate}:{}),sheetSync:{status:'pending'},createdBy:actor.login,createdAt:now};
    statements.push(productionDb.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'warehouse_in',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(warehouseKey,JSON.stringify(warehouse),actor.login,now,body.reportId,JSON.stringify(updated)));
   }
   const changed=await productionDb.batch(statements);
   if(changed[0].meta.changes!==1||changed[1].meta.changes!==1||changed.slice(2).some(row=>row.meta.changes!==1))return json({error:'Báo công vừa được xử lý đồng thời; tải lại và kiểm tra.'},409);
   return json({ok:true,payload:updated,...(receiptLegacy?{pendingReportQty:reviewPendingQty}:{})});
  }
  if(path==='/api/engine-run'){
   if(!canWrite(actor,'Production Engine'))return json({error:'Không có quyền cập nhật dữ liệu tuần'},403);
   return json(await saveEngine(env.DB,body,{...actor,catalog:await loadCatalog()}));
  }
  if(path==='/api/sku-confirm')return json(await confirmSkus(env.DB,body,actor));
  if(path==='/api/sku-request'){if(!canWrite(actor,'SKU Master'))return json({error:'Không có quyền yêu cầu SKU'},403);const catalog=await loadCatalog();return json(await requestSku(env.DB,{...body,currentData:catalog.find(r=>r.key===String(body.key||'').trim().toUpperCase())?.payload||null},actor));}
  if(path!=='/api/records')return json({error:'API không hỗ trợ'},404);
  if(!entities.has(body.entity)||!body.key||!body.payload||typeof body.payload!=='object')return json({error:'Dữ liệu không hợp lệ'},400);
  if(['bom','bom_change'].includes(body.entity))return json({error:'Sử dụng API nghiệp vụ BOM để kiểm soát phê duyệt và lịch sử.'},409);
  if(['sku','sku_history','labor_hours','labor_hours_history','production_plan','production_plan_audit','in_transit','in_transit_audit','admin_audit','production_engine','production_engine_snapshot','production_report','production_event','production_schedule','production_cursor','production_quantity_source','production_legacy_manifest','production_reporting_policy','production_reporting_activation'].includes(body.entity))return json({error:'Dùng API nghiệp vụ chuyên biệt'},409);
  if(['capacity','employees','inventory','forecast_import_history'].includes(body.entity))return json({error:'Sử dụng API nghiệp vụ để bảo vệ dữ liệu và lịch sử.'},403);
  if(['users','permissions','departments','department_permissions'].includes(body.entity)?!await isSuperAdmin(env.DB,actor):!hasMenuPermission(actor,entityLabel(body.entity),['Thêm','Sửa','Xác nhận','Hủy xác nhận','Hủy','Xóa','Lưu']))return json({error:'Không có quyền cập nhật'},403);
  if(body.entity==='leadtime_versions'){
   const sku=String(body.payload.sku||'').trim().toUpperCase();
   const cancelledSetting=await env.DB.prepare("SELECT payload FROM app_records WHERE entity='leadtime' AND record_key=?").bind(sku).first();
   if(cancelledSetting&&JSON.parse(cancelledSetting.payload).cancelled)return json({error:'Lead Time đã Hủy; không được tự áp dụng lại.'},409);
   if(!sku)return json({error:'Mã SKU không hợp lệ.'},400);
   const catalog=await loadCatalog(),master=catalog.find(row=>String(row.key).trim().toUpperCase()===sku&&usableSku(row.payload));
   if(!master)return json({error:'SKU không tồn tại hoặc chưa được xác nhận/đang sử dụng trong SKU Master.'},409);
   if(body.operation==='create'){
    const existing=await env.DB.prepare("SELECT 1 AS found FROM app_records WHERE entity='leadtime_versions' AND upper(json_extract(payload,'$.sku'))=? AND coalesce(json_extract(payload,'$._deleted'),0)<>1 AND coalesce(json_extract(payload,'$.status'),'') IN ('Nháp','Chờ xác nhận','Đang áp dụng') LIMIT 1").bind(sku).first();
    if(hasBaseLeadtime(sku)||existing)return json({error:`SKU ${sku} đã có Leadtime. Vui lòng chọn dòng và dùng chức năng Sửa.`},409);
   }
  }
  const oldRow=await env.DB.prepare('SELECT payload,updated_by,updated_at FROM app_records WHERE entity=? AND record_key=?').bind(body.entity,body.key).first(),old=oldRow?JSON.parse(oldRow.payload):(body.entity==='demand_event'?siteDemand([]).find(r=>r.key===body.key)?.payload:null);
  if(body.entity==='warehouse_in'){
   if(old?.pendingCorrection?.status==='pending'||['pending','approved-awaiting-sheet'].includes(old?.withdrawalRequest?.status))return json({error:'Phiếu đang đối soát điều chỉnh/thu hồi; dùng luồng nghiệp vụ, không ghi đè trực tiếp.'},409);
   const reportIds=[...new Set([old?.reportId,old?.sourceReportId,body.payload.reportId,body.payload.sourceReportId,String(body.key).startsWith('SX:')?String(body.key).slice(3):null].filter(id=>typeof id==='string'&&id))];
   if(reportIds.length){const linked=(await env.DB.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key IN (SELECT value FROM json_each(?))").bind(JSON.stringify(reportIds)).all()).results;
    if(linked.some(row=>isDailyOutput(JSON.parse(row.payload))))return json({error:'Phiếu từ sản lượng ngày phải dùng quy trình sửa/xác nhận/thu hồi, không ghi đè hoặc tạo lại qua danh sách chung.'},409);
   }
  }
  if(body.entity==='users'&&(old?.authMode==='quick_line'||body.payload.authMode==='quick_line')){if(!old||body.payload.authMode!==old.authMode||body.payload.line!==old.line||body.payload.login!==old.login||body.key!==old.login||body.payload.role!=='USER')return json({error:'User Line giữ nguyên ID, Line và vai trò USER. Tạo user Line bằng chức năng riêng.'},409);}
  if(['leadtime','leadtime_versions','safety_rules','safety_rule_groups','safety_days'].includes(body.entity)&&old?.cancelled)return json({error:'Dữ liệu đã Hủy; không được áp dụng lại bằng thao tác sửa/xác nhận.'},409);
  const actualRevision=await recordRevision(oldRow?.payload);
  if(!Object.hasOwn(body,'expectedRevision')||body.expectedRevision!==actualRevision)
   return json({error:conflictMessage,current:old,updatedBy:oldRow?.updated_by||null,updatedAt:oldRow?.updated_at||null,revision:actualRevision},409);
  if(body.entity==='inventory_snapshot'&&(!old||!['Đã chốt','Đã được Production_engine sử dụng'].includes(old.status)||body.payload.status!=='Đã mở chốt'||!String(body.payload.reopenReason||'').trim()||body.payload.weekKey!==old.weekKey||JSON.stringify(body.payload.items)!==JSON.stringify(old.items)))return json({error:'Chỉ được mở bản chốt hiện có với lý do; tạo bản chốt qua chọn file và tuần.'},409);
  if(body.createOnly&&old)return json({error:'Bản ghi đã tồn tại'},409);
  if(body.entity==='demand_event'&&!old){const v=await validateNewDemand(env.DB,body.payload,await loadCatalog());if(Object.keys(v.fields).length)return json({error:'Demand không hợp lệ',fields:v.fields},400);}
  if(body.entity==='bom_change'&&body.payload.bulk)return json({error:'Dùng API phiếu BOM hàng loạt.'},409);
  const now=new Date().toISOString(),attributed=attributeChanges(body.payload,old,actor.login);let p=Array.isArray(attributed)?attributed:{...attributed,updatedBy:actor.login,updatedAt:now,createdBy:old?.createdBy||actor.login};
  if(body.entity==='forecast')p=syncPayloadGroups(p,catalogGroups(await loadCatalog()));
  for(const key of ['confirmedBy','confirmed_by','changedBy','operator','cancelledBy'])if(key in p&&p[key]!==old?.[key])p[key]=actor.login;
  if(body.entity==='bom')p=syncBomSources(p,(await loadCatalog()).map(row=>row.payload));
  const nextPayload=JSON.stringify(p);
  const singlePending=body.entity==='bom_change'&&p.status==='Chờ xác nhận';
  const pendingGuard="NOT EXISTS(SELECT 1 FROM app_records bc WHERE bc.entity='bom_change' AND bc.record_key<>? AND json_extract(bc.payload,'$.status')='Chờ xác nhận' AND (json_extract(bc.payload,'$.sku')=? OR EXISTS(SELECT 1 FROM json_each(bc.payload,'$.skus') WHERE value=?)))";
  const pendingBindings=[body.key,p.sku,p.sku];
  const write=oldRow
   ?singlePending?env.DB.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=? AND ${pendingGuard}`).bind(nextPayload,actor.login,now,body.entity,body.key,oldRow.payload,...pendingBindings):env.DB.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=?').bind(nextPayload,actor.login,now,body.entity,body.key,oldRow.payload)
   :singlePending?env.DB.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${pendingGuard} ON CONFLICT(entity,record_key) DO NOTHING`).bind(body.entity,body.key,nextPayload,actor.login,now,...pendingBindings):env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(body.entity,body.key,nextPayload,actor.login,now);
  const results=await env.DB.batch([write,env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE changes()=1').bind('admin_audit',crypto.randomUUID(),JSON.stringify({entity:body.entity,key:body.key,before:old,after:p,actor:actor.login,userId:actor.userId,at:now}),actor.login,now),...(body.entity==='users'&&old?.authMode==='quick_line'?[env.DB.prepare('UPDATE auth_sessions SET revoked_at=? WHERE login=? AND revoked_at IS NULL AND changes()=1').bind(Date.now(),body.key)]:[])]);
  if(results[0].meta.changes!==1)return json({error:conflictMessage},409);
  return json({ok:true,payload:p,updatedAt:now,revision:await recordRevision(nextPayload)});
 }catch(e){console.error('Site API',e.message);const expected=e instanceof PlanError||['/api/warehouse-sheet/bridge','/api/warehouse-sheet/setup','/api/sku-transfer','/api/change-requests','/api/warehouse-confirm','/api/warehouse-backfill','/api/production-history-import','/api/user-permission-setup','/api/production-hr-hours','/api/production-report','/api/production-correction','/api/production-examples','/api/basic-master-cancel','/api/capacity','/api/employees','/api/inventory-import','/api/forecast-import','/api/production-allocation','/api/production-allocation-scope','/api/production-workflow','/api/linked-records','/api/sku-unit-import','/api/bom-bulk','/api/bom-change','/api/bom','/api/bom-pdf-reconciliation'].includes(path);return json({error:expected?e.message:'Không thực hiện được thao tác; vui lòng thử lại.',...(e instanceof PlanError?{details:e.details.map(({id,sku,reason})=>({id,sku,reason}))}:{})},expected?e.status||400:500);}
}
