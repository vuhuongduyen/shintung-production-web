import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity} from '../lib/capacity.mjs';
import {setCapacityWorkingDay} from '../lib/capacity-workday-toggle.mjs';
import {selectTestRoster,testRosterCapability,withTestRosterCapability,assertTestRosterMutation} from '../lib/capacity-test-roster.mjs';
import {prepareCapacityMutation} from '../scripts/local/capacity.mjs';
const week='2027-02-01',ids=['QAOT_FIXTURE_A','QAOT_FIXTURE_B'];
const employees=ids.map(id=>({id,name:`SYNTHETIC QA OT ${id}`,line:'B',active:false,startDate:week,endDate:'2027-02-02',employmentDatesManaged:true})).concat({id:'REAL_FIXTURE',name:'Unrelated fixture',line:'B',active:true});
const policy={week,line:'B',employeeIds:ids};
const fixture=()=>{const row=newDailyCapacity(week,'B');row.input.dailySchedule.forEach(d=>d.working=false);row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:[],ot:[],savedHc:['REAL_FIXTURE']}));return row;};
const state=()=>({week,revision:0,rows:[newDailyCapacity(week,'A'),fixture()],employees,legacy:[]});
const admin={login:'synthetic-test-admin',isAdmin:true};
test('default remains disabled; policy is exact and future employment is date-aware',()=>{
 const s=state();assert.equal(withTestRosterCapability(s,null),s);assert.equal(testRosterCapability(s,undefined),null);
 assert.deepEqual(testRosterCapability(s,policy),policy);
 for(const patch of [{week:'2027-02-08'},{line:'A'},{employeeIds:[]},{employeeIds:[ids[0],ids[0]]},{employeeIds:['REAL_FIXTURE']},{employeeIds:['QAOT_MISSING']}])assert.throws(()=>testRosterCapability(s,{...policy,...patch}));
});
test('explicit selection replaces dormant names, survives JSON reload and repeated HC toggles',()=>{
 const row=fixture(),original=JSON.stringify(row);
 const input=selectTestRoster(row,employees,policy,ids);
 assert.equal(JSON.stringify(row),original);assert.deepEqual(input.dailyRoster[0].savedHc,ids);assert.deepEqual(input.dailyRoster[1].savedHc,[]);
 const on=setCapacityWorkingDay(JSON.parse(JSON.stringify(input)),0,true);
 assert.deepEqual(on.dailyRoster[0].hc,ids);assert.ok(!JSON.stringify(on).includes('REAL_FIXTURE'));
 assert.deepEqual(setCapacityWorkingDay(setCapacityWorkingDay(on,0,false),0,true),on);
 assert.deepEqual(selectTestRoster({...row,input},employees,policy,ids),input);
});
test('does not replace confirmed/history/leave/cleaning/transfer inputs or invalid selections',()=>{
 for(const patch of [{version:1},{lastConfirmed:{}},{status:'Đã xác nhận'},{reviewStatus:'adjusting'},{request:{}}])assert.throws(()=>selectTestRoster({...fixture(),...patch},employees,policy,ids));
 for(const key of ['dailyHcLeave','dailyOtLeave','otherTime','staffTransfers','hcLeaves','otLeaveRows']){const row=fixture();row.input[key]=[{}];assert.throws(()=>selectTestRoster(row,employees,policy,ids));}
 const row=fixture();row.input.dailySchedule[0].cleaning=[{}];assert.throws(()=>selectTestRoster(row,employees,policy,ids));
 for(const selected of [[],['REAL_FIXTURE'],[ids[0],ids[0]]])assert.throws(()=>selectTestRoster(fixture(),employees,policy,selected));
});
test('normal backend permission/version gates remain; scoped draft saves only synthetic names',()=>{
 const s=state(),input=selectTestRoster(s.rows[1],employees,policy,ids),body={action:'save',week,revision:0,lines:['B'],inputs:{B:input}};
 const options={state:s,hasRaw:true,queue:null,testRosterPolicy:policy};
 const {next}=prepareCapacityMutation(body,admin,options);assert.deepEqual(next.rows[0],s.rows[0]);assert.deepEqual(next.rows[1].input.dailyRoster,input.dailyRoster);
 assert.throws(()=>prepareCapacityMutation(body,{login:'no-permission'},options),/quyền/);
 assert.throws(()=>prepareCapacityMutation({...body,revision:99},admin,options),/người khác/);
 const forged=structuredClone(body);forged.inputs.B.dailyRoster[0].savedHc=['REAL_FIXTURE'];assert.throws(()=>prepareCapacityMutation(forged,admin,options),/ngoài phạm vi/);
 assert.throws(()=>prepareCapacityMutation({...body,lines:['A','B']},admin,options),/Chỉ thao tác/);
 assert.throws(()=>prepareCapacityMutation(body,admin,{...options,hasRaw:false}),/không tạo tuần/);
 const withLeave=structuredClone(s);withLeave.rows[1].input.dailyHcLeave=[{date:week,employees:['REAL_FIXTURE']}];assert.throws(()=>prepareCapacityMutation(body,admin,{...options,state:withLeave}),/không thay roster/);
});
test('server rejects expired, real and unnamed personnel references, including dormant arrays',()=>{
 const s=state(),input=selectTestRoster(s.rows[1],employees,policy,ids),body={action:'save',lines:['B']};
 const next={...s,rows:[s.rows[0],{...s.rows[1],input}]};
 for(const change of [r=>r.input.dailyRoster[1].savedHc.push(ids[0]),r=>r.input.dailyRoster[0].hc.push('REAL_FIXTURE'),r=>r.input.otherTime.push({employees:['REAL_FIXTURE']}),r=>r.input.dailyOtLeave.push({people:1}),r=>r.input.staffTransfers=[{employees:ids}]]){
  const bad=structuredClone(next);change(bad.rows[1]);assert.throws(()=>assertTestRosterMutation(body,s,bad,policy));
 }
 assertTestRosterMutation(body,s,next,policy);
 const old=structuredClone(s);old.rows[1].version=1;assert.throws(()=>assertTestRosterMutation(body,old,next,policy),/đã từng xác nhận/);
});
