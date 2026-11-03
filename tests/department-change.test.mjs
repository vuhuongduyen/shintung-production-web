import test from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';import {changeRequests,changeDepartment} from '../worker/change-requests.mjs';
test('department correspondence: permissions, private drafts, bilateral sends, CAS and history',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'change-test'}});try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 const a={permissionLogin:'htndiem'},b={permissionLogin:'cnphuong'},c={permissionLogin:'ntnphung'};
 for(const login of ['htndiem','nttvy'])assert.equal(changeDepartment(login),'KHSX');for(const login of ['cnphuong','ntnphung','dhtin'])assert.equal(changeDepartment(login),'QLSX');
 await assert.rejects(()=>changeRequests(db,{permissionLogin:'other'}),{status:403});
 const id=crypto.randomUUID();await changeRequests(db,a,{action:'save',id,text:'Đổi lịch',date:'2026-10-23',time:'08:00'});
 assert.equal((await changeRequests(db,b)).records.length,0);assert.equal((await changeRequests(db,{permissionLogin:'nttvy'})).records.length,0);
 await changeRequests(db,a,{action:'send',id,revision:1,text:'Đổi lịch',date:'2026-10-23',time:'08:00'});
 for(const who of [b,c,{permissionLogin:'dhtin'}])assert.equal((await changeRequests(db,who)).records[0].pending,'QLSX');
 await assert.rejects(()=>changeRequests(db,a,{action:'send',id,revision:2,text:'Không được'}),{status:403});
 await changeRequests(db,b,{action:'save',id,revision:2,text:'Nháp phản hồi'});assert.deepEqual((await changeRequests(db,c)).records[0].drafts,{});
 await assert.rejects(()=>changeRequests(db,c,{action:'send',id,revision:2,text:'Trùng'}),{status:409});
 await changeRequests(db,b,{action:'send',id,revision:3,text:'Đồng ý'});
 const saved=(await changeRequests(db,a)).records[0];assert.equal(saved.messages.length,2);assert.equal(saved.messages[1].login,'cnphuong');assert.ok(!saved.pendingDepartments.includes('KHSX'));assert.equal(saved.unreadReplyCount,1);assert.ok(saved.pendingDepartments.includes('Kho LK'));assert.equal(saved.date,new Date(Date.parse(saved.createdAt)+7*3600000).toISOString().slice(0,10));
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,4);
 const tamper=crypto.randomUUID();await changeRequests(db,a,{action:'save',id:tamper,text:'x',date:'2000-01-01',time:'25:00',createdAt:'2000-01-01T00:00:00Z'});const locked=(await changeRequests(db,a)).records.find(r=>r.id===tamper);assert.notEqual(locked.date,'2000-01-01');assert.notEqual(locked.time,'25:00');assert.ok(locked.createdAt.startsWith(new Date().toISOString().slice(0,10)));await changeRequests(db,a,{action:'send',id:tamper,revision:1,text:'send',date:'2001-01-01',time:'00:00'});assert.equal((await changeRequests(db,a)).records.find(r=>r.id===tamper).createdAt,locked.createdAt);
 }finally{await mf.dispose()}
});
test('warehouse queues independent; supervisor may reply for each warehouse; admin view',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'warehouse-change'}});try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 const actor=login=>({permissionLogin:login}),id=crypto.randomUUID();
 await changeRequests(db,actor('htndiem'),{action:'send',id,text:'Kiểm tra vật tư'});
 for(const login of ['ltphong','httung','nttnghiem','tpnhi'])assert.equal((await changeRequests(db,actor(login))).records.length,1);
 const row=async()=> (await changeRequests(db,actor('htndiem'))).records.find(r=>r.id===id);
 assert.deepEqual((await row()).pendingDepartments,['QLSX','Kho LK','Kho BB','Kho UT']);
 await assert.rejects(()=>changeRequests(db,actor('ltphong'),{action:'send',id,revision:1,text:'Sai kho',department:'Kho BB'}),{status:403});
 await changeRequests(db,actor('ltphong'),{action:'send',id,revision:1,text:'LK đủ',department:'Kho LK'});
 assert.deepEqual((await row()).pendingDepartments,['QLSX','Kho BB','Kho UT']);
 await changeRequests(db,actor('tpnhi'),{action:'send',id,revision:2,text:'BB đủ',department:'Kho BB'});
 assert.ok((await row()).pendingDepartments.includes('Kho UT'));assert.ok(!(await row()).pendingDepartments.includes('Kho BB'));
 await assert.rejects(()=>changeRequests(db,actor('tpnhi'),{action:'send',id,revision:3,text:'Giả QLSX',department:'QLSX'}),{status:403});
 await changeRequests(db,actor('tpnhi'),{action:'send',id,revision:3,text:'UT đủ',department:'Kho UT'});
 const messages=(await row()).messages;assert.equal(messages.at(-1).login,'tpnhi');assert.equal(messages.at(-1).department,'Kho UT');
 assert.equal((await changeRequests(db,{permissionLogin:'vthduyen',isAdmin:true})).records.length,1);
 await assert.rejects(()=>changeRequests(db,actor('httung'),{action:'send',id:crypto.randomUUID(),text:'Tạo trái quyền'}),{status:403});
 const qid=crypto.randomUUID();await changeRequests(db,actor('cnphuong'),{action:'send',id:qid,text:'Phiếu QLSX'});await changeRequests(db,actor('htndiem'),{action:'send',id:qid,revision:1,text:'Phản hồi QLSX'});
 assert.ok(!(await changeRequests(db,actor('tpnhi'))).records.some(r=>r.id===qid));
 await assert.rejects(()=>changeRequests(db,actor('tpnhi'),{action:'send',id:qid,revision:2,text:'Không thuộc phiếu'}),{status:403});
 }finally{await mf.dispose()}
});
test('admin can create for either department and reply for warehouse with true login',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'admin-change'}});try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();const admin={permissionLogin:'vthduyen',isAdmin:true},id=crypto.randomUUID();
 await changeRequests(db,admin,{action:'save',id,text:'Nháp admin',department:'KHSX'});await changeRequests(db,admin,{action:'send',id,revision:1,text:'Phiếu admin',department:'KHSX'});await changeRequests(db,admin,{action:'send',id,revision:2,text:'Phản hồi kho',department:'Kho LK'});
 const r=(await changeRequests(db,admin)).records[0];assert.equal(r.department,'KHSX');assert.equal(r.owner,'vthduyen');assert.equal(r.messages.at(-1).login,'vthduyen');assert.equal(r.messages.at(-1).department,'Kho LK');assert.ok(r.pendingDepartments.includes('Kho BB'));
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,0);
 await assert.rejects(()=>changeRequests(db,{permissionLogin:'other'},{action:'send',id:crypto.randomUUID(),text:'Giả quyền',department:'KHSX',isAdmin:true}),{status:403});
 const q=crypto.randomUUID();await changeRequests(db,admin,{action:'send',id:q,text:'Phiếu QLSX',department:'QLSX'});assert.equal((await changeRequests(db,admin)).records.find(x=>x.id===q).department,'QLSX');
 }finally{await mf.dispose()}
});
test('all designated users can save/send and warehouse users cannot create',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'all-change-users'}});
 try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 for(const login of ['htndiem','nttvy','cnphuong','ntnphung','dhtin']){const actor={permissionLogin:login},id=crypto.randomUUID();const own=changeDepartment(login),other=own==='KHSX'?'QLSX':'KHSX';await assert.rejects(()=>changeRequests(db,actor,{action:'save',id:crypto.randomUUID(),text:'Wrong menu',originScope:other}),{status:403});await assert.rejects(()=>changeRequests(db,actor,{action:'save',id:crypto.randomUUID(),text:'Spoof origin',originScope:other,department:other}),{status:403});await changeRequests(db,actor,{action:'save',id,text:'Test draft',originScope:own});await changeRequests(db,actor,{action:'send',id,revision:1,text:'Test send'});assert.equal((await changeRequests(db,actor)).records.find(r=>r.id===id).messages[0].login,login);}
 for(const [login,department] of [['ltphong','Kho LK'],['httung','Kho BB'],['nttnghiem','Kho UT'],['tpnhi','Kho LK'],['tpnhi','Kho BB'],['tpnhi','Kho UT']]){const actor={permissionLogin:login},id=crypto.randomUUID();await changeRequests(db,{permissionLogin:'htndiem'},{action:'send',id,text:'Test request'});await changeRequests(db,actor,{action:'save',id,revision:1,text:'Test response draft',department});await changeRequests(db,actor,{action:'send',id,revision:2,text:'Test response',department});await assert.rejects(()=>changeRequests(db,actor,{action:'save',id:crypto.randomUUID(),text:'Forbidden create'}),{status:403});}
 }finally{await mf.dispose()}
});
test('page toolbar gate accepts assigned users independently of legacy grants',async()=>{
 const {readFile}=await import('node:fs/promises');const {requestDepartment}=await import('../lib/department-change-access.mjs');const source=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');const line=source.split('\n').find(l=>l.includes('if(name === "DepartmentChangeRequests"'));assert.ok(line,'Department toolbar gate must be wired in the page');const gate=new Function('session','name','requestDepartment',line+'\nreturn false;');
 for(const login of ['htndiem','nttvy','cnphuong','ntnphung','dhtin','ltphong','httung','nttnghiem','tpnhi'])for(const name of ['DepartmentChangeRequests','DepartmentChangeEditor'])assert.equal(gate({kind:'account',login,grants:[]},name,requestDepartment),true,`${login} ${name}`);
 assert.equal(gate({kind:'account',login:'other',grants:[]},'DepartmentChangeEditor',requestDepartment),false);assert.equal(gate({kind:'account',login:'admin',isAdmin:true},'DepartmentChangeEditor',requestDepartment),true);
});
test('origin never owes a reply; unread responses are per user, durable and independent of pending departments',async()=>{
 const {requestStatus,canReplyDepartments}=await import('../lib/department-change-access.mjs');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'reply-notification'}});
 try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 const actor=login=>({permissionLogin:login}),id=crypto.randomUUID(),get=async login=>(await changeRequests(db,actor(login))).records.find(r=>r.id===id);
 await changeRequests(db,actor('htndiem'),{action:'send',id,text:'KH request'});
 await changeRequests(db,actor('cnphuong'),{action:'send',id,revision:1,text:'SX response'});
 let kh=await get('htndiem');assert.equal(kh.unreadReplyCount,1);assert.equal((await get('nttvy')).unreadReplyCount,1);assert.equal((await get('tpnhi')).unreadReplyCount,0);assert.deepEqual(canReplyDepartments(kh,'htndiem'),[]);assert.doesNotMatch(requestStatus(kh),/KHSX/);
 for(const action of ['save','send'])await assert.rejects(()=>changeRequests(db,actor('htndiem'),{action,id,revision:kh.revision,text:'Self reply'}),{status:403});
 // Legacy persisted source-department entries are projected away without changing history.
 await db.prepare("UPDATE app_records SET payload=json_set(payload,'$.pendingDepartments',json(?),'$.pending','KHSX') WHERE entity='department_change' AND record_key=?").bind(JSON.stringify(['Kho LK','Kho BB','Kho UT','KHSX']),id).run();
 kh=await get('htndiem');assert.doesNotMatch(requestStatus(kh),/KHSX/);assert.deepEqual(canReplyDepartments(kh,'htndiem'),[]);
 const before=await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(id).first();
 await changeRequests(db,actor('htndiem'),{action:'read',id,messageCount:2});
 assert.equal((await get('htndiem')).unreadReplyCount,0);assert.equal((await get('nttvy')).unreadReplyCount,1);assert.deepEqual(await db.prepare("SELECT payload FROM app_records WHERE entity='department_change' AND record_key=?").bind(id).first(),before);
 await assert.rejects(()=>changeRequests(db,actor('tpnhi'),{action:'read',id,messageCount:2}),{status:403});
 await assert.rejects(()=>changeRequests(db,actor('htndiem'),{action:'read',id,messageCount:999}),{status:400});
 await changeRequests(db,actor('ltphong'),{action:'send',id,revision:2,text:'LK response'});
 await changeRequests(db,actor('htndiem'),{action:'read',id,messageCount:2});assert.equal((await get('htndiem')).unreadReplyCount,1,'reading old snapshot must not consume new response');
 await changeRequests(db,actor('tpnhi'),{action:'send',id,revision:3,department:'Kho BB',text:'BB response'});
 await changeRequests(db,actor('tpnhi'),{action:'send',id,revision:4,department:'Kho UT',text:'UT response'});
 kh=await get('htndiem');assert.equal(requestStatus(kh),'Đã phản hồi đầy đủ');assert.equal(kh.unreadReplyCount,3);assert.equal(kh.messages.length,5);
 const sxid=crypto.randomUUID();await changeRequests(db,actor('dhtin'),{action:'send',id:sxid,text:'SX request'});await changeRequests(db,actor('nttvy'),{action:'send',id:sxid,revision:1,text:'KH response'});
 const sx=(await changeRequests(db,actor('ntnphung'))).records.find(r=>r.id===sxid);assert.equal(requestStatus(sx),'Đã phản hồi đầy đủ');assert.deepEqual(canReplyDepartments(sx,'ntnphung'),[]);assert.equal(sx.unreadReplyCount,1);
 }finally{await mf.dispose()}
});
