import {safetyLinkedPairError} from '../../lib/safety-linked-pair.mjs';
import {resolveLeadtimeVersion} from '../../lib/leadtime-effective.mjs';
import {confirmationDateError} from '../../lib/leadtime-confirmation.mjs';
import {randomUUID} from 'node:crypto';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {syncBomSources} from '../../lib/bom-source.mjs';
import {hasBaseLeadtime} from '../../lib/site-leadtime.mjs';

const allowed={
  'bom-change':new Set(['bom_change','bom']),
  leadtime:new Set(['leadtime_versions']),
  'safety-rule':new Set(['safety_rules']),
  'safety-group':new Set(['safety_rule_groups','safety_rules']),
};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};

// A single D1 batch acts as one transaction. Its first write reserves a guard
// only if *all* source versions still match. Each following write is gated by
// that guard; history is inserted only when the corresponding write succeeds.
export async function commitLinkedRecords(db,body,actor,{authorize=()=>true,transform=(p)=>p,catalog=[]}={}){
  if(!actor?.login)fail('Vui lòng đăng nhập ONSPA.',401);
  const kind=body?.kind,ops=body?.operations,permitted=allowed[kind];
  if(!permitted||!Array.isArray(ops)||!ops.length||ops.length>6)fail('Nhóm thay đổi không hợp lệ.');
  if(new Set(ops.map(op=>`${op.entity}:${op.key}`)).size!==ops.length)fail('Bản ghi trùng trong yêu cầu.');
  for(const op of ops){
    if(!permitted.has(op.entity)||typeof op.key!=='string'||!op.key||!op.payload||typeof op.payload!=='object'||Array.isArray(op.payload)||op.payload.id && op.payload.id!==op.key)fail('Bản ghi liên kết không hợp lệ.');
    if(!authorize(op.entity))fail('Không có quyền cập nhật dữ liệu liên kết.',403);
    if(!Object.hasOwn(op,'expectedRevision'))fail(conflictMessage,409);
  }
  if(kind==='bom-change'){
    const change=ops.find(op=>op.entity==='bom_change'),bom=ops.find(op=>op.entity==='bom');
    if(!change||ops.filter(op=>op.entity==='bom_change').length!==1||bom&&(bom.payload.sku!==change.payload.sku||bom.payload.changeDocument!==change.key))fail('Phiếu BOM và BOM nguồn không khớp.');
    const masters=new Map(catalog.map(row=>[String(row.key).toUpperCase(),row.payload]));
    const skuKeys=new Set();const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if(typeof value.sku==='string'&&value.sku)skuKeys.add(value.sku.trim().toUpperCase());if(typeof value.code==='string'&&value.code)skuKeys.add(value.code.trim().toUpperCase());for(const nested of Object.values(value))if(nested&&typeof nested==='object')visit(nested);};
    ops.forEach(op=>visit(op.payload));
    const blocked=[...skuKeys].filter(key=>!usableSku(masters.get(key)));if(blocked.length)fail('SKU chưa xác nhận hoặc chưa sử dụng: '+blocked.join(', '),409);
  }
  if(kind==='safety-rule'&&ops.length!==1||kind==='leadtime'&&ops.length>2)fail('Số bản ghi không hợp lệ.');
  if(kind==='leadtime'&&ops.some(op=>op.entity!=='leadtime_versions'))fail('Phiên bản Leadtime không hợp lệ.');
  if(kind==='safety-group'&&ops.filter(op=>op.entity==='safety_rule_groups').length<1)fail('Thiếu bộ quy tắc Safety Days.');
  if(kind!=='bom-change'&&ops.some(op=>!op.audit))fail('Mỗi thay đổi phải có lịch sử.');
  if(kind==='leadtime'){
    const op=ops[0],sku=String(op.payload.sku||'').trim().toUpperCase();
    const setting=await db.prepare("SELECT payload FROM app_records WHERE entity='leadtime' AND record_key=?").bind(sku).first();
    if(setting&&JSON.parse(setting.payload).cancelled)fail("Lead Time đã Hủy; không được tự áp dụng lại.",409);
    if(ops.some(item=>String(item.payload.sku||'').trim().toUpperCase()!==sku))fail('Các phiên bản Leadtime phải cùng SKU.');
    if(!catalog.some(row=>String(row.key).toUpperCase()===sku&&usableSku(row.payload)))fail('SKU chưa xác nhận hoặc chưa sử dụng.',409);
    if(op.operation==='create'){
      const duplicate=await db.prepare("SELECT 1 AS found FROM app_records WHERE entity='leadtime_versions' AND upper(json_extract(payload,'$.sku'))=? AND coalesce(json_extract(payload,'$._deleted'),0)<>1 AND coalesce(json_extract(payload,'$.status'),'') IN ('Nháp','Chờ xác nhận','Đang áp dụng') LIMIT 1").bind(sku).first();
      if(hasBaseLeadtime(sku)||duplicate)fail(`SKU ${sku} đã có Leadtime. Vui lòng chọn dòng và dùng chức năng Sửa.`,409);
    }
  }
  const publicationEntities=kind==='safety-rule'?['safety_rules','safety_rule_groups']:[...permitted];
  const publicationRows=kind==='bom-change'?[]:(await db.prepare(`SELECT entity,record_key,payload FROM app_records WHERE entity IN (${publicationEntities.map(()=>'?').join(',')})`).bind(...publicationEntities).all()).results;
  const publicationExpected=JSON.stringify(publicationRows.map(r=>[r.entity,r.record_key,r.payload]));
  if(new TextEncoder().encode(publicationExpected).length>8*1024*1024)fail('Lịch sử phiên bản vượt giới hạn đối chiếu; chưa lưu.',422);
  const old=[];
  for(const op of ops){
    const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(op.entity,op.key).first();
    if(op.expectedRevision!==await recordRevision(row?.payload)||op.createOnly&&row)fail(conflictMessage,409);
    if(row && JSON.parse(row.payload).cancelled)fail("Dữ liệu đã Hủy; không được áp dụng lại bằng thao tác sửa/xác nhận.",409);
    old.push(row?.payload??null);
  }
  for(let i=0;i<ops.length;i++){
    if(old[i]===null)continue;
    const before=JSON.parse(old[i]),op=ops[i],lead=op.entity==='leadtime_versions',from=lead?'validFrom':'effectiveFrom',to=lead?'validTo':'effectiveTo';
    if(op.payload.status==='Hết hiệu lực'&&before.status!=='Hết hiệu lực'){
      const replacement=ops.find(other=>other.entity===op.entity&&other.key!==op.key&&['Đang áp dụng','Đã xác nhận'].includes(other.payload.status)&&other.payload[from]===op.payload[to]&&(lead?other.payload.sku===op.payload.sku:other.payload.group===op.payload.group));
      const priorReplacement=replacement?old[ops.indexOf(replacement)]:null;
      if(!replacement || priorReplacement && !['Nháp','Chờ xác nhận'].includes(JSON.parse(priorReplacement).status))fail('Kết thúc hiệu lực phải đi cùng phiên bản thay thế trong một giao dịch.',409);
    }
    if(before.status==='Hết hiệu lực'&&op.payload.status==='Đang áp dụng'){
      const cancelled=ops.find(other=>other.entity===op.entity&&other.key!==op.key&&['Đã hủy xác nhận','Đã hủy'].includes(other.payload.status)&&other.payload[from]===before[to]);
      if(!cancelled)fail('Chỉ khôi phục phiên bản trước khi hủy phiên bản thay thế trong cùng giao dịch.',409);
    }
  }
  const guardKey=randomUUID(),now=new Date().toISOString();
  for(let index=0;index<ops.length;index++){const error=confirmationDateError(ops[index].entity,ops[index].payload,old[index]===null?null:JSON.parse(old[index]),now);if(error)fail(error,409);}
  if(kind==='safety-rule'||kind==='safety-group'){
    const pairError=safetyLinkedPairError(ops,publicationRows);
    if(pairError)fail(pairError,409);
  }
  if(kind==='leadtime'){
    const final=publicationRows.filter(r=>!ops.some(op=>op.entity===r.entity&&op.key===r.record_key)).map(r=>({...JSON.parse(r.payload),id:r.record_key})).concat(ops.map(op=>op.payload));
    for(const op of ops.filter(op=>op.payload.status==='Đang áp dụng')){
      const chosen=resolveLeadtimeVersion(final,op.payload.sku,now).selected;
      if(!chosen||chosen.id!==op.key)fail('Phiên bản Leadtime chồng lấn hoặc chưa đủ căn cứ hiệu lực.',409);
    }
  }
  if(kind==='safety-rule'||kind==='safety-group'){
    const final=publicationRows.filter(r=>!ops.some(op=>op.entity===r.entity&&op.key===r.record_key)).map(r=>({entity:r.entity,key:r.record_key,payload:JSON.parse(r.payload)})).concat(ops);
    const active=p=>!p._deleted&&!p.cancelled&&['Đang áp dụng','Đã xác nhận','Sắp có hiệu lực'].includes(p.status);
    for(const op of ops.filter(op=>active(op.payload))){
      if(final.some(other=>other.entity===op.entity&&other.key!==op.key&&active(other.payload)&&(op.entity!=='safety_rule_groups'||other.payload.group===op.payload.group)&&other.payload.effectiveFrom<=(op.payload.effectiveTo||'9999-12-31')&&(other.payload.effectiveTo||'9999-12-31')>=op.payload.effectiveFrom))fail('Khoảng hiệu lực Safety Days chồng với phiên bản đang áp dụng; cần thay thế trong cùng giao dịch.',409);
    }
  }
  const checks=ops.map((op,index)=>old[index]===null
    ?'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)'
    :'EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)');
  const checkValues=ops.flatMap((op,index)=>old[index]===null?[op.entity,op.key]:[op.entity,op.key,old[index]]);
  if(kind!=='bom-change'){
    checks.push(`((SELECT count(*) FROM app_records WHERE entity IN (${publicationEntities.map(()=>'?').join(',')}))=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN app_records a ON a.entity=json_extract(j.value,'$[0]') AND a.record_key=json_extract(j.value,'$[1]') WHERE a.payload IS NOT json_extract(j.value,'$[2]')))`);
    checkValues.push(...publicationEntities,publicationRows.length,publicationExpected);
  }
  const guard=db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'linked_write_guard',?,?,?,? WHERE ${checks.join(' AND ')}`)
    .bind(guardKey,'{}',actor.login,now,...checkValues);
  const writes=[guard],saved=[];
  for(let index=0;index<ops.length;index++){
    const op=ops[index],before=old[index]===null?null:JSON.parse(old[index]);
    const attributed=transform(op.entity==='bom'?syncBomSources(op.payload,catalog.map(row=>row.payload)):op.payload,before,actor.login);
    const payload={...attributed,updatedBy:actor.login,updatedAt:now,createdBy:before?.createdBy||actor.login};
    const raw=JSON.stringify(payload);saved.push({entity:op.entity,key:op.key,payload,revision:await recordRevision(raw)});
    writes.push(old[index]===null
      ?db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='linked_write_guard' AND record_key=?) ON CONFLICT(entity,record_key) DO NOTHING").bind(op.entity,op.key,raw,actor.login,now,guardKey)
      :db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='linked_write_guard' AND record_key=?)").bind(raw,actor.login,now,op.entity,op.key,old[index],guardKey));
    writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1")
      .bind(randomUUID(),JSON.stringify({entity:op.entity,key:op.key,before,after:payload,actor:actor.login,at:now}),actor.login,now));
    if(op.audit){
      const auditEntity=kind==='leadtime'?'leadtime_audit':'safety_rule_audit';
      if(kind==='bom-change')fail('Phiếu BOM dùng lịch sử quản trị tự động.');
      writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='linked_write_guard' AND record_key=?)")
        .bind(auditEntity,randomUUID(),JSON.stringify({...op.audit,operator:actor.login,at:now}),actor.login,now,op.entity,op.key,raw,guardKey));
    }
  }
  writes.push(db.prepare("DELETE FROM app_records WHERE entity='linked_write_guard' AND record_key=?").bind(guardKey));
  const result=await db.batch(writes);
  if(result[0].meta.changes!==1||saved.some((_,index)=>{
    let position=1;for(let i=0;i<index;i++)position+=2+(ops[i].audit?1:0);
    return result[position].meta.changes!==1;
  }))fail(conflictMessage,409);
  return {ok:true,records:saved};
}
