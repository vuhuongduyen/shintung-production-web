import test from 'node:test';import assert from 'node:assert/strict';
import {applyCorrectionResult} from '../lib/production-correction-result.mjs';
test('save continuation uses committed versions and removes cancelled rows without duplicating split rows',()=>{
 const selected={id:'O',lsxCode:'O',events:[{id:'start',sourceId:'O',version:0},{id:'resume',sourceId:'O',version:0}],reports:[{id:'r',transitId:'O',kind:'completion',reportedQuantity:100,completedAt:'2026-10-31T03:00:00Z',hours:{total:2}}]};
 const result={event:{id:'audit',sourceId:'O',kind:'report-correction',eventChanges:[{eventId:'start',after:{...selected.events[0],version:1}},{eventId:'resume',after:{...selected.events[1],voided:true,version:1}},{eventId:'new:split',after:{id:'new:split',sourceId:'O',version:1}}]},reportImpacts:[{reportId:'r',after:{...selected.reports[0],reportedQuantity:40}},{reportId:'r2',after:{...selected.reports[0],id:'r2',reportedQuantity:60}}]};
 const one=applyCorrectionResult(selected,result),again=applyCorrectionResult(one,result);assert.equal(one.events.find(e=>e.id==='start').version,1);assert.equal(one.events.some(e=>e.id==='resume'),false);assert.equal(one.events.filter(e=>e.id==='new:split').length,1);assert.equal(one.reports.length,2);assert.equal(one.completedQuantity,100);assert.deepEqual(again,one);assert.equal(selected.events[0].version,0);
});
