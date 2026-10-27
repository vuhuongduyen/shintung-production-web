import {PlanError} from './production-plan.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {allocationInstant} from '../../lib/production-allocation-queue.mjs';
const fail=(text,status=422)=>{throw new PlanError(text,status);};
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const entities="('in_transit','production_event','production_report','capacity','production_schedule','employees','labor_hours','production_history_import')";
export async function importSourceTimeLog(db,body,input,actor,catalog){
 if(!actor?.isAdmin||actor.line)fail('Chỉ Admin toàn quyền được nhập lịch sử.',403);
 if(!['preview','save'].includes(body.action)||!Array.isArray(input.timeLog)||!input.timeLog.length||input.timeLog.length>500)fail('Nhập từ 1 đến 500 thao tác nguồn.');
 const records=(await db.prepare(`SELECT entity,record_key,payload FROM app_records WHERE entity IN ${entities} ORDER BY entity,record_key`).all()).results;
 const revision=await digest(JSON.stringify(records)),batchId=await digest(JSON.stringify(input));
 const prior=records.find(r=>r.entity==='production_history_import'&&r.record_key===batchId);
 if(prior)return {ok:true,saved:true,replayed:true,revision,batch:JSON.parse(prior.payload)};
 const state=await readProductionWorkflow(db,actor,catalog),existing=records.filter(r=>r.entity==='production_history_import').flatMap(r=>JSON.parse(r.payload).timeEvents||[]),seen=new Set(),now=new Date().toISOString();
 const events=[],skipped=[];
 for(const row of input.timeLog){
  if(!row||typeof row.sourceEventId!=='string'||!/^TIME-[-_a-zA-Z0-9]{8,200}$/.test(row.sourceEventId)||seen.has(row.sourceEventId))fail('Mã sự kiện nguồn không hợp lệ hoặc trùng trong bản nhập.');seen.add(row.sourceEventId);
  if(!['BẮT ĐẦU','BÁO CÔNG','HOÀN THÀNH','TẠM NGƯNG','TIẾP TỤC'].includes(row.operation)||!['TỰ ĐỘNG','ĐIỀU CHỈNH'].includes(row.source)||typeof row.actor!=='string'||!row.actor.trim()||typeof row.note!=='string'||row.note.length>2000||!Number.isFinite(row.cumulativeHours)||row.cumulativeHours<0)fail(`${row.sourceEventId}: dữ liệu thao tác nguồn không hợp lệ.`);
  const effective=allocationInstant(row.effectiveAt),recorded=allocationInstant(row.recordedAt);
  if(effective>Date.now()||recorded>Date.now()||effective<Date.parse('2000-01-01'))fail('Thời gian nguồn không hợp lệ hoặc ở tương lai.');
  const directory=[...state.orders,...records.filter(r=>r.entity==='in_transit').map(r=>({...JSON.parse(r.payload),id:JSON.parse(r.payload).id||r.record_key})).filter(o=>!o._deleted&&!state.orders.some(p=>p.id===o.id))];
  const orders=directory.filter(o=>o.planId===row.planId&&o.lsxCode===row.lsxCode&&o.sku===row.sku&&o.line===row.line);
  if(orders.length!==1)fail(`${row.planId}: không xác định được duy nhất LSX/SKU/Line gốc.`);
  const order=orders[0];
  const sourceRow={sourceEventId:row.sourceEventId,planId:row.planId,lsxCode:row.lsxCode,sku:row.sku,line:row.line,operation:row.operation,effectiveAt:new Date(effective).toISOString(),recordedAt:new Date(recorded).toISOString(),cumulativeHours:row.cumulativeHours,source:row.source,actor:row.actor,note:row.note};
  const old=existing.find(e=>e.sourceEventId===row.sourceEventId);
  if(old){if(JSON.stringify(old.sourceRow)!==JSON.stringify(sourceRow))fail(`${row.sourceEventId}: nguồn cùng mã đã thay đổi; cần đối chiếu, không ghi đè.`,409);skipped.push(row.sourceEventId);continue;}
  events.push({id:`SHEET-TIME:${row.sourceEventId}`,kind:'source-time',sourceTimeLog:true,historicalImport:true,sourceEventId:row.sourceEventId,sourceId:order.id,orderSnapshot:{id:order.id,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,line:order.line,name:order.name,spec:order.spec,week:order.week,lsxQty:order.lsxQty,planStart:order.planStart,planEnd:order.planEnd,historicalOnly:true},planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,line:order.line,effectiveAt:sourceRow.effectiveAt,recordedAt:sourceRow.recordedAt,sourceOperation:row.operation,sourceCumulativeHours:row.cumulativeHours,cumulativeLaborHours:null,source:row.source,actor:row.actor,actorId:row.actor,reason:`Giờ hoạt động lũy kế nguồn: ${row.cumulativeHours} giờ/người. ${row.note}`,sourceRow,reviewStatus:'Nhật ký nguồn',importedAt:now,importedBy:productionActorId(actor)});
 }
 const batch={id:batchId,source:'Google Sheet SX_TIME_LOG',actor:actor.login,actorId:productionActorId(actor),createdAt:now,reports:[],timeEvents:events,skipped,warnings:[]};
 if(body.action==='preview')return {ok:true,revision,batch};
 if(body.revision!==revision)fail('Dữ liệu nguồn vừa thay đổi; đối chiếu lại trước khi lưu.',409);
 const expected=JSON.stringify(records);
 const result=await db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_history_import',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity IN ${entities})=json_array_length(?) AND NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(e.value,'$.entity') AND a.record_key=json_extract(e.value,'$.record_key') AND a.payload=json_extract(e.value,'$.payload'))) ON CONFLICT(entity,record_key) DO NOTHING`).bind(batchId,JSON.stringify(batch),productionActorId(actor),now,expected,expected).run();
 if(result.meta.changes!==1)fail('Dữ liệu đã thay đổi hoặc đã nhập; đối chiếu lại.',409);
 return {ok:true,saved:true,batch};
}
