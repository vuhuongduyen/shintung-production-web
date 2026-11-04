import test from 'node:test';import assert from 'node:assert/strict';
import {buildDailyOutput,dailyOutputTotals,dailyEarnedHours} from '../lib/production-daily-output.mjs';
const order={id:'SYNTHETIC-LSX1',planId:'COMMON-PLAN',planGroupId:'SPLIT-GROUP',lsxCode:'LSX1',sku:'TEST',line:'A',lsxQty:1000,lsxOpenedAt:'2026-11-01',syncStatus:'ĐÃ ĐỒNG BỘ'},rateVersions=[{id:'SYNTHETIC-RATE1',status:'published',validFrom:'2026-11-01',validTo:'2026-11-03',value:.1},{id:'SYNTHETIC-RATE2',status:'published',validFrom:'2026-11-03',value:.2}],input={order,reports:[],quantity:200,productionDate:'2026-11-02',cutoverDate:'2026-11-01',today:'2026-11-04',rateVersions,id:'SYNTHETIC-DAY1',actor:'TEST-LINE-A',recordedAt:'2026-11-04T01:00:00Z'};
test('200 plus 300 means 500/1000, distinct append-only reports with no required stage/person/order hours',()=>{
 const a=buildDailyOutput(input),b=buildDailyOutput({...input,id:'SYNTHETIC-DAY2',quantity:300,reports:[a],productionDate:'2026-11-03'});
 assert.equal(dailyOutputTotals(order,[a,b]).reported,500);assert.equal(dailyEarnedHours(a),20);assert.equal(dailyEarnedHours(b),60);
 for(const r of [a,b])for(const field of ['hours','employees','stageName','startedAt','completedAt'])assert.equal(field in r,false,field);
 const changed=structuredClone(rateVersions);changed[0].value=8;assert.equal(dailyEarnedHours(a),20);
});
test('legacy approved and pending finished output count once; intermediate/cancelled/returned and other split LSX do not',()=>{
 const legacy={id:'OLD',transitId:order.id,kind:'completion',reviewStatus:'Đã xác nhận',reportedQuantity:100,approvedQuantity:100,hours:{total:7}},before=structuredClone(legacy);
 const reports=[legacy,{...legacy,id:'MID',reportedQuantity:0,approvedQuantity:0,stageReporting:true},{...legacy,id:'CANCEL',cancelled:true},{...legacy,id:'RETURN',reviewStatus:'Cần điều chỉnh'},{...legacy,id:'OTHER',transitId:'OTHER-LSX'},{...legacy,id:'PENDING',reviewStatus:'Chờ kiểm tra',reportedQuantity:50}];
 const next=buildDailyOutput({...input,reports});assert.deepEqual(dailyOutputTotals(order,[...reports,next]),{approved:100,pending:250,reported:350});assert.deepEqual(legacy,before);
});
test('cutover is required and dates are validated in Vietnam civil days',()=>{
 for(const patch of [{cutoverDate:null},{productionDate:'2026-10-31'},{productionDate:'2026-11-05'},{productionDate:'2026-02-30'}])assert.throws(()=>buildDailyOutput({...input,...patch}));
});
test('approved missing-rate contract records quantity but blocks earned money instead of using current rate or zero',()=>{
 const r=buildDailyOutput({...input,rateVersions:[]});assert.equal(r.reportedQuantity,200);assert.equal(r.rateBasis,null);assert.equal(r.earnedStandardHours,null);assert.equal(r.rateIssue,'Thiếu căn cứ định mức');assert.equal(dailyEarnedHours(r),null);
 const zero=buildDailyOutput({...input,rateVersions:rateVersions.map(v=>({...v,value:0}))});assert.equal(zero.rateStatus,'resolved');assert.equal(dailyEarnedHours(zero),0);
});
test('invalid amounts, cancelled/unsynced orders, and total above cap reject without input mutation',()=>{
 const before=structuredClone(input);for(const quantity of [0,-1,1.5,1001,NaN])assert.throws(()=>buildDailyOutput({...input,quantity}));
 for(const patch of [{status:'HỦY'},{syncStatus:'CHƯA ĐỒNG BỘ'},{lsxCode:''}])assert.throws(()=>buildDailyOutput({...input,order:{...order,...patch}}));assert.deepEqual(input,before);
});

test('editable Vietnam production time selects its own day and never rewrites audit time',()=>{
 const r=buildDailyOutput({...input,productionLocalDateTime:'2026-11-02T23:59'});assert.equal(r.productionAt,'2026-11-02T16:59:00.000Z');assert.equal(r.reportedAt,input.recordedAt);assert.equal(r.productionDate,'2026-11-02');assert.equal(r.rateBasis.value,.1);
 for(const productionLocalDateTime of ['2026-11-03T08:00','2026-11-02T24:00','2026-11-02T08:60','2026-11-02T08:00Z'])assert.throws(()=>buildDailyOutput({...input,productionLocalDateTime}));
 assert.throws(()=>buildDailyOutput({...input,productionDate:'2026-11-04',productionLocalDateTime:'2026-11-04T08:01'}));
});

test('monthly daily earnings sum immutable per-day rates, preserve legacy contract and block missing basis',async()=>{
 const {monthlyEarnedOrders}=await import('../lib/production-payroll.mjs');
 const confirmed=r=>({...r,reviewStatus:'Đã xác nhận',approvedQuantity:r.reportedQuantity});
 const a=confirmed(buildDailyOutput(input)),b=confirmed(buildDailyOutput({...input,quantity:300,id:'OTHER',productionDate:'2026-11-03'}));
 const rates=new Map([['TEST',9]]),row=monthlyEarnedOrders([order],[a,b],'2026-11','A',rates,true)[0];assert.equal(row.qty,500);assert.equal(row.earned,80);assert.equal(row.source,'Theo ngày sản xuất');assert.equal(row.unit,null);assert.equal(row.basis.length,2);
 const missing=confirmed(buildDailyOutput({...input,id:'MISSING',rateVersions:[]}));assert.equal(monthlyEarnedOrders([order],[a,missing],'2026-11','A',rates,true)[0].earned,null);
 const legacy={id:'LEGACY',kind:'completion',transitId:order.id,productionDate:'2026-11-01',reviewStatus:'Đã xác nhận',approvedQuantity:10};assert.equal(monthlyEarnedOrders([order],[legacy],'2026-11','A',rates,true)[0].earned,90);
 assert.equal(monthlyEarnedOrders([order],[a,b],'2026-12','A',rates,true).length,0);
});

test('legacy aggregate baseline is preserved once when first daily reports arrive and is not counted twice on refresh',()=>{
 const oldOrder={...order,completedQty:100},a=buildDailyOutput({...input,order:oldOrder}),approved={...a,reviewStatus:'Đã xác nhận',approvedQuantity:200};assert.equal(a.legacyCompletedBaseline,100);
 assert.deepEqual(dailyOutputTotals(oldOrder,[a]),{approved:100,pending:200,reported:300});assert.equal(dailyOutputTotals({...oldOrder,completedQty:300},[approved]).approved,300);
 const b=buildDailyOutput({...input,id:'SECOND',quantity:300,order:{...oldOrder,completedQty:300},reports:[approved]});assert.equal(b.legacyCompletedBaseline,100);assert.equal(dailyOutputTotals({...oldOrder,completedQty:300},[approved,b]).reported,600);
 const imported={id:'LEGACY-SAME',transitId:order.id,kind:'completion',reviewStatus:'Đã xác nhận',approvedQuantity:100,reportedQuantity:100};assert.equal(dailyOutputTotals(oldOrder,[approved,imported]).approved,300);
});

test('indexed totals preserve source/legacy matching and split-order isolation',async()=>{
 const {dailyOutputTotalsIndex}=await import('../lib/production-daily-output.mjs');const orders=[order,{...order,id:'OTHER',lsxCode:'OTHER-LSX'},{...order,id:'LEGACY-ORDER',lsxCode:'LEGACY',planId:'OLD',planGroupId:undefined}];const reports=[buildDailyOutput(input),{id:'CODE',kind:'completion',lsxCode:'legacy',reportedQuantity:15,reviewStatus:'Chờ kiểm tra'},{id:'PLAN',kind:'completion',planId:'OLD',reportedQuantity:10,reviewStatus:'Đã xác nhận'},{id:'SHARED',kind:'completion',planId:order.planId,reportedQuantity:999,reviewStatus:'Chờ kiểm tra'}];const index=dailyOutputTotalsIndex(orders,reports);for(const o of orders)assert.deepEqual(index.get(o.id),dailyOutputTotals(o,reports));
});
