import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLInputElement','MutationObserver','DocumentFragment','NodeFilter','Event','CustomEvent','Node','localStorage'])globalThis[k]=dom.window[k];
globalThis.getComputedStyle=dom.window.getComputedStyle;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':process.cwd()}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});
const {default:Alert}=await vite.ssrLoadModule('/components/production-unassigned-alert.tsx');
const original=globalThis.fetch;after(async()=>{globalThis.fetch=original;await vite.close();dom.window.close();});
const row={key:'TEST',id:'N',name:'TEST employee',line:'A',minutes:12,count:1,since:Date.now()-720000,due:false,acknowledgedAt:null};
for(const fail of [false,true])test(`acknowledge closes immediately during pending read/POST; failure=${fail} remains retryable`,async()=>{
 let getCount=0,finishRead,finishAck;const posts=[];
 globalThis.fetch=async(path,init)=>{if(init?.method==='POST'){posts.push(JSON.parse(init.body));return await new Promise(resolve=>finishAck=resolve);}if(++getCount===1)return Response.json({rows:[row]});return await new Promise(resolve=>finishRead=resolve);};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
 await act(async()=>root.render(React.createElement(Alert,{line:'A',revision:0})));assert.ok(document.querySelector('[role=dialog]'));
 await act(async()=>window.dispatchEvent(new Event('focus')));assert.ok(finishRead);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Đã hiểu')).click());
 assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(posts[0].reminder.action,'acknowledge');
 await act(async()=>finishRead(Response.json({rows:[row]})));assert.equal(document.querySelector('[role=dialog]'),null);
 await act(async()=>finishAck(fail?Response.json({error:'offline'},{status:503}):Response.json({rows:[{...row,acknowledgedAt:Date.now(),nextAt:Date.now()+300000}]})));
 if(fail){assert.ok(document.querySelector('[role=dialog]'));assert.match(document.body.textContent,/Chưa lưu được xác nhận/);}else assert.equal(document.querySelector('[role=dialog]'),null);
 }finally{await act(async()=>root.unmount());host.remove();}
});
