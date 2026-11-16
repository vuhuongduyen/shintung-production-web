import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function fixture({pingFails=false}={}) {
 const calls=[], properties={ONSPA_URL:'https://sanxuat.shintung-vn-4458.chatgpt.site',ONSPA_TOKEN:'SYNTHETIC-EXISTING-KEY',ONSPA_SHEET:'SYNTHETIC-SHEET'};
 const oldTrigger={getHandlerFunction:()=> 'ONSPA_dongBoTuDong'},otherTrigger={getHandlerFunction:()=> 'OTHER_JOB'};
 const ui={ButtonSet:{OK_CANCEL:'OK_CANCEL'},Button:{OK:'OK'},prompt:()=>({getSelectedButton:()=> 'OK',getResponseText:()=> 'https://sanxuat.shintung-vn-4458.chatgpt.site'}),alert:()=>{}};
 const context=vm.createContext({SpreadsheetApp:{getUi:()=>ui,getActive:()=>({getId:()=>properties.ONSPA_SHEET})},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...properties}),setProperties:v=>Object.assign(properties,v)})},ScriptApp:{getProjectTriggers:()=>[oldTrigger,otherTrigger],deleteTrigger:t=>calls.push({deleted:t===oldTrigger?'sync':'other'}),newTrigger:handler=>({timeBased:()=>({everyMinutes:n=>({create:()=>calls.push({created:handler,minutes:n})})})})}});
 vm.runInContext(readFileSync(new URL('../scripts/warehouse-sheet/ONSPA_KHO_WEB.gs',import.meta.url),'utf8'),context);
 context.ONSPA_api_=body=>{calls.push({...body});if(pingFails)throw Error('Synthetic connection unavailable');return {connected:true};};
 return {context,calls,properties,ui};
}

test('connection check and legacy recovery only ping without changing settings, jobs or receipts',()=>{
 for(const name of ['ONSPA_kiemTraKetNoi','ONSPA_khoiPhucKetNoi']) {
  const f=fixture(),before={...f.properties};
  assert.equal(f.context[name]().connected,true);
  assert.deepEqual(f.calls,[{action:'ping'}]);
  assert.deepEqual(f.properties,before);
 }
});
test('failed check or explicit enable preserves all existing triggers',()=>{
 for(const name of ['ONSPA_kiemTraKetNoi','ONSPA_khoiPhucKetNoi','ONSPA_batTriggerDongBo']) {
  const f=fixture({pingFails:true});
  assert.throws(()=>f.context[name](),/unavailable/);
  assert.deepEqual(f.calls,[{action:'ping'}]);
 }
});
test('only explicit enable replaces the matching job, preserves other jobs and performs no receipt operation',()=>{
 const f=fixture();f.context.ONSPA_batTriggerDongBo();
 assert.deepEqual(f.calls,[{action:'ping'},{deleted:'sync'},{created:'ONSPA_dongBoTuDong',minutes:1}]);
});
test('setup checks saved URL/key without starting a trigger',()=>{
 const f=fixture();let prompts=0;
 f.ui.prompt=()=>({getSelectedButton:()=> 'OK',getResponseText:()=> ++prompts===1?f.properties.ONSPA_URL:'SYNTHETIC-NEW-KEY'});
 f.context.ONSPA_caiDatKetNoi();assert.equal(f.properties.ONSPA_TOKEN,'SYNTHETIC-NEW-KEY');
 assert.deepEqual(f.calls,[{action:'ping'}]);
});
