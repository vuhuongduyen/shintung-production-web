import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {readHrMonth,saveHrMonth} from '../lib/production-hr-storage.mjs';
import {matchHrRows,validHrRows,hrFileMonth} from '../lib/production-hr-import.mjs';

test('HR PDFs match unique names but reject ambiguous/duplicate names and wrong IDs',()=>{
 const e=[{id:'NV01',name:'Lê Văn Đông',line:'A'},{id:'NV02',name:'Huỳnh Thị Diễm',line:'B'}];
 const matched=matchHrRows([{text:'1 Lê Văn Đông Lắp ráp 176 12'}],e).rows;
 assert.equal(matched[0].matchedBy,'name');assert.equal(validHrRows(matched.map(r=>({...r,hc:'176',ot:'12'}))),true);
 assert.ok(matchHrRows([{text:'Lê Văn Đông 176'}],[...e,{id:'NV03',name:'Lê Văn Đông',line:'A'}]).rows[0].issue);
 assert.ok(matchHrRows([{text:'NV010 Lê Văn Đông 176'}],e).rows[0].issue);
 assert.ok(matchHrRows([{text:'NV01 Huỳnh Thị Diễm 176'}],e).rows[0].issue);
 assert.equal(hrFileMonth('Copy of NĂM 2026-08 GIO CONG.pdf'),'2026-08');
});

test('monthly HR save survives re-read, preserves other employees, stores PDF and audit, rejects stale or unauthorized writes',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'hr-hours-')));
 const admin={login:'admin',userId:'ADM-01',isAdmin:true},a={id:'NV01',name:'Lê Văn Đông',line:'A',hc:176,ot:12,include:true},b={id:'NV02',name:'Huỳnh Thị Diễm',line:'B',hc:172,ot:0,include:false};
 try{
  await migrate(c.db);
  for(const r of [a,b])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',r.id,JSON.stringify({id:r.id,name:r.name,line:r.line,active:true}),'fixture','fixture').run();
  assert.equal((await readHrMonth(c.db,'2026-08',admin)).record,null);
  const input={month:'2026-08',expectedRevision:null,verified:true,sourceFile:'2026-08 hr.pdf',rows:[a,b],pdf:{name:'2026-08 hr.pdf',base64:btoa('%PDF-1.7\nfixture')}};
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,{login:'viewer',grants:['Quản lý sản xuất / Xem']}),{status:403});
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...input,month:'2026-10'},admin),/Tháng PDF/);
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...input,verified:false},admin),/đối chiếu/);
  const saved=await saveHrMonth(c.db,c.bucket,input,admin);
  const read=await readHrMonth(c.db,'2026-08',admin);assert.equal(read.revision,saved.revision);assert.deepEqual(read.record.rows,[a,b]);
  const scoped=await readHrMonth(c.db,'2026-08',{...admin,line:'A'});assert.deepEqual(scoped.record.rows,[a]);assert.equal(scoped.record.sources.length,1);
  const file=await c.db.prepare('SELECT * FROM file_objects').first();assert.equal(file.record_id,'2026-08');assert.equal(await (await c.bucket.get(file.object_key)).text(),'%PDF-1.7\nfixture');
  const audit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").first()).payload);assert.equal(audit.actor,'ADM-01');assert.equal(audit.after.rows.length,2);
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,admin),{status:409});
  const update={month:'2026-08',expectedRevision:read.revision,verified:true,rows:[{...a,hc:160}]};
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...update,rows:[b]},{...admin,line:'A'}),{status:403});
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...update,rows:[{...a,hc:744,ot:1}]},admin),/Giờ HC/);
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...update,rows:[{...a,name:b.name}]},admin),/không khớp/);
  await assert.rejects(saveHrMonth(c.db,c.bucket,{...update,rows:[a,a]},admin),/trùng/);
  await saveHrMonth(c.db,c.bucket,update,admin);const final=await readHrMonth(c.db,'2026-08',admin);assert.equal(final.record.rows.find(r=>r.id==='NV01').hc,160);assert.deepEqual(final.record.rows.find(r=>r.id==='NV02'),b);
  assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,2);
  const concurrent=await Promise.allSettled([150,140].map(hc=>saveHrMonth(c.db,c.bucket,{...update,expectedRevision:final.revision,rows:[{...a,hc}]},admin)));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.find(r=>r.status==='rejected').reason.status,409);
  await assert.rejects(readHrMonth(c.db,'2026-08',null),{status:401});
 }finally{await c.close();}
});

test('payroll example includes directory employees beyond the SX ten-per-line sample limit',async()=>{
 const {monthlyPayrollExample}=await import('../lib/production-payroll-example.mjs');
 const employees=['A','B'].flatMap(line=>Array.from({length:12},(_,i)=>({id:line+(i+1),name:line==='A'&&i===11?'Âu Hồng Sơn':`Nhân viên ${line} ${i+1}`,line,active:true})));
 const catalog=['A','B'].map(line=>({code:'SP'+line,name:'Sản phẩm '+line,line,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}));
 const sample=monthlyPayrollExample(catalog,employees,new Map([['SPA',.1],['SPB',.1]]),'2026-10');
 assert.equal(sample.employees.length,24);assert.equal(Object.keys(sample.drafts).length,24);assert.ok(sample.drafts['2026-10:A:A12']);
 const matched=matchHrRows([{text:'11 Âu Hồng Sơn Lắp ráp A 173'}],sample.employees);
 assert.equal(matched.rows[0].id,'A12');assert.equal(matched.rows[0].issue,'');
});

test('trial August PDF saved for October survives database reopen, isolates real HR and other months, keeps original file and revision checks',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const path=mkdtempSync(resolve(base,'hr-trial-'));let c=await openDatabase(path);
 const admin={login:'admin',userId:'ADM-01',isAdmin:true},person={id:'NV01',name:'Âu Hồng Sơn',line:'A',hc:173,ot:9,include:true};
 const input={month:'2026-10',expectedRevision:null,verified:true,sourceFile:'2026-08 hr.pdf',rows:[person],pdf:{name:'2026-08 hr.pdf',base64:btoa('%PDF-1.7\ntrial')}};
 try{
  await migrate(c.db);await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',person.id,JSON.stringify({...person,active:true}),'fixture','fixture').run();
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,admin),/Tháng PDF/);
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,{...admin,line:'A'},true),{status:403});
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,{login:'manager',grants:['Quản lý sản xuất / Sửa']},true),{status:403});
  const saved=await saveHrMonth(c.db,c.bucket,input,admin,true);
  assert.equal(saved.record.example,true);assert.equal(saved.record.sources[0].sourceMonth,'2026-08');
  await c.close();c=await openDatabase(path);
  const read=await readHrMonth(c.db,'2026-10',admin,true);assert.deepEqual(read.record.rows,[person]);assert.equal(read.revision,saved.revision);
  assert.equal((await readHrMonth(c.db,'2026-10',admin)).record,null);assert.equal((await readHrMonth(c.db,'2026-08',admin,true)).record,null);
  const file=await c.db.prepare('SELECT * FROM file_objects').first();assert.equal(file.record_id,'example:2026-10');assert.match(file.object_key,/reports\/hr\/example\//);assert.equal(await(await c.bucket.get(file.object_key)).text(),'%PDF-1.7\ntrial');
  const audit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").first()).payload);assert.equal(audit.action,'SAVE_HR_EXAMPLE_MONTH');assert.equal(audit.entity,'production_hr_month_example');
  await assert.rejects(saveHrMonth(c.db,c.bucket,input,admin,true),{status:409});
  const actual=await saveHrMonth(c.db,c.bucket,{...input,sourceFile:'2026-10 hr.pdf',pdf:undefined,rows:[{...person,hc:160}]},admin);
  assert.equal(actual.record.rows[0].hc,160);assert.equal((await readHrMonth(c.db,'2026-10',admin,true)).record.rows[0].hc,173);
 }finally{await c.close();}
});

test('Site HR endpoint saves trial PDF and subsequent GET restores its hours without leaking into the production month',async()=>{
 const {siteApi}=await import('../worker/site-api.mjs'),{passwordRecord}=await import('../worker/password-auth.mjs');
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'hr-api-'))),login='admin-hr@example.test';let cookie='';
 const call=(path,body)=>siteApi(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{cookie,...(body?{origin:'https://test.invalid','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:c.db,FILES:c.bucket});
 try{
  await migrate(c.db);const p=await passwordRecord('1234');await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role:'Super Admin',active:true}),login,'fixture'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'fixture')]);
  const auth=await call('/api/auth/login',{login,password:'1234'});assert.equal(auth.status,200);cookie=auth.headers.get('set-cookie').split(';')[0];
  const person={id:'NV01',name:'Âu Hồng Sơn',line:'A',hc:173,ot:9,include:true};await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('employees',person.id,JSON.stringify({...person,active:true}),login,'fixture').run();
  const before=await call('/api/production-hr-hours?month=2026-10&examples=1');assert.equal(before.status,200);assert.equal((await before.json()).record,null);
  const saved=await call('/api/production-hr-hours?examples=1',{month:'2026-10',expectedRevision:null,verified:true,sourceFile:'2026-08 hr.pdf',rows:[person],pdf:{name:'2026-08 hr.pdf',base64:btoa('%PDF-1.7\ntrial')}});assert.equal(saved.status,200);
  const reload=await call('/api/production-hr-hours?month=2026-10&examples=1');assert.equal(reload.status,200);assert.deepEqual((await reload.json()).record.rows,[person]);
  assert.equal((await(await call('/api/production-hr-hours?month=2026-10')).json()).record,null);
  const wrong=await call('/api/production-hr-hours',{month:'2026-10',expectedRevision:null,verified:true,sourceFile:'2026-08 hr.pdf',rows:[person]});assert.equal(wrong.status,422);
 }finally{await c.close();}
});

test('monthly illustration credits warehouse help only to the three named directory employees, independently of row order',async()=>{
 const {monthlyPayrollExample,payrollWarehouseHelpers}=await import('../lib/production-payroll-example.mjs');
 const catalog=['A','B'].map(line=>({code:'SP'+line,name:'Sản phẩm '+line,line,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}));
 const employees=[{id:'A1',name:'Nhân viên thường A',line:'A'},{id:'B1',name:'Nhân viên thường B',line:'B'},...payrollWarehouseHelpers.map((name,i)=>({id:'PK'+i,name,line:i===0?'B':'A'}))];
 const create=people=>monthlyPayrollExample(catalog,people,new Map([['SPA',.1],['SPB',.1]]),'2026-10');
 const sample=create(employees),reversed=create([...employees].reverse());
 assert.deepEqual(sample.helpers.A.issues,[]);assert.equal(sample.helpers.A.hours.get('A1'),0);assert.equal(sample.helpers.B.hours.get('B1'),0);
 assert.equal(sample.helpers.A.hours.get('PK1'),10);assert.equal(sample.helpers.A.hours.get('PK2'),10);assert.equal(sample.helpers.B.hours.get('PK0'),20);
 for(const line of ['A','B']){assert.deepEqual([...sample.helpers[line].hours].sort(),[...reversed.helpers[line].hours].sort());const hours=employees.filter(e=>e.line===line).reduce((sum,e)=>sum+Number(sample.drafts[`2026-10:${line}:${e.id}`].hc)+Number(sample.drafts[`2026-10:${line}:${e.id}`].ot),0)-20;const earned=sample.reports.filter(r=>r.transitId.includes(`-${line}-`)).reduce((sum,r)=>sum+r.approvedQuantity*.1,0);assert.ok(Math.abs(earned-hours*(line==='A'?.98:.88))<.11);}
 const missing=create(employees.filter(e=>e.id!=='PK0'));assert.ok(missing.helpers.B.issues.some(s=>s.includes('Quách Chanh Thảo')));
 const duplicate=create([...employees,{...employees.at(-1),id:'dup'}]);assert.ok(duplicate.helpers.A.issues.some(s=>s.includes('bị trùng')));
});
