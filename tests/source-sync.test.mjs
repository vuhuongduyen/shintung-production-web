import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {createHash} from 'node:crypto';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {sourceSyncApi} from '../worker/source-sync.mjs';
import {createSourceSnapshot} from '../scripts/source-snapshot.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('snapshot is complete reproducible source with per-file hashes, excludes secrets/local data, installer has no credentials',()=>{
 const s=createSourceSnapshot(root),zip=Buffer.from(s.sourceBase64,'base64'),files=unzipSync(zip),manifest=JSON.parse(strFromU8(files['_ONSPA_SOURCE.json']));
 assert.equal(sha(zip),s.metadata.sha256);assert.equal(Object.keys(files).length,s.metadata.fileCount+1);assert.equal(manifest.snapshotId,s.metadata.snapshotId);
 for(const f of manifest.files){assert.equal(sha(files[f.path]),f.sha256);assert.equal(files[f.path].length,f.size);if(f.path!=='scripts/handoff/safety.mjs')assert.doesNotMatch(f.path,/(^|\/)(\.git\/|\.local-data\/|\.sites-runtime\/|\.env|node_modules\/|backups\/|handoff\/|dist\/)/);}
 assert.ok(files['scripts/handoff/safety.mjs']);assert.ok(files['build/sites-vite-plugin.ts']);assert.ok(files['build/source-sync-plugin.ts']);assert.ok(files['worker/source-sync.mjs']);assert.ok(files['components/production-payroll.tsx']);assert.ok(files['scripts/windows/OnspaSync.ps1']);
 assert.deepEqual(Object.keys(JSON.parse(strFromU8(files['.openai/hosting.json']))).sort(),['d1','project_id','r2']);
 assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshotId);
 assert.equal(createSourceSnapshot(root).metadata.snapshotId,s.metadata.snapshotId);
 const kit=unzipSync(Buffer.from(s.installerBase64,'base64'));assert.deepEqual(Object.keys(kit).sort(),['Cai-dong-bo.cmd','Dong-bo-ngay.cmd','HUONG-DAN.txt','OnspaSync.ps1','Sao-luu-ngay.cmd']);
 const ps=strFromU8(kit['OnspaSync.ps1']);assert.match(ps,/C:\\website onspa/);assert.match(ps,/ConvertFrom-SecureString \$Code/);assert.match(ps,/Start-Sleep -Seconds 900/);assert.match(ps,/Validate-Files \$Current \$Previous/);assert.match(ps,/MaximumRedirection 0/);assert.doesNotMatch(ps,/git pull|GitHub|reset --hard|Set-ExecutionPolicy/);
});
test('device code only downloads private source, expires/revokes with owner access; unauthenticated/public cannot see source',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'source-sync-')));
 const origin='https://test.invalid';const cookies={};const env={DB:c.db,FILES:c.bucket};const snapshot={metadata:{snapshotId:'a'.repeat(64),sha256:'b'.repeat(64),projectId:'project'},sourceBase64:Buffer.from('zip-test').toString('base64'),installerBase64:Buffer.from('kit-test').toString('base64')};
 const req=(path,body,who='admin',token,customOrigin=origin)=>new Request(origin+path,{method:body?'POST':'GET',headers:{...(who?{Cookie:cookies[who]||''}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json',origin:customOrigin}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const call=(path,body,who,token,o)=>sourceSyncApi(req(path,body,who,token,o),env,snapshot);
 try{
  await migrate(c.db);
  for(const [id,role] of [['admin','SUPER_ADMIN'],['viewer','USER']]){
   const p=await passwordRecord('1234');await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',id,JSON.stringify({login:id,active:true,role}),id,'fixture'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(id,p.hash,p.salt,p.iterations,'fixture')]);
   const r=await siteApi(req('/api/auth/login',{login:id,password:'1234'},null),env);assert.equal(r.status,200);cookies[id]=r.headers.get('set-cookie').split(';')[0];
  }
  assert.equal((await call('/api/source-sync/download',null,null)).status,401);
  assert.equal((await call('/api/source-sync/devices',null,'viewer')).status,403);
  assert.equal((await call('/api/source-sync/devices',{action:'create',label:'Máy ONSPA'},'admin',null,'https://bad.invalid')).status,403);
  const issued=await(await call('/api/source-sync/devices',{action:'create',label:'Máy ONSPA'})).json();assert.match(issued.token,/^[a-f0-9]{64}$/);
  const list=await(await call('/api/source-sync/devices')).json();assert.equal(list.devices.length,1);assert.ok(!JSON.stringify(list).includes(issued.token));
  const stored=await c.db.prepare("SELECT payload FROM app_records WHERE entity='source_sync_device'").first();assert.ok(!stored.payload.includes(issued.token));
  assert.equal(await(await call('/api/source-sync/download',null,null,issued.token)).text(),'zip-test');
  assert.equal((await call('/api/source-sync/download',null,null,issued.token)).headers.get('Cache-Control'),'private, no-store');
  assert.equal((await call('/api/source-sync/devices',{action:'create',label:'Forged'},null,issued.token)).status,403);
  assert.equal((await siteApi(req('/api/records?entity=sku',null,null,issued.token),env)).status,401);
  assert.equal((await call('/api/source-sync/devices',{action:'revoke',id:issued.device.id})).status,200);
  assert.equal((await call('/api/source-sync/download',null,null,issued.token)).status,401);
  const again=await(await call('/api/source-sync/devices',{action:'create',label:'Máy mới'})).json();
  await c.db.prepare('UPDATE auth_accounts SET credential_version=2 WHERE login=?').bind('admin').run();
  assert.equal((await call('/api/source-sync/manifest',null,null,again.token)).status,401);
  const d=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='source_sync_device' AND record_key=?").bind(again.device.id).first()).payload);
  await c.db.prepare('UPDATE auth_accounts SET credential_version=1 WHERE login=?').bind('admin').run();d.expiresAt='2000-01-01T00:00:00.000Z';
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='source_sync_device' AND record_key=?").bind(JSON.stringify(d),again.device.id).run();
  assert.equal((await call('/api/source-sync/manifest',null,null,again.token)).status,401);
 }finally{await c.close();}
});
