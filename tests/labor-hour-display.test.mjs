import test from 'node:test';import assert from 'node:assert/strict';import {laborHourNumber,formatLaborHour} from '../lib/labor-hour-display.mjs';
test('SKU production settings distinguish missing and invalid standard from legitimate zero',()=>{
 for(const value of [null,undefined,'',false,NaN,Infinity,-1]){assert.equal(laborHourNumber(value),null);assert.equal(formatLaborHour(value),'Chưa có định mức');}
 assert.equal(formatLaborHour(0),'0.000 giờ/SP');assert.equal(formatLaborHour(.017),'0.017 giờ/SP');
});
