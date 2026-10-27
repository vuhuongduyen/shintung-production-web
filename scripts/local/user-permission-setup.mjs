import {tokenHash} from '../../worker/password-auth.mjs';
import {additivePermissionCatalog,additivePermissionAllowlist} from '../../lib/additive-permission-catalog.mjs';
import {hrAttendancePermissions} from '../../lib/user-permission-profiles.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status})};
const snapshotSql="SELECT json_group_array(json_array(entity,record_key,payload)) AS snapshot FROM (SELECT entity,record_key,payload FROM app_records WHERE entity IN ('users','permissions','departments','department_permissions') ORDER BY entity,record_key)";
const split=value=>String(value||'').split(' · ').filter(Boolean);
const identity=value=>String(value||'').trim().toLowerCase();
const actorKey=actor=>String(actor?.userId||actor?.permissionLogin||'').trim();
const admin=user=>['ADMIN','SUPER_ADMIN'].includes(String(user.role||'').trim().toUpperCase().replaceAll(' ','_').replaceAll('-','_'));
const assertAdmin=actor=>{if(!actor?.isAdmin||actor.line)fail('Chỉ Admin được thiết lập phân quyền.',403);};
async function build(db){
 const serialized=(await db.prepare(snapshotSql).first()).snapshot,rows=JSON.parse(serialized).map(([entity,key,raw])=>({entity,key,payload:JSON.parse(raw)}));
 const lookup=(entity,key)=>rows.filter(r=>r.entity===entity&&identity(r.key)===identity(key));
 const userRows=rows.filter(r=>r.entity==='users');
 const ids=new Set();
 for(const row of userRows){if(!row.key||identity(row.payload.login)!==identity(row.key)||row.payload.login!==row.key||ids.has(identity(row.key)))fail('Định danh user không nhất quán hoặc trùng không phân biệt hoa thường. Cần đối chiếu trước khi phân quyền.');ids.add(identity(row.key));}
 for(const row of rows.filter(r=>r.entity==='permissions')){if(!row.key||row.payload.login!==row.key||!ids.has(identity(row.key)))fail('Định danh bản ghi quyền cá nhân không khớp user. Cần đối chiếu trước khi phân quyền.');}
 for(const row of rows.filter(r=>r.entity==='permissions')){if(lookup('permissions',row.key).length>1)fail('Có nhiều bản ghi quyền cá nhân trùng định danh. Cần đối chiếu trước khi phân quyền.');}
 const users=rows.filter(r=>r.entity==='users'&&!r.payload._deleted).map(({key:login,payload:user})=>{
  const personals=lookup('permissions',login),personal=personals.find(r=>!r.payload._deleted);
  const templates=lookup('department_permissions',String(user.department||'').trim()).filter(r=>!r.payload._deleted&&r.payload.active===true),template=templates[0];
  const source=personal&&personal.payload.active!==true?null:personal&&personal.payload.permissionMode!=='DEPARTMENT'?personal:template;
  const before=[...new Set(split(source?.payload.permissions))];
  if(login.toLowerCase()==='sample_user_5'&&personal?.payload.active!==false)for(const grant of hrAttendancePermissions)if(!before.includes(grant))before.push(grant);
  const reason=admin(user)?'Admin đã toàn quyền':user.authMode==='quick_line'||user.line||/^LINE_[AB]$/i.test(login)?'Tài khoản Line có phạm vi riêng':user.active!==true?'User ngưng hoạt động':personal&&personal.payload.active!==true?'Quyền cá nhân ngưng hoạt động':!personal&&personals.length?'Bản ghi quyền đã xóa cần đối chiếu':templates.length>1?'Mẫu quyền bộ phận trùng mã cần đối chiếu':personals.length>1||personal&&personal.key!==login?'Cần đối chiếu bản ghi quyền trùng mã':'';
  return {login,name:user.name||login,department:user.department||'',active:user.active===true,eligible:!reason,reason,before,_user:user,_personal:personal?.payload||null};
 });
 return {serialized,revision:await tokenHash(serialized),users};
}
const publicUser=({_user,_personal,...user})=>user;
export async function readPermissionSetup(db,actor){assertAdmin(actor);const plan=await build(db);return {revision:plan.revision,users:plan.users.map(publicUser),catalog:additivePermissionCatalog};}
function selection(body,plan){
 if(!body||!['preview','apply'].includes(body.action))fail('Chọn user và quyền cần bổ sung, sau đó xem trước.',400);
 if(body.expectedRevision!==plan.revision)fail('Danh sách user hoặc quyền vừa thay đổi. Đóng và mở lại thiết lập để đối chiếu.');
 const validList=(value,max)=>Array.isArray(value)&&value.length>0&&value.length<=max&&value.every(v=>typeof v==='string')&&new Set(value).size===value.length;
 if(!validList(body.selectedLogins,plan.users.length)||!validList(body.grants,additivePermissionAllowlist.size))fail('Chọn ít nhất một user và một quyền hợp lệ.',400);
 if(body.grants.some(grant=>!additivePermissionAllowlist.has(grant)))fail('Quyền bổ sung không thuộc danh sách được hỗ trợ.',400);
 const users=body.selectedLogins.map(login=>plan.users.find(user=>user.login===login));
 if(users.some(user=>!user||!user.eligible))fail('Có user không còn đủ điều kiện. Hãy tải lại danh sách.',400);
 return {selectedLogins:[...body.selectedLogins].sort(),grants:[...body.grants].sort(),users};
}
export async function applyPermissionSetup(db,body,actor){
 assertAdmin(actor);const plan=await build(db),selected=selection(body,plan);
 const users=selected.users.map(user=>({...publicUser(user),added:selected.grants.filter(grant=>!user.before.includes(grant)),after:[...user.before,...selected.grants.filter(grant=>!user.before.includes(grant))]}));
 const changedUsers=users.filter(user=>user.added.length).length;
 const by=actorKey(actor);if(!by)fail('Không xác định được tài khoản quản trị đã xác thực.',403);
 const fingerprint=await tokenHash(JSON.stringify({revision:plan.revision,selectedLogins:selected.selectedLogins,grants:selected.grants}));
 const previewToken=body.action==='preview'?crypto.randomUUID():String(body.previewToken||'');
 const preview={revision:plan.revision,previewToken,selectedLogins:selected.selectedLogins,grants:selected.grants,users,changedUsers};
 if(body.action==='preview'){
  // Opaque, server-issued receipt: not a public digest and not derivable by the client.
  const receipt={actor:by,fingerprint,expiresAt:Date.now()+5*60*1000};
  await db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind('permission_preview',previewToken,JSON.stringify(receipt),by,new Date().toISOString()).run();
  return preview;
 }
 if(body.confirmed!==true||!previewToken)fail('Cần xem trước và xác nhận đúng phần quyền bổ sung.',400);
 const receiptRow=await db.prepare("SELECT payload FROM app_records WHERE entity='permission_preview' AND record_key=?").bind(previewToken).first();
 const receipt=receiptRow?JSON.parse(receiptRow.payload):null;
 if(!receipt||receipt.actor!==by||receipt.fingerprint!==fingerprint||!Number.isFinite(receipt.expiresAt)||receipt.expiresAt<Date.now())fail('Biên nhận xem trước không hợp lệ hoặc đã hết hạn. Hãy xem trước lại.',400);
 if(!changedUsers){const deleted=await db.prepare("DELETE FROM app_records WHERE entity='permission_preview' AND record_key=? AND payload=?").bind(previewToken,receiptRow.payload).run();if(deleted.meta.changes!==1)fail('Biên nhận đã được sử dụng. Hãy xem trước lại.',409);return {ok:true,...preview,auditId:null};}
 const auditId=crypto.randomUUID(),at=new Date().toISOString();
 const changes=users.filter(user=>user.added.length).map(user=>{const original=plan.users.find(u=>u.login===user.login);return {entity:'permissions',key:user.login,before:original._personal,after:{...original._personal,login:user.login,name:user.name,company:original._user.company||'SHINTUNG',department:user.department,phone:original._user.phone||'',mobile:original._user.mobile||'',permissionMode:'CUSTOM',permissions:user.after.join(' · '),active:true,_deleted:false,updatedBy:by,updatedAt:at}};});
 const audit={action:'USER_PERMISSION_ADD',actor:by,at,selectedLogins:selected.selectedLogins,grants:selected.grants,users,changes};
 const statements=[db.prepare("DELETE FROM app_records WHERE entity='permission_preview' AND record_key=? AND payload=?").bind(previewToken,receiptRow.payload),db.prepare(`INSERT INTO app_records SELECT ?,?,?,?,? WHERE (${snapshotSql.replace(' AS snapshot','')})=? AND changes()=1`).bind('admin_audit',auditId,JSON.stringify(audit),by,at,plan.serialized)];
 for(const change of changes)statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='admin_audit' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(change.entity,change.key,JSON.stringify(change.after),by,at,auditId));
 for(const change of changes)statements.push(db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE login=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM app_records WHERE entity='admin_audit' AND record_key=?)").bind(Date.now(),change.key,auditId));
 const result=await db.batch(statements);if(result[0].meta.changes!==1||result[1].meta.changes!==1)fail('Biên nhận hoặc phân quyền vừa thay đổi. Hãy tải lại và đối chiếu.');return {ok:true,...preview,auditId};
}
