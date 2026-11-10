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
