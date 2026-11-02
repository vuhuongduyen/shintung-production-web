import test, {after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

// Real mounted ProductionPlan/toolbar/feedback host; every service response is synthetic GET only.
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {ProductionPlan}=await vite.ssrLoadModule('/components/production-plan.tsx');
const {ActionFeedbackHost}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const sync=await vite.ssrLoadModule('/lib/data-sync.ts');
const oldFetch=globalThis.fetch,oldChannel=globalThis.BroadcastChannel;
globalThis.BroadcastChannel=class {close(){}};
const el=React.createElement, notices=[];
const receive=event=>notices.push(event.detail.message);
window.addEventListener('onspa-action-feedback',receive);
let requestResponse,reads,mutations,unknown;
const initialRequest={week:'2026-10-12',line:'A',version:1,request:{kind:'new',by:'Synthetic requester',at:'2026-10-17T00:00:00Z'}};
beforeEach(()=>{
 sync.clearClientReads('session');notices.length=0;reads=[];mutations=[];unknown=[];
 requestResponse=()=>Response.json({requests:[initialRequest]});
 globalThis.fetch=async(input,init={})=>{
  const method=init.method||'GET';if(method!=='GET')mutations.push(method+' '+input);
  assert.equal(method,'GET','These tests must never issue a write');
  const url=new URL(String(input),'https://synthetic.test');
  if(url.pathname==='/api/capacity'&&url.searchParams.has('requests')){reads.push({url:url.pathname+url.search,cache:init.cache});return requestResponse();}
  if(url.pathname==='/api/production-plan')return Response.json({revision:1,rows:[],sources:[],capacity:[],transit:[],audit:[],warnings:[],canReopen:false});
  unknown.push(url.pathname+url.search);throw Error('Unexpected synthetic GET');
 };
});
afterEach(()=>{assert.deepEqual(mutations,[]);assert.deepEqual(unknown,[]);});
after(async()=>{globalThis.fetch=oldFetch;globalThis.BroadcastChannel=oldChannel;window.removeEventListener('onspa-action-feedback',receive);await vite.close();dom.window.close();});
async function mount(){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(el(React.Fragment,null,el(ActionFeedbackHost),el(ProductionPlan,{initialWeek:'2026-10-12'}))));
 return{host,async close(){await act(async()=>root.unmount());host.remove();}};
}
const confirm=()=>Array.from(document.querySelectorAll('[data-standard-toolbar] button')).find(b=>b.textContent.startsWith('Xác nhận'));
const panel=()=>document.querySelector('.capacity-confirm-overlay');
const alert=()=>document.querySelector('[role="alert"]');
async function clickConfirm(){const button=confirm();assert.ok(button,'Buttons: '+Array.from(document.querySelectorAll('button')).map(b=>b.textContent).join('|')); await act(async()=>button.click());}

for(const status of [401,403,500])test(`explicit Capacity review HTTP ${status} warns safely and does not open cached review`,async()=>{
 const view=await mount();try{
  assert.equal(reads.length,1);requestResponse=()=>Response.json({error:'SELECT private_password FROM auth_accounts'},{status});
  await clickConfirm();assert.equal(reads.length,2,'Explicit refresh must bypass the prior read cache');assert.equal(reads[1].cache,'reload');
  assert.equal(panel(),null);assert.ok(alert());assert.equal(notices.length,1);assert.doesNotMatch(alert().textContent,/SELECT|private_password|auth_accounts/);
  if(status===401||status===403)assert.equal(confirm(),undefined,'Revoked access must remove reviewer action');
 }finally{await view.close();}
});
for(const kind of ['network','malformed JSON','malformed list'])test(`explicit Capacity review ${kind} failure warns without opening stale review`,async()=>{
 const view=await mount();try{
  requestResponse=()=>{if(kind==='network')throw Error('private network token');return kind==='malformed JSON'?new Response('private invalid JSON'):Response.json({requests:null});};
  await clickConfirm();assert.equal(panel(),null);assert.ok(alert());assert.equal(notices.length,1);assert.doesNotMatch(alert().textContent,/private|token|JSON/);
 }finally{await view.close();}
});
test('explicit review waits for fresh successful list and opens once',async()=>{
 const view=await mount();try{
  let finish;requestResponse=()=>new Promise(resolve=>finish=resolve);
  await clickConfirm();assert.equal(panel(),null);assert.equal(confirm().disabled,true);assert.equal(reads.length,2);
  await act(async()=>confirm().click());assert.equal(reads.length,2,'Native pending control prevents duplicate refresh');
  await act(async()=>window.dispatchEvent(new window.Event('focus')));
  assert.equal(reads.length,2,'Background focus polling cannot supersede an explicit pending refresh');
  await act(async()=>finish(Response.json({requests:[]})));
  assert.ok(panel());assert.match(panel().textContent,/Không có yêu cầu chờ xử lý/);assert.doesNotMatch(panel().textContent,/Synthetic requester/);assert.equal(notices.length,0);
 }finally{await view.close();}
});
for(const kind of ['HTTP','network'])test(`background Capacity ${kind} failure stays silent`,async()=>{
 requestResponse=()=>{if(kind==='network')throw Error('private offline');return Response.json({error:'private SQL'},{status:500});};
 const view=await mount();try{assert.equal(reads.length,1);assert.equal(notices.length,0);assert.equal(alert(),null);assert.equal(panel(),null);assert.equal(confirm(),undefined);}finally{await view.close();}
});
for(const kind of ['abort','session'])test(`explicit Capacity refresh ${kind} cancellation is silent and cannot open review`,async()=>{
 const view=await mount();try{
  let finish,fail;requestResponse=()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;});await clickConfirm();
  await act(async()=>{if(kind==='session'){sync.clearClientReads('session');finish(Response.json({requests:[initialRequest]}));}else{const error=Error('private abort');error.name='AbortError';fail(error);}});
  assert.equal(panel(),null);assert.equal(notices.length,0);assert.equal(alert(),null);
 }finally{await view.close();}
});
test('unmounted explicit Capacity refresh cannot post late failure',async()=>{
 const view=await mount();let fail;requestResponse=()=>new Promise((_,reject)=>fail=reject);await clickConfirm();await view.close();
 await act(async()=>fail(Error('private late failure')));assert.equal(notices.length,0);assert.equal(panel(),null);
});
test('background refresh failure preserves the last count without showing a warning or review',async()=>{
 const view=await mount();try{
  assert.match(confirm().textContent,/1/);
  requestResponse=()=>{throw Error('private offline');};sync.clearClientReads('mutation');
  await act(async()=>window.dispatchEvent(new window.Event('focus')));
  assert.equal(reads.length,2);assert.match(confirm().textContent,/1/);assert.equal(notices.length,0);assert.equal(panel(),null);
 }finally{await view.close();}
});
