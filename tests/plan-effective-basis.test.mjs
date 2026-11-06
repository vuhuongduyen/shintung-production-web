import test from 'node:test';import assert from 'node:assert/strict';
import {planLaborBasis,applyPlanLaborBasis} from '../lib/plan-effective-basis.mjs';
import {capturePlanLeadtime,transitStandardLeadtime} from '../lib/transit-leadtime.mjs';
import {summary} from '../lib/production-plan.mjs';
import {planTransitBacklog,remainingPlanWithTransitSummary} from '../lib/plan-transit-backlog.mjs';
const rates=[{id:'OLD',status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-04'},{id:'NEW',status:'published',value:.2,validFrom:'2026-11-04'}];
test('planning resolves on confirmation date, independent of schedule and publication order, never the future scalar',()=>{
 const row={sku:'SYNTHETIC',start:'2026-11-02',end:'2026-11-06',plan:1000,laborHour:9,status:'DỰ KIẾN'},before=structuredClone(row);
 const basis=planLaborBasis(row,[rates[1],rates[0]],'2026-11-03');assert.equal(basis.status,'resolved');assert.equal(basis.value,.1);assert.equal(basis.businessDate,'2026-11-03');assert.equal(basis.basis.versionId,'OLD');
 assert.equal(applyPlanLaborBasis(row,new Map([['SYNTHETIC',{laborHour:9,effectiveVersions:rates}]]),'2026-11-03').laborHour,.1);assert.deepEqual(row,before);
 assert.equal(planLaborBasis({...row,start:'2026-12-01',end:'2026-12-31'},rates,'2026-11-03').value,.1);assert.equal(planLaborBasis(row,rates,'2026-11-04').value,.2);
});
test('missing/gapped/ambiguous close-day standards do not fall back to current; closed rows and legacy split rows remain untouched',()=>{
 const row={sku:'SYNTHETIC',start:'2026-11-02',end:'2026-11-06',laborHour:9,status:'DỰ KIẾN'};
 for(const versions of [[],[rates[1]],[...rates,{...rates[0],id:'OVERLAP'}]])assert.equal(planLaborBasis(row,versions,'2026-11-03').status,'missing');
 for(const status of ['ĐÃ CHỐT','ĐÃ CHUYỂN']){const locked={...row,status,planLaborBasis:{status:'resolved',value:9,segments:[]}};assert.equal(applyPlanLaborBasis(locked,new Map(),'2026-12-01'),locked);}
 const gap=[{...rates[0],validTo:'2026-11-03'},rates[1]];assert.equal(planLaborBasis(row,gap,'2026-11-03').status,'missing');assert.equal(planLaborBasis(row,rates,'2026-02-30').status,'missing');
});
test('new unresolved planning load remains unknown, and a transferred resolved basis is not replaced by the latest rate',()=>{
 const row={id:'ROW',week:'2026-11-02',sku:'SYNTHETIC',line:'A',status:'DỰ KIẾN',plan:100,start:'2026-11-02',end:'2026-11-06',laborHour:null,planLaborBasis:{status:'missing'}};
 assert.equal(summary([row],[],row.week)[0].required,null);assert.equal(remainingPlanWithTransitSummary([row],[],row.week)[0].totalRequired,null);
 const daily=[{line:'A',week:row.week,status:'Đã xác nhận',availableHours:100,dailyBudgets:[{date:row.start,available:100}]}];assert.equal(remainingPlanWithTransitSummary([row],daily,row.week)[0].totalRequired,null);
 const transit={id:'TRANSIT',sku:row.sku,week:row.week,line:'A',status:'MỞ',lsxQty:100,completedQty:0,planStart:row.start,planEnd:row.end,laborHour:.2,planLaborBasis:{status:'resolved',value:.2}};
 assert.equal(planTransitBacklog([transit],row.week,[{sku:row.sku,laborHour:99}]).rows[0].hours,20);
});
test('Leadtime version is captured at plan confirmation in GMT+7 and never follows later masters or LSX open date',()=>{
 const row={id:'SYNTHETIC-ROW',sku:'SYNTHETIC',plan:100},versions=[{id:'L1',sku:row.sku,leadTime:2,status:'Hết hiệu lực',confirmedAt:'2026-10-31',validFrom:'2026-11-01',validTo:'2026-11-05'},{id:'L2',sku:row.sku,leadTime:4,status:'Đang áp dụng',validFrom:'2026-11-05'}];
 const old=capturePlanLeadtime(row,[],versions,'2026-11-04T16:59:00Z','QLSX'),next=capturePlanLeadtime(row,[],versions,'2026-11-04T17:00:00Z','QLSX');assert.equal(old.value,2);assert.equal(next.value,4);assert.equal(next.businessDate,'2026-11-05');
 const order={...row,planRowId:row.id,lsxQty:999,planLeadtimeBasis:old};assert.equal(transitStandardLeadtime(order,[{sku:row.sku,cancelled:true}],[],'2027-01-01'),2);
 assert.equal(transitStandardLeadtime({...order,planRowId:'OTHER'},[{sku:row.sku,leadTime:99}]),null);
 const missing=capturePlanLeadtime(row,[],[],'2026-11-03T00:00:00Z','QLSX');assert.equal(missing.value,null);assert.equal(transitStandardLeadtime({...order,planLeadtimeBasis:missing},[{sku:row.sku,leadTime:99}]),null);
 assert.equal(capturePlanLeadtime(row,[{sku:row.sku,leadTime:99}],[versions[1]],'2026-11-03T00:00:00Z','QLSX').value,null,'a future-only version does not prove the current master effective on confirmation day');
 assert.equal(capturePlanLeadtime(row,[],[versions[0],{...versions[0],id:'OVERLAP'}],'2026-11-03T00:00:00Z','QLSX').value,null,'overlapping versions need reconciliation');
});

test('Plan-date preservation retains the existing LSX quantity tier rule using levels observed at confirmation',()=>{
 const row={id:'SYNTHETIC-TIERED',sku:'SYNTHETIC-TIERED',plan:1000},levels=[{sku:row.sku,moq:100,leadTime:2},{sku:row.sku,moq:1000,leadTime:5}];
 const basis=capturePlanLeadtime(row,levels,[],'2026-11-03T00:00:00Z','KHSX');assert.equal(basis.value,5);
 assert.equal(transitStandardLeadtime({...row,planRowId:row.id,lsxQty:50},levels,[]),2,'pre-existing lookup independently defines the quantity tier');
 assert.equal(transitStandardLeadtime({...row,planRowId:row.id,lsxQty:50,planLeadtimeBasis:basis},[{sku:row.sku,leadTime:99}],[]),2,'changing the lookup date must not change the existing MOQ quantity rule');
 assert.equal(transitStandardLeadtime({...row,planRowId:row.id,lsxQty:1000,planLeadtimeBasis:basis},[{sku:row.sku,leadTime:99}],[]),5);
});

test('an explicitly damaged Plan Leadtime basis never crashes or falls back to the current master',()=>{
 const row={id:'SYNTHETIC-DAMAGED',planRowId:'SYNTHETIC-DAMAGED',sku:'SYNTHETIC-DAMAGED',lsxQty:50},saved=[{sku:row.sku,leadTime:99}];
 const base={kind:'plan-close-leadtime-v1',planRowId:row.id,sku:row.sku,closedAt:'2026-11-03T00:00:00Z',value:2};
 for(const basis of [null,'invalid',{...base,tiers:[null]},{...base,tiers:[{moq:100,value:-1}]},{...base,tiers:[{moq:'100',value:2}]}])assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:basis},saved,[]),null);
});
