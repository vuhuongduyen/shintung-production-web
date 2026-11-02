import test from 'node:test';import assert from 'node:assert/strict';
import {correctionDisplayRows} from '../lib/production-correction-display.mjs';
test('uses station names, removes source reporting rows and attaches hours to exit without duplicate',()=>{
 const at='2026-10-20T01:00:00Z',reports=[{id:'r',sourceId:'o',completedAt:at,reportRow:true,kind:'completion'}];
 const rows=correctionDisplayRows([{id:'s',kind:'source-time',sourceTimeLog:true,sourceOperation:'BẮT ĐẦU'},{id:'e',sourceId:'o',effectiveAt:at,kind:'source-time',sourceTimeLog:true,sourceOperation:'HOÀN THÀNH'},{id:'b',sourceOperation:'BÁO CÔNG'}],reports);
 assert.equal(rows.length,2);assert.equal(rows[0].operation,'Nhập trạm');assert.equal(rows[1].operation,'Xuất trạm');assert.equal(rows[1].hoursReport.id,'r');
 assert.equal(correctionDisplayRows([],reports)[0].operation,'Xuất trạm');
});
