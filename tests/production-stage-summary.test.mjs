import test from 'node:test';
import assert from 'node:assert/strict';
import {orderLaborOutput} from '../lib/production-output-summary.mjs';
import {timeJournalQuantities} from '../lib/production-time-journal.mjs';
const order={id:'o',lsxQty:2000};
const report=(id,stageName,qty,total,date)=>({id,transitId:'o',kind:'completion',erpStageImport:true,stageCode:stageName,stageName,reportedQuantity:stageName==='FINAL'?qty:0,stageQuantity:qty,approvedQuantity:stageName==='FINAL'?qty:0,hours:{hc:total,ot:0,total},completedAt:date,reviewStatus:'Đã xác nhận'});
const rows=[report('cut','CUT',2000,10,'2026-10-19T08:00:00Z'),report('f1','FINAL',1000,2,'2026-10-19T09:00:00Z'),report('f2','FINAL',1000,3,'2026-10-20T09:00:00Z')];
test('confirmed stage reports derive closing date and unit hours without legacy close field',()=>{
 const result=orderLaborOutput(order,rows);assert.equal(result.closed,true);assert.equal(result.total,15);assert.equal(result.unit,15/2000);assert.equal(result.order.actualCompletedAt,rows[2].completedAt);assert.equal(order.actualCompletedAt,undefined);
 assert.equal(orderLaborOutput(order,rows.slice(0,2)).closed,false);
});
test('stage time journal accumulates its own hours and stage quantity, excludes superseded totals',()=>{
 const events=rows.map(r=>({id:r.id,sourceId:'o',erpStageImport:true,sourceTimeLog:true,sourceVerified:true,stageCode:r.stageCode,stageName:r.stageName,sourceOperation:'Xuất trạm',effectiveAt:r.completedAt}));
 const result=timeJournalQuantities(events,[...rows,{...rows[0],id:'old',hours:{total:500},replacedByStageBatch:'batch'}]);
 assert.equal(result.find(r=>r.id==='cut').completedQuantity,2000);
 assert.equal(result.find(r=>r.id==='f2').cumulativeLaborHours,5);
 assert.equal(result.find(r=>r.id==='f2').cumulativeQuantity,2000);
});

test('journal displays per-unit standard while deviation compares total standard hours',async()=>{
 const {journalStandardHours}=await import('../lib/production-journal-standards.mjs');
 const calculate=o=>journalStandardHours(rows,[o],new Map([['SKU',.021]]),new Set(['f2']),new Map([['f2',{orderCumulativeHours:15}]] )).get('f2');
 const saved=calculate({...order,sku:'SKU',laborHour:.07});
 assert.equal(saved.standardUnitHours,.07);assert.equal(saved.standardLaborHours,140);assert.equal(saved.laborDeviation,15/140-1);
 assert.equal(calculate({...order,sku:'SKU'}).standardUnitHours,.021);
});
