import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {importForecastFile,nextForecastMonth} from '../scripts/local/forecast-import.mjs';

const actor={login:'forecast-test@example.com'},clock=()=>new Date('2026-09-26T07:00:00Z');
async function withDb(run){mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const dir=mkdtempSync(resolve(root,'.local-data/tests/forecast-'));const connection=await openDatabase(dir);try{await migrate(connection.db);await run(connection.db);}finally{await connection.close();}}
const rows=[{sku:'102TC12345',name:'Sản phẩm',spec:'80cm',line:'A',group:'Nhóm A',f30:90,f60:120,f90:180,adjustment30D:0,month:'10/2026',sourceReportMonth:'09/2026',applicationMonth:'10/2026'}];
test('September report imports into October from the stored PDF, preserving previous rows and history',()=>withDb(async db=>{
 assert.equal(nextForecastMonth('12/2026'),'01/2027');
 await db.prepare('INSERT INTO file_objects VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('PDF-1','base-forecast/PDF-1/report.pdf','report.pdf','application/pdf',100,'base-forecast','09/2026',actor.login,clock().toISOString(),'checksum','ready').run();
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('forecast','10/2026',JSON.stringify([{sku:'OLD',month:'10/2026'}]),actor.login,'old').run();
 const before=await db.prepare("SELECT payload FROM app_records WHERE entity='forecast' AND record_key='10/2026'").first();
 const expectedRevision=await recordRevision(before.payload);
 const snapshot=async()=>(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const unchanged=await snapshot();
 for(const revision of [{},{expectedRevision:null},{expectedRevision:await recordRevision([{sku:'STALE',month:'10/2026'}])}]){
  await assert.rejects(()=>importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows,...revision},actor,clock),error=>error.status===409);
  assert.deepEqual(await snapshot(),unchanged,'missing or stale revision must not change forecast, history or audit');
 }
 const saved=await importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows,expectedRevision},actor,clock);
 assert.equal(saved.month,'10/2026');assert.equal(saved.count,1);
 assert.equal(JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='forecast' AND record_key='10/2026'").first()).payload)[0].sourceFileId,'PDF-1');
 const audit=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").first()).payload);
 assert.equal(audit.before[0].sku,'OLD');assert.equal(audit.after[0].sku,'102TC12345');
 assert.equal((await importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows},actor,clock)).alreadyImported,true);
 assert.equal((await db.prepare("SELECT count(*) AS total FROM app_records WHERE entity='forecast_import_history'").first()).total,1);
}));
test('rejects wrong application month, invalid rows and missing PDF without changing forecast',()=>withDb(async db=>{
 await assert.rejects(()=>importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows},null,clock),error=>error.status===401);
 await assert.rejects(()=>importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows},actor,clock),error=>error.status===404);
 await db.prepare('INSERT INTO file_objects VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('PDF-1','base-forecast/PDF-1/report.pdf','report.pdf','application/pdf',100,'base-forecast','09/2026',actor.login,clock().toISOString(),'checksum','ready').run();
 await assert.rejects(()=>importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:1,rows:[{...rows[0],month:'09/2026'}]},actor,clock),error=>error.status===400);
 await assert.rejects(()=>importForecastFile(db,{fileId:'PDF-1',reportMonth:'09/2026',declaredSkuCount:2,rows:[...rows,...rows]},actor,clock),error=>error.status===400);
 assert.equal((await db.prepare("SELECT count(*) AS total FROM app_records WHERE entity='forecast'").first()).total,0);
}));
