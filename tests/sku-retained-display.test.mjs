import {actionFeedbackComponentFixture, actionFeedbackHelpers} from './helpers/action-feedback-fixture.mjs';
import {productionDisplayTime} from '../lib/production-display-time.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSkuDisplayCache,SkuReadCancelled} from '../lib/sku-display-cache.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const records=(code='SYNTHETIC')=>[{key:code,payload:{code,status:'Chờ xác nhận'},updatedAt:'2026-10-15T00:00:00Z',revision:'r1'}];
const failure=status=>Object.assign(new Error('SYNTHETIC failure'),{status});

test('shared warm SKU snapshot is immediate and concurrent menu reads coalesce',async()=>{
 const gate=deferred();let calls=0,now=100;const cache=createSkuDisplayCache({read:()=>{calls++;return gate.promise;},now:()=>now});
 const a=cache.load(),b=cache.load();assert.equal(a,b);await tick();assert.equal(calls,1);gate.resolve(records());await a;
 const saved=cache.snapshot();assert.deepEqual(saved.records,records());assert.equal(saved.updatedAt,100);
 now=200;await cache.load();assert.equal(calls,1);assert.equal(cache.snapshot(),saved);
});
test('transient SKU refresh keeps rows/time; authoritative empty removes old rows',async()=>{
 let now=100,mode='ok';const cache=createSkuDisplayCache({now:()=>now,read:async()=>{if(mode==='fail')throw failure(503);return mode==='empty'?[]:records();}});
 await cache.load();mode='fail';now=200;const loading=cache.load(true);assert.equal(cache.snapshot().loading,true);assert.equal(cache.snapshot().records.length,1);
 await assert.rejects(loading,{status:503});assert.equal(cache.snapshot().records.length,1);assert.equal(cache.snapshot().updatedAt,100);assert.equal(cache.snapshot().error.status,503);
 mode='empty';now=300;await cache.load(true);assert.deepEqual(cache.snapshot().records,[]);assert.equal(cache.snapshot().updatedAt,300);assert.equal(cache.snapshot().error,null);
});
test('account/grant reset and late success or denial cannot restore or erase the new SKU scope',async()=>{
 for(const deny of [false,true]){
  let session=0,slow=false;const gate=deferred();const cache=createSkuDisplayCache({getSession:()=>session,read:()=>slow?gate.promise:Promise.resolve(records(`ACCOUNT ${session}`))});
  await cache.load();slow=true;const old=cache.load(true),cancelled=assert.rejects(old,SkuReadCancelled);await tick();session++;
  assert.equal(cache.snapshot().records,null);slow=false;await cache.load();const current=cache.snapshot();
  if(deny)gate.reject(failure(403));else gate.resolve(records('OLD'));await cancelled;assert.equal(cache.snapshot(),current);
 }
});
test('current 401/403 clears retained SKU and its last-success marker',async()=>{
 for(const status of [401,403]){
  let deny=false;const cache=createSkuDisplayCache({read:async()=>{if(deny)throw failure(status);return records();}});await cache.load();deny=true;
  await assert.rejects(cache.load(true),{status});assert.equal(cache.snapshot().records,null);assert.equal(cache.snapshot().updatedAt,null);
 }
});
test('mutation during pending SKU read follows one new read; transient follow-on failure does not loop',async()=>{
 for(const fail of [false,true]){
  let generation=0,calls=0;const gate=deferred();const cache=createSkuDisplayCache({getGeneration:()=>generation,read:()=>{calls++;if(calls===2)return gate.promise;if(calls===3&&fail)return Promise.reject(failure(503));return Promise.resolve(records(`READ ${calls}`));}});
  await cache.load();const old=cache.load(true);await tick();generation++;const checking=fail?assert.rejects(old,{status:503}):old;
  gate.resolve(records('STALE'));await checking;assert.equal(calls,3);assert.equal(cache.snapshot().records[0].key,fail?'READ 1':'READ 3');
 }
});

function hookHarness(cache,capabilities){
 let cursor=0,revision=0,result,enabled=true;const slots=[],effects=[],changes=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const hooks={
  useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
  useRef(initial){const index=cursor++;return slots[index]??=( {current:initial});},
  useCallback(fn,deps){const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={fn,deps};return slots[index].fn;},
  useEffect(fn,deps){const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps)){const previous=slots[index];slots[index]={deps};effects.push(()=>{previous?.cleanup?.();slots[index].cleanup=fn();});}},
 };
 const exports={},onChanged=rows=>changes.push(rows),data={apiFetch:capabilities,clientSessionGeneration:()=>0,isClientSessionReadCancelled:()=>false,subscribeClientReadInvalidation:()=>()=>{},useDataRefresh:()=>revision};
 const resource={skuDisplayState:()=>cache.snapshot(),subscribeSkuDisplay:listener=>cache.subscribe(listener),loadSkuRecords:force=>cache.load(force),replaceSkuRecords:rows=>cache.replace(rows)};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/sku-approval.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,module:{exports},setTimeout,clearTimeout,window:{dispatchEvent(){}},Event,require:name=>name.endsWith('action-feedback')?(name.includes('lib/')?actionFeedbackHelpers:actionFeedbackComponentFixture):name==='react'?hooks:name==='react/jsx-runtime'?jsx:name.includes('data-sync')?data:name.includes('sku-display-resource')?resource:name.includes('production-display-time')?{productionDisplayTime}:{SkuReadCancelled}});
 const render=()=>{cursor=0;result=exports.useSkuApproval(enabled,onChanged);while(effects.length)effects.shift()();return result;};
 return {render,get changes(){return changes;},setEnabled(value){enabled=value;},invalidate(){revision++;},status:exports.SkuDataStatus,count:exports.SkuResultCount,dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
test('actual SKU hook shows warm rows before slow capabilities, gates actions, and does not reread on quick return',async()=>{
 let calls=0;const cache=createSkuDisplayCache({read:async()=>{calls++;return records();}});await cache.load();const capability=deferred();const hook=hookHarness(cache,()=>capability.promise);
 let state=hook.render();state=hook.render();assert.equal(state.hasData,true);assert.equal(state.capabilityLoading,true);assert.equal(state.canConfirm,false);assert.equal(hook.changes.at(-1)[0].code,'SYNTHETIC');assert.equal(calls,1);
 const html=renderToStaticMarkup(React.createElement(hook.status,{state,language:'en'}));assert.equal(html,'','routine refresh/permission checks must not add a top banner');
 capability.resolve(Response.json({canConfirm:true}));await tick();state=hook.render();assert.equal(state.canConfirm,true);assert.equal(state.capabilityLoading,false);
 hook.setEnabled(false);hook.render();hook.setEnabled(true);hook.render();assert.equal(calls,1);hook.dispose();
});
test('actual SKU hook publishes first rows despite capability failure and displays persistent retry state',async()=>{
 const cache=createSkuDisplayCache({read:async()=>records()});const hook=hookHarness(cache,async()=>Response.json({error:'no permission check'},{status:503}));hook.render();await tick();hook.render();const state=hook.render();
 assert.equal(state.hasData,true);assert.equal(state.canConfirm,false);assert.ok(state.capabilityError);assert.equal(hook.changes.at(-1).length,1);
 const html=renderToStaticMarkup(React.createElement(hook.status,{state,language:'en'}));assert.match(html,/confirmation is temporarily disabled/);assert.match(html,/Retry/);assert.doesNotMatch(html,/SKU data could not be loaded/);hook.dispose();
});
test('warm WorkspaceSession initializes rows synchronously; Production does not request unused SKU capabilities',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(source,/useState<Sku\[\]>\(\(\)=>skuRecordSnapshot<Sku>\(\)/);
 assert.match(source,/const skuDataNeeded =[\s\S]*?view !== "production"/);
 assert.match(source,/!skuApproval\.capabilityLoading && !skuApproval\.capabilityError && skuStatusFilter/);
});
test('SKU result count never reports zero before a successful read; verified empty is zero',()=>{
 const hook=hookHarness(createSkuDisplayCache({read:async()=>[]}),async()=>Response.json({canConfirm:false}));
 const render=(hasData,error=null)=>renderToStaticMarkup(React.createElement(hook.count,{count:0,hasData,error,language:'en'}));
 assert.match(render(false),/Loading SKU list/);assert.doesNotMatch(render(false),/0|SKU found/);
 assert.match(render(false,new Error('offline')),/count unavailable/);assert.doesNotMatch(render(false,new Error('offline')),/0|SKU found/);
 assert.match(render(true),/<strong>0<\/strong> SKU found/);hook.dispose();
});
test('SKU shared status stays silent for normal initial/warm/refresh states in every language and keeps actionable failures',()=>{
 const hook=hookHarness(createSkuDisplayCache({read:async()=>[]}),async()=>Response.json({canConfirm:false}));
 const base={hasData:true,refreshing:false,error:null,updatedAt:1000,capabilityLoading:false,capabilityError:'',refresh:async()=>[]};
 const render=(state,language)=>renderToStaticMarkup(React.createElement(hook.status,{state:{...base,...state},language}));
 for(const language of ['vi','zh','en']){
  for(const state of [{},{refreshing:true},{capabilityLoading:true},{hasData:false,refreshing:true,capabilityLoading:true,updatedAt:null}])assert.equal(render(state,language),'');
  for(const state of [{error:new Error('offline')},{capabilityError:'offline'},{hasData:false,error:new Error('offline'),updatedAt:null}]){
   const html=render(state,language);assert.match(html,/role="alert"/);assert.match(html,/<button/);
  }
 }
 assert.match(render({error:new Error('offline')},'en'),/showing the last loaded data/);
 assert.match(render({error:new Error('offline')},'en'),/Last successful load/);
 assert.match(render({error:new Error('offline'),updatedAt:Date.parse('2026-10-18T17:30:00Z')},'en'),/19\/10\/2026 00:30:00/);
 assert.doesNotMatch(render({capabilityError:'offline'},'en'),/SKU data loaded|Last successful load/);hook.dispose();
});
test('actual Leadtime count shows table-local initial loading or failure, then verified counts',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const component=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='LeadtimeMasterView');let caption;
 const visit=node=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='div'&&node.openingElement.attributes.getText(ast).includes('className="result-bar"')&&node.getText(ast).includes('SKU có dữ liệu Lead Time'))caption=node.getText(ast);else ts.forEachChild(node,visit);};visit(component);
 assert.ok(caption);assert.match(source,/<LeadtimeMasterView\s+masterSkus=\{skuRecords\}\s+skuReadState=\{skuApproval\}/);
 const hook=hookHarness(createSkuDisplayCache({read:async()=>[]}),async()=>Response.json({canConfirm:false})),exports={};
 vm.runInNewContext(ts.transpileModule(`export function Caption({skuReadState,filteredRows,language}){return (${caption});}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,module:{exports},SkuResultCount:hook.count,require:()=>jsx});
 const render=(hasData,error=null,count=0)=>renderToStaticMarkup(React.createElement(exports.Caption,{skuReadState:{hasData,error},filteredRows:Array(count),language:'en'}));
 assert.match(render(false),/Loading SKU list/);assert.doesNotMatch(render(false),/<strong>0/);
 assert.match(render(false,new Error('offline')),/count unavailable/);assert.doesNotMatch(render(false,new Error('offline')),/<strong>0/);
 assert.match(render(true),/<strong>0<\/strong> SKU có dữ liệu Lead Time/);assert.match(render(true,null,3),/<strong>3<\/strong> SKU có dữ liệu Lead Time/);hook.dispose();
});
