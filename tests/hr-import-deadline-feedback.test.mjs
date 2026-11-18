import test from 'node:test';
import assert from 'node:assert/strict';
import {hrImportDateIssue,hrAttendancePeriodWarning} from '../lib/hr-attendance-period.mjs';
import {hrImportRequest} from '../lib/hr-import-request.mjs';
test('October closes after November 10 Vietnam time with an explicit deadline, including under November selection',()=>{
 assert.equal(hrImportDateIssue('2026-10-01','2026-10',Date.parse('2026-11-10T16:59:59Z')),'');
 for(const month of ['2026-10','2026-11'])assert.match(hrImportDateIssue('2026-10-01',month,Date.parse('2026-11-10T17:00:00Z')),/10\/11\/2026.*Không lưu/);
 assert.match(hrAttendancePeriodWarning('2026-10',Date.parse('2026-11-18T00:00:00Z')),/Tháng 10\/2026/);
 assert.match(hrImportDateIssue('2026-11-01','2026-12',Date.parse('2026-11-18T00:00:00Z')),/khác tháng/);
 assert.match(hrImportDateIssue('2026-02-30','2026-02'),/Ngày không hợp lệ/);
});
test('timeout ends pending state and never retries even if fetch ignores abort',async()=>{
 let calls=0,signal;await assert.rejects(hrImportRequest({action:'hr-import-save'},{timeoutMs:10,fetcher:async(_url,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}}),/Chưa xác nhận.*Không tự tải lại/);
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('server rejection and network failure remain distinct from successful save',async()=>{
 await assert.rejects(hrImportRequest({}, {fetcher:async()=>new Response(JSON.stringify({error:'Tháng đã hết hạn'}),{status:409})}),/Tháng đã hết hạn/);
 await assert.rejects(hrImportRequest({}, {fetcher:async()=>{throw Error('offline');}}),/Mất kết nối; chưa xác nhận/);
 const response=await hrImportRequest({}, {fetcher:async()=>new Response(JSON.stringify({saved:true,count:1}))});assert.equal(response.count,1);
});
