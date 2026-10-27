import {sessionUser,isAdminRole,tokenHash} from './password-auth.mjs';
const entity='source_sync_device';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const setupExpiry=env=>env.SETUP_ADMIN_AUTO_LOGIN==='true'&&typeof env.SETUP_ADMIN_ACTIVATION_TOKEN==='string'&&env.SETUP_ADMIN_ACTIVATION_TOKEN.length>=32&&typeof env.SETUP_ADMIN_COOKIE_SECRET==='string'&&env.SETUP_ADMIN_COOKIE_SECRET.length>=32?Date.parse(env.SETUP_ADMIN_EXPIRES_AT||''):0;
const publicDevice=d=>({id:d.id,label:d.label,owner:d.owner,createdAt:d.createdAt,expiresAt:d.expiresAt,revokedAt:d.revokedAt||null,scope:d.scope||'source'});
async function deviceUser(db,d,env){
 if(d.owner==='SETUP_ADMIN')return Number.isFinite(setupExpiry(env))&&setupExpiry(env)>Date.now()&&d.credentialVersion===-setupExpiry(env);
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='users' AND record_key=?").bind(d.owner).first();
 if(!row)return false;const user=JSON.parse(row.payload);
 if(user.active!==true||user._deleted||!isAdminRole(user.role))return false;
 const account=await db.prepare('SELECT credential_version FROM auth_accounts WHERE login=?').bind(d.owner).first();
 return account&&Number(account.credential_version)===d.credentialVersion;
}
export async function sourceDevice(request,env){
 const match=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'');if(!match)return null;
 const row=await env.DB.prepare("SELECT payload FROM app_records WHERE entity=? AND record_key=?").bind(entity,await tokenHash(match[1])).first();
 if(!row)return null;const d=JSON.parse(row.payload);
 return !d.revokedAt&&Date.parse(d.expiresAt)>Date.now()&&await deviceUser(env.DB,d,env)?d:null;
}
export async function sourceSyncApi(request,env,snapshot){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/source-sync'))return null;
 try{
  if(!env.DB?.prepare)return json({error:'Chưa có DB'},503);
  const user=await sessionUser(request,env),admin=user&&isAdminRole(user.role);
  if(['/api/source-sync/manifest','/api/source-sync/download','/api/source-sync/installer'].includes(path)){
   if(request.method!=='GET')return json({error:'Phương thức không hợp lệ'},405);
   const reader=admin?null:await sourceDevice(request,env);
   if(!admin&&!reader)return json({error:'Mã đồng bộ không hợp lệ, hết hạn hoặc đã bị thu hồi.'},401);
   if(!snapshot?.metadata||!snapshot.sourceBase64)return json({error:'Bản triển khai chưa có gói source'},503);
   if(path.endsWith('/manifest'))return json({...snapshot.metadata,backupAllowed:!!admin||reader?.scope==='full-backup'});
   const installer=path.endsWith('/installer'),bytes=Uint8Array.from(atob(installer?snapshot.installerBase64:snapshot.sourceBase64),c=>c.charCodeAt(0));
   return new Response(bytes,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${installer?'ONSPA-dong-bo-Windows':'ONSPA-source-'+snapshot.metadata.snapshotId.slice(0,12)}.zip"`,'Content-Length':String(bytes.length)}});
  }
  if(path!=='/api/source-sync/devices')return json({error:'Không có API này'},404);
  if(!admin)return json({error:'Chỉ Admin được cấp hoặc thu hồi mã tải source.'},403);
  if(request.method==='GET'){
   const rows=(await env.DB.prepare('SELECT payload FROM app_records WHERE entity=? ORDER BY updated_at DESC').bind(entity).all()).results;
   return json({devices:rows.map(r=>publicDevice(JSON.parse(r.payload))),metadata:snapshot?.metadata||null});
  }
  if(request.method!=='POST')return json({error:'Phương thức không hợp lệ'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Yêu cầu không hợp lệ'},403);
  const raw=await request.text();if(raw.length>2048)return json({error:'Yêu cầu quá lớn'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'JSON không hợp lệ'},400);}
  const at=new Date().toISOString();
  if(input.action==='revoke'){
   if(typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.id))return json({error:'Mã thiết bị không hợp lệ'},400);
   const row=await env.DB.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,input.id).first();if(!row)return json({error:'Không tìm thấy thiết bị'},404);
   const next={...JSON.parse(row.payload),revokedAt:at};
   await env.DB.batch([env.DB.prepare('UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity=? AND record_key=?').bind(JSON.stringify(next),user.login,at,entity,input.id),env.DB.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'SOURCE_SYNC_REVOKED',deviceId:input.id,actor:user.login,at}),user.login,at)]);
   return json({ok:true});
  }
  if(input.action!=='create'||typeof input.label!=='string'||!input.label.trim()||input.label.length>100)return json({error:'Nhập tên máy từ 1 đến 100 ký tự'},400);
  const count=await env.DB.prepare('SELECT count(*) AS n FROM app_records WHERE entity=? AND json_extract(payload,\'$.owner\')=? AND json_extract(payload,\'$.revokedAt\') IS NULL AND json_extract(payload,\'$.expiresAt\')>?').bind(entity,user.login,at).first();
  if(count.n>=10)return json({error:'Tối đa 10 máy đang kết nối; thu hồi máy cũ trước.'},409);
  const account=user.isSetupAdmin?null:await env.DB.prepare('SELECT credential_version FROM auth_accounts WHERE login=?').bind(user.login).first();
  if(!user.isSetupAdmin&&!account)return json({error:'Cần tài khoản Admin nội bộ đã có mật khẩu'},403);
  const expires=user.isSetupAdmin?setupExpiry(env):Date.now()+365*24*3600000;if(!Number.isFinite(expires)||expires<=Date.now())return json({error:'Quyền thiết lập đã hết hạn'},403);
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join(''),id=await tokenHash(token);
  const d={id,scope:input.scope==='full-backup'?'full-backup':'source',label:input.label.trim(),owner:user.login,credentialVersion:user.isSetupAdmin?-expires:Number(account.credential_version),createdAt:at,expiresAt:new Date(expires).toISOString(),revokedAt:null};
  await env.DB.batch([env.DB.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(d),user.login,at),env.DB.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'SOURCE_SYNC_CREATED',deviceId:id,label:d.label,actor:user.login,expiresAt:d.expiresAt,at}),user.login,at)]);
  return json({token,device:publicDevice(d)});
 }catch{return json({error:'Không thực hiện được đồng bộ source'},500);}
}
