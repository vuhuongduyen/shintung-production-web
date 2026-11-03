import test from 'node:test';import assert from 'node:assert/strict';
import {acceptedCapacity} from '../lib/capacity-accepted.mjs';
import {capacityDailyBudgets} from '../lib/plan-week-load.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
test('pending and edited Capacity retains the accepted schedule and hours without changing stored data',()=>{
 const base=newDailyCapacity('2026-11-02','A');base.input.workers=10;
 const approved={...base,status:'Đã xác nhận',reviewStatus:'approved',syncedAt:'sync',khsxAcceptedAt:'accepted'};
 const history=[{action:'review',decision:'approve',request:{kind:'capacity',at:'sync'},at:'accepted',after:structuredClone(base.input),version:1,newHours:200}];
 for(const reviewStatus of ['adjust-pending','adjusting','await-sync','pending','rejected']){
 const current={...base,status:'Nháp',reviewStatus,availableHours:1,input:{...base.input,workers:1},history};const before=JSON.stringify(current);
 const kept=acceptedCapacity(current);assert.equal(kept.availableHours,200);assert.equal(kept.version,1);assert.deepEqual(capacityDailyBudgets(current),capacityDailyBudgets(approved));assert.equal(JSON.stringify(current),before);
 }
 assert.equal(acceptedCapacity(approved),approved);assert.equal(acceptedCapacity(base),base);
});
