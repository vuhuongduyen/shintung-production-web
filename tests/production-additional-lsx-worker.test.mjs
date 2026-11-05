import test from 'node:test';import assert from 'node:assert/strict';
import {dailyOutputLoopback} from '../scripts/verification/daily-output-loopback.mjs';
import {records} from '../scripts/local/database.mjs';
import {assertRequestAudit} from './helpers/rejected-request-audit.mjs';

test('built Worker scopes additional LSX to KHSX, replays uncertain creation and keeps output/warehouse proposals separate',async()=>{
 const qa=await dailyOutputLoopback();try{
  const origin=new URL(qa.url).origin,cookies={};
  for(const name of ['QA_KHSX','QA_HR','QA_QLSX']){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({login:name,password:qa.password})});assert.equal(r.status,200);cookies[name]=r.headers.get('set-cookie').split(';')[0];}
  const line=await fetch(origin+'/api/auth/line-login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({line:'A'})});assert.equal(line.status,200);cookies.LINE_A=line.headers.get('set-cookie').split(';')[0];
  const get=async(path,name='QA_KHSX')=>{const r=await fetch(origin+path,{headers:{cookie:cookies[name]}});assert.equal(r.status,200);return r.json();};
  const post=async(path,body,name='QA_KHSX')=>{const response=await fetch(origin+path,{method:'POST',headers:{cookie:cookies[name],origin,'content-type':'application/json'},body:JSON.stringify(body)});return {response,status:response.status,body:await response.clone().json()};};
  const invoke=async(path,input,name)=>{const r=await post(path,input,name);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  let plan=await get('/api/production-plan?week=2026-11-02');
  const close={action:'close',week:'2026-11-02',revision:plan.revision,ids:['SYNTHETIC-QA-PLAN'],edits:{'SYNTHETIC-QA-PLAN':{start:'2026-11-02',end:'2026-11-02'}}},warning=await post('/api/production-plan',close);assert.equal(warning.status,409);assert.equal(warning.body.error,'dailyCapacityConfirmation');const capacity=JSON.parse(warning.body.details.find(d=>d.id==='dailyCapacity').reason);assert.ok(capacity.warnings.length);plan=await invoke('/api/production-plan',{...close,dailyCapacityAck:capacity.token});
  await invoke('/api/production-plan',{action:'transfer',week:'2026-11-02',revision:plan.revision,ids:['SYNTHETIC-QA-PLAN']});
  const find=async id=>(await get('/api/in-transit')).rows.find(r=>r.id===id);
  let source=(await get('/api/in-transit')).rows.find(r=>r.planRowId==='SYNTHETIC-QA-PLAN');assert.ok(source);
  await invoke('/api/in-transit',{action:'draft-lsx',id:source.id,expectedRevision:source.revision,changes:{lsxCode:'SYNTHETIC-WORKER-SOURCE',lsxQty:40,lsxOpenedAt:'2026-11-02'}});
  source=await find(source.id);await invoke('/api/in-transit',{action:'sync',id:source.id,expectedRevision:source.revision});source=await find(source.id);
  const output=(order,quantity)=>({action:'daily-output',orderId:order.id,expectedOrderRevision:order.revision,quantity,productionDate:'2026-11-04',productionLocalDateTime:'2026-11-04T09:00',requestIdempotency:crypto.randomUUID()});
  const first=await invoke('/api/production-workflow',output(source,20),'LINE_A'),rawSource=await qa.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(source.id).first();
  const input={action:'add-lsx',id:source.id,line:'A',planStart:'2026-11-04',planEnd:'2026-11-06',priority:'THƯỜNG',sequence:2,requestIdempotency:crypto.randomUUID()};
  for(const role of ['QA_HR','QA_QLSX','LINE_A']){const before=await records(qa.db),r=await post('/api/in-transit',input,role);assert.equal(r.status,403);await assertRequestAudit({before,after:await records(qa.db),response:r.response,actorId:role,route:'/api/in-transit',body:input});}
  const noKey={...input};delete noKey.requestIdempotency;const beforeMissing=await records(qa.db),missing=await post('/api/in-transit',noKey);assert.equal(missing.status,422);await assertRequestAudit({before:beforeMissing,after:await records(qa.db),response:missing.response,actorId:'QA_KHSX',route:'/api/in-transit',body:noKey});
  const created=await invoke('/api/in-transit',input);assert.equal(created.row.pendingReportQty,0);assert.equal(created.row.completedQty,0);assert.equal(created.row.lsxCode,'');assert.equal(created.row.lsxQty,null);assert.equal(created.row.planId,source.planId);assert.deepEqual(created.row.planLeadtimeBasis,source.planLeadtimeBasis);
  // Deliberately discard the success body at the UI boundary; the same attempt
  // must resolve to the original record even when HTTP response delivery is lost.
  const beforeRetry=await records(qa.db),retried=await post('/api/in-transit',input);assert.equal(retried.status,200);assert.equal(retried.body.row.id,created.row.id);assert.equal(retried.body.replayed,true);
  await assertRequestAudit({before:beforeRetry,after:await records(qa.db),response:retried.response,replayed:true,actorId:'QA_KHSX',route:'/api/in-transit',body:input});
  const beforeConflict=await records(qa.db),changed={...input,sequence:3},conflict=await post('/api/in-transit',changed);assert.equal(conflict.status,409);await assertRequestAudit({before:beforeConflict,after:await records(qa.db),response:conflict.response,actorId:'QA_KHSX',route:'/api/in-transit',body:changed});
  let extra=await find(created.row.id);await invoke('/api/in-transit',{action:'draft-lsx',id:extra.id,expectedRevision:extra.revision,changes:{lsxCode:'SYNTHETIC-WORKER-EXTRA',lsxQty:60,lsxOpenedAt:'2026-11-04'}});extra=await find(extra.id);await invoke('/api/in-transit',{action:'sync',id:extra.id,expectedRevision:extra.revision});extra=await find(extra.id);
  const saved=await invoke('/api/production-workflow',output(extra,30),'LINE_A');assert.equal(saved.report.rateBasis.value,.2);assert.equal(saved.report.legacyCompletedBaseline,0);assert.equal(saved.report.hours,undefined);assert.equal(saved.report.stageName,undefined);
  await invoke('/api/production-report',{action:'review',reportId:saved.report.id,approve:true,expectedVersion:1,delayReason:'Synthetic Worker delayed review'},'QA_QLSX');
  source=await find(source.id);extra=await find(extra.id);assert.equal(source.pendingReportQty,20);assert.equal(source.completedQty,0);assert.equal(extra.completedQty,30);assert.equal(extra.pendingReportQty,0);assert.deepEqual(await qa.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(source.id).first(),rawSource);
  const all=await records(qa.db),warehouse=all.filter(r=>r.entity==='warehouse_in').map(r=>JSON.parse(r.payload)),sourceReport=all.find(r=>r.entity==='production_report'&&r.record_key===first.report.id);assert.equal(JSON.parse(sourceReport.payload).reviewStatus,'Chờ kiểm tra');assert.equal(warehouse.filter(r=>r.reportId===first.report.id).length,0);const proposals=warehouse.filter(r=>r.reportId===saved.report.id);assert.equal(proposals.length,1);assert.equal(proposals[0].proposedQuantity,30);assert.equal(proposals[0].receivedQuantity,null);assert.equal(qa.outboundBlocked(),0);
 }finally{await qa.close();}
});
