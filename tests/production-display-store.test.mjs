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
test('another tab changing account or logging out disables old-scope persistence without deleting the new account snapshot',async()=>{
 const listeners=new Set(),sync={subscribe:fn=>listeners.add(fn),publish:scope=>{for(const fn of listeners)fn(scope);}},storage=disk();
 const a=createProductionDisplayStore({storage,sync}),b=createProductionDisplayStore({storage,sync});
 await a.activate('ACCOUNT-A');a.put('rows',{ids:['A']});await a.settled();
 await b.activate('ACCOUNT-B');b.put('rows',{ids:['B']});await b.settled();
 assert.equal(a.active(),false);assert.equal(a.get('rows'),null);
 a.put('rows',{ids:['LATE-RESPONSE']});await a.settled();
 a.clear();await a.settled();assert.equal(b.active(),true,'an old-tab denial cannot log out the latest display scope');
 const reload=createProductionDisplayStore({storage,sync});await reload.activate('ACCOUNT-B');assert.deepEqual(reload.get('rows'),{ids:['B']});
 b.clear();await b.settled();assert.equal(reload.active(),false);assert.equal(reload.get('rows'),null);
 reload.put('rows',{ids:['AFTER-LOGOUT']});await reload.settled();assert.equal(await storage.read(),null);
});
test('a stalled refresh body has a deadline; late results cannot become the next response',async()=>{
 let release;const old=productionBoundedRead(async()=>({ok:true,status:200,json:()=>new Promise(r=>{release=r;})}),'/read',{},10);
 await assert.rejects(old,/phản hồi quá lâu/);release({rows:['OLD']});
 assert.deepEqual(await productionBoundedRead(async()=>Response.json({rows:['NEW']}),'/read'),{rows:['NEW']});
 await assert.rejects(productionBoundedRead(async()=>new Response('denied',{status:403}),'/read'),{status:403});
});
test('a storage operation already waiting when another tab changes scope cannot commit the old snapshot',async()=>{
 const listeners=new Set(),sync={subscribe:fn=>listeners.add(fn),publish:message=>{for(const fn of listeners)fn(message);}};
 let saved=null,delay=false,release;
 const storage={read:async()=>saved,clear:async({scope})=>{if(saved?.scope===scope)saved=null;},write:async(value,{current})=>{if(delay){delay=false;await new Promise(r=>{release=r;});}if(current())saved=structuredClone(value);}};
 const a=createProductionDisplayStore({storage,sync}),b=createProductionDisplayStore({storage,sync});
 await a.activate('A');await a.settled();delay=true;a.put('rows',['OLD']);await Promise.resolve();
 await b.activate('B');b.put('rows',['NEW']);await b.settled();release();await a.settled();
 assert.equal(saved.scope,'B');assert.deepEqual(saved.entries[0][1].value,['NEW']);
});

test('explicit logout hides rows immediately but the latest verified account can restore after signing in again',async()=>{
 const storage=disk(),store=createProductionDisplayStore({storage});await store.activate('A:CURRENT-GRANTS');
 store.put('rows',{ids:['LATEST']});store.put('view:journal',{category:'time',page:2});await store.settled();
 store.suspend();assert.equal(store.get('rows'),null);assert.equal(store.ready(),false);
 store.put('rows',{ids:['LATE-OLD-SESSION']});await store.settled();
 await store.activate('A:CURRENT-GRANTS');assert.deepEqual(store.get('rows'),{ids:['LATEST']});assert.equal(store.get('view:journal').page,2);
 store.suspend();await store.activate('B:CURRENT-GRANTS');assert.equal(store.get('rows'),null);
 await store.activate('A:CURRENT-GRANTS');assert.equal(store.get('rows'),null,'only latest identity remains');
 store.clear();
});

test('display compaction retains historical hours, rate basis, correction history and staffing evidence',async()=>{
 const {compactWorkflowDisplay}=await import('../lib/production-display-store.mjs');
 const original={reports:[{id:'R',hours:{total:12},legacyEarnedBasis:{version:1},rateBasis:{value:.16},history:[{old:1}],sourceSnapshot:{catalog:'x'.repeat(100000),attendance:[{sourceId:'O',destinationId:'D',employees:['PERSON'],unneeded:'x'.repeat(1000)}]}}],events:[{id:'E',hours:{total:1},sourceSnapshot:{catalog:'x'.repeat(100000)}}]};
 const before=JSON.stringify(original),result=compactWorkflowDisplay(original);
 for(const key of ['hours','legacyEarnedBasis','rateBasis','history'])assert.deepEqual(result.reports[0][key],original.reports[0][key]);
 assert.deepEqual(result.reports[0].sourceSnapshot.attendance,[{sourceId:'O',destinationId:'D',employees:['PERSON']}]);
 assert.equal(result.events[0].sourceSnapshot,undefined);assert.equal(JSON.stringify(original),before);assert.ok(JSON.stringify(result).length<1000);
});
