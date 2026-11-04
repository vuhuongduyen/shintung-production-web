import * as weekVisibility from '../lib/week-visibility.mjs';
import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import * as plan from '../lib/production-plan.mjs';
import * as transit from '../lib/in-transit.mjs';
import * as editFeedback from '../lib/in-transit-edit-feedback.mjs';
import * as progress from '../lib/production-progress-display.mjs';

const source=ts.transpileModule(fs.readFileSync(new URL('../components/in-transit.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=(completedQty,inTransitQty)=>({rows:[{id:'TEST',sku:'TEST',week:'2026-10-12',line:'A',lsxQty:4000,completedQty,inTransitQty}],history:[]});
function harness(initialActive=true){
 const states=[],refs=[],effects=[],pending=[],requests=[],listeners=[];let c=0,r=0,e=0,revision=0,active=initialActive;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...React,useContext:()=>active,useState(init){const i=c++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(init){const i=r++;return refs[i]??={current:init};},useMemo(fn){return fn();},useEffect(fn,deps){const i=e++,old=effects[i];if(!old||!same(deps,old.deps)){effects[i]={deps};pending.push(fn);}}};
 const fetch=(url,init)=>new Promise((resolve,reject)=>requests.push({url,init,resolve,reject}));
 const toolbar={action:(props,children)=>React.createElement('button',props,children),field:(label,children)=>React.createElement('label',null,label,...children),input:props=>React.createElement('input',props),select:(props,children)=>React.createElement('select',props,children),note:children=>children,group:children=>children};
 const exports={},keyHandlers=new Map(),testDocument={activeElement:null};
 vm.runInNewContext(source,{exports,console,fetch,document:testDocument,window:{setTimeout:()=>1,clearTimeout(){},addEventListener(name,fn){keyHandlers.set(name,fn);},removeEventListener(name){keyHandlers.delete(name);}},require(name){
  if(name.endsWith('action-feedback'))return name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture;
  if(name==='react')return hooks;if(name==='react/jsx-runtime')return jsx;
  if(name.includes('data-sync'))return{apiFetch:fetch,useDataRefresh:()=>revision,clientSessionGeneration:()=>0,subscribeClientReadInvalidation:fn=>listeners.push(fn),WorkspaceActivityContext:{displayName:'WorkspaceActivityContext'},ClientSessionReadCancelled:class extends Error{}};
  if(name.includes('production-plan.mjs'))return plan;if(name.includes('lib/in-transit.mjs'))return transit;if(name.includes('in-transit-edit-feedback'))return editFeedback;if(name.includes('production-progress-display'))return progress;
  // Display-only child is outside this effect/request harness; no authorization is stubbed.
  if(name.endsWith('week-visibility.mjs'))return weekVisibility;
  if(name.endsWith('quantity-progress'))return {default:({value})=>React.createElement('span',null,value)};
  if(name.endsWith('production-status-legend'))return {default:()=>null};
  if(name.includes('in-transit-semantics'))return{inTransitCellKind:()=> 'text'};if(name.includes('StandardToolbar'))return{toolbar,StandardToolbar:()=>null};if(name.includes('ManualPagination'))return{ManualPagination:()=>null};if(name.includes('DataCell'))return{DataCell:()=>null};if(name.includes('transit-history-import'))return{default:()=>null};throw Error(name);
 }});
 const commit=()=>{c=r=e=0;const tree=exports.InTransit({});while(pending.length)pending.shift()();return tree;};
 return {commit,requests,keyHandlers,testDocument,data:()=>states.find(value=>Array.isArray(value?.rows)),setActive(value){active=value;commit();},mutate(){listeners.forEach(fn=>fn('mutation'));revision++;commit();},refresh(){revision++;commit();}};
}

test('actual In Transit effect re-reads a revision received while initial load is busy and never applies its stale quantities',async()=>{
 const h=harness();h.commit();h.commit();
 const first=h.requests.find(r=>r.url==='/api/in-transit');assert.ok(first);
 h.mutate();
 for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?snapshot(0,4000):{records:[]}));
 await tick();
 const fresh=h.requests.filter(r=>r.url==='/api/in-transit')[1];assert.ok(fresh,'mutation during a pending read must fetch the new generation');
 assert.equal(h.data().rows.length,0,'pre-write response must not become a displayed row');
 fresh.resolve(Response.json(snapshot(3000,1000)));await tick();h.commit();
 assert.equal(h.data().rows[0].completedQty,3000);assert.equal(h.data().rows[0].inTransitQty,1000);
 for(const request of h.requests.slice(2))request.resolve(Response.json(snapshot(3000,1000)));await tick();h.commit();
 assert.equal(h.data().rows[0].completedQty,3000);
});

test('actual In Transit effect does not lose focus/poll refresh received while busy',async()=>{
 const h=harness();h.commit();h.commit();h.refresh();
 for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?snapshot(0,4000):{records:[]}));
 await tick();h.commit();await tick();
 const replacement=h.requests.filter(r=>r.url==='/api/in-transit')[1];assert.ok(replacement,'busy becoming false must consume the pending revision');
 replacement.resolve(Response.json(snapshot(3000,1000)));await tick();h.commit();
 assert.equal(h.data().rows[0].completedQty,3000);assert.equal(h.data().rows[0].inTransitQty,1000);
});

test('actual mounted In Transit table ignores a pre-write response that arrives after the new quantity',async()=>{
 const h=harness();h.commit();
 for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?snapshot(0,4000):{records:[]}));
 await tick();h.commit();h.refresh();await tick();
 const old=h.requests.filter(r=>r.url==='/api/in-transit')[1];assert.ok(old);
 h.mutate();await tick();
 const fresh=h.requests.filter(r=>r.url==='/api/in-transit')[2];assert.ok(fresh);
 fresh.resolve(Response.json(snapshot(3000,1000)));await tick();h.commit();
 old.resolve(Response.json(snapshot(0,4000)));await tick();h.commit();
 assert.equal(h.data().rows[0].completedQty,3000);assert.equal(h.data().rows[0].inTransitQty,1000);
});

function elements(tree) {
 const out=[];const walk=node=>{if(Array.isArray(node)){node.forEach(walk);return;}if(!React.isValidElement(node))return;out.push(node);walk(node.props.children);walk(node.props.items);};walk(tree);return out;
}
test('blocked Edit diagnosis clears on selection and does not erase a subsequent sync failure',async()=>{
 const h=harness();h.commit();h.commit();
 const fixture=snapshot(0,4000);Object.assign(fixture.rows[0],{syncStatus:'CHƯA ĐỒNG BỘ',lsxCode:'TEST-LSX',lsxOpenedAt:'2026-10-12',status:'ĐÃ MỞ LSX'});
 for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?fixture:{records:[]}));
 await tick();let tree=h.commit();h.commit();
 const edit=elements(tree).find(n=>n.props.onDisabledAttempt);assert.ok(edit);
 edit.props.onDisabledAttempt('Chưa chọn dòng nào. Chọn 1 dòng đã đồng bộ để chỉnh sửa.',{focus(){}});
 tree=h.commit();assert.ok(elements(tree).some(n=>String(n.props.className).includes('it-feedback-explanation')));
 const rowCheckbox=elements(tree).find(n=>n.type==='input'&&n.props.type==='checkbox'&&String(n.props['aria-label']).startsWith('Select '));assert.ok(rowCheckbox);
 rowCheckbox.props.onChange({target:{checked:true}});h.commit();tree=h.commit();assert.ok(!elements(tree).some(n=>String(n.props.className).includes('it-feedback-explanation')));
 const selectedEdit=elements(tree).find(n=>n.props.onDisabledAttempt);assert.match(selectedEdit.props.disabledExplanation,/chưa đồng bộ/);
 selectedEdit.props.onDisabledAttempt(selectedEdit.props.disabledExplanation,{focus(){}});tree=h.commit();
 const sync=elements(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children?.props?.children).some(v=>v==='Đồng bộ'));
 assert.ok(sync,'sync action found');const start=h.requests.length;sync.props.onClick();
 await tick();const post=h.requests.slice(start).find(r=>r.init?.method==='POST');assert.ok(post);post.resolve(Response.json({error:'TEST sync failure'},{status:422}));await tick();
 for(const request of h.requests.slice(start).filter(r=>!r.init?.method))request.resolve(Response.json(request.url==='/api/in-transit'?fixture:{records:[]}));
 await tick();h.commit();tree=h.commit();
 const feedback=elements(tree).find(n=>n.props.className==='it-feedback-overlay');assert.ok(feedback,'ordinary failure overlay restored');
 assert.ok(elements(feedback).some(n=>n.type==='p'&&String(n.props.children).includes('TEST sync failure')),'server failure remains visible');
 assert.ok(!elements(tree).some(n=>String(n.props.className).includes('it-feedback-explanation')));
});

test('explanation keyboard dismissal and Close preserve the trigger focus',async()=>{
 const h=harness();h.commit();h.commit();for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?snapshot(0,4000):{records:[]}));await tick();h.commit();let tree=h.commit();
 let focused=0;const trigger={focus(){focused++;}};
 const show=()=>{elements(tree).find(n=>n.props.onDisabledAttempt).props.onDisabledAttempt('Chọn 1 dòng để chỉnh sửa.',trigger);tree=h.commit();};
 show();let prevented=0,stopped=0;h.testDocument.activeElement={closest:()=>true};
 h.keyHandlers.get('keydown')({key:'Escape',preventDefault(){prevented++;},stopPropagation(){stopped++;}});tree=h.commit();
 assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(focused,1);assert.ok(!elements(tree).some(n=>String(n.props.className).includes('it-feedback-overlay')));
 show();elements(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Đóng thông báo').props.onClick();tree=h.commit();assert.equal(focused,2);assert.ok(!elements(tree).some(n=>String(n.props.className).includes('it-feedback-overlay')));
});


test('inactive In Transit workspace clears visible feedback without changing saved quantities',async()=>{
 const h=harness();h.commit();h.commit();
 for(const request of h.requests)request.resolve(Response.json(request.url==='/api/in-transit'?snapshot(100,3900):{records:[]}));
 await tick();let tree=h.commit();h.commit();
 const edit=elements(tree).find(n=>n.props.onDisabledAttempt);assert.ok(edit);
 edit.props.onDisabledAttempt('Chọn một dòng.',{focus(){}});tree=h.commit();
 assert.ok(elements(tree).some(n=>String(n.props.className).includes('it-feedback-explanation')));
 h.setActive(false);tree=h.commit();tree=h.commit();
 assert.ok(!elements(tree).some(n=>String(n.props.className).includes('it-feedback-explanation')));
 assert.equal(h.data().rows[0].completedQty,100);
});
