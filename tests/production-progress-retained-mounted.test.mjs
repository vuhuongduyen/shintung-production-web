import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),vite=await createTestServer(),originalFetch=globalThis.fetch;
const {default:Production}=await vite.ssrLoadModule('/components/production-management.tsx'),{clearProductionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts'),{productionDisplayStore:store}=await vite.ssrLoadModule('/lib/production-display-store.mjs');
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const orders=Array.from({length:45},(_,i)=>({id:'SYNTHETIC-'+i,lsxCode:'TEST-'+String(i).padStart(3,'0'),name:'Dây tắm PVC thử nghiệm',sku:'TEST-PVC',line:'A',lsxQty:1000,planEnd:'2026-12-01',syncStatus:'ĐÃ ĐỒNG BỘ'}));
const data={orders,progressOrders:orders,reports:[],events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:true,confirm:true,line:'A'},dailyOutputPolicy:{active:true}};
const flush=()=>act(async()=>{await new Promise(r=>setTimeout(r,5));});
async function until(check){for(let i=0;i<100;i++){await flush();if(check())return;}assert.ok(check());}
async function mount(user='TEST',line='A'){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Production,{mode:'progress',preferenceUser:user,sessionLine:line,confirmReportAllowed:true})));return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const button=(host,name)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);
async function choose(host,value){await act(async()=>{const select=host.querySelector('select[aria-label="Hiển thị"]')||[...host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='hidden'));select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});}

test('progress restores page and display before a delayed refresh, preserves it on failure, and refreshes quantities without resetting page',async()=>{
 store.clear();clearProductionSnapshot();await store.activate('TEST:permission-v1:A');globalThis.fetch=async()=>Response.json(data);let screen=await mount();
 try{await until(()=>screen.host.textContent.includes('TEST-000'));await act(async()=>button(screen.host,'Trang 2').click());assert.match(screen.host.textContent,/TEST-020/);await screen.close();
  clearProductionSnapshot();let release;const pending=new Promise(r=>{release=r;});globalThis.fetch=async()=>pending;screen=await mount();
  assert.match(screen.host.textContent,/TEST-020/);assert.doesNotMatch(screen.host.textContent,/TEST-000/);assert.equal(store.get('view:production-progress:table:TEST:A').page,2);
  release(new Response('Temporary failure',{status:503}));await until(()=>screen.host.querySelector('[role="alert"]'));assert.match(screen.host.textContent,/TEST-020/);
  globalThis.fetch=async()=>Response.json({...data,orders:orders.map(o=>({...o,name:'Dây tắm PVC cập nhật'})),progressOrders:orders.map(o=>({...o,name:'Dây tắm PVC cập nhật'}))});await act(async()=>button(screen.host,'Thử lại').click());await until(()=>screen.host.textContent.includes('Dây tắm PVC cập nhật'));assert.match(screen.host.textContent,/TEST-020/);assert.equal(screen.host.querySelector('.progress-expanded'),null);
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('progress restores all-history scope directly and does not mix active data; changed permission/Line never restores the old table',async()=>{
 store.clear();clearProductionSnapshot();await store.activate('TEST:permission-v1:A');const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return Response.json(data);};let screen=await mount();
 try{await until(()=>screen.host.textContent.includes('TEST-000'));await choose(screen.host,'all');await until(()=>calls.some(u=>u.includes('scope=all')));await screen.close();clearProductionSnapshot();calls.length=0;
  let release;const pending=new Promise(r=>{release=r;});globalThis.fetch=async url=>{calls.push(String(url));return pending;};screen=await mount();assert.match(screen.host.textContent,/TEST-000/);assert.ok(calls.every(u=>!u.includes('view=progress')||u.includes('scope=all')));
  release(Response.json(data));await flush();await screen.close();clearProductionSnapshot();await store.activate('TEST:permission-v2:B');
  let releaseB;const gate=new Promise(r=>{releaseB=r;});globalThis.fetch=async()=>gate;screen=await mount('TEST','B');assert.doesNotMatch(screen.host.textContent,/TEST-000/);assert.match(screen.host.textContent,/Đang tải dữ liệu sản xuất/);
  releaseB(Response.json({...data,orders:[],progressOrders:[],rights:{manager:false,line:'B'}}));await flush();
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('401/403 discards retained progress and navigation instead of leaving a privileged snapshot visible',async()=>{
 for(const status of [401,403]){store.clear();clearProductionSnapshot();await store.activate('TEST:permission-v1:A');globalThis.fetch=async()=>Response.json(data);let screen=await mount();
  try{await until(()=>screen.host.textContent.includes('TEST-000'));await screen.close();clearProductionSnapshot();globalThis.fetch=async()=>Response.json({error:'Access changed'},{status});screen=await mount();await until(()=>screen.host.querySelector('[role="alert"]'));assert.doesNotMatch(screen.host.textContent,/TEST-000/);assert.equal(store.active(),false);}finally{await screen.close();store.clear();clearProductionSnapshot();}
 }
});

test('applied lookup and lookup controls survive remount without persisting selected reports or dialogs',async()=>{
 store.clear();clearProductionSnapshot();await store.activate('TEST:permission-v1:A');globalThis.fetch=async()=>Response.json(data);let screen=await mount();
 try{
  await until(()=>screen.host.textContent.includes('TEST-000'));
  await act(async()=>button(screen.host,'Tra cứu').click());
  await act(async()=>{const select=[...screen.host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='lsxCode'));select.value='lsxCode';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>{const input=screen.host.querySelector('input[type="text"]')||screen.host.querySelector('input:not([type])');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'TEST-020');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>button(screen.host,'Tìm kiếm').click());assert.match(screen.host.textContent,/TEST-020/);assert.doesNotMatch(screen.host.textContent,/TEST-000/);
  const codeCell=[...screen.host.querySelectorAll('.progress-order-table td')].find(cell=>cell.textContent==='TEST-020');assert.ok(codeCell);assert.equal(codeCell.querySelector('button,a'),null);await act(async()=>codeCell.click());assert.equal(screen.host.querySelector('.progress-expanded'),null);
  await screen.close();screen=await mount();assert.match(screen.host.textContent,/TEST-020/);assert.doesNotMatch(screen.host.textContent,/TEST-000/);assert.equal(screen.host.querySelector('.progress-expanded'),null);assert.ok(button(screen.host,'Tìm kiếm'));
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});

test('reopening a still-fresh progress cache starts background revalidation immediately instead of waiting for TTL or polling',async()=>{
 store.clear();clearProductionSnapshot();await store.activate('TEST:permission-v1:A');let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(data);};let screen=await mount();
 try{
  await until(()=>screen.host.textContent.includes('TEST-000'));assert.equal(calls,1);await screen.close();
  let release;const gate=new Promise(r=>{release=r;});globalThis.fetch=async()=>{calls++;return gate;};screen=await mount();
  assert.match(screen.host.textContent,/TEST-000/);assert.equal(calls,2,'must refresh immediately despite the 30-second cache TTL');
  assert.equal(button(screen.host,'Cập nhật dữ liệu'),undefined,'approval toolbar uses automatic background refresh');assert.equal(calls,2);
  release(Response.json({...data,progressOrders:orders.map(o=>({...o,name:'Updated immediately'}))}));await until(()=>screen.host.textContent.includes('Updated immediately'));
 }finally{await screen.close();store.clear();clearProductionSnapshot();}
});
