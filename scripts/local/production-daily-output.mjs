import {normalizeTransit,mergeProduction} from '../../lib/in-transit.mjs';
import {quantityCutoverModel,quantityManifestValid,quantitySourceDatabase} from './production-quantity-cutover.mjs';
import {readSummaryScope,summaryByteBudget} from './production-summary-scope.mjs';
import {preservationManifestValid} from './production-legacy-preservation.mjs';
import {normalized} from '../../lib/production-plan.mjs';
import {recordRevision} from '../../lib/record-revision.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {buildDailyOutput,dailyOutputModel,isDailyOutput,dailyOutputTotals} from '../../lib/production-daily-output.mjs';
import {validBusinessDate} from '../../lib/effective-dated-value.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
export const dailyToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const configurationColumns="(SELECT payload FROM app_records WHERE entity='production_reporting_policy' AND record_key='global') AS policy,(SELECT payload FROM app_records WHERE entity='production_reporting_activation' AND record_key='global') AS activation,(SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=(SELECT json_extract(payload,'$.legacySnapshotId') FROM app_records WHERE entity='production_reporting_policy' AND record_key='global')) AS manifest";
export async function readDailyOutputPolicy(db,snapshot=null){
 const configuration=snapshot??await db.prepare(`SELECT ${configurationColumns}`).first(),row=configuration.policy===null?null:{payload:configuration.policy},activation=configuration.activation===null?null:JSON.parse(configuration.activation);
 const p=row?JSON.parse(row.payload):null,approved=p?.mode===dailyOutputModel&&p.approved===true&&validBusinessDate(p.effectiveFrom);
 if(activation&&(!approved||activation.legacySnapshotId!==p.legacySnapshotId||activation.effectiveFrom!==p.effectiveFrom))return {activationRaw:configuration.activation??null,raw:row?.payload??null,manifestRaw:null,manifestKey:activation.legacySnapshotId,policy:{mode:dailyOutputModel,effectiveFrom:activation.effectiveFrom,legacySnapshotId:activation.legacySnapshotId,cutoverReached:true,active:false,blockedReason:'Đã có mốc chuyển đổi được ghi nhận nhưng policy hiện tại không khớp. Khóa ghi/tính lại legacy để bảo toàn lịch sử; cần đối chiếu cấu hình.'}};
 const manifestRow=approved&&p.legacySnapshotId&&configuration.manifest!==null?{payload:configuration.manifest}:null;
 const manifest=manifestRow?JSON.parse(manifestRow.payload):null;
 let receipt=approved&&quantityManifestValid(manifest,p,activation),snapshotGuard=null;
 if(receipt){const prefix=JSON.stringify([p.legacySnapshotId]).slice(0,-1)+',';snapshotGuard={sql:"(SELECT count(*) FROM app_records WHERE entity='production_quantity_source' AND record_key>=? AND record_key<?)=?",args:[prefix,prefix+'\uffff',manifest.sourceCount]};const checked=await db.prepare(`SELECT ${snapshotGuard.sql} AS valid`).bind(...snapshotGuard.args).first();receipt=checked.valid===1;}
 const protectedHistory=receipt||approved&&preservationManifestValid(manifest,p);
 return {snapshotGuard,activationRaw:configuration.activation??null,raw:row?.payload??null,manifestRaw:manifestRow?.payload??null,manifestKey:p?.legacySnapshotId||null,policy:approved?{mode:dailyOutputModel,effectiveFrom:p.effectiveFrom,revision:p.revision??1,...(receipt?{intakeModel:quantityCutoverModel,receivedAt:p.receivedAt}:{}),legacySnapshotId:p.legacySnapshotId||null,cutoverReached:activation?.intakeModel===quantityCutoverModel||p.effectiveFrom<=dailyToday(),active:protectedHistory&&p.effectiveFrom<=dailyToday(),...(!protectedHistory?{blockedReason:'Chưa có mốc bảo toàn kết quả lịch sử được kiểm chứng; chưa bật báo sản lượng ngày.'}:{})}:null};
}
// Bind the exact configuration read during validation to the cursor transaction.
// A legacy policy may have no activation marker: guard that absence too, so a
// concurrent cutover cannot cross an in-flight legacy-policy mutation.
export function dailyPolicyGuards(snapshot){
 const raw=(entity,key,payload)=>payload==null?{sql:'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)',args:[entity,key]}:{sql:'EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)',args:[entity,key,payload]};
 return [...(snapshot.snapshotGuard?[snapshot.snapshotGuard]:[]),raw('production_reporting_policy','global',snapshot.raw),raw('production_reporting_activation','global',snapshot.activationRaw),...(snapshot.manifestKey?[raw('production_legacy_manifest',snapshot.manifestKey,snapshot.manifestRaw)]:[])];
}
const fields=['quantityBaseline','quantityAfterCutover','pendingQuantityReservation','reportingModel','quantityOnly','legacyCompletedBaseline','orderCode','mo','reportedAt','updatedAt','eventAt','startedAt','productionAt','completedAt','productionDate','actualStartedAt','actualCompletedAt','productionState','status','transitId','lsxCode','planId','kind','reviewStatus','reportedQuantity','approvedQuantity','completedQty','quantityCompleted','cancelled','voided','replacedByStageBatch','stageReporting'];
const summary=(value,id)=>`json_object('id',${id},${fields.flatMap(key=>[`'${key}'`,key==='quantityOnly'?`json(CASE json_type(${value},'$.quantityOnly') WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE 'null' END)`:`json_extract(${value},'$.${key}')`]).join(',')})`;
const sourceCode=value=>`CAST(coalesce(nullif(nullif(json_extract(${value},'$.lsxCode'),''),0),nullif(nullif(json_extract(${value},'$.orderCode'),''),0),nullif(nullif(json_extract(${value},'$.mo'),''),0),'') AS TEXT)`;
const complexSql=value=>`(${value} GLOB '*[^ -~]*' OR instr(${value},'  ')>0)`;
const matches=value=>{const code=sourceCode(value),plan=`CAST(coalesce(json_extract(${value},'$.planId'),'') AS TEXT)`;return `(json_extract(${value},'$.transitId')=? OR (coalesce(json_extract(${value},'$.transitId'),'')='' AND (?=1 OR ${complexSql(code)} OR ${complexSql(plan)} OR upper(trim(${code}))=? OR (?=1 AND trim(${code})='' AND upper(trim(${plan}))=?))))`;};
function reportSnapshotQueries(order){
 // ASCII keys stay tightly scoped in SQL. Complex Unicode/whitespace candidates
 // pass through compact summaries for the exact shared JS normalizer; never
 // silently miss a legacy quantity because SQLite NOCASE is ASCII-only.
 const complexOrder=[order.lsxCode,order.planId].some(value=>/[^ -~]|  /.test(String(value||'')));
 const args=[order.id,complexOrder?1:0,normalized(order.lsxCode),order.planGroupId?0:1,normalized(order.planId)];
 const stored=`SELECT record_key AS k1,0 AS k2,${summary('payload',"coalesce(nullif(json_extract(payload,'$.id'),''),record_key)")} AS v FROM app_records WHERE entity='production_report' AND ${matches('payload')}`;
 const history=`SELECT a.record_key AS k1,h.key AS k2,${summary('h.value',"coalesce(nullif(json_extract(h.value,'$.id'),''),a.record_key||':'||h.key)")} AS v FROM app_records a,json_each(a.payload,'$.reports') h WHERE a.entity='production_history_import' AND ${matches('h.value')}`;
 return [{sql:stored,args},{sql:history,args}];
}
export async function readDailyOrderReports(db,order){
 const snapshots=await Promise.all(reportSnapshotQueries(order).map(q=>readSummaryScope(db,q)));
 if(snapshots.reduce((n,s)=>n+s.pages,0)>32||snapshots.reduce((n,s)=>n+s.bytes,0)>summaryByteBudget)fail('Phạm vi phiếu vượt giới hạn đối chiếu an toàn; chưa lưu, cần chia phạm vi kiểm tra.',409);
 return {reports:[...new Map([...snapshots[1].reports,...snapshots[0].reports].map(r=>[r.id,r])).values()],guards:snapshots.map(s=>s.guard)};
}
export async function quantityBaselineForOrder(db,policy,order){
 if(policy?.intakeModel!==quantityCutoverModel)return null;
 const frozen=quantitySourceDatabase(db,policy.legacySnapshotId),row=await frozen.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(order.id).first();
 let approved=0;if(row){const original=normalizeTransit({...JSON.parse(row.payload),id:order.id});approved=Math.max(Number(original.completedQty||0),dailyOutputTotals(original,(await readDailyOrderReports(frozen,original)).reports).approved);}
 if(!Number.isSafeInteger(approved)||approved<0)fail('Thiếu số lượng nguồn hợp lệ; cần đối chiếu trước khi ghi.',409);
 return {model:quantityCutoverModel,snapshotId:policy.legacySnapshotId,receivedAt:policy.receivedAt,approved};
}
export async function writeDailyOutput(db,body,actor,commitEvents,{legacySubmission=false}={}){
 if(['stageEntries','stage','stageName','backfill','employees','hours','count'].some(key=>body[key]!==undefined))fail('Phiếu sản lượng ngày chỉ nhận lệnh, ngày và số thành phẩm phát sinh; không nhận công đoạn hoặc giờ theo lệnh.');
 const token=String(body.requestIdempotency||'');if(!/^[a-zA-Z0-9-]{16,80}$/.test(token))fail('Thiếu mã thao tác ổn định.');
 const fingerprint=await recordRevision(JSON.stringify([body.action,String(body.orderId||''),body.productionDate,body.productionLocalDateTime??null,body.quantity]));
 // One request-local read, not a cross-request cache. Re-read guards still cover
 // policy, manifest, order, rate, reports and the global cursor at commit.
 const snapshot=await db.prepare(`SELECT ${configurationColumns},(SELECT payload FROM app_records WHERE entity='production_event' AND json_extract(payload,'$.requestIdempotency')=? LIMIT 1) AS replay,(SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global') AS cursor,(SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?) AS sourceOrder`).bind(token,String(body.orderId||'')).first();
 const replay=snapshot.replay===null?null:{payload:snapshot.replay};
 if(replay){const event=JSON.parse(replay.payload);if(!isDailyOutput(event)||event.actor!==actor.login||event.requestFingerprint!==fingerprint)fail('Mã thao tác không khớp người hoặc nội dung đã ghi nhận.',409);if(actor.line&&actor.line!==event.line)fail('Không có quyền đọc Line khác.',403);const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(event.reportId).first();if(!row)fail('Không tìm thấy phiếu đã ghi; cần đối chiếu trước khi thử lại.',409);return {event,report:JSON.parse(row.payload),replayed:true};}
 const cursorRaw=snapshot.cursor||JSON.stringify({version:0,token:''});
 const orderRow=snapshot.sourceOrder===null?null:{payload:snapshot.sourceOrder},activation=await readDailyOutputPolicy(db,snapshot);
 if(!orderRow)fail('Lệnh không tồn tại.',404);const order={...JSON.parse(orderRow.payload),id:String(body.orderId)};
 if(actor.line&&actor.line!==order.line)fail('Không có quyền báo sản lượng Line khác.',403);
 if(!activation.policy?.active)fail('Báo sản lượng ngày chưa được bật theo mốc triển khai đã duyệt.',409);
 if(!(legacySubmission&&activation.policy.intakeModel===quantityCutoverModel&&body.expectedOrderRevision===undefined)&&body.expectedOrderRevision!==await recordRevision(orderRow.payload))fail('Lệnh đã thay đổi. Tải lại để đối chiếu trước khi ghi.',409);
 const [context,rateRow]=await Promise.all([readDailyOrderReports(db,order),db.prepare("SELECT payload FROM app_records WHERE entity='labor_hours' AND record_key=?").bind(String(order.sku||'').trim().toUpperCase()).first()]);
 const reports=context.reports,rate=rateRow?JSON.parse(rateRow.payload):null,now=new Date().toISOString(),quantityBaseline=await quantityBaselineForOrder(db,activation.policy,order);
 if(typeof body.productionLocalDateTime!=='string')fail('Thiếu ngày giờ sản xuất (GMT+7).');
 const report=buildDailyOutput({order:quantityBaseline?{...order,quantityBaseline}:order,reports,quantity:body.quantity,productionDate:body.productionDate,productionLocalDateTime:body.productionLocalDateTime,cutoverDate:activation.policy.effectiveFrom,intakeModel:activation.policy.intakeModel,today:dailyToday(),rateVersions:rate?.effectiveVersions||[],id:crypto.randomUUID(),actor:actor.login,recordedAt:now});
 report.sourceOrderRevision=await recordRevision(orderRow.payload);
 if(quantityBaseline)report.quantityBaseline=quantityBaseline;
 if(activation.policy.intakeModel===quantityCutoverModel)report.intake={model:quantityCutoverModel,receivedAt:now,snapshotId:activation.manifestKey,legacySubmission};
 const event={id:crypto.randomUUID(),kind:'daily-output',reportingModel:dailyOutputModel,quantityOnly:true,sourceId:order.id,line:order.line,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,reportId:report.id,quantity:report.reportedQuantity,productionDate:report.productionDate,productionLocalDateTime:report.productionLocalDateTime,productionAt:report.productionAt,effectiveAt:now,recordedAt:now,actor:actor.login,requestIdempotency:token,requestFingerprint:fingerprint};
 const rawGuard=(entity,key,raw)=>({sql:raw===null?"NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)":"EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)",args:raw===null?[entity,key]:[entity,key,raw]});
 const guards=[...dailyPolicyGuards(activation),rawGuard('in_transit',order.id,orderRow.payload),rawGuard('labor_hours',String(order.sku||'').trim().toUpperCase(),rateRow?.payload??null),...context.guards];
 // Preserve the append-only admission revision on legacy rows without a materialized
 // pending field. An existing projection must be refreshed with the receipt atomically.
 const merged=Object.hasOwn(order,'pendingReportQty')?mergeProduction({...order,...(quantityBaseline?{quantityBaseline}:{})},[...reports,report]):null;
 const projections=merged?[{entity:'in_transit',key:order.id,expected:orderRow.payload,payload:{...order,completedQty:merged.completedQty,pendingReportQty:merged.pendingReportQty},quantityProjection:true}]:[];
 await commitEvents(db,actor,now,[event],report,null,cursorRaw,projections,guards);
 return {event:{...event,actorId:productionActorId(actor)},report:{...report,actorId:productionActorId(actor),reportedById:productionActorId(actor)}};
}
