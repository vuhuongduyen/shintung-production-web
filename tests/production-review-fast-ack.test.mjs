import test from 'node:test';import assert from 'node:assert/strict';
import {createReviewRunner,submitReviewSelection} from '../lib/production-review-selection.mjs';
import {createProductionSnapshotCache} from '../lib/production-snapshot-cache.mjs';
import {mergeProductionSavedResult} from '../lib/production-saved-result.mjs';
const report={id:'PVC-200',transitId:'PVC',line:'A',kind:'completion',reportingModel:'daily-finished-v1',quantityOnly:true,version:1,reportedQuantity:200,productionDate:'2026-11-14',reviewStatus:'Chờ kiểm tra'};
const ack={...report,version:2,reviewStatus:'Đã xác nhận',approvedQuantity:200};
const item={report,expectedReview:'snapshot',delayReason:''};
test('server-confirmed daily row resolves before slow background refresh, while ordinary runner waits',async()=>{
 for(const fast of [false,true]){let finish,settled=false,refreshes=0;const gate=new Promise(r=>finish=r);const promise=createReviewRunner()([item],{allowed:true,submit:async()=>({ok:true,report:ack}),...(fast?{onSaved:()=>true}:{}),refresh:async()=>{refreshes++;return gate;}}).then(r=>{settled=true;return r;});await new Promise(r=>setImmediate(r));assert.equal(settled,fast);assert.equal(refreshes,1);finish(true);const result=await promise;assert.equal(result.results[0].ok,true);}
});
test('lost/malformed ACK and conflict never project success; uncertain failure still waits for reconciliation',async()=>{
 for(const payload of [undefined,{...ack,id:'OTHER'},{...ack,version:1},{...ack,line:'B'}])await assert.rejects(()=>submitReviewSelection(item,async()=>Response.json({ok:true,payload})),{uncertain:true});
 const result=await submitReviewSelection(item,async()=>Response.json({ok:true,payload:ack}));assert.deepEqual(result.report,ack);
 let applied=0;const failed=await createReviewRunner()([item],{allowed:true,submit:async()=>{throw Object.assign(Error('stale'),{uncertain:false});},onSaved:()=>{applied++;return true;},refresh:async()=>true});assert.equal(applied,0);assert.equal(failed.results[0].ok,false);
});
test('ack snapshot survives remount and slow old read cannot resurrect pending row',async()=>{
 let finishOld,finishNew,calls=0,saved;
 const old={orders:[{id:'PVC',lsxQty:1000}],reports:[report],events:[]},fresh={...old,reports:[ack]};
 const cache=createProductionSnapshotCache({restore:()=>old,remember:v=>saved=v,fetcher:()=>++calls===1?new Promise(r=>finishOld=r):new Promise(r=>finishNew=r)});
 cache.snapshot();const pending=cache.read(true);await new Promise(r=>setImmediate(r));cache.applyMutation(v=>mergeProductionSavedResult(v,{reports:[ack]}));assert.equal(cache.snapshot().reports[0].reviewStatus,'Đã xác nhận');assert.equal(saved.reports[0].version,2);
 finishOld(old);await new Promise(r=>setImmediate(r));assert.equal(cache.snapshot().reports[0].version,2);finishNew(fresh);await pending;assert.equal(cache.snapshot().reports[0].version,2);
});
test('synthetic latency separates ACK completion from read latency; not a production measurement',async()=>{
 const measure=async fast=>{const start=performance.now();await createReviewRunner()([item],{allowed:true,submit:async()=>{await new Promise(r=>setTimeout(r,10));return {ok:true,report:ack};},...(fast?{onSaved:()=>true}:{}),refresh:()=>new Promise(r=>setTimeout(()=>r(true),200))});return performance.now()-start;};
 const previous=await measure(false),current=await measure(true);console.log(`Synthetic ACK 10ms / refresh 200ms: blocking=${previous.toFixed(1)}ms; ACK-first=${current.toFixed(1)}ms`);assert.ok(previous-current>100);
});
