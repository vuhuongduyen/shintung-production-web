import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {withCorrectionSnapshot} from '../scripts/local/production-correction-snapshot.mjs';
test('comparison of >35 MiB keeps RPC responses and bound arguments small, detects same-size edits, and cleans temporary copies',async()=>{
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'correction-volume-')));
 try{const db=c.db;await migrate(db);const payload=JSON.stringify({padding:'x'.repeat(460000)});
 for(let i=0;i<80;i++)await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_event',String(i).padStart(3,'0'),payload,'TEST','TEST').run();
 let maxArgument=0,maxResponse=0;
 const measured={prepare(sql){const statement=db.prepare(sql);return {bind(...args){maxArgument=Math.max(maxArgument,...args.filter(a=>typeof a==='string').map(a=>Buffer.byteLength(a)));const bound=statement.bind(...args);return {all:async()=>{const result=await bound.all();maxResponse=Math.max(maxResponse,Buffer.byteLength(JSON.stringify(result)));return result;},run:()=>bound.run(),first:()=>bound.first(),_bound:bound};},run:()=>statement.run(),_bound:statement};},batch(items){return db.batch(items.map(i=>i._bound||i));}};
 await withCorrectionSnapshot(measured,"'production_event','production_cursor'",async(records,snapshot)=>{
  assert.equal(records.length,80);await db.prepare("INSERT INTO app_records VALUES('production_cursor','global','{}','TEST','TEST')").run();
  assert.equal((await db.prepare('SELECT '+snapshot.sql+' AS valid').bind(...snapshot.args).first()).valid,1);
  await db.prepare("UPDATE app_records SET payload=replace(payload,'x','y') WHERE entity='production_event' AND record_key='000'").run();
  assert.equal((await db.prepare('SELECT '+snapshot.sql+' AS valid').bind(...snapshot.args).first()).valid,0);
 });
 assert.ok(maxArgument<8192,`argument ${maxArgument}`);assert.ok(maxResponse<600000,`response ${maxResponse}`);assert.equal((await db.prepare('SELECT count(*) AS n FROM _onspa_correction_compare').first()).n,0);
 }finally{await c.close();}
});
