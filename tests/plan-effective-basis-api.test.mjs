import test from 'node:test';import assert from 'node:assert/strict';
import {workflowGetFixture} from './helpers/workflow-get-fixture.mjs';
import {activateDailyPolicy} from './helpers/activate-daily-policy.mjs';
import {getPlan,mutatePlan} from '../scripts/local/production-plan.mjs';
import {getTransit,mutateTransit} from '../scripts/local/in-transit.mjs';
import {records} from '../scripts/local/database.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {permissionProfiles} from '../lib/user-permission-profiles.mjs';
import {assertRequestAudit} from './helpers/rejected-request-audit.mjs';
const week='2026-11-02',sku='SYNTHETIC-SKU',actor={login:'SYNTHETIC-KHSX',isAdmin:true,canEditPlan:true,canReopenPlan:true};
const versions=[{id:'R1',status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-04'},{id:'R2',status:'published',value:.2,validFrom:'2026-11-04'}];
async function fixture(run,{policy=true}={}){const c=await workflowGetFixture(2),put=(entity,key,value)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,key,JSON.stringify(value),'SYNTHETIC','now').run();try{
 await put('sku',sku,{code:sku,confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
 await put('labor_hours',sku,{sku,laborHour:9,effectiveVersions:versions});
 await put('leadtime',sku,{sku,leadTime:2});
 await put('capacity',week,{schemaVersion:1,week,rows:['A','B'].map(line=>({week,line,status:'Đã xác nhận',version:1,availableHours:1000}))});
 await put('production_plan',week,{schemaVersion:2,week,revision:0,rows:[{id:'SYNTHETIC-PLAN',sku,name:'SYNTHETIC',week,line:'A',plan:1000,suggested:1000,start:'2026-11-02',end:'2026-11-06',status:'DỰ KIẾN',laborHour:9}]});
 if(policy)await activateDailyPolicy(c.db,{effectiveFrom:'2026-11-01'});
 await run({...c,put});
}finally{await c.close();}}
const req=(action,revision,ids,rest={})=>({action,week,revision,ids,...rest});
async function send(db,body){try{return await mutatePlan(db,body,actor);}catch(e){if(e.message!=='dailyCapacityConfirmation')throw e;return mutatePlan(db,{...body,dailyCapacityAck:JSON.parse(e.details[0].reason).token},actor);}}

test('optional split rows use the same close-day rate and retain distinct quantities, dates and frozen transferred bases',async t=>fixture(async c=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T03:00:00Z')});try{
 let state=await getPlan(c.db,week,true);assert.equal(state.effectivePlanning,true);assert.equal(state.rows[0].planLaborBasis.status,'resolved');assert.equal(state.rows[0].laborHour,.1);
 const split=await send(c.db,req('split',0,['SYNTHETIC-PLAN']));state=await getPlan(c.db,week,true);const child=state.rows.find(r=>r.id!=='SYNTHETIC-PLAN');assert.equal(child.plan,null);assert.equal(child.suggested,null);
 const edits={'SYNTHETIC-PLAN':{plan:200,start:'2026-11-02',end:'2026-11-03'},[child.id]:{plan:1200,start:'2026-11-04',end:'2026-11-06'}};
 const saved=await send(c.db,req('save',split.revision,['SYNTHETIC-PLAN',child.id],{edits}));
 state=await getPlan(c.db,week,true);assert.equal(state.rows.reduce((n,r)=>n+r.plan,0),1400);assert.deepEqual(state.rows.map(r=>r.laborHour).sort(),[.1,.1]);assert.equal(state.rows.filter(r=>r.suggested!==null).length,1);
 const closed=await send(c.db,req('close',saved.revision,['SYNTHETIC-PLAN',child.id]));const anchor=await records(c.db);state=await getPlan(c.db,week,true);for(const r of state.rows){assert.equal(r.planLeadtimeBasis.value,2);assert.equal(r.planLeadtimeBasis.businessDate,'2026-11-03');assert.equal(r.closedBy,actor.login);}
 t.mock.timers.tick(3*86400000);await c.put('labor_hours',sku,{sku,laborHour:99,effectiveVersions:[{id:'R3',status:'published',value:99,validFrom:'2026-11-01'}]});await c.put('leadtime',sku,{sku,leadTime:99});
 await send(c.db,req('transfer',closed.revision,['SYNTHETIC-PLAN',child.id]));state=await getPlan(c.db,week,true);assert.deepEqual(state.rows.map(r=>r.laborHour).sort(),[.1,.1]);
 const transit=(await getTransit(c.db,{},[],{includeHistory:false})).rows.filter(r=>r.planRowId==='SYNTHETIC-PLAN'||r.planRowId===child.id);assert.equal(transit.length,2);assert.equal(new Set(transit.map(r=>r.planId)).size,1);for(const r of transit){assert.equal(r.standardLeadtime,2);assert.equal(r.planLeadtimeBasis.closedAt,'2026-11-03T03:00:00.000Z');assert.equal(r.planLaborBasis.value,.1);assert.equal(r.planLaborBasis.businessDate,'2026-11-03');assert.equal(r.planLaborBasis.closedBy,actor.login);}
 const oldReports=rows=>rows.filter(r=>r.entity==='production_report');assert.deepEqual(oldReports(await records(c.db)),oldReports(anchor));
 }finally{t.mock.timers.reset();}
}));

test('master change immediately before close batch rolls plan/audit back instead of committing a mixed basis',()=>fixture(async c=>{
 const initial=await getPlan(c.db,week,true);const saved=await send(c.db,req('save',initial.revision,['SYNTHETIC-PLAN'],{edits:{'SYNTHETIC-PLAN':{end:'2026-11-03'}}}));
 let expected,injected=false;const raced=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{assert.equal(injected,false);injected=true;await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.leadTime',77) WHERE entity='leadtime' AND record_key=?").bind(sku).run();expected=await records(target);return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(()=>send(raced,req('close',saved.revision,['SYNTHETIC-PLAN'])),e=>e.status===409);assert.equal(injected,true);assert.deepEqual(await records(c.db),expected);
}));

test('without activated policy legacy plan values and close behavior stay unchanged',()=>fixture(async c=>{
 const state=await getPlan(c.db,week,true);assert.equal(state.effectivePlanning,false);assert.equal(state.rows[0].laborHour,9);assert.equal(state.rows[0].planLaborBasis,undefined);
 // Existing capacity/load checks still apply; no new effective-date lock is added.
 const closed=await send(c.db,req('close',0,['SYNTHETIC-PLAN']));assert.equal(closed.rows[0].planLeadtimeBasis,undefined);assert.equal(closed.rows[0].laborHour,9);
},{policy:false}));

test('tampering with the activated policy cannot reopen current-only planning or mutate drafts',()=>fixture(async c=>{
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.approved',json('false')) WHERE entity='production_reporting_policy' AND record_key='global'").run();
 // The fixture helper has no permanent activation marker; preserve it explicitly
 // as the prepared TEST driver would, to exercise the production fail-closed read.
 const row=await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_reporting_policy' AND record_key='global'").first(),p=JSON.parse(row.payload);
 await c.put('production_reporting_activation','global',{legacySnapshotId:p.legacySnapshotId,effectiveFrom:p.effectiveFrom});
 const before=await records(c.db),state=await getPlan(c.db,week,true);assert.equal(state.effectivePlanning,true);assert.equal(state.planningBlocked,true);assert.equal(state.rows[0].laborHour,.2);
 await assert.rejects(()=>send(c.db,req('close',state.revision,['SYNTHETIC-PLAN'])),e=>e.status===409);assert.deepEqual(await records(c.db),before);
}));

test('the existing missing-labor close exception stays available with unknown basis and never invents hours later',()=>fixture(async c=>{
 await c.put('labor_hours',sku,{sku,laborHour:9,effectiveVersions:[]});
 const closed=await send(c.db,req('close',0,['SYNTHETIC-PLAN']));assert.equal(closed.rows[0].status,'ĐÃ CHỐT');assert.equal(closed.rows[0].laborHour,null);assert.equal(closed.rows[0].planLaborBasis.status,'missing');
 await c.put('labor_hours',sku,{sku,laborHour:99,effectiveVersions:[{id:'LATER',status:'published',value:99,validFrom:'2026-11-01'}]});
 const next=await getPlan(c.db,week,true);assert.equal(next.rows[0].laborHour,null);assert.equal(next.rows[0].planLaborBasis.status,'missing');
}));

test('authenticated HR denial keeps exact receipt; KHSX can close a multi-rate schedule without splitting',async t=>fixture(async c=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T03:00:00Z')});try{
 let response;const call=await reviewer(c,async(request,env)=>{const result=await siteApi(request,env);response=result.clone();return result;});
 for(const department of ['HR','KHSX'])await c.put('department_permissions',department,{department,active:true,permissions:permissionProfiles[department].grants.join(' · ')});
 const user=department=>c.put('users','SYNTHETIC-REVIEWER',{login:'SYNTHETIC-REVIEWER',role:'USER',department,active:true});
 let body=req('close',0,['SYNTHETIC-PLAN']);await user('HR');let before=await records(c.db),result=await call('/api/production-plan',body);assert.equal(result.status,403);await assertRequestAudit({before,after:await records(c.db),response,actorId:'SYNTHETIC-REVIEWER',route:'/api/production-plan',body});
 await user('KHSX');body={...body,edits:{'SYNTHETIC-PLAN':{end:'2026-11-06'}}};before=await records(c.db);result=await call('/api/production-plan',body);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.rows[0].closedBy,'SYNTHETIC-REVIEWER');assert.equal(result.body.rows[0].planLeadtimeBasis.closedBy,'SYNTHETIC-REVIEWER');assert.equal(result.body.rows[0].laborHour,.1);
 await assertRequestAudit({before,after:await records(c.db),response,actorId:'SYNTHETIC-REVIEWER',route:'/api/production-plan',body,mutableEntities:['production_plan','production_plan_audit']});
 assert.equal(result.body.rows[0].end,'2026-11-06');assert.equal(result.body.rows[0].planLaborBasis.businessDate,'2026-11-03');
 }finally{t.mock.timers.reset();}
}));

test('a smaller LSX still selects its original MOQ tier from the Plan-close source after live tiers change',()=>fixture(async c=>{
 await c.put('leadtime',sku,{sku,rows:[{sku,moq:100,leadTime:2},{sku,moq:1000,leadTime:5}]});
 const closed=await send(c.db,req('close',0,['SYNTHETIC-PLAN'],{edits:{'SYNTHETIC-PLAN':{end:'2026-11-03'}}}));assert.equal(closed.rows[0].planLeadtimeBasis.value,5);
 await send(c.db,req('transfer',closed.revision,['SYNTHETIC-PLAN']));let row=(await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.planRowId==='SYNTHETIC-PLAN');
 await mutateTransit(c.db,{action:'draft-lsx',id:row.id,expectedRevision:row.revision,changes:{lsxCode:'SYNTHETIC-TIER-LSX',lsxQty:50,lsxOpenedAt:week}},actor);
 await c.put('leadtime',sku,{sku,rows:[{sku,moq:1000,leadTime:99}]});row=(await getTransit(c.db,{},[],{includeHistory:false})).rows.find(r=>r.planRowId==='SYNTHETIC-PLAN');
 assert.equal(row.lsxQty,50);assert.equal(row.planLeadtimeBasis.plannedQuantity,1000);assert.equal(row.standardLeadtime,2);assert.equal(row.planLeadtimeBasis.value,5);
}));

test('confirmation re-resolves at the GMT+7 midnight boundary and stores one immutable basis for the whole unsplit plan',async t=>fixture(async c=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T16:59:59Z')});try{
  await c.put('labor_hours',sku,{sku,laborHour:99,effectiveVersions:[{id:'FUTURE',status:'published',value:99,validFrom:'2026-12-01'}, {...versions[1],validTo:'2026-12-01'},versions[0]]});
  const preview=await getPlan(c.db,week,true);assert.equal(preview.planningDate,'2026-11-03');assert.equal(preview.rows[0].laborHour,.1);
  t.mock.timers.tick(1000);const closed=await send(c.db,req('close',0,['SYNTHETIC-PLAN']));const row=closed.rows[0];assert.equal(row.laborHour,.2);assert.equal(row.start,'2026-11-02');assert.equal(row.end,'2026-11-06');assert.equal(row.planLaborBasis.businessDate,'2026-11-04');assert.equal(row.planLaborBasis.basis.versionId,'R2');assert.equal(row.planLaborBasis.closedAt,row.closedAt);assert.equal(row.planLaborBasis.closedBy,actor.login);
  const raw=await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_plan' AND record_key=?").bind(week).first();
  await c.put('labor_hours',sku,{sku,laborHour:77,effectiveVersions:[{id:'REPLACEMENT',status:'published',value:77,validFrom:'2026-11-01'}]});
  t.mock.timers.tick(40*86400000);const after=await getPlan(c.db,week,true);assert.deepEqual(after.rows[0].planLaborBasis,row.planLaborBasis);assert.equal(after.rows[0].laborHour,.2);assert.deepEqual(await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_plan' AND record_key=?").bind(week).first(),raw);
 }finally{t.mock.timers.reset();}
}));

test('a concurrent labor publication cannot commit a mixed Plan-close basis or audit',()=>fixture(async c=>{
 let expected,injected=false;const raced=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{assert.equal(injected,false);injected=true;await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.effectiveVersions[1].value',77) WHERE entity='labor_hours' AND record_key=?").bind(sku).run();expected=await records(target);return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(()=>send(raced,req('close',0,['SYNTHETIC-PLAN'])),e=>e.status===409);assert.equal(injected,true);assert.deepEqual(await records(c.db),expected);
}));
