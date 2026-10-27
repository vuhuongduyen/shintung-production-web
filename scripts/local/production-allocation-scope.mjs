const scopeSql="SELECT json_group_array(json_array(entity,record_key,payload)) AS snapshot FROM (SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_allocation_scope','users','permissions','department_permissions') ORDER BY entity,record_key)";
async function allocationSnapshot(db){const serialized=(await db.prepare(scopeSql).first()).snapshot;const rows=JSON.parse(serialized).map(([entity,key,raw])=>({entity,key,payload:JSON.parse(raw)}));return {serialized,scope:rows.find(r=>r.entity==='production_allocation_scope'&&r.key==='global')?.payload,records:entity=>rows.filter(r=>r.entity===entity&&!r.payload._deleted).map(r=>({...r.payload,key:r.key}))};}
import {recordRevision} from '../../lib/record-revision.mjs';
const fail=(message,status=403)=>{throw Object.assign(new Error(message),{status});};
const admin=actor=>{if(!actor?.isAdmin||actor.line||actor.authMode==='quick_line')fail('Chỉ Admin được thiết lập phạm vi Chờ phân bổ.');};
function candidates(snapshot){return snapshot.records('users').filter(u=>u.active===true&&u.authMode!=='quick_line').map(u=>({id:u.key,name:u.name||u.key,eligible:true}));}
export async function readAllocationScope(db,actor){admin(actor);const snapshot=await allocationSnapshot(db);return {revision:await recordRevision(snapshot.serialized),configuration:snapshot.scope||{schemaVersion:1,enabled:false,managers:[]},users:candidates(snapshot)};}
export async function saveAllocationScope(db,body,actor){
 admin(actor);const snapshot=await allocationSnapshot(db);
 if(body.expectedRevision!==await recordRevision(snapshot.serialized))fail('Danh sách hoặc quyền vừa thay đổi. Tải lại trước khi lưu.',409);
 if(typeof body.enabled!=='boolean'||!Array.isArray(body.managers)||(body.enabled?body.managers.length!==2:![0,2].includes(body.managers.length))||body.managers.some(m=>!m||typeof m!=='object'||typeof m.userId!=='string'))fail('Chọn đúng một QLSX C và một QLSX A+B.',422);
 if(body.managers.length&&(new Set(body.managers.map(m=>m.userId)).size!==2||new Set(body.managers.map(m=>m.group)).size!==2||body.managers.some(m=>!['C','AB'].includes(m.group))))fail('Hai phạm vi phải có hai tài khoản khác nhau.',422);
 const eligible=candidates(snapshot);
 if(body.enabled&&body.managers.some(m=>!eligible.some(u=>u.id===m.userId&&u.eligible)))fail('Tài khoản chưa tồn tại, đã ngưng hoặc là User Line. Chọn tài khoản đang hoạt động.',422);
 const now=new Date().toISOString(),by=actor.userId||actor.login,id=crypto.randomUUID(),configuration={schemaVersion:1,enabled:body.enabled,managers:body.managers.map(({userId,group})=>({userId,group})),updatedBy:by,updatedAt:now};
 // Use a narrow configuration snapshot and audit guard; existing permissions
 // and credentials are never changed by this narrowly scoped configuration.
 const allocationSnapshotSql=scopeSql;
 const writes=[db.prepare(`INSERT INTO app_records SELECT 'admin_audit',?,?,?,? WHERE (${allocationSnapshotSql.replace(' AS snapshot','')})=?`).bind(id,JSON.stringify({action:'ALLOCATION_MANAGER_SCOPE',before:snapshot.scope||null,after:configuration,actor:by,at:now}),by,now,snapshot.serialized),db.prepare("INSERT INTO app_records SELECT 'production_allocation_scope','global',?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='admin_audit' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(configuration),by,now,id)];
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail('Dữ liệu vừa thay đổi. Tải lại trước khi lưu.',409);return {ok:true,configuration};
}
