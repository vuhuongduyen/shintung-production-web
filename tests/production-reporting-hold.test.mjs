import test from 'node:test';import assert from 'node:assert/strict';
import {productionReportingHold as hold,reportingWriteBlocked as blocked} from '../lib/production-reporting-hold.mjs';
const main='sanxuat.shintung-vn-4458.chatgpt.site';
test('hold expires exactly at 17:00 Vietnam time on October 30',()=>{assert.ok(hold(main,Date.parse('2026-10-30T16:59:59.999+07:00')));assert.equal(hold(main,Date.parse('2026-10-30T17:00:00+07:00')),null);assert.equal(hold(main,Date.parse('2026-10-26T23:59:59+07:00')),null);});
test('trial and local unaffected',()=>{for(const host of ['onspa-thu-nghiem-21102026.shintung-vn-4458.chatgpt.site','localhost'])assert.equal(hold(host,Date.parse('2026-10-27T12:00:00+07:00')),null);});
test('blocks backdated and stage writes while allowing ERP, HR and cancellation',()=>{for(const action of ['start','complete','pause','resume','transfer','add','reduce','extra','incident','incident-create'])assert.ok(blocked('/api/production-workflow',{action,effectiveAt:'2026-10-20T08:00:00+07:00'}));assert.ok(blocked('/api/production-workflow',{action:'preview-report',stageEntries:[]}));assert.ok(blocked('/api/production-report',{action:'review'}));for(const path of ['/api/production-history-import','/api/production-correction'])assert.equal(blocked(path,{action:'apply'}),false);for(const action of ['schedule','line-absence','recalculate-attendance-hours','preview-report'])assert.equal(blocked('/api/production-workflow',{action}),false);});

test('QLSX can approve existing reports during entry hold without enabling other writes',()=>{
 assert.equal(blocked('/api/production-report',{action:'review',approve:true}),false);
 for(const body of [{action:'review',approve:false},{action:'review',approve:'true'},{action:'create',approve:true},{}])assert.equal(blocked('/api/production-report',body),true);
 assert.equal(blocked('/api/production-workflow',{action:'complete'}),true);
});

test('hold metadata drives the frontend expiry timer at the same cutoff',async()=>{
 const {readFileSync}=await import('node:fs');
 const cutoff=Date.parse('2026-10-30T17:00:00+07:00'),last=hold(main,cutoff-1);
 assert.equal(last.remainingMs,1);assert.equal(Date.parse(last.endsAt),cutoff);
 assert.match(last.message,/17:00 ngày 30\/10\/2026/);
 assert.equal(hold(main,cutoff+1),null);
 const ui=readFileSync(new URL('../components/production-management.tsx',import.meta.url),'utf8');
 assert.match(ui,/data\.reportingHold\.remainingMs/);assert.match(ui,/setHoldExpired\(true\);void load\(true,true\)/);
});
