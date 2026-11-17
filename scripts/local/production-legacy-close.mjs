import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {isDailyOutput} from '../../lib/production-report-model.mjs';
import {pendingReportReview} from '../../lib/production-progress-review.mjs';
import {readDailyOutputPolicy,dailyPolicyGuards} from './production-daily-output.mjs';
import {frozenPendingReport} from './production-quantity-cutover.mjs';
import {readRecordPages} from './production-record-pages.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export async function closeLegacyReport(db,body,actor){
 if(!productionMenuRights(actor).confirm)fail('Không có quyền kết thúc công đoạn cũ.',403);
 const id=String(body.reportId||''),reason=String(body.reason||'').trim();
 if(!id||!reason||body.expectedVersion===undefined)fail('Thiếu phiếu, phiên bản hoặc lý do kết thúc.',422);
 const policy=await readDailyOutputPolicy(db);
 if(!policy.policy?.active||!await frozenPendingReport(db,policy.policy,id))fail('Chỉ kết thúc phiếu cũ thuộc mốc chuyển sang báo sản lượng.');
 const stored=await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(id).first();
 let source=null,report=stored?JSON.parse(stored.payload):null;
 if(!stored){for(const row of await readRecordPages(db,{where:'entity=?',args:['production_history_import']})){const found=(JSON.parse(row.payload).reports||[]).find(r=>r.id===id);if(found){if(source)fail('Phiếu lịch sử bị trùng nguồn.');source=row;report=found;}}}
 if(!report)fail('Không tìm thấy phiếu cũ.',404);
 if(actor.line&&actor.line!==report.line)fail('Không được kết thúc phiếu Line khác.',403);
 if(isDailyOutput(report)||report.kind!=='completion'||Number(report.reportedQuantity)!==0||Number(report.approvedQuantity||0)!==0)fail('Chỉ kết thúc công đoạn cũ không có sản lượng thành phẩm.');
 if(!pendingReportReview(report)||Number(body.expectedVersion)!==Number(report.version||0))fail('Phiếu đã thay đổi hoặc đã kết thúc. Tải lại và kiểm tra.');
 const now=new Date().toISOString(),updated={...report,id,version:Number(report.version||0)+1,reviewStatus:'Đã kết thúc công đoạn cũ',legacyClosure:{reason,at:now,by:actor.login,basis:'Chuyển sang báo sản lượng; không xác nhận giờ công'},updatedAt:now,updatedBy:actor.login};
 const cursor=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();if(!cursor)fail('Thiếu phiên bản dữ liệu sản xuất.');
 const token=JSON.stringify({version:Number(JSON.parse(cursor.payload).version||0)+1,token:crypto.randomUUID()});
 const guards=[...dailyPolicyGuards(policy),stored?{sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?)",args:[id,stored.payload]}:{sql:"EXISTS(SELECT 1 FROM app_records WHERE entity='production_history_import' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=?)",args:[source.record_key,source.payload,id]}];
 const gate="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const event={id:crypto.randomUUID(),kind:'legacy-report-closure',reportId:id,sourceId:report.transitId,line:report.line,actor:actor.login,recordedAt:now,effectiveAt:now,reason,before:{reviewStatus:report.reviewStatus},after:{reviewStatus:updated.reviewStatus},doesNotApproveHours:true};
 const statements=[db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND ${guards.map(g=>g.sql).join(' AND ')}`).bind(token,actor.login,now,cursor.payload,...guards.flatMap(g=>g.args)),db.prepare(`INSERT INTO app_records SELECT 'production_report',?,?,?,? WHERE ${gate} ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(id,JSON.stringify(updated),actor.login,now,token),db.prepare(`INSERT INTO app_records SELECT 'production_event',?,?,?,? WHERE ${gate}`).bind(event.id,JSON.stringify(event),actor.login,now,token),db.prepare(`INSERT INTO app_records SELECT 'admin_audit',?,?,?,? WHERE ${gate}`).bind(crypto.randomUUID(),JSON.stringify({entity:'production_report',key:id,action:'legacy-close',before:report,after:updated,actor:actor.login,at:now,reason}),actor.login,now,token)];
 const result=await db.batch(statements);if(result.some(r=>r.meta.changes!==1))fail('Dữ liệu vừa thay đổi; tải lại trước khi kết thúc.');
 return {ok:true,payload:updated};
}
