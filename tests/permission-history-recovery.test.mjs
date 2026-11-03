import test from 'node:test';
import assert from 'node:assert/strict';
import {personalPermissionRecoveryPlan} from '../lib/permission-history-recovery.mjs';
const at='2026-10-16T09:27:42.507Z';
function fixture(){
 const before={login:'u',permissionMode:'CUSTOM',permissions:'Legacy / Xem · Leadtime / Sửa',active:true,phone:'old'};
 const after={...before,permissionMode:'DEPARTMENT',permissions:'',_deleted:false};
 const source={action:'USER_PERMISSION_SETUP',at,changes:[{entity:'permissions',key:'u',before,after},{entity:'permissions',key:'dhtin',before:null,after:{login:'dhtin',permissionMode:'DEPARTMENT'}},{entity:'permissions',key:'LINE_A',before:{permissionMode:'CUSTOM'},after:{permissionMode:'CUSTOM'}}]};
 const current=[{entity:'users',key:'u',payload:{login:'u',name:'User',active:true,role:'USER'}},{entity:'permissions',key:'u',payload:{...after,updatedAt:'later'}},{entity:'production_allocation_scope',key:'global',payload:{enabled:true,managers:[{userId:'dhtin',group:'C'},{userId:'cnphuong',group:'AB'}]}}];
 return {source,current};
}
test('restores exact audited personal rights, skips new/Line records and leaves all inputs untouched',()=>{
 const {source,current}=fixture(),input=structuredClone({source,current});
 const repeat={...source,at:'2026-10-17T02:12:53.302Z',changes:source.changes.filter(c=>c.key==='u').map(c=>({...c,before:c.after,after:{...c.after,updatedAt:'later'}}))};
 const plan=personalPermissionRecoveryPlan([source,repeat],current,at);
 assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].key,'u');
 assert.equal(plan.changes[0].after.permissions,source.changes[0].before.permissions);
 assert.equal(plan.changes[0].after.permissionMode,'CUSTOM');assert.equal(plan.changes[0].after._deleted,undefined);
 assert.equal(plan.changes[0].after.phone,'old');assert.equal(plan.changes[0].after.updatedAt,'later');
 assert.deepEqual({source,current},input);assert.deepEqual(plan.scope,current.at(-1).payload);
});
test('blocks later legitimate edits, concurrent differences and missing historical evidence',()=>{
 for(const mode of ['later','current','missing','scope','line']){
  const {source,current}=fixture(),events=[source];
  if(mode==='later')events.push({at:'2026-10-17T01:00:00Z',entity:'permissions',key:'u',before:source.changes[0].after,after:{...source.changes[0].after,permissions:'Approved / Xem'}});
  if(mode==='current')current[1].payload.permissions='New / Xem';
  if(mode==='missing')delete source.changes[0].before.login;
  if(mode==='scope')current.at(-1).payload.managers[0].group='AB';
  if(mode==='line')current[0].payload.line='A';
  assert.throws(()=>personalPermissionRecoveryPlan(events,current,at),undefined,mode);
 }
});
