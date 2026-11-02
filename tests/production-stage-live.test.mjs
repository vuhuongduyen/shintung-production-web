import {mergeProductionSavedResult} from '../lib/production-saved-result.mjs';
import {fakePassword} from './fixtures/review-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {projectLiveStages,liveStageChoices} from '../lib/production-stage-live.mjs';
const admin={login:'ADMIN',isAdmin:true};
test('official stage lifecycle persists, counts stage labor, final-only output, conflicts and retry safety',async()=>{const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-live-')));try{const db=c.db;await migrate(db);const put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:i<5,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[]}));
await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:days}}]});
for(const id of ['N1','N2'])await put('employees',id,{id,name:id,line:'A',active:true});
for(const id of ['O1','O2'])await put('in_transit',id,{id,planId:id,lsxCode:id,sku:id,line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
const catalog=['O1','O2'].map(code=>({code,processes:['CUT','FINAL']}));
const send=(action,hour,stageEntries,other={})=>mutateProductionWorkflow(db,{action,orderId:'O1',effectiveAt:`2026-09-25T${hour}:00+07:00`,stageEntries,requestIdempotency:crypto.randomUUID(),...other},admin,catalog);
const first={action:'start',orderId:'O1',effectiveAt:'2026-09-25T08:00:00+07:00',stageEntries:[{stage:'CUT',people:['N1']},{stage:'FINAL',people:['N2']}],requestIdempotency:crypto.randomUUID()};
await assert.rejects(()=>mutateProductionWorkflow(db,first,{login:'VIEW',grants:[]},catalog));
await mutateProductionWorkflow(db,first,admin,catalog);assert.equal((await mutateProductionWorkflow(db,first,admin,catalog)).replayed,true);
await send('pause','09:00',[{stage:'CUT'}]);await send('resume','09:30',[{stage:'CUT'}]);
const cut=await send('complete','10:00',[{stage:'CUT',quantity:100}]);assert.equal(cut.reports[0].reportedQuantity,0);assert.equal(cut.reports[0].hours.total,1.5);
let w=await readProductionWorkflow(db,admin,catalog),s=projectLiveStages(w.orders,w.reports,w.events);assert.deepEqual(liveStageChoices(w.orders.find(o=>o.id==='O1'),s,'start'),[]);assert.deepEqual(liveStageChoices(w.orders.find(o=>o.id==='O1'),s,'complete'),['FINAL']);
await assert.rejects(()=>send('start','10:10',[{stage:'CUT',people:['N2']}],{orderId:'O2'}),/xác nhận chuyển/);
await send('start','10:10',[{stage:'CUT',people:['N2']}],{orderId:'O2',confirmed:true});
await send('resume','11:00',[{stage:'FINAL',people:['N1']}]);
const final=await send('complete','12:00',[{stage:'FINAL',quantity:100}]);assert.equal(final.reports[0].reportedQuantity,100);assert.equal(final.reports[0].reviewStatus,'Chờ kiểm tra');assert.equal(final.reports[0].hours.total,3);
assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
await assert.rejects(()=>send('start','13:00',[{stage:'FINAL',people:['N1']}]),/Công đoạn|đã báo đủ/);
await assert.rejects(()=>send('pause','12:30',[{stage:'CUT'}],{orderId:'O2',expectedStages:{'["O2","CUT"]':'old'}}),/vừa thay đổi/);
// Supply the actual preceding-stage exit for O2 before its Saturday Final.
// Keep the overtime scenario valid under the agreed Final prerequisite rule.
const cutO2=await send('complete','16:00',[{stage:'CUT',quantity:100}],{orderId:'O2'});assert.equal(cutO2.reports[0].stageQuantity,100);assert.equal(cutO2.reports[0].reportedQuantity,0);
// Saturday outside calendar: explicit extra work counts only selected person, stops at 17h.
await send('extra','08:00',[{stage:'FINAL',people:['N1']}],{orderId:'O2',effectiveAt:'2026-09-26T08:00:00+07:00'});
const extra=await send('complete','18:00',[{stage:'FINAL',quantity:100}],{orderId:'O2',effectiveAt:'2026-09-26T18:00:00+07:00'});assert.ok(Math.abs(extra.reports[0].hours.total-7.6667)<0.001);
w=await readProductionWorkflow(db,admin,catalog);assert.equal(w.reports.find(r=>r.id===final.reports[0].id).hours.total,3);assert.equal(w.rights.stageLive,true);
}finally{await c.close();}});

test('official stage approval API: intermediate hours only, final output synchronizes to transit and one receipt',async()=>{
 const {siteApi}=await import('../worker/site-api.mjs'),{passwordRecord}=await import('../worker/password-auth.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-approval-')));try{await migrate(c.db);const db=c.db,put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
 await put('users','ADMIN',{login:'ADMIN',role:'Super Admin',active:true});const password=await passwordRecord(fakePassword);await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('ADMIN',password.hash,password.salt,password.iterations,'TEST').run();
 let cookie='';const call=async(path,body)=>{const r=await siteApi(new Request('https://test.invalid'+path,{method:'POST',headers:{cookie,origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify(body)}),{DB:db,FILES:c.bucket});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const login=await call('/api/auth/login',{login:'ADMIN',password:fakePassword});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
 await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',planEnd:'2026-09-30',syncStatus:'ĐÃ ĐỒNG BỘ'});
 for(const [id,stage,qty] of [['cut','CUT',0],['final','FINAL',100]])await put('production_report',id,{id,kind:'completion',stageReporting:true,transitId:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,stageName:stage,stageQuantity:100,reportedQuantity:qty,reviewStatus:'Chờ kiểm tra',startedAt:'2026-09-25T08:00:00+07:00',completedAt:'2026-09-25T12:00:00+07:00',hours:{hc:0,ot:0,total:0},version:1});
 const cut=await call('/api/production-report',{action:'review',reportId:'cut',approve:true,expectedVersion:1});assert.equal(cut.status,200,JSON.stringify(cut.body));assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 const final=await call('/api/production-report',{action:'review',reportId:'final',approve:true,expectedVersion:1});assert.equal(final.status,200,JSON.stringify(final.body));assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,1);
 const workflow=await readProductionWorkflow(db,admin);assert.equal(workflow.orders.find(o=>o.id==='O').completedQty,100);assert.equal((await call('/api/production-report',{action:'review',reportId:'final',approve:true})).status,409);
 }finally{await c.close();}
});

test('imported active stage can pause resume and exit with correct persisted hours',async()=>{const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-live-')));try{const db=c.db;await migrate(db);const put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:i<5,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[]}));
await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:days}}]});
for(const id of ['N1','N2'])await put('employees',id,{id,name:id,line:'A',active:true});
for(const id of ['O1','O2'])await put('in_transit',id,{id,planId:id,lsxCode:id,sku:id,line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
const catalog=['O1','O2'].map(code=>({code,processes:['CUT','FINAL']}));
const send=(action,hour,stageEntries,other={})=>mutateProductionWorkflow(db,{action,orderId:'O1',effectiveAt:`2026-09-25T${hour}:00+07:00`,stageEntries,requestIdempotency:crypto.randomUUID(),...other},admin,catalog);
await put('production_event','ERP-START',{id:'ERP-START',kind:'source-time',sourceTimeLog:true,sourceVerified:true,historicalImport:true,erpStageImport:true,sourceId:'O1',line:'A',stageName:'A-CUT',sourceOperation:'Nhập trạm',employees:['N1'],effectiveAt:'2026-09-25T08:00:00+07:00'});
let w=await readProductionWorkflow(db,admin,catalog),s=projectLiveStages(w.orders,w.reports,w.events);
assert.deepEqual(liveStageChoices(w.orders.find(o=>o.id==='O1'),s,'pause'),['CUT']);
await send('pause','09:00',[{stage:'CUT'}],{expectedStages:{'["O1","CUT"]':'2026-09-25T08:00:00+07:00'}});
await send('resume','09:30',[{stage:'CUT'}]);
const result=await send('complete','10:00',[{stage:'CUT',quantity:100}]);
assert.equal(result.reports[0].hours.total,1.5);
w=await readProductionWorkflow(db,admin,catalog);assert.equal(w.reports.find(r=>r.id===result.reports[0].id).hours.total,1.5);
assert.equal(projectLiveStages(w.orders,w.reports,w.events)['["O1","CUT"]'].status,'done');
}finally{await c.close();}});


test('add staff to unfinished stages preserves state and counts only actual working intervals',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-add-')));try{
 const db=c.db;await migrate(db);const put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
 const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}));
 await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:3,dailySchedule:days}}]});
 for(const id of ['N1','N2','N3'])await put('employees',id,{id,name:id,line:'A',active:true});
 for(const id of ['O1','O2'])await put('in_transit',id,{id,planId:id,lsxCode:id,sku:id,line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const catalog=['O1','O2'].map(code=>({code,processes:['CUT','FINAL']}));
 const send=(action,hour,people=[],extra={})=>mutateProductionWorkflow(db,{action,orderId:'O1',effectiveAt:`2026-09-25T${hour}:00+07:00`,stageEntries:[{stage:'CUT',people}],requestIdempotency:crypto.randomUUID(),...extra},admin,catalog);
 const state=async()=>{const w=await readProductionWorkflow(db,admin,catalog);return projectLiveStages(w.orders,w.reports,w.events);};
 const key='["O1","CUT"]';
 await assert.rejects(()=>send('add','08:00',['N1']),/Công đoạn/);let s=await state();assert.equal(s[key].status,'waiting');assert.equal(s[key].startedAt,undefined);
 await send('start','08:30',['N1']);assert.equal((await state())[key].startedAt,'2026-09-25T01:30:00.000Z');
 let client=await readProductionWorkflow(db,admin,catalog);
 const expected=()=>Object.fromEntries(Object.entries(projectLiveStages(client.orders,client.reports,client.events)).map(([k,s])=>[k,s.at||null]));
 const added=await send('add','09:00',['N2'],{expectedStages:expected()});
 assert.equal(added.events.length,1);client=mergeProductionSavedResult(client,added);
 const paused=await send('pause','10:00',[],{expectedStages:expected()});client=mergeProductionSavedResult(client,paused);
 const addedAgain=await send('add','10:15',['N3'],{expectedStages:expected()});client=mergeProductionSavedResult(client,addedAgain);
 assert.deepEqual(projectLiveStages(client.orders,client.reports,client.events)[key].people,['N1','N2','N3']);s=await state();assert.equal(s[key].status,'paused');assert.deepEqual(s[key].people,['N1','N2','N3']);
 await assert.rejects(()=>send('add','10:00',['N1']),/Thời gian/);
 await send('resume','11:00');
 const result=await send('complete','12:00',[],{stageEntries:[{stage:'CUT',quantity:50,continuePeople:[]}]});
 const hours=result.reports[0].hours;assert.equal(hours.total,5.5);assert.deepEqual(Object.fromEntries(hours.perEmployee.map(p=>[p.id,p.total])),{N1:2.5,N2:2,N3:1});
 await send('add','13:00',['N1']);assert.equal((await state())[key].status,'paused');
 await send('resume','14:00',['N1']);const rest=await send('complete','15:00',[],{stageEntries:[{stage:'CUT',quantity:50}]});assert.equal(rest.reports[0].hours.total,1);
 await assert.rejects(()=>send('add','15:10',['N1']),/Công đoạn/);
 await send('start','15:10',['N2'],{orderId:'O2'});await send('start','15:10',['N1'],{stageEntries:[{stage:'FINAL',people:['N1']}]});
 await assert.rejects(()=>send('add','15:15',['N2'],{stageEntries:[{stage:'FINAL',people:['N2']}]}),/xác nhận chuyển/);
 await send('add','15:15',['N2'],{stageEntries:[{stage:'FINAL',people:['N2']}],confirmed:true});
 s=await state();assert.equal(s['["O2","CUT"]'].status,'paused');assert.deepEqual(s['["O2","CUT"]'].people,[]);
 await assert.rejects(()=>send('add','15:20',['N3'],{stageEntries:[{stage:'FINAL',people:['N3']}],expectedStages:{}}),/vừa thay đổi/);
 const w=await readProductionWorkflow(db,admin,catalog);assert.equal(w.reports.length,2);assert.ok(w.events.some(e=>e.stageAction==='add'&&e.stageBefore.status==='paused'&&e.stageAfter.status==='paused'));
 }finally{await c.close();}
});
