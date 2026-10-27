import {commitRecordWithAudit,recordAuditStatement} from '../../lib/record-mutation-audit.mjs';
import {randomUUID} from 'node:crypto';
import {monday,weekEnd} from '../../lib/production-plan.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const display=iso=>`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`;
const stored=async(db,entity,key)=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();
const parse=row=>row?JSON.parse(row.payload):null;
const active=s=>['Đã chốt','Đã được Production_engine sử dụng'].includes(s.status);

export async function mutateInventoryImport(db,body,actor,clock=()=>new Date()){
 if(!actor?.login)fail('Vui lòng đăng nhập ONSPA.',401);
 const now=clock().toISOString(),action=body?.action;
 if(action==='upload'){
  const rows=body.rows,sourceFile=String(body.sourceFile||'').trim();
  if(!sourceFile||sourceFile.length>240||!Array.isArray(rows)||!rows.length||rows.length>20000||rows.some(r=>!r||typeof r.sku!=='string'||!r.sku.trim()||!['TP','KD'].includes(r.warehouse)||!Number.isFinite(Number(r.qty))||Number(r.qty)<0))fail('File tồn kho không có dữ liệu TP/KD hợp lệ.');
  const key=`ERP-${randomUUID()}`,payload={sourceFile,importedAt:now,importedBy:actor.login,weekKey:'',status:'Chờ chốt',rows};
  const write=db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind('inventory',key,JSON.stringify(payload),actor.login,now);
  await commitRecordWithAudit(db,write,{entity:'inventory',key,before:null,after:payload,actor,at:now,source:'inventory-import',action:'upload'});
  return {record:{key,...payload}};
 }
 const key=String(body.key||'').trim(),raw=await stored(db,'inventory',key),record=parse(raw);
 if(!record||record._deleted)fail('Không tìm thấy file tải lên còn hiệu lực.',404);
 if(action==='cancel'){
  if(record.weekKey||record.snapshotId){
   const snapshots=(await db.prepare("SELECT payload FROM app_records WHERE entity='inventory_snapshot'").all()).results.map(parse);
   if(snapshots.some(s=>active(s)&&(s.sourceImportKey===key||record.snapshotId&&s.id===record.snapshotId)))fail('File này đã được chốt tồn. Hãy mở chốt trước khi hủy bản tải.',409);
  }
  const next={...record,status:'Đã hủy',_deleted:true,cancelledBy:actor.login,cancelledAt:now};
  const write=db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='inventory' AND record_key=? AND payload=?").bind(JSON.stringify(next),actor.login,now,key,raw.payload);
  const result=await commitRecordWithAudit(db,write,{entity:'inventory',key,before:record,after:next,actor,at:now,source:'inventory-import',action:'cancel'});
  if(result.meta.changes!==1)fail('File vừa được người khác cập nhật. Tải lại để kiểm tra.',409);
  return {record:{key,...next}};
 }
 if(action!=='commit')fail('Thao tác tồn kho không hợp lệ.');
 const week=String(body.week||'');
 if(!week||monday(week)!==week)fail('Chọn tuần kế hoạch bắt đầu thứ Hai trước khi chốt.');
 if(record.weekKey&&record.weekKey!==week)fail('File cũ đã gắn với tuần khác. Hãy hủy bản tải sai rồi tải lại file.',409);
 if(!Array.isArray(record.rows)||!record.rows.length||record.status==='Đã chốt')fail('File đã được chốt hoặc không có dữ liệu để chốt. Hãy tải file mới.',409);
 const snapshots=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='inventory_snapshot'").all()).results.map(s=>({key:s.record_key,raw:s.payload,data:JSON.parse(s.payload)}));
 if(snapshots.some(s=>s.data.weekKey===week&&active(s.data)))fail('Tuần đã có bản chốt. Hãy mở chốt trước khi chốt lại.',409);
 const grouped=new Map();for(const row of record.rows){if(!['TP','KD'].includes(row.warehouse)||!Number.isFinite(Number(row.qty))||Number(row.qty)<0)fail('Dữ liệu tồn kho không hợp lệ.',409);
  const item=grouped.get(row.sku)||{sku:row.sku,name:row.name,spec:row.spec||'—',unit:row.unit||'—',tpQty:0,kdQty:0,totalQty:0,sourceUpdatedAt:row.snapshotAt};
  if(row.warehouse==='TP')item.tpQty+=Number(row.qty);else item.kdQty+=Number(row.qty);item.totalQty=item.tpQty+item.kdQty;grouped.set(row.sku,item);
 }
 const items=[...grouped.values()].sort((a,b)=>a.sku.localeCompare(b.sku));
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock()).replaceAll('-','');
 const prior=snapshots.find(s=>s.data.weekKey===week&&s.data.status==='Đã mở chốt');
 const snapshot={id:randomUUID(),code:`TON-${day}-${String(snapshots.filter(s=>s.data.code?.startsWith(`TON-${day}`)).length+1).padStart(3,'0')}`,weekKey:week,weekStart:display(week),weekEnd:display(weekEnd(week)),snapshotAt:now,skuCount:items.length,totalTp:items.reduce((s,i)=>s+i.tpQty,0),totalKd:items.reduce((s,i)=>s+i.kdQty,0),totalStock:items.reduce((s,i)=>s+i.totalQty,0),createdBy:actor.login,status:'Đã chốt',replacesSnapshotId:prior?.data.id,sourceImportKey:key,items};
 const next={...record,weekKey:week,status:'Đã chốt',committedAt:now,committedBy:actor.login,snapshotId:snapshot.id};
 // Both writes are conditional inside one D1 transaction: a simultaneous chốt,
 // cancel, or change to this upload cannot leave a half-committed week.
 const writes=[
  db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='inventory' AND record_key=? AND payload=? AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND json_extract(payload,'$.weekKey')=? AND json_extract(payload,'$.status') IN ('Đã chốt','Đã được Production_engine sử dụng'))").bind(JSON.stringify(next),actor.login,now,key,raw.payload,week),
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'inventory_snapshot',?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='inventory' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND json_extract(payload,'$.weekKey')=? AND json_extract(payload,'$.status') IN ('Đã chốt','Đã được Production_engine sử dụng'))").bind(snapshot.id,JSON.stringify(snapshot),actor.login,now,key,JSON.stringify(next),week)
 ];
 if(prior)writes.push(db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='inventory_snapshot' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND record_key=?)").bind(JSON.stringify({...prior.data,status:'Đã thay thế bằng phiên bản mới',replacedBySnapshotId:snapshot.id}),actor.login,now,prior.key,prior.raw,snapshot.id));
 if(prior)writes.push(recordAuditStatement(db,{entity:'inventory_snapshot',key:prior.key,before:prior.data,after:{...prior.data,status:'Đã thay thế bằng phiên bản mới',replacedBySnapshotId:snapshot.id},actor,at:now,source:'inventory-import',action:'replace'}));
 const committed="EXISTS(SELECT 1 FROM app_records WHERE entity='inventory' AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND record_key=? AND payload=?)";
 const guardArgs=[key,JSON.stringify(next),snapshot.id,JSON.stringify(snapshot)];
 writes.push(recordAuditStatement(db,{entity:'inventory',key,before:record,after:next,actor,at:now,source:'inventory-import',action:'commit'},committed,guardArgs),recordAuditStatement(db,{entity:'inventory_snapshot',key:snapshot.id,before:null,after:snapshot,actor,at:now,source:'inventory-import',action:'create'},committed,guardArgs));
 const result=await db.batch(writes);
 if(result[0].meta.changes!==1||result[1].meta.changes!==1)fail('Dữ liệu tồn hoặc tuần chốt vừa thay đổi. Tải lại trước khi chốt.',409);
 return {record:{key,...next},snapshot};
}
