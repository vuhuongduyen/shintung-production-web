import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test'});
for(const k of ['window','document','HTMLElement','Event','CustomEvent','Node','localStorage'])globalThis[k]=dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});
const {useStageCancellation}=await vite.ssrLoadModule('/components/production-stage-cancel.tsx');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await vite.close();dom.window.close();});
test('one shared reason, explicit preview/apply, changed reason invalidates preview, backend reason replaces generic failure',async()=>{
 const requests=[];let api,reason='Sai giờ',saved=0,fail=false,restore=null;
 globalThis.fetch=async(path,init)=>{requests.push(JSON.parse(init.body));return fail?Response.json({error:'Còn thao tác phía sau phụ thuộc.'},{status:422}):Response.json({expectedRevision:'r1',eventChanges:[{}],reportImpacts:[]});};
 function Harness(){api=useStageCancellation({orderId:'TEST',reason,restore,allowed:true,onSaved:async()=>saved++,onBusyChange:()=>{}});return React.createElement('div');}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>act(async()=>root.render(React.createElement(Harness)));
 try{
 await render();await act(async()=>api.toggle('start'));assert.equal(requests.length,0);
 await act(async()=>api.request());assert.equal(requests.at(-1).action,'preview');assert.ok(api.preview);assert.equal(saved,0);
 reason='Sai người';await render();assert.equal(api.preview,null);await act(async()=>api.request());assert.equal(requests.at(-1).action,'preview');
 restore={mode:'continuous',employees:['N']};await render();assert.equal(api.preview,null);await act(async()=>api.request());assert.equal(requests.at(-1).action,'preview');assert.deepEqual(requests.at(-1).restore,restore);restore={...restore,mode:'return',at:'2026-09-25T11:00:00+07:00'};await render();assert.equal(api.preview,null);await act(async()=>api.request());
 await act(async()=>api.request());assert.equal(requests.at(-1).action,'apply');assert.equal(requests.at(-1).expectedRevision,'r1');assert.equal(requests.at(-1).reason,'Sai người');assert.equal(saved,1);
 await act(async()=>api.toggle('complete'));fail=true;let message='';window.addEventListener('onspa-action-feedback',e=>message=e.detail.message);
 await act(async()=>api.request());assert.equal(api.error,'Còn thao tác phía sau phụ thuộc.');assert.equal(message,'');assert.equal(api.preview,null);
 }finally{await act(async()=>root.unmount());host.remove();}
});
