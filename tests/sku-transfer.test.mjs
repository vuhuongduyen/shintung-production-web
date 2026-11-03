import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {skuTransfer} from '../worker/sku-transfer.mjs';
test('SKU transfer preserves cancelled state, restricts destination/admin, rejects stale preview and leaves other records intact',async()=>{
 const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'sku-transfer-')));await migrate(c.db);
 try{const actor={isAdmin:true,login:'admin'},payload={code:'X',name:'x',cancelled:true,confirmation_status:'Đã hủy',mode:'Gia công',line:'—'};
 await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('production_report','KEEP','{"hours":7}','test','now').run();
 const exported=await skuTransfer(c.db,actor,{action:'export'},[{key:'X',payload}],false);
 const body={action:'preview',snapshot:exported.snapshot};
 await assert.rejects(skuTransfer(c.db,{isAdmin:false},body,[],true),e=>e.status===403);
 await assert.rejects(skuTransfer(c.db,actor,body,[],false),e=>e.status===403);
 const preview=await skuTransfer(c.db,actor,body,[],true);
 await assert.rejects(skuTransfer(c.db,actor,{...body,action:'import',revision:'bad'},[],true),e=>e.status===409);
 const saved=await skuTransfer(c.db,actor,{...body,action:'import',revision:preview.revision},[],true);assert.equal(saved.summary.changed,1);
 assert.deepEqual(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='sku' AND record_key='X'").first()).payload),{...payload,revision:1});
 assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload,'{"hours":7}');
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='sku' AND record_key='X'").bind(JSON.stringify({...payload,name:'old',revision:2})).run();
 const existing=[{key:'X',payload:{...payload,name:'old',revision:2}}];
 const next=await skuTransfer(c.db,actor,body,existing,true);
 await skuTransfer(c.db,actor,{...body,action:'import',revision:next.revision},existing,true);
 assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='sku' AND record_key='X'").first()).payload).revision,3);
 const second=await skuTransfer(c.db,actor,body,[{key:'X',payload:{...payload,revision:3}}],true);assert.equal(second.summary.changed,0);
 }finally{await c.close();}
});
