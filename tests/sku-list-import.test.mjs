import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSkuList,missingSkuRows,importedSkuDraft} from '../lib/sku-list-import.mjs';
test('keeps missing data blank, retains zero reference and never confirms the draft',()=>{
 const [row]=parseSkuList('101ABC\tTên sản phẩm\t\tNhóm\t\t0.000');
 const draft=importedSkuDraft(row,'source.pdf');
 assert.equal(draft.line,'');assert.equal(draft.unit,'');assert.equal(draft.mode,'');
 assert.equal(draft.specification,'');assert.equal(draft.sourceLaborHour,0);
 assert.equal(draft.standardHours,'Chưa thiết lập');assert.equal(draft.confirmation_status,undefined);
 assert.deepEqual(draft.processes,[]);
});
test('existing and cancelled codes are never imported again',()=>{
 const rows=parseSkuList('A\tA\t\tG\tA\t0\nB\tB\t\tG\tNK\t0.1');
 assert.equal(rows[0].line,'Line A');assert.equal(rows[1].line,'NK');
 assert.deepEqual(missingSkuRows(rows,[{key:'a',payload:{cancelled:true}}]).map(row=>row.code),['B']);
});
test('reject duplicate and invalid data before writes',()=>{
 for(const value of ['A\tName','A\t\t\t\t\t0','A\tName\t\t\t\t-1','A\tName\t\t\t\t0\nA\tName\t\t\t\t1'])assert.throws(()=>parseSkuList(value));
});
