import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveInstant,resolveLeadtimeVersion} from '../lib/leadtime-effective.mjs';
import {capturePlanLeadtime,transitStandardLeadtime} from '../lib/transit-leadtime.mjs';
const row={id:'SYNTHETIC-PLAN',sku:'SYNTHETIC-LT',plan:1000,lsxQty:50};
const old={id:'OLD',sku:row.sku,status:'Hết hiệu lực',confirmedAt:'2026-10-01T00:00:00Z',validFrom:'2026-10-01',validTo:'2026-11-05',leadTime:2};
const next={id:'NEXT',sku:row.sku,status:'Đang áp dụng',validFrom:'2026-11-05',leadTime:5};
const saved=[{sku:row.sku,moq:1000,leadTime:99}];
test('date-only and offset intervals agree at Vietnam midnight for Plan and Transit',()=>{
 for(const [at,expected] of [['2026-11-04T16:59:59.999Z',2],['2026-11-04T17:00:00Z',5],['2026-11-05',5]]){
  for(const versions of [[old,next],[next,old]]){
   assert.equal(transitStandardLeadtime(row,saved,versions,at),expected);
   assert.equal(capturePlanLeadtime(row,saved,versions,at,'SYNTHETIC').value,expected);
  }
 }
 assert.equal(effectiveInstant('2026-11-05'),effectiveInstant('2026-11-05T00:00:00+07:00'));
});
test('gaps, overlaps and cancelled history cannot be replaced by current master values',()=>{
 const at='2026-11-03T00:00:00Z';
 for(const versions of [[next],[{...old,validTo:'2026-11-02'}],[old,{...old,id:'DUPLICATE'}],[{...old,cancelled:true}],[{...old,_deleted:true}],[{...old,status:'Đã hủy xác nhận'}],[{...old,confirmedAt:'invalid'}]]){
  assert.equal(transitStandardLeadtime(row,saved,versions,at),null);
  assert.equal(capturePlanLeadtime(row,saved,versions,at,'SYNTHETIC').value,null);
 }
 assert.equal(resolveLeadtimeVersion([old],row.sku,at).selected.id,'OLD');
 assert.equal(transitStandardLeadtime(row,saved,[{...next,status:'Nháp'}],at),99);
});
test('invalid calendar boundaries never become effective, and negative Leadtime stays missing',()=>{
 for(const date of ['2026-02-30','2026-02-30T00:00:00Z','2026-11-05T00:00:00','2026-13-01',''])assert.ok(Number.isNaN(effectiveInstant(date)),date);
 for(const version of [{...next,validFrom:'2026-02-30'},{...old,validTo:'2026-11-31'},{...next,leadTime:-1}]){
  const basis=capturePlanLeadtime(row,saved,[version],'2026-11-06T00:00:00Z','SYNTHETIC');
  assert.equal(basis.value,null);assert.equal(basis.basis,'missing');
 }
 assert.throws(()=>capturePlanLeadtime(row,[],[],'2026-02-30','SYNTHETIC'));
});
test('captured MOQ levels are isolated from later master edits; zero remains a valid value',()=>{
 const levels=[{sku:row.sku,moq:100,leadTime:0},{sku:row.sku,moq:1000,leadTime:5}];
 const basis=capturePlanLeadtime(row,levels,[],'2026-11-03T00:00:00Z','SYNTHETIC');
 levels[0].leadTime=99;levels[0].moq=1;
 assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:basis},levels,[next]),0);
 const damaged=capturePlanLeadtime(row,[{sku:row.sku,moq:-1,leadTime:2}],[],'2026-11-03T00:00:00Z','SYNTHETIC');
 assert.equal(damaged.value,null);assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:damaged},saved),null);
 assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:{...basis,tiers:[{moq:-1,value:2}]}},saved),null);
});

test('published MOQ tier snapshots select the transferred quantity and survive future tier edits',()=>{
 const version={...next,tiers:[{moq:100,value:2},{moq:1000,value:5}]};
 const basis=capturePlanLeadtime(row,[],[version],'2026-11-06T00:00:00Z','SYNTHETIC');
 assert.equal(basis.value,5);version.tiers[0].value=99;
 assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:basis},[],[version]),2);
 for(const tiers of [[{moq:100,value:2},{moq:100,value:7}],[{moq:100,value:7},{moq:100,value:2}]]){
  const missing=capturePlanLeadtime(row,[],[{...version,tiers}],'2026-11-06T00:00:00Z','SYNTHETIC');
  assert.equal(missing.value,null);assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:missing}),null);
 }
});

test('a cancelled source cannot regain a numeric result through captured tiers',()=>{
 const version={...next,tiers:[{moq:100,value:2},{moq:1000,value:5}]};
 const basis=capturePlanLeadtime(row,[{sku:row.sku,cancelled:true}],[version],'2026-11-06T00:00:00Z','SYNTHETIC');
 assert.equal(basis.value,null);assert.equal(basis.tiers,undefined);assert.equal(transitStandardLeadtime({...row,planLeadtimeBasis:basis}),null);
});
