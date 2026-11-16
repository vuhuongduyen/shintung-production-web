import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';

test('warehouse alerts join the existing bell and read response without writes or exposing records to an account without read permission',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'warehouse-alerts-')));
 try{
  await migrate(c.db);const env={DB:c.db,FILES:c.bucket},cookies={};
  const call=(path,login,body)=>siteApi(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{...(cookies[login]?{cookie:cookies[login]}:{}),...(body?{origin:'https://test.invalid','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  for(const [login,role]of [['admin','Super Admin'],['other-department','viewer']]){
   const pass=await passwordRecord('1234');await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role,active:true}),login,'SYNTHETIC'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,pass.hash,pass.salt,pass.iterations,'SYNTHETIC')]);
   const result=await call('/api/auth/login',login,{login,password:'1234'});assert.equal(result.status,200);cookies[login]=result.headers.get('set-cookie').split(';')[0];
  }
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('permissions','other-department',JSON.stringify({login:'other-department',active:false,permissions:''}),'SYNTHETIC','2026-01-01').run();
  const p={id:'SX:SYNTHETIC-REPORT',reportId:'SYNTHETIC-REPORT',source:'Sản xuất',sku:'SYNTHETIC-SKU',lsxCode:'SYNTHETIC-LSX',status:'Đã xác nhận',proposedQuantity:100,receivedQuantity:100,withdrawalRequest:{id:'SYNTHETIC-WITHDRAWAL',status:'approved-awaiting-sheet',decidedAt:'2026-01-01T01:00:00Z'},sheetSync:{status:'pending',command:{kind:'withdrawal-approved',id:'SYNTHETIC-WITHDRAWAL',revision:2}}};
  for(const [key,value]of [[p.id,p],['MANUAL',{...p,id:'MANUAL',source:'Thủ công'}],['ERP',{...p,id:'ERP',sheetSync:undefined}]])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('warehouse_in',key,JSON.stringify(value),'SYNTHETIC','2026-01-01').run();
  const before=await records(c.db);
  for(let i=0;i<2;i++){
   const bell=await(await call('/api/pending-approvals','admin')).json(),group=bell.groups.find(g=>g.entity==='warehouse_sync_alerts');
   assert.equal(group.count,1);assert.equal(group.view,'warehouse');assert.equal(group.child,'warehouse-in');assert.equal(group.records[0].key,p.id);
   const detail=await(await call('/api/records?entity=warehouse_in','admin')).json();assert.equal(detail.syncAlerts.length,1);assert.equal(detail.syncAlerts[0].receiptId,p.id);assert.equal(detail.syncAlerts[0].commandRevision,2);assert.ok(detail.syncAlertCheckedAt);
   assert.deepEqual(await records(c.db),before,'polling cannot acknowledge, subtract, approve or modify a record');
  }
  const hidden=await(await call('/api/pending-approvals','other-department')).json();assert.equal(hidden.groups.some(g=>g.entity==='warehouse_sync_alerts'),false);
  assert.equal((await call('/api/records?entity=warehouse_in','other-department')).status,403);
  p.cancelled=true;p.stockExcluded=true;p.withdrawalRequest.status='completed';p.sheetSync={status:'sent',command:null,withdrawalId:'SYNTHETIC-WITHDRAWAL'};
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='warehouse_in' AND record_key=?").bind(JSON.stringify(p),p.id).run();
  const afterAck=await records(c.db),cleared=await(await call('/api/pending-approvals','admin')).json();assert.equal(cleared.groups.some(g=>g.entity==='warehouse_sync_alerts'),false);assert.deepEqual(await records(c.db),afterAck);
 }finally{await c.close();}
});
