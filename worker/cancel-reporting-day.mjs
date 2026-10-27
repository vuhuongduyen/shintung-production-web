import {recordRevision,conflictMessage} from '../lib/record-revision.mjs';
import {productionReportingHold} from '../lib/production-reporting-hold.mjs';
const day='2026-10-27';
const localDay=value=>Number.isFinite(Date.parse(value))?new Date(Date.parse(value)+7*3600000).toISOString().slice(0,10):'';
const live=p=>!p.cancelled&&!p.voided&&!p._deleted;
const manual=p=>!p.historicalImport&&!p.erpStageImport&&!p.sourceTimeLog&&!p.sourceVerified;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export function reportingDayPlan(records){
 const rows=records.map(r=>({...r,value:JSON.parse(r.payload)}));
 const events=rows.filter(r=>r.entity==='production_event'&&live(r.value)&&manual(r.value)&&localDay(r.value.recordedAt)===day&&['stage-work','start','complete','pause','resume','transfer','add','reduce','extra','incident'].includes(r.value.kind));
 const reports=rows.filter(r=>r.entity==='production_report'&&live(r.value)&&manual(r.value)&&localDay(r.value.reportedAt||r.value.recordedAt)===day);
 const orders=new Set([...events.map(r=>r.value.sourceId),...reports.map(r=>r.value.transitId)]);
 const reportIds=new Set(reports.map(r=>r.record_key));
 const eventIds=new Set(events.map(r=>r.record_key));
 const blockers=[];
 for(const r of events)if(!r.value.stageReporting||r.value.kind!=='stage-work')blockers.push(`${r.value.lsxCode||r.record_key}: thao tác cũ chưa theo công đoạn cần xử lý riêng.`);
 for(const r of reports){const p=r.value;if(!p.stageReporting||!['Chờ kiểm tra','Cần điều chỉnh'].includes(p.reviewStatus))blockers.push(`${p.lsxCode}: báo công đã xác nhận hoặc không thuộc luồng công đoạn chờ kiểm tra.`);if(!events.some(e=>e.value.sourceId===p.transitId&&e.value.stageName===p.stageName&&e.value.stageAction==='complete'&&e.value.effectiveAt===p.completedAt))blockers.push(`${p.lsxCode}: thiếu sự kiện xuất trạm tương ứng.`);}
 for(const r of rows){const p=r.value;if(r.entity==='warehouse_in'&&live(p)&&reportIds.has(p.reportId))blockers.push(`${p.lsxCode||r.record_key}: đã có phiếu kho liên quan; cần đối chiếu riêng.`);
 if(r.entity==='production_event'&&live(p)&&p.stageReporting&&orders.has(p.sourceId)&&!eventIds.has(r.record_key)&&Date.parse(p.recordedAt)>=Date.parse(day+'T00:00:00+07:00'))blockers.push(`${p.lsxCode}: còn thao tác phụ thuộc ngoài phạm vi ngày hủy.`);
 }
 const summary={date:day,eventCount:events.length,reportCount:reports.length,orders:[...orders].map(id=>{const own=events.filter(r=>r.value.sourceId===id),rs=reports.filter(r=>r.value.transitId===id),p=own[0]?.value||rs[0]?.value;return {id,lsx:p?.lsxCode,sku:p?.sku,line:p?.line,events:own.length,reports:rs.length,quantity:rs.reduce((n,r)=>n+Number(r.value.reportedQuantity||0),0)};}),blockers:[...new Set(blockers)]};
 return {events,reports,summary};
}
export async function cancelReportingDay(db,body,actor,hostname,nowMs=Date.now()){
 if(!actor?.isAdmin||actor.line)fail('Chỉ Admin không giới hạn Line được hủy báo công trong đợt nhập ERP.',403);
 if(!productionReportingHold(hostname,nowMs))fail('Chỉ áp dụng trên web chính trong thời gian tạm khóa báo công.',403);
 if(!['preview','apply'].includes(body.action))fail('Chọn kiểm tra hoặc hủy báo công.',422);
 const cursor=await db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor' AND record_key='global'").first();
 if(!cursor)fail('Thiếu phiên bản dữ liệu sản xuất; không tự khởi tạo.');
 const records=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_event','production_report','warehouse_in') ORDER BY entity,record_key").all()).results;
 const plan=reportingDayPlan(records),selected=[...plan.events,...plan.reports];
 const revision=await recordRevision({cursor:cursor.payload,selected:selected.map(r=>[r.entity,r.record_key,r.payload]),summary:plan.summary});
 if(body.action==='preview')return {ok:true,...plan.summary,expectedRevision:revision};
 if(body.expectedRevision!==revision)fail(conflictMessage);
 if(plan.summary.blockers.length)fail(plan.summary.blockers.join('\n'));
 if(!selected.length)return {ok:true,...plan.summary,alreadyEmpty:true};
 const now=new Date(nowMs).toISOString(),id=crypto.randomUUID(),reason='Hủy báo công thao tác trực tiếp ngày 27/10/2026 theo yêu cầu quản trị để nhập dữ liệu ERP; giữ nguyên dữ liệu ERP và lịch sử.';
 const writes=selected.map(r=>({entity:r.entity,key:r.record_key,before:r.value,value:{...r.value,...(r.entity==='production_event'?{voided:true}:{cancelled:true,reviewStatus:'Đã hủy',approvedQuantity:0}),version:Number(r.value.version||0)+1,cancelledAt:now,cancelledBy:actor.login,cancelledById:actor.userId||actor.login,cancelReason:reason,cancellationBatch:id}}));
 const audit={id,kind:'report-correction',operation:'cancel',sourceId:plan.summary.orders[0]?.id,affectedOrderIds:plan.summary.orders.map(r=>r.id),line:plan.summary.orders[0]?.line,effectiveAt:now,recordedAt:now,actor:actor.login,actorId:actor.userId||actor.login,reason,reportingDayCancellation:day,eventChanges:writes.filter(w=>w.entity==='production_event').map(w=>({operation:'cancel',eventId:w.key,before:w.before,after:w.value})),reportChanges:writes.filter(w=>w.entity==='production_report').map(w=>({reportId:w.key,before:w.before,after:w.value})),summary:plan.summary};
 const next=JSON.stringify({version:Number(JSON.parse(cursor.payload).version||0)+1,token:id});
 const sourceGuard="NOT EXISTS(SELECT 1 FROM json_each(?) g WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(g.value,'$.entity') AND a.record_key=json_extract(g.value,'$.record_key') AND a.payload=json_extract(g.value,'$.payload')))";
 const warehouseGuard="NOT EXISTS(SELECT 1 FROM app_records w WHERE w.entity='warehouse_in' AND coalesce(json_extract(w.payload,'$._deleted'),0)=0 AND coalesce(json_extract(w.payload,'$.cancelled'),0)=0 AND json_extract(w.payload,'$.reportId') IN (SELECT value FROM json_each(?)))";
 const batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+sourceGuard+' AND '+warehouseGuard).bind(next,actor.login,now,cursor.payload,JSON.stringify(selected.map(({entity,record_key,payload})=>({entity,record_key,payload}))),JSON.stringify(plan.reports.map(r=>r.record_key)))];
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 for(const w of writes)batch.push(db.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND '+guard).bind(JSON.stringify(w.value),actor.login,now,w.entity,w.key,next));
 batch.push(db.prepare("INSERT INTO app_records SELECT 'production_event',?,?,?,? WHERE "+guard).bind(id,JSON.stringify(audit),actor.login,now,next));
 const result=await db.batch(batch);if(result[0].meta.changes!==1)fail(conflictMessage);
 return {ok:true,...plan.summary,auditId:id};
}
