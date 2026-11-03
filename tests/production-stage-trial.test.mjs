import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStageTrial as apply,stageKey as key,stageChoices} from '../lib/production-stage-trial.mjs';
const orders=[{id:'a',lsxQty:20,processes:['CUT','PACKING']},{id:'b',lsxQty:20,processes:['CUT','PACKING']}];
const at='2026-10-20T08:00:00+07:00',later='2026-10-20T09:00:00+07:00';
const start=(state,orderId,stage,people,more={})=>apply(state,{orderId,action:'start',at,entries:[{stage,people}],...more},orders);
test('start hides active stage; pause/resume offer only eligible stages',()=>{
 let s=start({},'a','CUT',['1']);assert.deepEqual(stageChoices(orders[0],s,'start'),['PACKING']);
 s=apply(s,{orderId:'a',action:'pause',at:later,entries:[{stage:'CUT'}]},orders);assert.deepEqual(stageChoices(orders[0],s,'complete'),[]);assert.deepEqual(stageChoices(orders[0],s,'resume'),['CUT']);
});
test('transfer requires confirmation and atomically removes old assignment',()=>{
 const s=start({},'a','PACKING',['1','2']);assert.throws(()=>start(s,'b','CUT',['1']),/xác nhận/);assert.equal(s[key('a','PACKING')].people.length,2);
 const next=start(s,'b','CUT',['1'],{at:later,confirmed:true});assert.deepEqual(next[key('a','PACKING')].people,['2']);assert.deepEqual(next[key('b','CUT')].people,['1']);
});
test('last worker transfer pauses old stage and supports resume with new staff',()=>{
 let s=start({},'a','PACKING',['1']);s=start(s,'b','CUT',['1'],{at:later,confirmed:true});assert.equal(s[key('a','PACKING')].status,'paused');
 s=apply(s,{orderId:'a',action:'resume',at:later,entries:[{stage:'PACKING',people:['2']}]},orders);assert.deepEqual(s[key('a','PACKING')].people,['2']);
});
test('partial completion retains remaining crew and transfers only selected workers',()=>{
 let s=start({},'a','CUT',['1','2']);s=start(s,'b','PACKING',['3']);
 const next=apply(s,{orderId:'a',action:'complete',at:later,entries:[{stage:'CUT',quantity:10}],destinations:{'1':key('b','PACKING')}},orders);
 assert.deepEqual(next[key('a','CUT')].people,['2']);assert.deepEqual(next[key('b','PACKING')].people,['3','1']);assert.ok(!stageChoices(orders[0],next,'start').includes('CUT'));assert.ok(stageChoices(orders[0],next,'complete').includes('CUT'));assert.equal(next[key('a','CUT')].completed,10);
 assert.throws(()=>apply(s,{orderId:'a',action:'complete',at:later,entries:[{stage:'CUT',quantity:21}]},orders),/vượt/);
});
test('reject duplicate person across parallel starts and backdating, no input mutations',()=>{
 assert.throws(()=>apply({},{orderId:'a',action:'start',at,entries:[{stage:'CUT',people:['1']},{stage:'PACKING',people:['1']}]},orders),/Một nhân viên/);
 const s=start({},'a','CUT',['1']);assert.throws(()=>apply(s,{orderId:'a',action:'complete',at:'2026-10-19T08:00:00+07:00',entries:[{stage:'CUT',quantity:1}]},orders),/Thời gian/);assert.equal(s[key('a','CUT')].status,'running');
});
test('add preserves current staff and confirms transfers without mutating input',()=>{
 let s=start({},'a','CUT',['1']);s=start(s,'b','PACKING',['2']);
 const cmd={orderId:'a',action:'add',at:later,entries:[{stage:'CUT',people:['2']}]};
 assert.throws(()=>apply(s,cmd,orders),/xác nhận/);
 const n=apply(s,{...cmd,confirmed:true},orders);
 assert.deepEqual(n[key('a','CUT')].people,['1','2']);assert.equal(n[key('b','PACKING')].status,'paused');assert.deepEqual(s[key('a','CUT')].people,['1']);
 assert.throws(()=>apply(n,{...cmd,confirmed:true},orders),/đã ở/);
});
test('incident records details; stopping enables resume and allows add without resuming and disables exit',()=>{
 let s=start({},'a','CUT',['1']);
 const cmd={orderId:'a',action:'incident',at:later,reason:'Máy dừng',affectedQuantity:2,entries:[{stage:'CUT'}]};
 assert.throws(()=>apply(s,{...cmd,reason:''},orders),/nội dung/);
 s=apply(s,{...cmd,stopWork:false},orders);assert.equal(s[key('a','CUT')].status,'paused');assert.equal(s[key('a','CUT')].incidents[0].affectedQuantity,2);
 s=apply(s,{...cmd,stopWork:true},orders);assert.deepEqual(stageChoices(orders[0],s,'resume'),['CUT']);assert.deepEqual(stageChoices(orders[0],s,'add'),['CUT']);assert.deepEqual(stageChoices(orders[0],s,'complete'),[]);
 s=apply(s,{orderId:'a',action:'resume',at:later,entries:[{stage:'CUT'}]},orders);assert.equal(s[key('a','CUT')].status,'running');assert.deepEqual(s[key('a','CUT')].people,['1']);
});

const {initializeStageTrial,isStageTrialAction}=await import('../lib/production-stage-trial.mjs');
for(const action of ['pause','resume','complete'])test(`legacy ${action} starts with explicit selected-stage baseline, without guessing other stages`,()=>{
 const source={};const before=JSON.stringify(orders);
 let s=initializeStageTrial(source,{orderId:'a',action,at,entries:[{stage:'CUT',people:['1']}]},orders);
 assert.deepEqual(source,{});assert.equal(JSON.stringify(orders),before);
 assert.equal(s[key('a','PACKING')],undefined);
 assert.deepEqual(stageChoices(orders[0],s,action),['CUT']);
 s=apply(s,{orderId:'a',action,at:later,reason:'Tạm dừng máy',entries:[{stage:'CUT',quantity:20}]},orders);
 assert.equal(s[key('a','CUT')].status,{pause:'paused',resume:'running',complete:'done'}[action]);
 if(action==='complete'){assert.deepEqual(s[key('a','CUT')].people,[]);assert.deepEqual(stageChoices(orders[0],s,'start'),['PACKING']);}
 assert.throws(()=>initializeStageTrial(s,{orderId:'a',action,at,entries:[{stage:'CUT',people:['2']}]},orders),/khởi tạo lại/);
});
test('baseline respects employee transfer confirmation and never mutates an existing order',()=>{
 const source=start({},'b','PACKING',['1']);
 const command={orderId:'a',action:'pause',at:later,entries:[{stage:'CUT',people:['1']}]};
 assert.throws(()=>initializeStageTrial(source,command,orders),/xác nhận/);
 const result=initializeStageTrial(source,{...command,confirmed:true},orders);
 assert.deepEqual(source[key('b','PACKING')].people,['1']);assert.deepEqual(result[key('b','PACKING')].people,[]);
 assert.throws(()=>initializeStageTrial({}, {...command,entries:[{stage:'CUT',people:[]}]},orders),/Chọn nhân viên/);
});
test('full stage lifecycle filters each action independently for parallel stages',()=>{
 let s=start({},'a','CUT',['1']);s=start(s,'a','PACKING',['2']);
 s=apply(s,{orderId:'a',action:'pause',at:later,reason:'Dừng CUT',entries:[{stage:'CUT'}]},orders);
 assert.deepEqual(stageChoices(orders[0],s,'pause'),['PACKING']);assert.deepEqual(stageChoices(orders[0],s,'complete'),['PACKING']);assert.deepEqual(stageChoices(orders[0],s,'resume'),['CUT']);
 s=apply(s,{orderId:'a',action:'resume',at:later,entries:[{stage:'CUT'}]},orders);
 assert.deepEqual(stageChoices(orders[0],s,'resume'),[]);
 s=apply(s,{orderId:'a',action:'complete',at:later,entries:[{stage:'CUT',quantity:20}]},orders);
 assert.deepEqual(stageChoices(orders[0],s,'pause'),['PACKING']);assert.deepEqual(stageChoices(orders[0],s,'start'),[]);
});
test('every stage action uses trial routing even before any trial entry exists',()=>{
 for(const action of ['start','pause','resume','complete','add','incident'])assert.equal(isStageTrialAction(action),true);
 assert.equal(isStageTrialAction('transfer'),false);
});

for(const action of ['pause','incident'])test(action+' needs no employee selection on first trial',()=>{
 const next=apply({},{orderId:'a',action,at,reason:'Dừng máy',entries:[{stage:'CUT'}]},orders);
 assert.equal(next[key('a','CUT')].status,'paused');
 assert.deepEqual(next[key('a','CUT')].people,[]);
 assert.equal(next[key('a','PACKING')],undefined);
});
test('incident automatically closes extra work and preserves assigned people',()=>{
 let s=apply({},{orderId:'a',action:'extra',at,entries:[{stage:'CUT',people:['1']},{stage:'PACKING',people:['2']}]},orders);
 s=apply(s,{orderId:'a',action:'incident',at:later,reason:'Máy hỏng',stopWork:false,entries:[{stage:'CUT'}]},orders);
 assert.equal(s[key('a','CUT')].status,'paused');
 assert.deepEqual(s[key('a','CUT')].people,['1']);
 assert.equal(s[key('a','CUT')].extraSessions[0].end,later);
 assert.equal(s[key('a','CUT')].incidents[0].stopWork,true);
 assert.equal(s[key('a','PACKING')].status,'running');
 assert.equal(s[key('a','PACKING')].extraSessions[0].end,undefined);
});
