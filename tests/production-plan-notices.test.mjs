import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','getComputedStyle','DOMRect'])globalThis[name]=dom.window[name];
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),el=React.createElement;
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {default:Notices}=await vite.ssrLoadModule('/components/production-plan-notices.tsx');
const {StandardToolbar,toolbar}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
after(async()=>{await vite.close();dom.window.close();});
async function fixture(initial=[]){let props={notices:initial,contextKey:'2026-11-02',active:true};const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=async()=>act(async()=>root.render(el(React.Fragment,null,el(StandardToolbar,{name:'ProductionPlan',items:[toolbar.action({onClick:()=>{}},'Tải lại dữ liệu'),toolbar.note(el(Notices,props))]}),el('table',{'data-test-table':true},el('tbody',null,el('tr',null,el('td',null,'Synthetic row')))))));await render();return{host,async update(p){props={...props,...p};await render();},async close(){await act(async()=>root.unmount());host.remove();}};}
const trigger=view=>view.host.querySelector('[data-plan-notices] button');
const dialog=()=>document.querySelector('[role=dialog]');
async function click(node){assert.ok(node);await act(async()=>node.click());}
const warning={key:'daily',severity:'warning',message:'Chưa kiểm tra đủ tải theo ngày vì thiếu lịch đã xác nhận hoặc giờ công: SYNTHETIC'};
test('persistent toolbar slot keeps warnings out of normal flow and exposes them on demand with live summary',async()=>{
 const view=await fixture();try{
  const slot=view.host.querySelector('[data-plan-notices]'),table=view.host.querySelector('table'),siblings=[...view.host.children];assert.equal(trigger(view).style.visibility,'hidden');assert.equal(trigger(view).getAttribute('aria-hidden'),'true');assert.equal(trigger(view).tabIndex,-1);assert.equal(dialog(),null);
  await view.update({notices:[warning]});assert.equal(view.host.querySelector('[data-plan-notices]'),slot);assert.equal(view.host.querySelector('table'),table);assert.deepEqual([...view.host.children],siblings);assert.equal(trigger(view).style.visibility,'visible');assert.equal(trigger(view).getAttribute('aria-expanded'),'false');assert.match(slot.querySelector('[role=status]').textContent,/Cảnh báo \(1\)/);assert.equal(view.host.textContent.includes(warning.message),false,'long warning never creates a banner');
  await click(trigger(view));assert.ok(dialog());assert.equal(trigger(view).getAttribute('aria-expanded'),'true');assert.match(dialog().textContent,/thiếu lịch/);assert.ok(dialog().getAttribute('aria-labelledby'));assert.equal(view.host.contains(dialog()),false,'portal cannot resize the toolbar or table');
  const close=dialog().querySelector('[aria-label="Đóng thông báo kế hoạch"]');assert.equal(document.activeElement,close);await click(close);assert.equal(dialog(),null);assert.equal(document.activeElement,trigger(view));
  await view.update({notices:[]});assert.equal(trigger(view).style.visibility,'hidden');assert.equal(slot.querySelector('[role=status]').textContent,'');assert.deepEqual([...view.host.children],siblings);
 }finally{await view.close();}
});
test('Escape, context changes and inactive workspace dismiss the panel; retry only runs after explicit activation',async()=>{
 let calls=0;const failed={key:'save',severity:'error',message:'Chỉnh sửa chưa được lưu.',retry:()=>calls++};const view=await fixture([failed]);try{
  assert.equal(calls,0);await click(trigger(view));assert.equal(calls,0);await click([...dialog().querySelectorAll('button')].find(b=>b.textContent==='Thử lưu lại'));assert.equal(calls,1);
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(dialog(),null);assert.equal(document.activeElement,trigger(view));
  await click(trigger(view));await view.update({contextKey:'2026-11-09'});assert.equal(dialog(),null);
  await click(trigger(view));await view.update({active:false});assert.equal(dialog(),null);assert.equal(calls,1);
 }finally{await view.close();}
});
test('clearing all notices closes the panel and does not leave focus on an invisible control',async()=>{
 const view=await fixture([warning]);try{await click(trigger(view));await view.update({notices:[]});assert.equal(dialog(),null);assert.notEqual(document.activeElement,trigger(view));assert.equal(trigger(view).getAttribute('aria-hidden'),'true');}finally{await view.close();}
});

test('outside pointer/focus dismisses without stealing focus back from the chosen toolbar control',async()=>{
 const view=await fixture([warning]);try{
  await click(trigger(view));await act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
  const outside=[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Tải lại dữ liệu');
  await act(async()=>{outside.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true,button:0}));outside.focus();outside.click();});
  assert.equal(dialog(),null);assert.equal(document.activeElement,outside);
 }finally{await view.close();}
});
