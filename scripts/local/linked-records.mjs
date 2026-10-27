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
  const old=[];
  for(const op of ops){
    const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(op.entity,op.key).first();
    if(op.expectedRevision!==await recordRevision(row?.payload)||op.createOnly&&row)fail(conflictMessage,409);
    if(row && JSON.parse(row.payload).cancelled)fail("Dữ liệu đã Hủy; không được áp dụng lại bằng thao tác sửa/xác nhận.",409);
    old.push(row?.payload??null);
  }
  const guardKey=randomUUID(),now=new Date().toISOString();
  const checks=ops.map((op,index)=>old[index]===null
    ?'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)'
    :'EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)');
  const checkValues=ops.flatMap((op,index)=>old[index]===null?[op.entity,op.key]:[op.entity,op.key,old[index]]);
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
