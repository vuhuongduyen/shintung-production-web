import {randomUUID} from 'node:crypto';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {siteCatalog} from '../../lib/site-catalog.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import leadtime from '../../app/leadtime-data.json' with {type:'json'};
import {defaultSafetyGroups,defaultSafetyRuleSet} from '../../lib/basic-master-defaults.mjs';
import {canCancelMaster,isMasterCancelled} from '../../lib/basic-master.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const fallback=(entity,key)=>entity==='sku'?siteCatalog([]).find(r=>r.key===key)?.payload:entity==='labor_hours'?siteLaborHours([]).find(r=>r.key===key)?.payload:entity==='leadtime'?leadtime.find(r=>r.sku===key):entity==='safety_rule_groups'?defaultSafetyGroups.find(r=>r.id===key):null;
export async function cancelBasicMaster(db,body,actor){
 const entity=body.entity,key=String(body.key||'').trim();
 if(entity==='employees')fail('Không dùng Hủy nhân viên. Hãy sửa và nhập Ngày ngưng làm việc.',409);
 if(!canCancelMaster(actor,entity))fail('Không có quyền Hủy dữ liệu tại menu này.',403);
 const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();
 let before=row?JSON.parse(row.payload):fallback(entity,key);
 if(!before&&entity==='leadtime'){const v=await db.prepare("SELECT payload FROM app_records WHERE entity='leadtime_versions' AND upper(json_extract(payload,'$.sku'))=upper(?) ORDER BY updated_at DESC LIMIT 1").bind(key).first();if(v)before={sku:key,leadTime:JSON.parse(v.payload).leadTime};}
 if(!before||before._deleted)fail('Không tìm thấy dữ liệu để Hủy.',404);
 if(isMasterCancelled(before))fail('Dữ liệu đã được Hủy.',409);
 if(['employees','labor_hours'].includes(entity)){
  if(body.expectedVersion!==Number(before.version||0))fail(conflictMessage,409);
 }else if(!Object.hasOwn(body,'expectedRevision')||body.expectedRevision!==await recordRevision(row?.payload))fail(conflictMessage,409);
 const now=new Date().toISOString(),mark=p=>({...p,cancelled:true,status:'Đã hủy',cancelledAt:now,cancelledBy:actor.login,updatedAt:now,updatedBy:actor.login});
 let after=mark(before);
 if(entity==='sku')after={...after,confirmation_status:'Đã hủy',usage_status:'Ngừng sử dụng',revision:Number(before.revision||0)+1};
 if(entity==='employees')after={...after,active:false,version:Number(before.version||0)+1,history:[...(before.history||[]),{at:now,by:actor.login,action:'Hủy',before:{name:before.name,line:before.line,active:before.active},after:{name:before.name,line:before.line,active:false}}]};
 if(entity==='labor_hours')after.version=Number(before.version||0)+1;
 const operations=[{entity,key,raw:row?.payload??null,before,after}];
 if(entity==='leadtime'){
  const versions=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='leadtime_versions' AND upper(json_extract(payload,'$.sku'))=upper(?) AND json_extract(payload,'$.status') IN ('Đang áp dụng','Nháp','Chờ xác nhận')").bind(key).all()).results;
  for(const v of versions){if(body.linkedRevisions?.[v.record_key]!==await recordRevision(v.payload))fail(conflictMessage,409);const b=JSON.parse(v.payload);operations.push({entity:'leadtime_versions',key:v.record_key,raw:v.payload,before:b,after:mark(b)});}
 }
 if(entity==='safety_rule_groups'&&before.group==='leadtime'){
  const linked=await db.prepare("SELECT payload FROM app_records WHERE entity='safety_rules' AND record_key=?").bind(key).first();
  if(body.linkedRevision!==await recordRevision(linked?.payload))fail(conflictMessage,409);
  const b=linked?JSON.parse(linked.payload):{...defaultSafetyRuleSet,id:key,code:before.code,version:before.version,leadTimeRules:before.rows};
  operations.push({entity:'safety_rules',key,raw:linked?.payload??null,before:b,after:mark(b)});
 }
 const guard=randomUUID(),checks=operations.map(o=>o.raw===null?'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)':'EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)'),values=operations.flatMap(o=>o.raw===null?[o.entity,o.key]:[o.entity,o.key,o.raw]);
 const writes=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'basic_cancel_guard',?,?,?,? WHERE ${checks.join(' AND ')}`).bind(guard,'{}',actor.login,now,...values)];
 const receipts=[];
 for(const op of operations){const raw=JSON.stringify(op.after);receipts.push({entity:op.entity,key:op.key,payload:op.after,revision:await recordRevision(raw)});
  writes.push(op.raw===null?db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='basic_cancel_guard' AND record_key=?)").bind(op.entity,op.key,raw,actor.login,now,guard):db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='basic_cancel_guard' AND record_key=?)").bind(raw,actor.login,now,op.entity,op.key,guard));
  const audit={entity:op.entity,key:op.key,action:'Hủy',before:op.before,after:op.after,actor:actor.login,at:now};
  writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(randomUUID(),JSON.stringify(audit),actor.login,now));
  const historyEntity=entity==='sku'?'sku_history':entity==='labor_hours'?'labor_hours_history':entity==='leadtime'?'leadtime_audit':entity==='safety_rule_groups'?'safety_rule_audit':null;
  if(historyEntity&&op.entity===entity){const history={...audit,id:randomUUID(),data:op.after,changedAt:now,changedBy:actor.login,sku:before.code||before.sku,version:after.version,oldLaborHour:before.laborHour,newLaborHour:before.laborHour,oldNote:before.note,newNote:before.note,reason:'Hủy dữ liệu, ngừng áp dụng',operator:actor.login,type:'Hủy',group:before.group};writes.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='basic_cancel_guard' AND record_key=?)").bind(historyEntity,history.id,JSON.stringify(history),actor.login,now,guard));}
 }
 writes.push(db.prepare("DELETE FROM app_records WHERE entity='basic_cancel_guard' AND record_key=?").bind(guard));
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail(conflictMessage,409);
 return {ok:true,records:receipts};
}
