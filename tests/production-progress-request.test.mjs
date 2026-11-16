import test from 'node:test';import assert from 'node:assert/strict';
import {readProgressResponse} from '../lib/production-progress-request.mjs';
import {createProductionSnapshotCache} from '../lib/production-snapshot-cache.mjs';
test('timeout releases pending cache; retry succeeds and late old body cannot replace it',async()=>{
 let calls=0,release,signal;
 const cache=createProductionSnapshotCache({fetcher:()=>readProgressResponse(async(_path,init)=>{signal=init.signal;calls++;return calls===1?{ok:true,json:()=>new Promise(resolve=>release=resolve)}:Response.json({rows:['new']});},{},15)});
 const first=cache.read(),joined=cache.read(true);assert.equal(first,joined);
 await assert.rejects(first,/quá lâu/);assert.equal(signal.aborted,true);
 assert.deepEqual(await cache.read(),{rows:['new']});release({rows:['old']});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(cache.snapshot(),{rows:['new']});assert.equal(calls,2);
});
test('background timeout retains last result and authentication failure clears it',async()=>{
 let mode='ok';const cache=createProductionSnapshotCache({fetcher:()=>readProgressResponse(async()=>mode==='hang'?new Promise(()=>{}):mode==='denied'?Response.json({error:'Denied'},{status:403}):Response.json({rows:['saved']}),{},10)});
 await cache.read();mode='hang';await assert.rejects(cache.read(true),/quá lâu/);assert.deepEqual(cache.snapshot(),{rows:['saved']});
 mode='denied';await assert.rejects(cache.read(true),e=>e.status===403);assert.equal(cache.snapshot(),null);
});
