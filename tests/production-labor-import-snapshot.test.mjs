import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {createLaborImportSnapshot} from '../scripts/local/labor-import-snapshot.mjs';
import {stagedDatabaseSnapshot} from '../worker/backup-snapshot.mjs';
test('transport cleanup only removes expired exact namespace; business backup omits active import transport',()=>dailyFixture(async c=>{
 const old='_onspa_labor_import_'+(Date.now()-90000000)+'_'+'a'.repeat(32),other='_onspa_labor_import_business_data';
 await c.db.prepare(`CREATE TABLE "${old}" (value TEXT)`).run();await c.db.prepare(`CREATE TABLE "${other}" (value TEXT)`).run();
 const snap=await createLaborImportSnapshot(c.db);
 try{
  assert.equal(await c.db.prepare('SELECT name FROM sqlite_master WHERE name=?').bind(old).first(),null);
  assert.ok(await c.db.prepare('SELECT name FROM sqlite_master WHERE name=?').bind(other).first());
  assert.throws(()=>snap.reader.prepare('DELETE FROM app_records'),/read-only/);
  const backup=await stagedDatabaseSnapshot(c.db,c.bucket,'synthetic-labor-transport.sql');
  assert.ok(!backup.schema.some(r=>r.name===snap.name));assert.ok(backup.schema.some(r=>r.name===other));
  const text=await(await c.bucket.get('synthetic-labor-transport.sql')).text();assert.ok(!text.includes(snap.name));
  assert.ok(await c.db.prepare('SELECT name FROM sqlite_master WHERE name=?').bind(snap.name).first());
 }finally{await snap.drop();}
}));

test('two isolates can sweep the same stale table and capture independent snapshots without a lifecycle failure',()=>dailyFixture(async c=>{
 const old='_onspa_labor_import_'+(Date.now()-90000000)+'_'+'b'.repeat(32);await c.db.prepare(`CREATE TABLE "${old}" (value TEXT)`).run();
 let arrivals=0,release;const barrier=new Promise(r=>{release=r;});
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{
  const statement=target.prepare(sql);if(sql!=="SELECT name FROM sqlite_master WHERE type='table'")return statement;
  return {all:async()=>{const rows=await statement.all();if(++arrivals===2)release();await barrier;return rows;}};
 };const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const snapshots=await Promise.all([createLaborImportSnapshot(db),createLaborImportSnapshot(db)]);
 try{assert.notEqual(snapshots[0].name,snapshots[1].name);assert.equal(arrivals,2);
 assert.equal(await c.db.prepare('SELECT name FROM sqlite_master WHERE name=?').bind(old).first(),null);
 assert.deepEqual((await snapshots[0].reader.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,(await snapshots[1].reader.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_labor_reference_snapshot'").first()).n,0);
 }finally{await Promise.all(snapshots.map(s=>s.drop()));}
 assert.equal((await c.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB '_onspa_labor_import_*'").all()).results.length,0);
}));
