import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowGetFixture,manager,hr} from './helpers/workflow-get-fixture.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {records} from '../scripts/local/database.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {tokenHash} from '../worker/password-auth.mjs';
import {quickLinePermissions} from '../lib/user-permission-profiles.mjs';

test('full/work reads retain quantities, hours and Line privacy and do not write business records',async()=>{
 const c=await workflowGetFixture(20);try{
  const before=await records(c.db);
  for(const actor of [manager,hr,{login:'LINE_A',line:'A',authMode:'quick_line',grants:quickLinePermissions},{login:'LINE_B',line:'B',authMode:'quick_line',grants:quickLinePermissions}]){
   const [full,work]=await Promise.all([readProductionWorkflow(c.db,actor),readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false,stageValidation:true})]);
   assert.deepEqual(full.orders,work.orders);assert.deepEqual(full.reports.map(r=>[r.id,r.reportedQuantity,r.stageQuantity,r.reviewStatus]),work.reports.map(r=>[r.id,r.reportedQuantity,r.stageQuantity,r.reviewStatus]));
   for(const r of full.reports.filter(r=>r.completedAt.startsWith('2026-11-02')))assert.equal(r.hours.total,2);
   if(actor.line==='B'){assert.deepEqual(full.orders,[]);assert.deepEqual(full.reports,[]);assert.ok(full.employees.every(e=>e.line==='B'));}
   if(actor.line==='A')assert.ok(full.employees.every(e=>e.line==='A'));
  }
  assert.deepEqual(await records(c.db),before);
 }finally{await c.close();}
});

test('authenticated work GET omits bulky display copies; full GET restores them, with original storage unchanged',async t=>{
 const c=await workflowGetFixture(8),token='a'.repeat(64),login='SYNTHETIC-ADMIN';try{
  await c.db.batch([
   c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role:'SUPER_ADMIN',active:true}),login,'SYNTHETIC'),
   c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,'unused-synthetic','unused-salt',100000,'SYNTHETIC'),
   c.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),login,1,Date.now()+600000,'SYNTHETIC')
  ]);
  const key='SYNTHETIC-LSX0-report',raw=await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(key).first();
  const report={...JSON.parse(raw.payload),sourceSnapshot:{evidence:'SYNTHETIC '.repeat(50000)},overlapWarnings:['SYNTHETIC '.repeat(20000)],history:[{synthetic:true}]};
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(report),key).run();
  const before=await records(c.db),env={DB:c.db,FILES:c.bucket},request=path=>new Request('https://test.invalid'+path,{headers:{cookie:'__Host-onspa_session='+token}});
  assert.equal((await siteApi(new Request('https://test.invalid/api/production-workflow?view=work'),env)).status,401);
  const workResponse=await siteApi(request('/api/production-workflow?view=work'),env);assert.equal(workResponse.status,200);const workText=await workResponse.text(),work=JSON.parse(workText);
  const fullResponse=await siteApi(request('/api/production-workflow'),env);assert.equal(fullResponse.status,200);const fullText=await fullResponse.text(),full=JSON.parse(fullText);
  const light=work.reports.find(r=>r.id===key),heavy=full.reports.find(r=>r.id===key);
  assert.equal(light.sourceSnapshot,undefined);assert.equal(light.overlapWarnings,undefined);assert.equal(light.history,undefined);assert.deepEqual(heavy.sourceSnapshot,report.sourceSnapshot);assert.deepEqual(heavy.history,report.history);
  assert.equal(light.reportedQuantity,heavy.reportedQuantity);assert.equal(light.hours.total,heavy.hours.total);assert.ok(fullText.length>workText.length*10);
  assert.deepEqual(await records(c.db),before);t.diagnostic(`Synthetic work/full response bytes: ${Buffer.byteLength(workText)}/${Buffer.byteLength(fullText)}`);
 }finally{await c.close();}
});
