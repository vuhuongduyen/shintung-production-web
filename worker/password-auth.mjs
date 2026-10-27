const COOKIE='__Host-onspa_session';
const SETUP_COOKIE='__Host-onspa_setup';
const SETUP_LOGIN='SETUP_ADMIN';
const iterations=100000;
export const isQuickLineUser=u=>u?.authMode==='quick_line'&&['A','B'].includes(u.line)&&u.login===`LINE_${u.line}`;
const lineIdentity=u=>({...u,role:'USER',email:null,department:'QLSX',isSetupAdmin:false});
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const isAdminRole=role=>['ADMIN','SUPER_ADMIN','SUPER ADMIN'].includes(String(role||'').trim().toUpperCase().replaceAll('-','_'));
export const tokenHash=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export async function passwordRecord(password) {
 const salt=random();return {salt,hash:await derive(password,salt,iterations),iterations};
}
async function derive(password,salt,count) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:count},key,256));
}
const reply=(body,status=200,cookie)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(value,maxAge)=>`${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
const namedCookie=(request,name)=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||null;
function token(request){const value=namedCookie(request,COOKIE);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
const setupExpiry=env=>Date.parse(env?.SETUP_ADMIN_EXPIRES_AT||'');
const setupEnabled=env=>env?.SETUP_ADMIN_AUTO_LOGIN==='true'&&Number.isFinite(setupExpiry(env))&&setupExpiry(env)>Date.now()&&typeof env.SETUP_ADMIN_ACTIVATION_TOKEN==='string'&&env.SETUP_ADMIN_ACTIVATION_TOKEN.length>=32&&typeof env.SETUP_ADMIN_COOKIE_SECRET==='string'&&env.SETUP_ADMIN_COOKIE_SECRET.length>=32;
const safeEqual=(a,b)=>{a=String(a||'');b=String(b||'');let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;};
async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));}
async function setupEntitlement(request,env){
 if(!setupEnabled(env))return false;
 const value=namedCookie(request,SETUP_COOKIE),match=/^(\d{10,16})\.([a-f0-9]{64})$/.exec(value||'');if(!match)return false;
 const expires=Number(match[1]);if(expires!==setupExpiry(env)||expires<=Date.now())return false;
 return safeEqual(match[2],await hmac(env.SETUP_ADMIN_COOKIE_SECRET,`setup-admin:${expires}`));
}
async function setupCookie(env){const expires=setupExpiry(env),signature=await hmac(env.SETUP_ADMIN_COOKIE_SECRET,`setup-admin:${expires}`),maxAge=Math.max(0,Math.floor((expires-Date.now())/1000));return `${SETUP_COOKIE}=${expires}.${signature}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;}
async function rawUserRecord(db,identifier){
 const r=await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='users' AND (lower(record_key)=lower(?) OR lower(json_extract(payload,'$.email'))=lower(?)) ORDER BY CASE WHEN lower(record_key)=lower(?) THEN 0 ELSE 1 END LIMIT 1").bind(identifier,identifier,identifier).first();
 if(!r)return null;const p=JSON.parse(r.payload);return {...p,login:p.login||r.record_key};
}
async function userRecord(db,identifier){const p=await rawUserRecord(db,identifier);return p&&p.active===true&&!p._deleted?p:null;}
export async function sessionUser(request,envOrDb){
 const env=envOrDb?.DB?envOrDb:null,db=env?.DB||envOrDb;
 const value=token(request);if(!value)return null;
 // One fresh statement resolves the session, credential version and preferred
 // user record. No cross-request auth cache: revocation/locking applies at once.
 const row=await db.prepare(`SELECT s.login,s.credential_version,a.credential_version AS account_version,a.password_hash,
   CASE WHEN a.credential_version=s.credential_version THEN COALESCE(
    (SELECT json_object('key',u.record_key,'payload',u.payload) FROM app_records u WHERE u.entity='users' AND lower(u.record_key)=lower(s.login) LIMIT 1),
    (SELECT json_object('key',u.record_key,'payload',u.payload) FROM app_records u WHERE u.entity='users' AND lower(json_extract(u.payload,'$.email'))=lower(s.login) LIMIT 1)
   ) END AS user_record
   FROM auth_sessions s LEFT JOIN auth_accounts a ON a.login=s.login
   WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`).bind(await tokenHash(value),Date.now()).first();
 if(!row)return null;
 if(row.login===SETUP_LOGIN)return setupEnabled(env)&&Number(row.credential_version)===-setupExpiry(env)?{login:SETUP_LOGIN,name:'SETUP ADMIN',active:true,role:'SUPER_ADMIN',isSetupAdmin:true}:null;
 if(row.account_version==null||Number(row.account_version)!==Number(row.credential_version))return null;
 const record=row.user_record?JSON.parse(row.user_record):null,p=record?JSON.parse(record.payload):null;
 const user=p&&p.active===true&&!p._deleted?{...p,login:p.login||record.key}:null;
 const account=row;
 if(account.password_hash==='QUICK_LINE')return isQuickLineUser(user)?lineIdentity(user):null;
 return user?.authMode==='quick_line'?null:user;
}
const publicUser=p=>({login:p.login,email:p.email||null,name:p.name||p.login,role:p.role||'USER',isAdmin:isAdminRole(p.role),isSetupAdmin:p.isSetupAdmin===true,authMode:p.authMode||'password',line:p.line||null});
async function limit(db,bucket,max){const now=Date.now(),expires=now+15*60*1000;
 const r=await db.prepare('INSERT INTO auth_login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts').bind(bucket,expires,now,now,expires).first();return r.attempts<=max;
}
export async function passwordAuth(request,env){
 const path=new URL(request.url).pathname,db=env.DB;
 if(!path.startsWith('/api/auth/'))return null;
 if(path==='/api/auth/session'&&request.method==='GET'){const u=await sessionUser(request,env);return reply({authenticated:!!u,user:u?publicUser(u):null});}
 if(path==='/api/auth/setup-admin/status'&&request.method==='GET')return reply({enabled:setupEnabled(env),authorized:await setupEntitlement(request,env),expiresAt:setupEnabled(env)?env.SETUP_ADMIN_EXPIRES_AT:null});
 if(path==='/api/auth/lines'&&request.method==='GET'){const lines=[];for(const line of ['A','B']){const u=await userRecord(db,`LINE_${line}`),a=await db.prepare('SELECT password_hash FROM auth_accounts WHERE login=?').bind(`LINE_${line}`).first();if(isQuickLineUser(u)&&a?.password_hash==='QUICK_LINE')lines.push(line);}return reply({lines});}
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Yêu cầu không hợp lệ.'},403);
 if(path==='/api/auth/logout'){
  const value=token(request);if(value){const hash=await tokenHash(value),session=await db.prepare('SELECT login,credential_version FROM auth_sessions WHERE token_hash=?').bind(hash).first(),now=Date.now();const statements=[db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?').bind(now,hash)];if(session?.login){const at=new Date(now).toISOString(),setup=session.login===SETUP_LOGIN;statements.push(db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'LOGOUT',actor:session.login,...(setup?{role:'SUPER_ADMIN',loginMethod:'SETUP_ADMIN_AUTO_LOGIN'}:{}),at}),session.login,at));}await db.batch(statements);}
  return reply({ok:true},200,cookie('',0));
 }
 if(!['/api/auth/login','/api/auth/activate','/api/auth/admin/password','/api/auth/setup-admin/activate','/api/auth/setup-admin','/api/auth/admin/line-users','/api/auth/line-login'].includes(path))return reply({error:'Không có API này'},404);
 let b;try{const raw=await request.text();if(raw.length>2048)return reply({error:'Yêu cầu quá lớn'},413);b=JSON.parse(raw);}catch{return reply({error:'Yêu cầu không hợp lệ'},400);}
 if(path==='/api/auth/admin/line-users'){
  const actor=await sessionUser(request,env);if(!actor||!isAdminRole(actor.role))return reply({error:'Không có quyền quản trị.'},403);
  const statements=[],now=new Date().toISOString(),users=[];
  for(const line of ['A','B']){
   const login=`LINE_${line}`,existing=await rawUserRecord(db,login);
   if(existing){const a=await db.prepare('SELECT password_hash FROM auth_accounts WHERE login=?').bind(login).first();if(!isQuickLineUser(existing)||existing._deleted||a?.password_hash!=='QUICK_LINE')return reply({error:`ID ${login} đã tồn tại. Không ghi đè tài khoản hiện có.`},409);users.push(existing);continue;}
   const user={login,name:`Line ${line}`,line,authMode:'quick_line',role:'USER',department:'QLSX',company:'SHINTUNG',phone:'',mobile:'',active:true,createdBy:actor.login,createdAt:now};users.push(user);
   statements.push(db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify(user),actor.login,now),db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,'QUICK_LINE','unused',iterations,now),db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'LINE_USER_CREATED',actor:actor.login,target:login,line,loginMethod:'QUICK_LINE',at:now}),actor.login,now));
  }
  try{if(statements.length)await db.batch(statements);}catch{return reply({error:'Tài khoản vừa được cập nhật. Hãy tải lại danh sách.'},409);}
  return reply({ok:true,users});
 }
 if(path==='/api/auth/line-login'){
  if(!['A','B'].includes(b.line))return reply({error:'Chọn Line A hoặc Line B.'},400);
  const login=`LINE_${b.line}`,candidate=await userRecord(db,login),account=await db.prepare('SELECT credential_version,password_hash FROM auth_accounts WHERE login=?').bind(login).first();
  if(!isQuickLineUser(candidate)||account?.password_hash!=='QUICK_LINE')return reply({error:'Tài khoản Line chưa được tạo hoặc đã ngưng hoạt động.'},403);
  if(!await limit(db,'line:'+await tokenHash(request.headers.get('cf-connecting-ip')||'unknown'),60))return reply({error:'Vui lòng thử lại sau 15 phút.'},429);
  const value=random(),now=new Date().toISOString(),maxAge=8*3600,old=token(request),statements=[db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(value),login,account.credential_version,Date.now()+maxAge*1000,now),db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'LOGIN',actor:login,line:b.line,loginMethod:'QUICK_LINE',at:now}),login,now)];
  if(old)statements.push(db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(),await tokenHash(old)));
  await db.batch(statements);return reply({ok:true,user:publicUser(lineIdentity(candidate))},200,cookie(value,maxAge));
 }
 if(path==='/api/auth/setup-admin/activate'){
  if(!setupEnabled(env)||typeof b.token!=='string'||!safeEqual(await tokenHash(b.token),await tokenHash(env.SETUP_ADMIN_ACTIVATION_TOKEN)))return reply({error:'Liên kết thiết lập không hợp lệ hoặc đã hết hạn.'},403);
  const now=new Date().toISOString();await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'SETUP_ADMIN_DEVICE_ACTIVATED',actor:SETUP_LOGIN,role:'SUPER_ADMIN',loginMethod:'SETUP_ADMIN_AUTO_LOGIN',at:now}),SETUP_LOGIN,now).run();
  return reply({ok:true,expiresAt:env.SETUP_ADMIN_EXPIRES_AT},200,await setupCookie(env));
 }
 if(path==='/api/auth/setup-admin'){
  if(!await setupEntitlement(request,env))return reply({error:'Thiết bị chưa được cấp quyền thiết lập hoặc quyền đã hết hạn.'},403);
  const value=random(),maxAge=Math.max(1,Math.min(8*3600,Math.floor((setupExpiry(env)-Date.now())/1000))),now=new Date().toISOString(),old=token(request);
  const audit={action:'LOGIN',actor:SETUP_LOGIN,role:'SUPER_ADMIN',loginMode:'ADMIN',loginMethod:'SETUP_ADMIN_AUTO_LOGIN',at:now};
  const statements=[db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(value),SETUP_LOGIN,-setupExpiry(env),Date.now()+maxAge*1000,now),db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify(audit),SETUP_LOGIN,now)];
  if(old)statements.push(db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(),await tokenHash(old)));
  await db.batch(statements);return reply({ok:true,user:publicUser({login:SETUP_LOGIN,name:'SETUP ADMIN',role:'SUPER_ADMIN',isSetupAdmin:true})},200,cookie(value,maxAge));
 }
 if(path==='/api/auth/admin/password'){
  const actor=await sessionUser(request,env);if(!actor||!isAdminRole(actor.role))return reply({error:'Không có quyền quản trị.'},403);
  const login=typeof b.login==='string'?b.login.trim():'',password=typeof b.password==='string'?b.password:'';
  if(!login||password.length<4||password.length>64||password!==b.passwordConfirm)return reply({error:'Mật khẩu phải từ 4 đến 64 ký tự và hai lần nhập phải giống nhau.'},400);
  const target=await rawUserRecord(db,login);if(!target||target._deleted)return reply({error:'Không tìm thấy tài khoản người dùng.'},404);
  if(target.authMode==='quick_line')return reply({error:'Tài khoản Line đăng nhập bằng nút Line, không sử dụng mật khẩu.'},409);
  const p=await passwordRecord(password),now=new Date().toISOString(),current=await db.prepare('SELECT credential_version FROM auth_accounts WHERE login=?').bind(target.login).first(),version=Number(current?.credential_version||0)+1;
  await db.batch([
   db.prepare('INSERT INTO auth_accounts(login,password_hash,password_salt,iterations,credential_version,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,iterations=excluded.iterations,credential_version=excluded.credential_version').bind(target.login,p.hash,p.salt,p.iterations,version,now),
   db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE login=? AND revoked_at IS NULL').bind(Date.now(),target.login),
   db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'PASSWORD_SET',actor:actor.login,target:target.login,at:now}),actor.login,now)
  ]);
  return reply({ok:true,login:target.login});
 }
 if(path==='/api/auth/activate'){
  let setup;try{setup=JSON.parse(env.ONSPA_INITIAL_ADMIN||'null');}catch{}
  if(!setup||!setup.login||setup.expiresAt<Date.now()||typeof b.token!=='string'||!setup.token||await tokenHash(b.token)!==await tokenHash(setup.token))return reply({error:'Liên kết thiết lập không hợp lệ hoặc đã hết hạn.'},403);
  if(!/^\d{4}$/.test(b.password||'')||b.password!==b.passwordConfirm)return reply({error:'Nhập hai mật khẩu giống nhau, gồm đúng 4 chữ số.'},400);
  if((await db.prepare('SELECT count(*) AS n FROM auth_accounts').first()).n||await db.prepare("SELECT record_key FROM app_records WHERE entity='users' AND record_key=?").bind(setup.login).first())return reply({error:'Tài khoản đã được thiết lập; không ghi đè dữ liệu hiện có.'},409);
  const p=await passwordRecord(b.password),now=new Date().toISOString();
  const user={login:setup.login,name:setup.login,active:true,role:'Super Admin',createdBy:setup.login,createdAt:now};
  await db.batch([
   db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',setup.login,JSON.stringify(user),setup.login,now),
   db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(setup.login,p.hash,p.salt,p.iterations,now),
   db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'INITIAL_ADMIN_ACTIVATED',actor:setup.login,at:now}),setup.login,now)
  ]);
  return reply({ok:true,login:setup.login});
 }
 const identifier=typeof b.login==='string'?b.login.trim():'',password=typeof b.password==='string'?b.password:'';
 if(!identifier||identifier.length>100||password.length<4||password.length>64)return reply({error:'ID hoặc mật khẩu không đúng.'},401);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 const ipBucket='ip:'+await tokenHash(ip),accountBucket='account:'+await tokenHash(identifier.toLowerCase());
 const candidate=await userRecord(db,identifier),login=candidate?.login||identifier;
 const account=await db.prepare('SELECT * FROM auth_accounts WHERE login=?').bind(login).first();
 const computed=await derive(password,account?.password_salt||'onspa-invalid-account',account?.iterations||iterations);
 const expected=account?.password_hash||'0'.repeat(64);let diff=computed.length^expected.length;for(let i=0;i<64;i++)diff|=computed.charCodeAt(i)^expected.charCodeAt(i);
 const user=account&&candidate&&candidate.authMode!=='quick_line'&&candidate;
 if(diff||!user){
  const ipAllowed=await limit(db,ipBucket,30),accountAllowed=await limit(db,accountBucket,5);
  return ipAllowed&&accountAllowed?reply({error:'ID hoặc mật khẩu không đúng.'},401):reply({error:'Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'},429);
 }
 if(b.loginMode==='admin'&&!isAdminRole(user.role))return reply({error:'Tài khoản không có quyền quản trị. Vui lòng đăng nhập bằng quyền người dùng phù hợp.'},403);
 const value=random(),maxAge=b.remember===true?7*24*3600:8*3600,now=new Date().toISOString(),old=token(request);
 const statements=[db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(value),login,account.credential_version,Date.now()+maxAge*1000,now),db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',crypto.randomUUID(),JSON.stringify({action:'LOGIN',actor:login,loginMode:b.loginMode==='admin'?'ADMIN':'USER',at:now}),login,now),db.prepare('DELETE FROM auth_login_limits WHERE bucket IN (?,?)').bind(ipBucket,accountBucket)];
 if(old)statements.push(db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(),await tokenHash(old)));
 await db.batch(statements);
 return reply({ok:true,user:publicUser(user)},200,cookie(value,maxAge));
}
