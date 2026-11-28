import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLaborHoursRevision} from '../lib/labor-hours-revision.mjs';
import {siteLaborHours} from '../lib/site-labor-hours.mjs';
import {effectiveValueOn} from '../lib/effective-dated-value.mjs';
import {payrollMissingRates} from '../lib/payroll-missing-rates.mjs';
const sku='SYNTHETIC-DATED',now='2026-11-28T03:00:00Z';
const history=[{key:'first',payload:{id:'first',sku,version:1,newLaborHour:.06,at:'2026-10-21T01:00:00Z'}},{key:'second',payload:{id:'second',sku,version:2,newLaborHour:.044,at:'2026-10-22T01:00:00Z'}}];
const old={sku,version:2,laborHour:.044,updatedAt:'2026-10-22T01:00:00Z'};
const menu=()=>siteLaborHours([{key:sku,payload:old}],null,history).find(r=>r.key===sku).payload;
test('backdated legacy entry covers the missing period and retains later rates and audit timestamps',()=>{
 const before=structuredClone({old,history});
 const saved=buildLaborHoursRevision({old,sku,value:.06,effectiveFrom:'2026-10-19',note:'',source:'Nhập trực tiếp',reason:'Synthetic dated evidence',actor:'TEST',now,mode:'edit',legacyVersions:menu().resolvedRateVersions});
 assert.equal(effectiveValueOn(saved.current.effectiveVersions,'2026-10-18').ok,false);
 assert.equal(effectiveValueOn(saved.current.effectiveVersions,'2026-10-19').basis.value,.06);
 assert.equal(effectiveValueOn(saved.current.effectiveVersions,'2026-10-21').basis.value,.06);
 assert.equal(effectiveValueOn(saved.current.effectiveVersions,'2026-10-22').basis.value,.044);
 assert.equal(saved.current.laborHour,.044);assert.equal(saved.history.at,now);assert.equal(saved.history.effectiveFrom,'2026-10-19');
 assert.deepEqual({old,history},before);
 const next=buildLaborHoursRevision({old:saved.current,sku,value:.07,effectiveFrom:'2026-10-20',note:'',source:'PDF',reason:'Synthetic PDF',actor:'TEST',now,mode:'edit'});
 assert.equal(effectiveValueOn(next.current.effectiveVersions,'2026-10-20').basis.value,.07);
 assert.equal(effectiveValueOn(next.current.effectiveVersions,'2026-10-22').basis.value,.044);
});
test('diagnostics identify all blocked Lines and dates without exposing a Line absent from the authorized overview',()=>{
 const overview=line=>({line,rows:[{order:{id:line,sku:'SYNTHETIC-'+line,lsxCode:'TEST-'+line,name:'Synthetic product'},basis:[{date:'2026-10-09',earned:null},{date:'2026-10-09',earned:null},{date:'2026-10-10',earned:0},{date:'2026-10-11',earned:null,omitted:true}]}]});
 const all=payrollMissingRates([overview('A'),overview('B')]);assert.equal(all.length,2);assert.equal(all[1].sku,'SYNTHETIC-B');assert.equal(all[0].date,'2026-10-09');
 assert.deepEqual(payrollMissingRates([overview('A')]).map(r=>r.line),['A']);assert.deepEqual(payrollMissingRates([]),[]);
});
