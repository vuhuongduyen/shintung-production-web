import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root} from '../scripts/local/database.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {assignedSkuMasterGrants,skuMasterUserGrants} from '../lib/sku-master-user-grants.mjs';
import {readPermissionSetup} from '../scripts/local/user-permission-setup.mjs';
import {hasMenuPermission} from '../lib/menu-action-access.mjs';
import {skuCapability} from '../scripts/local/sku-approval.mjs';
test('assignment is limited to two active non-Line users and honors disabled personal rights',()=>{
 for(const login of ['nttvy','htndiem']){
  assert.deepEqual(assignedSkuMasterGrants({login,active:true}),skuMasterUserGrants);
  for(const patch of [{active:false},{_deleted:true},{line:'A'},{authMode:'quick_line'}])assert.deepEqual(assignedSkuMasterGrants({login,active:true,...patch}),[]);
  for(const personal of [{active:false},{active:true,_deleted:true},{}])assert.deepEqual(assignedSkuMasterGrants({login,active:true},personal),[]);
 }
 for(const login of ['other','haquyen','nttvy2','LINE_A'])assert.deepEqual(assignedSkuMasterGrants({login,active:true}),[]);
 assert.equal(skuMasterUserGrants.length,8);assert.ok(skuMasterUserGrants.every(g=>g.startsWith('Dữ liệu cơ bản / SKU Master / ')));
});
test('authenticated grants reach menu and SKU confirmation, preserve existing rights and leave DB unchanged',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/sku-named-')));
 const password=crypto.randomUUID(),cookies={};
 const put=(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'synthetic','test').run();
 const env={DB:c.db,FILES:c.bucket};
 const call=(path,login,body)=>siteApi(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{origin:'https://test.invalid',cookie:cookies[login]||'','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 try{
  await migrate(c.db);const pw=await passwordRecord(password);
  const old='Quản lý kho / Tồn kho ERP / Sửa';
  await put('department_permissions','KHSX',{department:'KHSX',active:true,permissions:old});
  for(const login of ['nttvy','htndiem','other','admin']){
   await put('users',login,{login,active:true,department:'KHSX',role:login==='admin'?'ADMIN':'USER'});
   if(login==='nttvy')await put('permissions',login,{login,active:true,permissionMode:'CUSTOM',permissions:old,unchanged:'keep'});
   await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,pw.hash,pw.salt,pw.iterations,'test').run();
   const res=await call('/api/auth/login',login,{login,password});assert.equal(res.status,200);cookies[login]=res.headers.get('set-cookie').split(';')[0];
  }
  const before=await records(c.db);
  for(const login of ['nttvy','htndiem','other','admin']){
   const principal=await sitePrincipal(new Request('https://test.invalid',{headers:{cookie:cookies[login]}}),env);
   assert.equal(principal.isAdmin,login==='admin');assert.ok(principal.grants.includes(old));
   for(const grant of skuMasterUserGrants)assert.equal(hasMenuPermission(principal,'Dữ liệu cơ bản / SKU Master',[grant.split(' / ').at(-1)]),login!=='other'||grant.endsWith('/ Xem'));
   assert.equal(await skuCapability(c.db,principal),login!=='other');
   assert.equal((await(await call('/api/sku-capabilities',login)).json()).canConfirm,login!=='other');
   if(login!=='admin')for(const menu of ['Dữ liệu cơ bản / Leadtime','Dữ liệu cơ bản / Giờ công','Cấu trúc thành phẩm / Dữ liệu lượng dùng BOM'])assert.equal(hasMenuPermission(principal,menu,['Sửa','Xác nhận']),false);
  }
  const setup=await readPermissionSetup(c.db,{isAdmin:true,userId:'admin'});
  for(const login of ['nttvy','htndiem'])assert.ok(skuMasterUserGrants.every(g=>setup.users.find(u=>u.login===login).before.includes(g)));
  assert.deepEqual(await records(c.db),before);
  await put('permissions','htndiem',{login:'htndiem',active:false,permissions:''});
  assert.equal((await(await call('/api/sku-capabilities','htndiem')).json()).canConfirm,false);
  const revoked=await sitePrincipal(new Request('https://test.invalid',{headers:{cookie:cookies.htndiem}}),env);assert.deepEqual(revoked.grants,[]);
 }finally{await c.close();}
});
