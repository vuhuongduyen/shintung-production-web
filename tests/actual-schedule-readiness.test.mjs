import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityReadiness,scheduleReadinessMessage} from '../lib/actual-schedule-readiness.mjs';
const week='2026-11-30',key=week+':B';
test('guidance identifies the persisted next owner and step, not always KHSX',()=>{
 const cases=[
  [undefined,'missing',/QLSX cần lập và lưu/],
  [{status:'Nháp'},'draft',/QLSX chưa xác nhận/],
  [{status:'Đã xác nhận',reviewStatus:'await-sync'},'await-sync',/chưa đồng bộ sang KHSX/],
  [{status:'Đã xác nhận',reviewStatus:'pending',version:2,request:{kind:'capacity',status:'pending',version:2}},'pending',/Đang chờ KHSX xét duyệt/],
  [{status:'Đã xác nhận',reviewStatus:'rejected'},'rejected',/KHSX đã từ chối/],
  [{status:'Đã xác nhận',reviewStatus:'pending',version:2,request:{kind:'capacity',status:'pending',version:1}},'unknown',/Chưa xác định được bước/],
 ];
 for(const [row,stage,pattern] of cases){assert.equal(capacityReadiness(row),stage);const message=scheduleReadinessMessage(week,'B',[{key,stage}]);assert.match(message,pattern);assert.match(message,/30\/11\/2026 · Line B/);assert.match(message,/Chưa thể nhập/);if(stage!=='pending')assert.doesNotMatch(message,/Đang chờ KHSX xét duyệt/);}
});
test('cached data without projection is unknown; another week or Line is not evidence',()=>{
 assert.match(scheduleReadinessMessage(week,'B',undefined),/Chưa xác định/);
 assert.match(scheduleReadinessMessage(week,'B',[{key:week+':A',stage:'pending'},{key:'2026-11-23:B',stage:'pending'}]),/Chưa có lịch dự kiến\/Capacity được lưu/);
});
test('existing accepted version remains authoritative during a new adjustment',()=>{
 assert.equal(capacityReadiness({status:'Nháp',reviewStatus:'adjusting'},true),'approved');
});
