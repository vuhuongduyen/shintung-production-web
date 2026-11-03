import test from 'node:test';
import {assertRejectedRequestAudit,assertSnapshotWithReceipts} from './helpers/rejected-request-audit.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {businessViewPermissions,withBusinessViews} from '../lib/user-permission-profiles.mjs';

test('business menu views add no mutations, preserve custom/department records and respect disabled grants',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'business-views-')));
 const secret=crypto.randomUUID();const cookies={};
 const call=(path,body,login='custom')=>siteApi(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookies[login]||'',origin:'https://test.invalid','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:c.db,FILES:c.bucket});
 const put=(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'fixture','test').run();
 try{
  await migrate(c.db);const p=await passwordRecord(secret);
  const custom=['Dữ liệu cơ bản / Leadtime / Sửa','Quản lý kho / Tồn kho ERP / Xem'];
  const department=['Cấu trúc thành phẩm / Dữ liệu lượng dùng BOM / Thêm'];
  await put('department_permissions','QC',{department:'QC',active:true,permissions:department.join(' · ')});
  for(const login of ['custom','department','disabled','unassigned']){
   await put('users',login,{login,department:'QC',role:'USER',active:true});
   await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'test').run();
   if(login!=='unassigned')await put('permissions',login,{login,department:'QC',active:login!=='disabled',permissionMode:login==='department'?'DEPARTMENT':'CUSTOM',permissions:custom.join(' · ')});
   const r=await call('/api/auth/login',{login,password:secret},login);assert.equal(r.status,200);cookies[login]=r.headers.get('set-cookie').split(';')[0];
  }
  await put('production_allocation_scope','global',{schemaVersion:1,enabled:true,managers:[{userId:'dhtin',group:'C'},{userId:'cnphuong',group:'AB'}]});
  const before=await records(c.db),receipts=[];
  for(const login of ['custom','department','unassigned']){
   const beforeRead=await records(c.db);
   const actor=await sitePrincipal(new Request('https://test.invalid',{headers:{cookie:cookies[login]}}),{DB:c.db});
   assert.equal(actor.isAdmin,false);assert.equal(actor.role,'USER');
   assert.deepEqual(actor.grants,withBusinessViews(login==='custom'?custom:department));
   assert.ok(businessViewPermissions.every(g=>actor.grants.includes(g)));
   assert.deepEqual(actor.grants.filter(g=>!g.endsWith('/ Xem')),login==='custom'?[custom[0]]:department);
   for(const path of ['/api/records?entity=sku','/api/records?entity=inventory','/api/records?entity=bom','/api/records?entity=forecast','/api/employees','/api/production-plan?week=2026-10-12','/api/in-transit','/api/production-workflow','/api/capacity?week=2026-10-12'])assert.equal((await call(path,undefined,login)).status,200,login+path);
   for(const path of ['/api/records?entity=users','/api/records?entity=permissions','/api/admin-audit','/api/production-allocation-scope'])assert.equal((await call(path,undefined,login)).status,403,path);
   const caps=await(await call('/api/capacity?week=2026-10-12',undefined,login)).json();assert.equal(caps.permissions.view,true);for(const key of ['edit','confirm','factor','review','reopenPast'])assert.equal(caps.permissions[key],false,key);
   const wf=await(await call('/api/production-workflow',undefined,login)).json();for(const key of ['manager','confirm','hr','correct'])assert.equal(wf.rights[key],false,key);
   assert.deepEqual(await records(c.db),beforeRead,'GETs never add receipts or change stored rights/data');
   for(const [path,body] of [['/api/records',{entity:'warehouse_in',key:'FORGED',payload:{id:'FORGED'},expectedRevision:null}],['/api/inventory-import',{action:'upload',sourceFile:'forged.xlsx',rows:[]}],['/api/forecast-import',{}],['/api/employees',{action:'save'}],['/api/production-workflow',{action:'schedule',line:'A'}],['/api/production-allocation-scope',{groups:{C:['custom'],AB:[]}}]]){const prior=await records(c.db),response=await call(path,body,login);assert.equal(response.status,403,login+path);receipts.push(await assertRejectedRequestAudit({before:prior,after:await records(c.db),response,actorId:login,route:path,body}));}
  }
  assert.deepEqual(await(await call('/api/storage-capability')).json(),{allowed:false});
  const disabled=await sitePrincipal(new Request('https://test.invalid',{headers:{cookie:cookies.disabled}}),{DB:c.db});assert.deepEqual(disabled.grants,[]);
  assert.equal((await call('/api/records?entity=sku',undefined,'disabled')).status,403);
  assertSnapshotWithReceipts(before,await records(c.db),receipts);
 }finally{await c.close();}
});

test('every business menu opens with view baseline while administrative/recovery menus stay protected',async()=>{
 const {readFileSync}=await import('node:fs'),{default:ts}=await import('typescript'),{default:vm}=await import('node:vm');
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=['normalizedGrant','moduleGrantLabels','childGrantLabels','canOpenLegacyMenu','hasAllocationCapability','canOpenMenu'];
 const code=ast.statements.filter(st=>ts.isVariableStatement(st)&&st.declarationList.declarations.some(d=>names.includes(d.name.getText(ast)))).map(st=>st.getText(ast)).join('\n');
 const ctx={};vm.runInNewContext(ts.transpileModule(code+'\nglobalThis.open=canOpenMenu;globalThis.labels=childGrantLabels;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 const user={kind:'account',isAdmin:false,grants:withBusinessViews([])};
 for(const [key,label] of Object.entries(ctx.labels)){
  const [view,child]=key.split(':');
  if(['labor-adjustment','data-recovery'].includes(child))continue;
  assert.equal(ctx.open(user,view,child),true,key+' '+label);
 }
 assert.equal(ctx.open(user,'users'),false);
 for(const child of ['labor-adjustment','data-recovery','unknown'])assert.equal(ctx.open(user,'production',child),false,child);
});
