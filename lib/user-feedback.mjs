import {recordRevision,conflictMessage} from './record-revision.mjs';
const entity='user_feedback';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const actorId=actor=>actor?.userId||actor?.permissionLogin||actor?.login;
const text=(v,max,label,required=true)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(`${label} không hợp lệ (tối đa ${max} ký tự).`);return v.trim();};
const statuses=['Mới','Đang xử lý','Đã xử lý','Không áp dụng'];
async function saved(db,id){const row=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,id).first();return row?{raw:row.payload,record:JSON.parse(row.payload),revision:await recordRevision(row.payload)}:null;}
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function validateImage(image){
 const name=text(image?.name,240,'Tên ảnh');if(typeof image.base64!=='string'||image.base64.length>7_000_000)fail('Ảnh không được quá 5 MB.');
 let bytes;try{bytes=Uint8Array.from(atob(image.base64),c=>c.charCodeAt(0));}catch{fail('Dữ liệu ảnh không hợp lệ.');}
 if(!bytes.length||bytes.length>5*1024*1024)fail('Ảnh không được quá 5 MB.');
 const head=new TextDecoder().decode(bytes.slice(0,12));const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'?'image/webp':null;
 if(!type)fail('Chỉ nhận ảnh PNG, JPG hoặc WebP.');return {name,bytes,type,checksum:await hash(bytes)};
}
async function create(db,bucket,body,actor){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id||''))fail('Mã gửi không hợp lệ.');
 const title=text(body.title,160,'Tiêu đề'),content=text(body.content,6000,'Nội dung'),context=text(body.context||'',300,'Màn hình',false),kind=['Báo lỗi','Góp ý'].includes(body.kind)?body.kind:fail('Chọn loại phản hồi.');
 const images=body.images||[];if(!Array.isArray(images)||images.length>3)fail('Đính kèm tối đa 3 ảnh.');const validated=await Promise.all(images.map(validateImage));if(validated.reduce((sum,i)=>sum+i.bytes.length,0)>10*1024*1024)fail('Tổng dung lượng ảnh không được quá 10 MB.');
 const fingerprint=await hash(new TextEncoder().encode(JSON.stringify({title,content,context,kind,images:validated.map(i=>({name:i.name,checksum:i.checksum}))}))),old=await saved(db,body.id);
 if(old){if(old.record.senderId!==actorId(actor)||old.record.fingerprint!==fingerprint)fail('Mã gửi đã được dùng cho phản hồi khác.',409);return {ok:true,record:old.record,revision:old.revision};}
 const now=new Date().toISOString(),id=body.id,by=actorId(actor),attachments=[];
 for(const image of validated){const fileId=crypto.randomUUID(),key=`feedback/${id}/${fileId}`;await bucket.put(key,image.bytes,{httpMetadata:{contentType:image.type}});attachments.push({file_id:fileId,object_key:key,name:image.name,type:image.type,size:image.bytes.length,checksum:image.checksum});}
 const record={id,code:`PH-${now.slice(0,10).replaceAll('-','')}-${id.slice(0,8).toUpperCase()}`,title,content,kind,context,status:'Mới',senderId:by,senderName:actor.name||by,department:actor.department||'',line:actor.line||null,createdAt:now,updatedAt:now,updatedBy:by,response:'',history:[],fingerprint,images:attachments.map(({object_key,...image})=>image)};
 const raw=JSON.stringify(record),auditId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)";
 const writes=[db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING').bind(entity,id,raw,by,now)];
 for(const image of attachments)writes.push(db.prepare(`INSERT INTO file_objects SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(image.file_id,image.object_key,image.name,image.type,image.size,'feedback',id,by,now,image.checksum,'ready',entity,id,raw));
 writes.push(db.prepare(`INSERT INTO app_records SELECT ?,?,?,?,? WHERE ${guard}`).bind('admin_audit',auditId,JSON.stringify({action:'FEEDBACK_CREATED',entity,key:id,actor:by,at:now}),by,now,entity,id,raw));
 const result=await db.batch(writes);if(!result[0].meta.changes){const existing=await saved(db,id);if(existing?.record.senderId===by&&existing.record.fingerprint===fingerprint)return {ok:true,record:existing.record,revision:existing.revision};fail(conflictMessage,409);}
 return {ok:true,record,revision:await recordRevision(raw)};
}
async function update(db,body,actor){
 if(!actor.isAdmin)fail('Chỉ Admin được xử lý phản hồi.',403);const old=await saved(db,body.id);if(!old)fail('Không tìm thấy phản hồi.',404);if(body.expectedRevision!==old.revision)fail(conflictMessage,409);
 if(!statuses.includes(body.status))fail('Trạng thái không hợp lệ.');const response=text(body.response||'',6000,'Nội dung trả lời',false),now=new Date().toISOString(),by=actorId(actor),auditId=crypto.randomUUID();
 const change={at:now,actor:by,name:actor.name||by,beforeStatus:old.record.status,status:body.status,beforeResponse:old.record.response,response};
 const record={...old.record,status:body.status,response,updatedBy:by,updatedAt:now,history:[...old.record.history,change]},raw=JSON.stringify(record);
 const result=await db.batch([db.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=? AND payload=?').bind(raw,by,now,entity,body.id,old.raw),db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE changes()=1').bind('admin_audit',auditId,JSON.stringify({action:'FEEDBACK_UPDATED',entity,key:body.id,actor:by,at:now,change}),by,now)]);if(!result[0].meta.changes)fail(conflictMessage,409);return {ok:true,record,revision:await recordRevision(raw)};
}
export async function feedbackApi(request,{DB:db,FILES:bucket},actor){
 const url=new URL(request.url);if(!['/api/feedback','/api/feedback-image'].includes(url.pathname))return null;
 try{
 if(!actorId(actor))fail('Vui lòng đăng nhập để gửi phản hồi.',401);
 if(url.pathname==='/api/feedback-image'){
  if(request.method!=='GET')fail('Phương thức không hợp lệ.',405);const row=await db.prepare("SELECT * FROM file_objects WHERE module='feedback' AND file_id=?").bind(url.searchParams.get('id')).first();if(!row)fail('Không tìm thấy ảnh.',404);
  const parent=await saved(db,row.record_id);if(!parent||!actor.isAdmin&&parent.record.senderId!==actorId(actor)||!parent.record.images.some(i=>i.file_id===row.file_id))fail('Không có quyền xem ảnh này.',403);
  const file=await bucket.get(row.object_key);if(!file)fail('Ảnh chưa khả dụng; vui lòng thử lại.',503);return new Response(file.body,{headers:{'Content-Type':row.content_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }
 if(request.method==='GET'){
  if(url.searchParams.has('id')){const item=await saved(db,url.searchParams.get('id'));if(!item)fail('Không tìm thấy phản hồi.',404);if(!actor.isAdmin&&item.record.senderId!==actorId(actor))fail('Không có quyền xem phản hồi này.',403);return json(item);}
  const where=['entity=?'],args=[entity];if(!actor.isAdmin||url.searchParams.get('scope')==='mine'){where.push("json_extract(payload,'$.senderId')=?");args.push(actorId(actor));}
  for(const key of ['status','kind'])if(url.searchParams.get(key)){where.push(`json_extract(payload,'$.${key}')=?`);args.push(url.searchParams.get(key));}
  for(const [param,op]of [['from','>='],['to','<=']])if(url.searchParams.get(param)){const date=url.searchParams.get(param);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('Ngày tra cứu không hợp lệ.');where.push(`date(json_extract(payload,'$.createdAt'),'+7 hours')${op}?`);args.push(date);}
  if(url.searchParams.get('q')?.trim()){const q='%'+url.searchParams.get('q').trim().slice(0,160)+'%';where.push("(json_extract(payload,'$.title') LIKE ? OR json_extract(payload,'$.senderId') LIKE ? OR json_extract(payload,'$.senderName') LIKE ? OR json_extract(payload,'$.code') LIKE ?)");args.push(q,q,q,q);}
  const offset=Math.max(0,Math.min(1000000,Number(url.searchParams.get('offset'))||0)),clause=where.join(' AND '),[count,rows]=await db.batch([db.prepare(`SELECT count(*) AS total FROM app_records WHERE ${clause}`).bind(...args),db.prepare(`SELECT payload FROM app_records WHERE ${clause} ORDER BY updated_at DESC,record_key DESC LIMIT 50 OFFSET ?`).bind(...args,offset)]);
  return json({total:count.results[0].total,records:rows.results.map(r=>JSON.parse(r.payload))});
 }
 if(request.method!=='POST')fail('Phương thức không hợp lệ.',405);if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))fail('Yêu cầu JSON cùng origin.',403);
 const raw=await request.text();if(raw.length>15_000_000)fail('Tổng dung lượng ảnh quá lớn.',413);let body;try{body=JSON.parse(raw);}catch{fail('Dữ liệu gửi không hợp lệ.');}
 if(body.action==='create')return json(await create(db,bucket,body,actor));if(body.action==='update')return json(await update(db,body,actor));fail('Thao tác không hợp lệ.');
 }catch(error){return json({error:error.status?error.message:'Không lưu được phản hồi. Nội dung đang nhập vẫn được giữ; vui lòng thử lại.'},error.status||503);}
}
