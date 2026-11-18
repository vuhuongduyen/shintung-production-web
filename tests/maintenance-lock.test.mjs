import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {maintenanceLock,maintenanceCode} from '../worker/maintenance-lock.mjs';
const origin='https://sanxuat.shintung-vn-4458.chatgpt.site';
test('maintenance blocks every business mutation before authentication, audit or storage', async()=>{
  for(const path of ['/api/production-workflow','/api/production-report','/api/production-correction','/api/warehouse-confirm','/api/warehouse-sheet/bridge','/api/in-transit','/api/capacity','/api/labor-hours','/api/records','/api/active-viewers','/api/environment-refresh','/api/order-transfer','/api/source-sync/devices','/unknown']) {
    for(const method of ['POST','PUT','PATCH','DELETE']) {
      const response=maintenanceLock(new Request(origin+path,{method}));
      assert.equal(response.status,423,path+' '+method);
      assert.equal((await response.json()).code,maintenanceCode);
      assert.equal(response.headers.get('Cache-Control'),'no-store');
    }
  }
});
test('maintenance leaves authenticated readback and existing scoped backup handler in charge',()=>{
  for(const path of ['/api/active-viewers','/api/records?entity=warehouse_in','/api/full-backup/item?id=fixture&index=0','/api/source-sync/manifest'])for(const method of ['GET','HEAD'])assert.equal(maintenanceLock(new Request(origin+path,{method})),null);
  for(const path of ['/api/full-backup/start','/api/full-backup/complete'])assert.equal(maintenanceLock(new Request(origin+path,{method:'POST'})),null);
  for(const path of ['/api/full-backup/start/','/api/full-backup/start-extra','/api/full-backup/restore'])assert.equal(maintenanceLock(new Request(origin+path,{method:'POST'})).status,423);
});
test('maintenance page never mounts business UI or scripts and HEAD is empty',async()=>{
  const response=maintenanceLock(new Request(origin+'/'));
  assert.equal(response.status,503);const html=await response.text();assert.match(html,/đóng tab/);assert.doesNotMatch(html,/<script|fetch\(|setInterval/);
  assert.equal(await maintenanceLock(new Request(origin+'/',{method:'HEAD'})).text(),'');
});
test('entry applies lock before every request handler, without adding migrations or bindings',()=>{
  const source=readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('async fetch(request: Request'));
  const lock=body.indexOf('maintenanceLock(request, env)');assert.ok(lock>=0);
  for(const call of ['productionCutover(request','environmentRefresh(request','orderTransfer(request','fullBackupApi(request','sourceSyncApi(request','siteApi(request','handler.fetch(request'])assert.ok(body.indexOf(call)>lock,call);
  const hosting=JSON.parse(readFileSync(new URL('../.openai/hosting.json',import.meta.url),'utf8'));assert.equal(hosting.project_id,'appgprj_6a8f9b8b6bc48191b07d8293bcb8402a');assert.equal(hosting.d1,'DB');assert.equal(hosting.r2,'FILES');
});
test('maintenance only delegates exact activation routes and explicit opening, failing closed otherwise',()=>{
  for(const value of [undefined,'','false','OPEN','locked'])assert.equal(maintenanceLock(new Request(origin+'/api/production-report',{method:'POST'}),{ONSPA_MAINTENANCE_MODE:value}).status,423);
  assert.equal(maintenanceLock(new Request(origin+'/api/production-report',{method:'POST'}),{ONSPA_MAINTENANCE_MODE:'open'}),null);
  assert.equal(maintenanceLock(new Request(origin+'/api/main-quantity-activation',{method:'POST'})),null);
  assert.equal(maintenanceLock(new Request(origin+'/_admin/quantity-activation')),null);
  for(const path of ['/api/main-quantity-activation/','/api/main-quantity-activation-extra','/_admin/quantity-activation'])assert.equal(maintenanceLock(new Request(origin+path,{method:'POST'})).status,423);
});
test('maintenance delegates only normal password sign-in, not credential setup or business writes',()=>{
  assert.equal(maintenanceLock(new Request(origin+'/api/auth/login',{method:'POST'})),null);
  for(const path of ['/api/auth/login/','/api/auth/login-extra','/api/auth/activate','/api/auth/setup-admin','/api/auth/admin/password','/api/auth/line-login','/api/source-sync/devices','/api/production-report'])assert.equal(maintenanceLock(new Request(origin+path,{method:'POST'})).status,423,path);
  for(const method of ['PUT','PATCH','DELETE'])assert.equal(maintenanceLock(new Request(origin+'/api/auth/login',{method})).status,423);
});
