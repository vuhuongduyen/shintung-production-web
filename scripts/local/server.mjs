import {confirmationDateError,needsLinkedConfirmation} from '../../lib/leadtime-confirmation.mjs';
import {productionUnassignedReminder} from './production-unassigned-alert.mjs';
import {commitRecordWithAudit} from '../../lib/record-mutation-audit.mjs';
import {adminReadPaths,adminReadResponse} from '../../lib/admin-readonly.mjs';
import {readSkuStock} from "../../lib/sku-stock.mjs";
import {feedbackApi} from '../../lib/user-feedback.mjs';
import {readHrMonth,saveHrMonth} from '../../lib/production-hr-storage.mjs';
import {correctProduction} from './production-corrections.mjs';
import {projectCancelledMaster} from '../../lib/basic-master.mjs';
import {cancelBasicMaster} from './basic-master.mjs';
import {mutateBom} from './bom-lifecycle.mjs';
import {canBomAction} from '../../lib/bom-permissions.mjs';
import {reconcileBomPdf} from './bom-reconciliation.mjs';
import {mutateBomBulk} from './bom-bulk.mjs';
import {commitLinkedRecords} from './linked-records.mjs';
import {readCapacity,mutateCapacity,listCapacityRequests,latestCapacityWeek,readLatestCapacity} from './capacity.mjs';
import {readEmployees,saveEmployee,importEmployees} from './employees.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from './production-workflow.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {syncBomSources} from '../../lib/bom-source.mjs';
import {validateNewDemand} from './demand-validation.mjs';
import {saveEngine} from './engine.mjs';
import {mutateInventoryImport} from './inventory-import.mjs';
import {importForecastFile} from './forecast-import.mjs';
import {skuCapability,requestSku,confirmSkus} from './sku-approval.mjs';
import { openDatabase,migrate,configuration,root } from './database.mjs';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { getPlan,getPlanCapacity,getPlanCapacityDetail,mutatePlan,PlanError } from './production-plan.mjs';
import { getTransit,mutateTransit } from './in-transit.mjs';
import {isSuperAdmin,storageStatus,storeFile,createExport} from './storage.mjs';
import {siteLaborHours,siteLaborHoursHistory} from '../../lib/site-labor-hours.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';

const allowed=new Set(['users','permissions','departments','department_permissions','versions','sku','sku_history','leadtime','leadtime_versions','leadtime_audit','safety_days','safety_rules','safety_rule_groups','safety_rule_audit','labor_hours','labor_hours_history','production_engine_snapshot','inventory','warehouse_in','warehouse_out','warehouse_transfer','warehouse_docs','warehouse_count','inventory_snapshot','inventory_snapshot_audit','bom','bom_change','forecast','forecast_import_history','demand_event','production_engine','production_plan','in_transit','in_transit_audit','production_report','labor_adjustment','capacity']);
export function localTestPlugin(testOptions = {}){
 return {name:'onspa-test-api',enforce:'pre',async configureServer(server){
  const config=configuration(),connection=await openDatabase(testOptions.persistPath);
  try{await migrate(connection.db);}catch(error){await connection.close();throw error;}
  const sessions=new Map(),attempts=new Map();const authFile=testOptions.authFile || resolve(root,'.local-data/auth.json');
  server.httpServer?.once('close',()=>connection.close());
  server.middlewares.use(async(req,res,next)=>{
   const url=new URL(req.url||'/',`http://${config.host}:${config.port}`);
   if(!url.pathname.startsWith('/api/'))return next();
   const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
   const host=req.headers.host;
   if(!['127.0.0.1:5173','localhost:5173'].includes(host)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'TEST chỉ chấp nhận loopback.'});
   const origin=req.headers.origin;
   if(origin&&!['http://127.0.0.1:5173','http://localhost:5173'].includes(origin))return send(403,{error:'Origin không hợp lệ.'});
   try{
    if(url.pathname==='/api/test-environment'&&req.method==='GET')return send(200,{environment:'TEST',remote:false,database:'.local-data/d1',engine:'Miniflare D1',setupRequired:!existsSync(authFile)});
    const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('onspa_test='))?.slice(11);
    const session=sessions.get(cookie);const authenticated=session&&session.expires>Date.now();
    if(['/api/feedback','/api/feedback-image'].includes(url.pathname)){
     let raw='';if(req.method==='POST')for await(const chunk of req){raw+=chunk;if(raw.length>15_000_000)return send(413,{error:'Payload quá lớn'});}
     const response=await feedbackApi(new Request(url,{method:req.method,headers:{origin:origin||'','content-type':req.headers['content-type']||''},...(req.method==='POST'?{body:raw}:{})}),{DB:connection.db,FILES:connection.bucket},authenticated?{...session,isAdmin:true}:null);
     res.statusCode=response.status;for(const [key,value]of response.headers)res.setHeader(key,value);res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(url.pathname.startsWith('/api/storage')){
     const authorized=authenticated&&await isSuperAdmin(connection.db,session);
     if(url.pathname==='/api/storage-capability')return send(200,{allowed:!!authorized});
     if(!authorized)return send(403,{error:'Chỉ Super Admin được sử dụng Sao lưu & Bàn giao.'});
     if(req.method==='GET'&&url.pathname==='/api/storage')return send(200,await storageStatus(connection.db,connection.bucket));
     if(req.method==='GET'&&url.pathname==='/api/storage-download'){
      const id=url.searchParams.get('id'),type=url.searchParams.get('type');
      const row=type==='backup'?await connection.db.prepare("SELECT object_key,filename AS name,checksum FROM backup_exports WHERE id=? AND status='Thành công'").bind(id).first():await connection.db.prepare('SELECT object_key,original_name AS name,checksum FROM file_objects WHERE file_id=?').bind(id).first();
      if(!row)return send(404,{error:'Không tìm thấy tệp.'});const object=await connection.bucket.get(row.object_key);if(!object)return send(404,{error:'Thiếu object.'});
      const bytes=Buffer.from(await object.arrayBuffer());res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(bytes);return;
     }
     if(req.method!=='POST'||!origin||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Yêu cầu JSON cùng origin.'});
     let text='';for await(const chunk of req){text+=chunk;if(text.length>8_000_000)return send(413,{error:'Tệp quá lớn.'});}const input=JSON.parse(text);
     if(url.pathname==='/api/storage-upload')return send(200,{file:await storeFile(connection.db,connection.bucket,input,session.login)});
     if(url.pathname==='/api/storage-export')return send(200,await createExport(connection.db,connection.bucket,input.kind,session.login));
     return send(404,{error:'Unknown storage endpoint'});
    }
    if(url.pathname==='/api/sku-capabilities'&&req.method==='GET')return send(200,{canConfirm:await skuCapability(connection.db,authenticated?session:null)});
    if(url.pathname==='/api/capacity'&&req.method==='GET')return send(200,url.searchParams.get('requests')==='1'?{requests:await listCapacityRequests(connection.db,authenticated?{...session,isAdmin:true}:null)}:url.searchParams.get('bootstrap')==='1'?await readLatestCapacity(connection.db,authenticated?{...session,isAdmin:true}:null):url.searchParams.get('latest')==='1'?{week:await latestCapacityWeek(connection.db,authenticated?{...session,isAdmin:true}:null)}:await readCapacity(connection.db,url.searchParams.get('week'),authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/employees'&&req.method==='GET')return send(200,await readEmployees(connection.db,authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/production-plan'&&req.method==='GET')return send(200,url.searchParams.get('capacityDetail')==='1'?await getPlanCapacityDetail(connection.db,url.searchParams.get('week'),url.searchParams.get('line')):url.searchParams.get('capacityOnly')==='1'?{capacity:await getPlanCapacity(connection.db,url.searchParams.get('week'))}:await getPlan(connection.db,url.searchParams.get('week'),!!(authenticated&&session.canReopenPlan)));
    if(url.pathname==='/api/in-transit'&&req.method==='GET'){const sku=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));return send(200,await getTransit(connection.db,Object.fromEntries(url.searchParams),sku));}
    if(url.pathname==='/api/production-standards'&&req.method==='GET'){if(!authenticated)return send(401,{error:'Vui lòng đăng nhập.'});const rows=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='labor_hours'").all()).results;return send(200,{records:siteLaborHours(rows.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}))).map(r=>({key:r.key,payload:{sku:r.payload.sku,laborHour:r.payload.laborHour,cancelled:r.payload.cancelled,status:r.payload.status,_deleted:r.payload._deleted}}))});}
    if(url.pathname==='/api/production-hr-hours'&&req.method==='GET')return send(200,await readHrMonth(connection.db,url.searchParams.get('month'),authenticated?{...session,isAdmin:true}:null,url.searchParams.get('examples')==='1'));
    if(url.pathname==='/api/production-workflow'&&req.method==='GET'){const actor=authenticated?{...session,isAdmin:true}:null,workflow=await readProductionWorkflow(connection.db,actor,[],{includeDerivedHours:url.searchParams.get('unassignedAlerts')!=='1'});return send(200,url.searchParams.get('unassignedAlerts')==='1'?await productionUnassignedReminder(connection.db,actor,workflow):workflow);}
    if(adminReadPaths.has(url.pathname)){
     // Administrative reads require the existing Super Admin permission.
     const authorized=!!authenticated&&await isSuperAdmin(connection.db,session);
     const result=await adminReadResponse({path:url.pathname,method:req.method,authorized,db:connection.db,searchParams:url.searchParams});
     return send(result.status,result.body);
    }
    if(req.method==='GET'&&url.pathname==='/api/records'){
     const entity=url.searchParams.get('entity');if(!allowed.has(entity))return send(400,{error:'Hạng mục không hợp lệ'});
     if(entity==='production_report')return send(409,{error:'Xem báo công qua API có giới hạn quyền theo Line.'});
     const result=await connection.db.prepare('SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at DESC').bind(entity).all();
     const records=await Promise.all(result.results.map(async r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:await recordRevision(r.payload)})));
     if(entity==='sku'&&url.searchParams.has('stock'))return send(200,await readSkuStock(connection.db,url.searchParams.get('stock')));
     if(entity==='bom'){const masters=(await connection.db.prepare("SELECT payload FROM app_records WHERE entity='sku'").all()).results.map(row=>JSON.parse(row.payload));return send(200,{records:records.map(row=>({...row,payload:syncBomSources(row.payload,masters)}))});}
     if(entity==='leadtime')return send(200,{records:records.map(row=>({...row,payload:projectCancelledMaster('leadtime',row.payload)}))});
     if(entity==='labor_hours')return send(200,{records:siteLaborHours(records)});
     if(entity==='labor_hours_history')return send(200,{records:siteLaborHoursHistory(records,url.searchParams.get('sku')||'')});
     return send(200,{records});
    }
    if(req.method!=='POST')return send(405,{error:'Method not allowed'});
    if(!origin||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Yêu cầu JSON cùng origin.'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>(url.pathname==='/api/production-hr-hours'?30_000_000:8_000_000))return send(413,{error:'Payload quá lớn'});}const body=JSON.parse(raw);
    if(url.pathname==='/api/basic-master-cancel')return send(200,await cancelBasicMaster(connection.db,body,{...session,isAdmin:true}));
    if(url.pathname==='/api/test-session'){
     const now=Date.now(),recent=(attempts.get(req.socket.remoteAddress)||[]).filter(t=>now-t<60000);attempts.set(req.socket.remoteAddress,[...recent,now]);
     if(recent.length>=10)return send(429,{error:'Thử lại sau một phút.'});
     if(body.logout){sessions.delete(cookie);res.setHeader('Set-Cookie','onspa_test=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
     if(typeof body.login!=='string'||typeof body.password!=='string')return send(400,{error:'Thiếu tài khoản TEST.'});
     if(!existsSync(authFile)){
      if(body.setup!==true||!/^[a-zA-Z0-9_-]{3,40}$/.test(body.login)||!/^\d{4}$/.test(body.password))return send(400,{error:'Lần đầu: tạo tài khoản TEST 3–40 ký tự và mật khẩu đúng 4 chữ số.'});
      const salt=randomBytes(24).toString('hex');writeFileSync(authFile,JSON.stringify({login:body.login,salt,hash:scryptSync(body.password,salt,64).toString('hex')}),{flag:'wx',mode:0o600});
     }
     const account=JSON.parse(readFileSync(authFile,'utf8'));
     if(account.login!==body.login||!timingSafeEqual(Buffer.from(account.hash,'hex'),scryptSync(body.password,account.salt,64)))return send(401,{error:'Sai tài khoản hoặc mật khẩu TEST.'});
     const token=randomBytes(32).toString('hex');sessions.set(token,{login:account.login,role:account.role||'local-owner',canReopenPlan:true,expires:now+8*3600000});res.setHeader('Set-Cookie',`onspa_test=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
     return send(200,{ok:true,name:account.login});
    }
    if(url.pathname==='/api/bom-pdf-reconciliation')return send(200,await reconcileBomPdf(connection.db,body,authenticated?{...session,isAdmin:true}:null));
    if(['/api/bom-bulk','/api/bom-change','/api/bom'].includes(url.pathname)){const actor=authenticated?session:null;if(!canBomAction(actor,body.action,body.expectedRevision!=null,url.pathname==='/api/bom'?'Dữ liệu lượng dùng BOM':'Phiếu thay đổi BOM'))return send(403,{error:'Không có quyền thực hiện thao tác BOM.'});const catalog=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(row=>({key:row.record_key,payload:JSON.parse(row.payload)}));return send(200,url.pathname==='/api/bom'?await mutateBom(connection.db,body,actor,catalog):await mutateBomBulk(connection.db,{...body,single:url.pathname==='/api/bom-change'},actor,catalog));}
    if(url.pathname==='/api/linked-records'&&body.kind==='bom-change')return send(409,{error:'Sử dụng chức năng phiếu BOM.'});
    if(url.pathname==='/api/linked-records'){const catalog=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(row=>({key:row.record_key,payload:JSON.parse(row.payload)}));return send(200,await commitLinkedRecords(connection.db,body,authenticated?session:null,{catalog}));}
    if(url.pathname==='/api/capacity')return send(200,await mutateCapacity(connection.db,body,authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/inventory-import')return send(200,await mutateInventoryImport(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/forecast-import')return send(200,await importForecastFile(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/employees')return send(200,await (body?.action==='import'?importEmployees:saveEmployee)(connection.db,body,authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/production-plan')return send(200,await mutatePlan(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/in-transit'){const sku=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results.map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));return send(200,await mutateTransit(connection.db,body,authenticated?session:null,sku));}
    if(url.pathname==='/api/production-correction')return send(200,await correctProduction(connection.db,body,authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/production-hr-hours')return send(200,await saveHrMonth(connection.db,connection.bucket,body,authenticated?{...session,isAdmin:true}:null,url.searchParams.get('examples')==='1'));
    if(url.pathname==='/api/production-workflow'&&body.action==='unassigned-reminder'){const actor=authenticated?{...session,isAdmin:true}:null;return send(200,await productionUnassignedReminder(connection.db,actor,await readProductionWorkflow(connection.db,actor,[],{includeDerivedHours:false}),body.reminder));}
    if(url.pathname==='/api/production-workflow')return send(200,await mutateProductionWorkflow(connection.db,body,authenticated?{...session,isAdmin:true}:null));
    if(url.pathname==='/api/engine-run')return send(200,await saveEngine(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/sku-confirm')return send(200,await confirmSkus(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/sku-request')return send(200,await requestSku(connection.db,body,authenticated?session:null));
    if(url.pathname==='/api/labor-hours'){
     if(!authenticated)return send(401,{error:'Đăng nhập tài khoản TEST để lưu dữ liệu.'});
     const sku=String(body.sku||'').trim().toUpperCase(),value=Number(body.laborHour),mode=body.mode==='edit'?'edit':'create',reason=String(body.reason||'').trim(),note=String(body.note||'').trim(),source=body.source==='PDF'?'PDF':'Nhập trực tiếp';
     if(!sku||!Number.isFinite(value)||value<0)return send(400,{error:'SKU hoặc Giờ công/SP không hợp lệ.'});if(mode==='edit'&&!reason)return send(400,{error:'Vui lòng nhập lý do thay đổi.'});
     const skuRows=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results,master=skuRows.find(r=>r.record_key.toUpperCase()===sku);if(!master)return send(409,{error:'SKU không tồn tại trong SKU Master TEST.'});
     const saved=await connection.db.prepare("SELECT payload FROM app_records WHERE entity='labor_hours' AND record_key=?").bind(sku).first(),base=siteLaborHours([]).find(r=>r.key===sku)?.payload||null,old=saved?JSON.parse(saved.payload):base;if(mode==='create'&&old)return send(409,{error:'SKU đã có Giờ công/SP đang hiệu lực.'});if(mode==='edit'&&!old)return send(409,{error:'SKU chưa có Giờ công/SP để sửa.'});
     if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==Number(old?.version||0))return send(409,{error:conflictMessage,current:old});
     const now=new Date().toISOString(),version=Number(old?.version||0)+1,current={sku,laborHour:value,note,source,configuredAt:old?.configuredAt||now,updatedAt:now,updatedBy:session.login,version},history={id:randomBytes(16).toString('hex'),sku,version,oldLaborHour:old?.laborHour??null,newLaborHour:value,oldNote:old?.note||'',newNote:note,reason:mode==='edit'?reason:'Thêm mới Giờ công/SP',actor:session.login,at:now,source};
     const write=saved?connection.db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='labor_hours' AND record_key=? AND payload=?").bind(JSON.stringify(current),session.login,now,sku,saved.payload):connection.db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('labor_hours',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(sku,JSON.stringify(current),session.login,now);
     const changes=await connection.db.batch([write,connection.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE changes()=1').bind('labor_hours_history',history.id,JSON.stringify(history),session.login,now)]);
     if(changes[0].meta.changes!==1)return send(409,{error:conflictMessage});return send(200,{ok:true,payload:current,history});
    }
    if(url.pathname!=='/api/records')return send(404,{error:'Unknown TEST endpoint'});
    if(['capacity','employees','inventory','forecast_import_history'].includes(body.entity))return send(403,{error:'Sử dụng API nghiệp vụ để bảo vệ dữ liệu và lịch sử.'});
    if(!authenticated)return send(401,{error:'Đăng nhập tài khoản TEST để lưu dữ liệu.'});
    if(['users','permissions','departments','department_permissions'].includes(body.entity)&&!await isSuperAdmin(connection.db,session))return send(403,{error:'Chỉ Super Admin được thay đổi người dùng, bộ phận hoặc phân quyền.'});
    if(['sku','sku_history','production_plan','production_plan_audit','in_transit','in_transit_audit','production_report','production_event','production_schedule','production_cursor'].includes(body.entity))return send(409,{error:'Dùng API nghiệp vụ chuyên biệt để bảo đảm giao dịch và lịch sử.'});
    if(!allowed.has(body.entity)||typeof body.key!=='string'||!body.key||body.payload===undefined)return send(400,{error:'Dữ liệu không hợp lệ'});
    const original=await connection.db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(body.entity,body.key).first();
    if(['leadtime','leadtime_versions','safety_rules','safety_rule_groups','safety_days'].includes(body.entity)&&original&&JSON.parse(original.payload).cancelled)return send(409,{error:'Dữ liệu đã Hủy; không được áp dụng lại bằng thao tác sửa/xác nhận.'});
    if(!Object.hasOwn(body,'expectedRevision')||body.expectedRevision!==await recordRevision(original?.payload))return send(409,{error:conflictMessage,current:original?JSON.parse(original.payload):null});
    const confirmationError=confirmationDateError(body.entity,body.payload,original?JSON.parse(original.payload):null);if(confirmationError)return send(409,{error:confirmationError});
    if(needsLinkedConfirmation(body.entity,body.payload,original?JSON.parse(original.payload):null))return send(409,{error:'Dùng giao dịch xác nhận để giữ phiên bản và lịch sử.'});
    if(body.entity==='inventory_snapshot'){
     const saved=await connection.db.prepare("SELECT payload FROM app_records WHERE entity='inventory_snapshot' AND record_key=?").bind(body.key).first(),old=saved?JSON.parse(saved.payload):null;
     if(!old||!['Đã chốt','Đã được Production_engine sử dụng'].includes(old.status)||body.payload.status!=='Đã mở chốt'||!String(body.payload.reopenReason||'').trim()||body.payload.weekKey!==old.weekKey||JSON.stringify(body.payload.items)!==JSON.stringify(old.items))return send(409,{error:'Chỉ được mở bản chốt hiện có với lý do; tạo bản chốt qua chọn file và tuần.'});
    }
    if(['bom','bom_change','forecast','warehouse_in','warehouse_out','warehouse_transfer','warehouse_count','production_report','labor_adjustment'].includes(body.entity)){
     const keys=new Set();const visit=(p)=>{if(!p||typeof p!=='object')return;if(Array.isArray(p)){p.forEach(visit);return;}if(typeof p.sku==='string'&&p.sku)keys.add(p.sku.trim().toUpperCase());if(['bom','bom_change'].includes(body.entity)&&typeof p.code==='string'&&p.code)keys.add(p.code.trim().toUpperCase());for(const v of Object.values(p))if(v&&typeof v==='object')visit(v);};visit(body.payload);
     const skuRows=(await connection.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='sku'").all()).results;const masters=new Map(skuRows.map(r=>[r.record_key,JSON.parse(r.payload)]));const blocked=[...keys].filter(k=>!usableSku(masters.get(k)));if(blocked.length)return send(409,{error:'SKU chưa xác nhận hoặc chưa sử dụng: '+blocked.join(', ')});
    }
    if(['bom','bom_change'].includes(body.entity))return send(409,{error:'Sử dụng API nghiệp vụ BOM.'});
    if(body.entity==='bom_change'&&body.payload.bulk)return send(409,{error:'Dùng API phiếu BOM hàng loạt.'});
    const now=new Date().toISOString();
    if(body.entity==='demand_event'){const old=await connection.db.prepare("SELECT payload FROM app_records WHERE entity='demand_event' AND record_key=?").bind(body.key).first(); if(!old){
      const checked=await validateNewDemand(connection.db,body.payload);if(Object.keys(checked.fields).length)return send(400,{error:'Demand Event không hợp lệ',fields:checked.fields});
      Object.assign(body.payload,{name:checked.sku.name,spec:checked.sku.specification,group:checked.sku.group,line:checked.sku.line,processes:checked.sku.processes||[],status:'Chưa lập kế hoạch',plannedWeek:'',createdAt:now,updatedAt:now,updatedBy:session.login});
     }else if(body.createOnly){return send(200,{ok:true,payload:JSON.parse(old.payload)});} else{const previous=JSON.parse(old.payload);if(previous.createdAt)body.payload.createdAt=previous.createdAt;else delete body.payload.createdAt;}}
    if(body.entity==='bom'){const masters=(await connection.db.prepare("SELECT payload FROM app_records WHERE entity='sku'").all()).results.map(row=>JSON.parse(row.payload));body.payload=syncBomSources(body.payload,masters);}
    const nextPayload=JSON.stringify(body.payload),singlePending=body.entity==='bom_change'&&body.payload.status==='Chờ xác nhận';
    const pendingGuard="NOT EXISTS(SELECT 1 FROM app_records bc WHERE bc.entity='bom_change' AND bc.record_key<>? AND json_extract(bc.payload,'$.status')='Chờ xác nhận' AND (json_extract(bc.payload,'$.sku')=? OR EXISTS(SELECT 1 FROM json_each(bc.payload,'$.skus') WHERE value=?)))";
    const pendingBindings=[body.key,body.payload.sku,body.payload.sku];
    const write=original?(singlePending?connection.db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=? AND ${pendingGuard}`).bind(nextPayload,session.login,now,body.entity,body.key,original.payload,...pendingBindings):connection.db.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=?').bind(nextPayload,session.login,now,body.entity,body.key,original.payload)):(singlePending?connection.db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${pendingGuard} ON CONFLICT(entity,record_key) DO NOTHING`).bind(body.entity,body.key,nextPayload,session.login,now,...pendingBindings):connection.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(body.entity,body.key,nextPayload,session.login,now));
    const result=await commitRecordWithAudit(connection.db,write,{entity:body.entity,key:body.key,before:original?JSON.parse(original.payload):null,after:body.payload,actor:session,at:now});if(result.meta.changes!==1)return send(409,{error:conflictMessage});
    send(200,{ok:true,updatedAt:now,payload:body.payload,revision:await recordRevision(nextPayload)});
   }catch(error){if(error instanceof PlanError||['/api/basic-master-cancel','/api/inventory-import','/api/forecast-import','/api/linked-records','/api/bom-bulk','/api/bom-change','/api/bom','/api/bom-pdf-reconciliation'].includes(url.pathname)&&error.status)return send(error.status||400,{error:error.message,details:error.details});console.error('TEST API:',error.message);send(500,{error:'Lỗi API TEST local; xem terminal. 本機 API 錯誤。'});}
  });
 }};
}
