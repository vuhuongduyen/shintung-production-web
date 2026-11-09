import test from 'node:test';import assert from 'node:assert/strict';
import {journalStandardHours} from '../lib/production-journal-standards.mjs';
const report={id:'R',kind:'completion',transitId:'O',sku:'SKU',stageName:'FINAL',productionDate:'2026-10-30',completedAt:'2026-10-30T02:00:00Z',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',standardUnit:.01};
const calculate=(reports,rate=.016)=>journalStandardHours(reports,[{id:'O',sku:'SKU',laborHour:.9}],new Map([['SKU',rate]]),new Set(['R']),new Map([['R',{orderCumulativeHours:1}]])).get('R');
test('journal uses stored rate, not current master or order planning estimate',()=>{const before=JSON.stringify(report);for(const master of [.01,.016,.03])assert.deepEqual(calculate([report],master),{standardUnitHours:.01,standardLaborHours:1,laborDeviation:0});assert.equal(JSON.stringify(report),before);});
test('journal missing, conflicting or invalid dated evidence never borrows current master; zero is valid',()=>{
 for(const patch of [{standardUnit:undefined},{standardUnit:null},{standardUnit:-1},{rateBasis:{kind:'effective-version',versionId:'OTHER',value:.02,productionDate:'2026-10-30',validFrom:'2026-10-01'}},{productionDate:'2026-02-31',completedAt:''}])assert.deepEqual(calculate([{...report,...patch}]),{standardUnitHours:null,standardLaborHours:null,laborDeviation:null});
 assert.deepEqual(calculate([{...report,standardUnit:0}]),{standardUnitHours:0,standardLaborHours:0,laborDeviation:null});
});
test('journal cumulative comparison sums dated output bases and keeps ERP scope, equal times and cancelled rows separate',()=>{
 const rows=[{...report,id:'FIRST',reportedQuantity:50,approvedQuantity:50,standardUnit:.01,erpStageImport:true},{...report,reportedQuantity:50,approvedQuantity:50,standardUnit:.02,erpStageImport:true},{...report,id:'CUT',stageName:'CUT',reportedQuantity:0,approvedQuantity:0,standardUnit:undefined,erpStageImport:true},{...report,id:'OTHER-SOURCE',standardUnit:9},{...report,id:'CANCELLED',standardUnit:9,cancelled:true},{...report,id:'REPLACED',standardUnit:9,replacedByStageBatch:'new'}],before=JSON.stringify(rows),value=calculate(rows);
 assert.equal(value.standardLaborHours,1.5);assert.equal(value.standardUnitHours,.015);assert.equal(value.laborDeviation,1/1.5-1);assert.equal(JSON.stringify(rows),before);
 assert.equal(calculate(rows.map(r=>r.id==='FIRST'?{...r,standardUnit:undefined}:r)).standardLaborHours,null);
});

test('preservation journal capture uses raw report evidence, never an enriched current-rate projection',async()=>{
 const {captureLegacyPreservation}=await import('../lib/production-legacy-preservation.mjs');
 const workflow={orders:[{id:'O',sku:'SKU',line:'A',processes:['FINAL']}],reports:[{...report,standardUnit:.9,hours:{hc:1,ot:0,total:1}}],events:[],employees:[],approvedSchedules:[]};
 const captured=await captureLegacyPreservation({workflow,rawReports:[report],standards:new Map([['SKU',.9]]),snapshotId:'SYNTHETIC-CAPTURE',observedAt:'2026-11-09T00:00:00Z',cutoverDate:'2026-11-09'}),row=captured.basis[0];
 assert.equal(row.unit,.01);assert.equal(row.earned,1);assert.equal(row.presentation.standardUnit,.01);assert.equal(row.presentation.standardUnitHours,.01);assert.equal(row.presentation.standardLaborHours,1);assert.equal(row.presentation.laborDeviation,0);
 const missing=await captureLegacyPreservation({workflow,rawReports:[{...report,standardUnit:undefined}],standards:new Map([['SKU',.9]]),snapshotId:'SYNTHETIC-MISSING',observedAt:'2026-11-09T00:00:00Z',cutoverDate:'2026-11-09'});
 assert.equal(missing.basis[0].status,'missing');assert.equal(missing.basis[0].presentation.standardUnitHours,null);assert.equal(missing.basis[0].presentation.standardLaborHours,null);assert.equal(missing.basis[0].presentation.laborDeviation,null);
});
