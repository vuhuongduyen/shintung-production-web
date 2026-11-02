import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleDraftSync} from '../lib/actual-schedule-draft.mjs';
test('background refresh preserves edits and original concurrency versions; changing context loads new schedule',()=>{
 const sync=createScheduleDraftSync(), base=[{date:'2026-10-26',hcEnd:'17:00'}];
 const first=sync.sync('week:A',[],base,1,{version:2});
 first.days[0].hcEnd='18:00';
 assert.equal(sync.sync('week:A',first.days,base,2,{version:3}),null);
 assert.equal(first.version,1); assert.equal(first.approved.version,2);
 assert.equal(sync.sync('week:B',first.days,base,5,{version:6}).version,5);
});
test('unchanged draft receives updates once and successful save releases it',()=>{
 const sync=createScheduleDraftSync(), base=[{hcEnd:'17:00'}];
 sync.sync('A',[],base,1,{version:1});
 assert.equal(sync.sync('A',base,base,1,{version:1}),null);
 assert.equal(sync.sync('A',base,base,2,{version:1}).version,2);
 sync.reset();
 assert.equal(sync.sync('A',[{hcEnd:'18:00'}],base,3,{version:1}).version,3);
});
