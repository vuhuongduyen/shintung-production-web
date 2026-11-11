import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {readCapacity,mutateCapacity} from '../scripts/local/capacity.mjs';
import {selectTestRoster} from '../lib/capacity-test-roster.mjs';
const week='2027-02-01',ids=['QAOT_DB_A','QAOT_DB_B'],policy={week,line:'B',employeeIds:ids};
const admin={login:'synthetic-test-admin',isAdmin:true},clock=()=>Date.parse('2027-01-01T00:00:00Z');
test('persistent save/reload/confirm preserves directory and other Line; invalid save is atomic',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const path=mkdtempSync(resolve(root,'.local-data/tests/qa-roster-'));const c=await openDatabase(path);
 try{
  await migrate(c.db);
  const entries=ids.map(id=>({id,name:`SYNTHETIC QA OT ${id}`,line:'B',active:false,startDate:week,endDate:'2027-02-02',employmentDatesManaged:true})).concat({id:'UNRELATED_FIXTURE',name:'Unrelated fixture',line:'A',active:true});
  for(const row of entries)await c.db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('employees',?,?,?,?)").bind(row.id,JSON.stringify(row),'fixture','2026-01-01').run();
  const directory=(await c.db.prepare("SELECT * FROM app_records WHERE entity='employees' ORDER BY record_key").all()).results;
  const normal=await readCapacity(c.db,week,admin);assert.equal(normal.testRoster,undefined);
  await c.db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('capacity',?,?,?,?)").bind(week,JSON.stringify({schemaVersion:1,week,revision:0,rows:normal.rows}),'fixture','2026-01-01').run();
  const initial=await readCapacity(c.db,week,admin,policy);assert.deepEqual(initial.testRoster,policy);
  const row=initial.rows.find(r=>r.line==='B'),input=selectTestRoster(row,initial.employees,policy,ids);input.dailySchedule.forEach((d,i)=>{d.working=i===0;d.ot=i===0;});input.dailyRoster.forEach((r,i)=>{r.hc=i===0?[...ids]:[];r.ot=i===0?[...ids]:[];});
  const save=await mutateCapacity(c.db,{action:'save',week,revision:0,lines:['B'],inputs:{B:input}},admin,clock,policy);
  assert.equal(save.revision,1);assert.deepEqual(save.testRoster,policy);
  const reloaded=await readCapacity(c.db,week,admin,policy);assert.deepEqual(reloaded.rows[0],initial.rows[0]);assert.deepEqual(reloaded.rows[1].input.dailyRoster,input.dailyRoster);
  const bytes=await c.db.prepare("SELECT payload FROM app_records WHERE entity='capacity' AND record_key=?").bind(week).first();
  const bad=structuredClone(input);bad.dailyRoster[1].savedHc=['UNRELATED_FIXTURE'];
  await assert.rejects(mutateCapacity(c.db,{action:'save',week,revision:1,lines:['B'],inputs:{B:bad}},admin,clock,policy),/ngoài phạm vi/);
  assert.deepEqual((await c.db.prepare("SELECT payload FROM app_records WHERE entity='capacity' AND record_key=?").bind(week).first()),bytes);
  await assert.rejects(mutateCapacity(c.db,{action:'save',week,revision:0,lines:['B'],inputs:{B:input}},admin,clock,policy),/người khác/);
  const confirmed=await mutateCapacity(c.db,{action:'confirm',week,revision:1,lines:['B'],noCleaningAcknowledgedLines:['B']},admin,clock,policy);
  assert.equal(confirmed.rows[1].status,'Đã xác nhận');assert.equal(confirmed.rows[1].version,1);assert.deepEqual(confirmed.rows[0],initial.rows[0]);
  assert.deepEqual((await c.db.prepare("SELECT * FROM app_records WHERE entity='employees' ORDER BY record_key").all()).results,directory);
 }finally{await c.close();}
});
