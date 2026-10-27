import {sessionUser,isAdminRole} from './password-auth.mjs';
import {stagedDatabaseSnapshot} from './backup-snapshot.mjs';
import {createHash} from 'node:crypto';
export const LIVE='disabled.example.invalid';
export const TEST='disabled.example.invalid';
const ROOT='_onspa_environment_refresh/';
const API='/api/environment-refresh';
const lockEntity='environment_refresh_lock';
const kept=['users','permissions','departments','department_permissions','versions'];
export const businessWhere=`entity NOT IN (${kept.map(s=>`'${s}'`).join(',')}) AND entity NOT GLOB 'training_*' AND entity NOT GLOB 'source_sync*' AND entity NOT GLOB 'warehouse_sheet*' AND entity NOT GLOB 'environment_refresh*' AND entity NOT GLOB 'sku_sync_guard*'`;
export const businessEntity=e=>!kept.includes(e)&&!['training_','source_sync','warehouse_sheet','environment_refresh','sku_sync_guard'].some(p=>e.startsWith(p));
const tables=['app_records','file_objects','sku_data_migrations','production_example_records'];
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const digest=v=>createHash('sha256').update(v).digest('hex');
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
const error=(s,status=409)=>{throw Object.assign(Error(s),{status});};
const stageName=()=>`_onspa_pc_snapshot_${Date.now()}_${crypto.randomUUID().replaceAll('-','')}`;
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function objects(bucket){let cursor;const list=[];do{const p=await bucket.list({limit:1000,...(cursor?{cursor}:{}),include:['httpMetadata','customMetadata']});list.push(...p.objects.filter(o=>!o.key.startsWith('_onspa_')));cursor=p.truncated?p.cursor:null;}while(cursor);return list.map(o=>({key:o.key,size:o.size,etag:o.etag,httpMetadata:o.httpMetadata||{},customMetadata:o.customMetadata||{}}));}
async function read(bucket,key){const o=await bucket.get(key);return o?o.json():null;}
async function put(bucket,key,value){await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
async function columns(db){const result={};for(const t of tables){const cols=(await db.prepare(`PRAGMA table_info(${quote(t)})`).all()).results;if(cols.length)result[t]=cols.map(c=>c.name);}return result;}
async function snapshot(db){
 const cols=await columns(db),stage=stageName(),commands=[db.prepare(`CREATE TABLE ${quote(stage)} (id INTEGER PRIMARY KEY,t TEXT NOT NULL,v TEXT NOT NULL)` )];
 for(const [t,c] of Object.entries(cols))commands.push(db.prepare(`INSERT INTO ${quote(stage)}(t,v) SELECT '${t}',json_array(${c.map(quote).join(',')}) FROM ${quote(t)} ${t==='app_records'?'WHERE '+businessWhere:''}`));
 const r=await db.batch(commands);const counts=Object.fromEntries(Object.keys(cols).map((t,i)=>[t,r[i+1].meta.changes]));
 const groups=(await db.prepare(`SELECT json_extract(v,'$[0]') AS entity,COUNT(*) AS count FROM ${quote(stage)} WHERE t='app_records' GROUP BY 1 ORDER BY 1`).all()).results;
 return {stage,columns:cols,counts,groups,total:Object.values(counts).reduce((a,b)=>a+b,0)};
}
async function page(db,stage,cursor){return (await db.prepare(`SELECT id,t,v FROM (SELECT id,t,v,SUM(length(CAST(v AS BLOB))) OVER (ORDER BY id) AS bytes,ROW_NUMBER() OVER (ORDER BY id) AS n FROM (SELECT id,t,v FROM ${quote(stage)} WHERE id>? ORDER BY id LIMIT 64)) WHERE bytes<=1500000 OR n=1 ORDER BY id`).bind(cursor).all()).results;}
async function fileHash(bucket,key){const object=await bucket.get(key);if(!object?.body)error('Thiếu tệp sau khi sao chép.');const hash=createHash('sha256');for await(const c of object.body)hash.update(c);return hash.digest('hex');}
async function copyStream(bucket,key,body,meta,size){
 const upload=await bucket.createMultipartUpload(key,meta),parts=[];let buffer=new Uint8Array(5*1024*1024),used=0,total=0,finished=false;
 try{for await(const chunk of body){let offset=0;total+=chunk.length;while(offset<chunk.length){const n=Math.min(buffer.length-used,chunk.length-offset);buffer.set(chunk.subarray(offset,offset+n),used);used+=n;offset+=n;if(used===buffer.length){parts.push(await upload.uploadPart(parts.length+1,buffer));buffer=new Uint8Array(buffer.length);used=0;}}}if(total!==size)error('Tệp không đủ dung lượng.');if(used||!parts.length)parts.push(await upload.uploadPart(parts.length+1,buffer.subarray(0,used)));await upload.complete(parts);finished=true;}finally{if(!finished)await upload.abort().catch(()=>{});}
}
async function sourceFetch(s,action,extra={}){const response=await fetch(`https://${LIVE}${API}/read`,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.sourceId,token:s.token,action,...extra})});if(!response.ok){const t=await response.text();let msg;try{msg=JSON.parse(t).error;}catch{}error(msg||`Không đọc được web chính (${response.status}). Dữ liệu thật không bị thay đổi.`,502);}return response;}
export async function refreshGuard(request,env){const u=new URL(request.url);if(u.hostname!==TEST||!u.pathname.startsWith('/api/')||u.pathname.startsWith(API)||u.pathname.startsWith('/api/auth/')||u.pathname==='/api/site-session')return null;const lock=await env.DB.prepare('SELECT record_key FROM app_records WHERE entity=?').bind(lockEntity).first();return lock?json({error:'Môi trường thử đang sao lưu và đồng bộ dữ liệu. Vui lòng đợi hoàn tất; web chính vẫn hoạt động bình thường.'},423):null;}
export async function environmentRefresh(request,env){
 const url=new URL(request.url),path=url.pathname,training=url.hostname===TEST;
 if(path!=='/environment-refresh'&&!path.startsWith(API))return null;
 try{
 if(![LIVE,TEST].includes(url.hostname))return json({error:'Chỉ thao tác trên hai môi trường ONSPA đã định danh.'},403);
 if(path===API+'/read'){
  if(training||request.method!=='POST')return json({error:'Không hợp lệ'},403);
  const b=await request.json();if(!validId(b.id)||typeof b.token!=='string'||b.token.length>180)return json({error:'Mã đồng bộ không hợp lệ'},403);
  const s=await read(env.FILES,ROOT+b.id+'/export.json');
  if(!s||s.expires<Date.now()||digest(b.token)!==s.tokenHash)return json({error:'Mã đồng bộ đã hết hạn hoặc không đúng.'},403);
  if(b.action==='manifest'){const {tokenHash,stage,...safe}=s;return json(safe);}
  if(b.action==='page'){if(!Number.isSafeInteger(b.cursor)||b.cursor<0)error('Vị trí không hợp lệ');const rows=await page(env.DB,s.stage,b.cursor);return json({rows,sha256:digest(JSON.stringify(rows))});}
  if(b.action==='file'){
   const f=s.files[b.index];if(!Number.isInteger(b.index)||!f)error('Tệp không hợp lệ');const o=await env.FILES.get(f.key,{onlyIf:{etagMatches:f.etag}});if(!o?.body||o.size!==f.size)error('Tệp trên web chính vừa thay đổi. Tạo bản đồng bộ mới.');
   return new Response(o.body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(o.size),'Cache-Control':'private, no-store'}});
  }
  return json({error:'Chỉ được đọc bản dữ liệu đồng bộ.'},403);
 }
 const user=await sessionUser(request,env);if(!user||!isAdminRole(user.role))return path==='/environment-refresh'?new Response('<p>Cần đăng nhập Admin ONSPA trước khi đồng bộ.</p><a href="/">Về trang đăng nhập</a>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8'}}):json({error:'Cần đăng nhập Admin ONSPA.'},403);
 if(path==='/environment-refresh'&&request.method==='GET')return new Response(html(training),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'"}});
 if(request.method!=='POST'||request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Yêu cầu không hợp lệ.'},403);
 const raw=await request.text();if(raw.length>4096)return json({error:'Yêu cầu quá lớn'},413);const b=JSON.parse(raw);
 if(b.action==='export'){
  if(training)error('Chỉ tạo bản nguồn từ web chính.',403);
  const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID(),files=await objects(env.FILES),snap=await snapshot(env.DB);
  const sourceFiles=(await env.DB.prepare(`SELECT v FROM ${quote(snap.stage)} WHERE t='file_objects'`).all()).results;
  const fm=new Map(files.map(f=>[f.key,f]));for(const row of sourceFiles){const v=JSON.parse(row.v),c=snap.columns.file_objects,f=fm.get(v[c.indexOf('object_key')]);if(!f||f.size!==v[c.indexOf('size')])error('Web chính có metadata thiếu tệp. Cần đối chiếu trước khi chuyển.');}
  const state={format:'ONSPA-TRAINING-REFRESH-v1',id,createdAt:new Date().toISOString(),expires:Date.now()+24*3600000,tokenHash:digest(token),...snap,files};
  await put(env.FILES,ROOT+id+'/export.json',state);
  return json({code:JSON.stringify({id,token}),summary:{createdAt:state.createdAt,counts:state.counts,groups:state.groups,files:files.length}});
 }
 if(!training)return json({error:'Web chính chỉ cho xuất dữ liệu; không cho nhập đè.'},403);
 if(b.action==='status'){
  const row=await env.DB.prepare('SELECT payload FROM app_records WHERE entity=?').bind(lockEntity).first();
  if(!row){const last=await env.DB.prepare("SELECT payload FROM app_records WHERE entity='environment_refresh_history' ORDER BY updated_at DESC LIMIT 1").first();return json({active:false,last:last?JSON.parse(last.payload):null});}
  const s=await read(env.FILES,ROOT+JSON.parse(row.payload).id+'/import.json');return json({active:true,...view(s)});
 }
 if(b.action==='start'){
  let c;try{c=JSON.parse(b.code);}catch{error('Dán mã đồng bộ từ web chính.');}if(!validId(c?.id)||typeof c.token!=='string'||c.token.length>180)error('Mã đồng bộ không hợp lệ.');
  const old=await env.DB.prepare('SELECT record_key FROM app_records WHERE entity=?').bind(lockEntity).first();if(old)error('Có phiên đang chạy. Bấm Tiếp tục để hoàn tất phiên đó.');
  const s={id:crypto.randomUUID(),sourceId:c.id,token:c.token,owner:user.login,startedAt:new Date().toISOString(),phase:'backup-db',cursor:0,imported:0,backupIndex:0,fileIndex:0,verifiedFiles:[],pageHashes:[]};
  s.source=await(await sourceFetch(s,'manifest')).json();if(s.source.format!=='ONSPA-TRAINING-REFRESH-v1')error('Sai định dạng bản đồng bộ.');
  if(JSON.stringify(await columns(env.DB))!==JSON.stringify(s.source.columns))error('Cấu trúc hai môi trường khác nhau. Cần cập nhật cấu trúc trước khi đồng bộ.');
  s.backupFiles=await objects(env.FILES);
  await put(env.FILES,ROOT+s.id+'/import.json',s);
  const r=await env.DB.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,\'active\',?,?,? WHERE NOT EXISTS(SELECT 1 FROM app_records WHERE entity=?)').bind(lockEntity,JSON.stringify({id:s.id}),user.login,s.startedAt,lockEntity).run();
  if(r.meta.changes!==1)error('Một phiên khác vừa bắt đầu.');
  // Lock row uses stable primary key; payload holds the immutable session ID.
  return json(view(s));
 }
 const lock=await env.DB.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=\'active\'').bind(lockEntity).first();
 if(!lock)error('Không có phiên đang đồng bộ.');const id=JSON.parse(lock.payload).id;let s=await read(env.FILES,ROOT+id+'/import.json');if(!s)error('Không tìm thấy trạng thái sao lưu.');
 if(b.action!=='step')error('Thao tác không hợp lệ');
 // Serialize requests across browser tabs; short lease only controls the transport, not business data.
 const lease=await env.DB.prepare("UPDATE app_records SET payload=json_set(payload,'$.leaseUntil',?),updated_at=? WHERE entity=? AND record_key='active' AND (json_extract(payload,'$.leaseUntil') IS NULL OR json_extract(payload,'$.leaseUntil')<?)").bind(Date.now()+120000,new Date().toISOString(),lockEntity,Date.now()).run();
 if(!lease.meta.changes)error('Phiên đồng bộ đang xử lý. Vui lòng thử lại.');
 try{
 s=await read(env.FILES,ROOT+id+'/import.json');
 if(s.phase==='backup-db'){
  if(Date.now()-Date.parse(s.startedAt)<10000)return json({...view(s),message:'Đang chờ các thao tác thử trước đó kết thúc…'});
  s.backup=await stagedDatabaseSnapshot(env.DB,env.FILES,ROOT+id+'/backup/database.sql');
  s.phase='backup-files';
 }else if(s.phase==='backup-files'){
  const f=s.backupFiles[s.backupIndex];
  if(f){const o=await env.FILES.get(f.key,{onlyIf:{etagMatches:f.etag}});if(!o?.body)error('Tệp thử thay đổi trong khi sao lưu. Dừng để giữ dữ liệu.');const key=ROOT+id+'/backup/files/'+s.backupIndex;await copyStream(env.FILES,key,o.body,{httpMetadata:f.httpMetadata,customMetadata:f.customMetadata},f.size);const dest=await env.FILES.head(key);if(dest?.size!==f.size)error('Sao lưu tệp chưa đủ dung lượng.');f.backupKey=key;f.sha256=await fileHash(env.FILES,key);s.backupIndex++;}
  else{
   await put(env.FILES,ROOT+id+'/backup/manifest.json',{format:'ONSPA-TRAINING-BACKUP-v1',createdAt:s.startedAt,database:s.backup,files:s.backupFiles});
   s.stage=stageName();await env.DB.prepare(`CREATE TABLE ${quote(s.stage)} (id INTEGER PRIMARY KEY,t TEXT NOT NULL,v TEXT NOT NULL)`).run();s.phase='import-db';
  }
 }else if(s.phase==='import-db'){
  const data=await(await sourceFetch(s,'page',{cursor:s.cursor})).json();if(digest(JSON.stringify(data.rows))!==data.sha256)error('Sai checksum dữ liệu nguồn.');
  if(data.rows.length){
   for(const row of data.rows){if(!s.source.columns[row.t]||!Number.isSafeInteger(row.id)||row.id<=s.cursor)error('Bản dữ liệu không hợp lệ.');const v=JSON.parse(row.v);if(!Array.isArray(v)||v.length!==s.source.columns[row.t].length||row.t==='app_records'&&!businessEntity(v[0]))error('Bản dữ liệu chứa cấu hình không được chuyển.');}
   await env.DB.batch(data.rows.map(r=>env.DB.prepare(`INSERT INTO ${quote(s.stage)} VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET t=excluded.t,v=excluded.v`).bind(r.id,r.t,r.v)));
   s.cursor=data.rows.at(-1).id;s.imported+=data.rows.length;s.pageHashes.push({cursor:data.rows[0].id-1,last:s.cursor,count:data.rows.length,hash:data.sha256});
  }else{if(s.imported!==s.source.total)error('Số bản ghi chưa khớp.');s.phase='import-files';}
 }else if(s.phase==='import-files'){
  const f=s.source.files[s.fileIndex];
  if(f){const response=await sourceFetch(s,'file',{index:s.fileIndex}),key=ROOT+id+'/incoming/'+s.fileIndex;await copyStream(env.FILES,key,response.body,{httpMetadata:f.httpMetadata,customMetadata:f.customMetadata},f.size);const o=await env.FILES.head(key);if(o?.size!==f.size)error('Tệp nguồn tải chưa đủ.');s.verifiedFiles.push({key,sha256:await fileHash(env.FILES,key)});s.fileIndex++;}
  else{s.phase='verify';s.verifyIndex=0;}
 }else if(s.phase==='verify'){
  const p=s.pageHashes[s.verifyIndex];
  if(p){const rows=await page(env.DB,s.stage,p.cursor);if(rows.length!==p.count||digest(JSON.stringify(rows))!==p.hash)error('Đối chiếu dữ liệu tạm không khớp. Chưa ghi vào dữ liệu thử.');s.verifyIndex++;}
  else{s.phase='publish-files';s.publishIndex=0;}
 }else if(s.phase==='publish-files'){
  const f=s.source.files[s.publishIndex];
  if(f){const incoming=s.verifiedFiles[s.publishIndex],o=await env.FILES.get(incoming.key);if(!o?.body)error('Thiếu tệp đã kiểm tra.');await copyStream(env.FILES,f.key,o.body,{httpMetadata:f.httpMetadata,customMetadata:f.customMetadata},f.size);if(await fileHash(env.FILES,f.key)!==incoming.sha256)error('Checksum tệp sau ghi không khớp.');s.publishIndex++;}
  else{s.phase='commit';}
 }else if(s.phase==='commit'){
  if(!await env.FILES.head(ROOT+id+'/backup/manifest.json'))error('Chưa có bản sao lưu hoàn tất.');
  const counts=Object.fromEntries((await env.DB.prepare(`SELECT t,count(*) AS n FROM ${quote(s.stage)} GROUP BY t`).all()).results.map(r=>[r.t,r.n]));
  for(const [t,n] of Object.entries(s.source.counts))if((counts[t]||0)!==n)error('Số lượng dữ liệu không khớp: '+t);
  const now=new Date().toISOString(),result={id,completedAt:now,sourceAt:s.source.createdAt,counts:s.source.counts,groups:s.source.groups,files:s.source.files.length,backup:ROOT+id+'/backup/manifest.json',warehouseSheet:'Đã chặn kết nối kho thật',actor:user.login};
  const commands=[];
  for(const [t,c] of Object.entries(s.source.columns)){
   commands.push(env.DB.prepare(`DELETE FROM ${quote(t)} ${t==='app_records'?'WHERE '+businessWhere:''}`));
   commands.push(env.DB.prepare(`INSERT INTO ${quote(t)}(${c.map(quote).join(',')}) SELECT ${c.map((_,i)=>`json_extract(v,'$[${i}]')`).join(',')} FROM ${quote(s.stage)} WHERE t=?`).bind(t));
  }
  commands.push(env.DB.prepare("UPDATE app_records SET payload=json_set(payload,'$.enabled',json('false')) WHERE entity='warehouse_sheet_config'"));
  commands.push(env.DB.prepare("INSERT INTO app_records VALUES('environment_refresh_history',?,?,?,?)").bind(id,JSON.stringify(result),user.login,now));
  commands.push(env.DB.prepare("DELETE FROM app_records WHERE entity=?").bind(lockEntity));
  await env.DB.batch(commands);
  s.phase='done';s.result=result;delete s.token;
 }
 await put(env.FILES,ROOT+id+'/import.json',s);return json(view(s));
 }finally{await env.DB.prepare("UPDATE app_records SET payload=json_remove(payload,'$.leaseUntil') WHERE entity=? AND record_key='active'").bind(lockEntity).run();}
 }catch(e){return json({error:e.message||'Đồng bộ chưa hoàn tất. Bấm Tiếp tục để thử lại.',recoverable:true},e.status||500);}
}
function view(s){return {id:s.id,phase:s.phase,sourceAt:s.source?.createdAt,imported:s.imported,total:s.source?.total,backupFiles:s.backupFiles?.length,backupIndex:s.backupIndex,fileIndex:s.fileIndex,files:s.source?.files.length,verifyIndex:s.verifyIndex,pages:s.pageHashes?.length,publishIndex:s.publishIndex,result:s.result};}
function html(training){return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ONSPA · Đồng bộ môi trường thử</title><style>body{margin:0;background:#fffaf0;color:#163c42;font:20px 'Times New Roman',serif}header{background:#166278;color:white;padding:16px 28px;border-bottom:5px solid #e99135}main{margin:24px auto;padding:24px;max-width:1080px;background:white;border:1px solid #8eafb3;border-radius:8px}h1{font-size:28px}button,a{font:inherit}button{padding:10px 18px;margin:8px 8px 8px 0;border:1px solid #27776e;border-radius:5px;background:#17745a;color:white;cursor:pointer}button:disabled{opacity:.55}textarea{display:block;box-sizing:border-box;width:100%;font:18px monospace;margin:12px 0;padding:12px;border:1px solid #90acb1}#status{padding:18px;background:#edf7f4;border:1px solid #9cbbb4;white-space:pre-wrap;font-size:23px;line-height:1.5}#status.error{background:#fff0ef;color:#a31818;border:2px solid #d63131}table{border-collapse:collapse;margin:16px 0;width:100%}td,th{border:1px solid #a0b8b7;padding:8px;text-align:left}.tools{padding:10px;background:#fff4df;border:1px solid #dcba81}small{font-size:18px}</style><header>ONSPA · ${training?'MÔI TRƯỜNG THỬ':'WEB CHÍNH'}</header><main><h1>Đồng bộ dữ liệu sang môi trường thử</h1><p>${training?'Thay dữ liệu nghiệp vụ thử bằng bản mới từ web chính. Hệ thống tự sao lưu trước khi ghi, giữ nguyên tài khoản và quyền của môi trường thử.':'Tạo bản dữ liệu nghiệp vụ để chuyển sang môi trường thử. Dữ liệu và kết nối kho trên web chính được giữ nguyên.'}</p><p><b>Google Sheet kho thật không tham gia quá trình đồng bộ.</b></p><div class="tools"><button id="run">${training?'Sao lưu và đồng bộ':'Tạo bản đồng bộ'}</button>${training?'<button id="resume">Tiếp tục phiên đang chạy</button>':''}<a href="/">Quay lại website</a></div><label for="code">Mã đồng bộ tạm thời</label><textarea id="code" rows="3" ${training?'':'readonly'} placeholder="${training?'Dán mã đồng bộ được tạo từ web chính':'Mã chỉ xuất hiện khi bản nguồn đã sẵn sàng'}"></textarea><small>Mã có hạn 24 giờ, chỉ đọc bản dữ liệu đã chốt; không chứa mật khẩu hay khóa Google Sheet.</small><div id="status" role="status">Sẵn sàng.</div><div id="summary"></div></main><script>
const training=${training},status=document.querySelector('#status'),run=document.querySelector('#run'),resume=document.querySelector('#resume'),code=document.querySelector('#code');let busy=false;
async function api(body){const r=await fetch('${API}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let d;try{d=await r.json()}catch{throw Error('Máy chủ chưa trả kết quả. Bấm Tiếp tục để kiểm tra phiên; không tạo lại nhiều lần.')}if(!r.ok)throw Error(d.error||'Không đồng bộ được');return d;}
function show(s){const labels={'backup-db':'Đang sao lưu cơ sở dữ liệu thử','backup-files':'Đang sao lưu tệp thử','import-db':'Đang tải dữ liệu mới','import-files':'Đang tải tệp mới','verify':'Đang đối chiếu dữ liệu','publish-files':'Đang ghi tệp đã kiểm tra','commit':'Đang áp dụng dữ liệu đã kiểm tra','done':'ĐỒNG BỘ THÀNH CÔNG'};status.textContent=(labels[s.phase]||'Đang xử lý')+'\\nBản ghi: '+(s.imported||0)+' / '+(s.total||0)+'\\nTệp sao lưu: '+(s.backupIndex||0)+' / '+(s.backupFiles||0)+' · Tệp mới: '+(s.fileIndex||0)+' / '+(s.files||0)+(s.phase==='verify'?'\\nĐối chiếu: '+s.verifyIndex+' / '+s.pages:'')+(s.phase==='publish-files'?'\\nGhi tệp: '+s.publishIndex+' / '+s.files:'');if(s.result)summary(s.result);}
function summary(s){const box=document.querySelector('#summary');box.replaceChildren();const p=document.createElement('p');p.textContent='Dữ liệu nguồn: '+new Date(s.sourceAt||s.createdAt).toLocaleString('vi-VN',{hour12:false,timeZone:'Asia/Ho_Chi_Minh'})+' · '+s.files+' tệp. '+(s.backup?'Đã lưu bản sao dữ liệu thử trước đồng bộ.':'');box.append(p);const table=document.createElement('table');for(const g of (s.groups||[])){const tr=document.createElement('tr');for(const text of [g.entity,g.count]){const td=document.createElement('td');td.textContent=text;tr.append(td)}table.append(tr)}box.append(table);}
async function work(continuing){if(busy)return;busy=true;run.disabled=true;if(resume)resume.disabled=true;status.className='';try{if(!training){status.textContent='Đang chốt bản dữ liệu nguồn…';const r=await api({action:'export'});code.value=r.code;status.textContent='ĐÃ TẠO BẢN NGUỒN. Sao chép mã sang trang đồng bộ của môi trường thử.';summary(r.summary);}else{let s=await api(continuing?{action:'status'}:{action:'start',code:code.value});if(continuing&&!s.active){if(s.last){show({phase:'done',result:s.last});return;}throw Error('Chưa có phiên đồng bộ. Dán mã nguồn rồi bấm Sao lưu và đồng bộ.');}while(s.phase!=='done'){show(s);await new Promise(r=>setTimeout(r,500));s=await api({action:'step'});}show(s);code.value='';}}catch(e){status.className='error';status.textContent='CHƯA HOÀN TẤT: '+e.message+'\\nDữ liệu web chính và Google Sheet kho không bị chỉnh sửa. Bấm Tiếp tục phiên đang chạy để thử lại.';}finally{busy=false;run.disabled=false;if(resume)resume.disabled=false;}}
run.onclick=()=>work(false);if(resume)resume.onclick=()=>work(true);
</script></html>`;}
