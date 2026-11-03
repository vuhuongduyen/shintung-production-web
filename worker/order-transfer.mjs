import {sessionUser,isAdminRole} from './password-auth.mjs';
import {createHash} from 'node:crypto';
const MAIN='sanxuat.shintung-vn-4458.chatgpt.site',TRIAL='onspa-thu-nghiem-21102026.shintung-vn-4458.chatgpt.site';
const entities=['in_transit','in_transit_audit','production_event','production_report','production_history_import'];
const sqlScope="entity IN ('in_transit','in_transit_audit','production_event','production_report','production_history_import','production_cursor')";
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status});};
const payload=r=>JSON.parse(r.payload);
const refs=p=>[p.transitId,p.sourceId,p.destinationId,p.recordId,...(p.rows||[]).flatMap(refs),...(p.reports||[]).flatMap(refs)].filter(Boolean);
const synced=p=>p.syncStatus==='ĐÃ ĐỒNG BỘ'&&!p._deleted&&!!p.lsxCode;
const read=async db=>(await db.prepare(`SELECT entity,record_key,payload FROM app_records WHERE ${sqlScope} ORDER BY entity,record_key`).all()).results;
export function inventory(rows){return {format:'ONSPA-order-inventory-v1',target:TRIAL,revision:digest(rows),orders:rows.filter(r=>r.entity==='in_transit').map(r=>({key:r.record_key,...payload(r)}))};}
export function exportOrders(rows,inv){
 if(inv?.format!=='ONSPA-order-inventory-v1'||inv.target!==TRIAL||!Array.isArray(inv.orders))fail('Cần bản đối chiếu từ web thử.');
 const existing=new Map(inv.orders.map(p=>[p.key,p]));
 const orders=rows.filter(r=>r.entity==='in_transit'&&synced(payload(r))&&(!existing.has(r.record_key)||(!synced(existing.get(r.record_key))&&!existing.get(r.record_key)._deleted)));
 const ids=new Set(orders.map(r=>r.record_key)),selected=[];
 for(const r of rows){
  if(r.entity==='production_cursor')continue;
  if(r.entity==='in_transit'){if(ids.has(r.record_key))selected.push(r);continue;}
  const rr=refs(payload(r));if(!rr.some(id=>ids.has(id)))continue;
  if(rr.some(id=>!ids.has(id)))fail('Dữ liệu QLSX liên kết cả lệnh cũ và lệnh mới; cần đối chiếu riêng: '+r.record_key);
  selected.push(r);
 }
 return {format:'ONSPA-new-orders-v1',source:MAIN,target:TRIAL,createdAt:new Date().toISOString(),targetRevision:inv.revision,records:selected,orders:orders.map(r=>{const p=payload(r);return {id:r.record_key,lsxCode:p.lsxCode,sku:p.sku,line:p.line,quantity:p.lsxQty};})};
}
export async function transferPlan(db,packet){
 if(packet?.format!=='ONSPA-new-orders-v1'||packet.source!==MAIN||packet.target!==TRIAL||!Array.isArray(packet.records)||packet.records.length>1500)fail('Gói đồng bộ không hợp lệ.');
 const rows=await read(db);if(digest(rows)!==packet.targetRevision)fail('Dữ liệu web thử đã thay đổi. Lấy bản đối chiếu mới trước khi đồng bộ.',409);
 const incoming=packet.records,keys=new Set(),orders=incoming.filter(r=>r.entity==='in_transit'),ids=new Set(orders.map(r=>r.record_key)),existing=new Map(rows.map(r=>[r.entity+'\0'+r.record_key,r]));
 const changes=[];
 for(const r of incoming){
  if(!entities.includes(r.entity)||typeof r.record_key!=='string'||typeof r.payload!=='string'||keys.has(r.entity+'\0'+r.record_key))fail('Gói có loại dữ liệu ngoài phạm vi hoặc trùng khóa.');keys.add(r.entity+'\0'+r.record_key);
  const p=payload(r),rr=refs(p),old=existing.get(r.entity+'\0'+r.record_key);
  if(r.entity==='in_transit'){
   if(!synced(p)||p.id&&p.id!==r.record_key)fail('Chỉ nhận lệnh KHSX đã đồng bộ.');
   if(old&&(synced(payload(old))||payload(old)._deleted))fail('Không ghi đè lệnh đã đồng bộ hoặc đã xóa ở web thử: '+p.lsxCode);
   if(rows.some(x=>['production_event','production_report','production_history_import'].includes(x.entity)&&refs(payload(x)).includes(r.record_key)))fail('Lệnh đã có hoạt động thử, không ghi đè: '+p.lsxCode);
   const master=await db.prepare("SELECT payload FROM app_records WHERE entity='sku' AND record_key=?").bind(p.sku).first();if(!master)fail('Web thử thiếu SKU '+p.sku+'; chưa đồng bộ.');
  }else if(!rr.length||rr.some(id=>!ids.has(id)))fail('Dữ liệu QLSX ngoài các lệnh mới.');
  if(old&&old.payload!==r.payload&&r.entity!=='in_transit')fail('Có dữ liệu thử khác bản nguồn: '+r.record_key);
  if(!old||old.payload!==r.payload)changes.push({...r,before:old?.payload??null});
 }
 return {rows,changes,orders:orders.map(r=>{const p=payload(r);return {id:r.record_key,lsxCode:p.lsxCode,sku:p.sku,line:p.line,quantity:p.lsxQty};}),counts:Object.fromEntries(entities.map(e=>[e,changes.filter(r=>r.entity===e).length])),revision:digest(rows)};
}
export async function applyOrders(db,packet,actor){
 const plan=await transferPlan(db,packet);if(!plan.orders.length)return {ok:true,orders:[],counts:plan.counts,message:'Không có lệnh mới cần đồng bộ.'};
 const id=crypto.randomUUID(),now=new Date().toISOString(),guard='order-transfer:'+id;
 // A single atomic batch checks the whole relevant target snapshot before any mutation.
 const snapshotSQL=`SELECT json_group_array(json_object('entity',entity,'record_key',record_key,'payload',payload)) FROM (SELECT entity,record_key,payload FROM app_records WHERE ${sqlScope} ORDER BY entity,record_key)`;
 const audit={id,source:MAIN,exportedAt:packet.createdAt,at:now,actor:actor.login,orders:plan.orders,counts:plan.counts,changes:plan.changes};
 const statements=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'order_transfer_audit',?,?,?,? WHERE (${snapshotSQL})=?`).bind(guard,JSON.stringify(audit),actor.login,now,JSON.stringify(plan.rows))];
 for(const r of plan.changes)statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='order_transfer_audit' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(r.entity,r.record_key,r.payload,actor.login,now,guard));
 const cursor=plan.rows.find(r=>r.entity==='production_cursor'&&r.record_key==='global');
 statements.push(db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_cursor','global',?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='order_transfer_audit' AND record_key=?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify({version:Number(cursor?payload(cursor).version:0)+1,token:id}),actor.login,now,guard));
 const result=await db.batch(statements);if(result[0].meta.changes!==1)fail('Có thay đổi đồng thời; chưa ghi dữ liệu. Hãy đối chiếu lại.',409);
 const after=await read(db),map=new Map(after.map(r=>[r.entity+'\0'+r.record_key,r.payload]));
 const matched=plan.changes.filter(r=>map.get(r.entity+'\0'+r.record_key)===r.payload).length;
 return {ok:true,auditId:guard,orders:plan.orders,counts:plan.counts,verified:matched,total:plan.changes.length,message:'Đã đồng bộ và đối chiếu dữ liệu. Có lưu bản trước/sau; không chuyển cấu hình, tài khoản, kho hoặc tệp.'};
}
const html=trial=>`<!doctype html><html lang="vi"><meta charset="utf-8"><title>ONSPA · Đồng bộ lệnh mới</title><style>body{font:16px system-ui;max-width:1050px;margin:35px auto;color:#24354b}textarea{width:100%;height:130px}button{padding:10px 18px;margin:12px 8px 12px 0}pre{white-space:pre-wrap;background:#f1f5f9;padding:20px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #ccd}p{line-height:1.5}</style><h1>Đồng bộ lệnh mới · ${trial?'Web thử':'Web chính'}</h1><p>Chỉ In Transit và nhật ký/báo công liên quan các lệnh mới KHSX đã đồng bộ. Giữ lệnh thử đã có hoạt động. Không chuyển nhân sự, lịch chung, tài khoản, cấu hình, dữ liệu kho hoặc tệp.</p><a href="/">Về ONSPA</a><p>${trial?'1. Lấy bản đối chiếu, chuyển sang web chính để tạo gói lệnh. 2. Dán gói lệnh vào đây và kiểm tra trước khi đồng bộ.':'Dán bản đối chiếu từ web thử để xuất đúng các lệnh còn thiếu hoặc chưa đồng bộ.'}</p><label for="input">Dữ liệu đầu vào</label><textarea id="input"></textarea><div>${trial?'<button id="inventory">Lấy bản đối chiếu web thử</button><button id="preview">Kiểm tra gói lệnh</button><button id="apply" disabled>Đồng bộ các lệnh đã kiểm tra</button>':'<button id="export">Xuất gói lệnh mới</button>'}</div><h2>Kết quả đối chiếu</h2><pre id="result" role="status">Chưa thao tác.</pre><div id="orders"></div><label for="output">Dữ liệu chuyển môi trường</label><textarea id="output" readonly></textarea><script>
const input=document.querySelector('#input'),output=document.querySelector('#output'),result=document.querySelector('#result'),orders=document.querySelector('#orders');let packet=null;
async function run(action){try{document.querySelectorAll('button').forEach(b=>b.disabled=true);const data=await fetch('/api/order-transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:action==='inventory'?null:JSON.parse(input.value)})}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j});result.textContent=JSON.stringify(data.summary||data,null,2);if(data.output)output.value=JSON.stringify(data.output);orders.replaceChildren();if(data.orders?.length){const table=document.createElement('table');const tr=table.insertRow();for(const t of ['Lệnh','SKU','Line','SL lệnh']){const th=document.createElement('th');th.textContent=t;tr.append(th);}for(const o of data.orders){const r=table.insertRow();for(const v of [o.lsxCode,o.sku,o.line,o.quantity])r.insertCell().textContent=String(v??'');}orders.append(table);}packet=action==='preview'?input.value:null;}catch(e){result.textContent=e.message;packet=null;}finally{document.querySelectorAll('button').forEach(b=>b.disabled=b.id==='apply'&&!packet);}}
document.querySelectorAll('button').forEach(b=>b.onclick=()=>run(b.id));input.oninput=()=>{packet=null;const b=document.querySelector('#apply');if(b)b.disabled=true;};</script></html>`;
export async function orderTransfer(request,env){
 const u=new URL(request.url);if(!['/order-transfer','/api/order-transfer'].includes(u.pathname))return null;
 const json=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
 try{
 if(![MAIN,TRIAL].includes(u.hostname))fail('Môi trường không hợp lệ.',403);
 const user=await sessionUser(request,env);if(!user||!isAdminRole(user.role))fail('Cần đăng nhập Admin ONSPA.',403);
 const trial=u.hostname===TRIAL;
 if(u.pathname==='/order-transfer'&&request.method==='GET')return new Response(html(trial),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'"}});
 if(request.method!=='POST'||request.headers.get('origin')!==u.origin||!request.headers.get('content-type')?.startsWith('application/json'))fail('Yêu cầu không hợp lệ.',403);
 const raw=await request.text();if(raw.length>8_000_000)fail('Gói quá lớn.',413);const b=JSON.parse(raw);
 if(trial&&b.action==='inventory'){const inv=inventory(await read(env.DB));return json({summary:{orders:inv.orders.length,revision:inv.revision},output:inv});}
 if(!trial&&b.action==='export'){const out=exportOrders(await read(env.DB),b.data);return json({summary:{orders:out.orders.length,records:out.records.length,createdAt:out.createdAt},orders:out.orders,output:out});}
 if(trial&&b.action==='preview'){const p=await transferPlan(env.DB,b.data);return json({summary:{orders:p.orders.length,counts:p.counts},orders:p.orders});}
 if(trial&&b.action==='apply')return json(await applyOrders(env.DB,b.data,user));
 fail('Không cho phép thao tác ở môi trường này.',403);
 }catch(e){return json({error:e.message},e.status||400);}
}
