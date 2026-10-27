import {closeHistoricalQuantity} from './production-quantity-close.mjs';
import {normalizeStoredAssy} from './production-assy-normalization.mjs';
import {importErpStages} from './production-erp-stage-import.mjs';
import {reconcileHistorySource,earlierHistorySourceReports,historySourceBaseline,historyAllocationSummary,historyAllocationTolerance} from '../../lib/production-history-source.mjs';
import {importSourceTimeLog} from './production-source-time-import.mjs';
import {reconcileProductionSheet} from './production-sheet-reconciliation.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {monday,dateISO} from '../../lib/production-plan.mjs';
import {PlanError} from './production-plan.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {allocateHistory} from '../../lib/production-history-allocation.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
const fail=(m,s=422)=>{throw new PlanError(m,s);};
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export async function productionHistoryImport(db,body,actor,catalog){
 if(!actor.isAdmin||actor.line)fail('Chỉ Admin toàn quyền được nhập lịch sử.',403);
 if(!['preview','save'].includes(body.action))fail('Thao tác không hợp lệ.');
 let input;try{input=JSON.parse(String(body.text||''));}catch{fail('Dữ liệu JSON không hợp lệ.');}
 if(input?.quantityOnlyClose)return closeHistoricalQuantity(db,body,input,actor,catalog);
 if(input?.normalizeStage==='ASSY 1 -> ASSY')return normalizeStoredAssy(db,body,actor);
 if(input?.erpStages)return importErpStages(db,body,input,actor,catalog);
 if(input?.reconcileSource)return reconcileProductionSheet(db,body,input,actor,catalog);
 if(input&&typeof input==='object'&&!Array.isArray(input)&&Array.isArray(input.timeLog))return importSourceTimeLog(db,body,input,actor,catalog);
 if(!Array.isArray(input)||!input.length||input.length>100)fail('Nhập từ 1 đến 100 dòng.');
 const records=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('in_transit','production_event','production_report','capacity','production_schedule','employees','labor_hours','production_history_import') ORDER BY entity,record_key").all()).results;
 const revision=await digest(JSON.stringify(records)),batchId=await digest(JSON.stringify(input));
 const already=records.find(r=>r.entity==='production_history_import'&&r.record_key===batchId);if(already)return {ok:true,replayed:true,saved:true,batch:JSON.parse(already.payload)};
 const state=await readProductionWorkflow(db,actor,catalog),standards=new Map(siteLaborHours(records.filter(r=>r.entity==='labor_hours').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}))).map(r=>[r.key,r.payload.cancelled?null:r.payload.laborHour]));
 const seen=new Set();
 const source=input.map((r,index)=>{
  let matches=state.orders.filter(o=>o.planId===r.planId);if(!matches.length)matches=records.filter(a=>a.entity==='in_transit').map(a=>({...JSON.parse(a.payload),id:JSON.parse(a.payload).id||a.record_key,historicalOnly:true})).filter(o=>o.planId===r.planId);if(!matches.length&&r.sourceOrder){
   const o=r.sourceOrder,master=catalog.map(c=>c.payload||c).find(c=>c.code===r.sku);
   if(!master||!usableSku(master)||o.planId!==r.planId||o.sku!==r.sku||o.line!==r.line||!['A','B'].includes(o.line)||o.lsxCode!==r.lsxCode||!o.lsxCode||!Number.isSafeInteger(o.lsxQty)||o.lsxQty<=0||!dateISO(o.planStart)||!dateISO(o.planEnd)||o.planEnd<o.planStart||monday(o.week)!==o.week||typeof o.sourceReference!=='string'||!o.sourceReference.trim())fail(`${r.planId}: thiếu hoặc sai kế hoạch gốc để khôi phục liên kết lịch sử.`);
   if(state.orders.some(p=>p.lsxCode===o.lsxCode&&p.planId!==o.planId)||input.some(p=>p.planId!==r.planId&&p.sourceOrder?.lsxCode===o.lsxCode))fail(`${r.planId}: mã LSX đã thuộc kế hoạch khác.`);
   matches=[{id:`SOURCE-ORDER:${o.planId}`,planId:o.planId,sku:o.sku,line:o.line,lsxCode:o.lsxCode,lsxQty:o.lsxQty,planStart:o.planStart,planEnd:o.planEnd,week:o.week,name:master.name||o.name,spec:master.spec||o.spec||'',historicalOnly:true,sourceReference:o.sourceReference}];
  }
  if(matches.length!==1)fail(`Plan ID ${r.planId}: tìm thấy ${matches.length} lệnh; cần đúng một lệnh.`);
  const o=matches[0];if(!o.lsxCode||!Number.isFinite(Number(o.lsxQty))||Number(o.lsxQty)<=0)fail(`${r.planId}: lệnh thiếu mã LSX hoặc số lượng.`);if(o.sku!==r.sku||o.line!==r.line)fail(`${r.planId}: SKU hoặc Line không khớp.`);
  const start=Date.parse(r.startedAt),end=Date.parse(r.completedAt);if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>Date.now()||!/T.*(?:Z|\+07:00)$/.test(r.startedAt)||!/T.*(?:Z|\+07:00)$/.test(r.completedAt))fail(`${r.planId}: thời gian phải có múi giờ và bắt đầu trước hoàn thành.`);
  if(!Number.isFinite(r.quantity)||r.quantity<=0||!Number.isSafeInteger(r.count)||r.count<1||r.count>100)fail(`${r.planId}: số lượng/số người không hợp lệ.`);
  if(r.pauses&&(!Array.isArray(r.pauses)||r.pauses.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(Date.parse(p[0]))||!Number.isFinite(Date.parse(p[1]))||Date.parse(p[0])>=Date.parse(p[1]))))fail(`${r.planId}: khoảng tạm ngưng không hợp lệ.`);
  const duplicateKey=`${o.id}:${new Date(end).toISOString()}`;if(seen.has(duplicateKey)||state.reports.some(p=>p.transitId===o.id&&Date.parse(p.completedAt)===end&&!p.cancelled))fail(`${r.planId}: đã có báo công cùng thời điểm.`);seen.add(duplicateKey);
  return {id:`HISTORY:${batchId}:${index}`,kind:'completion',historicalImport:true,estimatedStaffing:true,transitId:o.id,orderSnapshot:{id:o.id,planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,line:o.line,lsxQty:o.lsxQty,planStart:o.planStart,planEnd:o.planEnd,week:o.week,historicalOnly:!!o.historicalOnly,...(o.sourceReference?{sourceReference:o.sourceReference}:{})},planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,line:o.line,lsxQty:o.lsxQty,actualStartedAt:r.actualStartedAt||new Date(start).toISOString(),startedAt:new Date(start).toISOString(),completedAt:new Date(end).toISOString(),productionDate:new Date(end+7*3600000).toISOString().slice(0,10),reportedQuantity:r.quantity,sourceCount:r.count,sourceCumulativeHours:r.cumulativeHours??null,sourceActor:r.sourceActor||'',sourceNote:r.note||'',sourceRow:r,reviewStatus:'Lịch sử chờ đối chiếu',approvedQuantity:0,pauses:r.pauses||[],note:'Phân bổ bổ sung từ Google Sheet — cần đối chiếu trước khi xác nhận. '+(r.note||''),version:1};
 });
 for(const o of source.map(r=>r.orderSnapshot)){const total=source.filter(r=>r.transitId===o.id).reduce((s,r)=>s+r.reportedQuantity,0);if(total>Number(o.lsxQty))fail(`${o.planId}: sản lượng nhập ${total} vượt SL lệnh ${o.lsxQty}.`);}
 // A new batch must use structured cumulative baselines from earlier batches.
 // Never parse notes or replace the original cumulative input with a delta.
 for(const report of source){
  if(report.sourceCumulativeHours==null)continue;
  if(!Number.isFinite(Number(report.sourceCumulativeHours))||Number(report.sourceCumulativeHours)<0)fail(`${report.planId}: giờ lũy kế nguồn không hợp lệ.`);
  const prior=earlierHistorySourceReports(report,[...state.reports,...source]).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
  const baseline=report.sourceRow.sourceBaseline;
  if(baseline){
   if(!prior.length||!Number.isFinite(baseline.cumulativeHours)||baseline.cumulativeHours<0||Date.parse(baseline.completedAt)!==Date.parse(prior[0].completedAt)||Date.parse(baseline.completedAt)>Date.parse(report.startedAt)||typeof baseline.sourceReference!=='string'||!baseline.sourceReference.trim()||typeof baseline.sourceEventId!=='string'||!baseline.sourceEventId.startsWith('TIME-')||baseline.cumulativeHours<historySourceBaseline(report,[...state.reports,...source]))fail(`${report.planId}: mốc lũy kế đối chiếu nguồn không hợp lệ.`);
   report.sourceBaseline={...baseline};
  }
  if(prior.length&&(prior[0].sourceCumulativeHours==null||!Number.isFinite(Number(prior[0].sourceCumulativeHours))))fail(`${report.planId}: báo công trước thiếu giờ lũy kế nguồn; cần đối chiếu mốc trước khi nhập.`);
  if(Number(report.sourceCumulativeHours)<historySourceBaseline(report,[...state.reports,...source]))fail(`${report.planId}: giờ lũy kế mới nhỏ hơn mốc báo công trước.`);
 }
 const allocated=allocateHistory(source,state,standards),now=new Date().toISOString();
 const reconciled=reconcileHistorySource(allocated.reports,state.reports);
 const allocationWarnings=reconciled.filter(r=>historyAllocationSummary(r).unallocated>historyAllocationTolerance).map(r=>`${r.planId}: còn ${historyAllocationSummary(r).unallocated.toFixed(2)} giờ công nguồn chưa phân bổ; chưa được xác nhận.`);
 const batch={id:batchId,source:'Google Sheet',createdAt:now,actor:actor.login,actorId:productionActorId(actor),warnings:[...allocated.warnings,...allocationWarnings],reports:reconciled.map(r=>({...r,reportedAt:r.sourceRow.recordedAt||r.completedAt,importedAt:now,reportedBy:actor.login,reportedById:productionActorId(actor)}))};
 if(body.action==='preview')return {ok:true,revision,batch};
 if(body.revision!==revision)fail('Dữ liệu nguồn vừa thay đổi; đối chiếu lại trước khi lưu.',409);
 // Atomic snapshot comparison includes both modified rows and phantom inserts.
 const expected=JSON.stringify(records),entities="('in_transit','production_event','production_report','capacity','production_schedule','employees','labor_hours','production_history_import')";
 const result=await db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_history_import',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity IN ${entities})=json_array_length(?) AND NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(e.value,'$.entity') AND a.record_key=json_extract(e.value,'$.record_key') AND a.payload=json_extract(e.value,'$.payload'))) ON CONFLICT(entity,record_key) DO NOTHING`).bind(batchId,JSON.stringify(batch),actor.login,now,expected,expected).run();
 if(result.meta.changes!==1)fail('Dữ liệu đã thay đổi hoặc đã được nhập; hãy đối chiếu lại.',409);
 return {ok:true,saved:true,batch};
}
