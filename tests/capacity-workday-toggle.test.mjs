import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity,calculateCapacity,dailyParticipants} from '../lib/capacity.mjs';
import {setCapacityWorkingDay} from '../lib/capacity-workday-toggle.mjs';
const week='2026-10-26';
function fixture(){const {input}=newDailyCapacity(week,'A');input.workers=10;input.dailyRoster=input.dailySchedule.map(d=>({date:d.date,hc:d.working?Array.from({length:10},(_,i)=>`E${i}`):[],ot:[]}));return input;}
test('HC off/on restores exact names after save/reload and does not count inactive staff',()=>{
 const p=fixture(),original=JSON.stringify(p),initial=calculateCapacity(p,week);
 const off=setCapacityWorkingDay(p,0,false);assert.equal(dailyParticipants(off,0).hcCount,0);assert.deepEqual(off.dailyRoster[0].hc,[]);assert.equal(calculateCapacity(off,week).days[0].hcNet,0);
 const on=setCapacityWorkingDay(JSON.parse(JSON.stringify(off)),0,true);
 assert.equal(dailyParticipants(on,0).hcCount,10);assert.deepEqual(on.dailyRoster[0],p.dailyRoster[0]);assert.deepEqual(calculateCapacity(on,week),initial);assert.equal(JSON.stringify(p),original);
 assert.deepEqual(setCapacityWorkingDay(setCapacityWorkingDay(on,0,false),0,true),on);
});
test('retains a custom subset, leave entries and other days without replacing them with line defaults',()=>{
 const p=fixture();p.dailyRoster[0].hc=['E2','E7'];p.dailyHcLeave=[{date:week,to:week,people:1,employees:['E7'],mode:'full'}];
 const on=setCapacityWorkingDay(setCapacityWorkingDay(p,0,false),0,true);
 assert.deepEqual(on.dailyRoster,p.dailyRoster);assert.deepEqual(on.dailyHcLeave,p.dailyHcLeave);assert.equal(dailyParticipants(on,0).hcCount,1);
});
test('count-only schedules retain workers and an intentionally empty roster remains empty',()=>{
 const p=fixture();delete p.dailyRoster;assert.equal(dailyParticipants(setCapacityWorkingDay(setCapacityWorkingDay(p,0,false),0,true),0).hcCount,10);
 const named=fixture();named.dailyRoster[0].hc=[];assert.deepEqual(setCapacityWorkingDay(setCapacityWorkingDay(named,0,false),0,true).dailyRoster[0].hc,[]);
});
