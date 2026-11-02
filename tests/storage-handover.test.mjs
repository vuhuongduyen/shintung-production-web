import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync} from 'fflate';
import {openDatabase,migrate,root,sha256} from '../scripts/local/database.mjs';
import {isSuperAdmin,storeFile,storageStatus,createExport} from '../scripts/local/storage.mjs';

test('D1/R2 persistence, Super Admin check, ZIP checksums and isolated restore',async()=>{
 const base=resolve(root,'.local-data/restore-tests');mkdirSync(base,{recursive:true});const dir=mkdtempSync(resolve(base,'storage-test-')),dest=resolve(dir,'restored'),bundle=resolve(dir,'bundle');
 let c=await openDatabase(resolve(dir,'source'));
 try{
  await migrate(c.db);
  assert.equal(await isSuperAdmin(c.db,{login:'admin',role:'local-owner'}),false);
  assert.equal(await isSuperAdmin(c.db,{login:'SETUP_ADMIN',role:'SUPER_ADMIN',isSetupAdmin:true}),true,'backend-issued setup admin may manage setup data without a users row');
  assert.equal(await isSuperAdmin(c.db,{login:'SETUP_ADMIN',role:'USER',isSetupAdmin:true}),false,'setup flag alone never grants admin to a non-admin role');
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users','admin','{"login":"admin","role":"Super Admin","active":true}','TEST',new Date().toISOString()).run();
  assert.equal(await isSuperAdmin(c.db,{login:'admin'}),true);assert.equal(await isSuperAdmin(c.db,null),false);
  const payload='{ "name": "Đơn hàng 中文", "number": 1.25, "_deleted": true }';
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('test_record','only-isolated-test',payload,'TEST',new Date().toISOString()).run();
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const file=await storeFile(c.db,c.bucket,{module:'attachments',name:'Kiểm thử 中文.pdf',recordId:'only-isolated-test',contentType:'application/pdf',base64:pdf.toString('base64')},'admin');
  await c.close();c=await openDatabase(resolve(dir,'source'));
  assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='test_record'").first()).payload,payload);
  assert.equal(sha256(Buffer.from(await(await c.bucket.get(file.object_key)).arrayBuffer())),sha256(pdf));
  assert.deepEqual((await storageStatus(c.db,c.bucket)).problems,[]);
  const result=await createExport(c.db,c.bucket,'full','admin');
  const exportRow=await c.db.prepare('SELECT * FROM backup_exports WHERE id=?').bind(result.id).first();
  const zipped=Buffer.from(await(await c.bucket.get(exportRow.object_key)).arrayBuffer());
  const files=unzipSync(zipped);assert.ok(files['database/schema.sql']);assert.ok(files['database/entities/permissions.json']);assert.ok(files['r2/'+file.object_key]);assert.ok(!Object.keys(files).some(p=>p.startsWith('r2/backups/')));
  for(const [name,bytes]of Object.entries(files)){const out=resolve(bundle,name);assert.ok(out.startsWith(bundle+sep));mkdirSync(dirname(out),{recursive:true});writeFileSync(out,bytes);}
  const manifest=JSON.parse(Buffer.from(files['manifests/backup-manifest.json']).toString());assert.equal(manifest.objects.length,1);
  await c.close();c=null;
  for(const script of ['import-d1.js','upload-r2.js','verify-restore.js']){const r=spawnSync(process.execPath,[resolve(bundle,'restore',script),root,bundle,dest],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  const refuse=spawnSync(process.execPath,[resolve(bundle,'restore/import-d1.js'),root,bundle,dest],{encoding:'utf8'});assert.notEqual(refuse.status,0);
  writeFileSync(resolve(dir,'test-result.json'),JSON.stringify({verified:true,files:1,checksum:sha256(zipped)}));
 }finally{if(c)await c.close();if(!dir.startsWith(base+sep)||!dir.includes('storage-test-'))throw Error('Unsafe cleanup');rmSync(dir,{recursive:true,force:true});}
});
