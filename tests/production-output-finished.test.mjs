import test from 'node:test';import assert from 'node:assert/strict';
import {dailyProductionOutput,orderLaborOutput} from '../lib/production-output-summary.mjs';
test('only finished output creates daily rows and exit counts; intermediate labor remains counted',()=>{
 const orders=[{id:'o',lsxQty:250,actualCompletedAt:'2026-10-22T09:48:44+07:00'}];
 const make=(id,stage,date,quantity,hours,extra={})=>({id,transitId:'o',kind:'completion',stageName:stage,stageQuantity:250,reportedQuantity:quantity,approvedQuantity:quantity,productionDate:date,completedAt:date+'T09:48:44+07:00',reviewStatus:'Đã xác nhận',hours:{hc:hours,ot:0,total:hours},...extra});
 const reports=[make('cut','CUT','2026-10-21',0,8),make('assy','ASSY','2026-10-22',0,4),make('final','FINAL','2026-10-22',250,2)];const before=JSON.stringify(reports);
 const rows=dailyProductionOutput(orders,reports);assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-10-22');assert.equal(rows[0].approved,250);assert.deepEqual(rows[0].reports.map(r=>r.id),['final']);assert.equal(orderLaborOutput(orders[0],reports).total,14);assert.equal(JSON.stringify(reports),before);
 assert.deepEqual(dailyProductionOutput(orders,reports.slice(0,2)),[]);
});
test('partial final, pending and legacy finished quantities remain; void/zero quantities never appear',()=>{
 const o={id:'o'};const base={kind:'completion',transitId:'o',productionDate:'2026-10-01',reviewStatus:'Đã xác nhận',reportedQuantity:100,approvedQuantity:100};
 const reports=[{...base,id:'legacy'},{...base,id:'partial',stageName:'FINAL',reportedQuantity:50,approvedQuantity:50},{...base,id:'pending',reviewStatus:'Chờ kiểm tra',reportedQuantity:25,approvedQuantity:0},{...base,id:'zero',approvedQuantity:0},{...base,id:'cancelled',cancelled:true},{...base,id:'replaced',replacedByStageBatch:'x'}];
 const rows=dailyProductionOutput([o],reports);assert.equal(rows.length,1);assert.equal(rows[0].approved,150);assert.equal(rows[0].pending,25);assert.equal(rows[0].reports.length,3);
});
test('same output rule across monthly efficiency and order labor: no output rows, preserve production hours',async()=>{
 const {monthlyEarnedOrders}=await import('../lib/production-payroll.mjs');
 const {hasFinishedOutput,hasOrderOutput}=await import('../lib/production-output-summary.mjs');
 const order={id:'o',line:'A',lsxQty:250,laborHour:.1};
 const cut={id:'cut',transitId:'o',kind:'completion',stageName:'CUT',productionDate:'2026-09-30',reportedQuantity:0,approvedQuantity:0,reviewStatus:'Đã xác nhận',hours:{hc:10,ot:0,total:10}};
 const final={...cut,id:'final',stageName:'FINAL',standardUnit:.1,productionDate:'2026-10-01',reportedQuantity:250,approvedQuantity:250,hours:{hc:2,ot:0,total:2}};
 assert.equal(hasFinishedOutput(cut),false);assert.equal(hasOrderOutput(orderLaborOutput(order,[cut])),false);
 assert.deepEqual(monthlyEarnedOrders([order],[cut,final],'2026-09','A'),[]);
 assert.equal(monthlyEarnedOrders([order],[cut,final],'2026-10','A')[0].earned,25);
 assert.equal(hasOrderOutput(orderLaborOutput(order,[cut,final])),true);assert.equal(orderLaborOutput(order,[cut,final]).total,12);
 assert.deepEqual(monthlyEarnedOrders([order],[{...final,replacedByStageBatch:'new'}],'2026-10','A'),[]);
});
