import {auditSubmittedInput} from '../lib/audit-submitted-input.mjs';
// Separate, bounded execution receipts. Never accept client-supplied actor or success.
export const auditRoutes=new Set(['/api/warehouse-confirm','/api/change-requests','/api/records','/api/linked-records','/api/basic-master-cancel','/api/bom','/api/bom-bulk','/api/bom-change','/api/bom-pdf-reconciliation','/api/capacity','/api/employees','/api/engine-run','/api/forecast-import','/api/in-transit','/api/inventory-import','/api/labor-hours','/api/production-allocation','/api/production-allocation-scope','/api/production-correction','/api/production-examples','/api/production-history-import','/api/production-hr-hours','/api/production-plan','/api/production-report','/api/production-standards','/api/production-workflow','/api/sku-confirm','/api/sku-request','/api/sku-unit-import','/api/user-permission-setup','/api/storage-upload','/api/feedback']);
const excludedActor=actor=>[actor?.userId,actor?.permissionLogin,actor?.login].some(value=>typeof value==='string'&&value.trim().toLowerCase()==='vthduyen');
const text=(v,n=160)=>typeof v==='string'?v.replace(/[\x00-\x1f]/g,' ').slice(0,n):'';
const routes={'/api/warehouse-confirm':'warehouse_in','/api/production-report':'production_report','/api/production-workflow':'production_event','/api/production-correction':'production_report','/api/capacity':'capacity','/api/in-transit':'in_transit','/api/production-plan':'production_plan','/api/employees':'employees','/api/labor-hours':'labor_hours','/api/production-allocation':'capacity','/api/production-history-import':'production_history_import'};
export function auditContext(path,body={}){
 const action=text(body.action||body.kind||'Lưu'),entity=body.action==='warehouse-duty'?'production_schedule':routes[path]||text(body.entity)||path.replace('/api/','');
 const operationLabels={review:'Xác nhận báo công','warehouse-duty':'Ghi nhận phụ kho',start:'Nhập trạm',pause:'Tạm ngưng',resume:'Tiếp tục',complete:'Xuất trạm',save:'Lưu',cancel:'Hủy',delete:'Xóa'};
 const context={route:path,entity,operation:operationLabels[action]||action,...(path==='/api/production-report'?{menu:'Tiến độ SX'}:{}),record:text(body.orderId||body.reportId||body.key||body.id||body.week||''),line:text(body.line,10)};
 for(const key of ['effectiveAt','endsAt','week','quantity','count','approve'])if(['string','number','boolean'].includes(typeof body[key]))context[key]=typeof body[key]==='string'?text(body[key]):body[key];
 if(!['users','permissions'].includes(context.entity)&&path!=='/api/user-permission-setup')context.submittedInput=auditSubmittedInput(body);
 return context;
}
export function auditOutcome(status,body){
 if(status>=500)return {outcome:'failed',reason:'Máy chủ không hoàn tất yêu cầu. Cần kiểm tra lỗi hệ thống.'};
 if(status>=400||body?.ok===false){const raw=text(body?.error,400);const failureDetails=Array.isArray(body?.details)?body.details.slice(0,3000).map(item=>Object.fromEntries(['id','sku','reason'].filter(key=>typeof item?.[key]==='string'&&!/password|token|secret|cookie|authorization|SELECT |INSERT |SQLITE|stack|base64/i.test(item[key])).map(key=>[key,text(item[key],240)]))):[];return {...(failureDetails.length?{failureDetails}:{}),outcome:status===401||status===403?'denied':'failed',reason:raw&&!/password|token|secret|cookie|authorization|SELECT |INSERT |SQLITE|stack|base64/i.test(raw)?raw:status===403?'Không có quyền thực hiện.':'Yêu cầu không hợp lệ hoặc không thành công.'};}
 return {outcome:body?.replayed?'replayed':'succeeded',reason:body?.replayed?'Yêu cầu đã xử lý trước đó; không ghi lặp.':'Máy chủ xác nhận xử lý thành công.'};
}
export async function writeReceipt(db,actor,id,payload,update=false){
 if(excludedActor(actor))return;
 const actorId=String(actor.userId||actor.permissionLogin||actor.login),now=new Date().toISOString();
 const value=JSON.stringify({...payload,id,actorId,actor:actorId,at:payload.at||now});
 if(update)return db.prepare("UPDATE app_records SET payload=?,updated_at=? WHERE entity='website_action_audit' AND record_key=? AND updated_by=?").bind(value,now,id,actorId).run();
 return db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('website_action_audit',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(id,value,actorId,now).run();
}
export async function auditMutation({request,env,actor,run}){
 if(excludedActor(actor))return run();
 const path=new URL(request.url).pathname;let body={};
 if(request.headers.get('content-type')?.includes('application/json')){try{const raw=await request.clone().text();if(raw.length<=8000000)body=JSON.parse(raw);}catch{}}
 const clientRequestId=request.headers.get('X-ONSPA-Client-Action-ID');
 const id=crypto.randomUUID(),context={...(clientRequestId&&/^[a-zA-Z0-9-]{16,80}$/.test(clientRequestId)?{requestId:clientRequestId}:{}),...auditContext(path,body),at:new Date().toISOString(),outcome:'received',reason:'Máy chủ đã nhận; chưa có kết quả cuối.',evidence:'server'};
 try{await writeReceipt(env.DB,actor,id,context);}catch{return Response.json({error:'Chưa ghi được nhật ký thao tác. Chưa thực hiện thay đổi; vui lòng thử lại.'},{status:503});}
 let response;try{response=await run();}catch{response=Response.json({error:'Không thể hoàn tất thao tác.'},{status:500});}
 if(!response)return response;
 let result;try{if(response.headers.get('content-type')?.includes('application/json')){const raw=await response.clone().text();if(raw.length<1000000)result=JSON.parse(raw);}}catch{}
 try{await writeReceipt(env.DB,actor,id,{...context,...auditOutcome(response.status,result),httpStatus:response.status,finishedAt:new Date().toISOString()},true);}catch{console.warn('ONSPA action receipt completion unavailable');response.headers.set('X-ONSPA-Audit','pending');}
 response.headers.set('X-ONSPA-Action-ID',id);return response;
}
export async function clientReceipt(request,env,actor){
 const url=new URL(request.url);
 if(request.method!=='POST'||request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
 if(excludedActor(actor))return Response.json({ok:true,skipped:true});
 const raw=await request.text();if(raw.length>40000)return Response.json({error:'Nội dung quá dài.'},{status:413});
 let b;try{b=JSON.parse(raw);}catch{return Response.json({error:'JSON không hợp lệ.'},{status:400});}
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(b.id||'')||!['ui-blocked','network-unknown','attempted','ui-unavailable'].includes(b.outcome))return Response.json({error:'Loại nhật ký không hợp lệ.'},{status:400});
 await writeReceipt(env.DB,actor,`${actor.userId||actor.login}:${b.id}`,{entity:'website_action',operation:text(b.operation,120)||'Thao tác bị chặn',record:text(b.record),requestId:text(b.requestId,80),route:text(b.route),httpStatus:Number.isInteger(b.httpStatus)?b.httpStatus:undefined,menu:text(b.menu,120)||'Giao diện website',outcome:b.outcome,evidence:'client',reason:b.outcome==='ui-unavailable'?'Nút phân trang không khả dụng tại vị trí hiện tại; không có yêu cầu lưu dữ liệu.':b.outcome==='attempted'?'Người dùng yêu cầu gửi dữ liệu; chưa xác nhận máy chủ đã lưu.':b.outcome==='network-unknown'?'Trình duyệt không nhận được kết quả. Không kết luận dữ liệu đã lưu hay chưa.':b.reasonCode==='permission'?'Trình duyệt báo không có quyền thực hiện.':b.reasonCode==='validation'?'Trình duyệt báo dữ liệu chưa hợp lệ hoặc thiếu trường bắt buộc.':'Trình duyệt báo không thể thực hiện. Chưa có xác nhận thành công từ máy chủ.',clientAt:text(b.clientAt,40),...(b.submittedInput?{submittedInput:auditSubmittedInput(b.submittedInput)}:{}),...(b.validationMessage&&!/password|token|secret|cookie|authorization|SELECT |INSERT |SQLITE|stack|base64/i.test(b.validationMessage)?{validationMessage:text(b.validationMessage,400)}:{})});
 return Response.json({ok:true});
}
