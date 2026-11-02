import {auditSubmittedInput} from '../lib/audit-submitted-input.mjs';
import {actionFeedbackHelpers,clientActionAuditFixture} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache} from '../lib/client-read-cache.mjs';
import {createRefreshCoordinator} from '../lib/client-refresh-coordinator.mjs';
import {createBackgroundRefresh} from '../lib/client-background-refresh.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('focus and visibility share one refresh, expire completed reads, and retain pending dedupe',async t=>{
 const cache=createReadCache();const gate=deferred();let calls=0,time=0,expirations=0;
 const read=()=>cache.read('sku',()=>{calls++;return gate.promise;});
 const first=read();await Promise.resolve();
 const coordinator=createRefreshCoordinator({now:()=>time,expire:()=>{expirations++;cache.expire();}});
 const requests=[];
 for(let i=0;i<8;i++)coordinator.subscribe(()=>requests.push(read()));
 assert.equal(coordinator.refresh('focus'),true);
 assert.equal(coordinator.refresh('visibility'),false);
 await Promise.resolve();assert.equal(calls,1);assert.equal(expirations,1);
 gate.resolve(Response.json({revision:1}));await Promise.all([first,...requests]);
 time=45000;coordinator.refresh('poll');await Promise.resolve();assert.equal(calls,2);
 await Promise.all(requests);
 t.diagnostic('8 active hooks + paired wake while one GET is pending: 1 network GET, no follow-on read; next 45-second poll fetches fresh data.');
});

test('hidden menus mark dirty without issuing reads, and poll:false still refreshes on focus',()=>{
 let visible=true,activeCalls=0,hiddenDirty=0,noPollCalls=0,expirations=0,time=0;
 const hub=createRefreshCoordinator({now:()=>time,expire:()=>expirations++});
 hub.subscribe(()=>activeCalls++,{active:()=>visible});
 hub.subscribe(()=>hiddenDirty++,{active:()=>false});
 hub.subscribe(()=>noPollCalls++,{poll:false});
 hub.refresh('poll');assert.equal(activeCalls,1);assert.equal(hiddenDirty,1);assert.equal(noPollCalls,0);
 time=2000;hub.refresh('focus');assert.equal(noPollCalls,1);
 const idle=createRefreshCoordinator({expire:()=>expirations++});idle.subscribe(()=>assert.fail('inactive browser must not refresh'),{active:()=>false});
 assert.equal(idle.refresh('poll'),false);assert.equal(expirations,2);
});

test('write invalidation replaces pending reads, while stale completion never overwrites the new cache',async()=>{
 const cache=createReadCache();const old=deferred();let reads=0;
 const before=cache.read('workflow',()=>{reads++;return old.promise;});await Promise.resolve();
 cache.clear();
 const after=await cache.read('workflow',()=>{reads++;return Response.json({revision:2});});
 old.resolve(Response.json({revision:1}));await before;
 assert.equal(reads,2);assert.deepEqual(await after.json(),{revision:2});
 assert.deepEqual(await(await cache.read('workflow',()=>assert.fail('new snapshot must be retained'))).json(),{revision:2});
});

test('background session/status polling coalesces a slow request and paired wake events',async()=>{
 const gate=deferred();let calls=0,time=0;const applied=[];
 const task=createBackgroundRefresh({read:()=>{calls++;return gate.promise;},apply:data=>applied.push(data),now:()=>time});
 const jobs=Array.from({length:20},()=>task.refresh());await Promise.resolve();assert.equal(calls,1);
 time=60000;jobs.push(task.refresh());assert.equal(calls,1);
 gate.resolve('fresh');await Promise.all(jobs);assert.deepEqual(applied,['fresh']);
 task.dispose();await task.refresh();assert.equal(calls,1);
});

test('a real change during a slow status read causes one necessary reread instead of a burst',async()=>{
 const old=deferred(),fresh=deferred();let calls=0;const applied=[];
 const task=createBackgroundRefresh({read:()=>++calls===1?old.promise:fresh.promise,apply:data=>applied.push(data)});
 const pending=task.refresh();for(let i=0;i<10;i++)task.refresh({invalidate:true});
 old.resolve('old');await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.deepEqual(applied,[]);
 fresh.resolve('new');await pending;assert.deepEqual(applied,['new']);
});

test('hidden documents do not poll, disposed account readers cannot publish late responses, errors allow retry',async()=>{
 let visible=false,calls=0;const gate=deferred(),applied=[];
 const task=createBackgroundRefresh({read:()=>{calls++;return gate.promise;},apply:data=>applied.push(data),visible:()=>visible});
 await task.refresh();assert.equal(calls,0);visible=true;const pending=task.refresh();task.dispose();gate.resolve('previous user');await pending;assert.deepEqual(applied,[]);
 let attempts=0;const retry=createBackgroundRefresh({read:async()=>{if(++attempts===1)throw Error('offline');return 'ok';},apply:data=>applied.push(data)});
 await assert.rejects(retry.refresh(),/offline/);await retry.refresh({invalidate:true});assert.deepEqual(applied,['ok']);
});

test('actual shared reader isolates explicit request context, skips POST, and resets account generations',async()=>{
 const exports={},requests=[];
 const context={module:{exports},exports,window:{},crypto,Headers,Response,Request,URL,fetch:(path,init)=>{requests.push({path,init});return Promise.resolve(Response.json({call:requests.length}));},require:name=>name.includes('audit-submitted-input')?{auditSubmittedInput}:name.includes('client-action-audit')?clientActionAuditFixture:name.includes('action-feedback')?actionFeedbackHelpers:name==='react'?{createContext:()=>({})}:name.includes('client-read-cache')?{createReadCache}:{createRefreshCoordinator}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/data-sync.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 const {sharedRead,clearClientReads,clientReadGeneration,subscribeClientReadInvalidation}=exports;
 const [a,b,a2]=await Promise.all([sharedRead('/api/records?entity=sku',{headers:{'x-context':'A'}}),sharedRead('/api/records?entity=sku',{headers:{'x-context':'B'}}),sharedRead('/api/records?entity=sku',{headers:{'X-Context':'A'}})]);
 assert.equal(requests.length,2);assert.deepEqual(await a.json(),await a2.json());assert.notDeepEqual(await b.json(),{call:1});
 await Promise.all([sharedRead('/api/records',{method:'POST'}),sharedRead('/api/records',{method:'POST'})]);assert.equal(requests.length,4);
 const reasons=[];subscribeClientReadInvalidation(reason=>reasons.push(reason));
 clearClientReads('mutation');assert.equal(clientReadGeneration(),1);clearClientReads();assert.equal(clientReadGeneration(),2);assert.deepEqual(reasons,['mutation','session']);
 await sharedRead('/api/records?entity=sku',{headers:{'x-context':'A'}});assert.equal(requests.length,5);
});
