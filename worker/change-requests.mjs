import {updateProductionIncident} from './production-incidents.mjs';
import {incidentRights} from '../lib/production-incidents.mjs';
import {canApproveStaffRecall,canReadStaffRecallReply} from '../lib/staff-recall-approval.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {requestDepartment,requestDepartments,requestPending,requestRecipients,canViewRequest,canReplyDepartments,sendRecipients} from '../lib/department-change-access.mjs';
export const changeDepartment=requestDepartment;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const identity=a=>String(a.permissionLogin||a.userId||a.login||'').toLowerCase();
const visibleRequest=(r,login,isAdmin,seen=0)=>({...r,pending:requestPending(r)[0]||null,unreadReplyCount:(isAdmin||requestDepartments(login).includes(r.department))?r.messages.filter((m,i)=>i>=seen&&i>0&&m.department!==r.department).length:0,recipients:requestRecipients(r),pendingDepartments:requestPending(r),drafts:isAdmin?r.drafts:r.drafts?.[login]?{[login]:r.drafts[login]}:{}});
export async function changeRequests(db,actor,body=null){
 const scopeRow=await db.prepare("SELECT payload FROM app_records WHERE entity='production_allocation_scope' AND record_key='global'").first();
 const scope=scopeRow?JSON.parse(scopeRow.payload):null;
 const visible=(r,seen=0)=>r.kind==='production-incident'?{...visibleRequest(r,login,actor.isAdmin,seen),...incidentRights(r,actor)}:r.kind==='staff-recall'?{...r,drafts:{},canApproveRecall:canApproveStaffRecall(r,actor,scope),unreadReplyCount:canReadStaffRecallReply(r,actor,scope)?r.messages.filter((m,i)=>i>0&&i>=seen).length:0}:visibleRequest(r,login,actor.isAdmin,seen);
 const login=identity(actor),department=changeDepartment(login);if(!department&&!actor.isAdmin)fail('Tài khoản chưa được phân quyền Phiếu thay đổi. Liên hệ quản trị viên.',403);
 if(!body){const rows=(await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' ORDER BY updated_at DESC").all()).results.map(r=>JSON.parse(r.payload));const reads=(await db.prepare("SELECT payload FROM app_records WHERE entity='department_change_read' AND updated_by=?").bind(login).all()).results.map(r=>JSON.parse(r.payload));const seen=new Map(reads.map(r=>[r.id,r.messageCount]));return {department,login,records:rows.filter(r=>actor.isAdmin||canViewRequest(r,login)).map(r=>visible(r,seen.get(r.id)||0))};}
 if(['incident-confirm','incident-reply','incident-resolve'].includes(body.action))return updateProductionIncident(db,actor,body);
 if(body.action==='approve-recall'){const result=await mutateProductionWorkflow(db,{action:'staff-recall-approve',id:body.id,revision:body.revision},actor);return {ok:true,...result};}
 if(body.action==='read'){
 const id=String(body.id||''),row=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(id).first(),r=row?JSON.parse(row.payload):null;
 if(!r||!actor.isAdmin&&(!canViewRequest(r,login)||!(r.kind==='staff-recall'?canReadStaffRecallReply(r,actor,scope):requestDepartments(login).includes(r.department))))fail('Không có quyền xem phản hồi của phiếu này.',403);
 const messageCount=Number(body.messageCount);if(!Number.isInteger(messageCount)||messageCount<0||messageCount>r.messages.length)fail('Mốc xem phản hồi không hợp lệ.');
 const key=JSON.stringify([id,login]),now=new Date().toISOString();
 await db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('department_change_read',?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE CAST(json_extract(excluded.payload,'$.messageCount') AS INTEGER)>CAST(json_extract(app_records.payload,'$.messageCount') AS INTEGER)").bind(key,JSON.stringify({id,messageCount}),login,now).run();
 return {ok:true};
 }
 if(!['save','send'].includes(body.action))fail('Thao tác không hợp lệ.');
 const text=String(body.text||'').trim();if(!text||text.length>12000)fail('Nhập nội dung từ 1 đến 12.000 ký tự.');
 const id=String(body.id||'');if(!/^[a-zA-Z0-9-]{10,80}$/.test(id))fail('Mã phiếu không hợp lệ.');
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(id).first();
 const old=row?JSON.parse(row.payload):null;
 if(old?.kind==='production-incident')fail('Dùng thao tác riêng trong Phiếu báo sự cố.',403);
 if(old?.kind==='staff-recall')fail('Yêu cầu nhân sự chỉ xác nhận tại Lịch sử Nhân sự, không lưu hoặc gửi như phiếu thay đổi thông thường.',403);
 if(old&&!actor.isAdmin&&!canViewRequest(old,login))fail('Bạn không thuộc bộ phận nhận phiếu này.',403);
 if(!old&&!actor.isAdmin&&!['KHSX','QLSX'].includes(department))fail('Tài khoản kho chỉ phản hồi phiếu do KHSX gửi.',403);
 const acting=String(body.department||department);
 if(body.originScope&&(!['KHSX','QLSX'].includes(body.originScope)||(old?old.department!==body.originScope:acting!==body.originScope)))fail('Phiếu không thuộc menu đang thao tác.',403);
 if(!(actor.isAdmin?['KHSX','QLSX','Kho LK','Kho BB','Kho UT']:requestDepartments(login)).includes(acting))fail('Bạn không có quyền phản hồi thay bộ phận này.',403);
 if(!old&&!['KHSX','QLSX'].includes(acting))fail('Chọn KHSX hoặc QLSX để lập phiếu.');
 if(old&&!old.messages.length&&acting!==old.department)fail('Giữ bộ phận lập phiếu ban đầu.');
 if(old&&old.revision!==body.revision)fail('Phiếu đã được người khác cập nhật. Đóng phiếu, mở lại và kiểm tra nội dung trước khi gửi.',409);
 if(old&&!(old.messages.length?(actor.isAdmin?requestPending(old).includes(acting):canReplyDepartments(old,login).includes(acting)):(actor.isAdmin||old.owner===login)))fail('Phiếu hiện không chờ bộ phận của bạn phản hồi.',403);
 const now=new Date().toISOString();const next=old?structuredClone(old):{id,code:'PTD-'+id.slice(0,8).toUpperCase(),owner:login,department:acting,createdAt:now,messages:[],drafts:{},pending:null,revision:0};
 // Time is authoritative server time; client date/time cannot change creation or replies.
 if(!old){const local=new Date(Date.parse(now)+7*3600000).toISOString();next.date=local.slice(0,10);next.time=local.slice(11,16);}
 if(body.action==='save')next.drafts[login]={text,at:now,department:acting};
 else {
 const recipients=sendRecipients(acting,next.department);
 next.recipients=Array.from(new Set([...requestRecipients(next),...recipients])).filter(d=>d!==next.department);
 next.messages.push({text,at:now,login,department:acting,recipients});
 next.pendingDepartments=Array.from(new Set([...requestPending(next).filter(d=>d!==acting),...recipients])).filter(d=>d!==next.department);
 next.pending=next.pendingDepartments[0]||null;
 // Preserve drafts belonging to departments still waiting, including warehouse supervisors.
 for(const [author,draft] of Object.entries(next.drafts))if(author===login||(draft.department||requestDepartment(author))===acting)delete next.drafts[author];
 }
 next.revision++;next.updatedAt=now;
 const statement=old?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='department_change' AND record_key=? AND payload=?").bind(JSON.stringify(next),login,now,id,row.payload):db.prepare("INSERT OR IGNORE INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('department_change',?,?,?,?)").bind(id,JSON.stringify(next),login,now);
 const audit=db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),JSON.stringify({entity:'department_change',key:id,action:body.action,actor:login,department:acting,at:now,content:text,date:next.date,time:next.time}),login,now);
 const result=await db.batch(login==='vthduyen'?[statement]:[statement,audit]);if(!result[0].meta.changes)fail('Phiếu vừa thay đổi. Mở lại phiếu để kiểm tra rồi gửi lại.',409);
 return {ok:true,id,record:visibleRequest(next,login,actor.isAdmin)};
}
