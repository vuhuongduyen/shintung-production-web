import {createHash} from 'node:crypto';
import {sessionUser,isAdminRole} from './password-auth.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
import {withCorrectionSnapshot} from '../scripts/local/production-correction-snapshot.mjs';
import {recalculateProductionReport} from '../scripts/local/production-workflow.mjs';
import {effectiveAttendance} from '../lib/production-attendance.mjs';
import {projectLiveStages} from '../lib/production-stage-live.mjs';
export const MAIN='sanxuat.shintung-vn-4458.chatgpt.site',SOURCE='onspa-thu-nghiem-21102026.shintung-vn-4458.chatgpt.site';
const DATE='2026-10-30',START=Date.parse(DATE+'T00:00:00+07:00');
const SCOPE="'in_transit','production_event','production_report','production_cursor','capacity','production_schedule','employees','sku','warehouse_in'";
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const p=r=>JSON.parse(r.payload),key=r=>r.entity+'\0'+r.record_key;
const norm=x=>String(x||'').trim().toUpperCase().replace(/ASSY\s+1$/,'ASSY');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const valid=r=>!r.cancelled&&!r.voided&&!r._deleted&&r.reviewStatus!=='Cần điều chỉnh';
const stageQty=r=>Number(r.stageQuantity??r.reportedQuantity??0);
const rowsOf=(rows,e)=>rows.filter(r=>r.entity===e).map(r=>({...p(r),id:p(r).id||r.record_key}));
const read=db=>readRecordPages(db,{where:`entity IN (${SCOPE})`,columns:'entity,record_key,payload'});
// Follow only links actually referenced by the exported station assignments.
function movementDependencies(stageEvents,all){
 const needed=new Set(stageEvents.flatMap(e=>[e.stageBefore,e.stageAfter].flatMap(s=>Object.values(s?.lineAssignments||{}).map(x=>x.movementId).filter(Boolean))));
 let changed=true;while(changed){changed=false;for(const e of all){if(!['line-movement','attendance-cancel'].includes(e.kind))continue;
 if(needed.has(e.id)||needed.has(e.supersedes)){for(const id of [e.id,e.supersedes,...(e.parentMovementIds||[])].filter(Boolean))if(!needed.has(id)){needed.add(id);changed=true;}}
 }}
 return all.filter(e=>needed.has(e.id));
}
export function cutoverInventory(rows){
 const reports=rowsOf(rows,'production_report'),events=rowsOf(rows,'production_event');
 const latest=new Map();for(const e of events.filter(e=>e.stageReporting&&!e.voided&&e.stageAfter).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)))latest.set(e.sourceId+'\0'+norm(e.stageName),e);
 return rowsOf(rows,'in_transit').filter(o=>!o._deleted&&(reports.some(r=>r.transitId===o.id&&r.productionDate===DATE&&valid(r))||[...latest.values()].some(e=>e.sourceId===o.id&&['running','paused'].includes(e.stageAfter.status)))).map(o=>({id:o.id,lsxCode:o.lsxCode,sku:o.sku,line:o.line,quantity:o.lsxQty,reports:reports.filter(r=>r.transitId===o.id&&r.productionDate===DATE&&valid(r)).length}));
}
export function exportCutover(rows,orderId,now=new Date().toISOString()){
 const order=rowsOf(rows,'in_transit').find(o=>o.id===orderId&&!o._deleted);if(!order)fail('Không tìm thấy lệnh nguồn.');
 const reports=rowsOf(rows,'production_report').filter(r=>r.transitId===orderId&&Date.parse(r.completedAt)<=Date.parse(now));
 const events=rowsOf(rows,'production_event').filter(e=>e.sourceId===orderId&&e.stageReporting&&!e.importedStageProjection&&Date.parse(e.effectiveAt)<=Date.parse(now));
 const ids=new Set(events.flatMap(e=>[...(e.stageBefore?.people||[]),...(e.stageAfter?.people||[])]));
 const movements=movementDependencies(events,rowsOf(rows,'production_event'));
 const packet={movements,format:'ONSPA-SELECTIVE-CUTOVER-1',source:SOURCE,target:MAIN,date:DATE,createdAt:now,order,reports,events,employees:rowsOf(rows,'employees').filter(e=>ids.has(e.id)).map(e=>({id:e.id,name:e.name,line:e.line})),note:'Chỉ dữ liệu lệnh và nhân lực tham chiếu; không chứa tài khoản, quyền, tệp, cấu hình hoặc khóa.'};
 return {...packet,digest:hash(packet)};
}
export async function planCutover(db,packet,providedRows){
 if(packet?.format!=='ONSPA-SELECTIVE-CUTOVER-1'||packet.source!==SOURCE||packet.target!==MAIN||packet.date!==DATE||!Array.isArray(packet.events)||!Array.isArray(packet.reports)||packet.events.length>2000||packet.reports.length>1000)fail('Gói không đúng nguồn, đích hoặc phạm vi.');
 const {digest,...unsigned}=packet;if(hash(unsigned)!==digest)fail('Gói dữ liệu bị thay đổi hoặc thiếu nội dung.');
 const rows=providedRows||await read(db),orders=rowsOf(rows,'in_transit'),reports=rowsOf(rows,'production_report'),events=rowsOf(rows,'production_event'),directory=rowsOf(rows,'employees');
 const source=packet.order;const sameOrder=o=>!o._deleted&&o.status!=='HỦY'&&['lsxCode','sku','line','lsxQty'].every(f=>String(o[f])===String(source[f]));const candidates=orders.filter(sameOrder);const order=orders.find(o=>o.id===source.id)||(candidates.length===1?candidates[0]:null),incoming=packet.reports.filter(r=>r.productionDate===DATE&&valid(r));
 if(!order||['lsxCode','sku','line','lsxQty'].some(f=>String(order[f])!==String(source[f])))fail('Lệnh/SKU/Line/số lượng không khớp web chính: '+source.lsxCode);
 if(order._deleted||order.status==='HỦY')fail('Lệnh web chính đã hủy.');
 if(packet.reports.some(r=>r.transitId!==source.id)||packet.events.some(e=>e.sourceId!==source.id))fail('Gói chứa dữ liệu lệnh khác.');
 if(incoming.some(r=>!Number.isFinite(stageQty(r))||stageQty(r)<=0||![0,stageQty(r)].includes(Number(r.reportedQuantity||0))||!Number.isFinite(Date.parse(r.completedAt))||Date.parse(r.completedAt)>Date.parse(packet.createdAt)||!Number.isFinite(Date.parse(r.startedAt))))fail('Số lượng hoặc thời gian phiếu không hợp lệ.');
 if(packet.events.some(e=>e.kind!=='stage-work'||!e.stageReporting||!e.stageAfter||!['running','paused','partial','done','waiting'].includes(e.stageAfter.status)||!Array.isArray(e.stageAfter.people)))fail('Gói có loại nhật ký chưa hỗ trợ.');
 const writes=[],skipped=[],conflicts=[],rawExisting=new Map(rows.map(r=>[key(r),r]));
 const add=(entity,id,value)=>{
  const old=rawExisting.get(entity+'\0'+id);if(old){const saved=p(old);if(saved.cutover?.sourceHash===value.cutover?.sourceHash){skipped.push(id);return;}conflicts.push('Bản đã chuyển thay đổi: '+id);return;}
  writes.push({entity,record_key:id,payload:JSON.stringify(value)});
 };
 const dependencies=packet.movements||[];
 if(!Array.isArray(dependencies)||dependencies.length>2000)fail('Lịch chuyển Line không hợp lệ.');
 const allowed=new Set(movementDependencies(packet.events,dependencies).map(e=>e.id));
 const aliases=new Map(),matchedMovements=[];const targetMoves=effectiveAttendance(events).filter(e=>e.kind==='line-movement');
 for(const e of dependencies){
  if(!allowed.has(e.id)||!['line-movement','attendance-cancel'].includes(e.kind)||!e.id||!Number.isFinite(Date.parse(e.effectiveAt))||Date.parse(e.effectiveAt)>Date.parse(packet.createdAt))fail('Gói có lịch chuyển Line ngoài phạm vi.');
  if(e.kind==='line-movement'&&(!Array.isArray(e.employees)||!e.employees.length||!e.line||!e.destinationLine||e.line===e.destinationLine||(e.endsAt?(!Number.isFinite(Date.parse(e.endsAt))||Date.parse(e.endsAt)<=Date.parse(e.effectiveAt)):!e.directoryAssignment)))fail('Khoảng chuyển Line không hợp lệ.');
  for(const id of e.employees||[])if(!directory.some(d=>norm(d.id)===norm(id)))conflicts.push('Chuyển Line: thiếu nhân viên '+id);
  const existing=events.find(x=>x.id===e.id);
  if(existing){const {cutover,...original}=existing;if(hash(original)===hash(e)||cutover?.sourceHash===hash(e)){skipped.push(e.id);continue;}conflicts.push('Lịch chuyển Line đã thay đổi trên web chính: '+e.id);continue;}
  // Reuse an already saved identical movement even if the two sites generated different IDs.
  const equivalent=e.kind==='line-movement'&&!e.supersedes?targetMoves.filter(x=>x.line===e.line&&x.destinationLine===e.destinationLine&&Date.parse(x.effectiveAt)===Date.parse(e.effectiveAt)&&(x.endsAt||null)===(e.endsAt||null)&&Boolean(x.directoryAssignment)===Boolean(e.directoryAssignment)&&e.employees.every(id=>x.employees?.includes(id))):[];
  if(equivalent.length===1){aliases.set(e.id,equivalent[0].id);matchedMovements.push({sourceId:e.id,targetId:equivalent[0].id,employees:e.employees,from:e.effectiveAt,to:e.endsAt});skipped.push('Lịch chuyển Line đã có: '+equivalent[0].id);continue;}
  add('production_event',e.id,{...e,cutover:{source:SOURCE,sourceHash:hash(e),date:DATE}});
 }
 const activeMoves=effectiveAttendance([...events,...writes.filter(w=>w.entity==='production_event').map(p)]).filter(e=>e.kind==='line-movement');
 const newMoves=new Set(writes.map(w=>w.record_key));
 const ancestors=(e,seen=new Set())=>{for(const id of e.parentMovementIds||[]){if(seen.has(id))continue;seen.add(id);const parent=activeMoves.find(x=>x.id===id);if(parent)ancestors(parent,seen);}return seen;};
 for(let i=0;i<activeMoves.length;i++)for(let j=i+1;j<activeMoves.length;j++){
  const a=activeMoves[i],b=activeMoves[j];if(a.directoryAssignment||b.directoryAssignment)continue;if(!newMoves.has(a.id)&&!newMoves.has(b.id))continue;
  if(ancestors(a).has(b.id)||ancestors(b).has(a.id))continue;
  if(Date.parse(a.effectiveAt)<Date.parse(b.endsAt)&&Date.parse(b.effectiveAt)<Date.parse(a.endsAt)&&a.employees.some(id=>b.employees.includes(id)))conflicts.push('Lịch chuyển Line trùng người/giờ: '+JSON.stringify([a,b].map(e=>({id:e.id,line:e.line,destinationLine:e.destinationLine,employees:e.employees,effectiveAt:e.effectiveAt,endsAt:e.endsAt}))));
 }
 const linkedEvents=[...events,...writes.filter(w=>w.entity==='production_event').map(p)];
 const stageEvents=packet.events.filter(e=>!e.voided&&e.stageAfter).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
 const stages=[...new Set(stageEvents.map(e=>norm(e.stageName)))],catalog=rowsOf(rows,'sku');
 const catalogOrder=o=>({...o,processes:catalog.find(s=>norm(s.code||s.id)===norm(o.sku))?.processes||[]});
 for(const stage of stages){
  const chain=stageEvents.filter(e=>norm(e.stageName)===stage),last=chain.at(-1),selected=incoming.filter(r=>norm(r.stageName)===stage).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt));
  if(!selected.length&&!['running','paused'].includes(last.stageAfter.status))continue;
  const old=reports.filter(r=>r.transitId===order.id&&norm(r.stageName)===stage&&valid(r)&&!r.cutover);
  if(old.some(r=>Date.parse(r.completedAt)>=START)){conflicts.push(stage+': web chính đã có báo công ngày 30; cần đối chiếu riêng.');continue;}
  const completed=old.reduce((n,r)=>n+stageQty(r),0),priorSource=packet.reports.filter(r=>norm(r.stageName)===stage&&r.productionDate<DATE&&valid(r)).reduce((n,r)=>n+stageQty(r),0);
  if(priorSource>completed){conflicts.push(stage+': nguồn trước 30/10 có '+priorSource+' nhưng ERP chỉ có '+completed+'.');continue;}
  if(completed+selected.reduce((n,r)=>n+stageQty(r),0)>Number(order.lsxQty)){conflicts.push(stage+': tổng sản lượng vượt số lượng lệnh.');continue;}
  if(completed>=Number(order.lsxQty)&&!selected.length){skipped.push(stage+': ERP đã đủ sản lượng');continue;}
  const floor=old.length?Math.max(...old.map(r=>Date.parse(r.completedAt))):Date.parse(chain[0].effectiveAt);
  if(!Number.isFinite(floor)){conflicts.push(stage+': thiếu mốc nối giờ');continue;}
  const before=chain.filter(e=>Date.parse(e.effectiveAt)<=floor).at(-1),following=chain.filter(e=>Date.parse(e.effectiveAt)>floor);
  const chosen=[...(before?[{...before,id:'baseline:'+order.id+':'+stage,effectiveAt:new Date(floor).toISOString(),stageAction:'cutover',reportId:null,quantity:0,stageQuantity:0}]:[]),...following];
  if(!chosen.length){conflicts.push(stage+': không có nhật ký để nối giờ');continue;}
  const reportIds=new Set(selected.map(r=>r.id));
  const normalizeState=(state,at)=>state?{...state,completed:completed+selected.filter(r=>Date.parse(r.completedAt)<=at).reduce((n,r)=>n+stageQty(r),0),startedAt:new Date(Math.max(floor,Date.parse(state.startedAt)||floor)).toISOString()}:state;
  for(const original of chosen){
   const e=structuredClone(original),ids=[...(e.stageAfter?.people||[]),...(e.stageBefore?.people||[])];
   e.sourceId=order.id;e.planId=order.planId;for(const state of [e.stageBefore,e.stageAfter])if(state){state.orderId=order.id;for(const loan of Object.values(state.lineAssignments||{}))if(aliases.has(loan.movementId))loan.movementId=aliases.get(loan.movementId);}
   for(const id of ids){if(!directory.some(p=>norm(p.id)===norm(id))){conflicts.push(stage+': thiếu nhân viên '+id);continue;}
    const loan=e.stageAfter?.lineAssignments?.[id];if(loan&&!linkedEvents.some(x=>x.id===loan.movementId))conflicts.push(stage+': thiếu lịch chuyển Line liên kết của '+id);
   }
   e.id='CUTOVER114:'+e.id;e.stageAfter=normalizeState(e.stageAfter,Date.parse(e.effectiveAt));e.stageBefore=normalizeState(e.stageBefore,Date.parse(e.effectiveAt)-1);
   if(e.stageAfter.completed>=Number(order.lsxQty)){e.stageAfter.status='done';e.stageAfter.people=[];}
   if(e.reportId&&!reportIds.has(e.reportId)){e.sourceReportId=e.reportId;e.reportId=null;e.stageAction='cutover';e.quantity=0;e.stageQuantity=0;}
   else if(e.reportId)e.reportId='CUTOVER114:'+e.reportId;
   e.cutover={source:SOURCE,sourceHash:hash(original),sourceEventId:original.id,date:DATE};
   add('production_event',e.id,e);
  }
  let start=floor;
  for(const sourceReport of selected){
   const end=Date.parse(sourceReport.completedAt);if(!(end>start)){conflicts.push(stage+': giờ kết thúc không sau mốc ERP');continue;}
   const r={id:'CUTOVER114:'+sourceReport.id,kind:'completion',stageReporting:true,transitId:order.id,orderSnapshot:order,planId:order.planId,lsxCode:order.lsxCode,sku:order.sku,name:order.name,spec:order.spec,line:order.line,lsxQty:order.lsxQty,stageName:sourceReport.stageName,stageQuantity:stageQty(sourceReport),reportedQuantity:Number(sourceReport.reportedQuantity||0),startedAt:new Date(start).toISOString(),actualStartedAt:sourceReport.actualStartedAt||sourceReport.startedAt,completedAt:sourceReport.completedAt,productionDate:DATE,employees:sourceReport.employees||[],count:sourceReport.count,sourceCount:sourceReport.sourceCount,reportedAt:sourceReport.reportedAt,reportedBy:sourceReport.reportedBy,reportedById:sourceReport.reportedById,actorId:sourceReport.actorId,reviewStatus:'Chờ kiểm tra',warehouseStatus:'Chưa tạo phiếu',version:1,note:sourceReport.note||'',cutover:{source:SOURCE,sourceReportId:sourceReport.id,sourceHash:hash(sourceReport),originalReviewStatus:sourceReport.reviewStatus,date:DATE}};
   const combined=[...events,...writes.filter(w=>w.entity==='production_event').map(w=>p(w))];
   Object.assign(r,await recalculateProductionReport(db,combined,r,directory.map(e=>({key:e.id,payload:e}))));
   if(!r.hours||!Number.isFinite(r.hours.total)||r.hours.total<0){conflicts.push(stage+': không tính được giờ');continue;}
   r.importedStageTimeline=combined.filter(e=>e.cutover&&e.sourceId===order.id&&norm(e.stageName)===stage);
   add('production_report',r.id,r);start=end;
  }
 }
 const combinedEvents=[...events,...writes.filter(w=>w.entity==='production_event').map(p)],combinedReports=[...reports,...writes.filter(w=>w.entity==='production_report').map(p)];
 const state=projectLiveStages(orders.map(catalogOrder),combinedReports,combinedEvents),people=new Map();
 for(const s of Object.values(state))for(const id of s.people||[]){if(people.has(id)&&(s.orderId===order.id||people.get(id).orderId===order.id))conflicts.push('Nhân viên '+id+' đang ở hai công đoạn: '+people.get(id).stage+' / '+s.stage);people.set(id,s);}
 return {rows,writes,matchedMovements,orderMatch:{sourceId:source.id,targetId:order.id,sourcePlanId:source.planId,targetPlanId:order.planId},skipped,conflicts:[...new Set(conflicts)],revision:hash(rows),order:{id:order.id,lsxCode:order.lsxCode},reports:writes.filter(w=>w.entity==='production_report').map(w=>{const r=p(w);return {id:r.id,stage:r.stageName,quantity:r.stageQuantity,start:r.startedAt,end:r.completedAt,hours:r.hours.total,status:r.reviewStatus};}),assignments:Object.values(state).filter(s=>s.orderId===order.id).map(s=>({stage:s.stage,status:s.status,completed:s.completed,people:s.people}))};
}
export async function applyCutover(db,packet,expected,actor){
 return withCorrectionSnapshot(db,SCOPE,async(rows,snapshot)=>{
  const plan=await planCutover(db,packet,rows);if(plan.conflicts.length)fail(plan.conflicts.join('\n'));if(!plan.writes.length)return {ok:true,already:true,skipped:plan.skipped};if(plan.revision!==expected)fail('Dữ liệu thay đổi sau preview; chưa nhập.');
  const id=crypto.randomUUID(),now=new Date().toISOString(),cursor=rows.find(r=>r.entity==='production_cursor'&&r.record_key==='global'),raw=cursor?.payload||JSON.stringify({version:0,token:''}),next=JSON.stringify({version:Number(JSON.parse(raw).version||0)+1,token:id});
  await db.prepare("INSERT INTO app_records VALUES('production_cursor','global',?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(raw,actor.login,now).run();
  const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
  const batch=[db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND "+snapshot.sql).bind(next,actor.login,now,raw,...snapshot.args)];
  for(const w of plan.writes){batch.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE '+guard).bind(w.entity,w.record_key,w.payload,actor.login,now,next));batch.push(db.prepare("INSERT INTO app_records SELECT 'production_cutover_backup',?,?,?,? WHERE "+guard).bind(id+':'+w.record_key,JSON.stringify({entity:w.entity,key:w.record_key,before:null,after:w.payload,packetDigest:packet.digest}),actor.login,now,next));}
  batch.push(db.prepare("INSERT INTO app_records SELECT 'production_cutover_audit',?,?,?,? WHERE "+guard).bind(id,JSON.stringify({id,at:now,actor:actor.login,order:plan.order,packetDigest:packet.digest,source:SOURCE,counts:{reports:plan.reports.length,records:plan.writes.length}}),actor.login,now,next));
  const result=await db.batch(batch);if(result[0].meta.changes!==1)fail('Có cập nhật đồng thời; chưa nhập.');
  // Verify only the records just written; avoid retaining a second full database snapshot in Worker memory.
  const after=await db.batch(plan.writes.map(w=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(w.entity,w.record_key)));
  const verified=plan.writes.filter((w,i)=>after[i]?.results?.[0]?.payload===w.payload).length;
  if(verified!==plan.writes.length)fail('Đã gửi nhập nhưng chưa đối chiếu đủ; không tự gửi lại.');
  return {ok:true,auditId:id,verified,records:plan.writes.length,reports:plan.reports,assignments:plan.assignments,skipped:plan.skipped};
 });
}
const html=source=>`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ONSPA · Chuyển báo công chọn lọc</title><style>body{font:18px 'Times New Roman',serif;max-width:1100px;margin:20px auto;padding:16px;color:#24354b}textarea{box-sizing:border-box;width:100%;height:140px}button,select{padding:10px;margin:6px}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f2f5f4}</style><h1>Chuyển báo công · ${source?'Web thử cũ':'Web chính'}</h1><p>Giữ ERP đến 29/10. Nối nhật ký làm tiếp và nhập phiếu ngày 30/10 ở trạng thái Chờ kiểm tra. Không xác nhận, không gửi kho/Sheet, không thay tài khoản hoặc cấu hình.</p>${source?'<button id="inventory">Đọc danh sách lệnh</button><label>Lệnh <select id="order"></select></label><button id="export">Xuất lệnh đã chọn</button>':'<label>Gói dữ liệu từ web thử<textarea id="input"></textarea></label><button id="preview">Đối chiếu trước khi nhập</button><button id="apply" disabled>Nhập lệnh đã đối chiếu</button>'}<pre id="result" role="status">Chưa thao tác.</pre>${source?'<label>Gói chuyển<textarea id="output" readonly></textarea></label>':''}<a href="/">Về ONSPA</a><script>let busy=false,revision=null;const status=document.querySelector('#result'),input=document.querySelector('#input');async function run(action){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await fetch('/api/production-cutover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,orderId:document.querySelector('#order')?.value,packet:input?JSON.parse(input.value):null,revision})}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.orders){const select=document.querySelector('#order');select.replaceChildren();for(const o of d.orders){const el=document.createElement('option');el.value=o.id;el.textContent=o.lsxCode+' · '+o.sku+' · Line '+o.line+' · '+o.reports+' phiếu ngày 30';select.append(el);}}if(d.packet)document.querySelector('#output').value=JSON.stringify(d.packet);status.textContent=JSON.stringify(d.packet?{order:d.packet.order.lsxCode,reports:d.packet.reports.length,events:d.packet.events.length,digest:d.packet.digest}:d,null,2);revision=action==='preview'&&!d.conflicts.length?d.revision:null;}catch(e){status.textContent=e.message+' Không tự gửi lại lệnh nhập.';revision=null;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=b.id==='apply'&&!revision);}}document.querySelectorAll('button').forEach(b=>b.onclick=()=>run(b.id));if(input)input.oninput=()=>{revision=null;document.querySelector('#apply').disabled=true;};</script></html>`;
export async function productionCutover(request,env){
 const u=new URL(request.url);if(!['/production-cutover','/api/production-cutover'].includes(u.pathname))return null;
 const json=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
 try{if(![SOURCE,MAIN].includes(u.hostname))fail('Sai môi trường.',403);const actor=await sessionUser(request,env);if(!actor||!isAdminRole(actor.role))fail('Cần phiên Admin hiện hành.',403);const source=u.hostname===SOURCE;
  if(u.pathname==='/production-cutover'&&request.method==='GET')return new Response(html(source),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"}});
  if(request.method!=='POST'||request.headers.get('origin')!==u.origin||!request.headers.get('content-type')?.startsWith('application/json'))fail('Yêu cầu không hợp lệ.',403);const raw=await request.text();if(raw.length>8_000_000)fail('Gói quá lớn.',413);const b=JSON.parse(raw);
  if(source&&b.action==='inventory')return json({orders:cutoverInventory(await read(env.DB))});
  if(source&&b.action==='export'){const first=exportCutover(await read(env.DB),b.orderId),second=exportCutover(await read(env.DB),b.orderId,first.createdAt);if(first.digest!==second.digest)fail('Nguồn đang thay đổi; chưa xuất gói. Đọc lại lệnh.');return json({packet:first});}
  if(!source&&b.action==='preview'){const {rows,writes,...summary}=await planCutover(env.DB,b.packet);return json({...summary,records:writes.length});}
  if(!source&&b.action==='apply')return json(await applyCutover(env.DB,b.packet,b.revision,actor));
  fail('Thao tác không được phép tại môi trường này.',403);
 }catch(e){return json({error:e.status?e.message:'Không hoàn tất thao tác. Kiểm tra kết quả trước khi gửi lại.'},e.status||500);}
}
