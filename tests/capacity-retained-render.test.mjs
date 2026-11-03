import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
const week='2026-10-12';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {default:Capacity,CapacityReadBoundary}=await vite.ssrLoadModule('/components/weekly-capacity.tsx');
const cache=await vite.ssrLoadModule('/lib/capacity-workspace-cache.ts');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const render=(component,props,children)=>renderToStaticMarkup(React.createElement(component,props,children));
const body=(rows=[newDailyCapacity(week,'A')])=>({week,revision:3,rows,employees:[],legacy:[],permissions:{view:true,edit:true,confirm:true}});
async function browser(action){
 const savedWindow=globalThis.window,savedFetch=globalThis.fetch;
 try{globalThis.window={location:{origin:'https://synthetic.test'}};sync.clearClientReads('session');await action();}
 finally{cache.clearCapacitySnapshots();sync.clearClientReads('session');globalThis.fetch=savedFetch;if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;}
}

test('cold summary/calendar renders only loading, never aggregate or missing-calendar conclusions',()=>{
 for(const view of ['summary','calendar']){
  const html=render(Capacity,{view});assert.match(html,/Đang tải tuần Capacity/);assert.doesNotMatch(html,/Tuần đã lưu theo bảng|Không có dữ liệu Capacity|cap-summary-row/);
 }
});

test('warm browser summary/calendar renders the real retained week synchronously with inert cached actions',async()=>browser(async()=>{
 globalThis.fetch=async input=>Response.json(String(input).includes('latest=1')?{week}:body());
 await cache.readCapacityLatest();await cache.readCapacityWeek(week);
 for(const view of ['summary','calendar']){
  const html=render(Capacity,{view});assert.match(html,/value="2026-10-12"/);assert.doesNotMatch(html,/Dữ liệu đã tải lúc|Đang làm mới Capacity/);
  assert.doesNotMatch(html,/Đang tải tuần Capacity|Tuần đã lưu theo bảng|Không có dữ liệu Capacity|>Lưu nháp<|>Xác nhận</);
  if(view==='summary')assert.match(html,/cap-summary-row/);else assert.match(html,/Giờ khả dụng dự tính/);
 }
}));

test('slow latest lookup does not hide a loaded exact-week snapshot on a new menu',async()=>browser(async()=>{
 globalThis.fetch=async input=>Response.json(String(input).includes('latest=1')?{week}:body());await cache.readCapacityLatest();await cache.readCapacityWeek(week);
 let finish;globalThis.fetch=()=>new Promise(resolve=>finish=resolve);const pending=cache.readCapacityLatest(true);await new Promise(resolve=>setImmediate(resolve));
 assert.match(render(Capacity,{view:'summary'}),/cap-summary-row/);assert.match(render(Capacity,{view:'calendar'}),/Giờ khả dụng dự tính/);
 finish(Response.json({week}));await pending;
}));

test('successful empty response removes retained rows and distinguishes empty from an aggregate week',async()=>browser(async()=>{
 let empty=false;globalThis.fetch=async input=>Response.json(String(input).includes('latest=1')?{week}:body(empty?[]:undefined));await cache.readCapacityLatest();await cache.readCapacityWeek(week);empty=true;await cache.readCapacityWeek(week,true);
 assert.doesNotMatch(render(Capacity,{view:'summary'}),/cap-summary-row/);
 const calendar=render(Capacity,{view:'calendar'});assert.match(calendar,/Không có dữ liệu Capacity/);assert.doesNotMatch(calendar,/Tuần đã lưu theo bảng/);
}));

test('session/grant reset makes a new menu cold and non-JSON 403 clears all retained data',async()=>browser(async()=>{
 globalThis.fetch=async input=>Response.json(String(input).includes('latest=1')?{week}:body());await cache.readCapacityLatest();await cache.readCapacityWeek(week);
 sync.clearClientReads('session');assert.doesNotMatch(render(Capacity,{view:'summary'}),/cap-summary-row/);assert.equal(cache.retainedCapacityLatest(),null);
 await cache.readCapacityLatest();await cache.readCapacityWeek(week);globalThis.fetch=async()=>new Response('SYNTHETIC DENIED',{status:403});
 await assert.rejects(cache.readCapacityWeek(week,true),{status:403});assert.equal(cache.retainedCapacity(week),null);assert.equal(cache.retainedCapacityLatest(),null);
 const denied=render(Capacity,{view:'calendar'});assert.match(denied,/role="alert"/);assert.match(denied,/Thử lại/);assert.doesNotMatch(denied,/Đang tải tuần Capacity|Tuần đã lưu theo bảng/);
}));

test('read boundary hides business conclusions for loading/error, retains data with timestamp/error/retry',()=>{
 const business=React.createElement('span',{'data-business':'yes'},'Tuần đã lưu theo bảng Capacity tổng hợp');
 for(const error of ['', 'SYNTHETIC 503']){
  const html=render(CapacityReadBoundary,{hasData:false,loading:!error,error,retry:()=>{}},business);assert.doesNotMatch(html,/data-business|Tuần đã lưu theo bảng/);
  if(error){assert.match(html,/role="alert"/);assert.match(html,/Thử lại/);}else assert.match(html,/role="status"/);
 }
 const html=render(CapacityReadBoundary,{hasData:true,loading:false,error:'SYNTHETIC 503',updatedAt:1000,retry:()=>{}},business);
 assert.match(html,/data-business/);assert.match(html,/đang hiển thị dữ liệu đã tải trước đó/);assert.match(html,/Dữ liệu đã tải lúc/);assert.match(html,/Thử lại/);
});
test('warm Capacity boundary adds no routine status or timestamp above existing content',()=>{
 const business=React.createElement('table',{'data-business':'yes'},React.createElement('tbody',null,React.createElement('tr',null,React.createElement('td',null,'SYNTHETIC'))));
 for(const loading of [false,true]){
  const html=render(CapacityReadBoundary,{hasData:true,loading,error:'',updatedAt:1000,retry:()=>{}},business);
  assert.equal(html,renderToStaticMarkup(business));
 }
});
