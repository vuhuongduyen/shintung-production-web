import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionDisplayStore,displayOnlyWorkflow} from '../lib/production-display-store.mjs';
import {productionBoundedRead} from '../lib/production-bounded-read.mjs';
const disk=()=>{let saved=null;return {read:async()=>structuredClone(saved),write:async value=>{saved=structuredClone(value);},clear:async()=>{saved=null;}};};
test('reload restores only after the same verified login and grants; rights are display-only',async()=>{
 const storage=disk(),first=createProductionDisplayStore({storage});await first.activate('A:GRANTS1');
 const value={orders:[{id:'PRIVATE-A'}],rights:{work:true,manager:true,line:'A'}};
 first.put('workflow:work',value);await first.settled();
 const reload=createProductionDisplayStore({storage});assert.equal(reload.get('workflow:work'),null);
 await reload.activate('A:GRANTS1');assert.deepEqual(reload.get('workflow:work'),value);
 const display=displayOnlyWorkflow(reload.get('workflow:work'));assert.equal(display.rights.work,false);assert.equal(display.rights.manager,false);assert.equal(display.rights.line,'A');assert.equal(value.rights.work,true);
 await reload.activate('A:GRANTS2');assert.equal(reload.get('workflow:work'),null);
 await reload.activate('B:GRANTS1');assert.equal(reload.get('workflow:work'),null);
 await reload.activate('A:GRANTS1');assert.equal(reload.get('workflow:work'),null,'latest login replaces the older scope');
});
test('a fresh network response wins over delayed disk hydration, and logout fences restoration',async()=>{
 let release;const storage={read:()=>new Promise(resolve=>{release=resolve;}),write:async()=>{},clear:async()=>{}};
 const cache=createProductionDisplayStore({storage,now:()=>100});const opening=cache.activate('A');await Promise.resolve();
 cache.put('progress',{rows:['NEW']});release({scope:'A',entries:[['progress',{at:99,value:{rows:['OLD']}}]]});await opening;
 assert.deepEqual(cache.get('progress'),{rows:['NEW']});
 const other=createProductionDisplayStore({storage,now:()=>100}),pending=other.activate('A');await Promise.resolve();other.clear();release({scope:'A',entries:[['progress',{at:99,value:{rows:['PRIVATE']}}]]});await pending;assert.equal(other.get('progress'),null);
});
test('storage failure never blocks memory; expiry and bounded storage do not retain history forever',async()=>{
 let now=100;const storage={read:async()=>{throw Error('blocked');},write:async()=>{throw Error('quota');},clear:async()=>{}};
 const cache=createProductionDisplayStore({storage,now:()=>now,ttl:10,limit:2,maxBytes:1000});await cache.activate('A');
 cache.put('1',{rows:[1]});cache.put('2',{rows:[2]});cache.put('3',{rows:[3]});await cache.settled();assert.equal(cache.get('1'),null);assert.deepEqual(cache.get('3'),{rows:[3]});
 now=111;assert.equal(cache.get('3'),null);
});
test('a stalled refresh body has a deadline; late results cannot become the next response',async()=>{
 let release;const old=productionBoundedRead(async()=>({ok:true,status:200,json:()=>new Promise(r=>{release=r;})}),'/read',{},10);
 await assert.rejects(old,/phản hồi quá lâu/);release({rows:['OLD']});
 assert.deepEqual(await productionBoundedRead(async()=>Response.json({rows:['NEW']}),'/read'),{rows:['NEW']});
 await assert.rejects(productionBoundedRead(async()=>new Response('denied',{status:403}),'/read'),{status:403});
});
