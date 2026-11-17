import test from 'node:test';
import assert from 'node:assert/strict';
import {productionReadBatch} from '../worker/production-read-batch.mjs';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {records} from '../scripts/local/database.mjs';

test('request-local batching retains output, binds, first and independent next reads without writes',()=>dailyFixture(async c=>{
 let batches=0;const measured=new Proxy(c.db,{get(db,key){if(key==='batch')return statements=>{batches++;return db.batch(statements);};const value=db[key];return typeof value==='function'?value.bind(db):value;}});
 const db=productionReadBatch(measured),before=await records(c.db),actor={login:'SYNTHETIC',isAdmin:true};
 const actual=await readProductionWorkflow(db,actor,[],{includeDerivedHours:false,includeJournalHours:false});
 const expected=await readProductionWorkflow(c.db,actor,[],{includeDerivedHours:false,includeJournalHours:false});
 assert.deepEqual(actual,expected);assert.ok(batches>0);
 const sql='SELECT payload FROM app_records WHERE entity=? AND record_key=?';
 assert.deepEqual(await db.prepare(sql).bind('in_transit',c.order.id).first(),await c.db.prepare(sql).bind('in_transit',c.order.id).first());
 assert.deepEqual(await records(c.db),before);
 await c.put('employees','FRESH',{name:'Synthetic new record'});
 assert.equal((await db.prepare("SELECT record_key FROM app_records WHERE entity='employees'").all()).results.length,1);
}));

test('one failed batch rejects its queued readers and does not poison subsequent reads',async()=>{
 let fail=true,calls=0;
 const db={prepare(sql){return {sql,bind(...values){return {...this,values};},all(){throw Error('must batch');}};},async batch(statements){calls++;if(fail)throw Error('Synthetic database failure');return statements.map(s=>({results:[{sql:s.sql}]}));}};
 const wrapped=productionReadBatch(db);
 const outcomes=await Promise.allSettled(Array.from({length:3},()=>wrapped.prepare('SELECT 1').all()));
 assert.ok(outcomes.every(r=>r.status==='rejected'));assert.equal(calls,1);fail=false;
 assert.deepEqual(await wrapped.prepare('SELECT 2').all(),{results:[{sql:'SELECT 2'}]});
});
