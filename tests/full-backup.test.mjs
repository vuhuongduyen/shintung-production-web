import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {sourceSyncApi} from '../worker/source-sync.mjs';
import {fullBackupApi} from '../worker/full-backup.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('full backup covers every table, exact SQLite values and all R2 objects; source codes/public rejected, frozen files verified, scoped access and expiry',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const folder=mkdtempSync(resolve(base,'full-backup-')),c=await openDatabase(folder);
 const origin='https://test.invalid',env={DB:c.db,FILES:c.bucket};let cookie='';
 const source=Buffer.from('private-source-zip'),snapshot={metadata:{format:'ONSPA-SOURCE-v1',snapshotId:'a'.repeat(64),projectId:'test-project',size:source.length,sha256:sha(source)},sourceBase64:source.toString('base64')};
 const req=(path,body,token,admin=false)=>new Request(origin+path,{method:body?'POST':'GET',headers:{...(admin?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{origin,'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const call=(path,body,token,admin)=>fullBackupApi(req('/api/full-backup/'+path,body,token,admin),env,snapshot);
 const issue=async(scope)=>{const r=await sourceSyncApi(req('/api/source-sync/devices',{action:'create',label:'ONSPA',scope},null,true),env,snapshot);assert.equal(r.status,200);return r.json();};
 try{
  await migrate(c.db);const p=await passwordRecord('1234');
  await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users','admin',JSON.stringify({login:'admin',active:true,role:'SUPER_ADMIN'}),'admin','fixture'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('admin',p.hash,p.salt,p.iterations,'fixture'),c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_plan','LSX-1',JSON.stringify({name:'Sản phẩm ONSPA',qty:230}),'admin','fixture'),c.db.prepare('CREATE TABLE exact_values(id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT, value BLOB, big INTEGER)'),c.db.prepare("INSERT INTO exact_values(note,value,big) VALUES('O''NSPA\nnewline',X'00FF12',9223372036854775807)")]);
  const r=await siteApi(req('/api/auth/login',{login:'admin',password:'1234'}),env);assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
  const file=Buffer.from('original PDF bytes'),key='attachments/file/example.pdf';await c.bucket.put(key,file,{httpMetadata:{contentType:'application/pdf'},customMetadata:{tag:'original'}});
  await c.db.prepare('INSERT INTO file_objects VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('f1',key,'example.pdf','application/pdf',file.length,'attachments','LSX-1','admin','fixture',sha(file),'ready').run();
  await c.bucket.put('orphan/Windows:invalid?name',Buffer.from('unregistered file'));
  const ordinary=await issue('source'),full=await issue('full-backup'),other=await issue('full-backup');
  assert.equal((await call('start',{},null)).status,403);assert.equal((await call('start',{},ordinary.token)).status,403);
  const cap=await sourceSyncApi(req('/api/source-sync/manifest',null,full.token),env,snapshot);assert.equal((await cap.json()).backupAllowed,true);
  const start=await call('start',{},full.token);assert.equal(start.status,200,await start.clone().text());const manifest=await start.json();
  assert.equal(manifest.fileCount,2);assert.equal(manifest.tableCounts.exact_values,1);assert.equal(manifest.tableCounts.file_objects,1);assert.equal(manifest.tableCounts.auth_accounts,1);assert.ok(manifest.schema.some(t=>t.name==='auth_sessions'));assert.equal(manifest.entries.length,4);
  assert.ok(manifest.entries.some(e=>e.key==='orphan/Windows:invalid?name'&&e.path==='files/00000002.bin'));
  // No arbitrary path or SQL inputs; another valid device cannot download this backup.
  assert.equal((await call('item?id='+manifest.id+'&index=0',null,other.token)).status,404);
  assert.equal((await call('item?id='+manifest.id+'&index=-1',null,full.token)).status,400);
  const sql=Buffer.from(await(await call('item?id='+manifest.id+'&index=0',null,full.token)).arrayBuffer());assert.equal(sha(sql),manifest.entries[0].sha256);
  assert.match(sql.toString(),/9223372036854775807/);assert.match(sql.toString(),/X'00FF12'/);assert.match(sql.toString(),/O''NSPA/);assert.match(sql.toString(),/INSERT INTO sqlite_sequence/);
  writeFileSync(resolve(folder,'database.sql'),sql);
  // Restore exact SQL to independent SQLite and compare schema/counts/values.
  const {spawnSync}=await import('node:child_process');
  const restored=spawnSync('python',['-c',`import sqlite3,json,sys\nc=sqlite3.connect(':memory:')\nc.executescript(open(sys.argv[1]).read())\nassert c.execute('SELECT big FROM exact_values').fetchone()[0]==9223372036854775807\nassert c.execute('SELECT hex(value) FROM exact_values').fetchone()[0]=='00FF12'\nprint(json.dumps({t[0]:c.execute('SELECT count(*) FROM "'+t[0]+'"').fetchone()[0] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()}))`,resolve(folder,'database.sql')],{encoding:'utf8'});assert.equal(restored.status,0,restored.stderr);assert.deepEqual(JSON.parse(restored.stdout),manifest.tableCounts);
  for(let i=1;i<manifest.entries.length;i++){const res=await call('item?id='+manifest.id+'&index='+i,null,full.token);assert.equal(res.status,200);const b=Buffer.from(await res.arrayBuffer());assert.equal(b.length,manifest.entries[i].size);if(manifest.entries[i].sha256)assert.equal(sha(b),manifest.entries[i].sha256);}
  // New business rows after snapshot do not modify frozen SQL.
  await c.db.prepare('INSERT INTO exact_values(note) VALUES(?)').bind('after snapshot').run();assert.equal((await(await call('item?id='+manifest.id+'&index=0',null,full.token)).text()),sql.toString());
  await c.bucket.put(key,Buffer.from('changed original'));
  const index=manifest.entries.findIndex(e=>e.key===key);assert.equal((await call('item?id='+manifest.id+'&index='+index,null,full.token)).status,409);
  assert.equal((await call('complete',{id:manifest.id},full.token)).status,409);
  await c.bucket.put(key,file,{httpMetadata:{contentType:'application/pdf'}});
  assert.equal((await call('complete',{id:manifest.id},full.token)).status,200);
  assert.equal(await c.bucket.get('_onspa_pc_backup/'+manifest.id+'/database.sql'),null);
  const next=await(await call('start',{},other.token)).json();assert.equal(next.fileCount,2); // Transport not recursively backed up.
  const restoredBucket=await openDatabase(mkdtempSync(resolve(base,'full-backup-restored-')));
  try{for(let i=0;i<next.entries.length;i++){const e=next.entries[i];if(e.kind!=='object')continue;const bytes=await(await call('item?id='+next.id+'&index='+i,null,other.token)).arrayBuffer();await restoredBucket.bucket.put(e.key,bytes,{httpMetadata:e.httpMetadata,customMetadata:e.customMetadata});assert.equal(sha(Buffer.from(await(await restoredBucket.bucket.get(e.key)).arrayBuffer())),sha(Buffer.from(bytes)));}assert.equal((await restoredBucket.bucket.list()).objects.length,2);}finally{await restoredBucket.close();}
  await sourceSyncApi(req('/api/source-sync/devices',{action:'revoke',id:full.device.id},null,true),env,snapshot);
  assert.equal((await call('item?id='+manifest.id+'&index=1',null,full.token)).status,403);
  await c.bucket.delete(key);assert.equal((await call('start',{},other.token)).status,500); // Never labels a missing file complete.
 }finally{await c.close();}
});
