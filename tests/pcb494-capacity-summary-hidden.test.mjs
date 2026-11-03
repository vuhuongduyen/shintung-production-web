import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {newDailyCapacity,dailyParticipants} from '../lib/capacity.mjs';
const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {default:CapacityDailyEditor}=await vite.ssrLoadModule('/components/capacity-daily-editor.tsx');
const week='2026-10-12';
function render(row,locale='vi'){
 let changes=0;const t=(vi,zh,en)=>locale==='zh'?zh:locale==='en'?en:vi;
 const html=renderToStaticMarkup(React.createElement(CapacityDailyEditor,{week,row,disabled:false,t,locale,employees:[],onChange:()=>changes++,onError:message=>{throw Error(message)}}));assert.equal(changes,0);return html;
}
test('named-roster calendar omits both repeated summaries in all locales and keeps factor95 and schedule table',()=>{
 const row=newDailyCapacity(week,'A');row.input.factor=95;row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:d.working?['TEST-A','TEST-B','TEST-C']:[],ot:[]}));
 for(const locale of ['vi','en','zh']){
  const html=render(row,locale);assert.doesNotMatch(html,/cap-roster-summary|HC theo ngày|TC theo ngày|Daily HC|Daily OT|每日正常人員|每日加班人員/);
  assert.match(html,/cap-daily-settings/);assert.match(html,/value="95"/);assert.match(html,/cap-days-table/);
 }
});
test('per-day table staff still follows derived participants when a synthetic transfer changes the roster',()=>{
 const row=newDailyCapacity(week,'A');row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:d.working?['TEST-A','TEST-B']:[],ot:[]}));
 const before=render(row);assert.match(before,/2 người/);assert.equal(dailyParticipants(row.input,0).hcCount,2);
 row.input.dailyRoster[0].hc.push('TEST-INCOMING');const after=render(row);assert.match(after,/3 người/);assert.equal(dailyParticipants(row.input,0).hcCount,3);assert.doesNotMatch(after,/cap-roster-summary/);
});
test('legacy count inputs remain when no named roster exists',()=>{
 const row=newDailyCapacity(week,'A');delete row.input.dailyRoster;row.input.workers=4;row.input.otWorkers=2;const html=render(row);
 assert.match(html,/Người HC \(theo tên\)/);assert.match(html,/Người tăng ca đã chọn/);assert.match(html,/value="4"/);assert.match(html,/value="2"/);
});
