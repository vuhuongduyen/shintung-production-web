import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {default:Workspace,allocationDenialMessage}=await vite.ssrLoadModule('/components/production-allocation-workspace.tsx');
test('cold workspace displays loading context instead of disappearing',()=>{
 const html=renderToStaticMarkup(React.createElement(Workspace,{identity:'manager',refresh:async()=>true}));
 assert.match(html,/role="status"/);assert.match(html,/Điều phối nhân sự/);assert.match(html,/Đang tải…/);
});
test('403 clears retained queue and uses bounded server diagnosis; unverified or read-only submission remains denied',async()=>{
 const source=await readFile(new URL('../components/production-allocation-workspace.tsx',import.meta.url),'utf8');
 const {readAllocationWorkspace,retainedAllocation}=await vite.ssrLoadModule('/lib/allocation-workspace-cache.ts');
 const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
 globalThis.window={location:{origin:'https://synthetic.test'}};
 try{
  for(const reason of ['Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ.','Denied\n'+'x'.repeat(2000)]){
   clearClientReads('session');
   globalThis.fetch=async()=>Response.json({revision:1,group:'C',offers:[],candidates:[],sourceLines:['C']});
   const loaded=await readAllocationWorkspace(true);assert.equal(retainedAllocation(),loaded);
   globalThis.fetch=async()=>Response.json({error:reason},{status:403});
   const expected=await allocationDenialMessage(Response.json({error:reason},{status:403}));
   await assert.rejects(()=>readAllocationWorkspace(true),error=>error.status===403&&error.message===expected);
   assert.equal(retainedAllocation(),null,'denied response must purge retained private data');
  }
 }finally{clearClientReads('session');globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
 assert.match(source,/!verified.current\|\|!data\|\|data.readOnly/);
 assert.match(source,/if\(\[401,403\].includes\(\(e as any\)\?\.status\)\)setData\(null\)/);
 assert.match(source,/<ProductionAllocationQueue view=\{data\|\|emptyQueue\}/);
});
test('absent QLSX scope preserves backend reason and adds relevant setup path',async()=>{
 const reason='Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ.';
 const message=await allocationDenialMessage(Response.json({error:reason},{status:403}));
 assert.ok(message.startsWith(reason));assert.match(message,/Admin thiết lập tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX/);
});
test('inactive account denial is not misdiagnosed as missing scope',async()=>{
 const reason='Tài khoản đã ngừng hoạt động.';
 assert.equal(await allocationDenialMessage(Response.json({error:reason},{status:403})),reason);
});
test('global authorization denial keeps its actual JSON or plain text reason',async()=>{
 const reason='Bạn không có quyền truy cập chức năng này.';
 assert.equal(await allocationDenialMessage(Response.json({error:reason},{status:403})),reason);
 assert.equal(await allocationDenialMessage(new Response(reason,{status:403,headers:{'content-type':'text/plain'}})),reason);
});
test('unusable response gets neutral fallback, never unsupported missing-scope diagnosis',async()=>{
 for(const response of [new Response('',{status:403}),Response.json({error:{secret:'hidden'}},{status:403}),new Response('<html>Forbidden</html>',{status:403}),new Response('{broken json',{status:403,headers:{'content-type':'application/json'}})]){
  const message=await allocationDenialMessage(response);assert.match(message,/Không có quyền truy cập Điều phối nhân sự/);assert.doesNotMatch(message,/Chưa được|Thiết lập tại|hidden|html|broken/);
 }
});
test('server error is bounded and control characters are normalized',async()=>{
 const message=await allocationDenialMessage(Response.json({error:'Denied\n'+ 'x'.repeat(2000)},{status:403}));
 assert.equal(message.length,500);assert.ok(message.startsWith('Denied '));assert.doesNotMatch(message,/\n/);
});
