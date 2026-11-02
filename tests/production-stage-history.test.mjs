import test from 'node:test';import assert from 'node:assert/strict';
import {projectLiveStages,liveStageChoices,applyLiveStages} from '../lib/production-stage-live.mjs';
const orders=[{id:'O',lsxQty:100,processes:['CUT','ASSY','FINAL']}],o=orders[0],at=h=>`2026-10-20T${h}:00+07:00`;
const source=(op,h,extra={})=>({id:op+h,sourceId:'O',stageName:'A-CUT',sourceTimeLog:true,sourceVerified:true,historicalImport:true,sourceOperation:op,effectiveAt:at(h),...extra});
test('verified imported start/pause/resume retain stage eligibility without re-entry',()=>{
 const es=[source('Nhập trạm','08:00',{employees:['NV1']})];let s=projectLiveStages(orders,[],es);
 assert.deepEqual(liveStageChoices(o,s,'pause'),['CUT']);assert.deepEqual(liveStageChoices(o,s,'start'),['ASSY','FINAL']);
 es.push(source('Tạm ngưng','09:00'));s=projectLiveStages(orders,[],es);assert.deepEqual(liveStageChoices(o,s,'resume'),['CUT']);
 es.push(source('Tiếp tục','09:30'));s=projectLiveStages(orders,[],es);assert.deepEqual(liveStageChoices(o,s,'complete'),['CUT']);assert.deepEqual(s['["O","CUT"]'].people,['NV1']);
 const next=applyLiveStages(s,{orderId:'O',action:'pause',at:at('10:00'),entries:[{stage:'CUT'}]},orders);assert.equal(next['["O","CUT"]'].status,'paused');
});
test('imported report completes only its stage; later verified start opens remaining quantity',()=>{
 const rs=[{id:'R',erpStageImport:true,transitId:'O',stageName:'A-CUT',stageQuantity:40,startedAt:at('08:00'),completedAt:at('09:00'),employees:['NV1']}];
 const es=[source('Xuất trạm','09:00',{reportId:'R',recordedAt:'2026-10-24T08:00:00Z'})];
 let s=projectLiveStages(orders,rs,es);assert.equal(s['["O","CUT"]'].completed,40);assert.equal(s['["O","CUT"]'].status,'partial');
 es.push(source('Nhập trạm','10:00',{employees:['NV2']}));s=projectLiveStages(orders,rs,es);assert.equal(s['["O","CUT"]'].status,'running');assert.deepEqual(s['["O","CUT"]'].people,['NV2']);
 rs[0].stageQuantity=100;s=projectLiveStages(orders,rs,es);assert.equal(s['["O","CUT"]'].status,'done');assert.ok(!liveStageChoices(o,s,'extra').includes('CUT'));
});
test('cancelled and unscoped history never invent active stages or employees',()=>{
 const s=projectLiveStages(orders,[],[source('Nhập trạm','08:00',{stageName:undefined}),source('Nhập trạm','09:00',{voided:true})]);assert.deepEqual(liveStageChoices(o,s,'pause'),[]);
 const t=projectLiveStages(orders,[],[source('Nhập trạm','08:00')]);assert.deepEqual(t['["O","CUT"]'].people,[]);
});
test('later official state supersedes imports and normalizes legacy stage prefix',()=>{
 const es=[source('Nhập trạm','08:00',{employees:['NV1']}),{id:'live',sourceId:'O',stageReporting:true,stageName:'A-CUT',effectiveAt:at('09:00'),stageAfter:{orderId:'O',stage:'A-CUT',status:'paused',people:['NV1'],completed:0,startedAt:at('08:00'),at:at('09:00')}}];
 const s=projectLiveStages(orders,[],es);assert.equal(s['["O","CUT"]'].stage,'CUT');assert.deepEqual(liveStageChoices(o,s,'resume'),['CUT']);
});
