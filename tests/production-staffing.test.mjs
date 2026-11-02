import test from 'node:test';
import assert from 'node:assert/strict';
import {hoursForOrder} from '../lib/production-hours.mjs';
import {isPresent} from '../lib/production-attendance.mjs';
const date='2026-10-02',at=t=>new Date(`${date}T${t}:00+07:00`).toISOString();
test('10 assigned, 9 work before arrival at 10:00, then 10; report endpoint never backdates arrival',()=>{
 const people=Array.from({length:10},(_,i)=>`NV${i+1}`);
 const events=[{id:'start',kind:'start',sourceId:'order',line:'A',count:10,employees:people,effectiveAt:at('08:00')},
  {id:'late',kind:'line-absence',line:'A',absenceType:'Đi trễ',employees:['NV1'],count:1,effectiveAt:at('08:00'),endsAt:at('10:00')}];
 const policy={present:(id,d,m,p)=>isPresent(null,events,id,'A',d,m,p),edges:()=>[480,600],perDay:true};
 const schedule={[date]:{working:true,hcStart:480,hcEnd:1020}};
 const before=hoursForOrder(events,schedule,'order',at('08:00'),at('10:00'),policy);
 assert.equal(before.hc,18);assert.equal(before.staffing.length,1);
 assert.equal(before.staffing[0].count,9);assert.equal(before.staffing[0].assigned,10);
 assert.ok(!before.staffing[0].employees.includes('NV1'));
 assert.ok(!before.perEmployee.some(p=>p.id==='NV1'));
 const after=hoursForOrder(events,schedule,'order',at('10:00'),at('11:00'),policy);
 assert.equal(after.hc,8.3333);assert.equal(after.staffing[0].count,10);
 assert.equal(after.perEmployee.find(p=>p.id==='NV1').hc,0.8333);
 const combined=hoursForOrder(events,schedule,'order',at('08:00'),at('11:00'),policy);
 assert.deepEqual(combined.staffing.map(s=>s.count),[9,10]);assert.equal(combined.hc,26.3333);
});

test('other work excludes order hours only inside its interval',()=>{const events=[{id:'other',kind:'line-absence',line:'A',absenceType:'CV khác',employees:['NV1'],approved:true,effectiveAt:at('09:00'),endsAt:at('10:00')}];assert.equal(isPresent(null,events,'NV1','A',date,510,'hc'),true);assert.equal(isPresent(null,events,'NV1','A',date,570,'hc'),false);assert.equal(isPresent(null,events,'NV1','A',date,600,'hc'),true);});
