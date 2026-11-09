import test,{after} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<!doctype html><body></body>',{url:'https://test.invalid'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','Event','Node'])globalThis[name]=dom.window[name];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});const {LeadtimeTiers}=await vite.ssrLoadModule('/components/leadtime-tiers.tsx');after(async()=>{await vite.close();dom.window.close();});
test('MOQ editor preserves separate values when adding/removing levels; readonly keeps full captured table',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let values=[{moq:'100',value:'2'},{moq:'1000',value:'5'}];
 const render=()=>root.render(React.createElement(LeadtimeTiers,{value:values,onChange:next=>{values=next;render();}}));
 try{await act(async()=>render());assert.equal(host.querySelectorAll('tbody tr').length,2);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Thêm mức MOQ').click());assert.deepEqual(values,[{moq:'100',value:'2'},{moq:'1000',value:'5'},{moq:'',value:''}]);
 await act(async()=>host.querySelector('tbody button').click());assert.deepEqual(values,[{moq:'1000',value:'5'},{moq:'',value:''}]);
 await act(async()=>root.render(React.createElement(LeadtimeTiers,{value:[{moq:'100',value:'2'},{moq:'1000',value:'5'}]})));
 assert.equal(host.querySelectorAll('input,button').length,0);assert.equal(host.querySelectorAll('tbody tr').length,2);assert.match(host.textContent,/1000/);
 }finally{await act(async()=>root.unmount());host.remove();}
});
