import test,{after} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<html><body></body></html>',{url:'https://test.example',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Event','CustomEvent','Node','MutationObserver'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false}});const {useOperationNotices}=await vite.ssrLoadModule('/components/use-operation-notices.ts');after(async()=>{await vite.close();dom.window.close()});
test('bridges results once, keeps field hints, updates changed content and clears removed source',async()=>{
 const results=[];let clears=0;window.addEventListener('onspa-action-feedback',e=>results.push(e.detail));window.addEventListener('onspa-action-feedback-clear',()=>clears++);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);function Entry(){useOperationNotices();return null}
 await act(async()=>root.render(React.createElement(Entry)));
 const source=document.createElement('p');source.className='admin-operation-notice error';source.textContent='Trùng thời gian';source.getClientRects=()=>[{}];
 await act(async()=>{document.body.append(source);await new Promise(r=>setTimeout(r,0))});assert.equal(results.length,1);assert.equal(results[0].kind,'error');assert.equal(source.getAttribute('data-operation-source-hidden'),'true');
 await act(async()=>{source.textContent='Không có quyền';await new Promise(r=>setTimeout(r,0))});assert.equal(results.length,2);
 const hint=document.createElement('small');hint.setAttribute('role','alert');hint.textContent='Nhập ngày';await act(async()=>{document.body.append(hint);await new Promise(r=>setTimeout(r,0))});assert.equal(results.length,2);assert.equal(hint.hasAttribute('data-operation-source-hidden'),false);
 await act(async()=>{source.remove();await new Promise(r=>setTimeout(r,0))});assert.equal(clears,1);await act(async()=>root.unmount());host.remove();hint.remove();
});

test('passive missing-rate guidance stays inline and never becomes an operation popup',async()=>{
 const {default:Warning}=await vite.ssrLoadModule('/components/labor-rate-warning.tsx');
 const events=[],receive=e=>events.push(e.detail);window.addEventListener('onspa-action-feedback',receive);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);function Entry(){useOperationNotices();return React.createElement(Warning,{items:[{id:'SYNTHETIC-MISSING',sku:'SYNTHETIC-SKU',date:'2026-11-02'}]})}
 const original=HTMLElement.prototype.getClientRects;HTMLElement.prototype.getClientRects=()=>[{}];
 try{await act(async()=>{root.render(React.createElement(Entry));await new Promise(r=>setTimeout(r,0));});
 assert.equal(events.length,0);assert.ok(host.querySelector('details[data-operation-guidance]'));assert.match(host.textContent,/Chưa xác định được Giờ công/);assert.equal(host.querySelector('[data-operation-source-hidden]'),null);
 }finally{await act(async()=>root.unmount());host.remove();HTMLElement.prototype.getClientRects=original;window.removeEventListener('onspa-action-feedback',receive);}
});
