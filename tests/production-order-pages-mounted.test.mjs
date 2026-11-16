import {trackBrowserChannels} from './helpers/browser-channels.mjs';const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';import {fileURLToPath} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const n of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','HTMLDialogElement','getComputedStyle'])globalThis[n]=dom.window[n];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createTestServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:Work}=await vite.ssrLoadModule('/components/production-paged-work.tsx'),originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const order=(id)=>({id,lsxCode:id,sku:'TEST-SKU',name:'Synthetic product',line:'A',lsxQty:1000,revision:'TEST-REVISION',week:'2026-11-02',serverSummary:{totals:{approved:200,pending:0,reported:200},badge:{label:'Đang SX',tone:'running'},runtime:{known:true,running:true}}});
const snapshot=(id,page=1)=>({supported:true,orders:[order(id)],page,pageSize:10,total:21,totals:{orders:21,quantity:21000,approved:4200,pending:0,reserved:0},dailyOutputPolicy:{active:true,effectiveFrom:'2026-11-01',intakeModel:'server-receipt-quantity-v1'},rights:{work:true,line:'A'}});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function flush(){await act(async()=>{await tick();await tick();});}
async function mount(fetcher){globalThis.fetch=fetcher;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Work,{sessionLine:'A',preferenceUser:'SYNTHETIC-LINE-A',fallback:React.createElement('div',null,'Legacy fallback')})));await flush();return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const button=(host,text)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text),click=async n=>{assert.ok(n);await act(async()=>n.click());await flush();};
async function input(n,value){assert.ok(n);await act(async()=>{const proto=n.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(n,value);n.dispatchEvent(new window.Event('input',{bubbles:true}));n.dispatchEvent(new window.Event('change',{bubbles:true}));});await flush();}
test('mounted work screen requests server pages, applies only submitted filters and keeps totals from all matching orders',async()=>{
 const calls=[];const m=await mount(async path=>{calls.push(String(path));const p=new URL(String(path),'https://synthetic.test').searchParams;return Response.json(snapshot(p.get('query')?'FOUND':p.get('page')==='2'?'SECOND':'FIRST',Number(p.get('page')||1)));});
 try{
  assert.match(m.host.textContent,/4.200/);assert.ok(m.host.querySelector('[aria-label="Báo công · FIRST"]'));assert.equal(calls.some(p=>p.startsWith('/api/production-workflow')),false);
  await click(m.host.querySelector('button[aria-label="Trang 2"]'));assert.ok(m.host.querySelector('[aria-label="Báo công · SECOND"]'));assert.ok(calls.at(-1).includes('page=2'));
  await click(button(m.host,'Tra cứu'));const select=[...m.host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='LSX'));await input(select,'LSX');const count=calls.length;await input(m.host.querySelector('input[placeholder="Nhập LSX"]'),'DEMO');assert.equal(calls.length,count,'draft edits cannot change the applied server query');
  await click(button(m.host,'Tìm kiếm'));assert.ok(calls.at(-1).includes('page=1'));assert.ok(calls.at(-1).includes('query=DEMO'));assert.ok(m.host.querySelector('[aria-label="Báo công · FOUND"]'));
 }finally{await m.close();}
});
test('late page response cannot replace a newer filter and authorization failures clear old rows',async()=>{
 let release,deny=false;const m=await mount(async path=>{const q=new URL(String(path),'https://synthetic.test').searchParams;if(deny)return Response.json({error:'Session revoked'},{status:403});if(q.get('page')==='2')return new Promise(r=>{release=()=>r(Response.json(snapshot('STALE',2)));});return Response.json(snapshot(q.get('query')?'FRESH':'FIRST'));});
 try{
  await click(m.host.querySelector('button[aria-label="Trang 2"]'));
  await click(button(m.host,'Tra cứu'));await input([...m.host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='LSX')),'LSX');await input(m.host.querySelector('input[placeholder="Nhập LSX"]'),'FRESH');await click(button(m.host,'Tìm kiếm'));
  await act(async()=>release());await flush();assert.ok(m.host.querySelector('[aria-label="Báo công · FRESH"]'));assert.equal(m.host.querySelector('[aria-label="Báo công · STALE"]'),null);
  deny=true;await click(button(m.host,'Cập nhật dữ liệu'));assert.match(m.host.textContent,/Session revoked/);assert.equal(m.host.querySelector('[aria-label="Báo công · FRESH"]'),null);
 }finally{await m.close();}
});
test('opening a detail reads only that order and changing its report page never loads a full workflow',async()=>{
 const calls=[];const m=await mount(async path=>{calls.push(String(path));const q=new URL(String(path),'https://synthetic.test').searchParams;if(q.has('orderId'))return Response.json({supported:true,orders:[order(q.get('orderId'))],totals:{approved:200,pending:0},kind:q.get('kind'),page:Number(q.get('page')),pageSize:20,total:21,reports:[{id:'REPORT-'+q.get('page'),kind:'completion',reportingModel:'daily-finished-v1',quantityOnly:true,productionDate:'2026-11-02',reportedQuantity:200,approvedQuantity:200,reviewStatus:'Đã xác nhận',reportedBy:'SYNTHETIC',rateBasis:null,rateStatus:'missing'}],events:[]});return Response.json(snapshot('FIRST'));});
 try{
  await click(button(m.host,'FIRST'));const dialog=document.querySelector('[role="dialog"]');assert.ok(dialog);assert.ok(calls.at(-1).includes('orderId=FIRST'));assert.match(dialog.textContent,/Thiếu căn cứ định mức/);
  await click(dialog.querySelector('button[aria-label="Trang 2"]'));assert.ok(calls.at(-1).includes('orderId=FIRST'));assert.ok(calls.at(-1).includes('page=2'));assert.equal(calls.some(p=>p.startsWith('/api/production-workflow')),false);
 }finally{await m.close();}
});
