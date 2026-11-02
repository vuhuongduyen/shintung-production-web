import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readAllocationScope,saveAllocationScope} from '../scripts/local/production-allocation-scope.mjs';
import {readAllocationQueue,mutateAllocationQueue,allocationSessionGroup,allocationSnapshot} from '../scripts/local/production-allocation-queue.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';

// Minimal non-secret account fields verified by read-only live inspection on
// 2026-10-17. All DB writes in this test target only ephemeral Miniflare storage.
const users=[{login:'dhtin',name:'Đoàn Hữu Tín',department:'QLSX',active:true,role:'USER'},{login:'cnphuong',name:'Chiêng Ngọc Phương',department:'QLSX',active:true,role:'USER'}];
const admin={login:'vthduyen',userId:'vthduyen',isAdmin:true},tin={login:'dhtin',userId:'dhtin',grants:[]},phuong={login:'cnphuong',userId:'cnphuong',grants:[]};
const now='2026-10-17T01:44:20.000Z',at=h=>`2026-10-19T${h}:00:00+07:00`;
const managers=[{userId:'dhtin',group:'C'},{userId:'cnphuong',group:'AB'}];

test('reported identities: missing dedicated scope → explicit Admin save/readback → bounded manager planning flow',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'configured-flow-fixture'}}),db=await mf.getD1Database('DB');
 try{
  await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
  const put=(entity,key,value)=>db.prepare('INSERT OR REPLACE INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'TEST',now).run();
  for(const user of users)await put('users',user.login,user);
  await put('permissions','cnphuong',{active:true,permissions:'TEST existing HR permission',permissionMode:'CUSTOM'});
  await put('admin_audit','prior-general-setup',{action:'USER_PERMISSION_SETUP',at:'2026-10-16T09:27:42.507Z',actor:'vthduyen'});
  const unchanged=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('users','permissions') ORDER BY entity,record_key").all()).results;
  await assert.rejects(()=>readAllocationQueue(db,phuong,now),{status:403});
  assert.equal(await allocationSessionGroup(db,tin),null);
  assert.equal((await readAllocationQueue(db,admin,now)).configurationEnabled,false);
  const before=await readAllocationScope(db,admin);
  assert.equal(before.configuration.enabled,false);assert.deepEqual(before.users.map(u=>u.id).sort(),['cnphuong','dhtin']);
  await assert.rejects(()=>saveAllocationScope(db,{expectedRevision:before.revision,enabled:true,managers},phuong),{status:403});
  await saveAllocationScope(db,{expectedRevision:before.revision,enabled:true,managers},admin);
  const saved=await readAllocationScope(db,admin);
  assert.equal(saved.configuration.enabled,true);assert.deepEqual(saved.configuration.managers,managers);assert.notEqual(saved.revision,before.revision);
  assert.deepEqual((await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('users','permissions') ORDER BY entity,record_key").all()).results,unchanged);
  assert.equal(await allocationSessionGroup(db,tin),'C');assert.equal(await allocationSessionGroup(db,phuong),'AB');
  const adminView=await readAllocationQueue(db,admin,now);assert.equal(adminView.configurationEnabled,true);assert.equal(adminView.readOnly,false);
  for(const e of [{id:'TEST-C1',name:'Fixture C person',line:'C',active:true},{id:'TEST-A1',name:'Fixture A person',line:'A',active:true}])await put('employees',e.id,e);
  const rows=['A','B'].map(line=>{const row=newDailyCapacity('2026-10-19',line,95);row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:[],ot:[]}));return row;});
  await put('capacity','2026-10-19',{schemaVersion:1,week:'2026-10-19',revision:1,rows});
  const source=await readAllocationQueue(db,tin,now),receiver=await readAllocationQueue(db,phuong,now);
  assert.deepEqual(source.candidates.map(p=>p.id),['TEST-C1']);assert.deepEqual(receiver.candidates.map(p=>p.id),['TEST-A1']);
  const sent=await mutateAllocationQueue(db,{action:'offer',reason:'Đổi kế hoạch',sourceLine:'C',employees:['TEST-C1'],effectiveAt:at('08'),endsAt:at('17'),expectedRevision:0,requestId:'realistic-flow-offer-0001'},tin,now);
  const offered=await readAllocationQueue(db,phuong,now);assert.equal(offered.pendingPeople,1);assert.equal(offered.offers[0].canAllocate,true);
  const request={action:'allocate',offerId:sent.offerId,employeeId:'TEST-C1',targetLine:'B',effectiveAt:at('08'),endsAt:at('12'),expectedRevision:1,requestId:'realistic-flow-accept-001'};
  await assert.rejects(()=>mutateAllocationQueue(db,request,tin,now),{status:403});
  await assert.rejects(()=>mutateAllocationQueue(db,request,{...admin,line:'A'},now),{status:403});
  await mutateAllocationQueue(db,request,phuong,now);
  const snapshot=await allocationSnapshot(db);assert.equal(snapshot.records('production_event').length,0);
  assert.ok(snapshot.records('capacity')[0].rows.find(r=>r.line==='B').input.dailyRoster[0].hc.includes('TEST-C1'));
  assert.equal(snapshot.queue.offers[0].allocations[0].planning,true);
  const scope=await readAllocationScope(db,admin);
  await saveAllocationScope(db,{expectedRevision:scope.revision,enabled:false,managers},admin);
  assert.equal(await allocationSessionGroup(db,phuong),null);await assert.rejects(()=>readAllocationQueue(db,phuong,now),{status:403});
 }finally{await mf.dispose();}
});

import {readFileSync} from 'node:fs';
test('broad permission preset no longer embeds the separate manager scope editor',()=>{
 const source=readFileSync(new URL('../components/user-permission-setup.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/ProductionAllocationScope/);
 assert.match(source,/Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX/);
 assert.match(source,/Bổ sung quyền ở đây không lưu phạm vi điều phối/);
});
