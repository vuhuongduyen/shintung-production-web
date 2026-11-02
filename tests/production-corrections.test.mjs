import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {exampleDatabase,createProductionExamples} from '../scripts/local/production-examples.mjs';
import {mutateProductionWorkflow,readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {assignedAt} from '../lib/production-hours.mjs';
import {journalContext,journalRows,filterJournal} from '../lib/production-journal.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
const manager={login:'manager@test',isAdmin:true,line:null};
async function fixture(run) {
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/corrections-')));
 try{await migrate(c.db);const set=await createProductionExamples(c.db,manager);const at=time=>new Date(`${set.examples.date}T${time}:00+07:00`).toISOString();await run(c.db,at);}finally{await c.close();}
}
async function apply(db,event,operation='cancel',changes={}) {
 const body={eventId:event.id,version:event.version||0,operation,changes,reason:'Báo công sai, đối chiếu và sửa lại'};
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 return correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
}
test('cancel final pending output restores staffing and keeps original report plus cancellation journal',()=>fixture(async(db,at)=>{
 const saved=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:1000,effectiveAt:at('10:00')},manager);
 assert.equal(assignedAt((await readProductionWorkflow(db,manager)).events,'TEST-LSX-A01',Date.now()).count,0);
 const before=await records(db),body={action:'preview',eventId:saved.event.id,version:0,operation:'cancel'};
 const preview=await correctProduction(db,body,manager);assert.deepEqual(await records(db),before,'impact preview is read only');
 const result=await correctProduction(db,{...body,action:'apply',reason:'Nhập sai sản lượng',expectedRevision:preview.expectedRevision},manager);
 assert.equal(result.event.kind,'report-cancel');
 const state=await readProductionWorkflow(db,manager),report=state.reports.find(r=>r.id===saved.report.id);
 assert.equal(report.cancelled,true);assert.equal(report.reviewStatus,'Đã hủy');assert.equal(report.reportedQuantity,1000);
 assert.equal(state.events.find(e=>e.id===saved.event.id).voided,true);
 assert.equal(assignedAt(state.events,'TEST-LSX-A01',Date.now()).count,10);
 assert.equal(state.orders.find(o=>o.id==='TEST-LSX-A01').completedQty,0);
 assert.equal(journalRows('change',state.reports,state.events).filter(e=>e.kind==='report-cancel').length,1);
 await assert.rejects(()=>apply(db,saved.event),{status:409});
 // A new report starts at the station start, rather than the cancelled boundary.
 const next=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('11:00')},manager);
 assert.equal(next.report.startedAt,at('08:00'));
}));
test('adjust confirmed quantity/time updates draft warehouse and transit; posted warehouse refuses all writes',()=>fixture(async(db,at)=>{
 const saved=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:1000,effectiveAt:at('10:00')},manager);
 const approved={...saved.report,reviewStatus:'Đã xác nhận',approvedQuantity:1000};
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(approved),saved.report.id).run();
 const warehouse={id:`SX:${saved.report.id}`,reportId:saved.report.id,status:'Chờ xác nhận',proposedQuantity:1000,receivedQuantity:null};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('warehouse_in',warehouse.id,JSON.stringify(warehouse),'TEST','fixture').run();
 const result=await apply(db,saved.event,'adjust',{quantity:200,effectiveAt:at('11:00'),productionDate:at('11:00').slice(0,10)});
 assert.equal(result.event.kind,'report-correction');
 let state=await readProductionWorkflow(db,manager),report=state.reports.find(r=>r.id===saved.report.id);
 assert.equal(report.approvedQuantity,200);assert.ok(Math.abs(report.hours.hc-28.3333)<0.0001);
 assert.equal(state.orders.find(o=>o.id==='TEST-LSX-A01').completedQty,200);
 assert.equal(state.orders.find(o=>o.id==='TEST-LSX-A01').inTransitQty,800);
 assert.equal(assignedAt(state.events,'TEST-LSX-A01',Date.now()).count,10);
 const wh=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in' AND record_key=?").bind(warehouse.id).first()).payload);assert.equal(wh.proposedQuantity,200);
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='warehouse_in' AND record_key=?").bind(JSON.stringify({...wh,status:'Đã xác nhận',receivedQuantity:200}),warehouse.id).run();
 const before=await records(db),replacement=state.events.find(e=>e.correctedFrom===saved.event.id);
 await assert.rejects(()=>apply(db,replacement),/phiếu nhập kho đã được xử lý/);assert.deepEqual(await records(db),before);
}));
test('cancelling start with auto transfers cancels the whole group and restores source assignment',()=>fixture(async(db,at)=>{
 const started=await mutateProductionWorkflow(db,{action:'start',orderId:'TEST-LSX-A02',employees:['TEST-NV-A01','TEST-NV-A02','TEST-NV-A03','TEST-NV-A04'],count:4,effectiveAt:at('09:00')},manager);
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A02');
 assert.equal(assignedAt(state.events,'TEST-LSX-A01',Date.now()).count,6);
 await apply(db,start);
 const after=await readProductionWorkflow(db,manager);
 assert.equal(assignedAt(after.events,'TEST-LSX-A01',Date.now()).count,10);
 assert.equal(assignedAt(after.events,'TEST-LSX-A02',Date.now()).count,0);
 assert.ok(after.events.filter(e=>e.destinationIncludedInStart&&e.destinationId==='TEST-LSX-A02').every(e=>e.voided));
}));
test('dependent operations, roles, Line boundaries and stale previews cannot partially change records',()=>fixture(async(db,at)=>{
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A01');
 await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('10:00')},manager);
 const before=await records(db);
 await assert.rejects(()=>apply(db,start),/khoảng làm việc hợp lệ|phụ thuộc/);assert.deepEqual(await records(db),before);
 const event=(await readProductionWorkflow(db,manager)).events.find(e=>e.kind==='complete');
 const body={action:'preview',operation:'cancel',eventId:event.id,version:0};
 await assert.rejects(()=>correctProduction(db,body,{login:'worker@test',line:'A',grants:['Quản lý sản xuất / Thêm']}),{status:403});
 await assert.rejects(()=>correctProduction(db,body,{...manager,line:'B'}),{status:403});
 const preview=await correctProduction(db,body,manager);
 await mutateProductionWorkflow(db,{action:'pause',orderId:'TEST-LSX-A01',effectiveAt:at('11:00'),reason:'Dừng máy'},manager);
 const after=await records(db);
 await assert.rejects(()=>correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision,reason:'Hủy sai'},manager),{status:409});assert.deepEqual(await records(db),after);
}));
test('journal categories and filters include destination/affected orders but never leak unrelated Line events',()=>{
 const orders=[{id:'source',lsxCode:'LSX-01',sku:'102XS02001',name:'DÂY XẢ INOX SỌC',line:'A'},{id:'destination',lsxCode:'LSX-02',sku:'105B100051',name:'BỘ RỬA XE 1021 XANH',line:'A'}];
 const event={id:'transfer',kind:'transfer',sourceId:'source',destinationId:'destination',employees:['NV01'],line:'A',actor:'manager',recordedAt:'2026-10-01T18:00:00Z'};
 const row=journalContext(event,orders,[{id:'NV01',name:'Tên nhân viên trong danh sách'}]);
 assert.match(row.lsx,/LSX-02/);assert.match(row.name,/BỘ RỬA XE/);
 assert.equal(filterJournal([row],{field:'sku',value:'105B100051',from:'2026-10-02',to:'2026-10-02'}).length,1);
 assert.equal(filterJournal([row],{field:'employee',value:'Tên nhân viên'}).length,1);
 assert.equal(filterJournal([row],{field:'lsx',value:'LSX-khác'}).length,0);
 assert.equal(journalRows('labor',[],[event]).length,1);assert.equal(journalRows('time',[],[event]).length,0);
 assert.equal(journalRows('change',[],[{kind:'report-cancel'}]).length,1);assert.equal(journalRows('adjustment',[],[{kind:'report-correction'}]).length,1);
});

test('HTTP correction enforces authentication and refuses retired sample mode',()=>fixture(async(db,at)=>{
 const password=await passwordRecord('1234');
 for(const [login,role] of [['manager@test','Super Admin'],['viewer@test','USER']])await db.batch([
  db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role,active:true}),login,'fixture'),
  db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,password.hash,password.salt,password.iterations,'fixture')]);
 const cookies={};const call=async(path,body,login='manager@test')=>{
  const response=await siteApi(new Request(`https://test.invalid${path}`,{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json',...(cookies[login]?{cookie:cookies[login]}:{})},body:JSON.stringify(body)}),{DB:db,FILES:{put:async()=>{}}});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
 };
 for(const login of ['manager@test','viewer@test']){const response=await call('/api/auth/login',{login,password:'1234'},login);assert.equal(response.status,200);cookies[login]=response.cookie.split(';')[0];}
 const sampleDb=exampleDatabase(db);await createProductionExamples(sampleDb,manager);
 const before=await records(db),sampleState=await readProductionWorkflow(sampleDb,manager),event=sampleState.events.find(e=>e.kind==='start'&&e.line==='A');
 const body={action:'preview',operation:'cancel',eventId:event.id,version:0};
 assert.equal((await call('/api/production-correction',body,'anonymous')).status,401);
 assert.equal((await call('/api/production-correction',body,'viewer@test')).status,403);
 const preview=await call('/api/production-correction?examples=1',body);assert.equal(preview.status,410,JSON.stringify(preview.body));
 const changed=await call('/api/production-correction?examples=1',{...body,action:'apply',reason:'Hủy thử trong bộ mẫu',expectedRevision:preview.body.expectedRevision});assert.equal(changed.status,410,JSON.stringify(changed.body));
 const after=await records(db);
 assert.deepEqual(after.filter(r=>r.entity!=='website_action_audit'),before.filter(r=>r.entity!=='website_action_audit'));
 assert.ok(after.filter(r=>r.entity==='website_action_audit').length>before.filter(r=>r.entity==='website_action_audit').length,'denied requests must be audited without changing business data');
 assert.deepEqual((await readProductionWorkflow(sampleDb,manager)).events,sampleState.events);
}));
test('concurrent corrections commit one operation, one audit and no partial second cancellation',()=>fixture(async(db,at)=>{
 const state=await readProductionWorkflow(db,manager),starts=state.events.filter(e=>e.kind==='start');
 const bodies=await Promise.all(starts.map(async event=>{const base={eventId:event.id,version:0,operation:'cancel',reason:'Hủy sai'};const p=await correctProduction(db,{...base,action:'preview'},manager);return {...base,action:'apply',expectedRevision:p.expectedRevision};}));
 const results=await Promise.allSettled(bodies.map(body=>correctProduction(db,body,manager)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const after=await readProductionWorkflow(db,manager);assert.equal(after.events.filter(e=>e.kind==='report-cancel').length,1);assert.equal(after.events.filter(e=>e.kind==='start'&&e.voided).length,1);
}));

test('adjusting a rejected output returns it to review with corrected detail totals',()=>fixture(async(db,at)=>{
 const saved=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('10:00')},manager);
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...saved.report,reviewStatus:'Cần điều chỉnh',approvedQuantity:0}),saved.report.id).run();
 await apply(db,saved.event,'adjust',{quantity:200,effectiveAt:at('11:00')});
 const report=(await readProductionWorkflow(db,manager)).reports.find(r=>r.id===saved.report.id);
 assert.equal(report.reviewStatus,'Chờ kiểm tra');assert.equal(report.reportedQuantity,200);assert.equal(report.approvedQuantity,0);
}));

test('order-wide correction validates combined times, recalculates every output and records one complete audit',()=>fixture(async(db,at)=>{
 const pause=await mutateProductionWorkflow(db,{action:'pause',orderId:'TEST-LSX-A01',effectiveAt:at('09:00'),reason:'Tạm ngưng chuyền'},manager);
 const resume=await mutateProductionWorkflow(db,{action:'resume',orderId:'TEST-LSX-A01',effectiveAt:at('09:30')},manager);
 const first=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('11:00')},manager);
 const second=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:200,effectiveAt:at('13:30')},manager);
 const operations=[{eventId:pause.event.id,version:0,operation:'adjust',changes:{effectiveAt:at('10:20')}},{eventId:resume.event.id,version:0,operation:'adjust',changes:{effectiveAt:at('10:40')}}];
 await assert.rejects(()=>correctProduction(db,{action:'preview',...operations[0]},manager),/Tạm ngưng\/Tiếp tục/);
 const body={eventId:first.event.id,orderId:'TEST-LSX-A01',operations,reason:'Đối chiếu giờ tạm ngưng và tiếp tục của LSX'};
 const before=await records(db),preview=await correctProduction(db,{...body,action:'preview'},manager);
 assert.deepEqual(await records(db),before);
 assert.equal(preview.eventChanges.length,2);assert.equal(preview.orderImpacts[0].totalsAfter.quantity,300);
 const saved=await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 assert.equal(saved.event.eventChanges.length,2);assert.equal(saved.event.actorId,manager.login);
 const state=await readProductionWorkflow(db,manager),a=state.reports.find(r=>r.id===first.report.id),b=state.reports.find(r=>r.id===second.report.id);
 assert.equal(a.reportedQuantity,100);assert.equal(b.reportedQuantity,200);
 assert.equal(b.startedAt,a.completedAt);assert.ok(a.hours.total>first.report.hours.total);
 assert.equal(journalRows('adjustment',state.reports,state.events).filter(e=>e.correctionGroupId===saved.event.correctionGroupId).length,1);
 assert.equal(state.events.filter(e=>[pause.event.id,resume.event.id].includes(e.id)&&e.voided).length,2);
}));

test('cancel pause and resume together is atomic and cancellation is searchable in the correction journal',()=>fixture(async(db,at)=>{
 const pause=await mutateProductionWorkflow(db,{action:'pause',orderId:'TEST-LSX-A01',effectiveAt:at('09:00'),reason:'Tạm ngưng'},manager);
 const resume=await mutateProductionWorkflow(db,{action:'resume',orderId:'TEST-LSX-A01',effectiveAt:at('09:30')},manager);
 const output=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('11:00')},manager);
 const body={eventId:output.event.id,orderId:'TEST-LSX-A01',reason:'Hủy hai sự kiện ghi nhầm',operations:[pause,resume].map(r=>({eventId:r.event.id,version:0,operation:'cancel'}))};
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 const saved=await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 assert.equal(saved.event.kind,'report-cancel');assert.equal(saved.event.eventChanges.length,2);
 const state=await readProductionWorkflow(db,manager);
 assert.equal(journalRows('adjustment',state.reports,state.events).filter(e=>e.id===saved.event.id).length,1);
 assert.equal(state.reports.find(r=>r.id===output.report.id).reportedQuantity,100);
}));

test('batch invalid staff, unrelated LSX, duplicate events and stale preview preserve all original records',()=>fixture(async(db,at)=>{
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A01'),other=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-B01');
 const output=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('11:00')},manager);
 const valid={eventId:output.event.id,version:0,operation:'adjust',changes:{effectiveAt:at('11:30'),quantity:100}};
 const invalid={eventId:start.id,version:0,operation:'adjust',changes:{employees:['UNKNOWN-ID'],count:1}};
 const base={action:'preview',eventId:output.event.id,orderId:'TEST-LSX-A01',reason:'Kiểm tra toàn bộ sự kiện'},before=await records(db);
 await assert.rejects(()=>correctProduction(db,{...base,operations:[valid,invalid]},manager),/Nhân viên không tồn tại/);assert.deepEqual(await records(db),before);
 await assert.rejects(()=>correctProduction(db,{...base,operations:[valid,{eventId:other.id,version:0,operation:'cancel'}]},manager),/không thuộc LSX/);
 await assert.rejects(()=>correctProduction(db,{...base,operations:[valid,valid]},manager),/sự kiện khác nhau/);
 const preview=await correctProduction(db,{...base,operations:[valid]},manager);
 await mutateProductionWorkflow(db,{action:'pause',orderId:'TEST-LSX-A01',effectiveAt:at('12:00'),reason:'Dừng máy'},manager);
 const after=await records(db);
 await assert.rejects(()=>correctProduction(db,{...base,action:'apply',operations:[valid],expectedRevision:preview.expectedRevision},manager),{status:409});assert.deepEqual(await records(db),after);
}));

test('correct station start time with automatic transfers preserves the linked transfer group',()=>fixture(async(db,at)=>{
 await mutateProductionWorkflow(db,{action:'start',orderId:'TEST-LSX-A02',employees:['TEST-NV-A01','TEST-NV-A02'],count:2,effectiveAt:at('09:00')},manager);
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A02');
 const body={action:'preview',eventId:start.id,orderId:'TEST-LSX-A02',reason:'Sửa giờ nhập trạm',operations:[{eventId:start.id,version:0,operation:'adjust',changes:{effectiveAt:at('09:15'),employees:start.employees,count:2}}]};
 const preview=await correctProduction(db,body,manager);
 await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const after=await readProductionWorkflow(db,manager),transfers=after.events.filter(e=>e.destinationIncludedInStart&&e.destinationId==='TEST-LSX-A02'&&!e.voided);
 assert.equal(transfers.length,1);assert.equal(transfers[0].effectiveAt,at('09:15'));
 assert.equal(assignedAt(after.events,'TEST-LSX-A01',Date.parse(at('09:10'))).count,10);
 assert.equal(assignedAt(after.events,'TEST-LSX-A01',Date.parse(at('09:20'))).count,8);
 assert.equal(assignedAt(after.events,'TEST-LSX-A02',Date.parse(at('09:20'))).count,2);
}));

test('corrected workforce refreshes output counts, employee details and individual hours together',()=>fixture(async(db,at)=>{
 const output=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('11:00')},manager);
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A01');
 const people=start.employees.slice(0,9),body={eventId:output.event.id,orderId:'TEST-LSX-A01',reason:'Sửa danh sách nhập trạm theo nhân viên thực tế',operations:[{eventId:start.id,version:0,operation:'adjust',changes:{employees:people,count:9}}]};
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const after=await readProductionWorkflow(db,manager),event=after.events.find(e=>e.id===output.event.id),report=after.reports.find(r=>r.id===output.report.id);
 assert.equal(event.count,9);assert.equal(report.count,9);assert.deepEqual(event.employees,people);assert.deepEqual(report.employees,people);assert.equal(report.hours.perEmployee.length,9);
 assert.equal(report.reportedQuantity,100);assert.equal(report.hours.perEmployee.some(p=>p.id===start.employees[9]),false);
}));

test('adjusting workforce on station entry also adjusts its automatic transfer without cancelling the order',()=>fixture(async(db,at)=>{
 await mutateProductionWorkflow(db,{action:'start',orderId:'TEST-LSX-A02',employees:['TEST-NV-A01','TEST-NV-A02'],count:2,effectiveAt:at('09:00')},manager);
 const state=await readProductionWorkflow(db,manager),start=state.events.find(e=>e.kind==='start'&&e.sourceId==='TEST-LSX-A02');
 const body={eventId:start.id,orderId:'TEST-LSX-A02',reason:'Sửa người được chuyển khi nhập trạm',operations:[{eventId:start.id,version:0,operation:'adjust',changes:{employees:['TEST-NV-A03'],count:1,effectiveAt:at('09:15')}}]};
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 const result=await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const after=await readProductionWorkflow(db,manager),transfer=after.events.find(e=>e.destinationIncludedInStart&&e.destinationId==='TEST-LSX-A02'&&!e.voided);
 assert.equal(result.event.kind,'report-correction');assert.equal(after.events.some(e=>e.kind==='report-cancel'),false);
 assert.deepEqual(transfer.employees,['TEST-NV-A03']);assert.equal(transfer.count,1);
 assert.equal(assignedAt(after.events,'TEST-LSX-A01',Date.parse(at('09:20'))).count,9);
 assert.equal(assignedAt(after.events,'TEST-LSX-A02',Date.parse(at('09:20'))).count,1);
}));

test('manual report hours preview/apply persists, audits and rejects stale/unauthorized writes',()=>fixture(async(db,at)=>{
 const saved=await mutateProductionWorkflow(db,{action:'complete',orderId:'TEST-LSX-A01',quantity:100,effectiveAt:at('10:00')},manager);
 const state=await readProductionWorkflow(db,manager),report=state.reports.find(r=>r.id===saved.report.id);
 const body={operation:'adjust-report-hours',reportId:report.id,version:report.version||0,reason:'Đối chiếu giờ thực tế',hc:3,ot:0,perEmployee:(report.hours?.perEmployee||[]).map(p=>({...p,hc:1,ot:0}))};
 await assert.rejects(()=>correctProduction(db,{...body,action:'preview'},{login:'viewer'}),{status:403});
 await assert.rejects(()=>correctProduction(db,{...body,action:'preview',perEmployee:[],hc:-1},manager),{status:422});
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 const before=await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first();assert.equal(JSON.parse(before.payload).manualHours,undefined);
 await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const result=await readProductionWorkflow(db,manager),current=result.reports.find(r=>r.id===report.id);
 assert.equal(current.hours.total,preview.after.total);assert.equal(current.reportedQuantity,report.reportedQuantity);assert.equal(current.reviewStatus,report.reviewStatus);
 assert.ok(result.events.some(e=>e.kind==='hours-adjustment'&&e.reportId===report.id&&e.reason===body.reason));
 await assert.rejects(()=>correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager),{status:409});
}));

test('historical report hours can be corrected without rewriting imported source or quantities',()=>fixture(async(db,at)=>{
 const report={id:'HISTORY-HOURS',kind:'completion',historicalImport:true,sourceVerified:true,transitId:'TEST-LSX-A01',lsxCode:'TEST-A01',sku:'TEST-SP-A01',line:'A',startedAt:at('08:00'),completedAt:at('09:00'),reportedQuantity:10,reviewStatus:'Chờ kiểm tra',hours:{hc:10,ot:0,total:10,perEmployee:[]}};
 const batch=JSON.stringify({reports:[report]});await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_history_import','hours-fixture',batch,manager.login,at('09:00')).run();
 const body={operation:'adjust-report-hours',reportId:report.id,version:0,reason:'Đối chiếu nguồn',hc:8,ot:1};
 const preview=await correctProduction(db,{...body,action:'preview'},manager);
 await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const state=await readProductionWorkflow(db,manager),current=state.reports.find(r=>r.id===report.id);assert.equal(current.hours.total,9);assert.equal(current.reportedQuantity,10);assert.equal(current.reviewStatus,'Chờ kiểm tra');
 assert.equal((await db.prepare("SELECT payload FROM app_records WHERE entity='production_history_import' AND record_key='hours-fixture'").first()).payload,batch);
 await assert.rejects(()=>correctProduction(db,{...body,version:1,action:'preview'},{...manager,line:'B'}),{status:403});
}));

test('source timestamps preview and atomic apply recalculate hours, retain source and deduplicate overrides',()=>fixture(async(db,at)=>{
 const source=[{id:'SOURCE-START',kind:'source-time',sourceTimeLog:true,historicalImport:true,sourceOperation:'BẮT ĐẦU',sourceId:'TEST-LSX-A01',line:'A',effectiveAt:at('08:00'),recordedAt:at('08:00')},{id:'SOURCE-END',kind:'source-time',sourceTimeLog:true,historicalImport:true,sourceOperation:'HOÀN THÀNH',sourceId:'TEST-LSX-A01',line:'A',effectiveAt:at('09:00'),recordedAt:at('09:00'),reportId:'SOURCE-REPORT'}];
 const originalBatch=JSON.stringify({timeEvents:source});await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_history_import','source-fixture',originalBatch,manager.login,at('09:00')).run();
 const report={id:'SOURCE-REPORT',kind:'completion',historicalImport:true,sourceVerified:true,transitId:'TEST-LSX-A01',lsxCode:'TEST-A01',sku:'TEST-SP-A01',line:'A',startedAt:at('08:00'),completedAt:at('09:00'),reportedQuantity:10,approvedQuantity:0,count:10,sourceCount:10,reviewStatus:'Chờ kiểm tra',hours:{hc:9,ot:0,total:9,perEmployee:[]},sourceLateHours:1};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_report',report.id,JSON.stringify(report),manager.login,at('09:00')).run();
 const body={sourceTimeCorrection:true,orderId:'TEST-LSX-A01',reason:'Sửa giờ xuất trạm',operations:[{eventId:'SOURCE-END',version:0,operation:'adjust',changes:{effectiveAt:at('10:00')}}]};
 await assert.rejects(()=>correctProduction(db,{...body,action:'preview'},{login:'viewer'}),{status:403});
 const preview=await correctProduction(db,{...body,action:'preview'},manager);assert.equal(preview.reportImpacts[0].after.hours.total,19);
 await assert.rejects(()=>correctProduction(db,{...body,action:'preview',operations:[{...body.operations[0],changes:{effectiveAt:at('07:00')}}]},manager),{status:422});
 await correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager);
 const state=await readProductionWorkflow(db,manager),next=state.reports.find(r=>r.id===report.id);assert.equal(next.hours.total,19);assert.equal(next.completedAt,at('10:00'));assert.equal(next.reportedQuantity,10);assert.equal(next.reviewStatus,'Chờ kiểm tra');assert.equal(next.sourceLateHours,1);
 assert.equal(state.events.filter(e=>e.id==='SOURCE-END').length,1);assert.equal(state.events.find(e=>e.id==='SOURCE-END').effectiveAt,at('10:00'));assert.ok(state.events.some(e=>e.kind==='report-correction'&&e.eventChanges?.some(c=>c.eventId==='SOURCE-END')));
 assert.equal((await db.prepare("SELECT payload FROM app_records WHERE entity='production_history_import' AND record_key='source-fixture'").first()).payload,originalBatch);
 await assert.rejects(()=>correctProduction(db,{...body,action:'apply',expectedRevision:preview.expectedRevision},manager),{status:409});
}));
