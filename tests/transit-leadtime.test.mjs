import test from 'node:test';import assert from 'node:assert/strict';import {transitStandardLeadtime as get} from '../lib/transit-leadtime.mjs';
const order={sku:'106VS05',lsxQty:20},at='2026-10-24T00:00:00Z';
test('base, saved and effective version precedence; no draft/cancelled fallback',()=>{
 assert.equal(get(order),2);assert.equal(get({sku:'102TC12003',lsxQty:600}),5);
 assert.equal(get(order,[{sku:'106VS05',leadTime:4}]),4);
 const v={sku:'106VS05',leadTime:6,status:'Đang áp dụng',validFrom:'2026-10-20'};
 assert.equal(get(order,[],[v],at),6);
 assert.equal(get(order,[],[{...v,status:'Nháp'}],at),2);
 assert.equal(get(order,[],[{...v,validFrom:'2026-11-01'}],at),2);
 assert.equal(get(order,[{sku:'106VS05',cancelled:true}], [v],at),null);
 assert.equal(get({sku:'unknown'}),null);
 assert.equal(get(order,[{sku:'106VS05',leadTime:0}]),0);
});
