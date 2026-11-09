import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLaborHoursText,reconcileLaborHours} from '../lib/labor-hours-reconcile.mjs';
import {publishEffectiveValue} from '../lib/effective-dated-value.mjs';
const master=code=>({code,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
test('PDF overrides different values including explicit zero; missing codes are retained',()=>{
  const records=[{sku:'A',laborHour:1,version:3,note:'keep'},{sku:'B',laborHour:2},{sku:'C',laborHour:3}];
  const snapshot=JSON.stringify(records);
  const result=reconcileLaborHours(parseLaborHoursText('A\t0.000\nB 2,000'),['A','B','C'].map(master),records);
  assert.equal(result.retained,1);assert.equal(result.unchanged,1);
  assert.equal(result.changes.length,1);assert.equal(result.changes[0].laborHour,0);
  assert.equal(result.changes[0].old.version,3);assert.equal(result.changes[0].old.note,'keep');
  assert.equal(JSON.stringify(records),snapshot);
});
test('does not invent SKU, restore cancelled records or write unusable masters',()=>{
  const result=reconcileLaborHours(parseLaborHoursText('A 1\nB 2\nC 3\nD 4'),[master('B'),{...master('C'),cancelled:true},master('D')],[{sku:'B',cancelled:true,laborHour:0}]);
  assert.equal(result.skipped,3);assert.deepEqual(result.changes.map(row=>row.sku),['D']);
});
test('rejects duplicate, malformed, missing and negative hours',()=>{
  for(const text of ['A 1\nA 2','A','A -1','A nope','A 1 2'])assert.throws(()=>parseLaborHoursText(text));
});

test('mixed PDF identifies missing master with resolution and keeps web-only records',()=>{const r=reconcileLaborHours(parseLaborHoursText('A 2\nB 3\nMISSING 4'),[master('A'),master('B')],[{sku:'A',laborHour:1},{sku:'WEBONLY',laborHour:9}]);assert.deepEqual(r.changes.map(x=>[x.sku,Boolean(x.old)]),[['A',true],['B',false]]);assert.equal(r.retained,1);assert.match(r.rows.find(x=>x.sku==='MISSING').guidance,/SKU Master.*xác nhận/);});

test('dated PDF compares the selected day, not current scalar, and recognizes a saved future revision',()=>{
 const versions=[{id:'OLD',status:'published',validFrom:'2026-10-01',validTo:'2026-11-01',value:.01},{id:'NEW',status:'published',validFrom:'2026-11-01',value:.016}];
 const record={sku:'A',laborHour:.016,version:2,effectiveVersions:versions},incoming=[{sku:'A',laborHour:.016}];
 assert.equal(reconcileLaborHours(incoming,[master('A')],[record],'2026-10-15').changes.length,1);
 assert.equal(reconcileLaborHours(incoming,[master('A')],[record],'2026-11-01').unchanged,1);
 assert.equal(reconcileLaborHours(incoming,[master('A')],[record],'').changes.length,0);
 assert.equal(reconcileLaborHours(incoming,[master('A')],[{...record,effectiveVersions:[]}],'2026-10-15').changes.length,1,'scalar alone does not prove a dated value');
 const future=publishEffectiveValue(versions,{id:'FUTURE',status:'published',validFrom:'2099-01-01',value:.03});
 const revised=publishEffectiveValue(future,{id:'CORRECTED',status:'published',validFrom:'2099-01-01',value:.04});
 assert.equal(reconcileLaborHours([{sku:'A',laborHour:.04}],[master('A')],[{...record,effectiveVersions:revised}],'2099-01-01').unchanged,1);
 assert.equal(reconcileLaborHours([{sku:'A',laborHour:0}],[master('A')],[record],'2026-10-15').changes.length,1);
 assert.equal(reconcileLaborHours(incoming,[master('A')],[{...record,effectiveVersions:[...versions,{...versions[0],id:'OVERLAP'}]}],'2026-10-15').changes.length,0);
});
