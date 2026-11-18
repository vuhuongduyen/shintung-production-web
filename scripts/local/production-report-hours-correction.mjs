import {isDailyOutput} from '../../lib/production-daily-output.mjs';
import {productionMenuRights} from '../../lib/menu-action-access.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
export async function correctReportHours(db,body,actor,catalog=[]){
 if(!productionMenuRights(actor).correct)fail("Không có quyền Điều chỉnh báo công.",403);
 const grants=(actor?.grants||[]).map(g=>String(g).toLocaleLowerCase('vi'));
 if(!actor?.login||!(actor.isAdmin||grants.some(g=>g.includes('quản lý sản xuất')&&(g.endsWith('/ xác nhận')||g.endsWith('/ sửa')&&!actor.line))))fail('Chỉ QLSX có quyền điều chỉnh báo công.',403);
 if(!['preview','apply'].includes(body.action))fail('Thao tác không hợp lệ.');
 const reason=String(body.reason||'').trim();if(!reason||reason.length>1000)fail('Nhập lý do điều chỉnh (tối đa 1000 ký tự).');
 const state=await readProductionWorkflow(db,actor,catalog),report=state.reports.find(r=>r.id===body.reportId&&r.kind==='completion');
 if(!report||actor.line&&actor.line!==report.line)fail('Không có quyền điều chỉnh báo công này.',403);
 if(isDailyOutput(report))fail('Phiếu sản lượng ngày không có giờ công theo lệnh để điều chỉnh.');
 if(report.cancelled||report.voided||report.reviewStatus==='Đã hủy')fail('Báo công đã hủy không thể điều chỉnh giờ.');
 if(Number(body.version)!==Number(report.version||0))fail(conflictMessage,409);
 const amount=v=>{if(v===''||v==null||!Number.isFinite(Number(v))||Number(v)<0)fail('Giờ công phải là số không âm.');return Math.round(Number(v)*10000)/10000;};
 const previous=report.hours||{},known=previous.perEmployee||[];
 let perEmployee=[];
 if(known.length){
  if(!Array.isArray(body.perEmployee)||body.perEmployee.length!==known.length||new Set(body.perEmployee.map(p=>p.id)).size!==known.length||body.perEmployee.some(p=>!known.some(k=>k.id===p.id)))fail('Giữ đúng danh sách nhân viên của báo công khi điều chỉnh giờ.');
  perEmployee=body.perEmployee.map(p=>{const hc=amount(p.hc),ot=amount(p.ot);return {...known.find(k=>k.id===p.id),hc,ot,total:amount(hc+ot)};});
 }
 const hc=known.length?amount(perEmployee.reduce((s,p)=>s+p.hc,0)):amount(body.hc),ot=known.length?amount(perEmployee.reduce((s,p)=>s+p.ot,0)):amount(body.ot);
 const hours={...previous,hc,ot,total:amount(hc+ot),perEmployee,manualAdjustment:true};
 const raw=await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first();
 const cursor=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();
 const cursorRaw=cursor?.payload||JSON.stringify({version:0,token:''});
 const revision=await recordRevision(JSON.stringify({cursor:cursorRaw,report:raw?.payload||report}));
 if(body.action==='preview')return {ok:true,expectedRevision:revision,before:previous,after:hours};
 if(body.expectedRevision!==revision)fail(conflictMessage,409);
 const now=new Date().toISOString(),id=crypto.randomUUID(),nextCursor=JSON.stringify({version:Number(JSON.parse(cursorRaw).version||0)+1,token:id});
 const after={...(raw?JSON.parse(raw.payload):report),hours,manualHours:true,correctedAt:now,correctedBy:productionActorId(actor),correctionReason:reason,version:Number(report.version||0)+1};
 const event={id,kind:'hours-adjustment',sourceId:report.transitId,line:report.line,reportId:report.id,effectiveAt:report.completedAt,recordedAt:now,actor:actor.login,actorId:productionActorId(actor),reason,changes:[{reportId:report.id,before:previous,after:hours}],before:previous,after:hours};
 await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(cursorRaw,actor.login,now).run();
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 const writes=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND COALESCE((SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?),'')=?").bind(nextCursor,actor.login,now,cursorRaw,report.id,raw?.payload||''),db.prepare("INSERT INTO app_records SELECT 'production_report',?,?,?,? WHERE "+guard+" ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(report.id,JSON.stringify(after),actor.login,now,nextCursor),db.prepare("INSERT INTO app_records SELECT 'production_event',?,?,?,? WHERE "+guard).bind(id,JSON.stringify(event),actor.login,now,nextCursor)];
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail(conflictMessage,409);
 return {ok:true,report:after};
}
