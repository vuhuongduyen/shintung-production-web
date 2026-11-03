import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionSnapshotCache, ProductionReadCancelled} from '../lib/production-snapshot-cache.mjs';
import {createProductionWorkspaceReader} from '../lib/production-workspace-reader.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve=yes; reject=no; });
  return {promise, resolve, reject};
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const statusError = status => Object.assign(new Error(`HTTP ${status}`), {status});
const workflow = value => ({orders:[{id:`SYNTHETIC-${value}`}], reports:[], events:[], employees:[], actualSchedules:[], approvedSchedules:[], rights:{manager:false,line:null}});

test('forced production refreshes join one pending read; successful snapshot and TTL remain usable', async t => {
  let calls=0, now=100;
  const first=deferred();
  const cache=createProductionSnapshotCache({now:()=>now, ttl:30, fetcher:()=>{calls++; return calls===1 ? first.promise : Promise.resolve(workflow(calls));}});
  const requests=Array.from({length:8},()=>cache.read(true));
  assert.ok(requests.every(request=>request===requests[0]));
  await tick(); assert.equal(calls,1);
  first.resolve(workflow(1));
  const results=await Promise.all(requests);
  assert.ok(results.every(result=>result===results[0]));
  assert.equal(await cache.read(),results[0]); assert.equal(calls,1);
  now=131; await cache.read(); assert.equal(calls,2);
  await cache.read(true); assert.equal(calls,3);
  t.diagnostic('8 simultaneous force refresh callers: 1 network read.');
});

test('post-write generation starts a new read immediately and late pre-write success cannot replace it', async () => {
  let generation=0, calls=0;
  const old=deferred(), fresh=deferred();
  const cache=createProductionSnapshotCache({getGeneration:()=>generation, fetcher:()=> (++calls===1 ? old.promise : fresh.promise)});
  const before=cache.read(true); await tick();
  generation++;
  const after=cache.read(true); await tick(); assert.equal(calls,2);
  const latest=workflow('AFTER-WRITE'); fresh.resolve(latest);
  assert.equal(await after,latest);
  old.resolve(workflow('BEFORE-WRITE'));
  assert.equal(await before,latest); assert.equal(cache.snapshot(),latest); assert.equal(calls,2);
});

test('pre-write error joins current generation without discarding it or retrying twice', async () => {
  let generation=0, calls=0;
  const old=deferred(), fresh=deferred();
  const cache=createProductionSnapshotCache({getGeneration:()=>generation, fetcher:()=> (++calls===1 ? old.promise : fresh.promise)});
  const before=cache.read(); await tick(); generation++;
  const after=cache.read(true); await tick();
  const latest=workflow('CURRENT'); fresh.resolve(latest); await after;
  old.reject(statusError(403));
  assert.equal(await before,latest); assert.equal(cache.snapshot(),latest); assert.equal(calls,2);
});

test('write invalidates a fresh snapshot even when the test clock is at zero', async () => {
  let generation=0, calls=0;
  const cache=createProductionSnapshotCache({now:()=>0, getGeneration:()=>generation, fetcher:async()=>workflow(++calls)});
  const first=await cache.read(); generation++;
  assert.equal(cache.snapshot(),first,'stale data remains available to the already-loaded view');
  assert.notEqual(await cache.read(),first); assert.equal(calls,2);
});

test('a write during a lone pending read returns only the replacement generation', async () => {
  let generation=0, calls=0;
  const old=deferred(); const latest=workflow('LATEST');
  const cache=createProductionSnapshotCache({getGeneration:()=>generation, fetcher:()=> ++calls===1 ? old.promise : Promise.resolve(latest)});
  const before=cache.read(); await tick(); generation++; old.resolve(workflow('OLD'));
  assert.equal(await before,latest); assert.equal(calls,2);
});

test('a failed replacement read propagates once rather than silently issuing a third request', async () => {
  let generation=0, calls=0;
  const old=deferred();
  const cache=createProductionSnapshotCache({getGeneration:()=>generation, fetcher:()=> ++calls===1 ? old.promise : Promise.reject(statusError(503))});
  const before=cache.read(); const failed=assert.rejects(before,{status:503});
  await tick(); generation++; old.resolve(workflow('OLD'));
  await failed; assert.equal(calls,2); assert.equal(cache.snapshot(),null);
});

test('session reset cancels old consumers and a late old-session error cannot clear the new session', async () => {
  for (const fail of [false,true]) {
    let calls=0;
    const old=deferred(); const current=workflow('NEW-SESSION');
    const cache=createProductionSnapshotCache({fetcher:()=> ++calls===1 ? old.promise : Promise.resolve(current)});
    const before=cache.read(); const cancelled=assert.rejects(before,ProductionReadCancelled);
    await tick(); cache.clear(); assert.equal(cache.snapshot(),null);
    assert.equal(await cache.read(),current);
    if (fail) old.reject(statusError(401)); else old.resolve(workflow('OLD-SESSION'));
    await cancelled; assert.equal(cache.snapshot(),current); assert.equal(calls,2);
  }
});

test('transient errors keep the last snapshot; current 401/403 discard it; thrown fetchers do not poison pending', async () => {
  let error=null, calls=0;
  const cache=createProductionSnapshotCache({fetcher:()=>{calls++; if(error)throw error; return Promise.resolve(workflow(calls));}});
  const saved=await cache.read(); error=statusError(503);
  await assert.rejects(cache.read(true),{status:503}); assert.equal(cache.snapshot(),saved);
  for(const status of [401,403]) {
    error=statusError(status); await assert.rejects(cache.read(true),{status}); assert.equal(cache.snapshot(),null);
    error=null; await cache.read(); assert.notEqual(cache.snapshot(),null);
  }
});

test('hidden production workspaces defer initial and event reads, then revalidate once on activation', async () => {
  let calls=0;
  let next=deferred();
  const cache=createProductionSnapshotCache({fetcher:()=>{calls++; return next.promise;}});
  const reader=createProductionWorkspaceReader({read:cache.read});
  await reader.setActive(false);
  for(let i=0;i<8;i++)await reader.refresh(true);
  assert.equal(calls,0); assert.equal(reader.getState().value,null);
  const initial=reader.setActive(true); await tick(); assert.equal(calls,1);
  const first=workflow('INITIAL'); next.resolve(first); await initial;
  assert.equal(reader.getState().value,first);
  await reader.setActive(false); await reader.setActive(true); assert.equal(calls,1,'clean menu switching needs no new request');
  await reader.setActive(false); next=deferred();
  for(let i=0;i<8;i++)await reader.refresh(true);
  assert.equal(calls,1); assert.equal(reader.getState().value,first);
  const reactivated=reader.setActive(true); await tick(); assert.equal(calls,2);
  assert.equal(reader.getState().value,first,'loaded business view stays mounted during background refresh');
  assert.equal(reader.getState().loading,true);
  next.resolve(workflow('CHANGED')); await reactivated;
  assert.equal(reader.getState().value.orders[0].id,'SYNTHETIC-CHANGED');
});

test('initial errors never become an empty business result; explicit retry can load a verified empty result', async () => {
  let fail=true;
  const verifiedEmpty={...workflow('UNUSED'),orders:[]};
  const reader=createProductionWorkspaceReader({read:async()=>{if(fail)throw statusError(503);return verifiedEmpty;}});
  await reader.setActive(true);
  assert.equal(reader.getState().value,null); assert.equal(reader.getState().loading,false); assert.equal(reader.getState().error.status,503);
  fail=false; assert.equal(await reader.refresh(true),true);
  assert.equal(reader.getState().value,verifiedEmpty); assert.equal(reader.getState().error,null);
});

test('background failures keep visible data with an error; auth failures remove business data', async () => {
  const saved=workflow('SAVED'); let error=null;
  const reader=createProductionWorkspaceReader({initial:saved,read:async()=>{if(error)throw error;return saved;}});
  await reader.setActive(true); error=statusError(503); await reader.refresh(true);
  assert.equal(reader.getState().value,saved); assert.equal(reader.getState().error.status,503);
  error=statusError(403); await reader.refresh(true);
  assert.equal(reader.getState().value,null); assert.equal(reader.getState().error.status,403);
});

test('late reader completion cannot overwrite a newer view', async () => {
  const first=deferred(), second=deferred(); let calls=0;
  const reader=createProductionWorkspaceReader({read:()=>++calls===1 ? first.promise : second.promise});
  const initial=reader.setActive(true), refresh=reader.refresh(true);
  const latest=workflow('LATEST'); second.resolve(latest); await refresh;
  first.resolve(workflow('STALE')); await initial;
  assert.equal(reader.getState().value,latest);
});

test('unchanged background response retains the same snapshot and changed data replaces it', async()=>{
 let body=workflow('SAME');
 const cache=createProductionSnapshotCache({fetcher:async()=>structuredClone(body)});
 const first=await cache.read(true);
 assert.equal(await cache.read(true),first);
 body=workflow('NEW');
 assert.notEqual(await cache.read(true),first);
 cache.clear();
 assert.equal(cache.snapshot(),null);
});

test('background full enrichment replaces the light snapshot without clearing the visible board',async()=>{
 const initial=workflow('light'),full=workflow('full');const reader=createProductionWorkspaceReader({initial,read:async()=>initial});await reader.setActive(true);reader.adopt(full);assert.equal(reader.getState().value,full);assert.equal(reader.getState().loading,false);await reader.setActive(false);reader.adopt(workflow('hidden'));assert.equal(reader.getState().value,full);
});

test('open modal holds incoming data, merges refreshes and refreshes once after close',async()=>{
 const gate=deferred();let calls=0;const first={orders:['old']},latest={orders:['new']};const reader=createProductionWorkspaceReader({initial:first,read:()=>{calls++;return calls===1?gate.promise:Promise.resolve(latest);}});
 const flight=reader.setActive(true);await reader.setHeld(true);await reader.refresh(true);await reader.refresh(true);reader.adopt({orders:['full']});gate.resolve({orders:['in-flight']});await flight;assert.equal(calls,1);assert.equal(reader.getState().value,first);assert.equal(reader.getState().loading,false);await reader.setHeld(false);assert.equal(calls,2);assert.equal(reader.getState().value,latest);
});
test('holding a modal never hides authentication revocation',async()=>{
 const gate=deferred();const reader=createProductionWorkspaceReader({initial:{orders:['private']},read:()=>gate.promise});const flight=reader.setActive(true);await reader.setHeld(true);gate.reject(Object.assign(Error('Session expired'),{status:401}));await flight;assert.equal(reader.getState().value,null);assert.equal(reader.getState().error.status,401);
});

test('full snapshot reuse is limited to current generation and TTL',async()=>{
 let generation=0,time=0;const cache=createProductionSnapshotCache({fetcher:async()=>workflow(generation),getGeneration:()=>generation,now:()=>time,ttl:30});
 assert.equal(cache.freshSnapshot(),null);const saved=await cache.read();assert.equal(cache.freshSnapshot(),saved);
 time=31;assert.equal(cache.freshSnapshot(),null);assert.equal(cache.snapshot(),saved);
 await cache.read();generation++;assert.equal(cache.freshSnapshot(),null);cache.clear();assert.equal(cache.snapshot(),null);
});

test('acknowledged save updates held assignments immediately and fences the old read',async()=>{
 const old=deferred(),next=deferred();let calls=0;
 const reader=createProductionWorkspaceReader({initial:workflow('before'),read:()=>++calls===1?old.promise:next.promise});
 const pending=reader.setActive(true);await reader.setHeld(true);
 reader.applyMutation(()=>workflow('saved'));
 assert.equal(reader.getState().value.orders[0].id,'SYNTHETIC-saved');
 old.resolve(workflow('stale'));await pending;
 assert.equal(reader.getState().value.orders[0].id,'SYNTHETIC-saved');
 const refresh=reader.setHeld(false);next.resolve(workflow('verified'));await refresh;
 assert.equal(reader.getState().value.orders[0].id,'SYNTHETIC-verified');
});
