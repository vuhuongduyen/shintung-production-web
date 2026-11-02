import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {normalizeStoredAssy,normalizeAssy} from '../scripts/local/production-assy-normalization.mjs';
test('ASSY alias changes only stage labels and preserves source and accounting',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/assy-')));try{await migrate(c.db);
 const report={id:'erp1',erpStageImport:true,stageCode:'A02',stageName:'A-ASSY 1',startedAt:'2026-10-20T08:00:00+07:00',completedAt:'2026-10-20T17:00:00+07:00',reportedQuantity:0,stageQuantity:2000,hours:{total:24.5},employees:['NV1'],reviewStatus:'Đã xác nhận',sourceRow:{stageName:'A-ASSY 1'}};
 const event={id:'batch',parentBatchId:'ERP-STAGES:source',timeEvents:[{id:'e1',stageCode:'A02',stageName:'A-ASSY 1',effectiveAt:report.startedAt}]};
 for(const [entity,key,payload]of [['production_report','erp1',report],['production_history_import','batch',event]])await c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_at) VALUES(?,?,?,?)').bind(entity,key,JSON.stringify(payload),'2026-10-21T00:00:00Z').run();
 const actor={isAdmin:true,login:'admin'};const p=await normalizeStoredAssy(c.db,{action:'preview'},actor);assert.equal(p.batch.summary.reports,1);assert.equal(p.batch.summary.timeEvents,1);
 await assert.rejects(()=>normalizeStoredAssy(c.db,{action:'save',revision:'wrong'},actor));
 const saved=await normalizeStoredAssy(c.db,{action:'save',revision:p.revision},actor);assert.equal(saved.saved,true);
 const r=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload);assert.deepEqual(r,{...report,stageName:'A-ASSY'});
 const next=await normalizeStoredAssy(c.db,{action:'preview'},actor);assert.equal(next.batch.summary.records,0);
 assert.equal(normalizeAssy({stageName:'B-ASSY 2'}).stageName,'B-ASSY 2');
 await assert.rejects(()=>normalizeStoredAssy(c.db,{action:'preview'},{isAdmin:false}));
 }finally{await c.close();}
});
