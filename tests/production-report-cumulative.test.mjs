import test from 'node:test';import assert from 'node:assert/strict';
import {reportCumulativeHours} from '../lib/production-report-cumulative.mjs';
import {journalContext} from '../lib/production-journal.mjs';
test('stage and order cumulative exclude superseded, cancelled and future reports',()=>{
 const row=(id,stageCode,total,hour,extra={})=>({id,transitId:'O',stageCode,erpStageImport:true,hours:{total},completedAt:`2026-10-20T${hour}:00:00+07:00`,...extra});
 const data=[row('old','',244,'08',{cancelled:true,replacedByStageBatch:'B'}),row('c1','CUT',2,'09'),row('a1','ASSY',3,'10'),row('c2','CUT',4,'11'),row('other','CUT',99,'09',{transitId:'P'}),row('void','CUT',9,'10',{voided:true}),row('future','CUT',10,'12')];
 const c=reportCumulativeHours(data);assert.deepEqual(c.get('c2'),{stageCumulativeHours:6,orderCumulativeHours:9});assert.deepEqual(c.get('a1'),{stageCumulativeHours:3,orderCumulativeHours:5});assert.equal(c.has('old'),false);assert.equal(journalContext(data[0],[]).status,'Đã thay thế');
});
