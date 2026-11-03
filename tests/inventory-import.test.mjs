import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate} from '../scripts/local/database.mjs';
import {mutateInventoryImport} from '../scripts/local/inventory-import.mjs';

const actor={login:'inventory-test@example.com'},clock=()=>new Date('2026-09-26T06:00:00Z');
const sample=[{sku:'SKU-1',name:'Sản phẩm',warehouse:'TP',qty:10,snapshotAt:'2026-09-26'},{sku:'SKU-1',name:'Sản phẩm',warehouse:'KD',qty:3,snapshotAt:'2026-09-26'}];
async function withDb(run){mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const path=mkdtempSync(resolve(root,'.local-data/tests/inventory-'));const connection=await openDatabase(path);try{await migrate(connection.db);await run(connection.db);}finally{await connection.close();}}

test('upload has no week, cancellation preserves history and cannot be committed',()=>withDb(async db=>{
 await assert.rejects(()=>mutateInventoryImport(db,{action:'upload',sourceFile:'wrong.xlsx',rows:sample},null,clock),error=>error.status===401);
 const {record}=await mutateInventoryImport(db,{action:'upload',sourceFile:'wrong.xlsx',rows:sample},actor,clock);
 assert.equal(record.weekKey,'');assert.equal(record.status,'Chờ chốt');
 await assert.rejects(()=>mutateInventoryImport(db,{action:'commit',key:record.key,week:''},actor,clock),/Chọn tuần/);
 await assert.rejects(()=>mutateInventoryImport(db,{action:'commit',key:record.key,week:'2026-09-22'},actor,clock),/thứ Hai/);
 const cancelled=await mutateInventoryImport(db,{action:'cancel',key:record.key},actor,clock);
 assert.equal(cancelled.record._deleted,true);
 assert.equal((await db.prepare("SELECT count(*) AS total FROM app_records WHERE entity='inventory'").first()).total,1);
 assert.equal((await db.prepare("SELECT count(*) AS total FROM app_records WHERE entity='inventory_snapshot'").first()).total,0);
 await assert.rejects(()=>mutateInventoryImport(db,{action:'commit',key:record.key,week:'2026-09-28'},actor,clock),error=>error.status===404);
}));

test('chốt links the chosen file and week atomically; wrong week and duplicate close are blocked',()=>withDb(async db=>{
 const a=(await mutateInventoryImport(db,{action:'upload',sourceFile:'A.xlsx',rows:sample},actor,clock)).record;
 const b=(await mutateInventoryImport(db,{action:'upload',sourceFile:'B.xlsx',rows:sample},actor,clock)).record;
 const closed=await mutateInventoryImport(db,{action:'commit',key:a.key,week:'2026-09-28'},actor,clock);
 assert.equal(closed.record.weekKey,'2026-09-28');assert.equal(closed.snapshot.sourceImportKey,a.key);assert.equal(closed.snapshot.totalStock,13);
 assert.equal(closed.snapshot.weekEnd,'04/10/2026');
 await assert.rejects(()=>mutateInventoryImport(db,{action:'commit',key:b.key,week:'2026-09-28'},actor,clock),error=>error.status===409);
 await assert.rejects(()=>mutateInventoryImport(db,{action:'cancel',key:a.key},actor,clock),error=>error.status===409);
 const other=await mutateInventoryImport(db,{action:'commit',key:b.key,week:'2026-10-05'},actor,clock);
 assert.equal(other.snapshot.weekKey,'2026-10-05');
 assert.equal((await db.prepare("SELECT count(*) AS total FROM app_records WHERE entity='inventory_snapshot'").first()).total,2);
}));

test('legacy import bound to wrong week may be cancelled before chốt without changing old snapshots',()=>withDb(async db=>{
 const legacy={sourceFile:'old.xlsx',importedAt:'2026-09-25T00:00:00Z',importedBy:'operator',weekKey:'2026-09-21',rows:sample};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('inventory','ERP-OLD',JSON.stringify(legacy),'operator','2026-09-25').run();
 await assert.rejects(()=>mutateInventoryImport(db,{action:'commit',key:'ERP-OLD',week:'2026-09-28'},actor,clock),error=>error.status===409);
 const result=await mutateInventoryImport(db,{action:'cancel',key:'ERP-OLD'},actor,clock);
 assert.equal(result.record.status,'Đã hủy');assert.equal(result.record.weekKey,'2026-09-21');
}));

test('newer mistaken upload for a closed week can be cancelled without touching the snapshot or Engine',()=>withDb(async db=>{
 const original=(await mutateInventoryImport(db,{action:'upload',sourceFile:'used.xlsx',rows:sample},actor,clock)).record;
 const closed=await mutateInventoryImport(db,{action:'commit',key:original.key,week:'2026-09-21'},actor,clock);
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='inventory_snapshot' AND record_key=?")
  .bind(JSON.stringify({...closed.snapshot,status:'Đã được Production_engine sử dụng'}),closed.snapshot.id).run();
 const mistaken={sourceFile:'wrong-week.xlsx',importedAt:'2026-09-26T07:00:00Z',importedBy:actor.login,weekKey:'2026-09-21',rows:sample};
 await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('inventory','ERP-WRONG',JSON.stringify(mistaken),actor.login,mistaken.importedAt).run();
 const cancelled=await mutateInventoryImport(db,{action:'cancel',key:'ERP-WRONG'},actor,clock);
 assert.equal(cancelled.record.status,'Đã hủy');
 assert.equal(JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='inventory_snapshot' AND record_key=?").bind(closed.snapshot.id).first()).payload).status,'Đã được Production_engine sử dụng');
 await assert.rejects(()=>mutateInventoryImport(db,{action:'cancel',key:original.key},actor,clock),error=>error.status===409);
}));


test('SKU stock follows effective weekly close, ignores drafts and survives rereads',()=>withDb(async db=>{
 const {readSkuStock}=await import('../lib/sku-stock.mjs');
 assert.equal((await readSkuStock(db,'SKU-1')).stock,null);
 const first=(await mutateInventoryImport(db,{action:'upload',sourceFile:'first.xlsx',rows:sample},actor,clock)).record;
 assert.equal((await readSkuStock(db,'SKU-1')).snapshot,null);
 const close=await mutateInventoryImport(db,{action:'commit',key:first.key,week:'2026-09-28'},actor,clock);
 assert.deepEqual((await readSkuStock(db,' sku-1 ')).stock,{tpQty:10,kdQty:3,totalQty:13});
 const second=(await mutateInventoryImport(db,{action:'upload',sourceFile:'second.xlsx',rows:[{...sample[0],qty:0}]},actor,clock)).record;
 assert.equal((await readSkuStock(db,'SKU-1')).stock.totalQty,13);
 const latest=await mutateInventoryImport(db,{action:'commit',key:second.key,week:'2026-10-05'},actor,clock);
 assert.deepEqual((await readSkuStock(db,'SKU-1')).stock,{tpQty:0,kdQty:0,totalQty:0});
 assert.equal((await readSkuStock(db,'SKU-1')).snapshot.id,latest.snapshot.id);
 assert.equal((await readSkuStock(db,'MISSING')).stock,null);
 const older=(await mutateInventoryImport(db,{action:'upload',sourceFile:'older.xlsx',rows:sample},actor,clock)).record;
 await mutateInventoryImport(db,{action:'commit',key:older.key,week:'2026-09-21'},actor,()=>new Date('2026-10-09T08:00:00Z'));
 assert.equal((await readSkuStock(db,'SKU-1')).snapshot.id,latest.snapshot.id);
 await db.prepare("UPDATE app_records SET payload=? WHERE entity='inventory_snapshot' AND record_key=?").bind(JSON.stringify({...latest.snapshot,status:'Đã mở chốt'}),latest.snapshot.id).run();
 assert.equal((await readSkuStock(db,'SKU-1')).snapshot.id,close.snapshot.id);
}));
