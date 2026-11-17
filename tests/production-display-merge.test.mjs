import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeProductionDisplay} from '../lib/production-display-merge.mjs';
import {createProductionDisplayStore} from '../lib/production-display-store.mjs';
const entry=(key,at,value)=>[key,{at,value}];
test('stale tab writes preserve newer entries and other menus within the same verified scope',async()=>{
 let saved=null,time=100;const options=()=>({now:time});
 const storage={read:async()=>structuredClone(saved),write:async(v,{current,changed})=>{if(current())saved=mergeProductionDisplay(saved,structuredClone(v),{...options(),changed});},clear:async()=>{saved=null;}};
 const a=createProductionDisplayStore({storage,now:()=>time}),b=createProductionDisplayStore({storage,now:()=>time});
 await a.activate('A:GRANTS');await b.activate('A:GRANTS');
 a.put('workflow:workspace',{rows:['JOURNAL']});a.put('view:journal',{page:2});await a.settled();
 time++;b.put('page:work',{rows:['WORK']});await b.settled();
 const reloaded=createProductionDisplayStore({storage,now:()=>time});await reloaded.activate('A:GRANTS');
 assert.deepEqual(reloaded.get('workflow:workspace'),{rows:['JOURNAL']});assert.equal(reloaded.get('view:journal').page,2);assert.deepEqual(reloaded.get('page:work'),{rows:['WORK']});
 b.put('view:journal',{page:3});await b.settled();time++;a.put('other',{rows:[]});await a.settled();
 assert.equal(new Map(saved.entries).get('view:journal').value.page,3,'older inherited entry must not overwrite the newer preference');
});
test('merging never imports a previous account/grants scope and remains bounded and expired',()=>{
 const incoming={scope:'B',entries:[entry('new',99,{rows:['B']})]};
 const result=mergeProductionDisplay({scope:'A',entries:[entry('secret',99,{rows:['A']})]},incoming,{now:100});assert.deepEqual(result,incoming);
 const bounded=mergeProductionDisplay({scope:'B',entries:[entry('expired',1,1),entry('future',101,1),entry('large',98,'x'.repeat(200))]}, {scope:'B',entries:[entry('old',90,1),entry('middle',95,2),entry('new',99,3)]},{now:100,ttl:10,limit:1,maxBytes:150});
 assert.deepEqual(bounded.entries,[entry('new',99,3)]);
});

test('explicit same-millisecond updates win, inherited equal-time entries do not',()=>{
 const saved={scope:'A',entries:[entry('view',100,2)]},incoming={scope:'A',entries:[entry('view',100,3)]};
 assert.equal(new Map(mergeProductionDisplay(saved,incoming,{now:100}).entries).get('view').value,2);
 assert.equal(new Map(mergeProductionDisplay(saved,incoming,{now:100,changed:['view']}).entries).get('view').value,3);
});
