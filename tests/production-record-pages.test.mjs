import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {readRecordPages} from '../scripts/local/production-record-pages.mjs';

test('large key windows keep byte-bounded payload pages complete and reduce database round trips',async t=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-pages-')));
 try{
  await migrate(c.db);
  const expected=Array.from({length:1500},(_,i)=>({entity:'production_event',record_key:String(i).padStart(5,'0'),payload:JSON.stringify({id:i,note:'x'.repeat(1024)})}));
  await c.db.batch(expected.map(r=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(r.entity,r.record_key,r.payload,'TEST','2026-10-31')));
  let calls=0,pages=0,active=0,maxActive=0;
  const db={prepare(sql){const statement=c.db.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {async all(){calls++;const r=await bound.all();if(!sql.includes('length(CAST')){active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;pages++;assert.ok(r.results.reduce((n,row)=>n+Buffer.byteLength(row.payload),0)<=512*1024);}return r;}};}};}};
  const rows=await readRecordPages(db,{where:'entity=?',args:['production_event']});
  assert.deepEqual(rows.map(({entity,record_key,payload})=>({entity,record_key,payload})),expected);
  assert.equal(calls,5);assert.ok(pages>=3);assert.ok(maxActive>1&&maxActive<=3);
  t.diagnostic(`1500 records: ${calls} database calls; prior 100-row algorithm required 31. Same 512 KiB payload cap.`);
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event','99999',JSON.stringify({note:'x'.repeat(600*1024)}),'TEST','2026-10-31').run();
  assert.equal((await readRecordPages(c.db,{where:'entity=?',args:['production_event']})).length,1501);
  assert.deepEqual(await readRecordPages(c.db,{where:'entity=?',args:['missing']}),[]);
 }finally{await c.close();}
});
