import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.test'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','Node','NodeFilter','HTMLFormElement','HTMLDialogElement','getComputedStyle'])globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');
const vite=await createServer({appType:'custom',configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},server:{middlewareMode:true,hmr:false}});
const {ActionFeedbackHost,FeedbackActionButton}=await vite.ssrLoadModule('/components/action-feedback.tsx');
const {notifyActionFailure,notifyInvalidAction}=await vite.ssrLoadModule('/lib/action-feedback.ts');
const {StandardToolbar,toolbar,ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
after(async()=>{await vite.close();dom.window.close();});const el=React.createElement;
async function mount(component){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(el(React.Fragment,null,el(ActionFeedbackHost),component)));return{host,async render(component){await act(async()=>root.render(el(React.Fragment,null,el(ActionFeedbackHost),component)))},async close(){await act(async()=>root.unmount());host.remove()}}}
async function click(n){await act(async()=>n.click())}async function key(n,key){await act(async()=>n.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})))}
const alert=()=>document.querySelector('[role="alert"]');
test('blocked native action is disabled, pointer and keyboard explain without mutation or submit',async()=>{let calls=0,submits=0;const view=await mount(el('form',{onSubmit:e=>{e.preventDefault();submits++}},el(FeedbackActionButton,{disabled:true,disabledExplanation:'Chỉ chọn một dòng.',onClick:()=>calls++},'Sửa')));const button=view.host.querySelector('button[disabled]'),target=button.parentElement;assert.equal(button.disabled,true);assert.equal(target.getAttribute('role'),'button');await click(target);assert.match(alert().textContent,/Chỉ chọn một dòng/);await key(target,'Enter');await key(target,' ');assert.equal(calls,0);assert.equal(submits,0);await key(target,'Escape');assert.equal(alert(),null);await view.close()});
test('pending action runs once, repeats explain, focus returns after native button remount',async()=>{let calls=0,finish;const view=await mount(el(FeedbackActionButton,{id:'save',onClick:()=>{calls++;return new Promise(r=>finish=r)}},'Lưu'));view.host.querySelector('#save').focus();await click(view.host.querySelector('#save'));const target=view.host.querySelector('#save').parentElement;assert.equal(document.activeElement,target);await click(target);await key(target,'Enter');assert.equal(calls,1);assert.match(alert().textContent,/Đang xử lý/);await act(async()=>finish());assert.equal(view.host.querySelector('#save').disabled,false);assert.equal(document.activeElement,view.host.querySelector('#save'));await view.close()});
test('failed callbacks show fixed safe message, preserve native submit type and close focus',async()=>{let submitted=0;const view=await mount(el('form',{onSubmit:e=>{e.preventDefault();submitted++}},el(FeedbackActionButton,{id:'submit'},'Lưu'),el(FeedbackActionButton,{id:'fail',type:'button',onClick:()=>Promise.reject(Error('SELECT password FROM auth_accounts'))},'Lỗi')));await click(view.host.querySelector('#submit'));assert.equal(submitted,1);view.host.querySelector('#fail').focus();await click(view.host.querySelector('#fail'));assert.doesNotMatch(alert().textContent,/SELECT|password|auth_accounts/);const close=alert().querySelector('button');close.focus();await click(close);assert.equal(alert(),null);assert.equal(document.activeElement?.id,'fail');await view.close()});
test('notification portal lives in active modal scope and Escape does not reach underlying handler',async()=>{let escaped=0;const view=await mount(el('section',{role:'dialog','aria-modal':true,onKeyDown:e=>{if(e.key==='Escape')escaped++}},el(FeedbackActionButton,{id:'modal',disabled:true,disabledExplanation:'Thiếu thông tin.'},'Lưu')));const wrapper=view.host.querySelector('#modal').parentElement;wrapper.focus();await key(wrapper,'Enter');const dialog=view.host.querySelector('[role="dialog"]');assert.ok(dialog.contains(alert()));const close=alert().querySelector('button');close.focus();await key(close,'Escape');assert.equal(alert(),null);assert.equal(escaped,0);assert.equal(document.activeElement,wrapper);await view.close()});
test('visible toolbar permission denial defaults to feedback while explicit hidden mode remains hidden',async()=>{let calls=0;const items=[toolbar.action({onClick:()=>calls++},'Cấm',false)];const view=await mount(el(StandardToolbar,{items}));await click(view.host.querySelector('button'));assert.match(alert().textContent,/không có quyền/);assert.equal(calls,0);await view.render(el(StandardToolbar,{items,permissionFeedback:false}));assert.equal(view.host.querySelector('[data-standard-toolbar] button'),null);await view.close()});
test('toolbar rechecks permission and busy state before invoking stale callbacks',async()=>{let calls=0,finish;const items=[toolbar.action({onClick:()=>{calls++;return new Promise(r=>finish=r)}},'Chậm')];const view=await mount(el(StandardToolbar,{items}));await click(view.host.querySelector('button'));await click(view.host.querySelector('[data-feedback-button]'));assert.equal(calls,1);assert.match(alert().textContent,/Đang xử lý/);await act(async()=>finish());await view.render(el(ToolbarPermissions.Provider,{value:()=>false},el(StandardToolbar,{items})));await click(view.host.querySelector('[data-standard-toolbar] button'));assert.equal(calls,1);assert.match(alert().textContent,/không có quyền/);await view.close()});
test('invalid form notice is red global feedback without suppressing browser validation',async()=>{const view=await mount(el('form',{onInvalid:notifyInvalidAction},el('input',{required:true}),el(FeedbackActionButton,null,'Lưu')));await click(view.host.querySelector('button'));assert.match(alert().textContent,/Thông tin chưa hợp lệ/);assert.equal(view.host.querySelector('input').validity.valid,false);await view.close()});
test('specific service warning is not overwritten by the generic rejected callback warning',async()=>{const view=await mount(el(FeedbackActionButton,{onClick:async()=>{notifyActionFailure('Bạn không có quyền thực hiện thao tác này.');throw Error('private SQL detail')}},'Thử'));await click(view.host.querySelector('button'));assert.match(alert().textContent,/không có quyền/);assert.doesNotMatch(alert().textContent,/Không thể hoàn tất|SQL/);await view.close()});
test('explicit busy fieldset action remains keyboard-explainable without calling mutation',async()=>{let calls=0;const view=await mount(el('fieldset',{disabled:true},el(FeedbackActionButton,{disabled:true,disabledExplanation:'Đang xử lý.',onClick:()=>calls++},'Gửi đề nghị')));await key(view.host.querySelector('[data-feedback-button]'),'Enter');assert.equal(calls,0);assert.match(alert().textContent,/Đang xử lý/);await view.close()});
test('busy explanation close returns to replacement native button after action completes',async()=>{let finish;const view=await mount(el(FeedbackActionButton,{id:'return-target',onClick:()=>new Promise(r=>finish=r)},'Chậm'));view.host.querySelector('#return-target').focus();await click(view.host.querySelector('#return-target'));await key(view.host.querySelector('[data-feedback-button]'),'Enter');alert().querySelector('button').focus();await act(async()=>finish());await click(alert().querySelector('button'));assert.equal(document.activeElement?.id,'return-target');await view.close()});
test('toolbar preserves focus into busy explanation and returns after close across pending completion',async()=>{let finish;const view=await mount(el(StandardToolbar,{items:[toolbar.action({id:'toolbar-return',onClick:()=>new Promise(r=>finish=r)},'Chậm')]}));view.host.querySelector('#toolbar-return').focus();await click(view.host.querySelector('#toolbar-return'));const target=view.host.querySelector('[data-feedback-button]');assert.equal(document.activeElement,target);await key(target,'Enter');alert().querySelector('button').focus();await act(async()=>finish());await click(alert().querySelector('button'));assert.equal(document.activeElement?.id,'toolbar-return');await view.close()});
test('async toolbar failure resolves current trigger inside modal after pending remount',async()=>{let fail;const view=await mount(el('section',{role:'dialog','aria-modal':true},el(StandardToolbar,{items:[toolbar.action({id:'modal-async',onClick:()=>new Promise((_,reject)=>fail=reject)},'Lưu')]})));view.host.querySelector('#modal-async').focus();await click(view.host.querySelector('#modal-async'));await act(async()=>fail(Error('SQL private')));assert.ok(view.host.querySelector('[role="dialog"]').contains(alert()));alert().querySelector('button').focus();await click(alert().querySelector('button'));assert.equal(document.activeElement?.id,'modal-async');await view.close()});
test('notice is mounted within the real Radix dialog focus scope and its close control remains reachable',async()=>{const {Dialog,DialogContent,DialogTitle}=await vite.ssrLoadModule('/components/ui/dialog.tsx');const view=await mount(el(Dialog,{defaultOpen:true},el(DialogContent,null,el(DialogTitle,null,'Kiểm tra'),el(FeedbackActionButton,{id:'radix-blocked',disabled:true,disabledExplanation:'Thiếu thông tin.'},'Lưu'))));const wrapper=document.querySelector('#radix-blocked').parentElement;wrapper.focus();await key(wrapper,'Enter');const modal=document.querySelector('[role="dialog"]');assert.ok(modal.contains(alert()));const close=alert().querySelector('button');close.focus();assert.equal(document.activeElement,close);await click(close);assert.equal(alert(),null);assert.equal(document.activeElement,wrapper);await view.close()});

test('aborted and superseded-session callbacks stay silent and release native and toolbar pending state',async()=>{
 for(const kind of ['native','toolbar'])for(const name of ['AbortError','ClientSessionReadCancelled']){
  let reject,calls=0;
  const onClick=()=>{calls++;return new Promise((_,fail)=>reject=fail);};
  const component=kind==='native'?el(FeedbackActionButton,{id:'cancelled-action',onClick},'Thử'):el(StandardToolbar,{items:[toolbar.action({id:'cancelled-action',onClick},'Thử')]});
  const view=await mount(component);
  view.host.querySelector('#cancelled-action').focus();await click(view.host.querySelector('#cancelled-action'));
  assert.equal(view.host.querySelector('#cancelled-action').disabled,true);
  const error=Error('private cancellation details');error.name=name;await act(async()=>reject(error));
  assert.equal(alert(),null);assert.equal(calls,1);assert.equal(view.host.querySelector('#cancelled-action').disabled,false);
  assert.equal(document.activeElement,view.host.querySelector('#cancelled-action'));
  await view.close();
 }
});

for(const kind of ['native','toolbar'])test(`${kind} final callback failure replaces an earlier pending-repeat explanation`,async()=>{
 let reject,calls=0;
 const onClick=()=>{calls++;return new Promise((_,fail)=>reject=fail);};
 const component=kind==='native'?el(FeedbackActionButton,{id:'eventual-failure',onClick},'Thử'):el(StandardToolbar,{items:[toolbar.action({id:'eventual-failure',onClick},'Thử')]});
 const view=await mount(component);
 try{
  await click(view.host.querySelector('#eventual-failure'));
  await click(view.host.querySelector('#eventual-failure').parentElement);
  assert.equal(calls,1);assert.match(alert().textContent,/Đang xử lý/);
  await act(async()=>reject(Error('private SQL token')));
  assert.match(alert().textContent,/Không thể hoàn tất thao tác/);
  assert.doesNotMatch(alert().textContent,/Đang xử lý|private|SQL|token/);
  assert.equal(view.host.querySelector('#eventual-failure').disabled,false);
 }finally{await view.close();}
});

test('default stable action keeps its native button mounted and blocked feedback cannot execute it',async()=>{
 let calls=0;
 const component=disabled=>el(FeedbackActionButton,{id:'stable-check',disabled,disabledExplanation:'Đang xác minh quyền.',onClick:()=>{calls++;}},'Chọn phân bổ');
 const view=await mount(component(false));
 try{
  const original=view.host.querySelector('#stable-check'),shell=original.parentElement;
  await click(original);assert.equal(calls,1);
  for(let i=0;i<4;i++){
   await view.render(component(true));assert.equal(view.host.querySelector('#stable-check')===original,true);assert.equal(original.parentElement===shell,true);assert.equal(original.disabled,true);
   await click(shell);assert.equal(calls,i+1);assert.match(alert().textContent,/Đang xác minh quyền/);await click(alert().querySelector('button'));
   await view.render(component(false));assert.equal(view.host.querySelector('#stable-check')===original,true);assert.equal(shell.getAttribute('role'),null);assert.equal(original.disabled,false);await click(original);assert.equal(calls,i+2);
  }
 }finally{await view.close();}
});


test('toolbar native action remains mounted across repeated external verification and busy toggles',async()=>{
 let calls=0;
 const component=disabled=>el(StandardToolbar,{items:[toolbar.action({id:'stable-toolbar',disabled,disabledExplanation:'Đang xác minh dữ liệu.',onClick:()=>{calls++;}},'Xác nhận hủy phân công')]});
 const view=await mount(component(false));
 try{
  const native=view.host.querySelector('#stable-toolbar'),shell=native.parentElement;
  for(let i=0;i<6;i++){
   await view.render(component(true));assert.equal(view.host.querySelector('#stable-toolbar')===native,true);assert.equal(native.parentElement===shell,true);assert.equal(native.disabled,true);
   await click(shell);assert.equal(calls,i);await click(alert().querySelector('button'));
   await view.render(component(false));assert.equal(view.host.querySelector('#stable-toolbar')===native,true);assert.equal(native.disabled,false);await click(native);assert.equal(calls,i+1);
  }
 }finally{await view.close();}
});
