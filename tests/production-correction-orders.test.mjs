import test from 'node:test';import assert from 'node:assert/strict';import {correctionOrderRows,correctionStageEvents} from '../lib/production-correction-orders.mjs';
test('one row per order sums reports once and stage filter never assigns legacy times',()=>{
 const events=[{id:'s',sourceId:'o',kind:'start',effectiveAt:'2026-10-20T01:00:00Z'},{id:'p',sourceId:'o',kind:'pause',stage:'CUT',effectiveAt:'2026-10-20T02:00:00Z'}];
 const rows=correctionOrderRows([{id:'o',lsxCode:'LSX'}],events,[{id:'r',transitId:'o',kind:'completion',hours:{total:12}},{id:'r2',transitId:'o',kind:'completion',hours:{total:3}}]);
 assert.equal(rows.length,1);assert.equal(rows[0].hours,15);assert.equal(correctionStageEvents(events,'CUT')[0].id,'p');assert.equal(correctionStageEvents(events,'')[0].id,'s');assert.deepEqual(correctionStageEvents(events,'ASSY'),[]);
});
