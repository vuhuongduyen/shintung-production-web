import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDemand,engineDemandMatches,engineInputRows} from '../lib/engine-demand.mjs';
const week='2026-10-19',event={sku:'102TC12001',status:'Chưa lập kế hoạch',planningWeekStart:week,type:'Bù tải',qty:1200};
const snapshot={week,rows:[{id:'r',sku:event.sku}],metrics:[['r',{fillQty:1200,eventQty:0,eventWeek:1200}]]};
test('planned Demand is excluded and old Engine becomes invalid',()=>{
 assert.equal(pendingDemand(event,week),true);
 assert.equal(engineDemandMatches(snapshot,[event]),true);
 assert.equal(pendingDemand({...event,status:'ĐÃ LẬP KẾ HOẠCH'},week),false);
 assert.equal(engineDemandMatches(snapshot,[{...event,status:'Đã lập kế hoạch'}]),false);
 assert.equal(engineDemandMatches({...snapshot,metrics:[['r',{fillQty:0,eventQty:0,eventWeek:0}]]},[{...event,status:'Đã lập kế hoạch'}]),true);
});
test('same total with different type is stale; other weeks and deleted rows excluded',()=>{
 assert.equal(engineDemandMatches(snapshot,[{...event,type:'Phát sinh'}]),false);
 assert.equal(pendingDemand({...event,_deleted:true},week),false);
 assert.equal(pendingDemand(event,'2026-10-26'),false);
 assert.equal(engineDemandMatches(snapshot,[event,{...event,status:'Đã lập kế hoạch'},{...event,planningWeekStart:'2026-10-26'}]),true);
});

test('demand-only SKU is included once with zero forecast; planned, deleted and other weeks excluded',()=>{
 const e={...event,sku:'3030901',qty:2000};
 const rows=engineInputRows([], [e,e,{...e,sku:'planned',status:'Đã lập kế hoạch'},{...e,sku:'deleted',_deleted:true},{...e,sku:'other',planningWeekStart:'2026-10-26'}], '10/2026',week);
 assert.deepEqual(rows.map(r=>[r.sku,r.used]),[['3030901',0]]);
 assert.equal(engineDemandMatches({week,rows:[],metrics:[]},[e]),false);
 const f={sku:'3030901',applicationMonth:'10/2026',used:9,sourceReportMonth:'09/2026'};
 assert.deepEqual(engineInputRows([f], [e], '10/2026',week),[f]);
 assert.equal(engineInputRows([{...f,applicationMonth:'09/2026'}],[e],'10/2026',week)[0].used,0);
});
