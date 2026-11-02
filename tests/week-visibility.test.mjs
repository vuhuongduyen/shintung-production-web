import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWeeks,transitReadyToArchive,matchesVisibility} from '../lib/week-visibility.mjs';
const done={week:'2026-10-19',status:'ĐÃ MỞ LSX',syncStatus:'ĐÃ ĐỒNG BỘ',actualCompletedAt:'2026-10-20',lsxQty:100,completedQty:100};
test('Only whole completed weeks archive; reopening or pending sync restores week',()=>{
 assert.deepEqual([...completedWeeks([done],transitReadyToArchive)],['2026-10-19']);
 for(const patch of [{completedQty:90},{pendingReportQty:1},{syncStatus:'CÓ THAY ĐỔI'},{actualCompletedAt:''}])assert.equal(completedWeeks([done,{...done,...patch}],transitReadyToArchive).size,0);
 assert.equal(completedWeeks([{...done,week:''}],transitReadyToArchive).size,0);
 assert.equal(completedWeeks([],transitReadyToArchive).size,0);
});
test('Display modes recover all hidden records without changing source',()=>{
 assert.equal(matchesVisibility('active',true),false);
 assert.equal(matchesVisibility('hidden',true),true);
 assert.equal(matchesVisibility('hidden',false),false);
 assert.equal(matchesVisibility('all',true),true);
 assert.equal(matchesVisibility('all',false),true);
});
