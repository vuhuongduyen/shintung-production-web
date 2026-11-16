import test from 'node:test';import assert from 'node:assert/strict';
import {productionOrderPageUrl,applyPagedProductionSave} from '../lib/production-order-page-client.mjs';
test('only applied filters enter the page/export URL and values remain literal query values',()=>{
 const q=new URL(productionOrderPageUrl({page:3,line:'A',sort:'start',applied:{field:'LSX',query:'A & B%?',line:'A',status:'all'}}),'https://synthetic.test').searchParams;
 assert.equal(q.get('page'),'3');assert.equal(q.get('query'),'A & B%?');assert.equal(q.get('field'),'LSX');assert.equal(q.has('pageSize'),false);
 const exported=new URL(productionOrderPageUrl({format:'csv',applied:{field:'Line',line:'B'}}),'https://synthetic.test').searchParams;assert.equal(exported.get('format'),'csv');assert.equal(exported.get('line'),'B');
});
test('successful new report changes only pending quantities once; replay waits for server reconciliation',()=>{
 const snapshot={orders:[{id:'ORDER-A',serverSummary:{totals:{approved:200,pending:0,reported:200}}},{id:'ORDER-B',serverSummary:{totals:{approved:50,pending:10,reported:60}}}],totals:{approved:250,pending:10}},seen=new Set(),saved={report:{id:'REPORT',transitId:'ORDER-A',reportedQuantity:300}};
 const after=applyPagedProductionSave(snapshot,saved,seen);assert.equal(after.totals.approved,250);assert.equal(after.totals.pending,310);assert.equal(after.orders[0].serverSummary.totals.reported,500);assert.deepEqual(after.orders[1],snapshot.orders[1]);assert.equal(snapshot.totals.pending,10);
 assert.equal(applyPagedProductionSave(after,saved,seen),after);assert.equal(applyPagedProductionSave(after,{...saved,replayed:true},new Set()),after);
});
