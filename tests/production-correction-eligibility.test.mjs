import test from 'node:test';import assert from 'node:assert/strict';
import {correctionEmployeeChoices} from '../lib/production-correction-eligibility.mjs';
const employees=[{id:'A1',line:'A'},{id:'A2',line:'A'},{id:'C1',line:'C'},{id:'C2',line:'C'},{id:'C3',line:'C'}];
const at=(date,time='08:00')=>`2026-10-${date}T${time}:00+07:00`;
const move={id:'loan',kind:'line-movement',line:'C',destinationLine:'A',employees:['C1'],effectiveAt:at('26'),endsAt:at('28','17:00')};
const choose=(events,date='27',references=[])=>correctionEmployeeChoices({employees,events,references,line:'A',effectiveAt:at(date,'17:00')}).map(p=>p.id);
test('only home and effective incoming Line staff appear on the working date',()=>{
 assert.deepEqual(choose([]),['A1','A2']);assert.deepEqual(choose([move]),['A1','A2','C1']);assert.deepEqual(choose([move],'29'),['A1','A2']);
 assert.deepEqual(choose([{...move,approved:false}]),['A1','A2']);assert.deepEqual(choose([{...move,voided:true}]),['A1','A2']);
 assert.deepEqual(choose([move,{...move,id:'onward',parentMovementIds:['loan'],line:'A',destinationLine:'B',effectiveAt:at('27'),endsAt:at('27','17:00')}]),['A1','A2']);
});
test('approved daily roster and actual all-day absence constrain selection; partial attendance remains eligible',()=>{
 const references=[{key:'2026-10-26:A',roster:[{date:'2026-10-27',hc:['A1','C2']}],days:[{date:'2026-10-27',working:true,hcStart:'08:00',hcEnd:'17:00'}]}];
 assert.deepEqual(choose([],'27',references),['A1','C2']);
 const absence={id:'leave',kind:'line-absence',line:'A',employees:['A1'],effectiveAt:at('27'),endsAt:at('27','17:00')};
 assert.deepEqual(choose([absence],'27',references),['C2']);
 assert.deepEqual(choose([{...absence,endsAt:at('27','09:00')}],'27',references),['A1','C2']);
});
test('production history is not scanned for attendance boundaries',()=>{
 const noise=Array.from({length:10000},(_,i)=>({id:'source'+i,kind:'source-time',get effectiveAt(){throw Error('Unrelated production timestamp was read');}}));
 assert.deepEqual(choose([...noise,move]),['A1','A2','C1']);
});
