import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {productionOrderScope,productionOrderPage} from '../scripts/local/production-order-pages.mjs';
import {productionReadBatch} from '../worker/production-read-batch.mjs';
import {records} from '../scripts/local/database.mjs';

test('realistic long order identifiers stay below D1 statement/bind limits with unchanged results',()=>dailyFixture(async c=>{
 const prefix='SYNTHETIC-ORDER-'+('long-id-'.repeat(12));
 for(let i=0;i<501;i++){
  const id=prefix+String(i).padStart(3,'0');
  await c.put('in_transit',id,{...c.order,id,lsxCode:id,planId:id,line:'A',completedQty:1000,actualCompletedAt:'2026-11-02'});
 }
 const stored=await records(c.db);let maxSqlBytes=0,maxBindings=0,batches=0;
 const limited=new Proxy(c.db,{get(db,key){
  if(key==='batch')return statements=>{batches++;return db.batch(statements);};
  if(key==='prepare')return sql=>{
   const bytes=Buffer.byteLength(sql);maxSqlBytes=Math.max(maxSqlBytes,bytes);
   assert.ok(bytes<=100000,`D1 statement limit exceeded: ${bytes}`);
   const statement=db.prepare(sql);
   return new Proxy(statement,{get(target,method){
    if(method==='bind')return (...values)=>{maxBindings=Math.max(maxBindings,values.length);assert.ok(values.length<=100);return target.bind(...values);};
    const value=target[method];return typeof value==='function'?value.bind(target):value;
   }});
  };
  const value=db[key];return typeof value==='function'?value.bind(db):value;
 }});
 const query=new URLSearchParams('field=Trạng thái&status=completed&page=51'),actor={login:'SYNTHETIC',isAdmin:true};
 const actual=await productionOrderPage(productionReadBatch(limited),actor,query);
 assert.equal(actual.total,501);assert.equal(actual.orders.length,1);assert.equal(actual.orders[0].id,prefix+'500');
 assert.ok(maxSqlBytes<30000);assert.ok(maxBindings<=10);assert.ok(batches>0);
 assert.deepEqual(await records(c.db),stored);
 console.log('Bound scope maximum SQL bytes / parameters:',maxSqlBytes,maxBindings);
}));

test('scoped bound queries preserve caller parameters, first/all, rebinding and read-only boundary',()=>dailyFixture(async c=>{
 const scope=productionOrderScope(c.db,[c.order]);
 const statement=scope.prepare('SELECT record_key FROM app_records WHERE entity=? AND record_key=?');
 const bound=statement.bind('in_transit',c.order.id);
 assert.equal(await bound.first('record_key'),c.order.id);
 assert.equal((await bound.all()).results[0].record_key,c.order.id);
 assert.equal(await bound.bind('in_transit','OTHER-LSX').first(),null);
 assert.equal(await bound.first('record_key'),c.order.id);
 assert.throws(()=>scope.prepare("DELETE FROM app_records"),/chỉ cho phép đọc/);
 assert.throws(()=>scope.prepare("WITH x AS (SELECT 1) DELETE FROM app_records"),/chỉ cho phép đọc/);
}));
