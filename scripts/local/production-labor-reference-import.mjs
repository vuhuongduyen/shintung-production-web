import {readRecordPages} from './production-record-pages.mjs';
import {readDailyOutputPolicy} from './production-daily-output.mjs';
import {readLegacyPreservation} from './production-legacy-preservation.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {siteCatalog} from '../../lib/site-catalog.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {previewFixedLaborReferences} from '../../lib/production-labor-reference-snapshot.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';

const entity='production_labor_reference_snapshot';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const encoded=v=>JSON.stringify(canonical(v));
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
// These three entities cannot affect workflow/rate resolution. Include all other
// records, including policy, imported history, permissions and outer timestamps.
const sourceWhere="entity NOT IN ('production_labor_reference_snapshot','admin_audit','active_viewer')";
const readSource=db=>readRecordPages(db,{where:sourceWhere});
const digest=v=>recordRevision(encoded(v));

export function laborImportTargetAllowed(hostname){
 return hostname==='onspa-thu-nghiem.shintung-vn-4458.chatgpt.site';
}
function chunks(rows){
 const result=[];let chunk=[],bytes=2;
 for(const row of rows){const size=new TextEncoder().encode(JSON.stringify(row)).length+1;
  if(chunk.length&&bytes+size>512*1024){result.push(chunk);chunk=[];bytes=2;}
  chunk.push(row);bytes+=size;
 }
 if(chunk.length)result.push(chunk);
 return result;
}
// D1 batch is transactional. A failing JSON assertion rolls back the complete
// batch. One JSON binding per bounded page avoids D1's SQL variable limit.
function sourceGuards(db,rows){
 const guards=[db.prepare(`SELECT json(CASE WHEN (SELECT count(*) FROM app_records WHERE ${sourceWhere})=? THEN 'true' ELSE 'SOURCE_CHANGED' END)`).bind(rows.length)];
 const small=[],large=[];
 for(const row of rows)(new TextEncoder().encode(JSON.stringify(row)).length<=512*1024?small:large).push(row);
 for(const row of large){
  const bytes=new TextEncoder().encode(row.payload);
  guards.push(db.prepare("SELECT json(CASE WHEN EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND updated_at IS ? AND updated_by IS ? AND length(CAST(payload AS BLOB))=?) THEN 'true' ELSE 'SOURCE_CHANGED' END)").bind(row.entity,row.record_key,row.updated_at,row.updated_by,bytes.length));
  for(let start=0;start<bytes.length;start+=65536){
   const part=bytes.subarray(start,start+65536),hex=Array.from(part,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
   guards.push(db.prepare("SELECT json(CASE WHEN EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND hex(substr(CAST(payload AS BLOB),?,?))=?) THEN 'true' ELSE 'SOURCE_CHANGED' END)").bind(row.entity,row.record_key,start+1,part.length,hex));
  }
 }
 for(const page of chunks(small))guards.push(db.prepare(`SELECT json(CASE WHEN NOT EXISTS (
  SELECT 1 FROM json_each(?) expected LEFT JOIN app_records actual
  ON actual.entity=json_extract(expected.value,'$.entity') AND actual.record_key=json_extract(expected.value,'$.record_key')
  WHERE actual.payload IS NOT json_extract(expected.value,'$.payload')
     OR actual.updated_at IS NOT json_extract(expected.value,'$.updated_at')
     OR actual.updated_by IS NOT json_extract(expected.value,'$.updated_by')
 ) THEN 'true' ELSE 'SOURCE_CHANGED' END)`).bind(JSON.stringify(page)));
 return guards;
}

export async function importLaborReferenceSnapshot(db,body,actor,{hostname}={}){
 if(!actor?.isAdmin||actor.line||actor.authMode==='quick_line')fail('Chỉ Admin không giới hạn Line được nhập căn cứ.',403);
 if(!laborImportTargetAllowed(hostname))fail('Công cụ nhập căn cứ chỉ dùng tại web thử QA.',403);
 if(!['preview','apply'].includes(body?.action))fail('Chọn preview hoặc apply.',400);
 const manifest=body.manifest,omissions=body.omissions??[];
 if(!manifest||manifest.kind!=='labor-reference-snapshot-v1'||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>5000||!Array.isArray(omissions))fail('Bản căn cứ không hợp lệ.',400);
 const {digest:manifestDigest,...content}=manifest;
 if(!/^[a-f0-9]{64}$/.test(manifestDigest)||await digest(content)!==manifestDigest)fail('Digest căn cứ không khớp.',400);
 if(new Set(manifest.entries.map(e=>e.reportId)).size!==manifest.entries.length)fail('Trùng phiếu trong căn cứ.',400);
 if(omissions.some(o=>!o||Object.keys(o).sort().join(',')!=='date,orderCode,sku'||!o.orderCode||!o.sku||!/^\d{4}-\d{2}-\d{2}$/.test(o.date)))fail('Ngoại lệ phải ghi rõ lệnh, SKU và ngày.',400);
 if(body.action==='apply'&&(body.confirmDigest!==manifestDigest||!/^[a-f0-9]{64}$/.test(body.expectedSourceRevision||'')))fail('Cần xác nhận đúng digest và phiên bản nguồn từ preview.',400);
 const existing=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,manifestDigest).first();
 if(existing){
  if(encoded(JSON.parse(existing.payload))!==encoded(manifest))fail('Khóa căn cứ đã tồn tại với nội dung khác.');
  return {ok:true,status:'already-present',digest:manifestDigest,count:manifest.entries.length,activated:false};
 }
 const before=await readSource(db);
 const activation=await readDailyOutputPolicy(db);
 if(activation.policy?.cutoverReached&&!activation.policy.active)fail('Chính sách báo công chưa sẵn sàng; chưa nhập căn cứ.');
 const wrap=r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at});
 const catalog=siteCatalog(before.filter(r=>r.entity==='sku').map(wrap));
 const legacyPreservation=await readLegacyPreservation(db,activation.policy,actor);
 const workflow=await readProductionWorkflow(db,actor,catalog,{legacyPreservation,includeJournalHours:true,includeDerivedHours:!activation.policy?.active});
 const menu=siteLaborHours(before.filter(r=>r.entity==='labor_hours').map(wrap),null,before.filter(r=>r.entity==='labor_hours_history').map(wrap));
 const preview=await previewFixedLaborReferences({reports:workflow.reports,orders:workflow.orders,menu,omissions,observedAt:manifest.observedAt});
 if(encoded(preview.manifest)!==encoded(manifest))fail('Căn cứ không khớp phiếu hoặc lịch sử Giờ công hiện hành; tạo lại preview.');
 const sourceRevision=await digest({rows:before,omissions,manifestDigest});
 if(await digest(await readSource(db))!==await digest(before))fail('Nguồn đã thay đổi khi kiểm; chưa nhập căn cứ.');
 if(body.action==='preview')return {ok:true,status:'preview-only',digest:manifestDigest,count:manifest.entries.length,sourceRevision,counts:preview.counts,activated:false};
 if(body.expectedSourceRevision!==sourceRevision)fail('Phiên bản nguồn khác preview đã duyệt; chưa nhập căn cứ.');
 const now=new Date().toISOString();
 try{
  await db.batch([...sourceGuards(db,before),db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(entity,manifestDigest,JSON.stringify(manifest),actor.login,now)]);
 }catch{fail('Giao dịch nhập không hoàn tất; kiểm lại nguồn và đọc lại khóa căn cứ trước khi thử lại.');}
 const saved=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,manifestDigest).first();
 if(!saved||encoded(JSON.parse(saved.payload))!==encoded(manifest))fail('Đọc lại căn cứ không khớp; không kích hoạt cấu hình.');
 return {ok:true,status:'stored',digest:manifestDigest,count:manifest.entries.length,activated:false};
}
