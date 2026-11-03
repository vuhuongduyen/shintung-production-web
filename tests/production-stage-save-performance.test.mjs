import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';
import {stageValidationPayload} from '../scripts/local/production-stage-read.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {quickLinePermissions} from '../lib/user-permission-profiles.mjs';
import {projectLiveStages} from '../lib/production-stage-live.mjs';
import {mergeProductionSavedResult} from '../lib/production-saved-result.mjs';

test('stage validation drops bulky audit copies on reads only, preserving ERP timeline and quantities',async t=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-read-')));
 try{
  await migrate(c.db);
  const report={id:'ERP',transitId:'O',erpStageImport:true,stageName:'CUT',stageQuantity:50,reportedQuantity:0,employees:['N1'],startedAt:'2026-09-25T08:00:00+07:00',completedAt:'2026-09-25T09:00:00+07:00',pauses:[],hours:{total:1},sourceRow:{employees:['N1']},sourceSnapshot:{audit:'x'.repeat(600000)},overlapWarnings:['x'.repeat(600000)],laborNotes:[{text:'Preserved on disk'}],history:[{version:1}]};
  const history={reports:[report],timeEvents:[{id:'TIME',sourceOperation:'Tạm ngưng'}],scope:{orderIds:['O']},erpStageImport:true};
  for(const [entity,payload] of [['production_report',report],['production_history_import',history]])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,'R',JSON.stringify(payload),'TEST','TEST').run();
  const before=await records(c.db);
  for(const [entity,payload] of [['production_report',report],['production_history_import',history]]){
   const light=(await readRecordPages(c.db,{where:'entity=?',args:[entity],payloadExpression:stageValidationPayload(entity)}))[0];
   const expected=structuredClone(payload),target=entity==='production_report'?expected:expected.reports[0];
   for(const key of ['sourceSnapshot','overlapWarnings','laborNotes','history'])delete target[key];
   assert.deepEqual(JSON.parse(light.payload),expected);
   assert.ok(Buffer.byteLength(light.payload)<Buffer.byteLength(JSON.stringify(payload))/100);
   t.diagnostic(`${entity}: ${Buffer.byteLength(JSON.stringify(payload))} -> ${Buffer.byteLength(light.payload)} bytes for validation`);
  }
  assert.deepEqual(await records(c.db),before,'the original history and audit records are unchanged');
 }finally{await c.close();}
});

test('Quick Line returns committed stage data without a second workflow read, and never returns another Line',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-save-'))),realNow=Date.now;
 try{
  Date.now=()=>Date.parse('2026-09-25T08:15:00+07:00');
  await migrate(c.db);const put=(e,k,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-21').run();
  const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}));
  await put('capacity','2026-09-21',{rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:days}}]});
  for(const id of ['N1','N2'])await put('employees',id,{id,name:id,line:'A',active:true});
  for(const line of ['A','B'])await put('in_transit',line,{id:line,planId:line,lsxCode:line,sku:line,line,lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
  const catalog=['A','B'].map(code=>({code,processes:['CUT','FINAL']})),actor={login:'LINE_A',line:'A',authMode:'quick_line',grants:quickLinePermissions};
  let committed=false,readsAfterCommit=0;
  const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{const result=await target.batch(statements);committed=true;return result;};if(key==='prepare')return sql=>{if(committed&&/^SELECT/.test(sql))readsAfterCommit++;return target.prepare(sql);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
  let client=await readProductionWorkflow(c.db,actor,catalog,{includeDerivedHours:false});
  for(const [action,time,people] of [['start','08:00',['N1']],['add','08:05',['N2']],['complete','08:10',[]]]){
   committed=false;readsAfterCommit=0;
   const expectedStages=Object.fromEntries(Object.entries(projectLiveStages(client.orders,client.reports,client.events)).map(([key,s])=>[key,s.at||null]));
   const result=await mutateProductionWorkflow(db,{action,orderId:'A',effectiveAt:`2026-09-25T${time}:00+07:00`,stageEntries:[{stage:'CUT',people,...(action==='complete'?{quantity:50}:{})}],expectedStages,requestIdempotency:crypto.randomUUID()},actor,catalog);
   assert.equal(readsAfterCommit,0);
   const visible=await readProductionWorkflow(c.db,actor,catalog,{includeDerivedHours:false});
   const json=x=>JSON.parse(JSON.stringify(x));
   for(const event of result.events)assert.deepEqual(json(event),json(visible.events.find(e=>e.id===event.id)));
   for(const report of result.reports)assert.deepEqual(json(report),json(visible.reports.find(r=>r.id===report.id)));
   client=mergeProductionSavedResult(client,result);
   assert.ok(result.events.every(e=>e.line==='A'));
  }
  await assert.rejects(()=>mutateProductionWorkflow(c.db,{action:'start',orderId:'B',effectiveAt:'2026-09-25T08:11:00+07:00',stageEntries:[{stage:'CUT',people:['N1']}],requestIdempotency:crypto.randomUUID()},actor,catalog),/Line/);
  const all=(await records(c.db)).filter(r=>r.entity==='production_event').map(r=>JSON.parse(r.payload));assert.ok(all.every(e=>e.line==='A'));
 }finally{Date.now=realNow;await c.close();}
});
