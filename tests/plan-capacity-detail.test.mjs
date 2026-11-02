import test from 'node:test';import assert from 'node:assert/strict';
import {getPlanCapacityDetail} from '../scripts/local/production-plan.mjs';
import {newDailyCapacity,calculateCapacity} from '../lib/capacity.mjs';
const week='2026-10-26';
function fixture(){const row=newDailyCapacity(week,'A');Object.assign(row,{status:'Đã xác nhận',reviewStatus:'approved',syncedAt:'2026-10-23',khsxAcceptedAt:'2026-10-23'});row.input.workers=2;row.input.dailyHcLeave=[{date:week,mode:'full',people:1,employees:['NV1']}];return row;}
function db(row){return {prepare(){return {bind(){return this},async first(){return {payload:JSON.stringify({rows:[row]})}},async all(){return {results:[{record_key:'NV1',payload:JSON.stringify({name:'Nguyễn Văn An'})}]}}}}}}
test('daily hours match schedule and show employee absence',async()=>{const row=fixture(),r=await getPlanCapacityDetail(db(row),week,'A');assert.equal(r.days.length,7);assert.equal(r.days[0].hcCount,1);assert.equal(r.days[1].hcCount,2);assert.equal(r.days[6].hcCount,0);assert.equal(r.days[0].absences[0].names[0],'Nguyễn Văn An');assert.ok(Math.abs(r.days.reduce((s,d)=>s+d.available,0)-calculateCapacity(row.input,week).availableHours)<1e-8);});
for(const change of [{reviewStatus:'pending'},{syncedAt:null},{khsxAcceptedAt:null},{reviewStatus:'adjusting'},{status:'Nháp'}])test('blocks unapproved or unsynced '+JSON.stringify(change),async()=>{await assert.rejects(()=>getPlanCapacityDetail(db({...fixture(),...change}),week,'A'),e=>e.status===409)});
