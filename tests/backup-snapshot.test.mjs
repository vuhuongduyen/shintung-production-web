import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {stagedDatabaseSnapshot} from '../worker/backup-snapshot.mjs';
test('large frozen snapshot uses bounded pages and equal multipart chunks; failed upload cleans staging',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'snapshot-large-')));
 try{
  await migrate(c.db);await c.db.prepare('CREATE TABLE large_fixture(id INTEGER PRIMARY KEY, data TEXT)').run();
  const text='x'.repeat(128*1024);await c.db.batch(Array.from({length:96},(_,i)=>c.db.prepare('INSERT INTO large_fixture VALUES(?,?)').bind(i,text)));
  const sizes=[];let changed=false;
  const bucket={createMultipartUpload:async(...args)=>{const u=await c.bucket.createMultipartUpload(...args);return {uploadPart:async(n,b)=>{sizes.push(b.length);if(!changed){changed=true;await c.db.prepare("UPDATE large_fixture SET data='changed' WHERE id=95").run();}return u.uploadPart(n,b);},complete:p=>u.complete(p),abort:()=>u.abort()};}};
  const result=await stagedDatabaseSnapshot(c.db,bucket,'snapshot.sql');
  assert.equal(result.counts.large_fixture,96);assert.ok(sizes.length>=3);assert.ok(sizes.slice(0,-1).every(n=>n===5*1024*1024));
  const sql=Buffer.from(await(await c.bucket.get('snapshot.sql')).arrayBuffer());assert.equal(sql.length,result.size);assert.equal(createHash('sha256').update(sql).digest('hex'),result.sha256);assert.ok(!sql.toString().includes("'changed'"));
  assert.equal((await c.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB '_onspa_pc_snapshot_*'").all()).results.length,0);
  let aborted=false;
  await assert.rejects(stagedDatabaseSnapshot(c.db,{createMultipartUpload:async()=>({uploadPart:async()=>{throw Error('upload failed');},abort:async()=>{aborted=true;}})},'failed.sql'),/upload failed/);
  assert.equal(aborted,true);assert.equal((await c.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB '_onspa_pc_snapshot_*'").all()).results.length,0);
  assert.equal((await c.db.prepare('SELECT count(*) AS n FROM large_fixture').first()).n,96);
 }finally{await c.close();}
});
