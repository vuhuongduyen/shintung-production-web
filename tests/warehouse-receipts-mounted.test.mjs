import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','Node','MutationObserver','localStorage'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});
const {ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const {WarehouseReceipts}=await vite.ssrLoadModule('/components/warehouse-receipts.tsx');
after(async()=>{await vite.close();dom.window.close();});
test('select pending only, review explicit selected ids and keep commit gated',async()=>{
 const calls=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=[{id:'1',source:'Sản xuất',status:'Chờ xác nhận',proposedQuantity:10,lsxCode:'A'},{id:'2',source:'Sản xuất',status:'Đã xác nhận',proposedQuantity:20,lsxCode:'B'},{id:'3',source:'Sản xuất',status:'Chờ xác nhận',proposedQuantity:30,lsxCode:'C'}];
 globalThis.fetch=async(url,init)=>{if(String(url).includes('/api/warehouse-confirm')){const b=JSON.parse(init.body);calls.push(b);return Response.json({revision:'test',receipts:rows.filter(r=>b.ids.includes(r.id))});}return Response.json({records:rows.map(r=>({key:r.id,payload:r}))});};
 try{
  await act(async()=>{root.render(React.createElement(ToolbarPermissions.Provider,{value:()=>true},React.createElement(WarehouseReceipts,{catalog:[],onOpenSku:()=>{},pendingOnly:false,searchOpen:true,onCloseSearch:()=>{},onOpenSearch:()=>{},onChooseErp:()=>{}})));await new Promise(r=>setTimeout(r,60));});
  assert.equal(host.querySelectorAll('[data-standard-toolbar]').length,1);
  const boxes=host.querySelectorAll('tbody input[type=checkbox]');assert.equal(boxes.length,3);assert.equal(boxes[1].disabled,true);
  await act(async()=>boxes[0].click());assert.equal(host.querySelector('thead input').indeterminate,true);
  await act(async()=>host.querySelector('thead input').click());assert.equal(boxes[2].checked,true);assert.equal(boxes[1].checked,false);
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Xác nhận đã chọn')).click());
  assert.deepEqual(calls[0].ids,['1','3']);assert.equal(host.querySelector('[role=dialog] tbody').children.length,2);
  const confirm=[...host.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='Xác nhận nhập kho');assert.equal(confirm.disabled,true);
  await act(async()=>host.querySelector('[role=dialog] label input').click());assert.equal(confirm.disabled,false);
  assert.equal(calls.length,1,'no mutation before explicit final click');
 }finally{await act(async()=>root.unmount());host.remove();}
});
