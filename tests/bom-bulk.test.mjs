import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {mutateBomBulk} from '../scripts/local/bom-bulk.mjs';
import {normalizeBomWaste} from '../lib/bom-waste.mjs';
const actor={login:'manager@example.test'};
const fixture=async()=>{const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'bom-bulk-')));await migrate(c.db);const catalog=[];for(const sku of ['SKU-A','SKU-B','SKU-C','MAT-D','MAT-F'])catalog.push({key:sku,payload:{code:sku,name:sku,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng',unit:'CÁI'}});for(const sku of ['SKU-A','SKU-B','SKU-C'])await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('bom',sku,JSON.stringify({sku,name:sku,version:'0001',status:'Đã xác nhận',items:[{code:'MAT-D',name:'Vật tư D',qty:'1',denominator:'1',waste:'2%',expiry:'—'}]}),actor.login,'fixture').run();return {c,catalog};};
const row=async(db,entity,key)=>{const r=await db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();return r?JSON.parse(r.payload):null;};
const count=async(db,entity)=>(await db.prepare('SELECT count(*) AS n FROM app_records WHERE entity=?').bind(entity).first()).n;
const request=(key='BOM-DC-TEST')=>({action:'save',key,expectedRevision:null,skus:['SKU-A','SKU-B','SKU-C'],reason:'Thay vật tư chung',lines:[{code:'MAT-D',newCode:'MAT-F',action:'Thay đổi',newQty:'2',denominator:'1',waste:'3%'}]});
test('BOM waste input means percent and invalid rates are rejected',async()=>{
 assert.equal(normalizeBomWaste('2'),'2%');assert.equal(normalizeBomWaste('0,5'),'0.5%');assert.equal(normalizeBomWaste('2%'),'2%');assert.equal(normalizeBomWaste(''), '');assert.equal(normalizeBomWaste('150'),'150%');assert.equal(normalizeBomWaste('125,5%'),'125.5%');assert.equal(normalizeBomWaste('-1'),null);
 const {c,catalog}=await fixture();try{
  const invalid=request('BAD-PERCENT');invalid.lines[0].waste='-1';
  await assert.rejects(mutateBomBulk(c.db,invalid,actor,catalog),error=>error.status===400&&/Hao hụt/.test(error.message));
  const input=request('PERCENT');input.lines[0].waste='150';
  const saved=await mutateBomBulk(c.db,input,actor,catalog);
  assert.equal(saved.change.lines[0].waste,'150%');
  const confirmed=await mutateBomBulk(c.db,{action:'confirm',key:saved.change.id,expectedRevision:saved.revision},actor,catalog);
  assert.equal(confirmed.boms[0].items.find(item=>item.code==='MAT-F').waste,'150%');
 }finally{await c.close();}
});
test('one bulk document confirms three BOMs atomically, tracks one pending approval and can undo',async()=>{const {c,catalog}=await fixture();try{
 const saved=await mutateBomBulk(c.db,request(),actor,catalog);assert.equal(saved.change.skus.length,3);assert.equal(await count(c.db,'bom_change'),1);assert.equal((await row(c.db,'bom','SKU-A')).items.length,1);
 await assert.rejects(mutateBomBulk(c.db,request('ANOTHER'),actor,catalog),error=>error.status===409);
 const confirmed=await mutateBomBulk(c.db,{action:'confirm',key:saved.change.id,expectedRevision:saved.revision},actor,catalog);assert.equal(confirmed.boms.length,3);
 for(const sku of saved.change.skus){const bom=await row(c.db,'bom',sku);assert.equal(bom.changeDocument,saved.change.id);assert.equal(bom.items.find(x=>x.code==='MAT-F').qty,'2');assert.match(bom.items.find(x=>x.code==='MAT-D').expiry,/^\d{2}\/\d{2}\/\d{4}$/);}
 assert.equal(await count(c.db,'bom_change'),1);assert.equal(await count(c.db,'admin_audit'),5);
 const undone=await mutateBomBulk(c.db,{action:'undo',key:saved.change.id,expectedRevision:confirmed.revision},actor,catalog);assert.equal(undone.change.status,'Đã hủy xác nhận');for(const sku of saved.change.skus){const bom=await row(c.db,'bom',sku);assert.equal(bom.items.length,1);assert.equal(bom.items[0].code,'MAT-D');}
 assert.equal(await count(c.db,'bom_bulk_guard'),0);
 }finally{await c.close();}});
test('stale BOM stops whole confirmation and leaves document pending',async()=>{const {c,catalog}=await fixture();try{
 const saved=await mutateBomBulk(c.db,request(),actor,catalog);const stale=await row(c.db,'bom','SKU-B');stale.items[0].qty='99';await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='SKU-B'").bind(JSON.stringify(stale)).run();const before=await count(c.db,'admin_audit');
 await assert.rejects(mutateBomBulk(c.db,{action:'confirm',key:saved.change.id,expectedRevision:saved.revision},actor,catalog),error=>error.status===409);
 assert.equal((await row(c.db,'bom_change',saved.change.id)).status,'Chờ xác nhận');assert.equal((await row(c.db,'bom','SKU-A')).items.length,1);assert.equal(await count(c.db,'admin_audit'),before);
 }finally{await c.close();}});
test('bulk requires identical source quantities and only one concurrent confirmation wins',async()=>{const {c,catalog}=await fixture();try{
 const different=await row(c.db,'bom','SKU-C');different.items[0].qty='9';await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='SKU-C'").bind(JSON.stringify(different)).run();await assert.rejects(mutateBomBulk(c.db,request(),actor,catalog),error=>error.status===409);assert.equal(await count(c.db,'bom_change'),0);
 different.items[0].qty='1';await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='bom' AND record_key='SKU-C'").bind(JSON.stringify(different)).run();const saved=await mutateBomBulk(c.db,request(),actor,catalog);
 const results=await Promise.allSettled([mutateBomBulk(c.db,{action:'confirm',key:saved.change.id,expectedRevision:saved.revision},actor,catalog),mutateBomBulk(c.db,{action:'confirm',key:saved.change.id,expectedRevision:saved.revision},actor,catalog)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);assert.equal(await count(c.db,'admin_audit'),5);
 }finally{await c.close();}});
test('add and stop use the same three action rules across selected SKUs',async()=>{const {c,catalog}=await fixture();try{
 const added=await mutateBomBulk(c.db,{...request('ADD-MAT-F'),lines:[{code:'MAT-F',action:'Thêm mới',newQty:'3',denominator:'1'}]},actor,catalog);
 const first=await mutateBomBulk(c.db,{action:'confirm',key:added.change.id,expectedRevision:added.revision},actor,catalog);
 assert.equal(first.boms.length,3);assert.equal((await row(c.db,'bom','SKU-A')).items.find(item=>item.code==='MAT-F').qty,'3');
 const stopped=await mutateBomBulk(c.db,{...request('STOP-MAT-D'),lines:[{code:'MAT-D',action:'Ngừng sử dụng'}]},actor,catalog);
 await mutateBomBulk(c.db,{action:'confirm',key:stopped.change.id,expectedRevision:stopped.revision},actor,catalog);
 for(const sku of ['SKU-A','SKU-B','SKU-C'])assert.notEqual((await row(c.db,'bom',sku)).items.find(item=>item.code==='MAT-D').expiry,'—');
 }finally{await c.close();}});
