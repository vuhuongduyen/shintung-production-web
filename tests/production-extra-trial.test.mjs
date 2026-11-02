import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStageTrial,stageKey,stageChoices} from '../lib/production-stage-trial.mjs';
import {extraTrialHours} from '../lib/production-extra-trial.mjs';
const at=h=>`2026-10-24T${h}:00+07:00`, session={employee:'viet',start:at('08:00')};
test('unscheduled Saturday counts only HC, union of breaks and warehouse; exit caps time',()=>{
 assert.ok(Math.abs(extraTrialHours(session,'B').hours-7-2/3)<0.0001);
 const events=[{id:'w',kind:'line-absence',employees:['viet'],effectiveAt:at('09:00'),endsAt:at('10:10')},{id:'a',kind:'absence',employees:['viet'],effectiveAt:at('09:30'),endsAt:at('10:00')}];
 assert.ok(Math.abs(extraTrialHours({...session,end:at('11:00')},'B',[],events).hours-1-5/6)<0.0001);
 assert.equal(extraTrialHours({...session,start:at('18:00')},'B').hours,0);
});
test('extra resumes selected people only; exit closes interval, preserves input',()=>{
 const orders=[{id:'b',lsxQty:20,processes:['CUT']}],key=stageKey('b','CUT');
 const old={[key]:{orderId:'b',stage:'CUT',status:'paused',people:['other'],completed:0,at:at('07:00')}};
 let next=applyStageTrial(old,{orderId:'b',action:'extra',at:at('08:00'),entries:[{stage:'CUT',people:['viet']}]},orders);
 assert.deepEqual(next[key].people,['viet']);assert.deepEqual(old[key].people,['other']);
 next=applyStageTrial(next,{orderId:'b',action:'complete',at:at('11:00'),entries:[{stage:'CUT',quantity:20}]},orders);
 assert.equal(next[key].extraSessions[0].end,at('11:00'));
});
test('configured ordinary weekday HC is used without opening Saturday for the line',()=>{
 const refs=[{key:'2026-10-19:B',days:[{date:'2026-10-23',working:true,hcStart:480,hcEnd:960},{date:'2026-10-24',working:false}]}];
 assert.ok(Math.abs(extraTrialHours(session,'B',refs).hours-6-2/3)<0.0001);assert.equal(refs[0].days[1].working,false);
});

test('extra auto-starts waiting stages, keeps partial exits available and hides completed stages',()=>{
 const orders=[{id:'b',lsxQty:20,processes:['CUT','PACKING']}];
 assert.deepEqual(stageChoices(orders[0],{},'extra'),['CUT','PACKING']);
 assert.deepEqual(stageChoices(orders[0],{},'start'),['CUT','PACKING']);
 const first=applyStageTrial({},{orderId:'b',action:'extra',at:at('08:00'),entries:[{stage:'CUT',people:['viet']}]},orders);assert.equal(first[stageKey('b','CUT')].startedAt,at('08:00'));assert.equal(first[stageKey('b','CUT')].status,'running');assert.equal(first[stageKey('b','PACKING')],undefined);
 for(const quantity of [10,20]){
 let state=applyStageTrial({},{orderId:'b',action:'start',at:at('08:00'),entries:[{stage:'CUT',people:['viet']}]},orders);
 state=applyStageTrial(state,{orderId:'b',action:'complete',at:at('09:00'),entries:[{stage:'CUT',quantity}]},orders);
 assert.deepEqual(stageChoices(orders[0],state,'extra'),quantity===10?['CUT','PACKING']:['PACKING']);
 const command={orderId:'b',action:'extra',at:at('10:00'),entries:[{stage:'CUT',people:['viet']}]};
 if(quantity===20)assert.throws(()=>applyStageTrial(state,command,orders),/Trạng thái/);
 else {const next=applyStageTrial(state,command,orders);assert.equal(next[stageKey('b','CUT')].completed,10);assert.equal(next[stageKey('b','CUT')].status,'running');}
 }
});

test('hours stop at 17:00 even if exiting later; stage remains running without exit',()=>{
 const open=extraTrialHours(session,'B').hours;
 assert.equal(extraTrialHours({...session,end:at('19:00')},'B').hours,open);
 assert.equal(extraTrialHours({...session,end:'2026-10-25T10:00:00+07:00'},'B').hours,open);
 const orders=[{id:'b',lsxQty:20,processes:['CUT']}];
 const state=applyStageTrial({},{orderId:'b',action:'extra',at:at('08:00'),entries:[{stage:'CUT',people:['viet']}]},orders);
 extraTrialHours(state[stageKey('b','CUT')].extraSessions[0],'B');
 assert.equal(state[stageKey('b','CUT')].status,'running');
});
