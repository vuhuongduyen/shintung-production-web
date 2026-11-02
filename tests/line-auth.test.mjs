import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root,records} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {quickLinePermissions} from '../lib/user-permission-profiles.mjs';
import {recordRevision} from '../lib/record-revision.mjs';

test('Line users are explicitly created, persist, stay scoped, and cannot acquire admin access',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const folder=mkdtempSync(resolve(base,'line-auth-'));let c=await openDatabase(folder);
 const call=(path,body,cookie='',origin='https://test.invalid')=>siteApi(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:c.db,FILES:c.bucket});
 const fixturePassword=crypto.randomUUID();
 const sessionCookie=r=>r.headers.get('set-cookie').split(';')[0];
 try{
  await migrate(c.db);
  assert.deepEqual(await(await call('/api/auth/lines')).json(),{lines:[]});
  assert.equal((await records(c.db)).length,0,'login page never seeds users');
  assert.equal((await call('/api/auth/line-login',{line:'A'})).status,403);
  assert.equal((await call('/api/auth/admin/line-users',{})).status,403);
  const password=await passwordRecord(fixturePassword),admin={login:'TEST_ADMIN',active:true,role:'SUPER_ADMIN'};
  await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',admin.login,JSON.stringify(admin),'TEST','test'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(admin.login,password.hash,password.salt,password.iterations,'test')]);
  const adminCookie=sessionCookie(await call('/api/auth/login',{login:admin.login,password:fixturePassword}));
  assert.equal((await call('/api/auth/admin/line-users',{},adminCookie)).status,200);
  const before=await records(c.db);assert.equal((await call('/api/auth/admin/line-users',{},adminCookie)).status,200);assert.deepEqual(await records(c.db),before,'repeat creation preserves accounts and audits');
  assert.deepEqual(await(await call('/api/auth/lines')).json(),{lines:['A','B']});
  assert.equal((await call('/api/auth/line-login',{line:'ADMIN'})).status,400);
  assert.equal((await call('/api/auth/line-login',{line:'A'},'','https://evil.invalid')).status,403);
  assert.equal((await call('/api/auth/login',{login:'LINE_A',password:fixturePassword})).status,401);
  const login=await call('/api/auth/line-login',{line:'A',role:'SUPER_ADMIN',isAdmin:true,grants:['ADMIN']});assert.equal(login.status,200);const cookie=sessionCookie(login);
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  let state=await(await call('/api/site-session',undefined,cookie)).json();assert.equal(state.user.login,'LINE_A');assert.equal(state.user.line,'A');assert.equal(state.user.isAdmin,false);assert.equal(state.user.authMode,'quick_line');
  for(const line of ['A','B']){const order={id:`TEST_ORDER_${line}`,planId:`TEST_PLAN_${line}`,week:'2026-09-21',sku:`TEST_SKU_${line}`,line,lsxCode:`TEST_LSX_${line}`,lsxQty:2000,lsxOpenedAt:'2026-09-21',planStart:'2026-09-21',planEnd:'2026-09-26',syncStatus:'ĐÃ ĐỒNG BỘ'};await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('in_transit',order.id,JSON.stringify(order),'TEST','test').run();}
  const workflow=await call('/api/production-workflow',undefined,cookie);assert.equal(workflow.status,200);const visible=await workflow.json();assert.deepEqual(visible.orders.map(o=>o.line).sort(),['A']);assert.equal(visible.rights.line,'A');assert.equal(visible.rights.crossLineView,false);assert.equal(visible.rights.manager,false);assert.equal(visible.rights.hr,false);assert.equal(visible.rights.confirm,false);assert.equal(state.user.grants.length,10);assert.deepEqual(state.user.grants,quickLinePermissions);
  assert.equal((await call('/api/production-workflow',{action:'preview-report',orderId:'TEST_ORDER_B'},cookie)).status,403,'server rejects another Line even with forged order ID');
  const bCookie=sessionCookie(await call('/api/auth/line-login',{line:'B'}));assert.equal((await(await call('/api/site-session',undefined,bCookie)).json()).user.login,'LINE_B');assert.deepEqual((await(await call('/api/production-workflow',undefined,bCookie)).json()).orders.map(o=>o.line).sort(),['B']);
  for(const path of ['/api/records?entity=users','/api/records?entity=labor_hours','/api/employees','/api/in-transit','/api/production-correction','/api/full-backup/manifest'])assert.equal((await call(path,undefined,cookie)).status,403,path);
  for(const line of ['A','B']){
   const id=`PERSON_${line}`;
   await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',id,JSON.stringify({id,name:`Test ${line}`,line,active:true}),'TEST','test').run();
   await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event',`ABSENCE_${line}`,JSON.stringify({id:`ABSENCE_${line}`,kind:'line-absence',line,employees:[id],absenceType:'Nghỉ',reason:'Synthetic private leave reason',effectiveAt:'2026-10-01T01:00:00Z',endsAt:'2026-10-01T02:00:00Z',recordedAt:'2026-10-01T01:00:00Z'}),'TEST','test').run();
  }
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_hr_month','2026-10',JSON.stringify({month:'2026-10',rows:[{id:'PERSON_A',line:'A',hc:1},{id:'PERSON_B',line:'B',hc:2}],sources:[{line:'A'},{line:'B'}]}),'TEST','test').run();
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('capacity','2026-10-12',JSON.stringify({schemaVersion:1,week:'2026-10-12',revision:1,rows:[{line:'B',week:'2026-10-12',status:'Nháp',history:[{at:'2026-10-01T00:00:00Z',actor:'TEST_ADMIN',action:'save',reason:'Synthetic capacity change'}]}]}),'TEST','test').run();
  const beforeReads=await records(c.db);
  const readAll=await(await call('/api/production-workflow',undefined,cookie)).json();assert.equal(readAll.employees.length,1);assert.ok(!readAll.events.some(e=>e.line==='B'));assert.equal(readAll.events.filter(e=>e.reason==='Synthetic private leave reason').length,1);
  const hr=await(await call('/api/production-hr-hours?month=2026-10',undefined,cookie)).json();assert.deepEqual(hr.record.rows.map(r=>r.line),['A']);assert.deepEqual(hr.record.sources.map(r=>r.line),['A']);assert.equal(hr.canSave,false);
  const capacity=await call('/api/capacity?week=2026-10-12',undefined,cookie);assert.equal(capacity.status,200);const cap=await capacity.json();assert.equal(cap.permissions.view,true);for(const key of ['edit','confirm','revoke','factor','review','reopenPast'])assert.equal(cap.permissions[key],false,key);
  const standards=await call('/api/production-standards',undefined,cookie);assert.equal(standards.status,200);assert.deepEqual((await standards.json()).records,[]);
  for(const [session,line,other] of [[cookie,'A','B'],[bCookie,'B','A']]){
   const own=await(await call('/api/production-workflow?line='+other,undefined,session)).json();
   assert.deepEqual(own.orders.map(r=>r.line),[line]);
   assert.ok(own.employees.every(r=>r.line===line));assert.ok(own.payrollEmployees.every(r=>r.line===line));
   assert.ok(own.events.every(r=>r.line===line));assert.ok(own.actualSchedules.every(r=>r.line===line));
   assert.ok(!JSON.stringify(own).includes('TEST_ORDER_'+other));assert.ok(!JSON.stringify(own).includes('PERSON_'+other));
   const scopedHr=await(await call('/api/production-hr-hours?month=2026-10&line='+other,undefined,session)).json();assert.deepEqual(scopedHr.record.rows.map(r=>r.line),[line]);
   const scopedCap=await(await call('/api/capacity?week=2026-10-12&line='+other,undefined,session)).json();assert.ok(scopedCap.rows.every(r=>r.line===line));assert.deepEqual(scopedCap.employees.map(r=>r.line),[line]);
  }
  const adminView=await(await call('/api/production-workflow',undefined,adminCookie)).json();assert.deepEqual(adminView.orders.map(r=>r.line).sort(),['A','B']);assert.equal(adminView.employees.length,2);
  assert.deepEqual(await records(c.db),beforeReads,'expanded GETs never write business data');
  for(const path of ['/api/capacity','/api/production-hr-hours','/api/production-report','/api/production-correction','/api/production-standards','/api/employees','/api/records'])assert.equal((await call(path,{action:'save',role:'ADMIN',line:null},cookie)).status,403,path);
  for(const action of ['schedule','approve-hours','line-absence','attendance-override','line-movement','attendance-edit','attendance-cancel'])assert.equal((await call('/api/production-workflow',{action,line:'A'},cookie)).status,403,action);
  for(const action of ['start','complete','pause','resume','incident','add','reduce','transfer'])assert.equal((await call('/api/production-workflow',{action,orderId:'TEST_ORDER_B',role:'ADMIN',line:'A'},cookie)).status,403,action);
  assert.deepEqual(await records(c.db),beforeReads,'denied writes leave every record unchanged');
  // Nested projections preserve borrowing context but never disclose foreign orders/reports.
  for(const line of ['A','B'])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_report','REPORT_'+line,JSON.stringify({id:'REPORT_'+line,transitId:'TEST_ORDER_'+line,line,historicalImport:true,cancelled:true}),'TEST','test').run();
  for(const [id,payload] of [['ADJUST',{kind:'hours-adjustment',line:'A',changes:[{reportId:'REPORT_A',after:{total:1}},{reportId:'REPORT_B',after:{total:999}}]}],['BORROW',{kind:'transfer',line:'B',destinationLine:'A',sourceId:'TEST_ORDER_B',destinationId:'TEST_ORDER_A',planId:'TEST_PLAN_B',lsxCode:'TEST_LSX_B',sku:'TEST_SKU_B',name:'PRIVATE_B_ORDER',reason:'TEST_LSX_B',before:{kind:'line-absence',line:'B',employees:['PRIVATE_EMPLOYEE'],reason:'PRIVATE_REASON'},employees:['PERSON_B'],effectiveAt:'2026-10-01T01:00:00Z',count:1}]])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event',id,JSON.stringify({id,...payload}),'TEST','test').run();
  const nested=await(await call('/api/production-workflow',undefined,cookie)).json();
  assert.deepEqual(nested.reports.map(r=>r.id),['REPORT_A']);
  assert.deepEqual(nested.events.find(e=>e.id==='ADJUST').changes.map(r=>r.reportId),['REPORT_A']);
  const borrow=nested.events.find(e=>e.id==='BORROW');assert.equal(borrow.sourceId,null);assert.equal(borrow.destinationId,'TEST_ORDER_A');assert.deepEqual(borrow.employees,['PERSON_B']);assert.equal(borrow.employeeDetails[0].name,'Test B');
  for(const privateValue of ['TEST_ORDER_B','TEST_PLAN_B','TEST_LSX_B','TEST_SKU_B','PRIVATE_B_ORDER','REPORT_B','PRIVATE_REASON','PRIVATE_EMPLOYEE'])assert.ok(!JSON.stringify(nested).includes(privateValue),privateValue);
  const nestedB=await(await call('/api/production-workflow',undefined,bCookie)).json();for(const token of ['TEST_ORDER_A','TEST_PLAN_A','TEST_LSX_A','TEST_SKU_A','REPORT_A'])assert.ok(!JSON.stringify(nestedB).includes(token),token);
  const loanAt=new Date(Date.now()-180000).toISOString();
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event','ACTIVE_LOAN',JSON.stringify({id:'ACTIVE_LOAN',kind:'line-movement',line:'B',destinationLine:'A',employees:['PERSON_B'],count:1,approved:true,effectiveAt:loanAt,endsAt:new Date(Date.now()+3600000).toISOString()}),'TEST','test').run();
  const loanView=await(await call('/api/production-workflow',undefined,cookie)).json();assert.ok(loanView.employees.some(e=>e.id==='PERSON_B'),'active borrowed person remains selectable on receiving Line');
  const startedAt=new Date(Date.now()-120000).toISOString();await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event','START_A',JSON.stringify({id:'START_A',kind:'start',sourceId:'TEST_ORDER_A',line:'A',count:1,employees:['PERSON_B'],effectiveAt:startedAt,recordedAt:startedAt}),'TEST','test').run();
  assert.equal((await call('/api/production-workflow',{action:'preview-report',orderId:'TEST_ORDER_A'},cookie)).status,200,'own-Line reporting preview remains available');
  const report=await call('/api/production-workflow',{action:'complete',orderId:'TEST_ORDER_A',quantity:1},cookie);assert.equal(report.status,200,JSON.stringify(await report.clone().json()));for(const token of ['TEST_ORDER_B','TEST_PLAN_B','TEST_LSX_B','TEST_SKU_B','PRIVATE_B_ORDER','REPORT_B'])assert.ok(!JSON.stringify(await report.clone().json()).includes(token),token);
  assert.equal((await call('/api/auth/admin/line-users',{},cookie)).status,403);
  assert.equal((await call('/api/auth/admin/password',{login:'LINE_A',password:'abcd',passwordConfirm:'abcd'},adminCookie)).status,409);
  assert.equal((await call('/api/production-workflow',{action:'schedule',line:'A'},cookie)).status,403,'cannot act as QLSX');
  await c.close();c=await openDatabase(folder);await migrate(c.db);
  assert.equal((await(await call('/api/site-session',undefined,cookie)).json()).authenticated,true,'F5 and restart retain server-backed Line identity');
  const raw=await c.db.prepare("SELECT payload FROM app_records WHERE entity='users' AND record_key='LINE_A'").first(),user=JSON.parse(raw.payload);
  assert.equal((await call('/api/records',{entity:'users',key:'LINE_A',payload:{...user,role:'ADMIN'},expectedRevision:await recordRevision(raw.payload)},adminCookie)).status,409);
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='users' AND record_key='LINE_A'").bind(JSON.stringify({...user,role:'ADMIN',department:'ADMIN'})).run();
  const principal=await sitePrincipal(new Request('https://test.invalid',{headers:{cookie}}),{DB:c.db});assert.equal(principal.role,'USER');assert.equal(principal.isAdmin,false);assert.equal(principal.line,'A');
  const current=await c.db.prepare("SELECT payload FROM app_records WHERE entity='users' AND record_key='LINE_A'").first();
  assert.equal((await call('/api/records',{entity:'users',key:'LINE_A',payload:{...user,active:false},expectedRevision:await recordRevision(current.payload)},adminCookie)).status,200);
  assert.equal((await(await call('/api/site-session',undefined,cookie)).json()).authenticated,false);
  assert.equal((await call('/api/auth/line-login',{line:'A'})).status,403);
  assert.deepEqual(await(await call('/api/auth/lines')).json(),{lines:['B']});
  const audit=(await records(c.db)).filter(r=>r.entity==='admin_audit').map(r=>JSON.parse(r.payload));assert.ok(audit.some(r=>r.action==='LOGIN'&&r.actor==='LINE_A'&&r.loginMethod==='QUICK_LINE'));assert.equal(audit.filter(r=>r.action==='LINE_USER_CREATED').length,2);
 }finally{await c.close();}
});


test('Line client menus expose production reads only and keep cross-Line action guards',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let expression;for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText(ast)==='canOpenMenu')expression=declaration.initializer.getText(ast);
 assert.ok(expression);const context={};const helperNames=['normalizedGrant','moduleGrantLabels','childGrantLabels','canOpenLegacyMenu','hasAllocationCapability'];const helpers=ast.statements.filter(statement=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>helperNames.includes(declaration.name.getText(ast)))).map(statement=>statement.getText(ast)).join('\n');vm.runInNewContext(ts.transpileModule(`${helpers}\nglobalThis.canOpen=${expression}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 for(const line of ['A','B']){const user={kind:'line',line};for(const child of ['production-report','report-work','report-review','report-progress','report-dashboard','report-cancel','report-output','report-payroll','weekly-capacity','capacity-calendar','capacity-summary'])assert.equal(context.canOpen(user,'production',child),true,child);for(const view of ['sku','planning','warehouse','bom','users'])assert.equal(context.canOpen(user,view),false,view);for(const child of ['data-recovery','labor-adjustment','unknown'])assert.equal(context.canOpen(user,'production',child),false,child);}
 const production=readFileSync(new URL('../components/production-management.tsx',import.meta.url),'utf8');assert.match(production,/sessionLine&&row.line!==sessionLine/);assert.match(production,/sessionLine&&chosen\?\.line!==sessionLine/);assert.match(production,/const viewLine=sessionLine/);assert.doesNotMatch(production,/crossLineView\?undefined/);
});


test('correction Line filter is locked to session while unrestricted users keep all choices',()=>{
 const source=readFileSync(new URL('../components/production-corrections.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('sessionLine?:"A"|"B"'));
 assert.ok(source.includes('value:sessionLine||filters.line,disabled:!!sessionLine'));
 assert.ok(source.includes("line:sessionLine||'all'"));
 assert.ok(source.includes('sessionLine?<option value={sessionLine}>{sessionLine}</option>:'));
 assert.ok(source.includes(`<option value="all">{t('Tất cả Line')}</option><option>A</option><option>B</option>`));
 const parent=readFileSync(new URL('../components/production-management.tsx',import.meta.url),'utf8');
 assert.ok(parent.includes('<ProductionCorrections sessionLine={viewLine}'));
});
