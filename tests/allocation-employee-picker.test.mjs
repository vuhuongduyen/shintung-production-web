import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createTestServer as createServer} from './helpers/vite-test-server.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','KeyboardEvent','CustomEvent','Node','localStorage'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {default:Queue}=await vite.ssrLoadModule('/components/production-allocation-queue.tsx');
after(async()=>{await vite.close();dom.window.close();});
const candidates=[{id:'A01',name:'Nguyễn An',line:'A'},{id:'A02',name:'Trần Bình',line:'A'},{id:'B01',name:'Trần Quốc Việt',line:'B'},{id:'C01',name:'Hidden C',line:'C'}];
const view={revision:0,group:'AB',sourceLines:['A','B'],offers:[],pendingPeople:0};
const button=(host,text)=>[...host.querySelectorAll('button')].find(n=>n.textContent.trim()===text);
const click=async n=>{assert.ok(n);await act(async()=>n.click());};
const change=async(n,value)=>act(async()=>{Object.getOwnPropertyDescriptor(n instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,value);n.dispatchEvent(new Event(n instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});
test('queue employee picker opens, searches, selects/deselects and collapses without transferring; changing line resets selection',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),commands=[];
 try{
  await act(async()=>root.render(React.createElement(Queue,{view,candidates,busy:false,onCommand:async c=>{commands.push(c);return true;},now:'2026-10-17T01:00:00Z'})));
  await click(button(host,'Chuyển nhân sự'));
  const transferReason=host.querySelector('[aria-label="Lý do chuyển nhân sự"]');if(transferReason)await change(transferReason,'Đổi kế hoạch');
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,0);
  await click(host.querySelector('[aria-label="Chọn nhân viên"]'));
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,2);
  assert.doesNotMatch(host.querySelector('#allocation-send').textContent,/Hidden C|Trần Quốc Việt/);
  await change(host.querySelector('[aria-label="Tìm nhân viên theo tên hoặc mã"]'),'tran binh');
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,1);
  const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  await act(async()=>host.querySelector('[type=search]').dispatchEvent(enter));assert.equal(enter.defaultPrevented,true);assert.equal(commands.length,0);
  await change(host.querySelector('[aria-label="Tìm nhân viên theo tên hoặc mã"]'),'A02');
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,1);
  await click(host.querySelector('#allocation-send input[type=checkbox]'));
  assert.equal(host.querySelector('#allocation-send input[type=checkbox]').checked,true);
  await click(host.querySelector('#allocation-send input[type=checkbox]'));
  assert.equal(host.querySelector('#allocation-send input[type=checkbox]').checked,false);
  await click(host.querySelector('#allocation-send input[type=checkbox]'));
  await click(button(host,'Xong'));
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,0);
  assert.match(host.querySelector('[aria-label="Chọn nhân viên"]').textContent,/1/);
  await change(host.querySelector('[aria-label="Line nguồn"]'),'B');
  await click(host.querySelector('[aria-label="Chọn nhân viên"]'));
  assert.equal(host.querySelectorAll('#allocation-send input[type=checkbox]').length,1);
  assert.equal(host.querySelector('#allocation-send input[type=checkbox]').checked,false);
  assert.match(host.querySelector('#allocation-send').textContent,/Trần Quốc Việt/);
  assert.doesNotMatch(host.querySelector('#allocation-send').textContent,/Nguyễn An|Trần Bình|Hidden C/);
  assert.equal(commands.length,0);
  await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(commands.length,0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

test('multiselect preserves IDs; candidates lost on refresh cannot be submitted',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),commands=[];
 const render=async people=>act(async()=>root.render(React.createElement(Queue,{view,candidates:people,busy:false,onCommand:async c=>{commands.push(c);return true;},now:'2026-10-17T01:00:00Z'})));
 try{
  await render(candidates);await click(button(host,'Chuyển nhân sự'));await click(host.querySelector('[aria-label="Chọn nhân viên"]'));
  for(const checkbox of host.querySelectorAll('#allocation-send input[type=checkbox]'))await click(checkbox);
  await click(button(host,'Xong'));assert.match(host.querySelector('[aria-label="Chọn nhân viên"]').textContent,/2/);
  await change(host.querySelector('[aria-label="Đề nghị đến ngày giờ · ngày"]'),'2026-10-18');
  await change(host.querySelector('[aria-label="Đề nghị đến ngày giờ · giờ"]'),'17:00');
  await render(candidates.filter(p=>p.line!=='A'));
  await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(commands.length,0);
 }finally{await act(async()=>root.unmount());host.remove();}
});
