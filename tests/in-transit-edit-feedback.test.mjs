import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import {inTransitEditBlockReason} from '../lib/in-transit-edit-feedback.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{}};new Function('module','exports',compile(read('lib/permission-feedback.ts')))(helper,helper.exports);
function harness(locale='vi'){
 let cursor=0,permitted=true;const slots=[],notifications=[];
 const slot=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return i;};
 const hooks={...React,useLayoutEffect:()=>{},useContext:()=>()=>permitted,useId:()=> 'test',useSyncExternalStore:()=>locale,useRef:init=>{const i=slot(()=>({current:init}));return slots[i];},useState:init=>{const i=slot(init);return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}};
 const req=name=>name.endsWith('action-feedback')?(name.includes('lib/')?{...actionFeedbackHelpers,notifyActionFailure:(message,trigger)=>notifications.push({message,trigger})}:actionFeedbackComponentFixture):name==='react'?{...hooks,default:hooks,__esModule:true}:name==='react-dom'?{flushSync:f=>f()}:name.endsWith('permission-feedback')?helper.exports:name.endsWith('translations')?{translateToolbar:s=>s,toolbarLocale:()=>locale,subscribeToolbarLocale:()=>()=>{}}:name.endsWith('FilterPanel')?{FilterPanel:'filter-panel'}:{};
 const mod={exports:{}};new Function('require','module','exports','React',compile(read('components/standard-toolbar/StandardToolbar.tsx')))(req,mod,mod.exports,React);
 const walk=(n,fn)=>{if(Array.isArray(n)){n.forEach(x=>walk(x,fn));return;}if(!React.isValidElement(n))return;fn(n);walk(n.props.children,fn);};
 const render=(items,extra={})=>{cursor=0;const tree=mod.exports.StandardToolbar({items,name:'Test',...extra});const buttons=[],alerts=[],explanations=[];walk(tree,n=>{if(n.type==='button')buttons.push(n);if(n.props.role==='alert')alerts.push(n.props.children);if(n.type==='span'&&n.props.role==='button')explanations.push(n);});return {buttons,alerts,explanations};};
 const click=async b=>{let prevented=0,stopped=0;b.props.onClick({currentTarget:{},preventDefault(){prevented++},stopPropagation(){stopped++}});await new Promise(r=>setImmediate(r));return {prevented,stopped};};
 return {render,click,notifications,toolbar:mod.exports.toolbar,permission:value=>{permitted=value;}};
}

test('state diagnosis gives a reason and remedy for every blocked edit, in three languages',()=>{
 for(const locale of ['vi','zh','en']) {
  for(const [count,status,busy] of [[0,null,false],[3,'ĐÃ ĐỒNG BỘ',false],[1,'CHƯA ĐỒNG BỘ',false],[1,'ĐÃ ĐỒNG BỘ',true]])assert.ok(inTransitEditBlockReason(count,status,busy,locale).length>5);
  assert.equal(inTransitEditBlockReason(1,'ĐÃ ĐỒNG BỘ',false,locale),'');
  assert.equal(inTransitEditBlockReason(1,'CÓ THAY ĐỔI',false,locale),'');
 }
 assert.equal(inTransitEditBlockReason(3,'ĐÃ ĐỒNG BỘ',false),'Đang chọn 3 dòng. Chỉ chọn 1 dòng để chỉnh sửa.');
});
test('zero, multiple, unsynced and busy attempts explain without invoking the disabled action',async()=>{
 for(const [count,status,busy] of [[0,null,false],[3,'ĐÃ ĐỒNG BỘ',false],[1,'CHƯA ĐỒNG BỘ',false],[1,'ĐÃ ĐỒNG BỘ',true]]) {
  const h=harness();let mutations=0;const notices=[];const reason=inTransitEditBlockReason(count,status,busy);
  const items=[h.toolbar.action({disabled:true,disabledExplanation:reason,onDisabledAttempt:r=>notices.push(r),onClick:()=>mutations++},'Chỉnh sửa')];
  const ui=h.render(items);assert.equal(ui.alerts.length,0);assert.equal(notices.length,0,'no warning merely from rendering');
  assert.equal(ui.buttons[0].props.disabled,true);assert.equal(ui.explanations.length,1);assert.equal(ui.explanations[0].props.tabIndex,0);
  await h.click(ui.explanations[0]);assert.deepEqual(notices,[reason]);
  for(const key of ['Enter',' '])ui.explanations[0].props.onKeyDown({key,currentTarget:{},preventDefault(){},stopPropagation(){}});
  assert.equal(notices.length,3);assert.equal(mutations,0);
  await h.click(ui.buttons[0]);assert.equal(mutations,0,'original callback guards even synthetic button invocation');
 }
});
test('one synced row opens normal edit; repeat during pending only explains',async()=>{
 const h=harness();let calls=0,resolve;const notices=[];
 const items=[h.toolbar.action({disabled:false,disabledExplanation:'',onDisabledAttempt:r=>notices.push(r),onClick:()=>{calls++;return new Promise(r=>resolve=r);}},'Chỉnh sửa')];
 assert.equal(h.render(items).explanations.length,0);await h.click(h.render(items).buttons[0]);assert.equal(calls,1);
 const pending=h.render(items);assert.equal(pending.buttons[0].props.disabled,true);await h.click(pending.explanations[0]);assert.equal(calls,1);assert.match(notices[0],/Đang xử lý/);
 resolve();await new Promise(r=>setImmediate(r));assert.equal(h.render(items).explanations.length,0);
});
test('hidden permission-denied edit stays hidden; stale explanation never invokes mutation',async()=>{
 const h=harness();let calls=0,notice='';const items=[h.toolbar.action({disabled:true,disabledExplanation:'Choose one',onDisabledAttempt:r=>notice=r,onClick:()=>calls++},'Chỉnh sửa')];
 const old=h.render(items).explanations[0];h.permission(false);
 const denied=h.render(items,{permissionFeedback:false});assert.equal(denied.buttons.length,0);assert.equal(denied.explanations.length,0);
 await h.click(old);assert.match(notice,/không có quyền/);assert.equal(calls,0);
});
test('integration retains native selection gate, existing floating red alert, Escape and close focus handling',()=>{
 const source=read('components/in-transit.tsx'),css=read('app/globals.css');
 assert.match(source,/disabled: !one \|\| one.syncStatus === "CHƯA ĐỒNG BỘ" \|\| busy/);
 assert.match(source,/onDisabledAttempt: explainBlockedEdit/);
 assert.match(source,/if \(one && one.syncStatus !== "CHƯA ĐỒNG BỘ" && !busy\) open\("edit"\)/);
 assert.match(source,/setEditExplanation\(reason\)/);
 assert.match(source,/setEditExplanation\(""\); feedbackTrigger.current = null;\s*}, \[error, notice\]\)/);
 assert.match(source,/setEditExplanation\(""\); feedbackTrigger.current = null;\s*}, \[selected, editBlockReason\]\)/);
 assert.match(source,/event.key === 'Escape'/);assert.match(source,/onClick={dismissFeedback}/);
 assert.match(source,/document.activeElement\?\.closest\('\.it-feedback'\).*feedbackTrigger.current\?\.focus\(\)/);
 assert.match(css,/\.it-feedback-overlay\s*{[^}]*position: fixed/s);assert.match(css,/\.it-feedback\.error\s*{[^}]*#a01818/s);
 assert.match(css,/\.it-feedback-explanation { pointer-events: none; background: transparent; }/);
});
