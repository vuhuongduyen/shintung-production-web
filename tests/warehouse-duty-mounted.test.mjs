import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','MutationObserver'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const {default:Entry}=await vite.ssrLoadModule('/components/warehouse-duty.tsx');
after(async()=>{await vite.close();dom.window.close();});
test('three-person selector, inline 24h picker anchored at input and one weekly save',async()=>{
 const names=['Quách Chanh Thảo','Trần Quốc Việt','Huỳnh Vạn Tiền'];const calls=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const change=async(node,value)=>{await act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});};
 try{await act(async()=>root.render(React.createElement(ToolbarPermissions.Provider,{value:(name,label)=>name==='ActualWorkSchedule'},React.createElement(Entry,{week:'2026-10-19',line:'A',employees:[...names.map((name,i)=>({id:`NV${i}`,name})),{id:'OTHER',name:'Người khác'}],events:[],allowed:true,busy:false,save:async b=>{calls.push(b);return false;}}))));
 assert.equal(host.querySelectorAll('tbody tr').length,6);const select=host.querySelector('[aria-label="Người trực tuần"]');assert.deepEqual([...select.options].slice(1).map(o=>o.text),names);
 await change(select,'NV0');assert.equal([...host.querySelectorAll('button')].some(b=>b.textContent==='Áp dụng cả tuần'),false);assert.ok([...host.querySelectorAll('tbody select')].every(s=>s.value==='NV0'));
 const input=host.querySelector('[aria-label="Phụ kho từ giờ 2026-10-19"]');assert.equal(input.value,'08:00');assert.equal(host.querySelector('[aria-label="Phụ kho đến giờ 2026-10-19"]').value,'08:00');input.closest('.cap-clock').getBoundingClientRect=()=>({left:100,right:212,top:200,bottom:238});
 await act(async()=>input.click());const panel=document.querySelector('.cap-clock-picker');assert.equal(panel.style.left,'100px');assert.equal(panel.style.top,'242px');const hour=panel.querySelector('[aria-label="Giờ 00–23"]'),minute=panel.querySelector('[aria-label="Phút 00–59"]');assert.equal(hour.options.length,24);assert.equal(minute.options.length,60);await change(hour,'16');await change(minute,'35');assert.equal(input.value,'16:35');await act(async()=>[...panel.querySelectorAll('button')].find(b=>b.textContent==='Xong').click());assert.equal(document.querySelector('.cap-clock-picker'),null);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Lưu ghi nhận').click());assert.equal(calls.length,1);assert.equal(calls[0].rows[0].start,'16:35');assert.equal(calls[0].rows[0].end,'08:00');assert.equal(calls[0].action,'warehouse-duty');assert.equal(input.value,'16:35','failed save retains input');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Hủy thay đổi').click());assert.equal(input.value,'08:00');assert.equal(host.querySelector('tbody select').value,'');
 await change(select,'NV1');await act(async()=>input.click());const second=document.querySelector('.cap-clock-picker');await act(async()=>[...second.querySelectorAll('button')].find(b=>b.textContent==='Xong').click());assert.equal(input.value,'08:00');await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Lưu ghi nhận').click());assert.equal(calls[1].rows[0].start,'');assert.equal(calls[1].rows[0].end,'');
 await act(async()=>[...host.querySelectorAll('tbody tr:first-child button')].find(b=>b.textContent==='Hủy').click());assert.equal(host.querySelector('tbody select').value,'');

 await act(async()=>[...host.querySelectorAll('tbody tr:first-child button')].find(b=>b.textContent.trim()==='+ Thêm dòng').click());assert.equal(host.querySelectorAll('tbody tr').length,7);
 const selects=host.querySelectorAll('tbody select');await change(selects[1],'NV2');assert.equal(selects[0].value,'');assert.equal(selects[1].value,'NV2');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Lưu ghi nhận').click());assert.equal(calls[2].rows[0].date,calls[2].rows[1].date);assert.notEqual(calls[2].rows[0].rowId,calls[2].rows[1].rowId);
 }finally{await act(async()=>root.unmount());host.remove();}
});
