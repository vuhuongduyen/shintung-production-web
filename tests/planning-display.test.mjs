import test from 'node:test';
import assert from 'node:assert/strict';
import {planningHours,enginePriorityTone} from '../lib/planning-display.mjs';
test('planning hour display rounds to exactly two decimals without changing calculation values',()=>{
 const available=554.0083333333333,difference=29.508333333333326;
 assert.equal(planningHours(available),'554,01');assert.equal(planningHours(difference),'29,51');assert.equal(planningHours(-53.23333333333405),'-53,23');assert.equal(planningHours(520),'520,00');assert.equal(planningHours(null),'—');assert.equal(planningHours(Infinity),'—');assert.equal(planningHours(available,'en'),'554.01');assert.equal(available,554.0083333333333);
});
test('Engine priority colors normalize saved uppercase and displayed accented mixed-case levels',()=>{
 for(const value of ['KHẨN - EVENT','Khẩn – Event','KHẨN - SAFETY + BÙ TẢI'])assert.equal(enginePriorityTone(value),'urgent');
 for(const value of ['CAO - EVENT','Cao – ROP','CAO - ROP + BÙ TẢI'])assert.equal(enginePriorityTone(value),'high');
 assert.equal(enginePriorityTone('ĐỦ TỒN - EVENT'),'stock-event');assert.equal(enginePriorityTone('BÙ TẢI'),'load');assert.equal(enginePriorityTone('Bù tải'),'load');assert.equal(enginePriorityTone('KHÔNG BỔ SUNG'),'no-add');
 assert.equal(new Set(['KHẨN - EVENT','CAO - ROP','ĐỦ TỒN - EVENT','BÙ TẢI','KHÔNG BỔ SUNG'].map(enginePriorityTone)).size,5);
});
