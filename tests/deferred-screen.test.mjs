import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','CustomEvent','Node'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {deferredScreen}=await vite.ssrLoadModule('/components/onspa-ui/deferred-screen.tsx');
after(async()=>{await vite.close();dom.window.close();});
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
async function mount(View,props={}){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=next=>act(async()=>root.render(React.createElement(View,next)));await render(props);return{host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}

test('screen import starts only when opened and refresh preserves actual component/draft/toolbar identity',async()=>{
 let calls=0,complete;
 const View=deferredScreen(()=>{calls++;return new Promise(resolve=>complete=resolve);});
 assert.equal(calls,0);
 function WeeklyCapacity({revision}){return React.createElement('section',null,React.createElement('span',null,revision),React.createElement('input',{'aria-label':'TEST draft',defaultValue:'TEST'}));}
 const m=await mount(View,{revision:1});
 try{
  assert.equal(calls,1);assert.ok(m.host.querySelector('[role=status]'));assert.equal(m.host.querySelector('button'),null);
  await act(async()=>complete({default:WeeklyCapacity}));await settle();
  const input=m.host.querySelector('input');assert.ok(input);input.value='Keep TEST draft';
  await m.render({revision:2});await settle();assert.equal(calls,1);assert.equal(m.host.querySelector('input')===input,true);assert.equal(input.value,'Keep TEST draft');assert.equal(m.host.querySelector('span').textContent,'2');assert.equal(m.host.querySelector('[role=status]'),null);
 }finally{await m.close();}
});

test('failed chunk has visible retry and retries only that screen without a page reload',async()=>{
 let calls=0;const oldError=console.error;console.error=()=>{};
 const View=deferredScreen(async()=>{calls++;if(calls===1)throw Error('TEST chunk unavailable');return {default:()=>React.createElement('input',{'aria-label':'TEST loaded'})};});
 const m=await mount(View);
 try{await settle();assert.equal(calls,1);assert.match(m.host.querySelector('[role=alert]').textContent,/Không tải được giao diện/);await act(async()=>m.host.querySelector('button').click());await settle();assert.equal(calls,2);assert.ok(m.host.querySelector('input'));assert.equal(m.host.querySelector('[role=alert]'),null);}
 finally{console.error=oldError;await m.close();}
});
