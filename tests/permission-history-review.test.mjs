import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const key of ['window','document','HTMLElement','Node','localStorage'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Review}=await vite.ssrLoadModule('/components/permission-history-review.tsx');
const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
after(async()=>{await vite.close();dom.window.close();});
test('permission history remains read-only, preserves complete long grants and distinguishes absent snapshots',async()=>{
 clearClientReads('session');
 const long=Array.from({length:500},(_,i)=>`Menu ${i} / Xem`).join(' · '),requests=[];
 const scope={enabled:true,managers:[{userId:'dhtin',group:'C'},{userId:'cnphuong',group:'AB'}]};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{requests.push({url:String(url),method:init?.method||'GET'});assert.equal(init?.method||'GET','GET');return Response.json(String(url).includes('production-allocation-scope')?{configuration:scope}:{records:[{key:'u',payload:{login:'u',permissions:long,permissionMode:'CUSTOM',active:true},revision:'r'}]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>{root.render(React.createElement(Review,{entries:[{action:'USER_PERMISSION_SETUP',actor:'vthduyen',at:'2026-10-16T09:27:42.507Z',changes:[{entity:'permissions',key:'u',before:{login:'u',permissions:long,active:true,unrelatedField:'must-not-render'},after:{login:'u',permissions:'',permissionMode:'DEPARTMENT'}},{entity:'permissions',key:'created',before:null,after:{login:'created'}},{entity:'permissions',key:'incomplete',after:{login:'incomplete'}}]}]}));await new Promise(resolve=>setTimeout(resolve,30));});
  const changed=host.querySelector('[data-permission-history-entity="permissions"][data-record-key="u"]');
  assert.equal(changed.querySelector('[data-permission-snapshot="before"] [data-field="permissions"] dd').textContent,long);
  assert.doesNotMatch(host.textContent,/must-not-render/);
  assert.equal(host.querySelector('[data-record-key="created"] [data-permission-snapshot="before"]').dataset.present,'true');
  assert.equal(host.querySelector('[data-record-key="created"] [data-permission-snapshot="before"]').dataset.exists,'false');
  assert.equal(host.querySelector('[data-record-key="incomplete"] [data-permission-snapshot="before"]').dataset.present,'false');
  assert.equal(host.querySelector('[data-manager-user="dhtin"]').dataset.managerGroup,'C');
  assert.equal(host.querySelector('[data-manager-user="cnphuong"]').dataset.managerGroup,'AB');
  assert.equal(requests.length,5);assert.equal(host.querySelectorAll('input,form').length,0);assert.ok(requests.every(r=>r.method==='GET'));
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=original;}
});
for(const concurrent of [false,true])test(`recovery ${concurrent?'stops before any write when data changed':'uses guarded existing save and verifies exact personal rights and retained scope'}`,async()=>{
 clearClientReads('session');
 const before={login:'u',permissionMode:'CUSTOM',permissions:'Legacy / Xem · Leadtime / Sửa',active:true};
 const initial={...before,permissionMode:'DEPARTMENT',permissions:'',_deleted:false};
 let stored=structuredClone(initial),permissionReads=0;
 const event={action:'USER_PERMISSION_SETUP',actor:'vthduyen',at:'2026-10-16T09:27:42.507Z',changes:[{entity:'permissions',key:'u',before,after:initial}]};
 const scope={enabled:true,managers:[{userId:'dhtin',group:'C'},{userId:'cnphuong',group:'AB'}]},writes=[];
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  const path=String(url);
  if(init?.method==='POST'){
   const body=JSON.parse(init.body);writes.push(body);assert.equal(body.entity,'permissions');assert.equal(body.key,'u');assert.equal(body.expectedRevision,'revision-before');
   stored={...body.payload};return Response.json({ok:true,revision:'revision-after'});
  }
  if(path.includes('production-allocation-scope'))return Response.json({configuration:scope});
  if(path.includes('/api/admin-audit'))return Response.json({records:[{payload:event}]});
  const entity=new URL(path,'https://synthetic.test').searchParams.get('entity');
  if(entity==='users')return Response.json({records:[{key:'u',payload:{login:'u',active:true,role:'USER'},revision:'user'}]});
  if(entity==='permissions'){
   permissionReads++;const value=concurrent&&permissionReads>1?{...stored,permissions:'Approved later / Xem'}:stored;
   return Response.json({records:[{key:'u',payload:value,revision:writes.length?'revision-after':'revision-before'}]});
  }
  return Response.json({records:[]});
 };
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>{root.render(React.createElement(Review,{entries:[event]}));await new Promise(r=>setTimeout(r,20));});
  const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
  await act(async()=>button('Lập đối chiếu khôi phục quyền riêng').click());
  assert.match(host.textContent,/u: 2 quyền gốc/);
  await act(async()=>{button('Xác nhận khôi phục đúng quyền riêng đã đối chiếu').click();await new Promise(r=>setTimeout(r,30));});
  assert.equal(writes.length,concurrent?0:1);
  if(concurrent)assert.match(host.querySelector('[role=alert]').textContent,/vừa thay đổi/);
  else{assert.equal(stored.permissions,before.permissions);assert.equal(stored.permissionMode,'CUSTOM');assert.equal(stored._deleted,undefined);assert.match(host.textContent,/đã khôi phục và đọc lại 2 quyền gốc/);assert.match(host.textContent,/giữ nguyên phạm vi dhtin\/C, cnphuong\/A\+B/);}
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=original;clearClientReads('session');}
});
