import {actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {clientAuthorizationKey} from '../lib/client-authorization-context.mjs';
import {createReadCache} from '../lib/client-read-cache.mjs';
import {createRefreshCoordinator} from '../lib/client-refresh-coordinator.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function reader(fetch){const exports={};const context={exports,module:{exports},window:{},Headers,Response,Request,URL,fetch,require:n=>n.includes('action-feedback')?actionFeedbackHelpers:n==='react'?{createContext:()=>({})}:n.includes('client-read-cache')?{createReadCache}:{createRefreshCoordinator}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/data-sync.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);return exports;}
test('authorization fingerprint ignores cosmetics/order but detects effective scope changes',()=>{
 const base={authenticated:true,session:{kind:'internal',login:'a',role:'HR',line:'A',grants:['Read SKU','Edit Capacity'],name:'Name'}};
 const key=s=>clientAuthorizationKey({...base,session:{...base.session,...s}});
 assert.equal(key({}),key({name:'Renamed',grants:['Edit Capacity','Read SKU','Read SKU']}));
 for(const s of [{login:'b'},{role:'QLSX'},{line:'B'},{grants:['Read SKU']},{isAdmin:true}])assert.notEqual(key({}),key(s));
 assert.notEqual(key({}),clientAuthorizationKey({authenticated:false}));
});
test('old in-flight response cannot arrive after session invalidation',async()=>{
 const gate=deferred(),r=reader(()=>gate.promise);const pending=r.sharedRead('/api/records');await Promise.resolve();r.clearClientReads('session');gate.resolve(Response.json({old:true}));await assert.rejects(pending,/Phiên/);
});
test('body decoding and cloned responses are fenced after session changes',async()=>{
 const r=reader(async()=>Response.json({old:true}));const response=await r.sharedRead('/api/records'),copy=response.clone();r.clearClientReads('session');await assert.rejects(response.json(),/Phiên/);await assert.rejects(copy.text(),/Phiên/);assert.throws(()=>response.clone(),/Phiên/);
});
test('session change during body decoding rejects decoded old data',async()=>{
 const gate=deferred();const response=new Response('');response.json=()=>gate.promise;const r=reader(async()=>response);const guarded=await r.sessionFetch('/api/test');const pending=guarded.json();r.clearClientReads('session');gate.resolve({old:true});await assert.rejects(pending,/Phiên/);
});
test('mutation invalidation allows current-session mutation response and later fresh reads',async()=>{
 let calls=0;const r=reader(async()=>Response.json({call:++calls}));const saved=await r.sessionFetch('/api/save',{method:'POST'});r.clearClientReads('mutation');assert.deepEqual(await saved.json(),{call:1});const a=await r.sharedRead('/api/records');assert.deepEqual(await a.json(),{call:2});r.clearClientReads('session');const b=await r.sharedRead('/api/records');assert.deepEqual(await b.json(),{call:3});
});
