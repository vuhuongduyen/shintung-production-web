import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
const source=readFileSync(new URL('../components/employee-directory.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const fixtures=[{id:'TEST-A',name:'Alpha',line:'A',active:true,version:1},{id:'TEST-B',name:'Beta',line:'B',active:true,version:1},{id:'TEST-C',name:'Gamma',line:'C',active:true,version:1}];
function harness(locale='vi'){
 let cursor=0;const states=[],network=[];
 const hooks={...React,useState:init=>{const i=cursor++;if(!(i in states))states[i]=i===0?fixtures:typeof init==='function'?init():init;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}];},useRef:initial=>({current:initial}),useEffect:()=>{},useSyncExternalStore:(_sub,get)=>get()};
 const toolbar={action:(props,label,allowed=true,intent,backLevel)=>({kind:'action',props,label,allowed,intent,backLevel}),field:(label,items)=>({kind:'field',label,items}),input:props=>({kind:'input',props}),select:(props,options)=>({kind:'select',props,options})};
 const req=name=>{
  if(name==='react')return {...hooks,default:hooks,__esModule:true};
  if(name.endsWith('.css'))return {};
  if(name.endsWith('data-sync'))return {apiFetch:(...args)=>{network.push(args);throw Error('Unexpected network call');},useDataRefresh:()=>0};
  if(name.endsWith('StandardToolbar'))return {StandardToolbar:'StandardToolbar',toolbar};
  if(name.endsWith('translations'))return {toolbarLocale:()=>locale,subscribeToolbarLocale:()=>()=>{}};
  if(name.endsWith('basic-master-cancel'))return {useMasterCancellation:()=>({dialog:null,open:()=>{},busy:false})};
  if(name.endsWith('basic-master.mjs'))return {isMasterCancelled:e=>Boolean(e?.cancelled),newestMasterFirst:(a,b)=>b.id.localeCompare(a.id)};
  const key=name.split('/').at(-1);return {[key]:key};
 };
 const module={exports:{}};new Function('require','module','exports','React',js)(req,module,module.exports,React);
 const walk=(n,fn)=>{if(Array.isArray(n)){n.forEach(x=>walk(x,fn));return;}if(!React.isValidElement(n))return;fn(n);walk(n.props.children,fn);};
 const render=()=>{cursor=0;const tree=module.exports.default();let bar;const rows=[];walk(tree,n=>{if(n.type==='StandardToolbar')bar=n.props.items.filter(Boolean);if(n.type==='tr'&&n.key?.startsWith('TEST-'))rows.push(n.key);});return {bar,rows};};
 const action=(view,intent)=>view.bar.find(x=>x.kind==='action'&&x.intent===intent);
 const field=(view,label)=>view.bar.find(x=>x.kind==='field'&&x.label===label)?.items[0];
 return {render,action,field,network};
}
test('employee toolbar starts with actions and lookup toggle, no permanently expanded standalone Line',()=>{
 const h=harness(),v=h.render();assert.equal(v.bar.filter(x=>x.kind==='field').length,0);assert.ok(h.action(v,'lookup'));assert.equal(h.action(v,'back'),undefined);
 h.action(v,'lookup').props.onClick();const open=h.render();assert.deepEqual(open.bar.filter(x=>x.kind==='field').map(x=>x.label),['TRA THEO','NỘI DUNG TRA','Line']);assert.equal(open.bar.filter(x=>x.kind==='select').length,0);assert.equal(open.bar.filter(x=>x.intent==='back').length,1);
});
test('typing and Line choice do not change results until explicit Search; Back closes and retains applied Line',()=>{
 const h=harness();h.action(h.render(),'lookup').props.onClick();let v=h.render();h.field(v,'Line').props.onChange({target:{value:'B'}});h.field(v,'NỘI DUNG TRA').props.onChange({target:{value:'Beta'}});v=h.render();assert.deepEqual(v.rows,['TEST-A','TEST-B','TEST-C']);
 h.action(v,'search').props.onClick();v=h.render();assert.deepEqual(v.rows,['TEST-B']);h.action(v,'back').props.onClick();v=h.render();assert.equal(h.field(v,'Line'),undefined);assert.deepEqual(v.rows,['TEST-B']);
 h.action(v,'lookup').props.onClick();v=h.render();assert.equal(h.field(v,'Line').props.value,'B');assert.equal(h.field(v,'NỘI DUNG TRA').props.value,'Beta');assert.equal(h.network.length,0);
});
test('unapplied mode changes do not reorder results and reopening discards unsubmitted lookup edits',()=>{
 const h=harness();h.action(h.render(),'lookup').props.onClick();let v=h.render();h.field(v,'TRA THEO').props.onChange({target:{value:'createDate'}});v=h.render();assert.deepEqual(v.rows,['TEST-A','TEST-B','TEST-C']);h.action(v,'back').props.onClick();h.action(h.render(),'lookup').props.onClick();v=h.render();assert.equal(h.field(v,'TRA THEO').props.value,'line');
 h.field(v,'TRA THEO').props.onChange({target:{value:'createDate'}});v=h.render();h.action(v,'search').props.onClick();assert.deepEqual(h.render().rows,['TEST-C','TEST-B','TEST-A']);
});
test('Clear restores all Line results, with canonical field labels recognized in each locale',()=>{
 for(const locale of ['vi','en','zh']){const h=harness(locale);h.action(h.render(),'lookup').props.onClick();let v=h.render();assert.ok(h.field(v,'TRA THEO'));h.field(v,'Line').props.onChange({target:{value:'C'}});h.action(h.render(),'search').props.onClick();assert.deepEqual(h.render().rows,['TEST-C']);h.action(h.render(),'clear').props.onClick();assert.deepEqual(h.render().rows,['TEST-A','TEST-B','TEST-C']);assert.equal(h.network.length,0);}
});
test('load/save/import and permission expressions remain separate from lookup actions',()=>{
 assert.match(source,/useEffect\(\(\)=>\{void load\(\);return\(\)=>loadRequest.current\?\.abort\(\);\},\[dataRevision\]\)/);
 assert.match(source,/toolbar\.action\(\{disabled:busy\|\|!allowed, disabledExplanation:[^\n]+onClick:/);
 assert.match(source,/toolbar\.action\(\{disabled:busy\|\|!allowed\|\|!current\|\|isMasterCancelled\(current\)/);
 assert.doesNotMatch(source,/canCancel/);
 assert.match(source,/value=\{draft.endDate\|\|''\}/);
 assert.match(source,/Ngày ngưng làm việc là ngày đầu tiên không còn làm việc/);
 assert.match(source,/onClick:\(\)=>setAppliedLookup\(\{mode:searchMode,query,line\}\)/);
});
test('employee Search-by uses the existing catalog key and resolves actual VI EN Traditional Chinese text',async()=>{
 const {createServer}=await import('vite');const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});
 try{
  const {translateToolbar}=await vite.ssrLoadModule('/components/standard-toolbar/translations.ts');
  const h=harness('zh');h.action(h.render(),'lookup').props.onClick();const field=h.render().bar.find(x=>x.kind==='field'&&x.label==='TRA THEO');assert.ok(field);
  assert.equal(translateToolbar(field.label,'vi'),'TRA THEO');assert.equal(translateToolbar(field.label,'en'),'SEARCH BY');assert.equal(translateToolbar(field.label,'zh'),'查詢依據');
 }finally{await vite.close();}
});
test('all employee lookup captions and input labels are checked with the real locale translator',async()=>{
 const {createServer}=await import('vite');const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false}});
 try{
  const {translateToolbar}=await vite.ssrLoadModule('/components/standard-toolbar/translations.ts');
  const expectations={vi:['TRA THEO','NỘI DUNG TRA','Line','Mã hoặc tên','Thêm/sửa gần nhất'],en:['SEARCH BY','SEARCH VALUE','Line','ID or name','Latest added or edited'],zh:['查詢依據','查詢內容','Line','編號或姓名','最近新增或修改']};
  for(const locale of ['vi','en','zh']){
   const h=harness(locale);h.action(h.render(),'lookup').props.onClick();let v=h.render();
   const captions=v.bar.filter(x=>x.kind==='field').map(x=>translateToolbar(x.label,locale));
   assert.deepEqual(captions,expectations[locale].slice(0,3));
   assert.equal(h.field(v,'NỘI DUNG TRA').props.placeholder,expectations[locale][3]);
   h.field(v,'TRA THEO').props.onChange({target:{value:'createDate'}});v=h.render();assert.equal(h.field(v,'NỘI DUNG TRA').props.value,expectations[locale][4]);
  }
 }finally{await vite.close();}
});
test('employee toolbar keeps import hidden and provides explicit refresh while retaining lookup and automatic reload',()=>{
 for(const locale of ['vi','en','zh']){
  const h=harness(locale),view=h.render();const labels=view.bar.filter(x=>x.kind==='action').map(x=>x.label);
  for(const removed of ['Nhập danh sách','Import list','匯入名單','Tải lại','Refresh','重新整理'].slice(0,3))assert.ok(!labels.includes(removed),`${locale}: ${removed}`);
  assert.ok(labels.includes(({vi:'Tải lại',en:'Refresh',zh:'重新載入'})[locale]));assert.ok(h.action(view,'lookup'));assert.equal(h.network.length,0);
 }
 assert.match(source,/useEffect\(\(\)=>\{void load\(\);return\(\)=>loadRequest.current\?\.abort\(\);\},\[dataRevision\]\)/);
 assert.match(source,/const importFile=async\(\)=>/);
 assert.match(source,/action:'import',rows:importRows/);
});
