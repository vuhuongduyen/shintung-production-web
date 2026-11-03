import test from 'node:test';
import assert from 'node:assert/strict';
import {paginationMutation} from '../lib/table-pagination.mjs';
const element = (pager=false, table=false) => ({nodeType:1,closest: selector=>selector==='.table-pagination'?pager:table});
test('pager updates and unrelated toolbar updates do not rebuild pagination',()=>{
 assert.equal(paginationMutation({target:element(true,true)}),false);
 assert.equal(paginationMutation({target:element()}),false);
});
test('row replacement and new table insertion still refresh pagination',()=>{
 assert.equal(paginationMutation({target:element(false,true)}),true);
 assert.equal(paginationMutation({target:element(),addedNodes:[{nodeType:1,querySelector:()=>true}]}),true);
 assert.equal(paginationMutation({target:{nodeType:3,parentElement:element(false,true)}}),true);
});
