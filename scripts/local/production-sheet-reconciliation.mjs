import {PlanError} from './production-plan.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {productionActorId} from '../../lib/production-actor.mjs';
import {monday} from '../../lib/production-plan.mjs';
import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {sheetNumber as num,sheetMoment as moment,sheetDay as day,sourceReportTiming} from '../../lib/production-sheet-source.mjs';
const fail=(m,s=422)=>{throw new PlanError(m,s);};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),n=>n.toString(16).padStart(2,'0')).join('');
const entities="('in_transit','production_report','production_event','production_history_import','production_cursor','labor_hours','warehouse_in')";
const active=r=>!r.cancelled&&!r.voided&&r.kind==='completion';
const snapshot=o=>Object.fromEntries(['id','planId','lsxCode','sku','line','name','spec','week','lsxQty','planStart','planEnd'].map(k=>[k,o[k]]));
const chunks=values=>{const result=[];let group=[],size=0;for(const value of values){const bytes=new TextEncoder().encode(JSON.stringify(value)).length;if(group.length&&size+bytes>200000){result.push(group);group=[];size=0;}group.push(value);size+=bytes;}if(group.length)result.push(group);return result;};
export async function reconcileProductionSheet(db,body,input,actor,catalog){
 if(!actor?.isAdmin||actor.line)fail('Chỉ Admin toàn quyền được đối chiếu và xác nhận nguồn.',403);
 const source=input.reconcileSource, pending=input.confirmSourceReports===false;
 const auditAction=pending?'Cập nhật Google Sheet — chờ QLSX xác nhận':'Đối chiếu và xác nhận Google Sheet';
 if(!['preview','save'].includes(body.action)||typeof input.confirmSourceReports!=='boolean'||!source||!Array.isArray(source.sxRows)||!source.sxRows.length||source.sxRows.length>500||!Array.isArray(source.timeRows)||source.timeRows.length>2000||!Array.isArray(source.transitRows)||source.transitRows.length>1000||!Array.isArray(source.references)||source.references.length!==2||source.references.some(r=>!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(r)))fail('Thiếu dữ liệu hoặc xác nhận đối chiếu hai nguồn Google Sheet.');
 const records=(await db.prepare(`SELECT entity,record_key,payload FROM app_records WHERE entity IN ${entities} ORDER BY entity,record_key`).all()).results;
 const revision=await hash(records),batchId=`RECONCILE:${await hash(input)}`,prior=records.find(r=>r.entity==='production_history_import'&&r.record_key===batchId);
 if(prior)return {ok:true,saved:true,replayed:true,revision,batch:JSON.parse(prior.payload)};
 const state=await readProductionWorkflow(db,actor,catalog),now=new Date().toISOString(),actorId=productionActorId(actor),changes=[],warnings=[],writes=[];
 const raw=(entity)=>records.filter(r=>r.entity===entity).map(r=>({key:r.record_key,...JSON.parse(r.payload)}));
 const oldOrders=raw('in_transit').filter(o=>!o._deleted),oldTime=raw('production_history_import').flatMap(r=>r.timeEvents||[]),standards=new Map(siteLaborHours(records.filter(r=>r.entity==='labor_hours').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}))).map(r=>[r.key,r.payload.cancelled?null:r.payload.laborHour]));
 const put=(entity,key,payload)=>writes.push({entity,key,payload});
 const needed=new Set([...source.sxRows.map(r=>r[2]),...source.timeRows.map(r=>r[2])]),orders=new Map();let week='';
 for(let i=0;i<source.transitRows.length;i++){
  const r=source.transitRows[i];if(!r[0]){const m=/\[WEEK:(\d{4})(\d{2})(\d{2})\]/.exec(r[2]||'');if(m)week=`${m[1]}-${m[2]}-${m[3]}`;continue;}
  if(!needed.has(r[0]))continue;
  if(orders.has(r[0])||!r[1]||!['A','B'].includes(r[4])||!r[12]||!Number.isSafeInteger(r[14])||r[14]<=0||!day(r[6])||!day(r[7])||!day(r[15])||r[18])fail(`${r[0]}: In transit thiếu/sai dữ liệu hoặc lệnh đã hủy.`);
  const samePlan=oldOrders.filter(o=>o.planId===r[0]);
  const exact=samePlan.filter(o=>o.sku===r[1]&&o.lsxCode===r[12]&&o.line===r[4]);
  const matches=exact.length?exact:samePlan;if(matches.length>1)fail(`${r[0]}: có nhiều lệnh cùng mã LSX/SKU/Line trên web.`);
  const old=matches[0];if(old&&(old.sku!==r[1]||old.lsxCode!==r[12]||old.line!==r[4]||old._deleted||old.cancelReason))fail(`${r[0]}: mã SKU/LSX/Line hoặc trạng thái web không khớp nguồn.`);
  const linked=state.reports.find(p=>p.planId===r[0]);
  const order={...old,id:old?.id||old?.key||linked?.transitId||`SHEET-ORDER:${r[0]}`,planId:r[0],sku:r[1],name:r[2],spec:r[3]||'',line:r[4],week:week||monday(day(r[6])),group:r[8]||'',source:r[9]||'Kế hoạch tuần',priority:r[10]||'',sequence:r[11]??null,lsxCode:r[12],planQty:r[13],lsxQty:r[14],planStart:day(r[6]),planEnd:day(r[7]),lsxOpenedAt:day(r[15]),status:'ĐÃ MỞ LSX',isAdditionalLsx:String(r[9]).includes('Phát sinh'),syncStatus:'ĐÃ ĐỒNG BỘ',historicalOnly:false,sourceReconciledAt:now,sourceReference:`${source.references[1]} / 04_IN_TRANSIT!A${source.transitRowNumbers?.[i]||i+2}:AO${source.transitRowNumbers?.[i]||i+2}`,sourceTransitRow:r,delayReason:r[25]||old?.delayReason||'',updatedBy:actor.login,updatedAt:now};
  const own=source.timeRows.filter(t=>t[2]===r[0]).sort((a,b)=>Date.parse(moment(a[7]))-Date.parse(moment(b[7]))),first=own.find(t=>t[6]==='BẮT ĐẦU'),last=own.at(-1);
  order.actualStartedAt=first?day(first[7]):day(r[20]);order.completedQty=pending?(old?.completedQty||0):(r[19]||0);order.actualCompletedAt=pending?(old?.actualCompletedAt||''):day(r[21]);
  order.productionState=order.actualCompletedAt&&order.completedQty>=order.lsxQty?'Hoàn thành sản xuất':last?.[6]==='TẠM NGƯNG'?'Tạm ngưng':first?'Đang sản xuất':old?.productionState||'Chưa sản xuất';
  orders.set(order.planId,order);changes.push({entity:'in_transit',key:order.id,before:old||null,after:order});put('in_transit',order.id,order);
 }
 if([...needed].some(p=>!orders.has(p)))fail('Có Plan ID chưa đối chiếu được với In transit.');
 const reports=[],matched=new Set(),sourceIds=new Set();
 for(let i=0;i<source.sxRows.length;i++){
  const r=source.sxRows[i],o=orders.get(r[2]),quantity=num(r[10]),count=num(r[13]),timing=sourceReportTiming(r,source.timeRows);
  if(!/^[\w-]{20,100}$/.test(r[1]||'')||sourceIds.has(r[1])||!o||o.sku!==r[4]||o.lsxCode!==r[3]||o.line!==r[7]||!quantity||quantity<0||!Number.isSafeInteger(count)||count<1||!timing.recordedAt||!timing.completedAt||Date.parse(timing.recordedAt)>Date.now())fail(`SX_LOG dòng ${i+2}: dữ liệu không hợp lệ.`);sourceIds.add(r[1]);
  let matches=state.reports.filter(p=>active(p)&&(p.sourceReportId===r[1]||p.sourceRow?.sourceReportId===r[1]));
  if(!matches.length){matches=state.reports.filter(p=>active(p)&&p.planId===r[2]&&p.sku===r[4]&&p.lsxCode===r[3]&&p.line===r[7]&&Number(p.reportedQuantity)===quantity&&!matched.has(p.id));if(matches.length>1)matches=matches.filter(p=>day(new Date(Date.parse(p.completedAt)+7*3600000).toISOString().slice(0,10).split('-').reverse().join('/'))===day(r[9]));}
  if(matches.length>1||matches.some(p=>matched.has(p.id)))fail(`${r[2]}: báo công trùng hoặc không xác định duy nhất.`);
  const old=matches[0],id=old?.id||`SHEET-REPORT:${r[1]}`;matched.add(id);
  if(pending&&old&&old.reviewStatus!=='Chờ kiểm tra')fail(`${r[2]}: báo công đã được xử lý; không ghi đè bằng chế độ chờ xác nhận.`,409);
  const cumulative=num(r[16]),period=num(r[17]),base=num(r[18]),direct=num(r[19]),late=num(r[14]),helper=num(r[15]),ot=num(r[36]);
  if([cumulative,period,base,direct,late,helper,ot].some(n=>n!=null&&n<0)||direct!=null&&base!=null&&direct>base+0.001)fail(`${r[2]}: giờ nguồn không hợp lệ.`);
  // Missing fields stay missing; the restored warehouse row cannot invent hours or timestamps.
  if(direct==null)warnings.push(`${r[2]}: nguồn chỉ khôi phục sản lượng từ Kho, chưa có giờ công.`);
  const knownSplit=direct!=null&&(r[33]==='KHÔNG'||ot===0),unit=standards.get(o.sku)??null;
  const report={...old,id,kind:'completion',historicalImport:true,estimatedStaffing:false,sourceVerified:true,sourceReportId:r[1],transitId:o.id,orderSnapshot:{...snapshot(o),historicalOnly:false},planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:r[5]||o.name,spec:r[6]||o.spec,line:o.line,lsxQty:o.lsxQty,...timing,startedAt:timing.actualStartedAt,reportedAt:timing.recordedAt,productionDate:day(r[9]),reportedQuantity:quantity,approvedQuantity:pending?0:quantity,sourceCount:count,count,sourceCumulativeHours:cumulative,sourcePeriodHours:period,sourceLaborHours:direct,sourceBasicLaborHours:base,sourceLateHours:late,sourceHelperHours:helper,sourceActor:r[11]||'',reportedBy:r[11]||'',reportedById:r[11]||'',sourceNote:r[12]||'',sourceWorksheetRow:r,sourceReference:`${source.references[0]} / SX_LOG!A${source.sxRowNumbers?.[i]||i+2}:AL${source.sxRowNumbers?.[i]||i+2}`,sourceRow:{sourceReportId:r[1],cumulativeHours:cumulative,recordedAt:timing.recordedAt},employees:[],employeeDetails:[],historicalAllocations:[],hours:{total:direct,hc:knownSplit?direct:null,ot:knownSplit?0:null,perEmployee:[],sourceTotal:true,sourceVerified:true},unallocatedHours:direct,standardUnit:unit,standardLaborHours:unit==null?null:unit*quantity,laborDeviation:unit&&direct!=null?direct/(unit*quantity)-1:null,reviewStatus:pending?'Chờ kiểm tra':'Đã xác nhận',hourStatus:direct==null?'Thiếu giờ nguồn':'Đã đối chiếu tổng giờ nguồn',reviewedBy:pending?null:actor.login,reviewedById:pending?null:actorId,reviewedAt:pending?null:now,sourcePersonnelStatus:r[22]||'',sourceWarehouse:{status:r[23]||'',quantity:num(r[24]),at:moment(r[28]),by:r[29]||'',note:r[31]||''},warehouseStatus:pending?'Chưa tạo phiếu':old?.warehouseStatus||'Đã ghi nhận ở nguồn',confirmationBasis:pending?null:{kind:'google-sheet-reconciliation',references:source.references,sourceReportId:r[1],confirmedQuantity:quantity,sourceDirectHours:direct,personnelConfirmed:false,at:now,by:actorId},laborNotes:[{text:`Đối chiếu SX_LOG: giờ cơ bản ${base??'—'}; trễ/về sớm ${late??'—'}; phụ kho ${helper??'—'}; giờ trực tiếp ${direct??'—'}. Giữ tổng giờ nguồn; nguồn không có danh sách giờ từng nhân viên.${knownSplit?'':' Chưa đủ căn cứ chia giờ HC/TC.'}`}],version:Number(old?.version||0)+1,correctedAt:now,updatedAt:now,updatedBy:actor.login};
  changes.push({entity:'production_report',key:id,before:old||null,after:report});reports.push(report);put('production_report',id,report);
  if(!pending&&r[23]==='CHỜ KHO XÁC NHẬN'&&!records.some(w=>w.entity==='warehouse_in'&&w.record_key===`SX:${id}`))put('warehouse_in',`SX:${id}`,{id:`SX:${id}`,source:'Sản xuất',sourceReference:report.sourceReference,sourceReportId:r[1],reportId:id,planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,line:o.line,proposedQuantity:quantity,receivedQuantity:null,status:'Chờ xác nhận',createdBy:actor.login,createdAt:now});
 }
 for(const o of orders.values()){
  const own=reports.filter(r=>r.transitId===o.id),outside=state.reports.filter(r=>active(r)&&r.transitId===o.id&&!matched.has(r.id));
  if(outside.length)fail(`${o.planId}: còn báo công trên web không có trong nguồn, cần đối chiếu trước.`);
  if(own.reduce((s,r)=>s+r.reportedQuantity,0)>o.lsxQty)fail(`${o.planId}: sản lượng vượt số lượng LSX.`);
 }
 const timeEvents=[],skipped=[],timeIds=new Set(),quantityLinks=new Set();
 for(const r of source.timeRows){
  const o=orders.get(r[2]);if(!o||o.lsxCode!==r[3]||o.sku!==r[4]||o.line!==r[5]||!/^TIME-[-_a-zA-Z0-9]{8,200}$/.test(r[1]||'')||timeIds.has(r[1])||!['BẮT ĐẦU','BÁO CÔNG','HOÀN THÀNH','TẠM NGƯNG','TIẾP TỤC'].includes(r[6])||!moment(r[0])||!moment(r[7])||!r[10]||!['TỰ ĐỘNG','ĐIỀU CHỈNH'].includes(r[9])||num(r[8])==null||num(r[8])<0||Date.parse(moment(r[0]))>Date.now()||Date.parse(moment(r[7]))>Date.now())fail(`${r[1]}: thao tác nguồn không hợp lệ.`);timeIds.add(r[1]);
  const sourceRow={sourceEventId:r[1],planId:r[2],lsxCode:r[3],sku:r[4],line:r[5],operation:r[6],effectiveAt:new Date(moment(r[7])).toISOString(),recordedAt:new Date(moment(r[0])).toISOString(),cumulativeHours:num(r[8]),source:r[9],actor:r[10],note:r[11]||''};
  const old=oldTime.find(e=>e.sourceEventId===r[1]);if(old&&JSON.stringify(old.sourceRow)!==JSON.stringify(sourceRow))fail(`${r[1]}: thao tác nguồn đã thay đổi; cần đối chiếu riêng.`,409);
  const linked=['BÁO CÔNG','HOÀN THÀNH'].includes(r[6])?reports.find(p=>p.transitId===o.id&&Date.parse(p.completedAt)===Date.parse(sourceRow.effectiveAt)&&Math.abs(Date.parse(p.reportedAt)-Date.parse(sourceRow.recordedAt))<10*60000):null;
  const quantityEvent=linked&&!quantityLinks.has(linked.id);if(linked)quantityLinks.add(linked.id);
  const event={...old,id:old?.id||`SHEET-TIME:${r[1]}`,kind:'source-time',sourceTimeLog:true,historicalImport:true,sourceVerified:true,sourceEventId:r[1],sourceId:o.id,planId:o.planId,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,line:o.line,orderSnapshot:snapshot(o),effectiveAt:sourceRow.effectiveAt,recordedAt:sourceRow.recordedAt,sourceOperation:r[6],sourceCumulativeHours:num(r[8]),cumulativeLaborHours:null,source:r[9],actor:r[10],actorId:r[10],reason:`Giờ hoạt động lũy kế nguồn: ${num(r[8])} giờ/người. ${r[11]||''}`,sourceRow,sourceWorksheetRow:r,reportId:linked?.id,sourceQuantityEvent:Boolean(quantityEvent),quantity:quantityEvent?linked.reportedQuantity:null,reviewStatus:'Nhật ký nguồn',importedAt:now,importedBy:actorId};
  // Retain existing immutable archive events; an explicit projection supplies canonical links.
  timeEvents.push(event);if(old)skipped.push(event.sourceEventId);
 }
 const summary={reports:reports.length,newReports:reports.filter(r=>!state.reports.some(p=>p.id===r.id)).length,updatedReports:reports.filter(r=>state.reports.some(p=>p.id===r.id)).length,orders:orders.size,newOrders:[...orders.values()].filter(o=>!oldOrders.some(p=>(p.id||p.key)===o.id)).length,timeEvents:timeEvents.length,newTimeEvents:timeEvents.length-skipped.length,sourceHoursMissing:reports.filter(r=>r.hours.total==null).length};
 const batch={id:batchId,reconciliation:true,pendingReview:pending,source:'Đối chiếu Google Sheet SX_LOG + SX_TIME_LOG + 04_IN_TRANSIT',references:source.references,actor:actor.login,actorId,createdAt:now,nonce:crypto.randomUUID(),summary,reports:[],timeEvents,skipped,warnings,changes:changes.map(c=>({entity:c.entity,key:c.key,created:!c.before,before:c.before?{quantity:c.before.reportedQuantity,hours:c.before.hours?.total,completedAt:c.before.completedAt}:null,after:{quantity:c.after.reportedQuantity,hours:c.after.hours?.total,completedAt:c.after.completedAt}}))};
 if(body.action==='preview')return {ok:true,revision,batch:{...batch,reports,changes:changes.map(c=>({entity:c.entity,key:c.key,before:c.before?{quantity:c.before.reportedQuantity,hours:c.before.hours,completedAt:c.before.completedAt}:null,after:{quantity:c.after.reportedQuantity,hours:c.after.hours,completedAt:c.after.completedAt}}))}};
 if(body.revision!==revision)fail('Dữ liệu web vừa thay đổi; đối chiếu lại trước khi lưu.',409);
 for(const change of changes)put(change.entity==='in_transit'?'in_transit_audit':'admin_audit',`${batchId}:${change.entity}:${change.key}`,{...change,action:auditAction,references:source.references,actor:actor.login,actorId,at:now});
 put('production_event',`${batchId}:audit`,{id:`${batchId}:audit`,kind:'report-source-reconciliation',historicalImport:true,line:null,effectiveAt:now,recordedAt:now,actor:actor.login,actorId,reason:'Đối chiếu toàn bộ báo công và thao tác nguồn với In transit',before:{},after:summary});
 put('production_cursor','global',{version:Number(raw('production_cursor').find(r=>r.key==='global')?.version||0)+1,token:crypto.randomUUID()});
 // A single snapshot guard and JSON upsert batch are atomic, including all orders, reports and audit.
 const payload=JSON.stringify({...batch,timeEvents:[]});
 chunks(timeEvents).forEach((events,index)=>put('production_history_import',`${batchId}:time:${index}`,{id:`${batchId}:time:${index}`,source:batch.source,createdAt:now,reports:[],timeEvents:events,parentBatchId:batchId,actor:actor.login,actorId}));
 const expected=chunks(records);
 const guards=expected.map(()=>"AND NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity=json_extract(e.value,'$.entity') AND a.record_key=json_extract(e.value,'$.record_key') AND a.payload=json_extract(e.value,'$.payload'))) ").join('');
 const statements=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_history_import',?,?,?,? WHERE (SELECT count(*) FROM app_records WHERE entity IN ${entities})=? ${guards} ON CONFLICT(entity,record_key) DO NOTHING`).bind(batchId,payload,actorId,now,records.length,...expected.map(r=>JSON.stringify(r))),
 ...chunks(writes).map(group=>db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT json_extract(e.value,'$.entity'),json_extract(e.value,'$.key'),json_extract(e.value,'$.payload'),?,? FROM json_each(?) e WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='production_history_import' AND record_key=? AND payload=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(actorId,now,JSON.stringify(group),batchId,payload))];
 const result=await db.batch(statements);if(result[0].meta.changes!==1||result.slice(1).reduce((s,r)=>s+r.meta.changes,0)!==writes.length)fail('Dữ liệu vừa thay đổi; chưa lưu đối chiếu. Vui lòng tải lại.',409);
 return {ok:true,saved:true,revision,batch:{...batch,reports,changes:[]}};
}
