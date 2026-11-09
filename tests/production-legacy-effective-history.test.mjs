import test from 'node:test';
import assert from 'node:assert/strict';
import {storedLegacyEarnedBasis,captureLegacyEarnedBasis} from '../lib/production-legacy-earned-basis.mjs';
import {monthlyEarnedOrders} from '../lib/production-payroll.mjs';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {activateQuantityCutover} from '../scripts/local/production-quantity-cutover.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
const old={id:'SYNTHETIC-OCTOBER',kind:'completion',transitId:'SYNTHETIC-LSX',line:'A',sku:'SYNTHETIC-SKU',stageCode:'FINAL',productionDate:'2026-10-30',startedAt:'2026-10-30T01:00:00Z',completedAt:'2026-10-30T02:00:00Z',reportedQuantity:100,approvedQuantity:100,reviewStatus:'Đã xác nhận',hours:{hc:1,ot:0,total:1},standardUnit:.01};
test('stored legacy rate and dated snapshot never borrow planning/current standards; missing evidence fails closed',()=>{
 const order={id:old.transitId,line:'A',sku:old.sku,laborHour:99};
 for(const scalar of [.01,.016,.025,undefined]){const row=monthlyEarnedOrders([order],[old],'2026-10','A',new Map([[old.sku,scalar]]),true)[0];assert.equal(row.earned,1);assert.equal(row.unit,.01);}
 for(const patch of [{standardUnit:undefined},{standardUnit:null},{standardUnit:''},{standardUnit:true},{standardUnit:-1},{standardUnit:Infinity},{standardUnit:NaN},{productionDate:'2026-02-31',completedAt:''}])assert.equal(storedLegacyEarnedBasis({...old,...patch}).earned,null,JSON.stringify(patch));
 assert.equal(storedLegacyEarnedBasis({...old,standardUnit:0}).earned,0);
 const rateBasis={versionId:'SYNTHETIC-ORIGINAL',productionDate:old.productionDate,value:.01};
 assert.equal(storedLegacyEarnedBasis({...old,standardUnit:undefined,rateBasis}).earned,1);
 assert.equal(storedLegacyEarnedBasis({...old,rateBasis:{...rateBasis,value:.016}}).earned,null,'conflicting stored evidence is not guessed');
 assert.equal(storedLegacyEarnedBasis({...old,standardUnit:undefined,rateBasis:{...rateBasis,productionDate:'2026-11-07'}}).earned,null,'wrong-day snapshot is not reused');
 const unknown={...old,standardUnit:undefined,hours:{total:200},standardLaborHours:300};assert.equal(monthlyEarnedOrders([order],[unknown],'2026-10','A',new Map([[old.sku,.016]]),true)[0].earned,null,'actual or cumulative hours cannot invent unit rate');
});
test('capture uses raw report evidence, not live standards or an enriched projection',async()=>{
 const input={orders:[{id:old.transitId,line:'A',sku:old.sku}],reports:[{...old,standardUnit:.9}],rawReports:[old],standards:new Map([[old.sku,.9]]),snapshotId:'SYNTHETIC-LEGACY-BASIS',observedAt:'2026-11-09T00:00:00Z'};
 const known=await captureLegacyEarnedBasis(input);assert.equal(known.basis[0].earned,1);assert.equal(known.basis[0].presentation.standardUnit,.01);
 const missing=await captureLegacyEarnedBasis({...input,rawReports:[{...old,standardUnit:undefined}]});assert.equal(missing.basis[0].status,'missing');assert.equal(missing.basis[0].earned,null);assert.equal(missing.basis[0].presentation.standardUnit,undefined);
});
test('API October result survives quantity cutover and November master changes; late new receipt uses October effective rate',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation')").run();
 await c.put('production_report',old.id,old);
 const saveRate=async value=>c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku:c.order.sku,laborHour:value,effectiveVersions:[{id:'SYNTHETIC-OCT',status:'published',validFrom:'2026-01-01',validTo:'2026-11-07',value:.01},{id:'SYNTHETIC-NOV',status:'published',validFrom:'2026-11-07',value}]}),c.order.sku).run();
 await saveRate(.01);const call=await reviewer(c),raw=()=>c.db.prepare("SELECT * FROM app_records WHERE entity='production_report' AND record_key=?").bind(old.id).first(),original=await raw();
 const observe=async()=>{const r=await call('/api/production-workflow');assert.equal(r.status,200,JSON.stringify(r.body));const rates=await call('/api/production-standards');assert.equal(rates.status,200);const master=new Map(rates.body.records.map(x=>[x.payload.sku||x.key,x.payload.laborHour]));const row=monthlyEarnedOrders(r.body.orders,r.body.reports,'2026-10','A',master,true).find(x=>x.order.id===c.order.id);return {row,report:r.body.reports.find(x=>x.id===old.id)};};
 assert.equal((await observe()).row.earned,1);
 await activateQuantityCutover(c.db,{snapshotId:'SYNTHETIC-INTAKE-HISTORY-TEST'},{login:'SYNTHETIC-ADMIN',isAdmin:true},{sourceId:'a'.repeat(64)});
 const frozen=()=>c.db.prepare("SELECT * FROM app_records WHERE entity='production_quantity_source' ORDER BY record_key").all().then(r=>r.results),snapshot=await frozen();
 for(const value of [.016,.025]){await saveRate(value);const view=await observe();assert.equal(view.row.earned,1);assert.equal(view.report.hours.total,1);assert.equal(view.report.reportingModel,undefined);assert.deepEqual(await raw(),original);assert.deepEqual(await frozen(),snapshot);}
 const current=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first();
 const input=c.body({quantity:100,productionDate:'2026-10-30',expectedOrderRevision:await recordRevision(current.payload)}),saved=await call('/api/production-workflow',input);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.report.reportingModel,'daily-finished-v1');assert.equal(saved.body.report.rateBasis.value,.01);assert.equal(saved.body.report.earnedStandardHours,1);assert.ok(saved.body.report.intake.receivedAt>saved.body.report.productionAt);
 assert.equal((await call('/api/production-workflow',input)).body.replayed,true);
 const approved=await call('/api/production-report',{action:'review',reportId:saved.body.report.id,approve:true,expectedVersion:1});assert.equal(approved.status,200,JSON.stringify(approved.body));assert.equal((await observe()).row.earned,2,'one original plus one new receipt, without replay duplication');
 assert.deepEqual(await raw(),original);assert.deepEqual(await frozen(),snapshot);
}));
test('history import read path retains stored rate and leaves unknown rate missing; GET performs no business writes',()=>dailyFixture(async c=>{
 const imports=[{...old,id:'SYNTHETIC-IMPORT-KNOWN',historicalImport:true},{...old,id:'SYNTHETIC-IMPORT-UNKNOWN',standardUnit:undefined,historicalImport:true}];
 await c.put('production_history_import','SYNTHETIC-IMPORT-BATCH',{reports:imports});const before=(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const call=await reviewer(c),view=await call('/api/production-workflow');assert.equal(view.status,200,JSON.stringify(view.body));
 assert.equal(view.body.reports.find(r=>r.id===imports[0].id).standardUnit,.01);assert.equal(view.body.reports.find(r=>r.id===imports[1].id).standardUnit,undefined);
 const actual=monthlyEarnedOrders(view.body.orders,view.body.reports,'2026-10','A',new Map([[c.order.sku,9]]),true).find(r=>r.order.id===c.order.id);assert.equal(actual.earned,null,'one unknown legacy rate blocks aggregate money, not zero');
 for(const row of before)assert.deepEqual(await c.db.prepare('SELECT * FROM app_records WHERE entity=? AND record_key=?').bind(row.entity,row.record_key).first(),row);
}));
