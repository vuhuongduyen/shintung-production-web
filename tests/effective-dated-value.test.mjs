import test from 'node:test';import assert from 'node:assert/strict';
import {effectiveValueOn,appendEffectiveVersion} from '../lib/effective-dated-value.mjs';
const a={id:'SYNTHETIC-v1',status:'published',validFrom:'2026-11-01',validTo:'2026-11-10',value:.1,source:'synthetic-approved',publishedAt:'2026-10-30T01:00:00Z'},b={...a,id:'SYNTHETIC-v2',validFrom:'2026-11-10',validTo:null,value:.2};
test('business-day ranges are half-open and recorded-at never determines the rate',()=>{
 assert.equal(effectiveValueOn([a,b],'2026-11-09').basis.value,.1);assert.equal(effectiveValueOn([a,b],'2026-11-10').basis.value,.2);
 assert.equal(effectiveValueOn([a,b],'2026-10-31').reason,'missing');assert.equal(effectiveValueOn([a],'2026-11-10T00:00:00Z').reason,'invalid-date');assert.equal(effectiveValueOn([a],'2026-02-30').reason,'invalid-date');
});
test('snapshot stays unchanged after current value changes or is cancelled; wrong-day snapshot is never reused',()=>{
 const snapshot=effectiveValueOn([a,b],'2026-11-02').basis,before=structuredClone(snapshot);a.value=9;
 assert.equal(effectiveValueOn([{...a,status:'cancelled'}],'2026-11-02',snapshot).basis.value,.1);assert.deepEqual(snapshot,before);assert.equal(effectiveValueOn([],'2026-11-03',snapshot).reason,'invalid-snapshot');a.value=.1;
});
test('missing, overlapping, invalid or unpublished versions never fall back to current master',()=>{
 assert.equal(effectiveValueOn([{...a,status:'draft'}],'2026-11-02').reason,'missing');assert.equal(effectiveValueOn([a,{...b,validFrom:'2026-11-05'}],'2026-11-06').reason,'ambiguous');assert.equal(effectiveValueOn([{...a,validTo:a.validFrom}],'2026-11-02').reason,'invalid-version');
});
test('adding a version copies input and rejects duplicate/overlapping history without modifying anything',()=>{
 const old=[a],before=structuredClone(old),next=appendEffectiveVersion(old,b);assert.deepEqual(old,before);next[0].value=7;assert.equal(old[0].value,.1);
 assert.throws(()=>appendEffectiveVersion(old,{...b,validFrom:'2026-11-05'}),/chồng lấn/);assert.throws(()=>appendEffectiveVersion(old,a),/ID/);assert.deepEqual(old,before);
});

test('publishing dated rate preserves old values, splits interval and refuses same-day overwrite',async()=>{
 const {publishEffectiveValue}=await import('../lib/effective-dated-value.mjs');
 const old=[{id:'OLD',status:'published',validFrom:'2026-11-01',value:.1}],before=structuredClone(old);
 const next=publishEffectiveValue(old,{id:'NEW',status:'published',validFrom:'2026-11-03',value:.2});
 assert.deepEqual(old,before);assert.equal(effectiveValueOn(next,'2026-11-02').basis.value,.1);assert.equal(effectiveValueOn(next,'2026-11-03').basis.value,.2);
 assert.throws(()=>publishEffectiveValue(next,{id:'DUP',status:'published',validFrom:'2026-11-03',value:9}));
 const earlier=publishEffectiveValue(next,{id:'EARLY',status:'published',validFrom:'2026-10-01',value:.05});assert.equal(effectiveValueOn(earlier,'2026-10-31').basis.value,.05);assert.equal(effectiveValueOn(earlier,'2026-11-02').basis.value,.1);
});
