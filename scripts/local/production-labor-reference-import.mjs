import {previewMenuPreservation,menuPreservationModel} from '../../lib/production-labor-menu-preservation.mjs';
import {createLaborImportSnapshot} from './labor-import-snapshot.mjs';
import {scanLaborImportSource} from './labor-import-source.mjs';
import {readRecordPages} from './production-record-pages.mjs';
import {readDailyOutputPolicy} from './production-daily-output.mjs';
import {readLegacyPreservation} from './production-legacy-preservation.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {siteCatalog} from '../../lib/site-catalog.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {previewFixedLaborReferences} from '../../lib/production-labor-reference-snapshot.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';

const entity='production_labor_reference_snapshot';
// A resource gate only: no source data or actor state survives a request.
let sourceCheckBusy=false;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const encoded=v=>JSON.stringify(canonical(v));
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const digest=v=>recordRevision(encoded(v));
const businessDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function laborImportTargetAllowed(hostname){
 return hostname==='onspa-thu-nghiem.shintung-vn-4458.chatgpt.site';
}
async function validateCurrentManifest(db,actor,manifest,omissions){
 const activation=await readDailyOutputPolicy(db);
 if(activation.policy?.cutoverReached&&!activation.policy.active)fail('Chính sách báo công chưa sẵn sàng; chưa nhập căn cứ.');
 const rows=await readRecordPages(db,{where:"entity IN ('sku','labor_hours','labor_hours_history')"});
 const wrap=r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at});
 const catalog=siteCatalog(rows.filter(r=>r.entity==='sku').map(wrap));
 const legacyPreservation=await readLegacyPreservation(db,activation.policy,actor);
 const workflow=await readProductionWorkflow(db,actor,catalog,{legacyPreservation,includeJournalHours:true,includeDerivedHours:!activation.policy?.active});
 const menu=siteLaborHours(rows.filter(r=>r.entity==='labor_hours').map(wrap),manifest.kind===menuPreservationModel?businessDay(manifest.observedAt):null,rows.filter(r=>r.entity==='labor_hours_history').map(wrap));
 const preview=await (manifest.kind===menuPreservationModel?previewMenuPreservation:previewFixedLaborReferences)({month:manifest.month,parentManifest:manifest.parentManifest,reports:workflow.reports,orders:workflow.orders,menu,omissions,observedAt:manifest.observedAt});
 if(encoded(preview.manifest)!==encoded(manifest))fail('Căn cứ không khớp phiếu hoặc lịch sử Giờ công hiện hành; tạo lại preview.');
 return {counts:preview.counts,summary:preview.summary};
}

export async function importLaborReferenceSnapshot(db,body,actor,{hostname}={}){
 if(!actor?.isAdmin||actor.line||actor.authMode==='quick_line')fail('Chỉ Admin không giới hạn Line được nhập căn cứ.',403);
 if(!laborImportTargetAllowed(hostname))fail('Công cụ nhập căn cứ chỉ dùng tại web thử QA.',403);
 if(!['preview','apply'].includes(body?.action))fail('Chọn preview hoặc apply.',400);
 const manifest=body.manifest,omissions=body.omissions??[];
 if(!manifest||!['labor-reference-snapshot-v1',menuPreservationModel].includes(manifest.kind)||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>5000||!Array.isArray(omissions))fail('Bản căn cứ không hợp lệ.',400);
 const {digest:manifestDigest,...content}=manifest;
 if(!/^[a-f0-9]{64}$/.test(manifestDigest)||await digest(content)!==manifestDigest)fail('Digest căn cứ không khớp.',400);
 if(new Set(manifest.entries.map(e=>e.reportId)).size!==manifest.entries.length)fail('Trùng phiếu trong căn cứ.',400);
 if(omissions.some(o=>!o||Object.keys(o).sort().join(',')!=='date,orderCode,sku'||!o.orderCode||!o.sku||!/^\d{4}-\d{2}-\d{2}$/.test(o.date)))fail('Ngoại lệ phải ghi rõ lệnh, SKU và ngày.',400);
 if(body.action==='apply'&&(body.confirmDigest!==manifestDigest||!/^[a-f0-9]{64}$/.test(body.expectedSourceRevision||'')))fail('Cần xác nhận đúng digest và phiên bản nguồn từ preview.',400);
 let parentRaw=null;
 if(manifest.kind===menuPreservationModel){
  if(omissions.length)fail('Bảo toàn menu không được loại phiếu khỏi tính quỹ.',400);
  const parent=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,manifest.parentManifest?.digest).first();
  if(!parent||encoded(JSON.parse(parent.payload))!==encoded(manifest.parentManifest))fail('Bản căn cứ trước không khớp.');
  parentRaw=parent.payload;
 }
 const existing=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,manifestDigest).first();
 if(existing){
  if(encoded(JSON.parse(existing.payload))!==encoded(manifest))fail('Khóa căn cứ đã tồn tại với nội dung khác.');
  return {ok:true,status:'already-present',digest:manifestDigest,count:manifest.entries.length,activated:false};
 }
 if(manifest.kind===menuPreservationModel&&(!Number.isFinite(Date.parse(manifest.observedAt))||Date.parse(manifest.observedAt)>Date.now()||businessDay(manifest.observedAt)!==businessDay(Date.now())))fail('Tạo lại preview menu từ nguồn QA trong ngày hiện hành.');
 if(sourceCheckBusy)fail('Đang có một lần kiểm căn cứ trên máy chủ. Vui lòng chờ rồi kiểm tra lại.',503);
 sourceCheckBusy=true;
 let snapshot;
 try{
 if(body.action==='apply')snapshot=await createLaborImportSnapshot(db);
 const sourceDb=snapshot?.reader??db;
 const before=await scanLaborImportSource(sourceDb);
 const {counts,summary}=await validateCurrentManifest(sourceDb,actor,manifest,omissions);
 // Apply validates the immutable DB snapshot; the commit compares every source row.
 const after=await scanLaborImportSource(sourceDb);
 if(before.revision!==after.revision||before.count!==after.count)fail('Nguồn đã thay đổi khi kiểm; chưa nhập căn cứ.');
 const sourceRevision=await digest({model:'db-snapshot-source-v3',revision:before.revision,count:before.count,omissions,manifestDigest});
 if(body.action==='preview')return {ok:true,status:'preview-only',digest:manifestDigest,count:manifest.entries.length,sourceRevision,counts,...(summary?{summary}:{}),sourceStats:{count:before.count,bytes:before.sourceBytes,guardBytes:before.guardBytes,maxPageBytes:before.maxPageBytes},activated:false};
 if(body.expectedSourceRevision!==sourceRevision)fail('Phiên bản nguồn khác preview đã duyệt; chưa nhập căn cứ.');
 const now=new Date().toISOString();
 try{
  await db.batch([snapshot.guard,...(parentRaw===null?[]:[db.prepare("SELECT json(CASE WHEN EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?) THEN 'true' ELSE 'PARENT_CHANGED' END)").bind(entity,manifest.parentManifest.digest,parentRaw)]),db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(entity,manifestDigest,JSON.stringify(manifest),actor.login,now),snapshot.dropStatement]);
 }catch{fail('Giao dịch nhập không hoàn tất; kiểm lại nguồn và đọc lại khóa căn cứ trước khi thử lại.');}
 const saved=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,manifestDigest).first();
 if(!saved||encoded(JSON.parse(saved.payload))!==encoded(manifest))fail('Đọc lại căn cứ không khớp; không kích hoạt cấu hình.');
 return {ok:true,status:'stored',digest:manifestDigest,count:manifest.entries.length,activated:false};
 }finally{try{if(snapshot)await snapshot.drop();}finally{sourceCheckBusy=false;}}
}
