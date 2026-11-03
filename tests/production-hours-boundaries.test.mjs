import test from 'node:test';
import assert from 'node:assert/strict';
import {hoursForOrder} from '../lib/production-hours.mjs';
test('month-long work reads attendance edges once per day and respects edited breaks, cleaning, absence and overtime',()=>{
 const schedule={};for(let d=1;d<=31;d++)schedule[`2026-10-${String(d).padStart(2,'0')}`]={working:true,ot:true,hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:600,breakMorningEnd:610,breakAfternoonStart:900,breakAfternoonEnd:910,preOtStart:1020,preOtEnd:1050,otStart:1050,otEnd:1140,cleaning:[]};
 const calls=[];const events=[{kind:'start',sourceId:'O',count:1,employees:['N'],effectiveAt:'2026-10-01T08:00:00+07:00'}];
 const h=hoursForOrder(events,schedule,'O','2026-10-01T08:00:00+07:00','2026-10-31T19:00:00+07:00',{edges:date=>{calls.push(date);return [660,690];},present:(id,date,minute)=>minute<660||minute>=690});
 assert.equal(calls.length,31);assert.equal(new Set(calls).size,31);assert.ok(Math.abs(h.hc-31*(8-1/3-0.5))<0.0001);assert.ok(Math.abs(h.ot-31*1.5)<0.0001);
});
