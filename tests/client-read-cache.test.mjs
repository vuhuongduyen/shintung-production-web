import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache} from '../lib/client-read-cache.mjs';
test('concurrent menu reads share one request but independent response bodies',async()=>{
 const cache=createReadCache();let calls=0;
 const read=()=>{calls++;return Response.json({value:42});};
 const responses=await Promise.all(Array.from({length:8},()=>cache.read('sku',read)));
 assert.equal(calls,1);for(const r of responses)assert.deepEqual(await r.json(),{value:42});
 await cache.read('sku',read);assert.equal(calls,1);
 cache.clear();await cache.read('sku',read);assert.equal(calls,2);
 await cache.read('sku',read,{fresh:true});assert.equal(calls,3);
});
test('expiry, errors and invalidation during an old request never resurrect cached records',async()=>{
 let now=0,calls=0;const cache=createReadCache({ttl:10,now:()=>now});
 const fetcher=()=>{calls++;return Response.json({calls});};
 await cache.read('x',fetcher);now=11;await cache.read('x',fetcher);assert.equal(calls,2);
 let finish;const old=cache.read('y',()=>new Promise(r=>finish=r));await Promise.resolve();cache.clear();
 await cache.read('y',()=>Response.json({new:true}));finish(Response.json({old:true}));await old;
 assert.deepEqual(await (await cache.read('y',fetcher)).json(),{new:true});
 await cache.read('error',()=>Response.json({},{status:403}));assert.equal((await cache.read('error',fetcher)).status,200);
});
