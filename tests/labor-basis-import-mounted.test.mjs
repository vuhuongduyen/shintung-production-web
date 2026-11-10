import {trackBrowserChannels} from './helpers/browser-channels.mjs';const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {createTestServer} from './helpers/vite-test-server.mjs';import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {siteApi} from '../worker/site-api.mjs';import {records} from '../scripts/local/database.mjs';import {previewFixedLaborReferences} from '../lib/production-labor-reference-snapshot.mjs';import {siteLaborHours} from '../lib/site-labor-hours.mjs';
const origin='https://onspa-thu-nghiem.shintung-vn-4458.chatgpt.site',endpoint='/api/labor-reference-snapshot-import';
const dom=new JSDOM('<html><body></body></html>',{url:origin});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','CustomEvent','Node','localStorage','sessionStorage'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createTestServer(),{default:Panel}=await vite.ssrLoadModule('/components/labor-basis-import-panel.tsx');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();closeChannels();dom.window.close();});
async function setup(c,count=139){
 const report={transitId:c.order.id,kind:'completion',sku:c.order.sku,orderSnapshot:{...c.order},line:'A',version:1,stageName:'FINAL',reviewStatus:'Đã xác nhận',approvedQuantity:100,reportedQuantity:100,completedAt:'2026-11-02T03:00:00Z',hours:{hc:3,ot:1,total:4}};
 for(let i=0;i<count;i++)await c.put('production_report','SYNTHETIC-UI-'+i,{...report,id:'SYNTHETIC-UI-'+i});
 const api=await reviewer(c,(req,env)=>{const url=new URL(req.url);url.hostname=new URL(origin).hostname;const headers=new Headers(req.headers);if(headers.has('origin'))headers.set('origin',origin);return siteApi(new Request(url,{method:req.method,headers,...(req.method==='POST'?{body:req.body,duplex:'half'}:{})}),env);});
 const w=await api('/api/production-workflow'),m=await api('/api/records?entity=labor_hours');assert.equal(w.status,200);
 const p=await previewFixedLaborReferences({reports:w.body.reports,orders:w.body.orders,menu:siteLaborHours(m.body.records),observedAt:'2026-11-10T00:00:00Z'});assert.equal(p.manifest.entries.length,count);
 const payload={action:'preview',manifest:p.manifest,omissions:[]},calls=[];
 let intercept=null;
 globalThis.fetch=async(url,init)=>{
  if(String(url)!==endpoint)return Response.json({ok:true});
  const body=JSON.parse(init.body);calls.push(body);const result=await api(endpoint,body);if(intercept)return intercept(result,body);return Response.json(result.body,{status:result.status});
 };
 return {payload,calls,setIntercept:fn=>{intercept=fn;}};
}
async function mount(allowed=true){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async value=>act(async()=>root.render(React.createElement(Panel,{allowed:value})));
 await render(allowed);const details=host.querySelector('details');if(details)details.open=true;
 const button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
 async function click(label){const b=button(label);assert.ok(b,label);assert.equal(b.disabled,false,label);await act(async()=>{b.click();await new Promise(r=>setTimeout(r,5));});}
 async function settle(){for(let i=0;i<200&&host.textContent.includes('Đang đối chiếu…');i++)await act(async()=>{await new Promise(r=>setTimeout(r,10));});assert.ok(!host.textContent.includes('Đang đối chiếu…'));}
 async function load(payload){const input=host.querySelector('input[type=file]'),text=typeof payload==='string'?payload:JSON.stringify(payload);Object.defineProperty(input,'files',{configurable:true,value:[{name:'synthetic-preview.json',size:text.length,text:async()=>text}]});await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,5));});}
 async function confirm(){const input=host.querySelector('input[type=checkbox]');assert.ok(input);await act(async()=>input.click());}
 return {host,button,click,settle,load,confirm,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
test('mounted Admin QA uploads 139 synthetic bases, previews, explicitly confirms, applies and reads back through real API',()=>dailyFixture(async c=>{
 const f=await setup(c),ui=await mount();try{
 const before=await records(c.db);assert.equal(f.calls.length,0);await ui.load(f.payload);assert.match(ui.host.textContent,/139 căn cứ/);assert.equal(f.calls.length,0);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 await ui.click('Kiểm tra căn cứ');await ui.settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'preview');assert.deepEqual(await records(c.db),before);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 await ui.confirm();await ui.click('Lưu bản căn cứ riêng');await ui.settle();assert.deepEqual(f.calls.map(x=>x.action),['preview','apply','preview']);assert.match(ui.host.textContent,/Đã đọc lại và đối chiếu khớp 139 căn cứ/);
 assert.match(f.calls[1].expectedSourceRevision,/^[a-f0-9]{64}$/);assert.equal(f.calls[1].confirmDigest,f.payload.manifest.digest);
 const after=await records(c.db);assert.deepEqual(after.filter(r=>r.entity!=='production_labor_reference_snapshot'),before);assert.equal(after.length,before.length+1);
 await ui.click('Kiểm tra căn cứ');await ui.settle();assert.deepEqual(await records(c.db),after);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 }finally{await ui.close();}
}));
test('changed source is rejected; preview confirmation is discarded without modifying original reports',()=>dailyFixture(async c=>{
 const f=await setup(c,2),ui=await mount();try{await ui.load(f.payload);await ui.click('Kiểm tra căn cứ');await ui.settle();await ui.confirm();
 await c.db.prepare("UPDATE app_records SET updated_at='SYNTHETIC-CHANGED' WHERE entity='labor_hours'").run();const before=await records(c.db);
 await ui.click('Lưu bản căn cứ riêng');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/Phiên bản nguồn khác/);assert.equal(ui.host.querySelector('input[type=checkbox]'),null);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);assert.deepEqual(await records(c.db),before);
 }finally{await ui.close();}
}));
test('lost apply response is recoverable by checking stored basis, without applying twice',()=>dailyFixture(async c=>{
 const f=await setup(c,2),ui=await mount();try{await ui.load(f.payload);await ui.click('Kiểm tra căn cứ');await ui.settle();await ui.confirm();
 f.setIntercept((result,body)=>{if(body.action==='apply')throw Error('SYNTHETIC network loss after commit');return Response.json(result.body,{status:result.status});});
 await ui.click('Lưu bản căn cứ riêng');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/đọc lại trước khi thử lưu/);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 f.setIntercept(null);const saved=await records(c.db);await ui.click('Kiểm tra căn cứ');await ui.settle();assert.match(ui.host.textContent,/Đã đọc lại và đối chiếu khớp 2 căn cứ/);assert.equal(f.calls.filter(x=>x.action==='apply').length,1);assert.deepEqual(await records(c.db),saved);
 }finally{await ui.close();}
}));
test('invalid file, digest mismatch and false readback never enable or report successful saving',()=>dailyFixture(async c=>{
 const f=await setup(c,2),ui=await mount();try{
 await ui.load('not-json');assert.ok(ui.host.querySelector('[role=alert]'));assert.equal(f.calls.length,0);
 const bad=structuredClone(f.payload);bad.manifest.digest='0'.repeat(64);await ui.load(bad);await ui.click('Kiểm tra căn cứ');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/Digest/);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 await ui.load(f.payload);await ui.click('Kiểm tra căn cứ');await ui.settle();await ui.confirm();f.setIntercept((r,b)=>Response.json(b.action==='preview'&&r.body.status==='already-present'?{...r.body,count:999}:r.body,{status:r.status}));
 await ui.click('Lưu bản căn cứ riêng');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/không khớp/);assert.doesNotMatch(ui.host.textContent,/Đã đọc lại và đối chiếu khớp/);
 }finally{await ui.close();}
}));
test('UI is hidden for ordinary or Line-scoped users and MAIN; losing permission clears selected package',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({});};let ui=await mount(false);assert.equal(ui.host.textContent,'');await ui.close();
 dom.reconfigure({url:'https://sanxuat.shintung-vn-4458.chatgpt.site'});ui=await mount(true);assert.equal(ui.host.textContent,'');await ui.close();dom.reconfigure({url:origin});
 ui=await mount(true);try{await ui.load({action:'preview',manifest:{kind:'labor-reference-snapshot-v1',digest:'a'.repeat(64),entries:[{}]},omissions:[]});await ui.render(false);assert.equal(ui.host.textContent,'');await ui.render(true);assert.doesNotMatch(ui.host.textContent,/synthetic-preview/);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);assert.equal(calls,0);}finally{await ui.close();}
});

test('HTML resource-limit response never renders raw HTML or claims an import succeeded',()=>dailyFixture(async c=>{
 const f=await setup(c,2),ui=await mount();try{
 await ui.load(f.payload);
 f.setIntercept(()=>new Response('<html>Worker exceeded resource limits</html>',{status:500,headers:{'Content-Type':'text/html'}}));
 await ui.click('Kiểm tra căn cứ');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/giới hạn tài nguyên/);assert.doesNotMatch(ui.host.textContent,/Unexpected token|<html>|Đã đọc lại và đối chiếu khớp/);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);assert.equal((await records(c.db)).filter(r=>r.entity==='production_labor_reference_snapshot').length,0);
 f.setIntercept(()=>new Response('{invalid',{status:200,headers:{'Content-Type':'application/json'}}));
 await ui.click('Kiểm tra căn cứ');await ui.settle();assert.match(ui.host.querySelector('[role=alert]').textContent,/Không đọc được phản hồi máy chủ/);assert.equal(ui.button('Lưu bản căn cứ riêng').disabled,true);
 }finally{await ui.close();}
}));
