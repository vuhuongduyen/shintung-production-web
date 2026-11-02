import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {historyAllocationSummary,historyAllocationTolerance} from '../lib/production-history-source.mjs';
import {reportReviewBlocker} from '../lib/production-progress-review.mjs';
const fixture={id:'TEST',planId:'PLAN',historicalImport:true,sourceCount:9,sourceCumulativeHours:18.32,sourceLaborHours:164.88,unallocatedHours:114.61,reportedQuantity:1000,reviewStatus:'Lịch sử chờ đối chiếu',hours:{hc:164.88,ot:0,total:164.88,perEmployee:[{id:'TEST',hc:50.27,ot:0,total:50.27}]}};
test('incomplete named allocation blocks historical confirmation; float tolerance and live reports preserved',()=>{
 assert.match(reportReviewBlocker(fixture),/chưa được phân bổ đủ/);
 const full={...fixture,unallocatedHours:0,hours:{...fixture.hours,perEmployee:[{id:'TEST',hc:164.88,ot:0,total:164.88}]}};assert.equal(reportReviewBlocker(full),'');
 assert.equal(reportReviewBlocker({...full,unallocatedHours:historyAllocationTolerance/2}),'');
 assert.equal(reportReviewBlocker({...fixture,historicalImport:false}),'');
 assert.deepEqual(historyAllocationSummary(fixture),{source:164.88,hc:50.27,ot:0,allocated:50.27,unallocated:114.61});
});
test('main preview displays source164.88, allocated50.27 and gap114.61 separately',()=>{
 const source=readFileSync(new URL('../components/production-history-import.tsx',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 let index=0;const hooks={...React,useState:initial=>[index++===1?{batch:{reports:[fixture],warnings:[]}}:initial,()=>{}]};
 const req=name=>name.endsWith('action-feedback')?(name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture):name==='react'?{...hooks,__esModule:true,default:hooks}:name.includes('production-history-source')?{historyAllocationSummary}:name.includes('production-display-time')?{productionDisplayTime:()=> 'TIME'}:name.includes('DataTable')?{DataTable:p=>React.createElement('div',null,p.children)}:name.includes('DataCell')?{DataCell:p=>React.createElement('td',null,p.children)}:{default:()=>null,__esModule:true};
 const mod={exports:{}};new Function('require','module','exports','React',js)(req,mod,mod.exports,React);const html=renderToStaticMarkup(React.createElement(mod.exports.default,{close(){},saved(){},employees:[]}));
 for(const value of ['Giờ công nguồn','Giờ đã phân bổ HC / TC','Giờ chưa phân bổ','164.88','50.27','114.61'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/164\.88 \/ 0\.00/);
});
test('server confirmation invokes the allocation blocker before issuing its transactional writes',()=>{
 const source=readFileSync(new URL('../worker/site-api.mjs',import.meta.url),'utf8');const start=source.indexOf("if(path==='/api/production-report')");const route=source.slice(start,source.indexOf("if(path==='/api/engine-run')",start));assert.ok(route.indexOf('reportReviewBlocker(current||report)')>=0);assert.ok(route.indexOf('reportReviewBlocker(current||report)')<route.indexOf('const statements=['));assert.match(route,/if\(approve&&blocker\)return json\(\{error:blocker\},409\)/);
});
test('verified aggregate source hours can be reviewed without fabricated employee allocations',()=>{
 const r={...fixture,sourceVerified:true,sourceReportId:'source-report',hours:{hc:164.88,ot:0,total:164.88,perEmployee:[],sourceTotal:true,sourceVerified:true},unallocatedHours:164.88};
 assert.equal(reportReviewBlocker(r),'');
 for(const altered of [{sourceReportId:''},{sourceVerified:false},{sourceLaborHours:null},{sourceLaborHours:160},{hours:{...r.hours,sourceTotal:false}}])assert.notEqual(reportReviewBlocker({...r,...altered}),'');
 assert.equal(reportReviewBlocker({...r,hours:{...r.hours,hc:null}}),'Chưa đủ dữ liệu giờ công');
 assert.equal(reportReviewBlocker({...r,pendingAttendance:[{}]}),'Có điều chỉnh giờ chờ duyệt');
 assert.equal(reportReviewBlocker({...r,unresolvedAttendance:[{}]}),'Chưa ghi giờ vào thực tế');
 assert.deepEqual(r.hours.perEmployee,[]);assert.equal(r.reviewStatus,'Lịch sử chờ đối chiếu');
});
