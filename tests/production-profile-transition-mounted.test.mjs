// Legacy/full-profile regression: the synthetic server explicitly has no active quantity pager.
// Active paged reads are tested in production-order-pages-mounted and production-daily-ack-state.
import {trackBrowserChannels} from './helpers/browser-channels.mjs';const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer as createServer} from './helpers/vite-test-server.mjs';import {fileURLToPath} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});for(const key of ['window','document','Element','HTMLElement','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','HTMLDialogElement','getComputedStyle'])globalThis[key]=dom.window[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),originalFetch=globalThis.fetch;
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}}),{default:Production}=await vite.ssrLoadModule('/components/production-management.tsx'),{clearProductionSnapshot}=await vite.ssrLoadModule('/lib/production-workflow-cache.ts'),{clearClientReads}=await vite.ssrLoadModule('/lib/data-sync.ts');
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
const days=Array.from({length:30},(_,i)=>({date:`2026-11-${String(i+1).padStart(2,'0')}`,working:i===2,ot:false})),orders=['A','B'].map(line=>({id:'SYNTHETIC-'+line,sku:'SKU-'+line,line,lsxCode:'LSX-'+line,lsxQty:1000,processes:['PACKING'],syncStatus:'ĐÃ ĐỒNG BỘ',status:'MỞ'})),reports=orders.map(o=>({id:'REPORT-'+o.line,kind:'completion',transitId:o.id,line:o.line,productionDate:'2026-11-03',completedAt:'2026-11-03T10:00:00+07:00',reportedQuantity:200,approvedQuantity:200,reviewStatus:'Đã xác nhận',hours:{hc:2,ot:0,total:2}}));
const work={orders,reports,events:[],employees:[],actualSchedules:[],approvedSchedules:[],rights:{manager:true,work:true,stageLive:true,line:null},dailyOutputPolicy:{active:true,effectiveFrom:'2026-11-04'}},full={...work,reports:reports.map(r=>({...r,legacyEarnedBasis:{kind:'observed-legacy-earned-v1',status:'resolved',line:r.line,productionDate:r.productionDate,unit:.1,earned:20}})),employees:orders.map(o=>({id:'NV-'+o.line,name:'Synthetic '+o.line,line:o.line,startDate:'2026-01-01',active:true})),approvedSchedules:orders.map(o=>({key:'2026-11-02:'+o.line,line:o.line,days,roster:[{date:'2026-11-03',hc:['NV-'+o.line],ot:[]}]}))};
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
async function until(check){for(let i=0;i<100;i++){await flush();if(check())return;}assert.ok(check(),'condition was not reached');}
test('same workspace switches from light work data to anchored workspace payroll without rendering current-only history',async t=>{
 clearProductionSnapshot();clearClientReads('session');window.sessionStorage.clear();window.sessionStorage.setItem('onspa-payroll-month','2026-11');let release;const gate=new Promise(resolve=>{release=resolve;}),calls=[];
 globalThis.fetch=async(path)=>{if(String(path).startsWith('/api/production-order-pages'))return Response.json({supported:false});const url=String(path);calls.push(url);if(url === '/api/production-workflow?view=work')return Response.json(work);if(url.includes('/api/production-workflow'))return gate;if(url.includes('/api/production-standards'))return Response.json({records:orders.map(o=>({key:o.sku,payload:{sku:o.sku,laborHour:9}}))});return Response.json({records:[]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),render=mode=>act(async()=>root.render(React.createElement(Production,{mode,operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
 try{await render('work');await until(()=>host.textContent.includes('LSX-A'));assert.equal(calls.filter(u=>u.endsWith('view=work')).length,1);await render('payroll');await flush();t.diagnostic(JSON.stringify({phase:'before-full',fullRequests:calls.filter(u=>u.includes('/api/production-workflow')&&!u.endsWith('view=work')).length,currentRateRequests:calls.filter(u=>u.includes('/api/production-standards')).length,payrollVisible:Boolean(host.querySelector('.production-payroll-screen'))}));assert.equal(calls.filter(u=>u.includes('/api/production-workflow')&&!u.endsWith('view=work')).length,1,'mode change must request the full profile');assert.equal(calls.filter(u=>u.includes('/api/production-standards')).length,0,'the light response must not trigger a current-rate fallback');assert.match(host.textContent,/Đang tải dữ liệu sản xuất/);assert.equal(host.querySelector('.production-payroll-screen'),null);release(Response.json(full));await until(()=>host.querySelector('.production-payroll-screen'));await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Giờ công theo LSX').click());assert.match(host.textContent,/0,1/);assert.equal(calls.filter(u=>u.includes('/api/production-standards')).length,0);assert.doesNotMatch(host.textContent,/1\.800/);
 }finally{release(Response.json(full));await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});
test('failed full upgrade cannot fall back to a light payroll; explicit retry reads the full profile',async()=>{
 clearProductionSnapshot();clearClientReads('session');window.sessionStorage.clear();window.sessionStorage.setItem('onspa-payroll-month','2026-11');let fullCalls=0,standardCalls=0;
 globalThis.fetch=async path=>{if(String(path).startsWith('/api/production-order-pages'))return Response.json({supported:false});const url=String(path);if(url.endsWith('view=work'))return Response.json(work);if(url.includes('/api/production-workflow'))return ++fullCalls===1?new Response('Synthetic overloaded',{status:503}):Response.json(full);if(url.includes('/api/production-standards'))standardCalls++;return Response.json({records:[]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),render=mode=>act(async()=>root.render(React.createElement(Production,{mode,operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
 try{await render('work');await until(()=>host.textContent.includes('LSX-A'));await render('payroll');await until(()=>host.querySelector('[role="alert"]'));assert.equal(host.querySelector('.production-payroll-screen'),null);assert.equal(standardCalls,0);assert.equal(fullCalls,1);await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Thử lại').click());await until(()=>host.querySelector('.production-payroll-screen'));assert.equal(fullCalls,2);assert.equal(standardCalls,0);}finally{await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});
test('late full response cannot overwrite the active work screen after another mode switch',async()=>{
 clearProductionSnapshot();clearClientReads('session');let release;const gate=new Promise(resolve=>{release=resolve;});let fullCalls=0;
 globalThis.fetch=async path=>{if(String(path).startsWith('/api/production-order-pages'))return Response.json({supported:false});const url=String(path);if(url.endsWith('view=work'))return Response.json(work);if(url.includes('/api/production-workflow')){fullCalls++;return gate;}return Response.json({records:[]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),render=mode=>act(async()=>root.render(React.createElement(Production,{mode,operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
 try{await render('work');await until(()=>host.textContent.includes('LSX-A'));await render('payroll');await until(()=>fullCalls===1);await render('work');await until(()=>host.textContent.includes('LSX-A'));release(Response.json({...full,orders:full.orders.map(o=>({...o,lsxCode:'LATE-FULL'}))}));await flush();await flush();assert.match(host.textContent,/LSX-A/);assert.doesNotMatch(host.textContent,/LATE-FULL/);assert.equal(host.querySelector('.production-payroll-screen'),null);}finally{release(Response.json(full));await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});
test('fresh workspace data is reused across work and payroll without downgrading its profile or another HTTP read',async()=>{
 clearProductionSnapshot();clearClientReads('session');window.sessionStorage.setItem('onspa-payroll-month','2026-11');let calls=0,standards=0;globalThis.fetch=async path=>{if(String(path).startsWith('/api/production-order-pages'))return Response.json({supported:false});if(String(path).includes('/api/production-workflow')){calls++;return Response.json(full);}if(String(path).includes('/api/production-standards'))standards++;return Response.json({records:[]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),render=mode=>act(async()=>root.render(React.createElement(Production,{mode,operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
 try{await render('payroll');await until(()=>host.querySelector('.production-payroll-screen'));await render('work');await until(()=>host.textContent.includes('LSX-A'));await render('payroll');await until(()=>host.querySelector('.production-payroll-screen'));assert.equal(calls,1);assert.equal(standards,0);}finally{await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});

test('progress uses its own read, retains table after refresh failure and cannot substitute for full detail or payroll',async()=>{
 clearProductionSnapshot();clearClientReads('session');window.sessionStorage.clear();window.localStorage.clear();
 let progressCalls=0,fullCalls=0,fail=false,release;
 const gate=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async path=>{const url=String(path);if(url.includes('view=progress')){progressCalls++;return fail?new Response('Overloaded',{status:503}):Response.json(work);}if(url==='/api/production-workflow?view=workspace'){fullCalls++;return gate;}return Response.json({records:[]});};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),render=mode=>act(async()=>root.render(React.createElement(Production,{mode,operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
 try{
  await render('progress');await until(()=>host.querySelector('.production-progress-review-screen'));assert.equal(progressCalls,1);assert.equal(fullCalls,0);
  fail=true;await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cập nhật dữ liệu').click());await until(()=>host.querySelector('[role="alert"]'));assert.match(host.textContent,/LSX-A/);assert.ok(host.querySelector('.production-progress-review-screen'));
  fail=false;await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Thử lại').click());await until(()=>!host.querySelector('[role="alert"]'));assert.equal(progressCalls,3);
  await render('payroll');await until(()=>fullCalls===1);assert.equal(host.querySelector('.production-payroll-screen'),null);assert.match(host.textContent,/Đang tải dữ liệu sản xuất/);
  release(Response.json(full));await until(()=>host.querySelector('.production-payroll-screen'));
 }finally{release(Response.json(full));await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});

test('progress never requests completed/cancelled history until selected; history and active snapshots stay separate',async()=>{
 clearProductionSnapshot();clearClientReads('session');window.localStorage.clear();
 const activeOrder={...orders[0],lsxCode:'ACTIVE-ONLY'},done={...orders[0],id:'DONE',lsxCode:'DONE-ONLY',completedQty:1000,actualCompletedAt:'2026-11-03'},cancel={...orders[0],id:'CANCEL',lsxCode:'CANCEL-ONLY',status:'HỦY',cancelReason:'Test'};
 const activeData={...work,orders:[activeOrder],progressOrders:[activeOrder],reports:[]},historyData={...activeData,orders:[activeOrder,done,cancel],progressOrders:[activeOrder,done,cancel],reports:[{id:'DONE-R',kind:'completion',transitId:'DONE',line:'A',reportedQuantity:1000,approvedQuantity:1000,completedAt:'2026-11-03',reviewStatus:'Đã xác nhận'}]};
 const calls=[];globalThis.fetch=async path=>{const url=String(path);calls.push(url);return Response.json(url.includes('scope=all')?historyData:activeData);};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Production,{mode:'progress',operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));await until(()=>host.textContent.includes('ACTIVE-ONLY'));
  assert.equal(calls.some(u=>u.includes('scope=all')),false);assert.doesNotMatch(host.textContent,/DONE-ONLY|CANCEL-ONLY/);
  const choose=async value=>{await act(async()=>{const select=[...host.querySelectorAll('.production-progress-review-screen select')].find(s=>[...s.options].some(o=>o.value==='hidden'));select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));});};
  await choose('hidden');await until(()=>host.textContent.includes('CANCEL-ONLY'));assert.match(host.textContent,/DONE-ONLY/);assert.doesNotMatch(host.textContent,/ACTIVE-ONLY/);assert.equal(calls.filter(u=>u.includes('scope=all')).length,1);
  await choose('active');await until(()=>host.textContent.includes('ACTIVE-ONLY'));assert.doesNotMatch(host.textContent,/DONE-ONLY|CANCEL-ONLY/);assert.equal(calls.filter(u=>u.includes('scope=all')).length,1);
 }finally{await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});

test('journal opens daily display without time-history calculation and requests it only on selection',async()=>{
 clearProductionSnapshot();clearClientReads('session');const calls=[];let release;
 const deferred=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async path=>{const url=String(path);calls.push(url);return url.endsWith('view=journal')?deferred:Response.json(full);};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Production,{mode:'journal',operator:'SYNTHETIC',preferenceUser:'SYNTHETIC'})));
  await until(()=>host.querySelector('.production-journal-title'));
  assert.ok(calls.includes('/api/production-workflow?view=workspace'));
  assert.equal(calls.some(u=>u.endsWith('view=journal')),false);
  await act(async()=>{const select=[...host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='time'));select.value='time';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  await until(()=>calls.some(u=>u.endsWith('view=journal')));
  release(Response.json(full));await until(()=>host.querySelector('.production-time-journal'));
  assert.equal([...host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='time')).value,'time');
 }finally{release(Response.json(full));await act(async()=>root.unmount());host.remove();clearProductionSnapshot();clearClientReads('session');globalThis.fetch=originalFetch;}
});
