import {trackBrowserChannels} from './helpers/browser-channels.mjs';const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';import {fileURLToPath} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const n of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','HTMLDialogElement','getComputedStyle'])globalThis[n]=dom.window[n];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createTestServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
const {default:Work}=await vite.ssrLoadModule('/components/production-paged-work.tsx'),originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const order=(id)=>({id,lsxCode:id,sku:'TEST-SKU',name:'Synthetic product',line:'A',lsxQty:1000,revision:'TEST-REVISION',week:'2026-11-02',serverSummary:{totals:{approved:200,pending:0,reported:200},badge:{label:'Đang SX',tone:'running'},runtime:{known:true,running:true}}});
const snapshot=(id,page=1)=>({supported:true,orders:[order(id)],page,pageSize:10,total:21,totals:{orders:21,quantity:21000,approved:4200,pending:0,reserved:0},dailyOutputPolicy:{active:true,effectiveFrom:'2026-11-01',intakeModel:'server-receipt-quantity-v1'},rights:{work:true,line:'A'}});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function flush(){await act(async()=>{await tick();await tick();});}
async function mount(fetcher,props={},reset=true){if(reset)clearClientReads();globalThis.fetch=fetcher;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Work,{sessionLine:'A',preferenceUser:'SYNTHETIC-LINE-A',fallback:React.createElement('div',null,'Legacy fallback'),...props})));await flush();return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const button=(host,text)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text),click=async n=>{assert.ok(n);await act(async()=>n.click());await flush();};
test('a new page session displays its verified-scope saved rows while the fresh response is pending, then replaces them silently',async()=>{
 const {productionDisplayStore}=await vite.ssrLoadModule('/lib/production-display-store.mjs');
 const {clearProductionPages}=await vite.ssrLoadModule('/lib/production-page-cache.ts');
 clearClientReads();await productionDisplayStore.activate('SYNTHETIC-VERIFIED-LINE-A-GRANTS');
 const url='/api/production-order-pages?page=1&sort=due&line=A',identity=JSON.stringify(['SYNTHETIC-LINE-A','A']);
 productionDisplayStore.put('page:'+JSON.stringify([identity,url]),snapshot('SAVED'));clearProductionPages();
 let release;const m=await mount(async()=>new Promise(r=>{release=()=>r(Response.json(snapshot('NEW')));}),{},false);
 try{
  assert.ok(m.host.querySelector('button[aria-label="Báo công · SAVED"]'));
  assert.equal(m.host.querySelector('button[aria-label="Báo công · SAVED"]').disabled,true);
  assert.doesNotMatch(m.host.textContent,/Đang kiểm tra dữ liệu/);
  await act(async()=>release());await flush();
  assert.ok(m.host.querySelector('button[aria-label="Báo công · NEW"]'));
  assert.equal(m.host.querySelector('button[aria-label="Báo công · NEW"]').disabled,false);
  assert.equal(m.host.querySelector('button[aria-label="Báo công · SAVED"]'),null);
 }finally{await m.close();productionDisplayStore.clear();clearProductionPages();}
});
test('expired page reopens with retained rows, then verifies before enabling writes',async()=>{
 const first=await mount(async()=>Response.json(snapshot('RETAINED')));await first.close();
 const now=Date.now,future=now()+31000;Date.now=()=>future;let release;
 const second=await mount(async()=>new Promise(r=>{release=()=>r(Response.json(snapshot('VERIFIED')));}),{},false);
 try{
  assert.ok(second.host.querySelector('[aria-label="Báo công · RETAINED"]'));
  assert.equal(second.host.querySelector('button[aria-label="Báo công · RETAINED"]').disabled,true);
  assert.equal(second.host.querySelector('button[aria-label="Trang 2"]').disabled,false);
  await act(async()=>release());await flush();
  assert.equal(second.host.querySelector('button[aria-label="Báo công · VERIFIED"]').disabled,false);
 }finally{await second.close();Date.now=now;clearClientReads();}
});
test('retained pages do not cross identities or a session reset',async()=>{
 const {readProductionPage,retainedProductionPage}=await vite.ssrLoadModule('/lib/production-page-cache.ts');
 clearClientReads();globalThis.fetch=async()=>Response.json(snapshot('PRIVATE-A'));
 await readProductionPage('/api/production-order-pages?page=1','USER-A');
 assert.equal(retainedProductionPage('/api/production-order-pages?page=1','USER-B'),null);
 assert.equal(retainedProductionPage('/api/production-order-pages?page=2','USER-A'),null);
 clearClientReads();assert.equal(retainedProductionPage('/api/production-order-pages?page=1','USER-A'),null);
});
test('expiry during background refresh does not lock a page already verified in this screen',async()=>{
 let refresh=false,release;const now=Date.now;
 const m=await mount(async()=>refresh?new Promise(r=>{release=()=>r(Response.json(snapshot('ACTIVE')));}):Response.json(snapshot('ACTIVE')));
 try{const future=now()+31000;Date.now=()=>future;refresh=true;await click(button(m.host,'Cập nhật dữ liệu'));
  assert.equal(m.host.querySelector('button[aria-label="Báo công · ACTIVE"]').disabled,false);
  assert.equal(m.host.querySelector('button[aria-label="Trang 2"]').disabled,false);
  await act(async()=>release());await flush();
 }finally{Date.now=now;await m.close();clearClientReads();}
});
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
test('background refresh of the same page does not lock reporting or prevent opening its draft',async()=>{
 let release,delayed=false;const m=await mount(async path=>{if(delayed)return new Promise(r=>{release=()=>r(Response.json(snapshot('REFRESHED')));});return Response.json(snapshot('FIRST'));});
 try{
  const report=()=>m.host.querySelector('button[aria-label="Báo công · FIRST"]');assert.equal(report().disabled,false);delayed=true;await click(button(m.host,'Cập nhật dữ liệu'));assert.equal(report().disabled,false,'a background refresh must not lock a valid loaded order');
  await click(report());const dialog=document.querySelector('[role="dialog"]');assert.ok(dialog);assert.equal(dialog.querySelector('input[type=number]').disabled,false);await click(dialog.querySelector('button[aria-label="Đóng báo công"]'));await act(async()=>release());await flush();
 }finally{await m.close();}
});
test('a requested new page cannot report against retained rows before that page has loaded',async()=>{
 let release;const m=await mount(async path=>new URL(String(path),'https://synthetic.test').searchParams.get('page')==='2'?new Promise(r=>{release=()=>r(Response.json(snapshot('SECOND',2)));}):Response.json(snapshot('FIRST')));
 try{await click(m.host.querySelector('button[aria-label="Trang 2"]'));assert.equal(m.host.querySelector('button[aria-label="Báo công · FIRST"]').disabled,true);await act(async()=>release());await flush();assert.equal(m.host.querySelector('button[aria-label="Báo công · SECOND"]').disabled,false);}finally{await m.close();}
});
test('a failed background read retains the loaded order and reporting rights; it cannot grant rights to a read-only user',async()=>{
 for(const work of [true,false]){let fail=false;const m=await mount(async()=>fail?Response.json({error:'Synthetic offline'},{status:503}):Response.json({...snapshot('FIRST'),rights:{work,line:'A'}}));
 try{fail=true;await click(button(m.host,'Cập nhật dữ liệu'));assert.match(m.host.textContent,/Synthetic offline/);assert.equal(m.host.querySelector('button[aria-label="Báo công · FIRST"]').disabled,!work);}finally{await m.close();}}
});

test('focus wakes join the pending initial read; a slow read cannot repeatedly restart or hide the loaded pager',async()=>{
 let release,calls=0,aborted=false;const m=await mount(async(_path,init)=>{calls++;init.signal.addEventListener('abort',()=>{aborted=true;});return new Promise(r=>{release=()=>r(Response.json(snapshot('JOINED')));});});
 try{
  await act(async()=>window.dispatchEvent(new window.Event('focus')));await flush();assert.equal(calls,1);assert.equal(aborted,false);
  await act(async()=>release());await flush();assert.ok(m.host.querySelector('button[aria-label="Trang 2"]'));assert.equal(m.host.querySelector('button[aria-label="Trang 2"]').disabled,false);
 }finally{await m.close();}
});
test('Admin, Line A/B and view-only roles all retain enabled pagination during background refresh and after a read error',async()=>{
 for(const props of [{sessionLine:undefined,preferenceUser:'ADMIN'},{sessionLine:'A'},{sessionLine:'B'},{sessionLine:undefined,preferenceUser:'VIEW-ONLY'}]){
  let refresh=false,release;const m=await mount(async()=>refresh?new Promise(r=>{release=()=>r(Response.json({error:'Synthetic offline'},{status:503}));}):Response.json({...snapshot('VISIBLE'),rights:{work:props.preferenceUser!=='VIEW-ONLY'}}),props);
  try{refresh=true;await click(button(m.host,'Cập nhật dữ liệu'));assert.equal(m.host.querySelector('button[aria-label="Trang 2"]').disabled,false);await act(async()=>release());await flush();assert.equal(m.host.querySelector('button[aria-label="Trang 2"]').disabled,false);assert.equal(m.host.querySelector('button[aria-label="Báo công · VISIBLE"]').disabled,props.preferenceUser==='VIEW-ONLY');}
  finally{await m.close();}
 }
});
test('next page prefetch makes navigation immediate',async()=>{
 const calls=[];const m=await mount(async path=>{calls.push(String(path));const page=Number(new URL(String(path),'https://synthetic.test').searchParams.get('page'));return Response.json(snapshot(page===2?'PREFETCHED':'FIRST',page));});
 try{await act(async()=>new Promise(r=>setTimeout(r,300)));await flush();assert.equal(calls.filter(p=>p.includes('page=2')).length,1);await click(m.host.querySelector('button[aria-label="Trang 2"]'));assert.ok(m.host.querySelector('[aria-label="Báo công · PREFETCHED"]'));assert.equal(calls.filter(p=>p.includes('page=2')).length,1);}
 finally{await m.close();}
});

test('memory pages survive reopening the same session, but a session or permission reset forces a new read',async()=>{
 const {readProductionPage,cachedProductionPage}=await vite.ssrLoadModule('/lib/production-page-cache.ts');clearClientReads();let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(snapshot('SESSION-'+calls));};
 const url='/api/production-order-pages?page=1&sort=due&line=A';await readProductionPage(url,'same');assert.equal(cachedProductionPage(url,'same').orders[0].id,'SESSION-1');await readProductionPage(url,'same');assert.equal(calls,1);
 clearClientReads();assert.equal(cachedProductionPage(url,'same'),null);await readProductionPage(url,'same');assert.equal(calls,2);
 clearClientReads('mutation');assert.equal(cachedProductionPage(url,'same'),null);await readProductionPage(url,'same');assert.equal(calls,3);
});

test('a timed-out page read releases loading and can be retried without a permanent pager lock',async()=>{
 const {readProductionPage}=await vite.ssrLoadModule('/lib/production-page-cache.ts');clearClientReads();const originalTimeout=globalThis.setTimeout;
 globalThis.setTimeout=(fn,ms,...args)=>originalTimeout(fn,ms===15000?5:ms,...args);
 globalThis.fetch=async(_path,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));
 try{await assert.rejects(readProductionPage('/api/production-order-pages?page=1','TIMEOUT'),/phản hồi quá lâu/);globalThis.fetch=async()=>Response.json(snapshot('RETRIED'));assert.equal((await readProductionPage('/api/production-order-pages?page=1','TIMEOUT')).orders[0].id,'RETRIED');}
 finally{globalThis.setTimeout=originalTimeout;clearClientReads();}
});

test('unchanged background results still renew the next-page prefetch after its TTL expires',async()=>{
 const calls=[],realNow=Date.now;const m=await mount(async path=>{calls.push(String(path));const page=Number(new URL(String(path),'https://synthetic.test').searchParams.get('page'));return Response.json(snapshot(page===2?'NEXT':'UNCHANGED',page));});
 try{await act(async()=>new Promise(r=>setTimeout(r,300)));await flush();assert.equal(calls.filter(p=>p.includes('page=2')).length,1);const future=realNow()+31000;Date.now=()=>future;await click(button(m.host,'Cập nhật dữ liệu'));await act(async()=>new Promise(r=>setTimeout(r,300)));await flush();assert.equal(calls.filter(p=>p.includes('page=2')).length,2);}
 finally{Date.now=realNow;await m.close();}
});
