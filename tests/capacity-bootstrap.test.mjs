import test from 'node:test';
import assert from 'node:assert/strict';
import {readLatestCapacity} from '../scripts/local/capacity.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
test('bootstrap returns newest week and complete calendar in one read, enforcing permissions',async()=>{
 const week='2026-10-26',payload={schemaVersion:1,week,revision:7,rows:[newDailyCapacity(week,'A'),newDailyCapacity(week,'B')]};let reads=0;
 const db={prepare:()=>({all:async()=>{reads++;return {results:[{entity:'capacity',record_key:week,payload:JSON.stringify(payload)}]};}})};
 const result=await readLatestCapacity(db,{login:'TEST',isAdmin:true});
 assert.equal(reads,1);assert.equal(result.week,week);assert.equal(result.snapshot.week,week);assert.equal(result.snapshot.revision,7);assert.equal(result.snapshot.rows.length,2);
 await assert.rejects(readLatestCapacity(db,{login:'NO-GRANTS'}),{status:403});assert.equal(reads,1);
});
