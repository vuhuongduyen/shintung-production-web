import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':resolve(root)}},server:{middlewareMode:true}});
after(()=>vite.close());
const {default:ProductionManagement,ProductionReadBoundary}=await vite.ssrLoadModule('/components/production-management.tsx');
const render=(component,props,children)=>renderToStaticMarkup(React.createElement(component,props,children));
const business=React.createElement('div',{'data-business-view':true},'Chưa có lịch thực tế được duyệt cho ngày này');

test('the production screen never renders missing-calendar or empty-order messages before its first read',()=>{
  const html=render(ProductionManagement,{mode:'work',operator:'SYNTHETIC-TEST'});
  assert.match(html,/Đang tải dữ liệu sản xuất/);
  assert.doesNotMatch(html,/Chưa có lịch|Chưa có LSX|work-calendar-banner|work-daily-absences/);
});

test('initial failure renders retry, not an empty business result',()=>{
  const html=render(ProductionReadBoundary,{hasData:false,loading:false,error:new Error('SYNTHETIC-503'),retry:()=>{}},business);
  assert.match(html,/role="alert"/); assert.match(html,/Thử lại/); assert.match(html,/SYNTHETIC-503/);
  assert.doesNotMatch(html,/data-business-view|Chưa có lịch/);
});

test('initial loading hides business content while background loading preserves it',()=>{
  const loading=render(ProductionReadBoundary,{hasData:false,loading:true,error:null,retry:()=>{}},business);
  assert.match(loading,/role="status"/); assert.doesNotMatch(loading,/data-business-view|Chưa có lịch/);
  const background=render(ProductionReadBoundary,{hasData:true,loading:true,error:null,retry:()=>{}},business);
  assert.match(background,/data-business-view/); assert.doesNotMatch(background,/Đang tải dữ liệu sản xuất|Đang cập nhật nền|production-background-status/);
  assert.equal(background,render(ProductionReadBoundary,{hasData:true,loading:false,error:null,retry:()=>{}},business));
});

test('background error keeps the business view and visibly labels the last loaded data with retry',()=>{
  const html=render(ProductionReadBoundary,{hasData:true,loading:false,error:new Error('SYNTHETIC-503'),retry:()=>{}},business);
  assert.match(html,/data-business-view/); assert.match(html,/Đang hiển thị dữ liệu đã tải trước đó/); assert.match(html,/role="alert"/); assert.match(html,/Thử lại/);
});

test('real workflow adapter skips shared snapshots on SSR and rejects malformed business responses',async()=>{
  const {readProductionWorkflow,productionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts');
  const savedFetch=globalThis.fetch;
  let calls=0;
  const empty={orders:[],reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:false,line:null}};
  try {
    globalThis.fetch=async()=>{calls++;return Response.json(empty);};
    await readProductionWorkflow(); await readProductionWorkflow();
    assert.equal(calls,2); assert.equal(productionSnapshot(),null);
    globalThis.fetch=async()=>Response.json({orders:[]});
    await assert.rejects(readProductionWorkflow(),/Dữ liệu sản xuất chưa hợp lệ/);
  } finally { globalThis.fetch=savedFetch; }
});

test('real browser workflow adapter clears its cached snapshot on a non-JSON authentication failure',async()=>{
  const {readProductionWorkflow,productionSnapshot,clearProductionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts');
  const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
  const savedFetch=globalThis.fetch, savedWindow=globalThis.window;
  const empty={orders:[],reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:false,line:null}};
  try {
    globalThis.window={location:{origin:'https://synthetic.test'}};
    clearClientReads();
    globalThis.fetch=async()=>Response.json(empty);
    await readProductionWorkflow(); assert.deepEqual(productionSnapshot(),empty);
    globalThis.fetch=async()=>new Response('SYNTHETIC LOGIN REQUIRED',{status:401});
    await assert.rejects(readProductionWorkflow(true),{status:401});
    assert.equal(productionSnapshot(),null);
  } finally {
    clearProductionSnapshot(); clearClientReads(); globalThis.fetch=savedFetch;
    if(savedWindow===undefined)delete globalThis.window; else globalThis.window=savedWindow;
  }
});

test('schedule refresh is silent while retaining content and actionable errors',()=>{
 const html=render(ProductionReadBoundary,{quiet:true,hasData:true,loading:true,error:null,retry:()=>{}},business);
 assert.match(html,/data-business-view/);assert.doesNotMatch(html,/Đang cập nhật nền|production-background-status/);
 const failed=render(ProductionReadBoundary,{quiet:true,hasData:true,loading:false,error:new Error('TEST'),retry:()=>{}},business);
 assert.match(failed,/role="alert"/);assert.match(failed,/Thử lại/);
});

test('opening work or schedule reuses a fresh full snapshot without another network request',async()=>{
 const {readProductionWorkflow,productionSnapshot,clearProductionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts');
 const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
 const savedFetch=globalThis.fetch,savedWindow=globalThis.window;let calls=0;
 const body={orders:[],reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:true,line:null}};
 try{globalThis.window={location:{origin:'https://synthetic.test'}};clearClientReads();globalThis.fetch=async()=>{calls++;return Response.json(body);};const full=await readProductionWorkflow(false,'full');assert.equal(productionSnapshot('work'),full);assert.equal(await readProductionWorkflow(false,'work'),full);assert.equal(calls,1);clearClientReads('mutation');await readProductionWorkflow(false,'work');assert.equal(calls,2);}finally{clearProductionSnapshot();clearClientReads();globalThis.fetch=savedFetch;if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;}
});
