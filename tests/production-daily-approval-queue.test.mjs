import {trackBrowserChannels} from './helpers/browser-channels.mjs';
const closeChannels=trackBrowserChannels();
import test,{after} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createTestServer} from './helpers/vite-test-server.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),vite=await createTestServer();
const {default:Progress}=await vite.ssrLoadModule('/components/production-progress-review.tsx');
after(async()=>{await vite.close();closeChannels();dom.window.close();});
const order={id:'PVC',lsxCode:'510-PVC',sku:'102TC15002',name:'Dây tắm PVC',line:'A',lsxQty:1000,planEnd:'2026-11-30',syncStatus:'ĐÃ ĐỒNG BỘ'};
const report=(id,day,qty)=>({id,transitId:'PVC',lsxCode:'510-PVC',sku:order.sku,line:'A',kind:'completion',reportingModel:'daily-finished-v1',quantityOnly:true,productionDate:day,productionAt:day+'T02:00:00Z',reportedQuantity:qty,reviewStatus:'Chờ kiểm tra',version:1});
const reports=[report('second','2026-11-17',300),report('first','2026-11-14',200),report('third','2026-11-17',400),{...report('approved','2026-11-12',100),reviewStatus:'Đã xác nhận'}];
async function mount(props={}){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=async extra=>act(async()=>root.render(React.createElement(Progress,{orders:[order],reports,events:[],employees:[],active:()=>({count:0}),manager:true,busy:false,refresh:()=>{},open:()=>{},onConfirm:async()=>({results:[]}),...props,...extra})));await render();const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Xác nhận báo công'));await act(async()=>button.click());return {host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
test('pending queue groups dates oldest first, preserves duplicate daily reports, visibility selector and removes expand/update controls',async()=>{
 const s=await mount();try{const q=s.host.querySelector('.daily-approval-queue');assert.ok(q);assert.deepEqual([...q.querySelectorAll('.progress-week-divider')].map(e=>e.textContent),['Ngày hoàn thành: 14/11/2026','Ngày hoàn thành: 17/11/2026']);assert.equal(q.querySelectorAll('button.primary-button').length,3);assert.equal(q.querySelectorAll('input[type=checkbox]').length,0);assert.equal([...q.querySelectorAll('th')].filter(e=>e.textContent==='Ngày hoàn thành').length,0);assert.ok([...s.host.querySelectorAll('select')].some(e=>[...e.options].some(o=>o.textContent==='Đang xử lý')));assert.ok(![...s.host.querySelectorAll('button')].some(e=>e.textContent==='Cập nhật dữ liệu'));}finally{await s.close();}
});
test('single click submits exact daily report and double click cannot submit twice; failure leaves row available',async()=>{
 let release,calls=[];const pending=new Promise(r=>release=r);const s=await mount({onConfirm:async items=>{calls.push(items);return pending;}});
 try{const b=s.host.querySelector('.daily-approval-queue button.primary-button');await act(async()=>{b.click();b.click();});assert.equal(calls.length,1);assert.equal(calls[0].length,1);assert.equal(calls[0][0].report.id,'first');assert.ok(calls[0][0].expectedReview.includes('2026-11-14'));await act(async()=>release({results:[{id:'first',ok:false,error:'Dữ liệu đã thay đổi'}]}));assert.match(s.host.textContent,/Dữ liệu đã thay đổi/);assert.equal(s.host.querySelectorAll('.daily-approval-queue button.primary-button').length,3);}finally{await s.close();}
});
test('read-only cannot approve and late output retains mandatory reason',async()=>{
 const s=await mount({orders:[{...order,planEnd:'2026-11-13'}],manager:true});try{assert.ok([...s.host.querySelectorAll('.daily-approval-queue button.primary-button')].every(b=>b.disabled));assert.equal(s.host.querySelectorAll('.progress-delay input').length,3);await s.render({orders:[order],manager:false});assert.ok([...s.host.querySelectorAll('.daily-approval-queue button.primary-button')].every(b=>b.disabled));}finally{await s.close();}
});
