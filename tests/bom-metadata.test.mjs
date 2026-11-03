import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../app/bom-data.json' with {type:'json'};
import {bomMetadataResolver} from '../lib/bom-metadata.mjs';

test('all existing BOM classifications remain distinct from live SKU product groups',()=>{
 const masters=baseline.map(b=>({code:b.sku,group:`Nhóm ${b.sku}`}));
 const resolve=bomMetadataResolver(masters,baseline);
 for(const b of baseline){
  const result=resolve({...b,category:'Nhóm sai',group:'Nhóm cũ'});
  assert.equal(result.category,b.category);assert.equal(result.group,`Nhóm ${b.sku}`);
  assert.deepEqual(result.items,b.items);assert.equal(result.version,b.version);
 }
 const changed=bomMetadataResolver([{code:baseline[0].sku,group:'Nhóm mới'}],baseline)(baseline[0]);
 assert.equal(changed.group,'Nhóm mới');assert.equal(changed.category,baseline[0].category);
});
test('pending SKU edits use approved master group, valid classifications are preserved',()=>{
 const resolve=bomMetadataResolver([{code:'ROOT',group:'Chờ duyệt',status:'Chờ xác nhận',currentData:{group:'Đang áp dụng'}}]);
 assert.deepEqual(resolve({sku:'ROOT',category:'BÁN THÀNH PHẨM'}),{sku:'ROOT',category:'BÁN THÀNH PHẨM',group:'Đang áp dụng'});
 assert.equal(resolve({sku:'UNKNOWN',category:'THÀNH PHẨM'}).group,'');
});
