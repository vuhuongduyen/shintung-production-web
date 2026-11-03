import {actionPropsFingerprint} from './helpers/action-props-fingerprint.mjs';
import {actionFeedbackComponentFixture} from './helpers/action-feedback-fixture.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import postcss from 'postcss';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},appType:'custom',server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {StandardToolbar,toolbar,selectToolbarBack,ToolbarPermissions}=await vite.ssrLoadModule('/components/standard-toolbar/StandardToolbar.tsx');
const {UiLabel}=await vite.ssrLoadModule('/components/standard-toolbar/UiLabel.tsx');
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const render=(c,p)=>renderToStaticMarkup(React.createElement(c,p));
test('Giờ công declares one toolbar returnToList across closed and open search, preserving its guarded callback',()=>{
 const s=read('components/labor-hours-master.tsx'),ast=ts.createSourceFile('labor.tsx',s,99,true,4);const calls=[];
 function walk(n,inToolbar=false){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='StandardToolbar')inToolbar=true;
  if(inToolbar&&ts.isCallExpression(n)&&n.expression.getText(ast)==='toolbar.action'&&n.arguments[0]?.getText(ast).includes('returnToList'))calls.push(n);
  ts.forEachChild(n,c=>walk(c,inToolbar));}
 walk(ast);assert.equal(calls.length,1);assert.match(calls[0].getText(ast),/Quay lại danh sách/);assert.match(calls[0].getText(ast),/"back"/);
 assert.match(s,/if \(\(panel === "create" \|\| panel === "edit"\) && dirty\) \{\s*setDiscardIntent\("list"\);\s*return;/);
 for(const part of ['setPanel(null)','setSelected("")','setQuery("")','onListReset()'])assert.ok(s.includes(part),part);
});
test('production sidebar icon selectors exclude UiLabel text in normal and active states',()=>{
 const css=postcss.parse(read('app/globals.css'));const rules=[];css.walkRules(r=>{if(r.selector.includes('production-report-actions')&&r.selector.includes('> span'))rules.push(r.selector);});
 assert.deepEqual(rules,['.production-report-actions button > span:not([data-own-language])','.app-sidebar .production-report-actions button.active > span:not([data-own-language])']);
 const label=render(UiLabel,{children:'SX báo công'});assert.match(label,/<span data-own-language="true" style="display:contents">SX báo công<\/span>/);
 // This is selector/markup verification, not a browser computed-style assertion.
 assert.doesNotMatch(read('app/globals.css'),/production-report-actions button(?:\.active)? > span\s*\{/);
});
test('production submenu active hover and keyboard focus use the ordinary orange submenu palette',()=>{
 const css=postcss.parse(read('app/globals.css'));
 const matches=selector=>{const found=[];css.walkRules(r=>{if(r.selectors?.includes(selector))found.push(r)});return found;};
 const values=r=>Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
 const ordinary=values(matches('.sidebar-children button.active')[0]);
 for(const state of [':hover',':focus-visible','.active']){
  const rules=matches('.app-sidebar .production-report-actions button'+state);assert.equal(rules.length,1);
  const actual=values(rules[0]);assert.equal(actual.background,ordinary.background);assert.equal(actual.color,ordinary.color);
  assert.equal(actual.background,'#cc700d');assert.equal(actual.color,'#fff');assert.equal(actual['font-size'],undefined);assert.equal(actual['font-weight'],undefined);
 }
});
test('one translated Back is rendered for multiple navigation layers in either source order',()=>{
 const parent=toolbar.action({onClick:()=>{}},'Quay lại danh sách',true,'back','parent');
 const lookup=toolbar.action({onClick:()=>{}},'Quay lại',true,'back','lookup');
 const detail=toolbar.action({onClick:()=>{}},'Quay lại',true,'back','detail');
 for(const items of [[parent,lookup,detail],[detail,lookup,parent],[lookup,parent],[parent]]){
  const html=render(StandardToolbar,{name:'Layers',items});
  assert.equal((html.match(/>Quay lại<\/button>/g)||[]).length,1);assert.doesNotMatch(html,/Quay lại danh sách<\/button>/);
 }
 assert.equal(selectToolbarBack([parent,lookup,detail]),detail);
 assert.equal(selectToolbarBack([detail,lookup,parent]),detail);
 assert.equal(selectToolbarBack([lookup,parent]),lookup);
 assert.equal(selectToolbarBack([parent]),parent);
 assert.equal(selectToolbarBack([]),undefined);
});
test('repeated Back selects existing detail, lookup, then parent callback without firing another action',()=>{
 let detailOpen=true,lookupOpen=true;const calls=[];
 const parent=toolbar.action({onClick:()=>calls.push('parent')},'Quay lại',true,'back','parent');
 const lookup=toolbar.action({onClick:()=>{calls.push('lookup');lookupOpen=false}},'Quay lại',true,'back','lookup');
 const detail=toolbar.action({onClick:()=>{calls.push('detail');detailOpen=false}},'Quay lại',true,'back','detail');
 const items=()=>[parent,...(lookupOpen?[lookup]:[]),...(detailOpen?[detail]:[])];
 for(let i=0;i<3;i++)selectToolbarBack(items()).props.onClick({});
 assert.deepEqual(calls,['detail','lookup','parent']);
});
test('disabled or unauthorized current layer never falls back to an outer callback',()=>{
 const parent=toolbar.action({onClick:()=>{}},'Parent',true,'back','parent');
 const blocked=toolbar.action({disabled:true,onClick:()=>{}},'Detail',true,'back','detail');
 assert.equal(selectToolbarBack([blocked,parent]),blocked);
 const html=render(StandardToolbar,{items:[blocked,parent]});assert.match(html,/disabled=""[^>]*>Quay lại<\/button>/);assert.equal((html.match(/<button/g)||[]).length,1);
 const forbidden={...blocked,allowed:false};assert.equal(selectToolbarBack([forbidden,parent]),forbidden);
 assert.doesNotMatch(render(StandardToolbar,{items:[forbidden,parent]}),/<button/);
 const denied=renderToStaticMarkup(React.createElement(ToolbarPermissions.Provider,{value:(_name,label)=>label!=='Detail'},React.createElement(StandardToolbar,{items:[blocked,parent]})));
 assert.doesNotMatch(denied,/<button/);
});
test('SKU guarded form/history/detail beats lookup, Capacity panel beats lookup and lookup beats parent',()=>{
 const page=read('app/page.tsx'),capacity=read('components/weekly-capacity.tsx');
 assert.match(page,/true, "back", addingSku \|\| \(selected && \(skuHistoryOpen \|\| skuDetailOpen\)\) \? 'detail' : 'parent'/);
 assert.match(capacity,/onClick:onNavigateSummary\},t\('Quay lại','返回','Back'\), true, 'back', 'parent'/);
 assert.match(capacity,/onClick:\(\)=>setSearch\(false\)\},'Quay lại',true,'back', 'lookup'/);
 assert.match(capacity,/onClick:\(\)=>setPanel\(null\)\},t\('Quay lại','返回','Back'\), true, 'back', 'detail'/);
 assert.match(capacity,/disabled:dirty,onClick:onNavigateSummary/);
});
test('existing Back translation remains VI English and Traditional Chinese without new Close labels',async()=>{
 const {translateToolbar}=await vite.ssrLoadModule('/components/standard-toolbar/translations.ts');
 assert.equal(translateToolbar('Quay lại','vi'),'Quay lại');assert.equal(translateToolbar('Quay lại','en'),'Back');assert.equal(translateToolbar('Quay lại','zh'),'返回');
});
test('menu callbacks, disabled and permission props retain the approved v807 snapshot fingerprints',()=>{
 const baseline=JSON.parse(read('tests/back-action-props-baseline.json'));assert.equal(baseline.files.length,3);assert.equal(baseline.baseCommit,'c84775445ed3ef4c09fc583ac06b19881f9ae6d9');
 for(const {file,...expected}of baseline.files)assert.deepEqual(actionPropsFingerprint(file,read(file)),expected,file);
});
test('action fingerprint detects callback, disabled, permission and JSX guard changes while allowing explanation copy',()=>{
 const source="toolbar.action({disabled:busy||!allowed,onClick:()=>save()},'Save',allowed); const button=<button disabled={busy} onClick={save}/>;";
 const fingerprint=value=>actionPropsFingerprint('synthetic.tsx',value),before=fingerprint(source);
 for(const changed of [source.replace('()=>save()','()=>other()'),source.replace('busy||!allowed','busy'),source.replace("'Save',allowed","'Save',true"),source.replace('disabled={busy}','disabled={false}'),source.replace('onClick={save}','onClick={other}')])assert.notDeepEqual(fingerprint(changed),before);
 assert.deepEqual(fingerprint(source.replace('onClick:()=>save()',"disabledExplanation:'Pending or denied',onClick:()=>save()")),before);
});
test('InTransit Back resets UI state then closes lookup without changing reusable reset',()=>{
 const source=read('components/in-transit.tsx'),ast=ts.createSourceFile('in-transit.tsx',source,99,true,4);let reset,back;
 function walk(n){
  if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='reset')reset=n.initializer.getText(ast);
  if(ts.isCallExpression(n)&&n.expression.getText(ast)==='toolbar.action'&&n.arguments[1]?.getText(ast).includes('Quay lại'))back=n.arguments[0].properties.find(p=>p.name?.getText(ast)==='"onClick"').initializer.getText(ast);
  ts.forEachChild(n,walk);
 }walk(ast);assert.ok(reset);assert.ok(back);
 assert.equal(reset.replace(/\s+/g,''),"()=>{setFilters(emptyFilters);setSelected([]);setDetail(null);setShowHistory(false);setDialog(\"\");setPage(1);}");
 const calls=[],emptyFilters={query:''};const names=['setFilters','setSelected','setDetail','setShowHistory','setDialog','setPage'];
 const setters=names.map(name=>value=>calls.push([name,value]));
 const resetFn=new Function(...names,'emptyFilters','return ('+reset+')')(...setters,emptyFilters);
 const backFn=new Function('reset','setShowSearch','return ('+back+')')(resetFn,value=>calls.push(['setShowSearch',value]));
 backFn();assert.deepEqual(calls,[['setFilters',emptyFilters],['setSelected',[]],['setDetail',null],['setShowHistory',false],['setDialog',''],['setPage',1],['setShowSearch',false]]);
 calls.length=0;resetFn();assert.equal(calls.length,6);assert.ok(!calls.some(([name])=>name==='setShowSearch'));
 assert.match(source,/onClick": \(\) => setShowSearch\(\(v\) => !v\)/);
});
test('Labor history has one whole-screen Back in the foreground; callback and dirty guard remain intact',()=>{
 const source=read('components/labor-hours-master.tsx'),ast=ts.createSourceFile('labor.tsx',source,99,true,4),names=[];
 function collect(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));ts.forEachChild(n,collect)}collect(ast);
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 function harness(panel,dirty=false){
  let cursor=0,listResets=0;const states={panel,dirty,selected:'TEST-SKU',loading:false,records:[{sku:'TEST-SKU',laborHour:1,version:1}]};
  const hooks={...React,useEffect:()=>{},useMemo:fn=>fn(),useState:init=>{const name=names[cursor++];if(!(name in states))states[name]=typeof init==='function'?init():init;return [states[name],v=>states[name]=typeof v==='function'?v(states[name]):v];}};
  const flatten=items=>items.flatMap(i=>!i?[]:Array.isArray(i)?flatten(i):i.kind==='group'?flatten(i.items):[i]);
  function BackOnlyToolbar({items}){const action=selectToolbarBack(flatten(items).filter(i=>i.kind==='action'));return action?React.createElement('button',action.props,'Quay lại'):null;}
  const req=name=>{
   if(name.endsWith('action-feedback'))return actionFeedbackComponentFixture;
   if(name==='react')return {...hooks,default:hooks,__esModule:true};
   if(name.endsWith('StandardToolbar'))return {StandardToolbar:BackOnlyToolbar,toolbar};
   if(name.endsWith('UiLabel'))return {UiLabel:({children})=>React.createElement('span',null,children)};
   if(name.endsWith('data-sync'))return {apiFetch:()=>{throw Error('No API during this test')},useDataRefresh:()=>0};
   if(name.endsWith('basic-master-cancel'))return {useMasterCancellation:()=>({dialog:null,busy:false,open:()=>{}})};
   if(name.endsWith('basic-master.mjs'))return {isMasterCancelled:()=>false,newestMasterFirst:()=>0};
   if(name.endsWith('sku-state.mjs'))return {usableSku:()=>true};
   if(name.endsWith('production-plan'))return {invalidateLaborPlanCache:()=>{}};
   const key=name.split('/').at(-1);return {[key]:key==='DataCell'?'td':key==='DataTable'?'div':key};
  };
  const module={exports:{}};new Function('require','module','exports','React',js)(req,module,module.exports,React);
  const props={masterSkus:[{code:'TEST-SKU',name:'Synthetic',group:'TEST',line:'A',status:'Đang sử dụng',specification:''}],operator:'TEST',language:'vi',onListReset:()=>listResets++};
  function buttons(){cursor=0;const tree=module.exports.default(props),backs=[];
   const text=n=>Array.isArray(n)?n.map(text).join(''):React.isValidElement(n)?typeof n.type==='function'?text(n.type(n.props)):text(n.props.children):typeof n==='string'?n:'';
   function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!React.isValidElement(n))return;if(typeof n.type==='function'){walk(n.type(n.props));return;}if(n.type==='button'&&/Quay lại/.test(text(n.props.children)))backs.push(n);walk(n.props.children);}walk(tree);return backs;
  }
  return {states,buttons,get resets(){return listResets}};
 }
 for(const panel of [null,'search','history','detail']){
  const h=harness(panel),buttons=h.buttons();assert.equal(buttons.length,1,`${panel} must have one Back in the entire rendered tree`);
  if(panel==='history'){assert.equal(buttons[0].props.className,'outline-button');buttons[0].props.onClick();assert.equal(h.states.panel,null);assert.equal(h.resets,1);assert.equal(h.buttons().length,1);}
 }
 const dirty=harness('edit',true);dirty.buttons()[0].props.onClick();assert.equal(dirty.states.panel,'edit');assert.equal(dirty.states.discardIntent,'list');assert.equal(dirty.resets,0);
});
