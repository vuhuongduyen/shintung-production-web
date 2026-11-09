import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {openDatabase,migrate,root,records} from '../scripts/local/database.mjs';
import {saveEngine} from '../scripts/local/engine.mjs';
import {engineDetailBasis} from '../lib/engine-detail-basis.mjs';
import {engineSourceRevisions} from '../lib/engine-effective-basis.mjs';
const actor={login:'SYNTHETIC-ENGINE'};
async function context(){const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'engine-basis-')));await migrate(c.db);return c;}
const put=(db,entity,key,value)=>db.prepare('INSERT OR REPLACE INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'fixture','fixture').run();
const payload={week:'2026-11-09',rows:[{id:'ROW',sku:'SYNTHETIC',suggested:100}],metrics:[['ROW',{moq:100,leadTime:5,safetyDays:2,dailyDemand:10,rop:70,eventWeek:4,forecastBasis:{f30:300,d30:10}}]],ruleId:'RULE'};
async function setup(db){await put(db,'sku','SYNTHETIC',{code:'SYNTHETIC',moq:100,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});await put(db,'safety_rules','RULE',{id:'RULE',leadTimeRules:[{days:3}]});}
test('Engine persists rule contents and actual row metrics, not a live rule pointer',async()=>{const c=await context();try{
 await setup(c.db);const body={payload,sourceRevisions:await engineSourceRevisions(c.db)};
 const saved=await saveEngine(c.db,body,actor);const before=await records(c.db);
 assert.equal(saved.payload.calculationBasis.sources.find(r=>r.entity==='safety_rules').payload.leadTimeRules[0].days,3);
 assert.equal(saved.payload.rows[0].engineCalculationBasis.metric.safetyDays,2);
 await put(c.db,'forecast','FORECAST',{sku:'SYNTHETIC',used:99});
 await put(c.db,'demand_event','EVENT',{sku:'SYNTHETIC',qty:999});
 const restored=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_engine' AND record_key=?").bind(saved.key).first()).payload);
 const detail=engineDetailBasis({payload:restored},payload.week,'SYNTHETIC',null);assert.equal(detail.metric.dailyDemand,10);assert.equal(detail.metric.rop,70);assert.equal(detail.metric.eventWeek,4);assert.equal(detail.metric.forecastBasis.f30,300);
 await put(c.db,'safety_rules','RULE',{id:'RULE',leadTimeRules:[{days:99}]});
 const actual=(await records(c.db)).filter(r=>r.entity==='production_engine'||r.entity==='production_engine_snapshot');
 assert.deepEqual(actual,before.filter(r=>r.entity==='production_engine'||r.entity==='production_engine_snapshot'));
 const current=await records(c.db);await assert.rejects(saveEngine(c.db,body,actor),e=>e.status===409);assert.deepEqual(await records(c.db),current);
}finally{await c.close();}});
test('a master mutation immediately before batch rolls Engine, snapshot and audit back atomically',async()=>{const c=await context();try{
 await setup(c.db);const body={payload,sourceRevisions:await engineSourceRevisions(c.db)};
 const db={prepare:(...args)=>c.db.prepare(...args),batch:async statements=>{await put(c.db,'safety_rules','RULE',{id:'RULE',leadTimeRules:[{days:99}]});return c.db.batch(statements);}};
 await assert.rejects(saveEngine(db,body,actor),e=>e.status===409);
 const all=await records(c.db);assert.ok(!all.some(r=>['production_engine','production_engine_snapshot','admin_audit','engine_basis_guard'].includes(r.entity)));
}finally{await c.close();}});
