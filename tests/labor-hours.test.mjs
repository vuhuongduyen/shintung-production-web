import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../app/labor-hours-data.json' with {type:'json'};
import report from '../app/labor-hours-import-report.json' with {type:'json'};
import {siteLaborHours,siteLaborHoursHistory} from '../lib/site-labor-hours.mjs';
import {buildLaborHoursRevision} from '../lib/labor-hours-revision.mjs';

test('PDF labor-hour import keeps valid zeroes, unique SKUs and an explicit mismatch report',()=>{
 assert.equal(report.pdfRows,419);assert.equal(report.matched,340);assert.equal(report.missing,79);assert.equal(report.duplicates,0);
 assert.equal(data.length,340);assert.equal(new Set(data.map(row=>row.sku)).size,340);assert.ok(data.some(row=>row.laborHour===0));
 assert.equal(data.find(row=>row.sku==='101CTP010').laborHour,0.063);
});

test('current display resolves effective day after backdated and future publication without mutating storage',()=>{
 const old={sku:'TEST',version:2,laborHour:.9,effectiveVersions:[{id:'O',status:'published',validFrom:'2026-10-01',validTo:'2026-11-01',value:.01},{id:'N',status:'published',validFrom:'2026-11-01',value:.016}]};
 const args={old,sku:old.sku,value:.012,effectiveFrom:'2026-10-15',note:'',source:'PDF',reason:'Synthetic',actor:'TEST',now:'2026-11-09T03:00:00Z',mode:'edit'};
 const back=buildLaborHoursRevision(args);assert.equal(back.current.laborHour,.016);assert.equal(back.history.oldLaborHour,.01);assert.equal(old.effectiveVersions.length,2);
 const future=buildLaborHoursRevision({...args,old:back.current,value:.03,effectiveFrom:'2026-12-01'}),raw=JSON.stringify(future.current);
 const read=date=>siteLaborHours([{key:'TEST',payload:future.current}],date).find(r=>r.key==='TEST').payload;
 assert.equal(read('2026-11-30').laborHour,.016);assert.equal(read('2026-12-01').laborHour,.03);assert.equal(read('2026-09-01').laborHour,null);assert.equal(JSON.stringify(future.current),raw);
 assert.throws(()=>buildLaborHoursRevision({...args,effectiveFrom:undefined}),e=>e.status===422);
 assert.throws(()=>buildLaborHoursRevision({...args,old:{...old,cancelled:true}}),e=>e.status===409);
});

test('D1 labor-hour values overlay the PDF baseline without duplicating product master fields',()=>{
 const rows=siteLaborHours([{key:'101CTP010',payload:{sku:'101CTP010',laborHour:0.075,note:'changed',version:2},updatedBy:'tester',updatedAt:'2026-09-17T01:00:00.000Z'}]);
 const current=rows.find(row=>row.key==='101CTP010');assert.equal(current.payload.laborHour,0.075);assert.equal('name' in current.payload,false);assert.equal('group' in current.payload,false);
 const history=siteLaborHoursHistory([], '101CTP010');assert.equal(history.length,1);assert.equal(history[0].payload.newLaborHour,0.063);
});

test('future first versions and repeated corrections retain a legacy observation without inventing effective history',()=>{
 const args={old:{sku:'TEST',version:1,laborHour:.5},sku:'TEST',value:.7,effectiveFrom:'2026-12-01',note:'',source:'PDF',reason:'Synthetic',actor:'TEST',now:'2026-11-09T03:00:00Z',mode:'edit'};
 const first=buildLaborHoursRevision(args),second=buildLaborHoursRevision({...args,old:first.current,value:.8}),third=buildLaborHoursRevision({...args,old:second.current,effectiveFrom:'2027-01-01',value:.9});
 for(const result of [first,second,third]){
  assert.equal(result.current.laborHour,.5);assert.equal(siteLaborHours([{key:'TEST',payload:result.current}]).find(r=>r.key==='TEST').payload.laborHour,.5);
  assert.equal(siteLaborHours([{key:'TEST',payload:result.current}],'2026-11-09').find(r=>r.key==='TEST').payload.laborHour,null,'observation is not a dated rate');
  assert.deepEqual(result.current.legacyCurrentObservation,first.current.legacyCurrentObservation);
 }
 assert.equal(siteLaborHours([{key:'TEST',payload:third.current}],'2026-12-01').find(r=>r.key==='TEST').payload.laborHour,.8);
 const gap=buildLaborHoursRevision({...args,old:{...third.current,effectiveVersions:[{id:'ENDED',status:'published',validFrom:'2026-10-01',validTo:'2026-11-01',value:.4},...third.current.effectiveVersions]},effectiveFrom:'2027-01-01',value:1});
 assert.equal(gap.current.laborHour,null,'a proven gap cannot use the retained legacy observation');
});
