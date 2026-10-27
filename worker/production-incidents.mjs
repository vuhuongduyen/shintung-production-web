import {getTransit} from '../scripts/local/in-transit.mjs';
import {orderStatus} from '../lib/in-transit.mjs';
import {productionMenuRights} from '../lib/menu-action-access.mjs';
import {incidentLogin,incidentRights,incidentStages,incidentStage} from '../lib/production-incidents.mjs';
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
const text=value=>String(value||'').trim();
const hours=value=>{const n=Number(value);if(!Number.isFinite(n)||n<=0||n>8760)fail('Nhập thời gian xử lý lớn hơn 0 giờ (có thể nhập số lẻ, ví dụ 0,5 giờ).');return n;};
const snapshot=r=>JSON.stringify(r);
export async function createProductionIncident(db,actor,body,workflow){
 if(!productionMenuRights(actor).work)fail('Không có quyền Báo sự cố tại SX báo công.',403);
 const login=incidentLogin(actor),id=text(body.id);if(!/^[a-zA-Z0-9-]{10,80}$/.test(id))fail('Mã yêu cầu không hợp lệ. Đóng khung và mở lại Báo sự cố.');
 const existing=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(id).first();
 if(existing){const r=JSON.parse(existing.payload);if(r.kind!=='production-incident'||r.owner!==login||r.incident.orderId!==body.orderId)fail('Mã yêu cầu đã được sử dụng.',409);return {ok:true,record:r,duplicate:true};}
 const order=workflow.orders.find(o=>o.id===body.orderId);if(order?.status==='HỦY')fail('Lệnh đã hủy tại In transit. Không thể báo sự cố.',409);if(!order||order.historicalOnly||actor.line&&actor.line!==order.line)fail('Lệnh không thuộc Line được phép báo sự cố hoặc chưa mở lệnh.',403);
 const allowed=incidentStages(order,workflow.reports),stages=[...new Set((Array.isArray(body.stages)?body.stages:[]).map(incidentStage))];
 if(!stages.length||stages.some(s=>!allowed.includes(s)))fail('Chọn công đoạn chưa hoàn thành của lệnh. Tải lại nếu công đoạn vừa thay đổi.');
 const reason=text(body.reason);if(!reason||reason.length>12000)fail('Nhập nội dung sự cố (tối đa 12.000 ký tự).');
 const estimatedHours=hours(body.estimatedHours),category=text(body.category);if(!['Máy hư','Thiếu NVL','Khác'].includes(category))fail('Chọn loại sự cố.');
 const now=new Date().toISOString(),local=new Date(Date.parse(now)+7*3600000).toISOString();
 const r={id,kind:'production-incident',code:'PSC-'+id.slice(0,8).toUpperCase(),owner:login,department:'QLSX',createdAt:now,updatedAt:now,date:local.slice(0,10),time:local.slice(11,16),revision:1,drafts:{},recipients:['QLSX'],pendingDepartments:['QLSX'],messages:[{text:`${order.lsxCode} · ${stages.join(', ')}\n${category}: ${reason}\nDự kiến xử lý: ${estimatedHours} giờ.`,at:now,login,department:'SX',action:'create'}],incident:{status:'awaiting_qlsx',orderId:order.id,lsxCode:order.lsxCode,sku:order.sku,name:order.name,line:order.line,stages,category,reason,estimatedHours,startedAt:now,expectedAt:new Date(Date.parse(now)+estimatedHours*3600000).toISOString(),delayRisk:Boolean(body.delayRisk)}};
 const write=db.prepare("INSERT OR IGNORE INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('department_change',?,?,?,?)").bind(id,snapshot(r),login,now);
 const event={id:'incident:'+id,kind:'stage-incident',sourceId:order.id,line:order.line,stages,reason,incidentId:id,stopWork:true,effectiveAt:now,recordedAt:now,actor:login,actorId:login};
 const statements=[write,db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_event',?,?,?,? WHERE changes()=1").bind(event.id,snapshot(event),login,now)];
 statements.push(db.prepare("INSERT INTO app_records SELECT 'production_cursor','global',?,?,? WHERE changes()=1 ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify({version:Date.now(),token:crypto.randomUUID()}),login,now));
 if(login!=='sample_user_15')statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),snapshot({entity:'department_change',action:'incident-create',key:id,actor:login,at:now,after:r}),login,now));
 const result=await db.batch(statements);if(!result[0].meta.changes)fail('Phiếu vừa được lưu. Mở Phiếu báo sự cố để kiểm tra trước khi tạo lại.',409);
 return {ok:true,record:r};
}
export async function incidentReplacementOrders(db,actor,id){
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(text(id)).first(),r=row?JSON.parse(row.payload):null;
 if(!r||r.kind!=='production-incident')fail('Không tìm thấy phiếu báo sự cố.',404);
 if(!incidentRights(r,actor).canReplyIncident||actor.line&&actor.line!==r.incident.line)fail('Không có quyền chọn lệnh thay thế cho phiếu này.',403);
 const {rows}=await getTransit(db);
 return {orders:rows.filter(o=>o.id!==r.incident.orderId&&o.line===r.incident.line&&orderStatus(o)==='ĐÃ MỞ LSX').map(o=>({id:o.id,lsxCode:o.lsxCode,sku:o.sku,name:o.name,spec:o.spec,line:o.line,lsxQty:o.lsxQty})).sort((a,b)=>a.lsxCode.localeCompare(b.lsxCode,'vi'))};
}
export async function updateProductionIncident(db,actor,body){
 const login=incidentLogin(actor),row=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(text(body.id)).first(),r=row?JSON.parse(row.payload):null;
 if(!r||r.kind!=='production-incident')fail('Không tìm thấy phiếu báo sự cố.',404);
 if(actor.line&&actor.line!==r.incident.line)fail('Phiếu không thuộc Line của bạn.',403);
 const rights=incidentRights(r,actor),permission={'incident-confirm':'canConfirmIncident','incident-reply':'canReplyIncident','incident-resolve':'canResolveIncident'}[body.action];
 if(!permission||!rights[permission])fail('Bạn không có quyền thực hiện hoặc phiếu đã chuyển bước. Mở lại phiếu để kiểm tra.',403);
 if(body.revision!==r.revision)fail('Phiếu vừa được cập nhật. Đóng và mở lại phiếu trước khi thao tác.',409);
 const next=structuredClone(r),now=new Date().toISOString();let content='',department='QLSX';
 if(body.action==='incident-confirm'){next.incident.status='awaiting_khsx';next.incident.confirmedBy=login;next.incident.confirmedAt=now;next.pendingDepartments=['KHSX'];next.recipients=['QLSX','KHSX'];content='QLSX đã xác nhận phiếu và chuyển KHSX phản hồi hướng xử lý.';}
 if(body.action==='incident-reply'){content=text(body.text);if(content.length>12000)fail('Hướng xử lý tối đa 12.000 ký tự.');next.incident.replaceOrders=body.replaceOrders===true;next.incident.replacementOrders=[];
 if(next.incident.replaceOrders){
 const ids=[...new Set(Array.isArray(body.replacementOrderIds)?body.replacementOrderIds:[])];
 if(!ids.length)fail('Chọn ít nhất một lệnh thay thế hoặc bỏ tích Thay thế LSX.');
 const {orders}=await incidentReplacementOrders(db,actor,r.id),byId=new Map(orders.map(o=>[o.id,o]));
 if(ids.some(id=>!byId.has(id)))fail('Lệnh thay thế không còn hợp lệ: phải là lệnh đã mở của đúng Line có sự cố. Mở lại danh sách và chọn lại.');
 next.incident.replacementOrders=ids.map(id=>byId.get(id));
 content+=(content?'\n':'')+'Lệnh thay thế cần thực hiện:\n'+next.incident.replacementOrders.map(o=>`${o.lsxCode} · ${o.sku} · ${o.name} · ${o.spec||''} · Line ${o.line}`).join('\n');
 }
 next.incident.status='handling';next.incident.resolution=content;next.incident.delayRisk=Boolean(body.delayRisk);next.incident.delayNote=text(body.delayNote);if(next.incident.delayNote.length>4000)fail('Ghi chú trễ tối đa 4.000 ký tự.');if(next.incident.delayRisk&&!next.incident.delayNote)fail('Nhập ghi chú nguy cơ trễ lệnh để SX theo dõi.');department='KHSX';next.pendingDepartments=[];}
 if(body.action==='incident-resolve'){content=text(body.text);if(!content||content.length>12000)fail('Nhập kết quả xử lý.');next.incident.actualHours=hours(body.actualHours);next.incident.resolvedAt=now;next.incident.resolvedBy=login;next.incident.status='resolved';next.pendingDepartments=[];content=`Đã xử lý trong ${next.incident.actualHours} giờ. ${content}`;}
 next.messages.push({text:content,at:now,login,department,action:body.action});next.revision++;next.updatedAt=now;
 const write=db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='department_change' AND record_key=? AND payload=?").bind(snapshot(next),login,now,r.id,row.payload);
 const statements=[write];if(login!=='sample_user_15')statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),snapshot({entity:'department_change',action:body.action,key:r.id,actor:login,at:now,before:r,after:next}),login,now));
 const result=await db.batch(statements);if(!result[0].meta.changes)fail('Phiếu vừa được cập nhật. Mở lại phiếu để xem trạng thái mới.',409);
 return {ok:true,record:next};
}
