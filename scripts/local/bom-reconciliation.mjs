import {randomUUID} from 'node:crypto';
import bomData from '../../app/bom-data.json' with {type:'json'};
import manifest from '../../data/bom-pdf-20260930.json' with {type:'json'};
import {reconcileBom} from '../../lib/bom-reconciliation.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const originals=new Map(bomData.map(b=>[b.sku,{...b,status:'Đã xác nhận',setup:b.setup||b.items[0]?.effective||'',confirmedDate:b.setup||b.items[0]?.effective||'',confirmedBy:'SETUP_ADMIN'}]));
const skus=[...new Set([...manifest.patches.map(p=>p.sku),...Object.keys(manifest.roots)])].filter(sku=>originals.has(sku));
export async function reconcileBomPdf(db,body,actor){
 if(!actor?.login)fail('Vui lòng đăng nhập.',401);
 if(!actor.isAdmin)fail('Chỉ Admin được đối chiếu và cập nhật BOM từ PDF.',403);
 if(!['preview','apply'].includes(body?.action))fail('Thao tác không hợp lệ.');
 const stored=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='bom'").all()).results;
 const saved=new Map(stored.map(r=>[r.record_key,r.payload]));
 const pending=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='bom_change' AND json_extract(payload,'$.status')='Chờ xác nhận'").all()).results.map(r=>({key:r.record_key,...JSON.parse(r.payload)}));
 const scope=body.action==='apply'?body.skus:skus;
 if(!Array.isArray(scope)||scope.length> (body.action==='apply'?30:1000)||new Set(scope).size!==scope.length||scope.some(s=>!skus.includes(s)))fail('Danh sách BOM không hợp lệ.');
 const plans=[],blocked=[...manifest.blocked,...manifest.missing];
 for(const sku of scope){
  const raw=saved.get(sku)??null,base=raw?JSON.parse(raw):originals.get(sku);
  const result=reconcileBom(base,manifest);blocked.push(...result.blocked);
  if(pending.some(c=>(c.skus||[c.sku]).includes(sku))){blocked.push({parent:sku,code:'',reason:'BOM có phiếu thay đổi chờ xác nhận',pages:[]});continue;}
  if(result.changes.length)plans.push({sku,raw,revision:await recordRevision(raw),...result});
 }
 if(body.action==='preview')return {id:manifest.id,source:manifest.source,sha256:manifest.sha256,rows:manifest.rows,exclusions:manifest.outer.length,changes:plans.flatMap(p=>p.changes),boms:plans.map(p=>({sku:p.sku,revision:p.revision})),blocked};
 if(body.id!==manifest.id)fail('Bản đối chiếu đã thay đổi. Hãy xem lại.',409);
 for(const sku of scope)if(!Object.hasOwn(body.expectedRevisions||{},sku)||body.expectedRevisions[sku]!==await recordRevision(saved.get(sku)??null))fail(`${sku}: ${conflictMessage}`,409);
 if(plans.length!==scope.length)fail('BOM đã thay đổi hoặc có phiếu chờ xác nhận. Hãy xem lại đối chiếu.',409);
 const now=new Date().toISOString(),guard=randomUUID(),writes=[],guards=[];
 for(const p of plans){
  const key=`${guard}:${p.sku}`;guards.push(key);
  const condition=p.raw?"EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=? AND payload=?)":"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=?)";
  writes.push(db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom_pdf_guard',?,?,?,? WHERE ${condition} AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom_change' AND json_extract(payload,'$.status')='Chờ xác nhận' AND (json_extract(payload,'$.sku')=? OR EXISTS(SELECT 1 FROM json_each(payload,'$.skus') WHERE value=?)))`).bind(key,guard,actor.login,now,p.sku,...(p.raw?[p.raw]:[]),p.sku,p.sku));
 }
 writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom_pdf_guard',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity='bom_pdf_guard' AND payload=?)=?").bind(guard,'{}',actor.login,now,guard,plans.length));
 for(const p of plans){
  p.next={...p.next,version:String(Number(p.next.version||0)+1).padStart(4,'0'),modifiedDate:'30/09/2026',updatedBy:actor.login,updatedAt:now,pdfReconciliation:{id:manifest.id,sha256:manifest.sha256,at:now,by:actor.login}};
  const next=JSON.stringify(p.next);
  writes.push(p.raw?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='bom' AND record_key=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='bom_pdf_guard' AND record_key=?)").bind(next,actor.login,now,p.sku,guard):db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='bom_pdf_guard' AND record_key=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(p.sku,next,actor.login,now,guard));
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(randomUUID(),JSON.stringify({entity:'bom',key:p.sku,before:p.raw?JSON.parse(p.raw):originals.get(p.sku),after:p.next,actor:actor.login,at:now,reason:'Đối chiếu PDF: bổ sung nội dung và tách hao hụt',source:manifest.source,sha256:manifest.sha256,changes:p.changes}),actor.login,now));
 }
 writes.push(db.prepare("DELETE FROM app_records WHERE entity='bom_pdf_guard' AND (payload=? OR record_key=?)").bind(guard,guard));
 const results=await db.batch(writes);
 if(results[plans.length].meta.changes!==1)fail(conflictMessage,409);
 return {ok:true,count:plans.length,changes:plans.reduce((n,p)=>n+p.changes.length,0)};
}
