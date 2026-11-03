import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRow,validPlanGroups,primaryPlanRow,transitMatchesPlan,planCoveredByTransit,transitPlanAllocationKey,summary} from '../lib/production-plan.mjs';
const week='2026-11-02',root=normalizeRow({id:'ROOT',week,sku:'SYNTHETIC',line:'A',plan:80,suggested:100,laborHour:0.5});
const main={...root,planGroupId:root.id,groupPlanId:root.planId};
const child=normalizeRow({...main,id:'CHILD',splitFromId:main.id,plan:null,suggested:100});
test('group label stays stable across Line/date/quantity edits while rows retain independent IDs and a single suggestion',()=>{
 const changed=normalizeRow({...child,line:'B',start:'2026-11-04',end:'2026-11-05',plan:150});
 assert.equal(changed.planId,main.planId);assert.equal(normalizeRow({...main,line:'B'}).planId,main.planId);assert.equal(changed.id,'CHILD');assert.equal(changed.suggested,null);assert.equal(primaryPlanRow(changed),false);assert.equal(primaryPlanRow(main),true);
 assert.equal(normalizeRow({...root,line:'B'}).planId.endsWith('-B'),true,'legacy line/ID behaviour is unchanged');
 assert.equal(validPlanGroups([main,changed]),true);
 for(const plan of [10,150]){const row={...changed,plan,line:'A'};assert.equal(summary([main,row],[],week)[0].required,(80+plan)*0.5);}
});
test('only declared coherent split siblings relax duplicate-week/SKU guard; malformed and legacy duplicates stay conflicts',()=>{
 assert.equal(validPlanGroups([root]),true);assert.equal(validPlanGroups([root,{...root,id:'DUP'}]),false);
 assert.equal(validPlanGroups([main,child]),true);
 for(const invalid of [{...child,planGroupId:'OTHER'},{...child,groupPlanId:'OTHER'},{...child,splitFromId:'MISSING'},{...child,splitFromId:child.id},{...child,id:main.id}])assert.equal(validPlanGroups([main,invalid]),false);
 assert.equal(validPlanGroups([child]),false);
});
test('explicit row linkage wins, siblings never match by shared Plan ID, legacy unlinked fallback remains',()=>{
 const transit={planRowId:main.id,planId:main.planId,week,sku:main.sku};
 assert.equal(transitMatchesPlan(main,transit),true);assert.equal(transitMatchesPlan(child,transit),false);
 assert.equal(transitMatchesPlan(child,{...transit,planRowId:''}),false);assert.equal(transitMatchesPlan(root,{...transit,planRowId:''}),true);
 const backlog={coveredRowIds:[main.id],coveredPlanIds:[main.planId]};assert.equal(planCoveredByTransit(main,backlog),true);assert.equal(planCoveredByTransit(child,backlog),false);
 assert.notEqual(transitPlanAllocationKey({...transit,planGroupId:main.id}),transitPlanAllocationKey({...transit,planGroupId:main.id,planRowId:child.id}));
 assert.equal(transitPlanAllocationKey({planId:'LEGACY'}),'plan:LEGACY');
});

test('Plan-ID-only production reports cannot duplicate completion across split rows; exact source IDs still work',async()=>{
 const {normalizeTransit,mergeProduction}=await import('../lib/in-transit.mjs');
 const a=normalizeTransit({id:'ORDER-A',planRowId:main.id,planGroupId:main.id,planId:main.planId,lsxQty:100}),b=normalizeTransit({...a,id:'ORDER-B',planRowId:child.id});
 const report={id:'REPORT',planId:main.planId,kind:'completion',reportedQuantity:10,reviewStatus:'Đã xác nhận'};
 assert.equal(mergeProduction(a,[report]).completedQty,0);assert.equal(mergeProduction(b,[report]).completedQty,0);
 assert.equal(mergeProduction(a,[{...report,transitId:b.id}]).completedQty,0);assert.equal(mergeProduction(b,[{...report,transitId:b.id}]).completedQty,10);
 assert.equal(mergeProduction(normalizeTransit({id:'LEGACY',planId:main.planId,lsxQty:100}),[report]).completedQty,10,'legacy non-split fallback stays intact');
});
