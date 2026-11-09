import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationDateError as check} from '../lib/leadtime-confirmation.mjs';
const now='2026-11-08T17:05:00Z';
test('Leadtime starts at confirmation; Safety uses confirmation day in Vietnam',()=>{
 assert.equal(check('leadtime_versions',{status:'Đang áp dụng',confirmedAt:now,validFrom:now},null,now),'');
 for(const entity of ['safety_rules','safety_rule_groups'])assert.equal(check(entity,{status:'Đang áp dụng',confirmedAt:now,effectiveFrom:'2026-11-09'},null,now),'');
 for(const date of ['2026-11-08','2026-11-10','2026-02-30',''])assert.notEqual(check('safety_rules',{status:'Đã xác nhận',confirmedAt:now,effectiveFrom:date},null,now),'');
 assert.notEqual(check('leadtime_versions',{status:'Đang áp dụng',confirmedAt:now,validFrom:'2026-11-10'},null,now),'');
});
test('a client cannot backdate confirmation to justify an old or future effective date',()=>{
 for(const confirmedAt of ['2026-11-07T00:00:00Z','2026-11-10T00:00:00Z','2026-02-30','']){
  assert.notEqual(check('leadtime_versions',{status:'Đang áp dụng',confirmedAt,validFrom:confirmedAt},null,now),'');
 }
 assert.notEqual(check('safety_rules',{status:'Đã xác nhận',confirmedAt:now,effectiveFrom:'2026-11-09',effectiveTo:'2026-11-08'},null,now),'');
});
test('existing confirmation provenance survives closure and cannot be edited later',()=>{
 const before={status:'Đang áp dụng',confirmedAt:'2026-10-01T01:00:00Z',validFrom:'2026-10-01T01:00:00Z'};
 assert.equal(check('leadtime_versions',{...before,status:'Hết hiệu lực',validTo:now},before,now),'');
 assert.notEqual(check('leadtime_versions',{...before,validFrom:now},before,now),'');
 assert.notEqual(check('leadtime_versions',{...before,confirmedAt:now},before,now),'');
 assert.equal(check('safety_rules',{status:'Nháp',effectiveFrom:''},null,now),'');
 assert.equal(check('unrelated',{status:'Đang áp dụng'},null,now),'');
});
