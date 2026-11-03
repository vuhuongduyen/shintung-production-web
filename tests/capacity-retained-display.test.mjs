import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapacitySnapshotCache,CapacityReadCancelled,reconcileCapacityRefresh,validateCapacitySnapshot,validateCapacityLatest} from '../lib/capacity-snapshot-cache.mjs';
const week='2026-10-12',otherWeek='2026-10-19';
const snapshot=(w=week,value='SYNTHETIC')=>({week:w,revision:1,rows:[{week:w,line:'A',input:{value}}],employees:[],permissions:{view:true,edit:true}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const error=status=>Object.assign(new Error(`SYNTHETIC-${status}`),{status});

test('warm opens synchronously reuse only their same-week validated snapshot during slow latest lookup',async()=>{
 let latestSlow=false;const delayed=deferred();let calls=0;
 const cache=createCapacitySnapshotCache({fetchLatest:()=>latestSlow?delayed.promise:Promise.resolve({week}),fetchWeek:async w=>{calls++;return snapshot(w);}});
 await cache.readLatest();const saved=await cache.readWeek(week);latestSlow=true;
 const loading=cache.readLatest(true);await tick();
 assert.equal(cache.latestSnapshot().data.week,week);assert.equal(cache.snapshot(week),saved);assert.equal(cache.snapshot(otherWeek),null);
 assert.equal(calls,1);delayed.resolve({week:otherWeek});await loading;
 assert.equal(cache.latestSnapshot().data.week,otherWeek);assert.equal(cache.snapshot(otherWeek),null,'old rows cannot be relabeled as the newly selected week');
});

test('transient failures retain snapshot/timestamp; verified empty success replaces all old rows',async()=>{
 let now=100,fail=false,empty=false;
 const cache=createCapacitySnapshotCache({now:()=>now,fetchLatest:async()=>({week}),fetchWeek:async()=>{if(fail)throw error(503);return {...snapshot(),rows:empty?[]:snapshot().rows};}});
 const first=await cache.readWeek(week);now=200;fail=true;
 await assert.rejects(cache.readWeek(week,true),{status:503});assert.equal(cache.snapshot(week),first);assert.equal(cache.snapshot(week).updatedAt,100);
 fail=false;empty=true;await cache.readWeek(week,true);assert.deepEqual(cache.snapshot(week).data.rows,[]);assert.equal(cache.snapshot(week).updatedAt,200);
});

test('account, logout, grant or line scope resets synchronously drop latest/week snapshots and cancel late reads',async()=>{
 for(const failure of [false,true]){
  let session=0,delay=false;const old=deferred();
  const cache=createCapacitySnapshotCache({getSession:()=>session,fetchLatest:async()=>({week}),fetchWeek:()=>delay?old.promise:Promise.resolve(snapshot())});
  await cache.readLatest();await cache.readWeek(week);delay=true;
  const reading=cache.readWeek(week,true),cancelled=assert.rejects(reading,CapacityReadCancelled);await tick();session++;
  assert.equal(cache.snapshot(week),null);assert.equal(cache.latestSnapshot(),null);
  delay=false;const fresh=await cache.readWeek(week);if(failure)old.reject(error(403));else old.resolve(snapshot(week,'OLD ACCOUNT'));
  await cancelled;assert.equal(cache.snapshot(week),fresh);
 }
});

test('current 401/403 clears every retained week and latest metadata and notifies mounted consumers',async()=>{
 for(const status of [401,403]){
  let fail=false,resets=0;const cache=createCapacitySnapshotCache({fetchLatest:async()=>({week}),fetchWeek:async w=>{if(fail)throw error(status);return snapshot(w);}});
  cache.subscribe(()=>resets++);await cache.readLatest();await cache.readWeek(week);await cache.readWeek(otherWeek);fail=true;
  await assert.rejects(cache.readWeek(week,true),{status});assert.equal(resets,1);assert.equal(cache.snapshot(week),null);assert.equal(cache.snapshot(otherWeek),null);assert.equal(cache.latestSnapshot(),null);assert.equal(cache.restrictedError().status,status);
 }
});

test('mutation keeps displayed data but stale pending success/error follows the new read generation',async()=>{
 for(const failure of [false,true]){
  let generation=0,calls=0;const old=deferred();
  const cache=createCapacitySnapshotCache({getGeneration:()=>generation,fetchLatest:async()=>({week}),fetchWeek:()=>++calls===2?old.promise:Promise.resolve(snapshot(week,`READ ${calls}`))});
  const saved=await cache.readWeek(week);const before=cache.readWeek(week,true);await tick();generation++;
  assert.equal(cache.snapshot(week),saved);
  const after=await cache.readWeek(week,true);if(failure)old.reject(error(403));else old.resolve(snapshot(week,'STALE'));
  assert.equal(await before,after);assert.equal(cache.snapshot(week),after);assert.equal(calls,3);
 }
});

test('pending paired reads deduplicate and retained weeks remain bounded',async()=>{
 const pending=deferred();let calls=0;const cache=createCapacitySnapshotCache({limit:2,fetchLatest:async()=>({week}),fetchWeek:w=>{calls++;return w===week?pending.promise:Promise.resolve(snapshot(w));}});
 const a=cache.readWeek(week,true),b=cache.readWeek(week,true);assert.equal(a,b);await tick();assert.equal(calls,1);pending.resolve(snapshot());await a;
 await cache.readWeek(otherWeek);await cache.readWeek('2026-10-26');assert.equal(cache.snapshot(week),null);assert.ok(cache.snapshot(otherWeek));assert.ok(cache.snapshot('2026-10-26'));
});

test('dirty reconciliation preserves draft data and save-conflict revision but refreshes permissions',()=>{
 const current={...snapshot(),revision:3,rows:[{week,line:'A',input:{value:'UNSAVED'}}]};const incoming={...snapshot(),revision:4,permissions:{view:true,edit:false}};
 const reconciled=reconcileCapacityRefresh(current,incoming,true);
 assert.equal(reconciled.rows,current.rows);assert.equal(reconciled.revision,3);assert.equal(reconciled.permissions.edit,false);
 assert.equal(reconcileCapacityRefresh(current,incoming,false),incoming);
 assert.equal(reconcileCapacityRefresh(current,snapshot(otherWeek),true).week,otherWeek);
});

test('malformed or cross-week responses never qualify as retained Capacity data',()=>{
 for(const body of [{},snapshot(otherWeek),{...snapshot(),rows:[{week:otherWeek,line:'A',input:{}}]},{...snapshot(),revision:-1},{...snapshot(),employees:null}])assert.throws(()=>validateCapacitySnapshot(body,week),/chưa hợp lệ/);
 for(const body of [{},{week:'2026-10-13'},{week:'2026-99-99'}])assert.throws(()=>validateCapacityLatest(body),/chưa hợp lệ/);
 assert.equal(validateCapacityLatest({week:null}).week,null);
});

 test('unchanged background reads preserve object identity; real changes replace it',async()=>{
 let value=snapshot();const cache=createCapacitySnapshotCache({fetchLatest:async()=>({week}),fetchWeek:async()=>structuredClone(value)});
 const first=await cache.readWeek(week);const second=await cache.readWeek(week,true);assert.equal(second.data,first.data);
 assert.equal(cache.remember(week,structuredClone(value)).data,first.data);
 value={...value,revision:2};assert.notEqual((await cache.readWeek(week,true)).data,first.data);
 });
