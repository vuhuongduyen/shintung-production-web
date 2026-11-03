import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const employee=(overrides={})=>({id:'TEST-HR-1',name:'Synthetic employee',line:'A',active:true,version:3,...overrides});
const body=(employees=[employee()])=>({employees,permissions:{edit:true,cancel:true}});
function descendants(node){if(!node||typeof node!=='object')return [];const children=[node.props?.children,node.props?.items].flat(Infinity);return [node,...children.flatMap(descendants)];}

// Run the real render/effect/event callbacks against deferred synthetic HTTP.
// No database, credentials, timers, browser connection or production endpoint.
function fixture() {
 const states=[],refs=[],effects=[],pending=[];let cursor=0,refCursor=0,effectCursor=0,revision=0;const requests=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=refCursor++;return refs[i]??={current:initial};},useEffect(fn,deps){const i=effectCursor++,old=effects[i];if(!old||!same(old.deps,deps)){effects[i]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();effects[i].cleanup=fn();});}},useSyncExternalStore(){return 'vi';}};
 const fetch=(url,init={})=>new Promise((resolve,reject)=>{requests.push({url,method:init.method||'GET',body:init.body,resolve,reject,signal:init.signal});});
 const simple=tag=>({children,...props})=>React.createElement(tag,props,children);
 const toolbar={action:(props,label,allowed=true)=>allowed?React.createElement('button',{...props,key:label},label):null,field:(label,children)=>React.createElement('label',{key:label},label,children),input:props=>React.createElement('input',props),select:(props,children)=>React.createElement('select',props,children)};
 const source=fs.readFileSync(new URL('../components/employee-directory.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(js,{exports,AbortController,console,require(name){
  if(name.endsWith('action-feedback'))return name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture;
  if(name==='react')return hooks;if(name==='react/jsx-runtime')return jsxRuntime;
  if(name.includes('data-sync'))return {apiFetch:fetch,useDataRefresh:()=>revision};
  if(name.includes('PageTitle'))return {PageTitle:({children})=>React.createElement('h1',null,children)};
  if(name.includes('DataTable'))return {DataTable:simple('div')};if(name.includes('DataCell'))return {DataCell:simple('td')};
  if(name.includes('StandardToolbar'))return {toolbar,StandardToolbar:({items})=>React.createElement('nav',null,items)};
  if(name.includes('translations'))return {subscribeToolbarLocale:()=>{},toolbarLocale:()=> 'vi'};
  if(name.includes('basic-master-cancel'))return {useMasterCancellation:()=>({dialog:null})};
  if(name.includes('basic-master'))return {isMasterCancelled:()=>false,newestMasterFirst:()=>0};if(name.endsWith('.css'))return {};throw Error(name);
 }});
 const render=()=>{cursor=0;refCursor=0;effectCursor=0;return exports.default();};
 const commit=()=>{const tree=render();while(pending.length)pending.shift()();return tree;};
 const html=()=>renderToStaticMarkup(render());
 const settle=async(data,status=200,request=requests.at(-1))=>{request.resolve(new Response(JSON.stringify(data),{status}));await tick();commit();};
 const find=predicate=>descendants(render()).find(predicate);
 const button=label=>find(node=>node.type==='button'&&node.props.children===label);
 const row=()=>find(node=>node.type==='tr'&&node.props.onClick);
 return {html,render,commit,find,button,row,requests,start:commit,settle,poll(){revision++;commit();},retry(){const action=button('Thử lại')||button('Tải lại');action.props.onClick();},unmount(){for(const effect of effects)effect.cleanup?.();},edit(){row().props.onClick();commit();button('Sửa').props.onClick();commit();},changeDraftName(name){const input=find(node=>node.type==='input'&&node.props.value==='Synthetic employee');assert.ok(input);input.props.onChange({target:{value:name}});commit();}};
}

test('initial load is explicit; automatic refresh keeps identical markup, row keys and controls',async()=>{
 const f=fixture();f.start();assert.match(f.html(),/Đang tải danh sách nhân viên/);assert.doesNotMatch(f.html(),/Chưa có nhân viên phù hợp/);
 await f.settle(body());const before=f.html(),key=f.row().key;assert.doesNotMatch(before,/Đang tải danh sách/);assert.equal(f.button('Thêm mới').props.disabled,false);
 f.poll();assert.equal(f.html(),before,'no block inserted above the populated table');assert.equal(f.row().key,key);assert.equal(f.button('Thêm mới').props.disabled,false);
 await f.settle(body());assert.equal(f.html(),before);assert.equal(f.row().key,key);
 f.retry();assert.equal(f.html(),before);await f.settle(body([]));assert.doesNotMatch(f.html(),/TEST-HR-1/);assert.match(f.html(),/Chưa có nhân viên phù hợp/);
});
test('verified empty remains mounted through pending refresh and transient error',async()=>{
 const f=fixture();f.start();await f.settle(body([]));const before=f.html();f.poll();assert.equal(f.html(),before);await f.settle({error:'TEST unavailable'},503);
 assert.match(f.html(),/Chưa có nhân viên phù hợp/);assert.match(f.html(),/TEST unavailable/);assert.doesNotMatch(f.html(),/Đang tải danh sách/);
});
test('initial failure is not empty and retry keeps real initial loading',async()=>{
 const f=fixture();f.start();await f.settle({error:'TEST failure'},500);assert.match(f.html(),/TEST failure/);assert.match(f.html(),/Thử lại/);assert.doesNotMatch(f.html(),/Chưa có nhân viên phù hợp/);
 f.retry();assert.match(f.html(),/Đang tải danh sách/);await f.settle(body([]));assert.doesNotMatch(f.html(),/TEST failure/);assert.match(f.html(),/Chưa có nhân viên phù hợp/);
});
test('periodic refresh preserves selection and unsaved draft/version through changed rows and failure',async()=>{
 const f=fixture();f.start();await f.settle(body());f.edit();f.changeDraftName('UNSAVED DRAFT');const before=f.html();
 f.poll();assert.equal(f.html(),before);await f.settle(body([employee({name:'Changed remotely',version:9})]));
 assert.match(f.html(),/employee-selected/);assert.match(f.html(),/value="UNSAVED DRAFT"/);assert.match(f.html(),/Changed remotely/);assert.equal(f.button('Lưu').props.disabled,false);
 f.poll();await f.settle({error:'TEST offline'},503);assert.match(f.html(),/value="UNSAVED DRAFT"/);assert.match(f.html(),/employee-selected/);assert.match(f.html(),/đang hiển thị danh sách đã tải/);
 const save=f.button('Lưu');save.props.onClick();const request=f.requests.at(-1);assert.equal(request.method,'POST');assert.equal(JSON.parse(request.body).version,3);assert.equal(JSON.parse(request.body).name,'UNSAVED DRAFT');await f.settle({error:'TEST conflict'},409,request);
});
test('background completion never clears mutation busy or a mutation error',async()=>{
 const f=fixture();f.start();await f.settle(body());f.edit();f.button('Lưu').props.onClick();const write=f.requests.at(-1);assert.equal(write.method,'POST');assert.equal(f.button('Lưu').props.disabled,true);
 f.poll();const read=f.requests.at(-1);assert.equal(read.method,'GET');await f.settle(body(),200,read);assert.equal(f.button('Lưu').props.disabled,true,'pending save owns busy state');
 await f.settle({error:'TEST stale draft'},409,write);assert.equal(f.button('Lưu').props.disabled,false);assert.match(f.html(),/TEST stale draft/);
 f.poll();assert.match(f.html(),/TEST stale draft/);await f.settle(body());assert.match(f.html(),/TEST stale draft/,'read success cannot erase a save conflict');
});
test('401/403 clear loaded employees, selection and draft; late superseded responses stay ignored',async()=>{
 for(const status of [401,403]){
  const f=fixture();f.start();await f.settle(body());f.edit();f.changeDraftName('PRIVATE DRAFT');f.poll();const old=f.requests.at(-1);f.retry();assert.equal(old.signal.aborted,true);
  await f.settle({error:'denied'},status);await f.settle(body([employee({id:'STALE'})]),200,old);
  assert.match(f.html(),status===403?/không có quyền/:/hết hạn/);assert.doesNotMatch(f.html(),/TEST-HR-1|STALE|PRIVATE DRAFT|Chưa có nhân viên phù hợp/);
 }
});
test('unmount aborts pending refresh and prevents a late result from changing the retained UI',async()=>{
 const f=fixture();f.start();await f.settle(body());f.poll();const request=f.requests.at(-1),before=f.html();f.unmount();assert.equal(request.signal.aborted,true);await f.settle(body([]),200,request);assert.equal(f.html(),before);
});
