import {recordRevision} from '../../lib/record-revision.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {buildDailyOutput,dailyOutputModel,isDailyOutput} from '../../lib/production-daily-output.mjs';
import {validBusinessDate} from '../../lib/effective-dated-value.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
export const dailyToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export async function readDailyOutputPolicy(db){
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_reporting_policy' AND record_key='global'").first();
 const p=row?JSON.parse(row.payload):null,approved=p?.mode===dailyOutputModel&&p.approved===true&&validBusinessDate(p.effectiveFrom);
 return {raw:row?.payload??null,policy:approved?{mode:dailyOutputModel,effectiveFrom:p.effectiveFrom,revision:p.revision??1,active:p.effectiveFrom<=dailyToday()}:null};
}
const fields=['reportingModel','quantityOnly','legacyCompletedBaseline','reportedAt','updatedAt','eventAt','completedAt','productionDate','actualStartedAt','actualCompletedAt','productionState','status','transitId','lsxCode','planId','kind','reviewStatus','reportedQuantity','approvedQuantity','completedQty','quantityCompleted','cancelled','voided','replacedByStageBatch','stageReporting'];
const summary=(value,id)=>`json_object('id',${id},${fields.flatMap(key=>[`'${key}'`,`json_extract(${value},'$.${key}')`]).join(',')})`;
const matches=value=>`(json_extract(${value},'$.transitId')=? OR (coalesce(json_extract(${value},'$.transitId'),'')='' AND json_extract(${value},'$.lsxCode')=?) OR (?=1 AND coalesce(json_extract(${value},'$.transitId'),'')='' AND coalesce(json_extract(${value},'$.lsxCode'),'')='' AND json_extract(${value},'$.planId')=?))`;
function reportSnapshotQueries(order){
 const args=[order.id,order.lsxCode,order.planGroupId?0:1,order.planId||''];
 const stored=`SELECT coalesce(json_group_array(json(v)),'[]') AS payload FROM (SELECT ${summary('payload',"coalesce(nullif(json_extract(payload,'$.id'),''),record_key)")} AS v FROM app_records WHERE entity='production_report' AND ${matches('payload')} ORDER BY record_key)`;
 const history=`SELECT coalesce(json_group_array(json(v)),'[]') AS payload FROM (SELECT ${summary('h.value',"coalesce(nullif(json_extract(h.value,'$.id'),''),a.record_key||':'||h.key)")} AS v FROM app_records a,json_each(a.payload,'$.reports') h WHERE a.entity='production_history_import' AND ${matches('h.value')} ORDER BY a.record_key,h.key)`;
 return [{sql:stored,args},{sql:history,args}];
}
export async function readDailyOrderReports(db,order){
 const queries=reportSnapshotQueries(order),snapshots=await Promise.all(queries.map(q=>db.prepare(q.sql).bind(...q.args).first()));
 return {reports:[...new Map([...JSON.parse(snapshots[1].payload),...JSON.parse(snapshots[0].payload)].map(r=>[r.id,r])).values()],guards:queries.map((q,i)=>({sql:`((${q.sql})=?)`,args:[...q.args,snapshots[i].payload]}))};
}
export async function writeDailyOutput(db,body,actor,commitEvents){
 if(['stageEntries','stage','stageName','backfill','employees','hours','count'].some(key=>body[key]!==undefined))fail('Phiếu sản lượng ngày chỉ nhận lệnh, ngày và số thành phẩm phát sinh; không nhận công đoạn hoặc giờ theo lệnh.');
 const token=String(body.requestIdempotency||'');if(!/^[a-zA-Z0-9-]{16,80}$/.test(token))fail('Thiếu mã thao tác ổn định.');
 const fingerprint=await recordRevision(JSON.stringify([body.action,String(body.orderId||''),body.productionDate,body.productionLocalDateTime??null,body.quantity]));
 const replay=await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND json_extract(payload,'$.requestIdempotency')=? LIMIT 1").bind(token).first();
 if(replay){const event=JSON.parse(replay.payload);if(!isDailyOutput(event)||event.actor!==actor.login||event.requestFingerprint!==fingerprint)fail('Mã thao tác không khớp người hoặc nội dung đã ghi nhận.',409);if(actor.line&&actor.line!==event.line)fail('Không có quyền đọc Line khác.',403);const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(event.reportId).first();if(!row)fail('Không tìm thấy phiếu đã ghi; cần đối chiếu trước khi thử lại.',409);return {event,report:JSON.parse(row.payload),replayed:true};}
 const cursor=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first(),cursorRaw=cursor?.payload||JSON.stringify({version:0,token:''});
 const [orderRow,activation]=await Promise.all([db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(String(body.orderId||'')).first(),readDailyOutputPolicy(db)]);
 if(!orderRow)fail('Lệnh không tồn tại.',404);const order={...JSON.parse(orderRow.payload),id:String(body.orderId)};
 if(actor.line&&actor.line!==order.line)fail('Không có quyền báo sản lượng Line khác.',403);
 if(!activation.policy?.active)fail('Báo sản lượng ngày chưa được bật theo mốc triển khai đã duyệt.',409);
 if(body.expectedOrderRevision!==await recordRevision(orderRow.payload))fail('Lệnh đã thay đổi. Tải lại để đối chiếu trước khi ghi.',409);
 const queries=reportSnapshotQueries(order),[stored,history,rateRow]=await Promise.all([...queries.map(q=>db.prepare(q.sql).bind(...q.args).first()),db.prepare("SELECT payload FROM app_records WHERE entity='labor_hours' AND record_key=?").bind(String(order.sku||'').trim().toUpperCase()).first()]);
 const reports=[...new Map([...JSON.parse(history.payload),...JSON.parse(stored.payload)].map(r=>[r.id,r])).values()],rate=rateRow?JSON.parse(rateRow.payload):null,now=new Date().toISOString();
 if(typeof body.productionLocalDateTime!=='string')fail('Thiếu ngày giờ sản xuất (GMT+7).');
 const report=buildDailyOutput({order,reports,quantity:body.quantity,productionDate:body.productionDate,productionLocalDateTime:body.productionLocalDateTime,cutoverDate:activation.policy.effectiveFrom,today:dailyToday(),rateVersions:rate?.effectiveVersions||[],id:crypto.randomUUID(),actor:actor.login,recordedAt:now});
 report.sourceOrderRevision=body.expectedOrderRevision;
 const event={id:crypto.randomUUID(),kind:'daily-output',reportingModel:dailyOutputModel,quantityOnly:true,sourceId:order.id,line:order.line,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,reportId:report.id,quantity:report.reportedQuantity,productionDate:report.productionDate,productionLocalDateTime:report.productionLocalDateTime,productionAt:report.productionAt,effectiveAt:now,recordedAt:now,actor:actor.login,requestIdempotency:token,requestFingerprint:fingerprint};
 const rawGuard=(entity,key,raw)=>({sql:raw===null?"NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)":"EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)",args:raw===null?[entity,key]:[entity,key,raw]});
 const guards=[rawGuard('in_transit',order.id,orderRow.payload),rawGuard('production_reporting_policy','global',activation.raw),rawGuard('labor_hours',String(order.sku||'').trim().toUpperCase(),rateRow?.payload??null),...queries.map((q,i)=>({sql:`((${q.sql})=?)`,args:[...q.args,i===0?stored.payload:history.payload]}))];
 await commitEvents(db,actor,now,[event],report,null,cursorRaw,[],guards);
 return {event:{...event,actorId:productionActorId(actor)},report:{...report,actorId:productionActorId(actor),reportedById:productionActorId(actor)}};
}
