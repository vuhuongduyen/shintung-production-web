import {bomMetadataResolver,bomClassifications} from '../../lib/bom-metadata.mjs';
import {randomUUID} from 'node:crypto';
import bomData from '../../app/bom-data.json' with {type:'json'};
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {syncBomSources,sourceFromSku} from '../../lib/bom-source.mjs';
import {validateBomNumbers,bomDate} from '../../lib/bom-rules.mjs';
import {normalizeBomWaste} from '../../lib/bom-waste.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const digest = bom => {
  const {confirmationSnapshot,confirmationDigest,...data}=bom;
  return recordRevision(JSON.stringify(data));
};
export async function mutateBom(db,body,actor,catalog=[]) {
  if(!actor?.login)fail('Vui lòng đăng nhập.',401);
  const key=String(body.key||'').trim().toUpperCase(),action=body.action;
  if(!key||!['save','confirm','undo'].includes(action))fail('Thao tác BOM không hợp lệ.');
  const row=await db.prepare("SELECT payload FROM app_records WHERE entity='bom' AND record_key=?").bind(key).first();
  if(!Object.hasOwn(body,'expectedRevision')||body.expectedRevision!==await recordRevision(row?.payload))fail(conflictMessage,409);
  const original=bomData.find(b=>b.sku===key),before=row?JSON.parse(row.payload):original?{...original,status:'Đã xác nhận'}:null;
  const now=new Date().toISOString(),date=new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'});
  let next;
  if(action==='undo'){
    if(before?.status!=='Đã xác nhận'||!before.confirmationSnapshot)fail('BOM này không có bản trước xác nhận. Nếu cần khôi phục thay đổi, chọn phiếu thay đổi tương ứng và Hủy xác nhận.',409);
    if(before.confirmationDigest!==await digest(before))fail('BOM đã được sửa sau khi xác nhận; không thể khôi phục đè lên thay đổi mới.',409);
    next={...before.confirmationSnapshot,modifiedBy:actor.login,modifiedAt:now};
  }else{
    const masters=new Map(catalog.map(r=>[r.key.toUpperCase(),r.payload]));
    const parent=masters.get(key);
    if(!usableSku(parent))fail('SKU phải tồn tại, đã xác nhận và đang sử dụng trong SKU Master.',409);
    if(!parent.name||!parent.group||sourceFromSku(parent)==='Mua')fail('SKU thiếu tên/nhóm hoặc là hàng mua, không được lập BOM.',409);
    if(action==='save'){
      if(before?.status==='Đã xác nhận')fail('BOM đã xác nhận phải sửa qua Phiếu thay đổi BOM.',409);
      if(body.createOnly&&before)fail('SKU đã có BOM; không thêm trùng.',409);
      if(!body.payload||body.payload.sku!==key)fail('Mã BOM không hợp lệ.');
      next={...body.payload,sku:key,name:parent.name,group:parent.group,category:body.payload.category,status:'Chờ xác nhận',version:before?.version||'0001',setup:before?.setup||date,createdBy:before?.createdBy||actor.login,modifiedBy:actor.login,modifiedAt:now};
      if(!bomClassifications.includes(next.category))fail('Vui lòng chọn Phân loại BOM hợp lệ.');
      delete next.confirmationSnapshot;delete next.confirmationDigest;
    }else{
      if(before?.status!=='Chờ xác nhận')fail('Chỉ xác nhận BOM đang chờ.',409);
      next={...before,status:'Đã xác nhận',confirmedBy:actor.login,confirmedDate:date,confirmedAt:now,confirmationSnapshot:before,items:before.items.map(item=>({...item,effective:bomDate(item.effective)===null?date:item.effective}))};
    }
    validateBomNumbers(next);
    const seen=new Set();
    for(const item of next.items){
      if(!usableSku(masters.get(String(item.code).toUpperCase())))fail(`Mã ${item.code} chưa được xác nhận/đang sử dụng trong SKU Master.`,409);
      if(item.code===key||seen.has(item.code))fail('BOM không được dùng chính mã cha hoặc lặp mã con.');
      seen.add(item.code);
      if(normalizeBomWaste(item.waste)===null)fail(`Hao hụt ${item.code} phải là tỷ lệ phần trăm không âm.`);
    }
    next=bomMetadataResolver(catalog.map(r=>r.payload),bomData)(syncBomSources(next,catalog.map(r=>r.payload)));
    if(action==='confirm')next.confirmationDigest=await digest(next);
  }
  const raw=JSON.stringify(next),guard=randomUUID();
  const condition=row?"EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=? AND payload=?)":"NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom' AND record_key=?)";
  const bindings=row?[key,row.payload]:[key];
  const writes=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom_lifecycle_guard',?,?,?,? WHERE ${condition} AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='bom_change' AND json_extract(payload,'$.status')='Chờ xác nhận' AND (json_extract(payload,'$.sku')=? OR EXISTS(SELECT 1 FROM json_each(payload,'$.skus') WHERE value=?)))`).bind(guard,'{}',actor.login,now,...bindings,key,key)];
  writes.push(row?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='bom' AND record_key=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='bom_lifecycle_guard' AND record_key=?)").bind(raw,actor.login,now,key,guard):db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'bom',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='bom_lifecycle_guard' AND record_key=?)").bind(key,raw,actor.login,now,guard));
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(randomUUID(),JSON.stringify({entity:'bom',key,action,before:row?JSON.parse(row.payload):before,after:next,actor:actor.login,at:now}),actor.login,now));
  writes.push(db.prepare("DELETE FROM app_records WHERE entity='bom_lifecycle_guard' AND record_key=?").bind(guard));
  const result=await db.batch(writes);
  if(result[0].meta.changes!==1||result[1].meta.changes!==1)fail('BOM đã thay đổi hoặc có phiếu chờ xác nhận. Tải lại để kiểm tra.',409);
  return {ok:true,bom:next,revision:await recordRevision(raw)};
}
