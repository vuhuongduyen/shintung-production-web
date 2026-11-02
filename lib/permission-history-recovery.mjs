// Restore only historically recorded personal grants, never a department profile.
const metadata=new Set(['updatedAt','updatedBy']);
const comparable=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(comparable(v))):Object.fromEntries(Object.keys(value).filter(k=>!metadata.has(k)).sort().map(k=>[k,JSON.parse(comparable(value[k]))])):value??null);
const fail=message=>{throw new Error(message);};
export function personalPermissionRecoveryPlan(entries,current,targetAt){
 const matching=entries.filter(e=>e.action==='USER_PERMISSION_SETUP'&&e.at===targetAt);
 if(matching.length!==1||!Array.isArray(matching[0].changes))fail('Không xác định duy nhất nhật ký gốc. Chưa sửa quyền.');
 const source=matching[0],changes=[];
 const find=(entity,key)=>{const rows=current.filter(r=>r.entity===entity&&r.key===key);if(rows.length!==1)fail(`Thiếu hoặc trùng bản ghi ${entity} · ${key}. Chưa sửa quyền.`);return rows[0];};
 const scope=find('production_allocation_scope','global').payload;
 const managers=(scope.managers||[]).map(m=>`${m.userId}:${m.group}`).sort();
 if(scope.enabled!==true||comparable(managers)!==comparable(['cnphuong:AB','dhtin:C']))fail('Phạm vi điều phối khác dhtin/C, cnphuong/A+B. Cần đối chiếu trước khi sửa.');
 for(const change of source.changes){
  if(change.entity!=='permissions'||change.before?.permissionMode!=='CUSTOM'||change.after?.permissionMode!=='DEPARTMENT')continue;
  if(!change.key||change.before.login!==change.key||change.after.login!==change.key||change.before.active!==true||change.before._deleted===true||!String(change.before.permissions||'').trim())fail('Bản quyền riêng gốc không đầy đủ hoặc không hoạt động. Cần đối chiếu.');
  const user=find('users',change.key).payload,record=find('permissions',change.key);
  if(user.login!==change.key||user.active!==true||user._deleted||user.authMode==='quick_line'||user.line||['ADMIN','SUPER_ADMIN'].includes(String(user.role||'').toUpperCase().replaceAll('-','_').replaceAll(' ','_'))||/^LINE_[AB]$/i.test(change.key))fail(`User ${change.key} không thuộc phạm vi khôi phục quyền riêng.`);
  if(changes.some(c=>c.key.toLowerCase()===change.key.toLowerCase()))fail('Trùng định danh user. Chưa sửa quyền.');
  const later=entries.filter(e=>e.at>source.at).flatMap(e=>Array.isArray(e.changes)?e.changes:e.entity&&Object.hasOwn(e,'before')&&Object.hasOwn(e,'after')?[e]:[]).filter(c=>c.entity==='permissions'&&c.key===change.key);
  if(later.some(c=>!Object.hasOwn(c,'before')||!Object.hasOwn(c,'after')||comparable(c.before)!==comparable(c.after)))fail(`User ${change.key} có thay đổi quyền hợp lệ sau mốc gốc. Giữ nguyên và đối chiếu riêng trước khi sửa.`);
  const after={...record.payload};
  for(const field of ['permissionMode','permissions','active','_deleted']){if(Object.hasOwn(change.before,field))after[field]=change.before[field];else delete after[field];}
  const alreadyRestored=comparable(after)===comparable(record.payload);
  if(!alreadyRestored&&comparable(record.payload)!==comparable(change.after))fail(`Quyền hiện tại của ${change.key} không khớp nhật ký sau áp mẫu. Chưa sửa quyền.`);
  changes.push({entity:'permissions',key:change.key,name:user.name||change.key,before:record.payload,after,alreadyRestored,grantCount:String(after.permissions).split(' · ').filter(Boolean).length});
 }
 if(!changes.length)fail('Không có quyền riêng đủ bằng chứng để khôi phục tại mốc này.');
 return {targetAt:source.at,actor:source.actor,scope,changes};
}
