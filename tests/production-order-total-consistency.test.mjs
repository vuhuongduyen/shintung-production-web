import test from 'node:test';
import assert from 'node:assert/strict';
import {journalOrderHours,reportCumulativeHours} from '../lib/production-report-cumulative.mjs';
import {finalReportIds} from '../lib/production-report-order.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
import {orderLaborOutput} from '../lib/production-output-summary.mjs';
test('all order comparisons include approved stages after FINAL and across months',()=>{
 const orders=[],reports=[];
 for(const [i,values] of [[0,[1.5947,7.1233,2.0628,35.1536,1.5831]],[1,[1.2764,15.07,2.1006,27.105,1.6589]],[2,[1.6181,3.9689,9.8819,7.3417,.4094]]]){
  const id='order'+i;orders.push({id,line:i===1?'B':'A',sku:'SKU'+i,laborHour:.02});
  values.forEach((total,j)=>reports.push({id:id+':'+j,transitId:id,kind:'completion',erpStageImport:true,stageName:['CUT','ASSY','CRIMP','PACKING','FINAL'][j],completedAt:j===(i===2?2:3)?'2026-10-15T16:00:00+07:00':j===4?'2026-10-15T14:00:00+07:00':'2026-09-30T10:00:00+07:00',productionDate:j===4?'2026-10-15':'2026-09-30',reviewStatus:'Đã xác nhận',approvedQuantity:j===4?900:0,reportedQuantity:j===4?900:0,hours:{hc:total,ot:0,total}}));
 }
 const ids=finalReportIds(reports,orders),journal=journalOrderHours(reports,orders,ids),old=reportCumulativeHours(reports);
 for(const row of ['A','B'].flatMap(line=>monthlyEarnedOrders(orders,reports,'2026-10',line))){
  const final=reports.find(r=>r.transitId===row.order.id&&ids.has(r.id));
  assert.equal(row.reported,orderLaborOutput(row.order,reports).total);
  assert.equal(row.reported,journal.get(final.id).orderCumulativeHours);
  assert.ok(row.reported>old.get(final.id).orderCumulativeHours);
 }
 const final=reports.find(r=>ids.has(r.id));const extra={...reports[0],id:'cancel',hours:{total:999},cancelled:true};
 assert.equal(journalOrderHours([...reports,extra],orders,ids).get(final.id).orderCumulativeHours,journal.get(final.id).orderCumulativeHours);
 reports[0].hours.total=null;assert.equal(journalOrderHours(reports,orders,ids).get(final.id).orderCumulativeHours,null);
});
