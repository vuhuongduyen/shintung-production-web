import test from 'node:test';
import assert from 'node:assert/strict';
import {stageHours} from '../lib/production-stage-live.mjs';
import {hoursForOrder} from '../lib/production-hours.mjs';
test('request-local cumulative segment reuse retains hours and staffing without changing saved history',()=>{
 const at=n=>`2026-11-02T${String(n).padStart(2,'0')}:00:00+07:00`;
 const events=Array.from({length:4},(_,i)=>({id:'SYNTHETIC-'+i,kind:'stage-work',stageReporting:true,stageName:'ASSY',sourceId:'ORDER',line:'A',effectiveAt:at(i+8),stageAfter:{status:'running',people:['PERSON'],startedAt:at(8)}}));
 const schedule={'2026-11-02':{working:true,ot:false}},attendance={present:()=>true,extraPresent:()=>true},before=JSON.stringify(events),cache=new Map();let uncachedCalls=0,cachedCalls=0;
 for(let end=9;end<=12;end++){
  const report={transitId:'ORDER',line:'A',stageName:'ASSY',startedAt:at(8),completedAt:at(end)};
  const expected=stageHours(events,report,schedule,attendance,(...args)=>{uncachedCalls++;return hoursForOrder(...args);});
  const actual=stageHours(events,report,schedule,attendance,(...args)=>{cachedCalls++;return hoursForOrder(...args);},cache);
  assert.deepEqual(actual,expected);
 }
 assert.equal(uncachedCalls,10);assert.equal(cachedCalls,4);assert.equal(JSON.stringify(events),before);
 // New attendance/session reads have independent caches; a changed report
 // interval, roster or schedule also cannot reuse another segment's result.
 const report={transitId:'ORDER',line:'A',stageName:'ASSY',startedAt:at(9),completedAt:at(12),correctionEmployees:['OTHER']};
 const altered={'2026-11-02':{working:true,ot:false,hcEnd:660}};
 assert.deepEqual(stageHours(events,report,altered,attendance,hoursForOrder,cache),stageHours(events,report,altered,attendance,hoursForOrder));
 const absent={present:()=>false,extraPresent:()=>false};
 assert.deepEqual(stageHours(events,report,schedule,absent,hoursForOrder,new Map()),stageHours(events,report,schedule,absent,hoursForOrder));
});
