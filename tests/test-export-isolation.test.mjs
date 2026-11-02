import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {configuration,assertLocal,openDatabase,migrate} from '../scripts/local/database.mjs';
import {execFileSync} from 'node:child_process';
import {assertSafeTrackedPaths,assertApprovedBaseline} from './helpers/snapshot-isolation.mjs';
test('TEST rejects remote configuration and cloud credentials',()=>{const c=configuration();assert.equal(c.remote,false);assert.throws(()=>assertLocal({...c,remote:true},{}),/BLOCKED/);assert.throws(()=>assertLocal(c,{CLOUDFLARE_API_TOKEN:'synthetic-test-value'}),/BLOCKED/);});
test('migrations initialize an empty isolated database without business rows or accounts',async()=>{const c=await openDatabase(mkdtempSync(join(tmpdir(),'export-empty-')));try{await migrate(c.db);assert.equal((await c.db.prepare('SELECT count(*) AS n FROM app_records').first()).n,0);await migrate(c.db);assert.equal((await c.db.prepare('SELECT count(*) AS n FROM app_records').first()).n,0);}finally{await c.close();}});
test('approved private source snapshot preserves only declared hosting metadata and approved embedded JSON, never runtime data',()=>{
 const manifest=JSON.parse(fs.readFileSync('SOURCE-TRANSFER-MANIFEST.json','utf8'));
 assert.equal(manifest.format,'ONSPA-SOURCE-TRANSFER-v1');assert.equal(manifest.privateOnly,true);assert.equal(manifest.containsLiveDatabase,false);
 assert.equal(manifest.sourceVersion,807);assert.equal(manifest.sourceCommit,'8b22aa8cc69ab9c7d2e9d2e098ccb8923d88c5fe');
 assert.equal(manifest.destination,'vuhuongduyen/shintung-production-web');
 const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);assertSafeTrackedPaths(paths);
 const hosting='.openai/hosting.json';assertApprovedBaseline(hosting,fs.readFileSync(hosting),manifest);
 assert.deepEqual(JSON.parse(fs.readFileSync(hosting,'utf8')),{project_id:manifest.projectId,d1:'DB',r2:'FILES'});
 for(const file of fs.readdirSync('app').filter(x=>x.endsWith('.json'))){const path='app/'+file,bytes=fs.readFileSync(path);JSON.parse(bytes);assertApprovedBaseline(path,bytes,manifest);}
 assert.equal(fs.readFileSync('.env.example','utf8').split('\n').filter(line=>line.trim()&&!line.trim().startsWith('#')).length,0);
});
test('snapshot guards reject added runtime/credential paths and changed or unlisted JSON',()=>{
 for(const path of ['.env','config/.env.production','.dev.vars','uploads/file.txt','backups/export.sql','.local-data/auth.json','.wrangler/state/db.sqlite','keys/private.pem','private.key','runtime.db','data.dump'])assert.throws(()=>assertSafeTrackedPaths([path]),/Runtime\/credential/);
 assert.doesNotThrow(()=>assertSafeTrackedPaths(['.env.example','.openai/hosting.json','scripts/local/database.mjs','drizzle/0000_initial.sql']));
 const manifest=JSON.parse(fs.readFileSync('SOURCE-TRANSFER-MANIFEST.json','utf8'));
 const path=manifest.files.find(file=>file.path.startsWith('app/')&&file.path.endsWith('.json')).path;
 assert.throws(()=>assertApprovedBaseline(path,Buffer.concat([fs.readFileSync(path),Buffer.from(' ')]),manifest),/Unapproved/);
 assert.throws(()=>assertApprovedBaseline('app/unlisted.json',Buffer.from('{}'),manifest),/Unapproved/);
});
