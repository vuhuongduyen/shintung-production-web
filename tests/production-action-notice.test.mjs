import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<body></body>',{url:'https://test.local'});
for(const key of ['window','document','Element','HTMLElement','Event','CustomEvent'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');
const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});
const {useProductionActionNotice}=await vite.ssrLoadModule('/components/production-action-notice.tsx');
after(async()=>{await vite.close();dom.window.close()});
const el=React.createElement;let api;
function Fixture({context,duration=10000}){api=useProductionActionNotice(context,duration);return el('main',{onClickCapture:api.onInteraction,onChangeCapture:api.onInteraction},api.message&&el('div',{'data-production-notice':true,role:'alert'},api.message.text,el('button',{onClick:api.clearMessage},'Đóng')),el('button',{'data-next':true},'Chuyển Line'));}
async function mount(){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);return {host,async render(context,duration){await act(()=>root.render(el(Fixture,{context,duration})))},async close(){await act(()=>root.unmount());host.remove()}};}
const error={kind:'error',text:'Lỗi thao tác cũ'};
test('switching Line/week clears old notice and ignores late response even after returning to old Line',async()=>{const v=await mount();try{await v.render('A:19');const old=api.setMessage;await act(()=>old(error));assert.ok(v.host.querySelector('[role=alert]'));await v.render('B:19');assert.equal(v.host.querySelector('[role=alert]'),null);await act(()=>old(error));assert.equal(v.host.querySelector('[role=alert]'),null);await v.render('A:19');await act(()=>old(error));assert.equal(v.host.querySelector('[role=alert]'),null);}finally{await v.close()}});
test('next action and explicit close dismiss notice; a later result still displays',async()=>{const v=await mount();try{await v.render('A');await act(()=>api.setMessage(error));await act(()=>v.host.querySelector('[data-next]').click());assert.equal(v.host.querySelector('[role=alert]'),null);await act(()=>api.setMessage({kind:'success',text:'Đã lưu'}));assert.match(v.host.textContent,/Đã lưu/);await act(()=>v.host.querySelector('[data-production-notice] button').click());assert.equal(v.host.querySelector('[role=alert]'),null);}finally{await v.close()}});
test('notice expires without affecting subsequent results',async()=>{const v=await mount();try{await v.render('A',20);await act(()=>api.setMessage(error));await act(()=>new Promise(r=>setTimeout(r,40)));assert.equal(v.host.querySelector('[role=alert]'),null);}finally{await v.close()}});
