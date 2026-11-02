import test from 'node:test';import assert from 'node:assert/strict';
import {assertFinalExitLimit} from '../lib/production-final-limit.mjs';
const order={id:'LSX',processes:['A-CUT','A-PACKING','A-FINAL']},at='2026-10-29T09:00:00+07:00';
const report=(stage,quantity,extra={})=>({transitId:'LSX',stageName:stage,stageQuantity:quantity,completedAt:at,reviewStatus:'Chờ kiểm tra',...extra});
const run=(reports,quantity,entries=[])=>assertFinalExitLimit(order,reports,[...entries,{stage:'A-FINAL',quantity}],at);
test('Packing 500 blocks Final 1000 but permits 500',()=>{const rs=[report('CUT',1000),report('PACKING',500)];assert.throws(()=>run(rs,1000),/PACKING đã xuất 500.*tối đa 500/);assert.doesNotThrow(()=>run(rs,500));});
test('cumulative Final uses remaining allowance and checks every preceding stage',()=>{assert.throws(()=>run([report('CUT',600),report('PACKING',1000),report('FINAL',500)],200),/CUT đã xuất 600.*tối đa 100/);});
test('cancelled, voided, returned, future and other-order exits cannot supply Final',()=>{for(const extra of [{cancelled:true},{voided:true},{reviewStatus:'Cần điều chỉnh'},{reviewStatus:'Đã hủy'},{completedAt:'2026-10-30T09:00:00+07:00'},{transitId:'OTHER'}])assert.throws(()=>run([report('CUT',1000),report('PACKING',1000,extra)],1),/PACKING đã xuất 0/);});
test('same atomic exit batch counts preceding stages regardless of entry order',()=>assert.doesNotThrow(()=>run([report('CUT',1000)],1000,[{stage:'PACKING',quantity:1000}])));
test('historical excess is preserved but blocks further Final; unrelated exits are unaffected',()=>{assert.throws(()=>run([report('CUT',1000),report('PACKING',500),report('FINAL',1000)],1),/tối đa 0/);assert.doesNotThrow(()=>assertFinalExitLimit(order,[],[{stage:'PACKING',quantity:500}],at));});
test('stage catalog determines prerequisites; non-Final workflows are unchanged',()=>{assert.doesNotThrow(()=>assertFinalExitLimit({id:'LSX',processes:['FINAL']},[],[{stage:'FINAL',quantity:10}],at));assert.doesNotThrow(()=>assertFinalExitLimit({id:'LSX',processes:['CUT']},[],[{stage:'CUT',quantity:10}],at));});

test('workflow API rejects excessive Final without writes and allows partial exit',async()=>{
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {openDatabase,migrate}=await import('../scripts/local/database.mjs');
 const {mutateProductionWorkflow,readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'final-limit-'))),actor={login:'TEST',isAdmin:true},catalog=[{code:'SKU',processes:['A-PACKING','A-FINAL']}];
 try{await migrate(c.db);const put=(entity,id,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(payload),'TEST',at).run();
 await put('capacity','2026-10-26',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:Array.from({length:7},(_,i)=>({date:new Date(Date.UTC(2026,9,26+i)).toISOString().slice(0,10),working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}))}}]});
 for(const id of ['worker1','worker2'])await put('employees',id,{id,name:id,line:'A',active:true});
 await put('in_transit','LSX',{id:'LSX',planId:'LSX',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:1000,lsxOpenedAt:'2026-10-26',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(action,h,stage,extra)=>mutateProductionWorkflow(c.db,{action,orderId:'LSX',effectiveAt:`2026-10-29T${h}:00+07:00`,stageEntries:[{stage,...extra}],requestIdempotency:crypto.randomUUID()},actor,catalog);
 await send('start','08:00','A-PACKING',{people:['worker1']});await send('complete','09:00','A-PACKING',{quantity:500});
 const backfill={action:'start',orderId:'LSX',requestIdempotency:crypto.randomUUID(),backfill:{mode:'preview',stage:'A-FINAL',from:'2026-10-29T08:00:00+07:00',to:'2026-10-29T09:00:00+07:00',people:['worker2'],quantity:1000}};
 const records=async()=>(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const beforeBackfill=await records();
 for(const mode of ['preview','save'])await assert.rejects(()=>mutateProductionWorkflow(c.db,{...backfill,requestIdempotency:crypto.randomUUID(),backfill:{...backfill.backfill,mode}},actor,catalog),/PACKING đã xuất 500/);
 assert.deepEqual(await records(),beforeBackfill,'rejected preview/save must preserve every business record');
 await send('start','08:00','A-FINAL',{people:['worker2']});const before=(await readProductionWorkflow(c.db,actor,catalog)).reports.length;
 const beforeComplete=await records();
 await assert.rejects(()=>send('complete','09:01','A-FINAL',{quantity:1000}),/PACKING đã xuất 500/);
 assert.deepEqual(await records(),beforeComplete,'rejected live exit must preserve every business record');
 assert.equal((await readProductionWorkflow(c.db,actor,catalog)).reports.length,before);
 const result=await send('complete','09:01','A-FINAL',{quantity:500});assert.equal(result.reports[0].stageQuantity,500);
 }finally{await c.close();}
});

for(const mode of ['preview','save'])test(`backfill ${mode} cannot consume allowance reserved by a later Final exit`,async()=>{
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {openDatabase,migrate}=await import('../scripts/local/database.mjs');
 const {mutateProductionWorkflow,readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'final-limit-'))),actor={login:'TEST',isAdmin:true},catalog=[{code:'SKU',processes:['A-PACKING','A-FINAL']}];
 try{await migrate(c.db);const put=(entity,id,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(payload),'TEST',at).run();
 await put('capacity','2026-10-26',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:Array.from({length:7},(_,i)=>({date:new Date(Date.UTC(2026,9,26+i)).toISOString().slice(0,10),working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}))}}]});
 for(const id of ['worker1','worker2'])await put('employees',id,{id,name:id,line:'A',active:true});
 await put('in_transit','LSX',{id:'LSX',planId:'LSX',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:1000,lsxOpenedAt:'2026-10-26',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(action,h,stage,extra)=>mutateProductionWorkflow(c.db,{action,orderId:'LSX',effectiveAt:`2026-10-29T${h}:00+07:00`,stageEntries:[{stage,...extra}],requestIdempotency:crypto.randomUUID()},actor,catalog);

 await send('start','08:00','A-PACKING',{people:['worker1']});await send('complete','08:30','A-PACKING',{quantity:500});
 await send('start','10:00','A-FINAL',{people:['worker2']});await send('complete','11:00','A-FINAL',{quantity:500});
 const rows=async()=>(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const before=await rows();
 await assert.rejects(()=>mutateProductionWorkflow(c.db,{action:'start',orderId:'LSX',requestIdempotency:crypto.randomUUID(),backfill:{mode,stage:'A-FINAL',from:'2026-10-29T08:30:00+07:00',to:'2026-10-29T09:00:00+07:00',people:['worker2'],quantity:100,confirmedAllocations:[]}},actor,catalog),/PACKING đã xuất 500/);
 assert.deepEqual(await rows(),before,'rejected historical insertion must preserve every business record');
 }finally{await c.close();}
});

test('later Packing supplies later Final while an earlier backfill stays within its own limit',async()=>{
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {openDatabase,migrate}=await import('../scripts/local/database.mjs');
 const {mutateProductionWorkflow,readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'final-limit-'))),actor={login:'TEST',isAdmin:true},catalog=[{code:'SKU',processes:['A-PACKING','A-FINAL']}];
 try{await migrate(c.db);const put=(entity,id,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(payload),'TEST',at).run();
 await put('capacity','2026-10-26',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:Array.from({length:7},(_,i)=>({date:new Date(Date.UTC(2026,9,26+i)).toISOString().slice(0,10),working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}))}}]});
 for(const id of ['worker1','worker2'])await put('employees',id,{id,name:id,line:'A',active:true});
 await put('in_transit','LSX',{id:'LSX',planId:'LSX',lsxCode:'LSX',sku:'SKU',line:'A',lsxQty:1000,lsxOpenedAt:'2026-10-26',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(action,h,stage,extra)=>mutateProductionWorkflow(c.db,{action,orderId:'LSX',effectiveAt:`2026-10-29T${h}:00+07:00`,stageEntries:[{stage,...extra}],requestIdempotency:crypto.randomUUID()},actor,catalog);

 await send('start','08:00','A-PACKING',{people:['worker1']});await send('complete','08:30','A-PACKING',{quantity:500});
 await send('complete','09:30','A-PACKING',{quantity:100});
 await send('start','10:00','A-FINAL',{people:['worker2']});await send('complete','11:00','A-FINAL',{quantity:500});
 const input={action:'start',orderId:'LSX',requestIdempotency:crypto.randomUUID(),backfill:{mode:'preview',stage:'A-FINAL',from:'2026-10-29T08:30:00+07:00',to:'2026-10-29T09:00:00+07:00',people:['worker2'],quantity:100,confirmedAllocations:[]}};
 const preview=await mutateProductionWorkflow(c.db,input,actor,catalog);assert.equal(preview.report.stageQuantity,100);
 const saved=await mutateProductionWorkflow(c.db,{...input,backfill:{...input.backfill,mode:'save'}},actor,catalog);assert.equal(saved.report.stageQuantity,100);
 const state=await readProductionWorkflow(c.db,actor,catalog);assert.equal(state.reports.filter(r=>r.stageName==='A-FINAL').reduce((n,r)=>n+r.stageQuantity,0),600);
 assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 }finally{await c.close();}
});

test('timeline replacement excludes the old report once and removal never fabricates Final supply',()=>{
 const existing=[report('CUT',1000),report('PACKING',500),report('FINAL',400,{id:'replace',completedAt:'2026-10-29T10:00:00+07:00'}),report('FINAL',100,{id:'later',completedAt:'2026-10-29T11:00:00+07:00'})];
 const original=structuredClone(existing),replacementTimeline=existing.filter(r=>r.id!=='replace');
 assert.doesNotThrow(()=>run(replacementTimeline,400));
 assert.throws(()=>run(replacementTimeline,401),/PACKING đã xuất 500/);
 assert.throws(()=>run(existing,400),/PACKING đã xuất 500/,'without removing old report, it is an additional exit');
 assert.deepEqual(existing,original,'validation must not edit or remove existing reports');
});

test('future packing only supplies Final from its own timestamp, including simultaneous exits',()=>{
 const timeline=[report('CUT',1000),report('PACKING',500),report('FINAL',500,{completedAt:'2026-10-29T11:00:00+07:00'})];
 assert.throws(()=>run([...timeline,report('PACKING',100,{completedAt:'2026-10-29T12:00:00+07:00'})],100),/PACKING đã xuất 500/);
 assert.doesNotThrow(()=>run([...timeline,report('PACKING',100,{completedAt:'2026-10-29T11:00:00+07:00'})],100));
 for(const extra of [{cancelled:true},{voided:true},{reviewStatus:'Cần điều chỉnh'},{reviewStatus:'Đã hủy'},{transitId:'OTHER'}])assert.doesNotThrow(()=>run([report('CUT',1000),report('PACKING',500),report('FINAL',500,{completedAt:'2026-10-29T11:00:00+07:00',...extra})],100));
});
