import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {confirmSelectedWarehouse} from '../worker/warehouse-confirm.mjs';
test('warehouse selected confirmation checks menu rights, revision, selected scope and duplicates',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'warehouse-selected-test'}});
 try{
  const db=await mf.getD1Database('DB');
  await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
  for(const id of ['one','two','three'])await db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('warehouse_in',id,JSON.stringify({source:'Sản xuất',status:'Chờ xác nhận',proposedQuantity:100,sku:id}),'sx','old').run();
  const kho={login:'ltphong',grants:['Quản lý kho / Nhập kho / Xác nhận']};
  const body={action:'preview',ids:['one','two','one']};
  await assert.rejects(()=>confirmSelectedWarehouse(db,body,{login:'viewer',grants:['Quản lý kho / Nhập kho / Xem']}),{status:403});
  await assert.rejects(()=>confirmSelectedWarehouse(db,body,{login:'other',grants:['Quản lý kho / Xuất kho / Xác nhận']}),{status:403});
  const preview=await confirmSelectedWarehouse(db,body,kho);assert.equal(preview.receipts.length,2);
  await assert.rejects(()=>confirmSelectedWarehouse(db,{...body,action:'confirm',revision:'stale',receivedAsProposed:true},kho),{status:409});
  await assert.rejects(()=>confirmSelectedWarehouse(db,{...body,action:'confirm',revision:preview.revision},kho),{status:409});
  const result=await confirmSelectedWarehouse(db,{...body,action:'confirm',revision:preview.revision,receivedAsProposed:true},kho);assert.equal(result.confirmed,2);assert.equal(result.ok,true);
  const one=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE record_key='one'").first()).payload);assert.equal(one.confirmedBy,'ltphong');assert.equal(one.receivedQuantity,100);
  const three=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE record_key='three'").first()).payload);assert.equal(three.status,'Chờ xác nhận');
  await assert.rejects(()=>confirmSelectedWarehouse(db,body,kho),{status:409});
  assert.equal((await confirmSelectedWarehouse(db,{action:'preview',ids:['three']},{login:'admin',isAdmin:true})).receipts.length,1);
  await assert.rejects(()=>confirmSelectedWarehouse(db,{action:'preview',ids:['missing']},kho),{status:409});
 }finally{await mf.dispose();}
});
