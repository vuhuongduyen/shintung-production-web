import test from 'node:test';import assert from 'node:assert/strict';
import {laborRateTimeline,laborUpdatedDate,previewLaborRateBackfill} from '../lib/labor-rate-timeline.mjs';
import {effectiveValueOn} from '../lib/effective-dated-value.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
const sku='SYNTHETIC-DATED';
const h=(version,value,at,extra={})=>({id:'H'+version,sku,version,newLaborHour:value,at,...extra});
const value=(versions,date)=>effectiveValueOn(versions,date).basis?.value??null;
test('each menu revision uses effective date or its own GMT+7 update day, never latest scalar retroactively',()=>{
 const history=[h(1,.017,'2026-09-17T03:00:00Z'),h(2,.016,'2026-10-16T03:00:00Z'),h(3,16,'2026-11-07T03:00:00Z',{isTest:true}),h(4,.015,'2026-11-09T03:00:00Z')];
 const before=structuredClone(history),r=laborRateTimeline({sku,laborHour:.015,version:4,updatedAt:history[3].at},history);
 assert.equal(value(r.versions,'2026-09-16'),null);assert.equal(value(r.versions,'2026-09-17'),.017);assert.equal(value(r.versions,'2026-10-16'),.016);assert.equal(value(r.versions,'2026-11-08'),.016);assert.equal(value(r.versions,'2026-11-09'),.015);assert.deepEqual(history,before);assert.match(r.issues[0],/excluded-test/);
 assert.equal(laborUpdatedDate('2026-11-08T17:00:00Z'),'2026-11-09');assert.equal(laborUpdatedDate('2026-11-08T17:00:00'),null);
});
test('explicit business correction changes the business boundary without changing its true audit timestamp',()=>{
 const history=[h(1,.017,'2026-09-17T03:00:00Z'),h(2,.016,'2026-10-16T03:00:00Z')];
 const explicit=[{id:'FIX',status:'published',revision:3,value:0,validFrom:'2026-11-07',publishedAt:'2026-11-09T03:00:00Z'}];
 const r=laborRateTimeline({sku,effectiveVersions:explicit},history);assert.equal(value(r.versions,'2026-11-06'),.016);assert.equal(value(r.versions,'2026-11-07'),0);assert.equal(explicit[0].publishedAt,'2026-11-09T03:00:00Z');
 const saved={versionId:'OLD',productionDate:'2026-11-07',value:.016};assert.equal(effectiveValueOn(r.versions,'2026-11-07',saved).basis.value,.016);
});
test('future first explicit rate retains dated legacy interval in menu; PDF baseline is available only since its update day',()=>{
 const row={key:sku,payload:{sku,laborHour:.016,version:2,effectiveVersions:[{id:'F',status:'published',revision:2,value:.03,validFrom:'2026-11-10'}]}};
 const history=[h(1,.016,'2026-10-16T03:00:00Z')];assert.equal(siteLaborHours([row],'2026-11-09',history).find(r=>r.key===sku).payload.laborHour,.016);
 assert.equal(siteLaborHours([row],'2026-11-10',history).find(r=>r.key===sku).payload.laborHour,.03);
 const baseline=siteLaborHours([]).find(r=>r.payload.laborHour>0);assert.equal(value(baseline.payload.resolvedRateVersions,'2026-09-16'),null);assert.equal(value(baseline.payload.resolvedRateVersions,'2026-09-17'),baseline.payload.laborHour);
});
test('invalid explicit intervals and dates fail closed; an older value cannot fill an explicit gap',()=>{
 const bad=[{id:'X',status:'published',value:1,validFrom:'2026-11-01'},{id:'Y',status:'published',value:2,validFrom:'2026-11-02'}];assert.deepEqual(laborRateTimeline({sku,effectiveVersions:bad},[h(1,.1,'2026-10-01')]).versions,bad);
 const r=laborRateTimeline({sku,effectiveVersions:[{id:'X',status:'published',revision:2,value:1,validFrom:'2026-11-01',validTo:'2026-11-03'}]},[h(1,.1,'2026-10-01')]);assert.equal(value(r.versions,'2026-11-04'),null);
});
test('backfill is a pure preview; existing report basis wins and no report is rewritten',()=>{
 const reports=[{id:'old',sku,productionDate:'2026-11-09',rateBasis:{value:7}},{id:'missing',sku,productionDate:'2026-11-09'}],before=structuredClone(reports);
 const menu=new Map([[sku,{resolvedRateVersions:laborRateTimeline({sku,laborHour:.1,version:1,updatedAt:'2026-11-09T03:00:00Z'}).versions}]]);
 const preview=previewLaborRateBackfill(reports,menu);assert.equal(preview[0].status,'preserve-saved-basis');assert.equal(preview[1].status,'proposed-only');assert.equal(preview[1].proposedBasis.value,.1);assert.deepEqual(reports,before);
});

test('current V2 falls back to its update day even when an explicit V1 exists',()=>{
 const explicit=[{id:'V1',revision:1,status:'published',value:.1,validFrom:'2026-11-01'}];
 const r=laborRateTimeline({sku,version:2,laborHour:.2,updatedAt:'2026-11-03T03:00:00Z',effectiveVersions:explicit});
 assert.equal(value(r.versions,'2026-11-02'),.1);assert.equal(value(r.versions,'2026-11-03'),.2);
 assert.equal(explicit[0].validTo,undefined);
});
for(const flag of [{isTest:true},{usage:'test'},{status:'test'}])test('test audit excludes matching explicit and scalar revision '+JSON.stringify(flag),()=>{
 const explicit=[{id:'V1',revision:1,status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-03'},{id:'V2',revision:2,status:'published',value:16,validFrom:'2026-11-03'}];
 const record={sku,version:2,laborHour:16,updatedAt:'2026-11-03T03:00:00Z',effectiveVersions:explicit};
 const r=laborRateTimeline(record,[h(2,16,record.updatedAt,flag)]);
 assert.equal(value(r.versions,'2026-11-02'),.1);assert.equal(value(r.versions,'2026-11-03'),null);assert.ok(r.issues.some(i=>i.startsWith('excluded-test:')));
 assert.equal(value(laborRateTimeline(record).versions,'2026-11-03'),16); // magnitude alone never marks test
});
test('excluding same-day replacement does not reactivate its superseded explicit value',()=>{
 const r=laborRateTimeline({sku,effectiveVersions:[{id:'V1',revision:1,status:'published',value:.1,validFrom:'2026-11-01'},{id:'V2',revision:2,status:'published',value:.2,validFrom:'2026-11-01',supersedesVersionId:'V1'}]},[h(2,.2,'2026-11-01',{isTest:true})]);
 assert.equal(value(r.versions,'2026-11-02'),null);
});

for(const marker of ['audit','explicit','master'])test('dated menu reports missing when all revisions are test-marked in '+marker,()=>{
 const record={key:sku,payload:{sku,version:1,laborHour:16,updatedAt:'2026-11-01',effectiveVersions:[{id:'ONLY',revision:1,status:'published',value:16,validFrom:'2026-11-01'}]}};
 const history=[h(1,16,'2026-11-01')];
 if(marker==='audit')history[0].isTest=true;
 if(marker==='explicit')record.payload.effectiveVersions[0].isTest=true;
 if(marker==='master')record.payload.isTest=true;
 const before=structuredClone({record,history}),menu=siteLaborHours([record],'2026-11-09',history).find(r=>r.key===sku).payload;
 assert.deepEqual(menu.resolvedRateVersions,[]);assert.equal(menu.laborHour,null);assert.equal(menu.currentRateIssue,'missing');assert.equal(menu.currentRateDate,'2026-11-09');assert.ok(menu.rateTimelineIssues.some(x=>x.startsWith('excluded-test:')));
 assert.equal(value(menu.resolvedRateVersions,'2026-11-09'),null);assert.deepEqual({record,history},before);
});

for(const effectiveFrom of [undefined,'2026-11-05'])test('PDF baseline V1 does not hide live V1 '+(effectiveFrom||'updated date'),()=>{
 const key='106TG01',record={key,updatedAt:'2026-11-09T03:00:00Z',payload:{sku:key,version:1,laborHour:.03,...(effectiveFrom?{effectiveFrom}:{})}},before=structuredClone(record);
 const boundary=effectiveFrom||'2026-11-09';
 const projected=date=>siteLaborHours([record],date).find(r=>r.key===key).payload;
 assert.equal(projected('2026-09-16').laborHour,null);assert.equal(projected('2026-09-17').laborHour,.017);
 assert.equal(projected('2026-11-04').laborHour,.017);assert.equal(projected(boundary).laborHour,.03);assert.equal(projected('2026-11-10').laborHour,.03);
 assert.equal(value(projected(boundary).resolvedRateVersions,boundary),.03);assert.deepEqual(record,before);
});
test('explicit live V1 and test-marked live V1 cannot suppress an unrelated PDF baseline V1',()=>{
 const key='106TG01',record={key,payload:{sku:key,version:1,laborHour:.03,updatedAt:'2026-11-09',effectiveVersions:[{id:'LIVE-V1',revision:1,status:'published',value:.03,validFrom:'2026-11-09'}]}};
 let menu=siteLaborHours([record],'2026-11-09').find(r=>r.key===key).payload;
 assert.equal(value(menu.resolvedRateVersions,'2026-11-08'),.017);assert.equal(menu.laborHour,.03);
 record.payload.isTest=true;menu=siteLaborHours([record],'2026-11-09').find(r=>r.key===key).payload;
 assert.equal(menu.laborHour,.017);assert.ok(menu.rateTimelineIssues.some(i=>i.startsWith('excluded-test:')));
});
