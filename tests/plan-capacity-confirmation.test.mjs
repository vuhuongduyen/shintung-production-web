import test from 'node:test';import assert from 'node:assert/strict';
import {requestPlanWithCapacityConfirmation as request} from '../lib/plan-capacity-confirmation.mjs';
const warning=token=>Response.json({error:'dailyCapacityConfirmation',details:[{id:'dailyCapacity',reason:JSON.stringify({token,warnings:[{sku:'SKU',over:10}],notChecked:[]})}]},{status:409});
for(const action of ['save','close'])test(action+' waits for explicit decision and resends unchanged selection with server token',async()=>{
 const calls=[];const body={action,week:'2026-10-26',revision:4,ids:['a','b'],edits:{a:{start:'2026-10-26'}}};
 const r=await request({body,send:async b=>{calls.push(b);return calls.length===1?warning('one'):Response.json({ok:true});},decide:async w=>{assert.equal(calls.length,1);assert.equal(w.token,'one');return true;}});
 assert.equal(r.cancelled,false);assert.equal(calls.length,2);assert.deepEqual(calls[1],{...body,dailyCapacityAck:'one'});
});
test('decline does not close or retry',async()=>{let count=0;const r=await request({body:{action:'close'},send:async()=>{count++;return warning('one');},decide:async()=>false});assert.equal(r.cancelled,true);assert.equal(count,1);});
test('changed capacity asks again, never reuses an old consent',async()=>{const consent=[];let count=0;await request({body:{action:'close'},send:async()=>++count<3?warning(String(count)):Response.json({ok:true}),decide:async w=>{consent.push(w.token);return true;}});assert.deepEqual(consent,['1','2']);});
test('session change cancels retry',async()=>{let current=true,count=0;const r=await request({body:{action:'close'},send:async()=>{count++;return warning('one');},decide:async()=>{current=false;return true;},isCurrent:()=>current});assert.equal(r.cancelled,true);assert.equal(count,1);});
