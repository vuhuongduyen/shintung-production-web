// MAIN receipt activation, isolated from QA clone/operator routes.
// Explicit Admin action only; never runs at startup or rewrites legacy rows.
import {sitePrincipal} from './site-api.mjs';
import {activateQuantityCutover,quantityCutoverModel,quantityCutoverSources,quantityManifestValid} from '../scripts/local/production-quantity-cutover.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {mainQuantityActivationPage,mainQuantityPagePath} from './main-quantity-activation-page.mjs';
import {assertLegacyHoursReady,legacyHoursReadySql} from './main-quantity-hour-readiness.mjs';
import {mainQuantityLoginPage} from './main-quantity-login-page.mjs';
export const mainQuantityIdentity=Object.freeze({projectId:'appgprj_6a8f9b8b6bc48191b07d8293bcb8402a',origin:'https://sanxuat.shintung-vn-4458.chatgpt.site'});
// Preserve audited bounded source budgets: never truncate or silently increase.
export const mainQuantityLimits=Object.freeze({records:10000,bytes:32*1024*1024,rowBytes:2*1024*1024,requestBytes:1024});
// T is the server receipt persisted by the successful activation transaction.
// Preparing a snapshot does not choose T or change any labor-rate effective date.
export const mainQuantityTiming='activation-receipt';
const operation='production_quantity_activation_operation',staged='production_quantity_prepared_source',oldOperation='production_daily_activation_operation';
const reprepareRequests='production_quantity_reprepare_request',operationHistory='production_quantity_activation_history';
const scope=quantityCutoverSources.map(s=>`'${s}'`).join(',');
const live=`SELECT entity,record_key,payload,updated_by,updated_at FROM app_records WHERE entity IN (${scope})`;
const size="length(CAST(entity AS BLOB))+length(CAST(record_key AS BLOB))+length(CAST(payload AS BLOB))+length(CAST(updated_by AS BLOB))+length(CAST(updated_at AS BLOB))";
const profile=`SELECT count(*) AS records,coalesce(sum(${size}),0) AS bytes,coalesce(max(length(CAST(payload AS BLOB))),0) AS rowBytes,coalesce(sum(CASE WHEN entity='production_report' THEN CASE WHEN json_type(payload,'$.rows')='array' THEN json_array_length(payload,'$.rows') ELSE 1 END WHEN entity='production_history_import' THEN coalesce(json_array_length(payload,'$.reports'),0) ELSE 0 END),0) AS reportCandidates FROM app_records WHERE entity IN (${scope})`;
const bounds=`(SELECT records<=${mainQuantityLimits.records} AND bytes<=${mainQuantityLimits.bytes} AND rowBytes<=${mainQuantityLimits.rowBytes} AND reportCandidates<=${mainQuantityLimits.records} FROM (${profile}))`;
const absent="NOT EXISTS(SELECT 1 FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation') AND record_key='global')";
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const select=(db,entity)=>db.prepare("SELECT payload FROM app_records WHERE entity=? AND record_key='global'").bind(entity).first();
function fence(db,condition,values=[]){return db.prepare(`SELECT CASE WHEN (${condition}) THEN 1 ELSE json_extract('MAIN_QUANTITY_CAS_REJECTED','$') END AS guarded`).bind(...values);}
function oldFence(db,payload){return fence(db,`coalesce((SELECT payload FROM app_records WHERE entity='${oldOperation}' AND record_key='global'),'')=? AND coalesce((SELECT json_extract(payload,'$.leaseUntil') FROM app_records WHERE entity='${oldOperation}' AND record_key='global'),0)<=unixepoch('now')*1000`,[payload]);}
function trusted(context){return context?.hosting?.project_id===mainQuantityIdentity.projectId&&context?.metadata?.projectId===mainQuantityIdentity.projectId&&/^[a-f0-9]{64}$/.test(context?.metadata?.snapshotId||'')&&context.hosting.d1==='DB'&&context.hosting.r2==='FILES';}
function operationMatches(op,actor,context,nonce){return op?.model===quantityCutoverModel&&op.sourceId===context.metadata.snapshotId&&op.actor===actor.login&&op.nonce===nonce;}
function publicOperation(op){if(!op)return {state:'unprepared',model:quantityCutoverModel};return {state:op.state,model:op.model,snapshotId:op.snapshotId,sourceId:op.sourceId,preparedAt:op.preparedAt,receivedAt:op.receivedAt||null,records:op.records,bytes:op.bytes};}
async function sealed(db){const row=await select(db,operation);return row?{raw:row.payload,value:JSON.parse(row.payload),revision:await recordRevision(row.payload)}:null;}
async function prepare(db,actor,context,body){
 const existing=await sealed(db);
 if(existing){
  if(!operationMatches(existing.value,actor,context,body.requestIdempotency))fail('Đã có bản chuẩn bị khác; giữ nguyên để đối chiếu.');
  if(existing.value.state==='active')await verifyActive(db,existing.value);
  return {...publicOperation(existing.value),revision:existing.revision,replayed:true};
 }
 const old=await select(db,oldOperation),oldRaw=old?.payload||'';
 const op={model:quantityCutoverModel,state:'prepared',snapshotId:'QTY-'+crypto.randomUUID(),sourceId:context.metadata.snapshotId,actor:actor.login,nonce:body.requestIdempotency,preparedAt:new Date().toISOString(),oldOperation:oldRaw};
 try{await db.batch([
  fence(db,absent),oldFence(db,oldRaw),fence(db,bounds),
  db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(operation,'global',JSON.stringify(op),actor.login,op.preparedAt),
  db.prepare(`INSERT INTO app_records SELECT ?,json_array(?,entity,record_key),payload,updated_by,updated_at FROM (${live})`).bind(staged,op.snapshotId),
  db.prepare(`UPDATE app_records SET payload=json_set(payload,'$.records',(SELECT records FROM (${profile})),'$.bytes',(SELECT bytes FROM (${profile}))) WHERE entity=? AND record_key='global'`).bind(operation)
 ]);}catch{fail('Chuẩn bị không commit: nguồn vượt ngân sách, policy/lease đã tồn tại hoặc có cạnh tranh.');}
 const result=await sealed(db);return {...publicOperation(result.value),revision:result.revision};
}
async function verifyActive(db,op){
 const rows=await db.prepare("SELECT entity,payload FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation') AND record_key='global'").all();
 if(rows.results.length!==2||!rows.results.every(r=>{const p=JSON.parse(r.payload);return p.intakeModel===quantityCutoverModel&&p.legacySnapshotId===op.snapshotId&&p.sourceId===op.sourceId&&p.actor===op.actor&&p.receivedAt===op.receivedAt;}))fail('Mốc đã kích hoạt không còn khớp; không tự tạo lại.');
 const policy=JSON.parse(rows.results.find(r=>r.entity==='production_reporting_policy').payload),activation=JSON.parse(rows.results.find(r=>r.entity==='production_reporting_activation').payload);
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?").bind(op.snapshotId).first(),manifest=row&&JSON.parse(row.payload);
 const prefix=JSON.stringify([op.snapshotId]).slice(0,-1)+',';
 const count=await db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_quantity_source' AND record_key>=? AND record_key<?").bind(prefix,prefix+'\uffff').first();
 if(!quantityManifestValid(manifest,policy,activation)||manifest.sourceId!==op.sourceId||manifest.sourceCount!==op.records||count.n!==manifest.sourceCount||policy.mode!=='daily-finished-v1'||policy.approved!==true)fail('Manifest hoặc tập nguồn đã chốt không khớp; không tự tạo lại.');
}
// Explicit supersession of a prepared snapshot, never a way around activation CAS.
// The old snapshot is retained, and the new LIVE copy/pointer/audit/receipt commit together.
async function reprepare(db,actor,context,body){
 const reason=body.reason.trim(),fingerprint=await recordRevision(JSON.stringify([context.metadata.snapshotId,actor.login,body.expectedRevision,reason]));
 const saved=()=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(reprepareRequests,body.requestIdempotency).first();
 async function receipt(row,replayed){
  const r=JSON.parse(row.payload);
  if(r.fingerprint!==fingerprint||r.actor!==actor.login||r.sourceId!==context.metadata.snapshotId)fail('Mã chuẩn bị lại không khớp người, nguồn hoặc nội dung.');
  const op=r.preparedOperation,current=await sealed(db);
  if(current?.value.state==='active')await verifyActive(db,current.value);
  return {...publicOperation(op),revision:await recordRevision(JSON.stringify(op)),replayed,current:current?.value.snapshotId===op.snapshotId&&current.value.state==='prepared',currentOperation:publicOperation(current?.value)};
 }
 const prior=await saved();if(prior)return receipt(prior,true);
 const current=await sealed(db),op=current?.value;
 if(!current||op.state!=='prepared'||op.receivedAt||op.model!==quantityCutoverModel||op.actor!==actor.login||op.sourceId!==context.metadata.snapshotId||current.revision!==body.expectedRevision||op.nonce===body.requestIdempotency)fail('Chỉ chuẩn bị lại bản prepared đúng người, nguồn và revision; cần mã thao tác mới.');
 const old=await select(db,oldOperation),oldRaw=old?.payload||'',at=new Date().toISOString();
 const next={model:quantityCutoverModel,state:'prepared',snapshotId:'QTY-'+crypto.randomUUID(),sourceId:context.metadata.snapshotId,actor:actor.login,nonce:body.requestIdempotency,preparedAt:at,oldOperation:oldRaw,supersedesSnapshotId:op.snapshotId};
 const audit={action:'QUANTITY_REPREPARE',actor:actor.login,at,reason,requestIdempotency:body.requestIdempotency,previousSnapshotId:op.snapshotId,previousRevision:current.revision,previousOperationRaw:current.raw,nextSnapshotId:next.snapshotId,sourceId:next.sourceId};
 const request={fingerprint,actor:actor.login,sourceId:next.sourceId,expectedRevision:current.revision,reason,previousSnapshotId:op.snapshotId,at};
 try{await db.batch([
  fence(db,`EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key='global' AND payload=?)`,[operation,current.raw]),
  fence(db,absent),oldFence(db,oldRaw),fence(db,bounds),
  fence(db,"NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND json_extract(json_extract(payload,'$.previousOperationRaw'),'$.nonce')=?)",[operationHistory,body.requestIdempotency]),
  db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(operationHistory,op.snapshotId,JSON.stringify({...audit,state:'superseded'}),actor.login,at),
  db.prepare(`INSERT INTO app_records SELECT ?,json_array(?,entity,record_key),payload,updated_by,updated_at FROM (${live})`).bind(staged,next.snapshotId),
  db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key='global' AND payload=?").bind(JSON.stringify(next),actor.login,at,operation,current.raw),
  db.prepare(`UPDATE app_records SET payload=json_set(payload,'$.records',(SELECT records FROM (${profile})),'$.bytes',(SELECT bytes FROM (${profile}))) WHERE entity=? AND record_key='global'`).bind(operation),
  db.prepare("INSERT INTO app_records SELECT ?,?,json_set(?,'$.preparedOperation',json(payload)),?,? FROM app_records WHERE entity=? AND record_key='global'").bind(reprepareRequests,body.requestIdempotency,JSON.stringify(request),actor.login,at,operation),
  db.prepare("INSERT INTO app_records SELECT 'admin_audit',?,json_set(?,'$.preparedOperation',json(payload)),?,? FROM app_records WHERE entity=? AND record_key='global'").bind('QTY-REPREPARE-'+crypto.randomUUID(),JSON.stringify(audit),actor.login,at,operation)
 ]);}catch{
  // A concurrent identical request or a lost acknowledgement may already have committed.
  const committed=await saved();if(committed)return receipt(committed,true);
  fail('Chuẩn bị lại không commit: revision, policy/lease, ngân sách hoặc cạnh tranh đã thay đổi; giữ nguyên để đối chiếu.');
 }
 const committed=await saved();if(!committed)fail('Chưa xác minh được kết quả chuẩn bị lại; đọc trạng thái và giữ nguyên mã thao tác.');
 return receipt(committed,false);
}
async function activate(db,actor,context,body){
 const current=await sealed(db);if(!current||!operationMatches(current.value,actor,context,body.requestIdempotency))fail('Bản chuẩn bị không khớp nguồn, người hoặc mã thao tác.');
 const op=current.value;if(body.expectedRevision!==current.revision&&!(op.state==='active'&&body.expectedRevision===op.preparedRevision))fail('Phiên bản chuẩn bị đã thay đổi.');
 if(op.state==='active'){
  // Replay must not recreate a missing activation marker or recapture new data.
  await verifyActive(db,op);
  const replay=await activateQuantityCutover(db,{snapshotId:op.snapshotId},actor,{sourceId:op.sourceId});
  return {...publicOperation(op),revision:current.revision,replayed:replay.replayed};
 }
 if(op.state!=='prepared')fail('Trạng thái chuẩn bị không hợp lệ.');
 await assertLegacyHoursReady(db);
 const frozen=`SELECT json_extract(record_key,'$[1]') AS entity,json_extract(record_key,'$[2]') AS record_key,payload,updated_by,updated_at FROM app_records WHERE entity='${staged}' AND json_extract(record_key,'$[0]')=?`;
 // Compare bytes AND membership in both directions at the commit boundary.
 const equal=`(SELECT count(*) FROM (${frozen}))=${op.records} AND NOT EXISTS(SELECT * FROM (${live}) EXCEPT SELECT * FROM (${frozen})) AND NOT EXISTS(SELECT * FROM (${frozen}) EXCEPT SELECT * FROM (${live}))`;
 const wrapped={prepare:sql=>db.prepare(sql),async batch(statements){
  const result=await db.batch([
   fence(db,`EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key='global' AND payload=?)`,[operation,current.raw]),
   fence(db,absent),oldFence(db,op.oldOperation),fence(db,bounds),fence(db,equal,[op.snapshotId,op.snapshotId,op.snapshotId]),fence(db,legacyHoursReadySql),
   ...statements,
   db.prepare(`UPDATE app_records SET payload=json_set(payload,'$.state','active','$.preparedRevision',?,'$.receivedAt',(SELECT json_extract(payload,'$.receivedAt') FROM app_records WHERE entity='production_reporting_activation' AND record_key='global')),updated_at=? WHERE entity=? AND record_key='global' AND payload=?`).bind(current.revision,new Date().toISOString(),operation,current.raw)
  ]);return result.slice(6,-1);
 }};
 try{await activateQuantityCutover(wrapped,{snapshotId:op.snapshotId},actor,{sourceId:op.sourceId});}
 catch(error){if(error.status)throw error;fail('Kích hoạt không commit hoặc chưa xác định kết quả; đọc trạng thái và gửi lại cùng mã, không đổi dữ liệu.');}
 const after=await sealed(db);return {...publicOperation(after.value),revision:after.revision};
}
export async function mainQuantityActivation(request,env,context){
 const url=new URL(request.url),retired=['/api/qa-daily-output','/_qa/daily-output'].includes(url.pathname),page=url.pathname===mainQuantityPagePath;
 if(url.pathname!=='/api/main-quantity-activation'&&!retired&&!page)return null;
 if(url.origin!==mainQuantityIdentity.origin||!trusted(context))return json({error:'Sai nguồn hoặc môi trường MAIN.'},403);
 try{
  const actor=await sitePrincipal(request,env);
  if(page&&request.method==='GET'&&(!actor?.isAdmin||actor.line||actor.isSetupAdmin||actor.authMode==='quick_line'))return mainQuantityLoginPage();
  if(!actor?.isAdmin||actor.line||actor.isSetupAdmin||actor.authMode==='quick_line'||!actor.login)fail('Chỉ Admin toàn quyền qua phiên đăng nhập hiện có.',403);
  if(page){
   if(request.method!=='GET')return json({error:'Trang quản trị chỉ cho phép GET.'},405);
   return mainQuantityActivationPage({sourceId:context.metadata.snapshotId,actorKey:await recordRevision(JSON.stringify([mainQuantityIdentity.projectId,actor.login])),nonce:crypto.randomUUID(),projectId:mainQuantityIdentity.projectId});
  }
  if(retired)return json({error:'Đường kích hoạt cũ không hỗ trợ mô hình receipt PR9.'},410);
  if(request.method==='GET'){const op=await sealed(env.DB);const config=await env.DB.prepare("SELECT count(*) n FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation') AND record_key='global'").first();if(config.n&&op?.value.state!=='active')fail('Đã có cấu hình kích hoạt khác; cần đối chiếu, không coi là PR9 sẵn sàng.');if(op?.value.state==='active')await verifyActive(env.DB,op.value);const own=op&&operationMatches(op.value,actor,context,op.value.nonce);return json({...publicOperation(op?.value),cutoverTiming:mainQuantityTiming,currentSourceId:context.metadata.snapshotId,...(op?{revision:op.revision}:{}),resume:own?{requestIdempotency:op.value.nonce}:null});}
  if(request.method!=='POST')return json({error:'Chỉ GET/POST.'},405);
  if(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')fail('Yêu cầu cùng nguồn và JSON.',403);
  const reader=request.body?.getReader();if(!reader)fail('Thiếu nội dung.',422);let length=0,chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>mainQuantityLimits.requestBytes){await reader.cancel();fail('Nội dung vượt giới hạn.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  let body;try{const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('JSON không hợp lệ.',422);}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','requestIdempotency','expectedRevision','acknowledge',...(body.action==='reprepare'?['reason']:[])].includes(k))||!['prepare','activate','reprepare'].includes(body.action)||!/^[A-Za-z0-9-]{16,80}$/.test(body.requestIdempotency||''))fail('Hợp đồng kích hoạt không hợp lệ; nguồn và giờ do server cấp.',422);
  if(body.action==='activate'&&(body.acknowledge!==true||typeof body.expectedRevision!=='string'))fail('Cần xác nhận rõ và revision chuẩn bị.',422);
  if(body.action==='reprepare'&&(body.acknowledge!==true||typeof body.expectedRevision!=='string'||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>240))fail('Chuẩn bị lại cần xác nhận, revision và lý do 1–240 ký tự.',422);
  return json(await ({prepare,activate,reprepare}[body.action])(env.DB,actor,context,body));
 }catch(error){return json({error:error.status?error.message:'Không đọc được trạng thái; không tự bỏ qua cổng.'},error.status||503);}
}
