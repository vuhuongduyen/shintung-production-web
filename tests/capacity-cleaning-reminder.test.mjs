import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity,newCapacity,hasCapacityCleaning} from '../lib/capacity.mjs';
import {prepareCapacityMutation} from '../scripts/local/capacity.mjs';
const week='2026-10-26',actor={login:'TEST-qlsx',grants:['Quản lý sản xuất / Capacity tuần / Lưu','Quản lý sản xuất / Capacity tuần / Xác nhận']};
const setup=()=>({schemaVersion:1,week,revision:2,legacy:[],employees:[],rows:['A','B'].map(line=>{const r=newDailyCapacity(week,line);r.input.workers=2;return r;})});
const prepare=(state,body)=>prepareCapacityMutation({action:'confirm',week,revision:2,lines:['A'],...body},actor,{state,hasRaw:true,queue:[],clock:()=>Date.parse('2026-10-23T08:00:00+07:00')});
test('no cleaning requires explicit per-Line acknowledgement, save draft does not',()=>{
 const state=setup(),before=JSON.stringify(state);
 assert.throws(()=>prepare(state,{}),/chưa ghi nhận lịch vệ sinh/);
 assert.throws(()=>prepare(state,{noCleaningAcknowledgedLines:['B']}),/chưa ghi nhận/);
 assert.throws(()=>prepare(state,{noCleaningAcknowledgedLines:'A'}),/chưa ghi nhận/);
 assert.equal(JSON.stringify(state),before);
 const {next}=prepare(state,{noCleaningAcknowledgedLines:['A']});assert.equal(next.rows[0].status,'Đã xác nhận');assert.equal(next.rows[0].history.at(-1).noCleaningAcknowledged,true);assert.equal(next.rows[0].history.at(-1).actor,'TEST-qlsx');assert.match(next.rows[0].history.at(-1).reason,/không có lịch vệ sinh/);
 assert.equal(prepare(state,{action:'save'}).next.rows[0].status,'Nháp');
 assert.throws(()=>prepare(state,{lines:['A','B'],noCleaningAcknowledgedLines:['A']}),/Line B/);
 assert.throws(()=>prepare(state,{revision:1,noCleaningAcknowledgedLines:['A']}),{status:409});
});
test('registered cleaning confirms directly; blank or zero-person rows do not suppress reminder',()=>{
 const state=setup(),input=state.rows[0].input;
 input.dailySchedule[4].cleaning=[{people:2,start:'16:00',end:'17:00'}];
 assert.equal(hasCapacityCleaning(input,week),true);assert.equal(prepare(state,{}).next.rows[0].history.at(-1).noCleaningAcknowledged,false);
 input.dailySchedule[4].cleaning=[{people:0,start:'16:00',end:'17:00'}];assert.equal(hasCapacityCleaning(input,week),false);
 input.dailySchedule[4].cleaning=[];assert.equal(hasCapacityCleaning(input,week),false);
 const legacy=newCapacity(week,'A').input;assert.equal(hasCapacityCleaning(legacy,week),true);legacy.cleanMinutes=0;assert.equal(hasCapacityCleaning(legacy,week),false);
});
