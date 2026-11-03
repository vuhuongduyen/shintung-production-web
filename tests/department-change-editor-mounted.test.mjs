import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {Miniflare} from 'miniflare';
import {changeRequests} from '../worker/change-requests.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','HTMLSelectElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','getComputedStyle','localStorage'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {DepartmentChangeRequests}=await vite.ssrLoadModule('/components/department-change-requests.tsx');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close()});
for(const reply of [false,true])test(`mounted ${reply?'warehouse reply':'new KH request'} saves in place then sends with saved revision`,async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'editor-test'}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
 const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();
 const login=reply?'tpnhi':'htndiem',actor={permissionLogin:login};let rows=[],focusId=null;
 if(reply){const id=crypto.randomUUID();await changeRequests(db,{permissionLogin:'htndiem'},{action:'send',id,text:'Fixture KH request'});await changeRequests(db,actor,{action:'save',id,revision:1,department:'Kho LK',text:'Warehouse reply'});rows=(await changeRequests(db,actor)).records;focusId=id;}
 const calls=[];globalThis.fetch=async(input,init={})=>{if(String(input)!=='/api/change-requests')return Response.json({ok:true});const body=JSON.parse(init.body);calls.push(body);try{return Response.json(await changeRequests(db,actor,body))}catch(e){return Response.json({error:e.message},{status:e.status||400})}};
 await act(async()=>root.render(React.createElement(DepartmentChangeRequests,{rows,error:'',refresh:async()=>{},login,originScope:'KHSX',focusId,onFocusConsumed:()=>{}})));
 const button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===label&&!b.disabled);
 if(!reply){await act(async()=>button('Thêm mới').click());const textarea=host.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'New KH request');textarea.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
 const originalText=host.querySelector('textarea').value;
 await act(async()=>button('Lưu').click());
 for(let i=0;i<100&&!button('Gửi');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert.ok(host.querySelector('[role="dialog"]'),'save must keep editor open');assert.equal(host.querySelector('textarea').value,originalText);assert.ok(button('Gửi'));assert.match(host.textContent,/Đã lưu nháp/);
 const saved=(await changeRequests(db,actor)).records[0];assert.equal(saved.drafts[login].text,originalText);
 await act(async()=>button('Gửi').click());for(let i=0;i<100&&host.querySelector('[role="dialog"]');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(calls[1].revision,saved.revision);assert.equal(calls[1].id,calls[0].id);assert.equal(host.querySelector('[role="dialog"]'),null);
 const sent=(await changeRequests(db,{permissionLogin:'htndiem'})).records[0];assert.equal(sent.messages.at(-1).text,originalText);assert.equal(sent.messages.at(-1).login,login);assert.equal(sent.messages.length,reply?2:1);
 }finally{await act(async()=>root.unmount());host.remove();await mf.dispose();globalThis.fetch=originalFetch;}
});
test('origin sees history only, no reply box or save/send, and opening acknowledges viewed responses',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let reads=[],refreshes=0;
 const row={id:crypto.randomUUID(),code:'TEST-READ',owner:'htndiem',department:'KHSX',createdAt:new Date().toISOString(),revision:3,unreadReplyCount:2,pendingDepartments:['Kho LK','Kho UT','KHSX'],messages:[{text:'Original',department:'KHSX',login:'htndiem'},{text:'Reply one',department:'QLSX',login:'cnphuong'},{text:'Reply two',department:'Kho BB',login:'httung'}],drafts:{}};
 globalThis.fetch=async(input,init={})=>{if(String(input)==='/api/change-requests')reads.push(JSON.parse(init.body));return Response.json({ok:true})};
 try{await act(async()=>root.render(React.createElement(DepartmentChangeRequests,{rows:[row],error:'',refresh:async()=>{refreshes++},login:'htndiem',originScope:'KHSX',focusId:row.id,onFocusConsumed:()=>{}})));
 assert.ok(host.querySelector('[role="dialog"]'));assert.equal(host.querySelector('textarea'),null);
 const labels=[...host.querySelectorAll('[role="dialog"] button')].map(b=>b.textContent.trim());assert.ok(!labels.includes('Lưu'));assert.ok(!labels.includes('Gửi'));assert.match(labels.join(' '),/Đóng|Quay lại/);assert.match(host.textContent,/Reply one/);assert.match(host.textContent,/Reply two/);
 assert.equal(reads[0].action,'read');assert.equal(reads[0].messageCount,3);assert.ok(refreshes>0);
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=originalFetch;}
});

test('personnel history is separate; notification opens recall and Agree sends only the approval command',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const calls=[];
 const recall={id:crypto.randomUUID(),kind:'staff-recall',code:'THNS-TEST',owner:'dhtin',department:'QLSX',createdAt:'2026-10-22T06:00:00Z',revision:1,canApproveRecall:true,pendingDepartments:['QLSX Line A/B'],recipients:['QLSX Line A/B'],recall:{status:'pending',sourceGroup:'C',targetGroup:'AB',window:{effectiveAt:'2026-10-28T01:00:00Z',endsAt:'2026-10-28T10:00:00Z'},employees:[]},messages:[{text:'Thu hồi nhân sự ngày 28/10',at:'2026-10-22T06:00:00Z',login:'dhtin',department:'QLSX Line C'}],drafts:{}};
 const ordinary={id:crypto.randomUUID(),code:'PTD-NORMAL',owner:'cnphuong',department:'QLSX',createdAt:'2026-10-22T06:00:00Z',revision:1,pendingDepartments:['KHSX'],recipients:['KHSX'],messages:[{text:'Phiếu thông thường',at:'2026-10-22T06:00:00Z',login:'cnphuong',department:'QLSX'}],drafts:{}};
 const props={rows:[recall,ordinary],error:'',refresh:async()=>{},login:'cnphuong',originScope:'QLSX',focusId:null,onFocusConsumed:()=>{}};
 globalThis.fetch=async(input,init={})=>{if(String(input)==='/api/change-requests')calls.push(JSON.parse(init.body));return Response.json({ok:true})};
 const button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
 try{
 await act(async()=>root.render(React.createElement(DepartmentChangeRequests,props)));
 assert.match(host.querySelector('tbody').textContent,/PTD-NORMAL/);assert.doesNotMatch(host.querySelector('tbody').textContent,/THNS-TEST/);
 await act(async()=>button('Lịch sử Nhân sự').click());assert.match(host.querySelector('tbody').textContent,/THNS-TEST/);assert.doesNotMatch(host.querySelector('tbody').textContent,/PTD-NORMAL/);assert.equal(button('Thêm mới'),undefined);
 await act(async()=>root.render(React.createElement(DepartmentChangeRequests,{...props,focusId:recall.id})));
 assert.ok(host.querySelector('[role=dialog]'));assert.equal(host.querySelector('textarea'),null);assert.ok(button('Đồng ý'));assert.equal(button('Gửi'),undefined);
 await act(async()=>button('Đồng ý').click());assert.deepEqual(calls,[{action:'approve-recall',id:recall.id,revision:1}]);
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=originalFetch;}
});
